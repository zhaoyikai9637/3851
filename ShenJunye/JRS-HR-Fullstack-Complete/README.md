# JRS HR 完整版：前端 + Node.js 后端 + MySQL
版本 2.0.0 · 本轮 HR 页面对应的独立运行项目

这版把前面的 HR 前端接到了数据库，包含登录、HR 资料、候选人、申请审核、面试、结果、Offer、拒绝、通知中心、邮件模板、邮件发送记录、简历上传与跟进任务。

**这次请运行完整项目的 Node 服务，再在浏览器打开它。不要双击 dist/index.html，也不需要用 Live Server。**

## 1. Windows 第一次启动

你之前安装的 Node.js 24 与 MySQL Server 8.0 可以用于本项目。

1. 解压到一个新的目录，例如 `D:\JRS-HR-Fullstack-Complete`，在 VS Code 中打开这个目录。先保留旧前端目录，便于对照。
2. 在 VS Code 终端确认当前目录下有 `package.json`、`server`、`database` 和 `dist`。
3. 安装依赖、复制配置：

```powershell
npm install
Copy-Item .env.example .env
```

4. 用 VS Code 打开新生成的 `.env`，填写下面这些值：

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=jrs_hr_fullstack
DB_USER=root
DB_PASSWORD="你安装MySQL时设置的密码"

