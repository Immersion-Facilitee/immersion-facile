import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

type Finding = {
  RuleID: string;
  File: string;
  StartLine: number;
  Match: string;
  Secret: string;
};
type Job = { id: number; name: string };
type LineWindow = { start: number; end: number };

const linesBeforeFinding = 30;
const linesAfterFinding = 10;
const maxLineLength = 300;
const maxMessageLength = 3500;
const maxExcerptMessages = 10;
const redacted = "REDACTED";
const ifDevsMention = "<!subteam^S089GE2GKEH|@if-devs>";

const [logsDirectory, jobsPath, findingsPath, messagesPath] =
  process.argv.slice(2);
const workflowName = process.env.WORKFLOW_NAME ?? "";
const runUrl = process.env.RUN_URL ?? "";
const scanUrl = process.env.SCAN_URL ?? "";
const logsDeleted = process.env.LOGS_DELETION_OUTCOME === "success";

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, "utf-8"));
const jobs = readJson<Job[]>(jobsPath);
const findings = readJson<Finding[]>(findingsPath);

const secrets = [
  ...new Set(
    findings.flatMap(({ Secret }) =>
      Secret ? [Secret, encodeURIComponent(Secret)] : [],
    ),
  ),
].sort((a, b) => b.length - a.length);

const redact = (text: string): string =>
  secrets.reduce((result, secret) => result.replaceAll(secret, redacted), text);

const escapeForSlack = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("```", "'''");

const jobName = (logFile: string): string =>
  jobs.find(({ id }) => `${id}.log` === logFile)?.name ?? logFile;

const describeFinding = ({ RuleID, File, StartLine, Match }: Finding) => {
  const variable = redact(Match).match(
    /\b([A-Z][A-Z0-9_]+)['"]?(?:=| has been set to )/,
  )?.[1];
  return [
    `- règle ${RuleID}`,
    `job ${jobName(basename(File))}`,
    `ligne ${StartLine}`,
    ...(variable ? [`variable ${variable}`] : []),
  ].join(", ");
};

const mergeWindows = (lineNumbers: number[], lineCount: number): LineWindow[] =>
  lineNumbers
    .toSorted((a, b) => a - b)
    .reduce<LineWindow[]>((windows, lineNumber) => {
      const start = Math.max(1, lineNumber - linesBeforeFinding);
      const end = Math.min(lineCount, lineNumber + linesAfterFinding);
      const previous = windows.at(-1);
      return previous && start <= previous.end + 1
        ? [...windows.slice(0, -1), { ...previous, end }]
        : [...windows, { start, end }];
    }, []);

const excerptsOf = (logFile: string, logFileFindings: Finding[]): string[] => {
  const lines = readFileSync(join(logsDirectory, logFile), "utf-8").split("\n");
  return mergeWindows(
    logFileFindings.map(({ StartLine }) => StartLine),
    lines.length,
  ).map(({ start, end }) =>
    [
      `${jobName(logFile)}, lignes ${start} à ${end}`,
      ...lines
        .slice(start - 1, end)
        .map((line) => redact(line).slice(0, maxLineLength)),
    ].join("\n"),
  );
};

const splitIntoMessages = (text: string): string[] =>
  text
    .split("\n")
    .reduce<string[]>(
      (messages, line) => {
        const current = messages.at(-1) ?? "";
        return current.length + line.length + 1 > maxMessageLength
          ? [...messages, `${line}\n`]
          : [...messages.slice(0, -1), `${current}${line}\n`];
      },
      [""],
    )
    .slice(0, maxExcerptMessages);

const summary = findings.map(describeFinding).join("\n");
const excerpts = [
  ...Map.groupBy(findings, ({ File }) => basename(File)).entries(),
]
  .flatMap(([logFile, logFileFindings]) => excerptsOf(logFile, logFileFindings))
  .join("\n\n");

if (secrets.some((secret) => `${summary}\n${excerpts}`.includes(secret)))
  throw new Error("A detected secret is still present in the report");

const alert = `🚨 ${ifDevsMention} Secret potentiel dans les logs de <${runUrl}|${escapeForSlack(workflowName).replaceAll("|", "¦")}>, détails dans le fil`;

const details = [
  `${findings.length} secret(s) potentiel(s) :`,
  escapeForSlack(summary),
  logsDeleted
    ? "Les logs du run ont été supprimés. Changer les secrets concernés."
    : "⚠️ La suppression automatique des logs a échoué : les supprimer à la main, puis changer les secrets concernés.",
  `<${scanUrl}|Voir le scan> · <${runUrl}|Voir le run concerné>`,
  `Extrait des logs ci-dessous, secrets remplacés par ${redacted}.`,
].join("\n");

const excerptMessages = splitIntoMessages(escapeForSlack(excerpts)).map(
  (message) => `\`\`\`\n${message}\`\`\``,
);

console.log(summary);
writeFileSync(
  messagesPath,
  JSON.stringify([alert, details, ...excerptMessages]),
);
