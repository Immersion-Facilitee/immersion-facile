import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const temporary = (name: string) => join(process.env.RUNNER_TEMP!, name);
const root = () => `/repos/${process.env.GITHUB_REPOSITORY}`;
type User = { id: number; login: string; type: string };
type Comment = {
  id: number;
  body: string;
  user: User;
  created_at: string;
  html_url: string;
};
export type IssueCommentEvent = {
  action: string;
  sender: User;
  repository: { owner: { login: string } };
  issue: { number: number };
  comment: Comment;
};
type Issue = {
  title: string;
  body: string | null;
  html_url: string;
  pull_request?: object;
};
type PullRequest = {
  base: { sha: string };
  head: { sha: string; repo: { full_name: string } };
};
type FileChange = { filename: string; status: string; patch?: string };

// Two workflow steps: authorize with the membership token, then answer on the runner.
async function runWorkflowStep(step: string) {
  const event: IssueCommentEvent = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH!, "utf8"),
  );
  switch (step) {
    case "authorize": {
      const question = extractQuestion(event, process.env.GITHUB_EVENT_NAME!);
      if (!question) return;
      const authorized = await isActiveTeamMember(
        event.sender.login,
        event.repository.owner.login,
        process.env.AGENT_ALLOWED_TEAM!,
      );
      if (authorized)
        await appendFile(process.env.GITHUB_OUTPUT!, "authorized=true\n");
      return;
    }
    case "answer":
      return answerRequest(event);
    default:
      throw new Error("Étape inconnue");
  }
}

export async function answerRequest(event: IssueCommentEvent) {
  let answer: string | undefined;
  try {
    await setReaction(event, "eyes");
    const context = await collectContext(event);
    await writeFile(".agent-explo-context.json", JSON.stringify(context));
    await install();
    const home = temporary("agent-explo-home");
    await mkdir(home, { recursive: true });
    const model = process.env.OPENCODE_MODEL;
    const key = process.env.OPENCODE_API_KEY;
    if (!model || !/^opencode-go\/[a-zA-Z0-9._-]+$/.test(model) || !key)
      throw new Error("Configuration fournisseur manquante");
    const output = await runAgent(
      temporary("agent-explo-bin/opencode"),
      process.cwd(),
      agentEnvironment(home, model, key),
      event.comment.body,
    );
    answer = extractFinalAnswer(output);
  } finally {
    // Publish the failure too, including installation errors and the agent timeout.
    await publishAnswer(event, answer);
  }
}

export function extractQuestion(
  event: IssueCommentEvent,
  name: string,
): string | undefined {
  if (
    name !== "issue_comment" ||
    event.action !== "created" ||
    event.sender.type !== "User" ||
    event.comment.user.type !== "User" ||
    event.sender.id !== event.comment.user.id
  )
    return;
  return (
    event.comment.body
      .trimStart()
      .match(/^@Immersion-Facilitee\/agent-explo\s+([\s\S]*)$/)?.[1]
      .trim() || undefined
  );
}
export async function isActiveTeamMember(
  author: string,
  organization: string,
  team: string,
): Promise<boolean> {
  if (!team) return false;
  try {
    const member = await github<{ state: string }>(
      `/orgs/${encodeURIComponent(organization)}/teams/${encodeURIComponent(team)}/memberships/${encodeURIComponent(author)}`,
    );
    return member.state === "active";
  } catch (error) {
    if ((error as { status?: number }).status === 404) return false;
    throw error;
  }
}
export function formatConversation(description: string, comments: Comment[]) {
  const limit = 100_000;
  let text = `Description: ${description}`;
  if (text.length > limit - 100)
    text = `${text.slice(0, limit - 200)}\n[Description tronquée]`;
  let remaining = limit - text.length - 100;
  const selected: string[] = [];
  for (const c of [...comments].reverse()) {
    const entry = `\n${c.user.login} — ${c.created_at} — ${c.html_url}\n${c.body}`;
    if (entry.length > remaining) continue;
    selected.unshift(entry);
    remaining -= entry.length;
  }
  return `${text}\n[${comments.length - selected.length} échanges omis]\n${selected.join("")}`;
}
export async function collectContext(event: IssueCommentEvent) {
  const issue = await github<Issue>(`${root()}/issues/${event.issue.number}`);
  const comments = (
    await listGitHubPages<Comment>(
      `${root()}/issues/${event.issue.number}/comments`,
    )
  ).filter(
    (c) =>
      c.created_at <= event.comment.created_at &&
      c.id <= event.comment.id &&
      c.id !== event.comment.id,
  );
  comments.sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id,
  );
  return {
    repository: process.env.GITHUB_REPOSITORY,
    sha: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    request: {
      author: event.comment.user.login,
      date: event.comment.created_at,
      url: event.comment.html_url,
    },
    title: issue.title,
    url: issue.html_url,
    conversation: formatConversation(issue.body ?? "", comments),
    changes: issue.pull_request
      ? await collectPullRequestChanges(event.issue.number)
      : undefined,
    limits:
      "Branche par défaut uniquement. Les patches et les corps édités reflètent la collecte. Images accessibles par leurs URL avec webfetch. Commentaires de review non chargés.",
  };
}