ADMIN_EMAIL=hr@jrs.local
ADMIN_NAME=Sarah Mitchell
ADMIN_PASSWORD="你自己设置的HR登录密码，至少12个字符"
```

`DB_PASSWORD` 是 MySQL 的密码；`ADMIN_PASSWORD` 是这个 HR 网页的登录密码。两者用途不同。包含空格或 # 的值要加双引号。不要把真实的 `.env` 发到 GitHub。

如果想测试普通 HR 权限，也可以填写 `STAFF_EMAIL`、`STAFF_NAME`、`STAFF_PASSWORD`。普通 HR 可以处理申请，但不能批准 Offer 或管理模板。

5. 确认 MySQL80 服务正在运行，然后依次执行：

```powershell
npm run db:init
npm run db:seed
npm start
```

6. 浏览器打开 **http://localhost:3000**，使用你填写的 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 登录。

`db:init` 创建数据库、表、账号和模板；`db:seed` 插入演示用的 115 条申请。它不会覆盖已有业务数据，数据库已有候选人、职位或申请时会拒绝再次插入。想从空数据开始，可以省略 `db:seed`，登录后先新建职位，再点击 Receive Application。

之后再次启动，只需要：

```powershell
npm start
```

终端关闭或按 Ctrl+C 后服务停止。开发时可使用 `npm run dev`，修改后端代码会自动重启。

## 2. 可以操作的功能

| 页面/模块 | 已实现的流程 |
|---|---|
| 登录与账号 | 密码哈希、数据库会话、注销、修改密码、会话过期 |
| My Profile | 读取真实登录账号，编辑电话和办公地点；官方账号字段受保护 |
| Dashboard / Applications | 从数据库计算数量、筛选、搜索、队列与 CSV 导出 |
| Receive Application | 新候选人或已有候选人申请职位；防止重复申请 |
| Candidates / Resume Review | 联系资料编辑、内部备注、真实 PDF 上传/预览/下载 |
| Pending Review | 审核后转 Interview；拒绝必须填写原因 |
| Interviews | 排期、改期、取消、冲突校验、新加坡时间日历导出 |
| Interview Results | 面试结束后填写评分、建议和反馈，转结果队列 |
| Offers | 薪资与日期验证、经理审批、邮件草稿、记录接受并转 Hired |
| Rejections | 原因确认、取消相关预约、生成候选人通知草稿 |
| Tasks | 创建跟进任务、到期日校验、记录完成；不可重复完成 |
| Notification Center | 新申请/状态变更、类型/日期/已读筛选、各 HR 独立已读状态、跳转来源申请 |
| Email Templates | 五种模板、变量预览、经理创建/编辑/归档 |
| Email Outbox | 查看/编辑草稿、发送、区分已发送/失效/无法确认状态 |
| Notification Log | 成功提交 SMTP 后的收件人、职位、事件、模板、正文与附件快照 |
| Reports / Audit | 招聘统计、CSV 导出、真实操作者及状态变更记录 |

招聘流程：`Pending Review → Interview → Interview Results → Offer → Hired`。录用之前的阶段可以按规则进入 Rejected；不能直接随意修改状态绕过审批。

演示数据库初始数量保持原页面设计：Pending Review 42、Interview Results 24、Offer 18、Rejected 31。没有预设未来预约；24 场面试是已完成的历史样例。

示例候选人的简历是演示内容，会标注 Sample resume。新创建的候选人不会自动获得编造的简历，需上传实际 PDF。最大 5 MB；PDF 二进制保存到 MySQL，所以完整数据库备份会包含简历。

## 3. 发送真实邮件

不配置邮箱也能使用招聘流程，邮件会保持 Draft。真正发送需要在 `.env` 填写自己的 SMTP 服务配置：

```dotenv
MAIL_ENABLED=true
SMTP_HOST=你的SMTP服务器
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=你的SMTP用户名
SMTP_PASSWORD="邮箱服务提供的SMTP密码或应用密码"
MAIL_FROM=你的发件邮箱
```

使用隐式 TLS 的 465 端口时，设置 `SMTP_PORT=465`、`SMTP_SECURE=true`。587 默认要求 STARTTLS。配置后重启服务。

先创建一条邮箱为你自己可接收地址的测试候选人记录，再在应用里准备草稿 → Email Outbox → Review/Send。系统会拒绝向演示数据的 example.com 邮箱发送。

发送时可以勾选附上候选人已上传的简历。没有配置 SMTP 时不会伪造“发送成功”，也不会写入成功日志。Sent 表示 SMTP 服务器接受了邮件，不表示已进入收件箱或已被阅读。超时等无法判断结果的情况显示 Uncertain，不自动重发，先在邮箱服务商处核对。

## 4. 测试

普通测试不需要 MySQL 服务或真实邮箱：

```powershell
npm test
```

也可以使用 Jest：

```powershell
npm run test:jest
```

测试入口兼容两种 runner，避免原来“Node 测试通过但 Jest 认为 0 个测试”的问题。`npm test` 的路径已显式列出，避免 Windows 终端通配符差异。

配置好 `.env` 和 MySQL 后，再运行真实数据库联调：

```powershell
npm run test:integration
```

联调测试创建一个随机命名的 `jrs_hr_it_..._test` 数据库，用真实 SQL 检查建表、保存与重载、回滚、排期并发、重复请求、邮件日志及附件。结束后只删除该测试新建的临时数据库。数据库账号需要创建/删除测试数据库的权限。邮件 transport 是测试替身，不会给任何人发邮件。

本次交付的验证范围与结果见 `docs/TESTING.md`。普通测试和 HTTP 测试不能代替真实 MySQL 联调。

## 5. 在 MySQL Workbench 查看数据

登录 MySQL Workbench，刷新 SCHEMAS，展开 `jrs_hr_fullstack → Tables`，右键表选择 Select Rows。

例如：

```sql
USE jrs_hr_fullstack;
SELECT stage, COUNT(*) AS total
FROM hr_application
GROUP BY stage;

SELECT interview_date, interview_time, interviewer, status
FROM hr_interview;

