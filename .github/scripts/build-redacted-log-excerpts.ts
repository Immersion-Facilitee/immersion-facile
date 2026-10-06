import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

type Finding = { File: string; StartLine: number; Secret: string };
type Job = { id: number; name: string };
type LineWindow = { start: number; end: number };

const linesBeforeFinding = 30;
const linesAfterFinding = 10;
const maxLineLength = 300;
const maxMessageLength = 3500;
const maxMessages = 10;
const redacted = "REDACTED";

const secretVariants = (secret: string): string[] => [
  secret,
  encodeURIComponent(secret),
];

const redact = (text: string, secrets: string[]): string =>
  secrets.reduce((result, secret) => result.replaceAll(secret, redacted), text);

const escapeForSlack = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("```", "'''");

const mergeWindows = (lineNumbers: number[], lineCount: number): LineWindow[] =>
  [...lineNumbers]
    .sort((a, b) => a - b)
    .reduce<LineWindow[]>((windows, lineNumber) => {
      const start = Math.max(1, lineNumber - linesBeforeFinding);
      const end = Math.min(lineCount, lineNumber + linesAfterFinding);
      const previous = windows.at(-1);
      if (previous && start <= previous.end + 1) {
        previous.end = Math.max(previous.end, end);
        return windows;
      }
      return [...windows, { start, end }];
    }, []);

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
    .slice(0, maxMessages);

const buildExcerpts = (
  logsDirectory: string,
  findings: Finding[],
  jobs: Job[],
): string => {
  const secrets = [
    ...new Set(
      findings
        .filter(({ Secret }) => Secret !== "")
        .flatMap(({ Secret }) => secretVariants(Secret)),
    ),
  ].sort((a, b) => b.length - a.length);

  const lineNumbersByLogFile = Map.groupBy(findings, ({ File }) =>
    basename(File),
  );

  const excerpts = [...lineNumbersByLogFile.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([logFile, logFileFindings]) => {
      const jobName =
        jobs.find(({ id }) => `${id}.log` === logFile)?.name ?? logFile;
      const lines = readFileSync(join(logsDirectory, logFile), "utf-8").split(
        "\n",
      );
      return mergeWindows(
        logFileFindings.map(({ StartLine }) => StartLine),
        lines.length,
      ).map(({ start, end }) =>
        [
          `${jobName}, lignes ${start} à ${end}`,
          ...lines
            .slice(start - 1, end)
            .map((line) => redact(line, secrets).slice(0, maxLineLength)),
        ].join("\n"),
      );
    });

  const output = excerpts.join("\n\n");
  if (secrets.some((secret) => output.includes(secret)))
    throw new Error("A detected secret is still present in the excerpts");
  return escapeForSlack(output);
};

const [logsDirectory, findingsPath, jobsPath, outputPath] =
  process.argv.slice(2);
const findings: Finding[] = JSON.parse(readFileSync(findingsPath, "utf-8"));
const jobs: Job[] = JSON.parse(readFileSync(jobsPath, "utf-8"));

writeFileSync(
  outputPath,
  JSON.stringify(
    splitIntoMessages(buildExcerpts(logsDirectory, findings, jobs)),
  ),
);
