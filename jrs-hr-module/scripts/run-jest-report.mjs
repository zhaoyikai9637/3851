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
const date = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Hong_Kong', dateStyle: 'full', timeStyle: 'medium'
}).format(new Date());
const testRows = (results?.testResults || []).flatMap(suite =>
  suite.assertionResults.map(test => {
    const name = test.fullName.replaceAll('|', '\\|').replaceAll('\n', ' ');
    return `| ${relative(root, suite.name).replaceAll('\\', '/')} | ${name} | ${test.status === 'passed' ? '通过' : '失败'} |`;
  })
);
const pct = metric => coverage?.[metric]?.pct == null ? '未生成' : `${coverage[metric].pct}%`;
const lines = [
  '# Jest 单元测试报告',
  '',
  `- 执行时间：${date}（Asia/Hong_Kong）`,
  `- 运行环境：Node ${process.version}；Jest ${version}`,
  '- 命令：`npm.cmd run test:jest`（在项目根目录运行）',
  `- 结果：${passed ? '通过' : '失败'}；测试文件 ${results?.numTotalTestSuites ?? '未知'} 个，测试用例 ${results?.numTotalTests ?? '未知'} 项；通过 ${results?.numPassedTests ?? '未知'}，失败 ${results?.numFailedTests ?? '未知'}。`,
  '',
  '## 测试范围',
  '',
  '- `server/src/validation.js`：邮件模板变量、资料字段、ID、历史日期和筛选参数。',
  '- `server/src/database-safety.js`：专用库写入限制、迁移目标预检；数据库对象为内存替身。',
  '- `server/src/mailer.js`：默认离线预览和 SMTP 显式许可限制；未连接 SMTP。',
  '',
  '## 覆盖率（仅上述三个源文件）',
  '',
  '| 指标 | 覆盖率 |',
  '|---|---:|',
  `| 语句 | ${pct('statements')} |`,
  `| 分支 | ${pct('branches')} |`,
  `| 函数 | ${pct('functions')} |`,
  `| 行 | ${pct('lines')} |`,
  '',
  '## 用例明细',
  '',
  '| 测试文件 | 用例 | 结果 |',
  '|---|---|---|',
  ...testRows,
  '',
  '## 解释与边界',
  '',
  '- 这是 Jest 单元测试，不等于整个项目的覆盖率，也不验证真实 MySQL SQL、团队登录、浏览器交互或邮件送达。',
  '- 原有 Vitest 前后端测试与专用 MySQL 集成测试保留；需分别运行 `npm.cmd test` 和 `npm.cmd run test:mysql`。',
  '- 测试只使用虚构输入；没有写入数据库或向候选人发送邮件。',
  ''
];
writeFileSync(reportPath, lines.join('\n'), 'utf8');
process.stdout.write(`Jest report saved: ${reportPath}\n`);
if (run.error) throw run.error;
process.exitCode = passed ? 0 : (run.status || 1);
