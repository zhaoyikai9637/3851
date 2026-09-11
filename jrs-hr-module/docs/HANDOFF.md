> 2026-09-11 侧栏交互补充：用户指出不可点击的团队栏目会让蓝色高亮永久停留在 Notifications。现已为 Dashboard、Applications、Candidates、Job Postings、Interviews 增加可点击的独立占位路由，高亮随当前地址移动；占位页不读取 API、不模拟数据，也不越界实现队友业务。修改目的为补齐 Figma 导航交互并保留模块职责边界。

> 2026-09-11 导航与日期更新：已按 Figma `Final project` 的 WORKSPACE 结构调整侧栏，顺序为 Dashboard、Applications、Candidates、Job Postings、Interviews、Notifications；只有 Notifications 进入本模块。My Profile 已从侧栏移除，头像菜单不再提供 Edit Profile，编辑入口保留在 My Profile 页面。通知与日志日期字段固定显示 `MM/DD/YYYY`，API 查询前转换为 ISO 日期。前端 3 文件 / 43 项和生产 build 通过；本地浏览器已核对移动侧栏、头像菜单、日期占位符及资料页跳转。本次没有重跑后端和真实 MySQL 测试。

> 2026-09-10 Sol 接续更新：本地虚构数据前端演示入口已实现并实测。可直接打开 `http://localhost:5173/notifications?demo=1`；五个 React 业务页面复用原组件，演示请求只进入浏览器端适配，不调用 HR API、数据库或邮件服务。普通团队入口和后端授权保持不变。下方 2026-09-09 全套结果仍是历史证据，本次只执行了与前端演示相关的测试、构建、浏览器检查及未登录 401 回归。
# JRS HR 模块交接记录

日期：2026-09-08。性质：便于新 Codex 对话接续的事实与计划快照。
本文件不是逐字聊天导出，也不是教师/团队正式审批文件。

**当前状态（2026-09-09 P7 更新）：API 契约示例与自动验证已补齐。**
登录仍由组员负责，对方尚未实现；本模块没有账号密码入口，也不自动登录。
当前后端 157、前端 38、真实 MySQL 12 项通过；OpenAPI 22 操作/316 处 JSON 示例
校验、导出和 build 通过；Edge 14 检查/23 截图/0 错误。Postman GUI/团队联调未完成。
开发/测试两个专用库已获准创建并初始化，继续复用；凭据仅在本地环境文件。
Vitest 升至 4.1.11，审计剩 Sequelize/UUID 2 moderate、0 high/critical。
依赖与源码更改前备份在 work/before-api-contracts-20260909；原有两个备份也保留。
下面早期阶段记录属于历史；当前结果以第 12 节及 docs/API_TESTING、VERIFICATION 为准。

## 2026-09-10 本地虚构数据演示

- `client/src/demo-api.js` 提供浏览器端虚构数据适配；通知、模板、日志、关联申请和资料操作不经过 `fetch`，不触碰 MySQL，也不发送或下载真实内容。
- 未登录页新增 `Open fictional demo`；也可用带 `?demo=1` 的直达链接。模式标记保存在当前标签页的 `sessionStorage`，页面导航及刷新后仍保持，退出后清除。
- 页面顶部持续显示 `LOCAL DEMO · Fictional data · No API, database, or email activity`。`Reset demo` 恢复初始数据；头像菜单 `Logout` 返回团队登录等待页。
- 复用现有五个页面和响应式布局，没有恢复账号密码登录、没有引入测试身份夹具、没有修改服务器授权。
- 本次实测：`npm.cmd run test -w client` 为 3 文件 / 41 项通过；`npm.cmd run build` 通过（Vite 7.3.6，50 模块）。真实浏览器验证通知已读、关联申请摘要、模板保存、日志详情、资料修改、重置、退出、刷新保持模式，以及 1440×900 和 390×844 布局。未登录 `GET /api/hr/notifications` 与 `GET /api/auth/me` 均返回 401。
- 本次没有重跑后端 157 项、真实 MySQL 12 项或 docs 全套；不得把 2026-09-09 的结果写成本次新验证。

## 1. 当前目标与已确定选型

用户本学期将上学期已设计的个人模块做成可运行的全栈网站。以 PC 为主，
适配手机，不开发单独 App。沟通使用中文，界面沿用英文 Figma 文案。

