# Jest 单元测试报告

- 执行时间：2026年9月13日星期日 17:04:51（Asia/Hong_Kong）
- 运行环境：Node v24.16.0；Jest 30.5.1
- 命令：`npm.cmd run test:jest`（在项目根目录运行）
- 结果：通过；测试文件 2 个，测试用例 46 项；通过 46，失败 0。

## 测试范围

- `server/src/validation.js`：邮件模板变量、资料字段、ID、历史日期和筛选参数。
- `server/src/database-safety.js`：专用库写入限制、迁移目标预检；数据库对象为内存替身。
- `server/src/mailer.js`：默认离线预览和 SMTP 显式许可限制；未连接 SMTP。

## 覆盖率（仅上述三个源文件）

| 指标 | 覆盖率 |
|---|---:|
| 语句 | 92.39% |
| 分支 | 86.15% |
| 函数 | 90.9% |
| 行 | 92.39% |

## 用例明细

| 测试文件 | 用例 | 结果 |
|---|---|---|
| server/jest-tests/validation.test.js | email template validation renders the four approved placeholders as plain text without recursive substitution | 通过 |
| server/jest-tests/validation.test.js | email template validation rejects unsupported or missing placeholder [Unknown] | 通过 |
| server/jest-tests/validation.test.js | email template validation rejects unsupported or missing placeholder [CandidateName] | 通过 |
| server/jest-tests/validation.test.js | email template validation trims allowed template fields | 通过 |
| server/jest-tests/validation.test.js | email template validation rejects invalid or extra template input 0 | 通过 |
| server/jest-tests/validation.test.js | email template validation rejects invalid or extra template input 1 | 通过 |
| server/jest-tests/validation.test.js | email template validation rejects invalid or extra template input 2 | 通过 |
| server/jest-tests/validation.test.js | email template validation rejects invalid or extra template input 3 | 通过 |
| server/jest-tests/validation.test.js | email template validation rejects invalid or extra template input 4 | 通过 |
| server/jest-tests/validation.test.js | profile and identifier validation normalizes only editable profile fields | 通过 |
| server/jest-tests/validation.test.js | profile and identifier validation rejects protected profile field email | 通过 |
| server/jest-tests/validation.test.js | profile and identifier validation rejects protected profile field employeeId | 通过 |
| server/jest-tests/validation.test.js | profile and identifier validation rejects protected profile field role | 通过 |
| server/jest-tests/validation.test.js | profile and identifier validation rejects protected profile field accountStatus | 通过 |
| server/jest-tests/validation.test.js | profile and identifier validation rejects protected profile field profilePhotoUrl | 通过 |
| server/jest-tests/validation.test.js | profile and identifier validation rejects protected profile field userId | 通过 |
| server/jest-tests/validation.test.js | profile and identifier validation rejects invalid ID 0 | 通过 |
| server/jest-tests/validation.test.js | profile and identifier validation rejects invalid ID -1 | 通过 |
| server/jest-tests/validation.test.js | profile and identifier validation rejects invalid ID 1.5 | 通过 |
| server/jest-tests/validation.test.js | profile and identifier validation rejects invalid ID 2147483648 | 通过 |
| server/jest-tests/validation.test.js | profile and identifier validation rejects invalid ID not-a-number | 通过 |
| server/jest-tests/validation.test.js | historical date filters uses the UTC+08 calendar-day boundary | 通过 |
| server/jest-tests/validation.test.js | historical date filters supplies bounded notification pagination defaults | 通过 |
| server/jest-tests/validation.test.js | historical date filters rejects malformed notification filters 0 | 通过 |
| server/jest-tests/validation.test.js | historical date filters rejects malformed notification filters 1 | 通过 |
| server/jest-tests/validation.test.js | historical date filters rejects malformed notification filters 2 | 通过 |
| server/jest-tests/validation.test.js | historical date filters rejects malformed notification filters 3 | 通过 |
| server/jest-tests/validation.test.js | historical date filters rejects malformed notification filters 4 | 通过 |
| server/jest-tests/validation.test.js | historical date filters rejects malformed notification filters 5 | 通过 |
| server/jest-tests/validation.test.js | historical date filters rejects malformed notification filters 6 | 通过 |
| server/jest-tests/validation.test.js | historical date filters accepts only SENT as a log status filter | 通过 |
| server/jest-tests/validation.test.js | historical date filters rejects future dates on the log path too | 通过 |
| server/jest-tests/safety.test.js | database write safeguards accepts an explicitly confirmed dedicated test database | 通过 |
| server/jest-tests/safety.test.js | database write safeguards rejects unsafe database configuration 0 | 通过 |
| server/jest-tests/safety.test.js | database write safeguards rejects unsafe database configuration 1 | 通过 |
| server/jest-tests/safety.test.js | database write safeguards rejects unsafe database configuration 2 | 通过 |
| server/jest-tests/safety.test.js | database write safeguards rejects unsafe database configuration 3 | 通过 |
| server/jest-tests/safety.test.js | database write safeguards rejects unsafe database configuration 4 | 通过 |
| server/jest-tests/safety.test.js | database write safeguards rejects unsafe database configuration 5 | 通过 |
| server/jest-tests/safety.test.js | database write safeguards rejects unsafe database configuration 6 | 通过 |
| server/jest-tests/safety.test.js | database write safeguards normalizes table names from driver-returned shapes | 通过 |
| server/jest-tests/safety.test.js | database write safeguards rejects unrelated tables before any migration query | 通过 |
| server/jest-tests/safety.test.js | database write safeguards refuses existing module tables without migration history | 通过 |
| server/jest-tests/safety.test.js | database write safeguards accepts a complete recognized migration state | 通过 |
| server/jest-tests/safety.test.js | mailer safety defaults uses offline preview with no mail credentials | 通过 |
| server/jest-tests/safety.test.js | mailer safety defaults requires an explicit SMTP allow flag | 通过 |

## 解释与边界

- 这是 Jest 单元测试，不等于整个项目的覆盖率，也不验证真实 MySQL SQL、团队登录、浏览器交互或邮件送达。
- 原有 Vitest 前后端测试与专用 MySQL 集成测试保留；需分别运行 `npm.cmd test` 和 `npm.cmd run test:mysql`。
- 测试只使用虚构输入；没有写入数据库或向候选人发送邮件。