SELECT summary, actor, at_time
FROM hr_audit_log
ORDER BY at_time DESC;
```

通常不用手动导入 SQL，`npm run db:init` 已完成建表。如果老师需要看 SQL 源码，查看 `database/schema.sql`；手动使用 Workbench 时先执行 `create-database.sql`，选中该库后再执行 `schema.sql`，最后仍需运行 `db:init` 创建带密码哈希的登录账号。

## 6. 备份与文件结构

`Workspace data → Export HR records (JSON)` 只导出可查看的业务数据，不是完整数据库备份，不包含密码和 PDF 二进制。

完整 SQL 备份：

```powershell
npm run db:backup
```

需要 MySQL 自带的 `mysqldump`。如果没有加入 PATH，可在 `.env` 增加：

```dotenv
MYSQLDUMP_PATH="C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe"
```

SQL 文件保存到项目的 `backups` 目录。恢复时可使用 Workbench 的 Data Import 导入到新建的空数据库，再将 `DB_NAME` 改为该库。备份含招聘资料和账号信息，请像数据库文件一样保管。

| 目录/文件 | 职责 |
|---|---|
| dist/ | 已连接 API 的完整前端，保持前面的界面样式 |
| dist/state.js | 前后端共用的纯业务规则；生产写入以服务端为准 |
| server/app.cjs | Express 路由、请求校验、安全边界、静态文件服务 |
| server/auth.cjs | 登录、会话、密码与身份校验 |
| server/service.cjs | HR 业务命令、角色校验、请求去重 |
| server/repository.cjs | MySQL 查询、事务和实体映射 |
| server/mail.cjs | SMTP 发送与成功记录 |
| server/recovery.cjs | 中断发送的状态恢复；不自动重发 |
| database/schema.sql | MySQL 表、主键、外键、索引和约束 |
| scripts/ | 初始化、示例数据和备份 |
| tests/ | 规则、HTTP、邮件边界及真实 MySQL 联调测试 |
| docs/API.md | 接口字段与小组集成方式 |
| docs/DATABASE.md | 表关系与一致性设计 |
| .env.example | 配置模板；没有任何真实密码 |

## 7. 常见启动问题

| 提示 | 处理 |
|---|---|
| Access denied for user | 检查 DB_USER 与 DB_PASSWORD；先确认 Workbench 可以用同一账号登录 |
| ECONNREFUSED / Startup failed | 检查 MySQL80 已启动，DB_HOST 与 DB_PORT 正确 |
| Table ... doesn't exist | 先运行 npm run db:init |
| Unknown database | 先运行 db:init，确认账号可创建 DB_NAME 指定的数据库 |
| 已有数据，拒绝 seed | 正常保护；直接 npm start，不要为了运行而删原数据 |
| 登录失败 | 使用 .env 中首次初始化时的 ADMIN_EMAIL / ADMIN_PASSWORD；重复 init 不会重置密码 |
| This request origin is not allowed | 打开 APP_ORIGIN 指定的地址；默认是 localhost:3000，别混用不同地址 |
| Another user changed this workspace | 刷新并核对最新内容后再操作，系统会阻止覆盖别人的修改 |
| 3000 端口被占用 | 同时修改 PORT 与 APP_ORIGIN，例如 3001 与 http://localhost:3001 |
| npm.ps1 cannot be loaded | 在 VS Code 中改用 Command Prompt，或用 npm.cmd 运行相同命令 |
| 网页提示需要后端 | 使用 npm start 后访问 localhost 地址，不要双击 HTML |

## 8. 本轮边界

本包按这次已有 HR 页面与流程完成，包含其独立运行所需的候选人、职位和账号表。未实现 Employee、Finance 等小组其他模块，也尚未接入你们未提供的统一登录、旧 SQL 或线上后端。

当前没有原始 `jrs_hr_system.sql` 可供逐字段核对，因此这里提供的是独立数据库结构；小组使用统一 ERD 时按 `docs/API.md` 对齐。原前端浏览器里的本地演示数据不会自动导入数据库。

此包运行于你的 Node.js 与 MySQL 环境。之前的静态预览链接没有更新为这套后端；仅上传 dist 到静态主机不能提供数据库服务。本次交付以完整源码包为准。