| 层次 | 已选方案 |
|---|---|
| 前端语言 | JavaScript、HTML、CSS |
| 前端 | React、Vite、Bootstrap |
| 浏览器 | Chrome 或 Edge |
| 后端 | JavaScript、Node.js LTS、Express |
| 通信 | REST API + JSON |
| ORM / 数据库 | Sequelize、MySQL Server；Workbench 管理 |
| 开发工具 | Windows、VS Code |
| API 文档 / 手测 | Swagger/OpenAPI、Postman |
| 前端单测 | Vitest + React Testing Library |
| 后端单测 / API 自动测试 | Vitest + Mock、Supertest |
| 版本管理 | Git + GitHub（尚未创建/连接仓库） |

历史上建议过 Vue/Java/Spring；用户随后明确选择以上 JavaScript 技术栈，
以最新选择为准。教师把 ASP.NET MVC 等列为可选技术，并非强制；采用
Code First，仍然需要真实数据库和版本化迁移。旧 PM 的“先写 SQL”不是
当前实现顺序的唯一约束。保留 ER 图用于核对模型，不能因为用 ORM 忽略关系。

## 2. 用户的职责边界（原始文档支持）

### 属于本模块的 15 个用例

| 编号 | 用例 | 核心验收 |
|---|---|---|
| 1.1 | View Notification Center | 从 API 显示当前 HR 的内部通知及未读数 |
| 1.2 | Filter Notifications | All/Unread、类型、日期筛选及清除 |
| 1.3 | Mark Notifications as Read | 单条/全部已读写入 DB，刷新后保留 |
| 1.4 | Open Related Application | 转至关联申请；无效引用明确提示 |
| 2.1 | Manage Email Templates | 列表与选中模板详情 |
| 2.2 | Create Email Template | 必填验证，保存后可再次查询 |
| 2.3 | Edit Email Template | 更新用于未来邮件的内容 |
| 2.4 | Delete Email Template | 确认/取消，删除后不再出现在可用列表 |
| 3.1 | View Notification Logs | 展示成功发送的候选人邮件记录 |
| 3.2 | Filter & Search Logs | 按候选人/职位搜索，按触发事件及日期过滤 |
| 3.3 | View Sent Notification Details | 展示历史最终内容及收件人等快照 |
| 4.1 | Open Avatar Dropdown Menu | 显示姓名、工作邮箱及账户操作 |
| 4.2 | View HR Profile | 只读个人/雇佣信息及最近登录时间 |
| 4.3 | Edit HR Profile | 只修改获准个人字段，保存及失败提示 |
| 4.4 | Log Out | 服务端会话失效并返回登录页 |

五个主要页面：Notification Center、Email Templates、Notification Log、
My Profile、Edit Profile；另有详情页、头像菜单、弹窗、空状态。

邮件模板默认类别：Interview Invite、Offer Letter、Accepted、Rejected、
In Progress。变量语法是 `[CandidateName]`、`[JobTitle]`、`[CompanyName]`、
`[HRName]`，不要改成双花括号。草稿枚举为 INTERVIEW_INVITE、OFFER_LETTER、
ACCEPTED、REJECTED、IN_PROGRESS，需与组员对齐事件命名。

资料可编辑：头像、姓名、电话、办公地点。
资料不可由本人接口编辑：员工编号、部门、工作邮箱、角色、账户状态。

### 不属于本模块

职位发布、申请审核、改变候选人状态、面试安排、面试/反馈提醒、Offer 审批、
合同创建等是组员的业务。原报告明确说明曾删除这些重复功能。
通知负责告知 HR 并链接来源，模板供上游使用，日志负责记录邮件历史。
可提供最小只读关联申请适配和本地演示数据，但不能宣称是完整招聘系统。

## 3. 设计和原始依据

