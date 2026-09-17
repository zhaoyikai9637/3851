import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = join(root, 'work');
const reportPath = join(root, 'docs', 'UNIT_TEST_REPORT.md');
const resultsPath = join(work, `jest-results-${Date.now()}.json`);
const coveragePath = join(work, 'jest-coverage', 'coverage-summary.json');
const jestBin = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
mkdirSync(work, { recursive: true });

const run = spawnSync(process.execPath, [
  '--experimental-vm-modules', jestBin,
  '--config', join(root, 'server', 'jest.config.cjs'),
  '--runInBand', '--coverage', '--json', '--outputFile', resultsPath
], { cwd: root, encoding: 'utf8' });

if (run.stdout) process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);

const results = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : null;
const passed = run.status === 0 && results?.success === true;
const coverage = passed && existsSync(coveragePath)
  ? JSON.parse(readFileSync(coveragePath, 'utf8')).total : null;
const version = JSON.parse(readFileSync(join(root, 'node_modules', 'jest', 'package.json'), 'utf8')).version;
const date = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Hong_Kong', dateStyle: 'full', timeStyle: 'medium'
}).format(new Date());
const testRows = (results?.testResults || []).flatMap(suite =>
  suite.assertionResults.map(test => {
    const name = test.fullName.replaceAll('|', '\\|').replaceAll('\n', ' ');
    return `| ${relative(root, suite.name).replaceAll('\\', '/')} | ${name} | ${test.status === 'passed' ? 'Pass' : 'Fail'} |`;
  })
);
const pct = metric => coverage?.[metric]?.pct == null ? 'Not available' : `${coverage[metric].pct}%`;
const lines = [
  '# Jest Unit Test Report',
  '',
  `- Executed: ${date} (Asia/Hong_Kong)`,
  `- Environment: Node ${process.version}; Jest ${version}`,
  '- Command: `npm.cmd run test:jest` (from the project root)',
  `- Result: ${passed ? 'PASS' : 'FAIL'}; suites: ${results?.numTotalTestSuites ?? 'unknown'}; tests: ${results?.numTotalTests ?? 'unknown'}; passed: ${results?.numPassedTests ?? 'unknown'}; failed: ${results?.numFailedTests ?? 'unknown'}.`,
  '',
  '## Scope',
  '',
  '- `server/src/validation.js`: email-template variables, profile fields, IDs, historical dates, and query filters.',
  '- `server/src/database-safety.js`: dedicated-database write restrictions and migration-target inspection, using an in-memory database double.',
  '- `server/src/mailer.js`: offline-preview default and explicit SMTP authorization; no SMTP connection is made.',
  '',
  '## Coverage (the three source files above only)',
  '',
  '| Metric | Coverage |',
  '|---|---:|',
  `| Statements | ${pct('statements')} |`,
  `| Branches | ${pct('branches')} |`,
  `| Functions | ${pct('functions')} |`,
  `| Lines | ${pct('lines')} |`,
  '',
  '## Test Cases',
  '',
  '| Test file | Test case | Result |',
  '|---|---|---|',
  ...testRows,
  '',
  '## Limitations',
  '',
  '- These Jest unit tests do not measure whole-project coverage or verify real MySQL queries, team sign-in, browser interactions, or email delivery.',
  '- The existing Vitest frontend/backend suites and dedicated MySQL integration suite remain separate. Run `npm.cmd test` and `npm.cmd run test:mysql` for those checks.',
  '- Unit tests use isolated inputs; they do not write to a database or send email to candidates.',
  ''
];
writeFileSync(reportPath, lines.join('\n'), 'utf8');
process.stdout.write(`Jest report saved: ${reportPath}\n`);
if (run.error) throw run.error;
process.exitCode = passed ? 0 : (run.status || 1);
