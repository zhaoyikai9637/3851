# JRS HR 原工程：Sol 接续交接（2026-09-10）

## 先做什么

用户因 Astra 消耗较高，要求新开 Sol 对话继续。本次仅整理交接，没有继续修改业务代码，也没有重新运行全套测试。第一优先级是让用户现在就能查看、操作原有前端的具体内容。

**2026-09-10 接续后状态：本地前端预览入口已经实现并实测。** 直达 `http://localhost:5173/notifications?demo=1`，或在普通未登录页点击 `Open fictional demo`。普通团队入口仍显示“Continue through team sign-in”，后端未登录授权仍为 401。

## 唯一实际工程与阅读顺序

- 实际源码：`E:\textProject\jrs-hr-module`，继续在这里修改，不创建替代工程，不复制整套项目。
- 当前任务目录 `C:\Users\zhaoy\Documents\ChatGPT\毕业设计招聘网站` 经检查只有 `.git`；它不是实际源码。更早的 `E:\liulanqidownload\2026-09-08\jrs-hr-chatgpt-agents-md-docs-2` 也不是实际工程。
- 接续时依次阅读原工程 `AGENTS.md`、`docs/HANDOFF.md`、`docs/PLAN.md`、`docs/SOURCES.md`，然后检查本次相关源码。历史章节包含旧状态，以最新阶段和代码为准。
- 具体证据：`docs/VERIFICATION.md`、`docs/TEAM_AUTH.md`、`docs/INTEGRATION.md`、`docs/API_TESTING.md`、`docs/DEPENDENCIES.md`。
- 原工程可能不在新任务可写根中。读文件可正常进行；写入/执行按实际工具权限申请，不让用户再次批准已授权业务，不修改系统权限来绕过限制。

## 用户要求与职责

中文沟通，英文 UI，PC 为主兼容手机。仅负责 Notification Center、Email Templates、Notification Log、头像菜单、My Profile、Edit Profile、Logout。职位、申请审核、面试、Offer 业务归组员；只保留所需适配。

技术栈固定 JavaScript + React + Vite + Bootstrap；Node.js + Express + Sequelize + MySQL；REST/JSON；Vitest、React Testing Library、Supertest、OpenAPI/Swagger、Postman。不得改为 TypeScript、SQLite、Java 或 ASP.NET。

用户要求删除个人模块登录，组员的登录尚未开发。已经删除账号密码表单、`api.login`、`POST /api/auth/login` 和运行时密码验证。不要恢复独立登录，也不要因为演示而给真实 API 自动赋予 HR 身份。

不假定旧聊天/Figma权限。原件在 reference；报告中旧的五个 HTML 源文件并未提供，现有前端是本工程已实现的 React 页面。

## 已实现内容

- `client/src/App.jsx`、`auth.jsx`、`api.js`、`shared.jsx`、`styles.css`；五个页面在 `client/src/pages`。
- 深蓝侧栏、顶部标签、头像菜单、通知筛选/未读/已读/分页/关联申请摘要。
- 模板列表与创建、编辑、删除确认、安全文本预览，支持四个方括号变量。
- 成功邮件日志搜索/筛选/详情/受保护附件；模拟历史明确标记，PREVIEW 不进入成功历史。
- HR资料、编辑允许字段、头像验证/存储清理、退出及错误处理，桌面/手机布局。
- Express HR访问控制、CSRF格式与字节校验、可信团队身份适配点、非法JSON固定400/过大413。
- 已批准专用 MySQL 库迁移/种子、会话/持久化、事件并发去重等测试。
- OpenAPI共22操作，316处JSON示例条目（含重复引用，非316独立场景）；Swagger/Postman共享虚构示例，文档校验与空白Postman环境已导出。

## 当前前端为什么看不到

业务入口原为 `http://localhost:5173/notifications`，API 为 `http://127.0.0.1:3001`。`http://localhost:5173/api/docs/` 是 Swagger 文档，不能当作业务前端交付给用户。