Figma：[Final project](https://www.figma.com/design/7pFuOLD4Jw36MkeWpDpV6m/Final-project?node-id=0-1)

上次定位到通知/HR 资料桌面设计的大分组：
[786:986](https://www.figma.com/design/7pFuOLD4Jw36MkeWpDpV6m/Final-project?node-id=786-986)。
这个组很大，读取设计时应进一步定位具体画面/子图层，不能假设一次读取就齐全。
已读过部分图层上下文；当前包没有完整 Figma 导出，也没有成功下载的 SVG。
不要复用可能过期的临时素材链接。参考整体是深蓝侧栏、浅蓝/浅灰内容底色、
白色卡片、蓝色按钮，顶栏三标签，右上头像账户菜单，Inter 字体风格。

两份 Word 原件、7 张提取图片和早期 SQL 已包含在 `reference/`；详见
`docs/SOURCES.md`。报告说上学期写过 5 个 HTML 页面，但本次上传的是报告
和截图，未提供那 5 个 HTML 源文件。不要把截图说成可直接复用的旧前端代码。

## 4. 迁移时的历史文件状态（本轮变化见第 9 节）

| 位置 | 当前状态 |
|---|---|
| 根/client/server 的 package.json | 草稿；npm workspaces；依赖尚未安装验证 |
| server/src/models.js、db.js | Sequelize 模型/关联草稿 |
| server/src/migrations/001-module.js、migrate.js | 初始迁移与 Umzug 登记草稿；未在 MySQL 执行 |
| server/src/app.js | Express 路由、会话、CSRF、上传草稿；存在缺失 import |
| server/src/services.js、validation.js | 业务服务、筛选、模板变量、校验草稿 |
| server/src/session-store.js、config.js、index.js | DB 会话存储/配置/启动草稿 |
| server/src/mailer.js | 邮件适配草稿；默认 preview，不发邮件 |
| server/.env.example | 占位配置，不能直接登录数据库 |
| client/ | 只有 package.json；没有 React 页面、index.html 或 Vite 配置 |
| server/src/openapi.js | 缺失，但 app.js 已 import，阻止正常启动 |
| server/src/seed.js | 缺失，但 db:seed 已声明 |
| scripts/export-docs.mjs | 缺失，但 docs:export 已声明 |
| 前后端 tests / 测试配置 | 尚未编写 |
| README、联调文档、OpenAPI 导出、Postman 集合 | 尚未完成；交接文档不能冒充 API 文档 |
| package-lock.json | 最终检查发现已有安装过程生成的锁文件；原样包含，未验证可复现性 |
| node_modules | 工作目录有安装产物，未证实完整可用；不包含在 ZIP 中 |

此前 npm install 报过网络审批错误；最终检查发现有锁文件和安装产物，但
没有取得完整成功退出及运行验证证据，不能因此说安装已成功。没有构建、单元测试、
API 测试或真实 MySQL 验证成功的记录。此次交接只执行归档/副本检查和
`node --check` 语法检查，不等于解析全部依赖、应用启动或功能验收。
没有改动用户已有数据库，没有创建 GitHub 仓库或部署站点。

## 5. 数据模型与对外契约（草稿待对齐）

用户负责五张业务表：HR_USER、SYSTEM_NOTIFICATION、EMAIL_TEMPLATE、
NOTIFICATION_LOG、NOTIFICATION_ATTACHMENT。

为独立演示额外引入 MODULE_ACCOUNT（密码哈希/认证角色）和 MODULE_SESSION。
CANDIDATE、JOB_POSITION、APPLICATION 是外部依赖：standalone 模式创建
最小演示表；team 模式要求已有表。它们不是用户新接手的完整业务模块。

APPLICATION 草稿依赖字段：application_id、candidate_id、position_id、
assigned_hr_user_id、current_status、applied_at，以及模型默认时间戳。
团队实际列名、外键类型、时间戳、HR 归属、身份主键尚未证实；不能强迫组员
改成此草稿。需要适配并验证全部表，不只是判断列名存在。

模型使用 JS camelCase 属性映射 MySQL snake_case 字段和大写表名。
迁移使用 utf8mb4/InnoDB；新数据库路径优先，不允许自动覆盖已有表。
旧 SQL 和 ORM 草稿字段/索引/约束并非完全一致，旧 SQL 仅保留供比对。
迁移尚未应用；经过检查可以修正这个初始草稿。一旦正式应用/共享，后续结构
变更写新迁移。migrate.js 当前只显式注册 001，新迁移还需登记或完善发现机制。

内部事件服务草稿：`recordApplicationEvent(...)` 和 `sendWorkflowEmail(...)`。
这些不暴露为任意浏览器事件写入接口；上游触发真实性由可信后端负责。
接口草稿使用 eventKey 防重复尝试，但不能据此宣称 SMTP 与 DB 有分布式事务。

## 6. 迁移时 API 草稿索引（历史，当前 OpenAPI 已更新）

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | /api/health | 进程健康响应 |
| GET | /api/auth/csrf | 取得会话 CSRF token |
| POST | /api/auth/login | 独立演示登录 |
| GET | /api/auth/me | 当前 HR 会话信息 |
| POST | /api/auth/logout | 销毁会话 |
| GET / PATCH | /api/hr/profile | 获取/修改获准资料 |
| POST / GET | /api/hr/profile/photo | 上传/读取本人头像 |
| GET | /api/hr/notifications | 分页筛选通知 |
| PATCH | /api/hr/notifications/read-all | 标记本人全部未读 |
| PATCH | /api/hr/notifications/:id/read | 标记本人单条 |
| GET / POST | /api/hr/templates | 列出/创建模板 |
| PUT / DELETE | /api/hr/templates/:id | 更新/软删除模板 |
| GET | /api/hr/logs | 筛选发送记录 |
| GET | /api/hr/logs/:id | 邮件快照详情 |
| GET | /api/hr/attachments/:id/download | 授权附件下载 |
| GET | /api/hr/applications/:id | 只读关联申请摘要适配 |
| GET | /api/openapi.json、/api/docs | 文档路由草稿；文档对象缺失 |

会话 cookie 名称 jrs.sid。非安全方法要求 x-csrf-token；登录轮换 session 和
token；前端应保留 cookie 并更新 token。计划由 Vite 代理 /api 到后端，配置
尚未创建。浏览器角色切换仅改变入口，不能把求职者提升为 HR。

## 7. 迁移时的问题清单（本轮处理结果见第 9 节）

1. CSRF 的 timingSafeEqual 目前只先比较字符长度；非 ASCII 输入可能造成
   Buffer 字节长度不同并抛错。先严格验证 64 位小写十六进制或字节长度，再
   安全比较，测试非法/缺失/过期 token、会话轮换、错误来源。
2. 原用例中的 Notification Log 是“成功发送历史”；草稿 logs() 默认返回
   PENDING/FAILED/PREVIEW/SENT，日期按 createdAt 而非 sentAt，详情也未限制
   成功状态。需要按用例修正主列表、详情与日期语义。失败诊断若保留必须与
   成功历史分开，演示预览不得伪装成真实成功。
3. SMTP 返回接受请求不代表候选人实际收到邮件。草稿 SENT 最多表示提交成功；
   不要把 UI 文案写成已送达，除非有供应商回执。历史快照不能随模板修改。
4. 单公司共享模板、仅发送人可看日志、按 assignedHrUserId 访问申请、新加坡
   日期筛选均是草稿假设。原用例未定义所有 HR 可见范围，集成前与组员确认。
5. `INTEGRATION_MODE=team` 不等于团队统一认证已实现。当前 login/authorize
   仍依赖 MODULE_ACCOUNT，需要真正的身份适配，生产环境配置检查不足以
   证明已集成。不要因 setting=team 就对外发布。
6. 初始迁移既有表检测不覆盖所有可能冲突表；MySQL DDL 非整体原子事务。
   完善预检查/可诊断失败，禁止失败后自动删表清理。在隔离新库验证与模型一致。
7. Template 名称唯一包括软删除记录；再次创建同名的策略要明确。正文预览
   使用安全文本渲染，不插入不可信 HTML。CompanyName 当前硬编码 JRS，需配置。
8. 头像上传有格式/像素/大小验证草稿，但旧头像清理策略、附件写入/存储契约、
   文件缺失处理与路径访问测试仍需完成。附件有模型和下载路由不等于功能完整。
9. npm 依赖版本和现有锁文件尚未通过安装/运行验证；验证兼容性、已知风险和
   lockfile 一致性，优先保留可复现锁定，不盲目删除或升级。
   不把“工具安装成功”或“node --check 通过”等同于业务通过。
10. 前端、种子、自动测试和文档仍缺失，按计划逐步完成；保留 loading/error/
    empty/success 状态、键盘操作、窄屏布局和退出后拒绝访问测试。

## 8. 工作约定与下一步

见 `PLAN.md`。P0–P5 独立演示已实现并验证；下一步为 P6 契约对齐及 P7 剩余文档/人工演练。
专用数据库已确认和创建，不要重新建库。始终在原工程继续。
数据库写入前核对新开发/测试库；外部发布、真实邮件发送、团队库操作另行授权。
每次结束写清：修改文件、实际运行命令及结果、未完成事项、下一步第一项任务。

## 9. 2026-09-08 实施和验证（历史阶段）

- 在原 E:/textProject/jrs-hr-module 工作，按顺序读完 AGENTS/HANDOFF/PLAN/SOURCES，
  读取两份 Word 原件、15 用例、5 张界面截图和旧 SQL（只读）。报告 ER PNG 截断，
  不能完整解码；保持原文件，结合报告文字核对关系。未假定 Figma 权限。
- Node 24.16.0、npm 11.13.0、Git 2.53.0.windows.3；MySQL267 服务 Running。
  尚未通过 SQL 核对 MySQL 版本、端口和数据库。目录不是 Git 仓库，未初始化/推送。
- 原清单与锁文件逐项一致。原锁 npm ci 安装 365 packages 并退出 0。
  Nodemailer 7.0.13 → 10.0.1、Sharp 0.34.5 → 0.35.4，保留 npm 更新的锁文件。
  npm audit 从 2 high/2 moderate 降为 0 high/2 moderate，仍退出 1。
  Sequelize/UUID 的保留原因和版本管理方式写入 docs/DEPENDENCIES.md。
- app.js 已修复 CSRF：两端严格验证 64 位小写 hex，再解码并安全比较。
  登录会话/token 轮换、Unicode/非法/缺失/过期 token、Origin、退出重放已测试。
- services.js/validation.js 已修复成功日志：列表、详情、附件限制 SENT + 非空 sentAt，
  筛选和排序按 sentAt；PREVIEW/PENDING/FAILED 参数返回 422。
  模板更新不改快照；归属限制不依赖前端。CompanyName 已支持 COMPANY_NAME。
- mailer.js 只允许 to/subject/text；禁用 file/URL 访问。默认 PREVIEW；真实 SMTP
  还需 MAIL_ALLOW_SMTP=true 和单独授权。测试只使用 mock 或内存 MIME，不发邮件。
  工作流事件重复不重发，跨事件 key 冲突返回 409；提交后 DB 更新失败保留 PENDING。
- server/src/openapi.js 已创建。scripts/export-docs.mjs 已实际导出
  docs/openapi.json 和 docs/JRS-HR.postman_collection.json。未在 Postman GUI 联调。
- P2 准备新增 database-safety.js、env.js、seed.js、.env.test.example、MySQL 专用
  测试配置与 tests/mysql.test.js。启动/迁移/seed 要求精确专用库名确认，拒绝 root、
  team 和 production；Umzug 写 metadata 前预检目标。DDL 失败不删表。
- seed 只含两位虚构 HR、五类模板、通知和最小申请适配数据；历史样例全部 isDemo=true，
  主题/正文标记 SIMULATED，PREVIEW 无 sentAt。仅 mock 测试，尚未实际种入数据库。
- 首轮回归 67 通过 / 5 失败，确认复现原问题；修复后 72 通过，扩展后 97 通过；
  加入数据库保护及文档契约测试后，`npm run test -w server` 为 8 文件/124 项通过。
  createApp import 和 `npm run docs:export` 均退出 0。
- 未执行真实 MySQL、迁移或 seed；未创建可用 .env；数据库名字只是待确认方案。
  建议 127.0.0.1:3306 下 jrs_hr_module_dev_20260908 / jrs_hr_module_test_20260908，
  必须先确认是全新专用库，见 docs/DATABASE_SETUP.md。
- 前端仍只有 package.json，React/RTL/构建/桌面手机浏览器验收尚未完成。
  旧头像回收、附件写入契约、团队统一身份、上游路由和可见范围仍待完成/对齐。
  docs/INTEGRATION.md 明确这些差异，不能据此宣称已和组员集成。
- 最终整体检查：更新后的锁文件 npm ci 退出 0；npm test 的后端 124 项通过，
  前端因没有测试文件退出 1；npm run build 因缺少 index.html 退出 1。
  未把整体测试/构建记录为成功；完整结果见 docs/VERIFICATION.md。

## 10. 2026-09-09 本阶段实现、验收与下一步

- 用户“进行下一步开发，同意新建”授权两个专用库，并运行 setup-local.mjs。
  通过专用账号先核实两库均 0 张表，MySQL 26.7.0、127.0.0.1:3306。
  开发 jrs_hr_module_dev_20260908，测试 jrs_hr_module_test_20260908，分别独立账号。
  管理密码未保存，生成密码仅在 .env/.env.test。没有触碰团队库。
- 初次开发迁移因 Sequelize addIndex 使用 ALTER TABLE 被最小权限账号拒绝。
  改成 CREATE INDEX 后成功，不新增 ALTER/DROP 权限。测试库先完整迁移通过；
  专用恢复工具逐列/索引/FK 比对 3 张新建空表，保留它们、补齐其余表并记录历史。
  常规迁移复跑成功、seed 成功；恢复工具不允许对现在的完整库重跑。
- 新增 React/Vite/Bootstrap 入口、统一 API/CSRF、登录与过期处理、路由、桌面侧栏、
  顶部标签、头像菜单和窄屏导航。通知筛选/分页/已读/只读摘要已联通真实 MySQL。
- 模板创建/编辑/删除确认/取消、4 个变量插入、文本预览已实现；首轮 RTL 发现首次
  挂载短暂空编辑器，已修复。日志只呈现成功发送记录，模拟样例清楚标识，展示历史
  快照、UTC+08 时间、搜索和触发筛选。真实附件下载及 404/归属限制已有测试。
- Profile/Edit 只提交姓名、电话、地点；头像走独立上传，校验格式/2MB/16MP，
  归一成 JPEG。数据库行锁串行化同一 HR 的并发替换；提交后仅删除未被其他资料/
  附件引用的旧 UUID 文件。失败新文件回收、旧文件保留引用均有测试。
- 浏览器发现手机日志隐藏表头元素导致页面溢出，修复滚动容器定位。真实上传发现
  Helmet 默认 img-src 拦截 blob 预览，只给图片来源加入 blob，未放宽脚本策略。
- 最终 npm test：9 个后端文件/133 项 + 2 个前端文件/35 项通过；test:mysql 9 项通过。
  npm run build、docs:export 成功。Edge 152.0.4191.66 的 14 项真实流程检查全部通过，
  22 张截图、0 console/page 错误；检查 390/768/1024/1440px、Escape 焦点、
  真实下载、头像存储、刷新持久化、Express 重启后会话仍有效及 Logout 失效。
- work/clean-install-20260909 为临时验证副本，不是另一个开发工程：不含凭据/参考件，
  全新 npm ci 安装 365 包，132+35 测试与 build 通过，临时服务连接专用测试库启动成功。
  随后原工程增加 1 项附件测试，最终原工程 133+35 通过。当前开发仍在原目录。
- npm run dev 已启动，http://localhost:5173 正常；真实代理登录/退出检查成功。
  Swagger 阅读/交互优先使用同源 /api/docs/，避免 APP_ORIGIN 不匹配。
  演示账号 hr1@example.test / hr2@example.test，初始密码取本地 .env 的 SEED_PASSWORD。
- 后续：Postman GUI 演练、更多文档示例、团队身份/上游/附件契约、遗留依赖风险。
  崩溃/文件锁导致的孤儿头像定期清理仍可补强。未做团队联调、真实邮件、发布或推送。
  本轮源代码和文档共 66 文件扫描，未发现本地真实密码/会话密钥泄漏。


## 11. 2026-09-09 根据用户职责移除本模块登录

- 用户明确登录属于组员，并回复对方还没做；无需再次索要目前不存在的接口。
- 移除前端账号/密码表单、样式和 api.login；删除公开 POST /api/auth/login、
  loginSchema、密码校验服务，运行中 authorize 改为可信身份映射 + ACTIVE HR 检查。
- 新增 server/src/team-auth.js：受信任本地适配文件提供 resolve/logout；未配置时拒绝访问。
  不信任浏览器 HR ID/role/未验证 token。配置仅登记契约，不等于已经接通组员实现。
- 前端读取 /api/auth/config 和 /me；无身份显示团队入口与重试，保留所需页面路径。
  TEAM_LOGIN_URL 留空时明确提示，不猜 /login。有效登录地址支持退出成功后的跳转。
- Cookie 使用 jrs.hr.sid，与未来团队认证 Cookie 分开；上游身份变化轮换模块会话和
  CSRF，换账号旧 token 拒绝写入。退出先成功撤销上游，再清模块 Cookie；失败可重试。
- 保留 MODULE_ACCOUNT 表/已有数据/旧种子兼容代码，不再用于运行时登录。
  未更改已应用迁移和数据库结构。lastLoginAt 后续由团队可信身份数据同步。
- npm.cmd test：10 后端文件/150 项 + 2 前端文件/38 项通过；npm.cmd run test:mysql：9 项通过。
  npm.cmd run build 和 npm.cmd run docs:export 均退出 0；OpenAPI/Postman 已移除本模块登录。
- node scripts/browser-check.mjs（本机 Playwright/Edge）：14 项检查、22 张截图、0 错误。
  使用测试进程发放的虚构上游身份，真实 HR API/MySQL；覆盖入口/退出跳转、失效后返回、
  5 页面桌面/手机、通知持久化、模板、资料/头像和附件。不是组员登录联调结果。
- 浏览器首跑因身份注入早于 React 完成初始检查，重试按钮已消失而超时；补显式等待
  未登录状态后复跑通过。新测试中的一次 503/Request failed 日志为故意模拟上游退出失败。
- README/START_HERE/PLAN/VERIFICATION/INTEGRATION/TEAM_AUTH 已同步；原工程位置不变。
- 下一步等待组员的登录 URL、会话验证/退出接口及 HR 主键映射，再填适配并做真实端到端
  联调。Postman GUI、上游业务契约及依赖 moderate 项仍待处理。没有真实邮件/发布/推送。

- 最后复用现有 localhost:5173 开发服务验证待接入页和 profile 401；源码/文档 67 文件扫描无真实凭据。

## 12. 2026-09-09 P7：接口示例、契约校验和并发验证

- 重读交接/计划/来源并检查原始 15 用例相关段落、实际 API/模型/验证器。
  Node 24.16.0/npm 11.13.0 与已有依赖正常，没有新建工程或恢复个人登录。
- OpenAPI 补全响应必填字段、时间戳/分页约束、Cookie/CSRF、204/错误/下载说明。
  虚构示例统一放在 openapi-examples.js，Swagger 与 Postman 共用；当前 22 操作、
  316 处 JSON 示例（错误示例有重复引用）。未知团队认证传输仅标明待对齐，不捏造协议。
- 新增 docs:check：Swagger Parser + Ajv 校验结构/示例，禁用外部引用。单元负例
  验证缺字段、错类型和 PREVIEW 不能当 SENT；MySQL HTTP 套件验证真实 DTO。
- Postman 集合增加保存的示例与空白本地环境；token 只写环境，ID 不再默认 1，
  新建模板使用动态名字并保存 ID/名称，Logout 移到最后。脚本单测不等于 GUI 联调。
- app.js 对非法/过大 JSON 返回固定 400/413，不回显输入内容；原 HR 校验、CSRF 保留。
- MySQL 增加并发重复通知/预览邮件事件测试，4 次同时调用仅一条通知/一次邮件尝试；
  测试使用已批准专用测试库与内存 preview，未连 SMTP、未写团队库、未改结构。
- 新增开发依赖 swagger-parser 13.0.0、Ajv 8.20.0、ajv-formats 3.0.1。新审计发现已有
  Vitest/mocker advisory；前后端升级到官方修复版 4.1.11 后回归通过，审计由 4 moderate
  回到遗留 2 moderate。原锁备份并由 npm 更新，没有 force 降级/UUID 跨主版本替换。
- npm.cmd test：后端 157 + 前端 38 全通过；npm.cmd run test:mysql：12/12；
  docs:check/docs:export/build 退出 0。Edge 14 项通过、23 截图、0 错误。
- 在 work/contract-clean-install-20260909 只复制 4 个清单/锁文件，离线 npm ci 安装
  373 包、npm ls 成功；未复制环境凭据，该目录仅安装验证，不是另一个开发工程。
- 真实浏览器发现累计测试通知/历史已跨页，旧测试假定种子在首页且标题唯一。
  现在每次创建独立虚构通知并精确定位，日志通过真实搜索查找，保留所有历史记录。
  首轮导出器括号笔误和 HTML 页面不应要求 JSON 示例的测试断言也已修复。
- 当前下一步：组员完成登录后接入身份/退出，进行 Postman GUI 与团队真实联调；
  继续对齐申请路由/事件/附件/可见范围。头像离线孤儿清理和依赖遗留项仍可补强。

- 最后确认现有服务提供 22 个操作与新示例；72 文件凭据值扫描无匹配，未接入登录边界仍为 401。

