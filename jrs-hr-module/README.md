# JRS HR module

原有 JavaScript + React + Vite + Bootstrap、Express + Sequelize + MySQL 工程。
已实现通知、模板、发送日志、头像菜单、资料编辑和退出。用户明确登录由组员负责，
本模块账号密码登录已移除；组员尚未实现，当前保留安全的身份接入边界。界面为英文，沟通/操作说明为中文。

## 现在启动

本机两个专用数据库已获准新建、迁移和写入虚构种子，环境文件已经配置。
无需重新解压、重新建库或导入旧 SQL。Node 24.16.0 / npm 11.13.0 / MySQL 26.7.0。

```powershell
Set-Location 'E:\textProject\jrs-hr-module'
npm.cmd run dev
```

浏览器打开 http://localhost:5173 。使用这个完整地址，保持与 APP_ORIGIN 一致。
API 在 http://127.0.0.1:3001，Swagger 建议打开 http://localhost:5173/api/docs/，保持交互请求同源。
当前页面会提示团队登录尚未接入，不再输入演示账号密码，也不会自动登录。
组员完成后配置 TEAM_LOGIN_URL 和 TEAM_AUTH_ADAPTER，接入说明见 docs/TEAM_AUTH.md。

## 验证命令

```powershell
npm.cmd test
npm.cmd run test:jest
npm.cmd run test:mysql
npm.cmd run build
npm.cmd run docs:check
npm.cmd run docs:export
```

原有 Vitest：后端 161 项 + 前端 46 项；新增 Jest：2 文件/46 项，运行后自动更新
`docs/UNIT_TEST_REPORT.md`；MySQL 独立套件 12 项。Jest 只测指定后端单元，不能代替
现有 Vitest、API 或 MySQL 测试。真实 Edge 浏览器使用测试进程提供的
可信上游身份夹具（不代表团队已联调），覆盖入口/退出跳转、通知持久化、模板增删改、日志快照、资料/头像保存、服务重启会话和退出。
检查 390/768/1024/1440px，截图及测试日志在 work/browser-check。
完整真实结果、失败记录和未测部分见 docs/VERIFICATION.md。

browser-check.mjs 使用本机 Codex 随附 Playwright（通过 NODE_PATH 指向其模块目录）
和已安装 Edge，读取 .env.test 并在临时本地端口启动真实 API；不 mock 请求，不发邮件。
这项工具依赖单独记录在 VERIFICATION，未把浏览器运行时硬编码进生产应用。

## 安装及构建服务

换机器先核对专用数据库，再本地配置环境文件；不要复制真实凭据到源码仓库。
依赖使用 npm.cmd ci --cache ./work/npm-cache --no-audit --no-fund 安装。
源码开发使用 npm run dev。构建后 npm start 可提供 client/dist 和 API；如果直接用
http://127.0.0.1:3001 作为网页地址，须在本地将 APP_ORIGIN 设为同一来源并重启。
开发模式默认 APP_ORIGIN 是 http://localhost:5173，不要混用。

常见排错：

- PowerShell 阻止 npm.ps1：使用本文的 npm.cmd 命令。
- 端口占用：关闭自己之前启动的服务；Vite 不自动切换端口，以免 CSRF 来源失配。
- 写操作 403 Untrusted request origin：检查浏览器地址与 APP_ORIGIN 是否一致。
- MySQL 连接失败：核对服务是否启动以及本地 DB_HOST/DB_PORT/DB_USER/DB_PASSWORD。
- 模板重名 409：已归档模板的名字仍保留，使用新名字。
- 部分迁移状态：停止并核对结构，不删库、不运行 sync force/alter，不盲目重跑恢复脚本。

## Postman

导入 docs/JRS-HR.postman_collection.json 和 docs/JRS-HR.postman_environment.example.json。
先选择本地环境，token 保存在环境而非集合，记录 ID 默认空白。集合已移除 Login 和账号密码变量。
完整步骤及错误对照见 docs/API_TESTING.md。
需先通过组员登录并按双方契约携带验证凭据，再请求 /api/auth/me 更新 csrfToken。
本模块 jrs.hr.sid Cookie 只负责 CSRF 会话，单独持有它不能登录。团队接口目前未实现。
按需选择真实样例 ID 和本地文件，最后 Logout。集合包含写操作和文件
请求，不要未经选择直接整组无人值守运行。Postman GUI 手工联调尚未完成。

## 边界

邮件保持 preview；SENT 是服务商接收提交，不能宣称已送达。模拟历史有明确标签。
关联申请仅显示本人负责申请的只读摘要。团队的身份、可见范围、上游事件、路由和
附件写入契约见 docs/INTEGRATION.md，尚未声称与组员集成。

仍有 Sequelize/UUID 2 项 moderate 审计项，详见 docs/DEPENDENCIES.md。
无 Git 仓库或远端；不提交 reference、环境文件、上传文件、work、node_modules。
本轮没有发送真实邮件、发布网站或推送 GitHub。

团队共享后端、数据库表所有权、现有 API 与尚未完成事项见
`docs/TEAM_BACKEND_BASELINE.md`。共享迁移和接口契约，不共享 `.env`、密码、密钥、
本机上传文件或 MySQL 数据目录。