`client/src/auth.jsx` 的 AuthProvider 先请求 `/api/auth/config` 和 `/api/auth/me`；没有团队身份就返回等待登录的整页提示，未渲染五个业务页。`server/src/team-auth.js` 尚未配置真实组员适配，所以受保护接口返回401。这不是前端被删除。

浏览器测试通过，是因为测试进程使用 `server/tests/helpers/team-identity.js` 提供虚构上游身份；不能把这个测试夹具作为正常开发服务的公开登录后门。

本地演示现由 `client/src/demo-api.js` 提供浏览器端虚构数据适配，复用现有页面；顶部固定显示虚构数据提示，支持重置和退出。模式在当前标签页保存，导航及刷新不丢失。没有账号密码、无需组员登录、不读取真实 HR API、不写数据库、不发邮件，也没有公开测试身份夹具。

本次实测前端 3 文件 / 41 项、生产 build 通过；真实浏览器完成通知、申请摘要、模板、日志、资料、重置/退出、1440×900 与 390×844；正常未登录 API 仍为 401。没有重跑历史后端/MySQL/docs 全套。

## 上一阶段真实测试结果（2026-09-09；本次未重跑）

| 命令 | 结果 |
|---|---|
| `npm.cmd test` | 后端10文件157项 + 前端2文件38项通过 |
| `npm.cmd run test:mysql` | 专用MySQL12项通过 |
| `npm.cmd run build` | 通过，Vite7.3.6，49模块 |
| `npm.cmd run docs:check` | 22操作/316处JSON示例通过 |
| `npm.cmd run docs:export` | OpenAPI、Postman集合和环境导出成功 |
| `node scripts/browser-check.mjs` | Edge14流程检查、23截图、0错误 |
| 临时目录离线 `npm.cmd ci` / `npm.cmd ls --depth=0` | 安装373包且依赖树通过；该目录仅安装验证 |
| `npm.cmd audit` | 退出1；剩Sequelize/UUID 2 moderate，0 high/critical |

上次版本：Node24.16.0、npm11.13.0、Vitest4.1.11、Vite7.3.6。新环境检查已有依赖，不盲目重装升级。

浏览器脚本在本机曾使用：

```powershell
$env:NODE_PATH='C:/Users/zhaoy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
node scripts/browser-check.mjs
```

截图/结果在原工程 `work/browser-check`。例如 `notifications-1440.png` 可证明已实现外观，但不能替代用户可直接访问的演示入口。

## 数据库、安全与授权

已由用户授权并创建两个专用库，继续复用：`jrs_hr_module_dev_20260908`、`jrs_hr_module_test_20260908`。用户也已在本机完成setup脚本。两库有独立账号，凭据仅在本地环境文件；不要输出或复制进交接。

不重新建库，不运行旧SQL、不执行sync force/alter、不动团队数据库、不真实发邮件、不发布、不推送GitHub。正式数据库测试前核对精确目标，不能把测试指向开发/团队库。本地演示入口本身无需数据库写入。

原有源码已保留；备份目录：`work/baseline`、`work/before-team-login-removal`、`work/before-api-contracts-20260909`。不要擅自清理或覆盖用户更改。

## 其余待办与工作方式

- 组员真实登录/身份校验/退出与HR映射、真实上游事件/申请路径/附件/可见范围仍待对齐。
- Postman GUI 尚未实际联调；当前脚本单测不能宣称GUI通过。
- Sequelize/UUID中危遗留及离线孤儿头像清理可后续处理。
- 用户已改用Sol以降低消耗：一次聚焦一个可验收阶段，简短中文更新；用实际必要测试验证，已有通过结果无新风险不反复跑全套；不要只给开发建议。
- 新任务先检查5173/3001是否还在运行，不沿用旧会话ID或假定跨日服务存活，不重复启动占端口进程。
- 完成演示阶段后更新HANDOFF/PLAN与真实测试结果，给用户可直接打开的业务前端链接；本对话交接后停止开发，避免两个任务同时改文件。
