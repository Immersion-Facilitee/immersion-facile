import { appendFileSync } from "node:fs";
import { relative } from "node:path";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
} from "@playwright/test/reporter";

type FileDurationSummary = {
  durationMs: number;
  file: string;
  retries: number;
  tests: number;
};

const formatDuration = (durationMs: number): string => {
  const durationSeconds = durationMs / 1_000;
  if (durationSeconds < 60) return `${durationSeconds.toFixed(1)} s`;

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes} min ${seconds.toFixed(1)} s`;
};

const formatAverageDuration = (durationMs: number, tests: number): string =>
  tests === 0 ? "n/a" : formatDuration(durationMs / tests);

const makeFileDurationSummaries = (
  tests: TestCase[],
  rootDir: string,
): FileDurationSummary[] =>
  Object.values(
    tests.reduce<Record<string, FileDurationSummary>>((summaries, test) => {
      const file = relative(rootDir, test.location.file);
      const currentSummary = summaries[file] ?? {
        durationMs: 0,
        file,
        retries: 0,
        tests: 0,
      };

      return {
        ...summaries,
        [file]: {
          ...currentSummary,
          durationMs:
            currentSummary.durationMs +
            test.results.reduce(
              (durationMs, result) => durationMs + result.duration,
              0,
            ),
          retries:
            currentSummary.retries +
            test.results.filter(({ retry }) => retry > 0).length,
          tests: currentSummary.tests + 1,
        },
      };
    }, {}),
  ).sort((left, right) => right.durationMs - left.durationMs);

const escapeMarkdownTableCell = (value: string): string =>
  value.replaceAll("|", "\\|");

const makeMarkdownSummary = (
  fileSummaries: FileDurationSummary[],
  wallTimeMs: number,
): string => {
  const totals = fileSummaries.reduce(
    (acc, summary) => ({
      durationMs: acc.durationMs + summary.durationMs,
      retries: acc.retries + summary.retries,
      tests: acc.tests + summary.tests,
    }),
    { durationMs: 0, retries: 0, tests: 0 },
  );

  const rows = fileSummaries.map(
    ({ durationMs, file, retries, tests }) =>
      `| ${escapeMarkdownTableCell(file)} | ${tests} | ${retries} | ${formatDuration(durationMs)} | ${formatAverageDuration(durationMs, tests)} |`,
  );

  return [
    "## Playwright duration summary",
    "",
    `- Wall time: ${formatDuration(wallTimeMs)}`,
    `- Worker time: ${formatDuration(totals.durationMs)}`,
    "",
    "| File | Tests | Retries | Worker time | Average per test |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...rows,
    `| **Total** | **${totals.tests}** | **${totals.retries}** | **${formatDuration(totals.durationMs)}** | **${formatAverageDuration(totals.durationMs, totals.tests)}** |`,
    "",
    "> Worker time is the sum of all test attempts and can exceed wall time when tests run in parallel.",
  ].join("\n");
};

export default class DurationReporter implements Reporter {
  private rootDir = process.cwd();
  private tests: TestCase[] = [];

  onBegin = (config: FullConfig, suite: Suite): void => {
    this.rootDir = config.rootDir;
    this.tests = suite.allTests();
  };

  onEnd = (result: FullResult): void => {
    const markdownSummary = makeMarkdownSummary(
      makeFileDurationSummaries(this.tests, this.rootDir),
      result.duration,
    );
    console.log(`\n${markdownSummary}`);

    const githubStepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!githubStepSummaryPath) return;

    try {
      appendFileSync(githubStepSummaryPath, `${markdownSummary}\n`, "utf8");
    } catch (error) {
      console.error(
        `Could not write Playwright duration summary: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  printsToStdio = (): boolean => true;
}
