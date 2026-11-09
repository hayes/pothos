import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const variants = {
  direct: '../src/subscription-iterator.ts',
  'direct-refined': './subscription-iterator.direct.ts',
  generator: './subscription-iterator.generator.ts',
  'sync-generator': './subscription-iterator.sync-generator.ts',
  'stream-generator': './subscription-iterator.stream-generator.ts',
};
const output = mkdtempSync(join(tmpdir(), 'pothos-iterator-comparison-'));
const results = [];

interface Assertion {
  fullName: string;
  status: string;
  failureMessages: string[];
}

for (const [variant, implementation] of Object.entries(variants)) {
  const reportFile = join(output, `${variant}.json`);
  const run = spawnSync(
    'pnpm',
    [
      'exec',
      'vitest',
      'run',
      '--config',
      join(directory, 'vitest.config.mts'),
      '--reporter=json',
      '--outputFile',
      reportFile,
    ],
    {
      cwd: root,
      env: { ...process.env, POTHOS_ITERATOR_VARIANT: variant },
      encoding: 'utf8',
      timeout: 120_000,
    },
  );
  if (run.error || run.signal || (run.status !== 0 && run.status !== 1)) {
    throw new Error(`Could not run ${variant}: ${run.error ?? run.stderr}`);
  }
  const report = JSON.parse(readFileSync(reportFile, 'utf8')) as {
    numPassedTests: number;
    numFailedTests: number;
    numPendingTests: number;
    testResults: { assertionResults: Assertion[] }[];
  };
  const failures = report.testResults.flatMap((suite) =>
    suite.assertionResults
      .filter((test) => test.status === 'failed')
      .map((test) => ({
        name: test.fullName,
        message: test.failureMessages[0]?.slice(0, 1_000),
      })),
  );
  const result = {
    variant,
    implementation,
    lines: readFileSync(new URL(implementation, import.meta.url), 'utf8')
      .trimEnd()
      .split('\n').length,
    sha256: createHash('sha256')
      .update(readFileSync(new URL(implementation, import.meta.url)))
      .digest('hex'),
    passed: report.numPassedTests,
    failed: report.numFailedTests,
    skipped: report.numPendingTests,
    failures,
  };
  results.push(result);
  process.stdout.write(
    `${variant}: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped; ${result.lines} lines\n`,
  );
}

const destination = join(
  directory,
  process.env.POTHOS_ITERATOR_GRAPHQL ? 'results.graphql16.json' : 'results.json',
);
const graphqlPackage = process.env.POTHOS_ITERATOR_GRAPHQL
  ? join(dirname(process.env.POTHOS_ITERATOR_GRAPHQL), 'package.json')
  : join(root, 'node_modules/graphql/package.json');
const graphql = JSON.parse(readFileSync(graphqlPackage, 'utf8')) as { version: string };
writeFileSync(
  destination,
  `${JSON.stringify({ node: process.version, graphql: graphql.version, results }, null, 2)}\n`,
);
process.stdout.write(`Detailed results: ${destination}\nRaw reports: ${output}\n`);