async function collectPullRequestChanges(number: number) {
  const path = `${root()}/pulls/${number}`;
  const pr = await github<PullRequest>(path);
  let remaining = 100_000;
  const files = (await listGitHubPages<FileChange>(`${path}/files`)).map(
    (f) => {
      const patch = f.patch?.slice(0, remaining);
      remaining -= patch?.length ?? 0;
      return {
        file: f.filename,
        status: f.status,
        patch: patch || "[Patch indisponible]",
        truncated: patch?.length !== f.patch?.length,
      };
    },
  );
  return {
    base: pr.base.sha,
    head: pr.head.sha,
    repository: pr.head.repo?.full_name,
    files,
  };
}

// CI only: no local OpenCode configuration is changed or inherited.
export const readOnlyConfig = {
  autoupdate: false,
  share: "disabled",
  snapshot: false,
  plugin: [],
  mcp: {},
  lsp: false,
  formatter: false,
  enabled_providers: ["opencode-go"],
  permission: {
    "*": "deny",
    read: "allow",
    glob: "allow",
    grep: "allow",
    skill: "allow",
    webfetch: "allow",
    websearch: "allow",
    external_directory: "deny",
  },
  instructions: ["AGENTS.md"],
  default_agent: "explore-ci",
  agent: {
    "explore-ci": {
      mode: "primary",
      steps: 60,
      prompt: readFileSync(
        new URL("./agent-explo.prompt.md", import.meta.url),
        "utf8",
      ),
    },
  },
};
export const agentEnvironment = (
  home: string,
  model: string,
  key: string,
): NodeJS.ProcessEnv => ({
  PATH: process.env.PATH,
  HOME: home,
  XDG_CONFIG_HOME: join(home, "config"),
  XDG_DATA_HOME: join(home, "data"),
  XDG_CACHE_HOME: join(home, "cache"),
  OPENCODE_API_KEY: key,
  OPENCODE_PURE: "true",
  OPENCODE_DISABLE_PROJECT_CONFIG: "true",
  OPENCODE_DISABLE_AUTOUPDATE: "true",
  OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: "true",
  OPENCODE_CONFIG_CONTENT: JSON.stringify({
    ...readOnlyConfig,
    model,
    small_model: model,
  }),
});
export function extractFinalAnswer(output: string): string {
  const events: {
    type: string;
    part?: { reason?: string; messageID?: string; text?: string };
  }[] = output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const finish = events.findLast((e) => e.type === "step_finish");
  if (events.some((e) => e.type === "error") || finish?.part?.reason !== "stop")
    throw new Error("Réponse incomplète");
  const text = events
    .filter(
      (e) => e.type === "text" && e.part?.messageID === finish.part?.messageID,
    )
    .map((e) => e.part?.text)
    .join("\n")
    .trim();
  if (!text || text.length > 60_000) throw new Error("Réponse inutilisable");
  return text;
}
export async function runAgent(
  binary: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  comment: string,
  timeout = 600_000,
): Promise<string> {
  const pending = exec(
    binary,
    ["run", "--format", "json", "--agent", "explore-ci"],
    {
      cwd,
      env,
      timeout,
      killSignal: "SIGKILL",
      maxBuffer: 10_000_000,
    },
  );
  pending.child.stdin?.end(
    `${comment}\n\nContexte en appui : .agent-explo-context.json`,
  );
  const { stdout } = await pending;
  return stdout;
}
async function install() {
  const response = await fetch(
    "https://github.com/anomalyco/opencode/releases/download/v1.18.29/opencode-linux-x64.tar.gz",
    { signal: AbortSignal.timeout(120_000) },
  );
  if (!response.ok) throw new Error("Téléchargement OpenCode échoué");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (
    createHash("sha256").update(bytes).digest("hex") !==
    "ea800b7ff56226b70952126c9fc1e2517ca4c4b5682fd9d3f9e87449697a1194"
  )
    throw new Error("Checksum OpenCode incorrect");
  await mkdir(temporary("agent-explo-bin"), { recursive: true });
  await writeFile(temporary("opencode.tar.gz"), bytes);
  await exec("tar", [
    "-xzf",
    temporary("opencode.tar.gz"),
    "-C",
    temporary("agent-explo-bin"),
  ]);
}
export async function setReaction(
  event: IssueCommentEvent,
  content: "eyes" | "+1" | "confused",
) {
  const token = process.env.AGENT_WRITE_TOKEN;
  const path = `${root()}/issues/comments/${event.comment.id}/reactions`;
  for (const reaction of await listGitHubPages<{
    id: number;
    user: User;
    content: string;
  }>(path, token)) {
    if (
      reaction.user.login === process.env.AGENT_BOT_LOGIN &&
      ["eyes", "+1", "confused"].includes(reaction.content)
    )
      await github(`${path}/${reaction.id}`, "DELETE", undefined, token);
  }
  await github(path, "POST", { content }, token);
}
export async function publishAnswer(event: IssueCommentEvent, answer?: string) {
  const token = process.env.AGENT_WRITE_TOKEN;
  const marker = `<!-- agent-explo:issue_comment-${event.comment.id} -->`;
  const body = `${marker}\n${answer ?? "😕 L’exploration a échoué ou dépassé son délai. Vous pouvez relancer le workflow Agent explo."}`;
  try {
    const comments = `${root()}/issues/${event.issue.number}/comments`;
    const previous = (await listGitHubPages<Comment>(comments, token)).find(
      (c) =>
        c.user.login === process.env.AGENT_BOT_LOGIN &&
        c.body.startsWith(marker),
    );
    if (previous) {
      await github(
        `${root()}/issues/comments/${previous.id}`,
        "PATCH",
        { body },
        token,
      );
    } else {
      await github(comments, "POST", { body }, token);
    }
  } catch (error) {
    await setReaction(event, "confused");
    throw error;
  }
  await setReaction(event, answer ? "+1" : "confused");
}

export const github = async <T>(
  path: string,
  method = "GET",
  body?: object,
  token = process.env.GH_TOKEN,
): Promise<T> => {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: body && JSON.stringify(body),
  });
  if (!response.ok)
    throw Object.assign(new Error(`GitHub ${response.status}`), {
      status: response.status,
    });
  return (response.status === 204 ? undefined : await response.json()) as T;
};
export const listGitHubPages = async <T>(
  path: string,
  token = process.env.GH_TOKEN,
): Promise<T[]> => {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const batch = await github<T[]>(
      `${path}?per_page=100&page=${page}`,
      "GET",
      undefined,
      token,
    );
    items.push(...batch);
    if (batch.length < 100) return items;
  }
};

if (process.argv[1]?.endsWith("/agent-explo.ts")) {
  runWorkflowStep(process.argv[2]).catch(() => {
    // Provider exceptions can contain the prompt: keep them out of Actions logs.
    console.error("agent-explo : échec technique");
    process.exitCode = 1;
  });
}
