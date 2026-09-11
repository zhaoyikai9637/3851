## 2026-09-11 日期日历选择恢复（已完成）

- [x] 为 Notification Center 和 Notification Log 的 From/To 日期字段恢复可点击日历按钮。
- [x] 保留可手动输入的 `MM/DD/YYYY` 英文显示，日历选值后自动转换为该格式；请求 API 时继续使用 `YYYY-MM-DD`。
- [x] To date 的日历最小日期跟随有效的 From date，原有非法日期和起止顺序校验继续生效。
- [x] 更新目的：修复上次为移除中文“日”而误删的日历选择能力，同时不重新引入受系统中文区域设置影响的可见日期格式。
- [x] 前端测试 3 文件 / 45 项通过，生产 build 通过；浏览器已确认两个日历点击区域和英文占位符均存在。

## 2026-09-11 侧栏可点击路由修正（已完成）

- [x] Dashboard、Applications、Candidates、Job Postings、Interviews 均改为真实可点击链接，并各自拥有独立占位路由。
- [x] 点击任一栏目后，高亮状态随当前路由移动，不再强制固定在 Notifications；Notifications 的三个子页面仍共同高亮 Notifications。
- [x] 占位页只说明该区域等待招聘团队模块接入，不实现、不模拟队友业务或数据。
- [x] 更新目的：让整站侧栏具备符合 Figma 的完整导航反馈，同时保持当前学生仅负责 Notifications 模块的职责边界。

## 2026-09-11 Figma 导航与日期规范修正（已完成）

- [x] 按 Figma `Final project` 的 WORKSPACE 侧栏顺序显示 Dashboard、Applications、Candidates、Job Postings、Interviews、Notifications；仅 Notifications 进入本模块，其余项目保持团队模块占位，不实现越界功能。
- [x] 从侧栏移除 My Profile；头像菜单只保留 My Profile 与 Logout，Edit Profile 仅从 My Profile 页面进入。
- [x] 通知和日志日期筛选改为固定 `MM/DD/YYYY` 文本格式，避免系统区域设置渲染中文“日”；提交 API 前仍转换为 `YYYY-MM-DD`，并验证非法日期和起止顺序。
- [x] 前端测试 3 文件 / 43 项通过，生产 build 通过；本地浏览器核对了移动侧栏、头像菜单、日期占位符和 My Profile 跳转。本次未重跑后端或真实 MySQL 测试。

## 2026-09-10 最新优先事项：用户可访问的前端演示（已完成）

- [x] 在原工程复用现有五个页面，提供明确标记虚构数据的本地演示入口，用户无需等待组员登录即可查看和操作。
- [x] 演示数据与真实 API/数据库隔离，不恢复账号密码登录、不公开测试身份夹具、不绕过真实后端授权。
- [x] 验证 PC/手机、通知与模板/日志/资料交互、退出/重置及正常 API 仍拒绝未登录；记录真实结果并给用户业务链接。
- [x] 更新 Sol 接续说明 [HANDOFF_TO_SOL.md](HANDOFF_TO_SOL.md)；下面 2026-09-09 记录保留为上阶段历史证据。

完成结果：直达 `http://localhost:5173/notifications?demo=1`。2026-09-10 实测前端 3 文件 / 41 项、生产 build 通过；真实浏览器完成 1440×900 与 390×844 检查及主要交互；正常未登录 HR API 和 `/api/auth/me` 仍为 401。本阶段未重跑后端全套、真实 MySQL 或 docs 全套。

原工程位置 E:/textProject/jrs-hr-module。新任务目录不代表源码迁移。先完成本地演示，再推进下列待组员提供契约的联调。

---
# 后续开发计划

交接日期：2026-09-08。以下按依赖关系推进，不代表每项已完成或课程实际周数。
P0/P1 可先做只读检查、源码修复及 mock 测试；P2 开始写数据库前必须核对目标。

## P0 — 接手和环境核对

- [x] 阅读 AGENTS、HANDOFF、SOURCES 和所需原始文档，确认职责。
- [x] 检查工作目录、现有修改、Node/npm/Git、本机 MySQL Server 状态。
- [x] 确认选用的依赖版本，按实际权限安装；记录失败原因，不绕过权限。
- [x] 检查已有 lockfile 与清单是否匹配，验证可复现安装；检查依赖风险，
      不盲目删除锁文件或执行破坏性自动升级。
- [x] 将不会暴露原始报告或密钥的版本管理方式说明给用户（docs/DEPENDENCIES.md）。

验收：依赖可加载；环境检查有真实输出；没有运行旧 SQL 或修改已有团队数据库。

## P1 — 先解除后端阻塞并建立测试

- [x] 审查现有代码；修正 CSRF 的字节长度/格式问题，补安全回归测试。
- [x] 创建 server/src/openapi.js，使 createApp 的 import 完整可解析。
- [x] 配置 Vitest；为 validation/renderTemplate/profileDto/服务编写单元测试。
- [x] 使用 Supertest + 隔离 mock 服务/会话存储验证 API。
- [x] 对齐成功邮件日志主列表、详情、sentAt 日期筛选和 PREVIEW 区分。
- [x] 补齐 401/403/404/409/422、跨 HR ID、只读字段、CSRF、退出会话测试。

验收：API 测试实际通过，未连真实用户数据库，不声称 mock 验证了 Sequelize SQL。

2026-09-08 实测：原锁 npm ci 成功（365 packages）；首轮测试 67 通过 / 5 失败，
复现 Unicode CSRF 与日志范围错误；修复并扩展后 `npm run test -w server`
为 6 文件 / 97 测试通过。createApp import 成功。定向更新 Nodemailer/Sharp，
审计剩 2 项中风险（Sequelize/UUID，同一底层问题），退出码仍为 1，详见 DEPENDENCIES。

## P2 — 数据库、Code First 和独立演示基础

- [x] 对照可用报告关系说明、旧 SQL 和新模型列出差异；记录独立演示模式（ER PNG 截断）。
- [x] 用户于 2026-09-09 同意新建，两个专用库已创建并在写入前核实为空。
- [x] 开发/测试使用不同专用账号和本地 .env；预检与关联顺序已实测。
- [x] 隔离库迁移已通过，模型列/类型/可空性/PK/FK 动作、索引与 Umzug 历史已核对。
- [x] 实现 seed.js，密码来自环境变量并哈希，全部虚构数据（mock 与真实 MySQL 顺序重跑均已验证）。
- [x] 种子代码包含两个 HR、5 类模板、通知和最小外部依赖数据（已写入专用库并验证）。
- [x] 种子代码明确标记模拟历史，PREVIEW 的 sentAt=null（已写入专用库并验证）。
- [x] 独立真实 MySQL 套件拒绝开发库；当前 12 项测试已执行并通过。

P2 准备：database-safety.js 核对精确库名确认、环境、用途及非 root 账号；迁移预检
在 Umzug 写 metadata 前拒绝不相关表和不完整状态。相关 mock 测试通过。
2026-09-09：两个专用数据库已获授权并创建。实际 MySQL 26.7.0，开发库首次
迁移遇到 addIndex 需要 ALTER 权限；改用 CREATE INDEX，并对已创建的 3 张空表
逐列/索引/FK 核对后补完，未删除或改写已有表。迁移复跑成功，种子成功，
`npm run test:mysql` 9/9 通过。详见 DATABASE_SETUP、VERIFICATION。

验收：数据可经 API 查询、更新，重新启动仍保留；迁移复跑不会重建/删除表；
受限 HR 不能读写另一 HR 的私有记录。表关系验证有真实 MySQL 测试证据。

## P3 — React 应用骨架与第一个完整流程

- [x] 补 Vite 配置、index.html、React 入口、路由和 Bootstrap 引入。
- [x] Vite 代理 /api；统一 fetch JSON、cookie、CSRF、错误和登录过期处理。
- [x] 构建 HRLayout：深蓝侧栏、顶栏标签、头像菜单；窄屏可折叠。
- [x] 可信上游测试身份 → 从 DB 查询本人通知 → 标记已读 → 刷新仍保持。
      2026-09-09 按用户职责删除独立演示登录；真实组员身份接入归 P6。
- [x] 求职者/非 HR 无权进入；不要做任意角色切换赋权按钮。
- [x] 用 React Testing Library 测试加载/失败/空状态和已读交互。

验收：浏览器真实请求 API，刷新后通知已读状态不丢，后端授权仍生效。

## P4 — 完成通知与邮件模板

- [x] 通知 All/Unread、类型、日期、分页、清空筛选、未读统计。
- [x] 通知与日志历史日期仅允许 UTC+08 当天或更早；日历、手动输入和 API 三层一致校验。
- [x] View 关联申请：独立模式只读摘要已实现和验证；团队真实路由仍列入 P6。
- [x] 模板列表/选中详情、创建、编辑、删除确认及取消。
- [x] 支持 4 个方括号变量插入、必填与未知变量校验、安全文本预览。
- [x] 软删除不破坏历史邮件；模板变更不回写日志快照。
- [x] 前端/单元/API 测试覆盖关键正反例。

验收：通知和模板均来自 DB，可跨刷新验证；使用已删除模板发信被拒绝。

## P5 — 日志、HR 资料与退出

- [x] 成功日志列表、候选人/职位搜索、触发事件和发送日期筛选。
- [x] 详情显示收件人、来源、模板名称及最终内容快照、明确状态与时间。
- [x] 有授权附件元数据时提供受保护下载；真实文件字节下载、缺失文件/越权提示已测。
- [x] My Profile 只读详情；Edit Profile 仅允许姓名/电话/地点/头像。
- [x] 头像上传类型/大小/像素限制、错误状态、预览及必要的存储清理。
- [x] 头像菜单支持外部点击/键盘关闭；Logout 使服务端会话失效。

验收：资料刷新保留，只读字段通过直接 API 提交也无法篡改；退出后受保护
接口不可用；历史邮件展示不依赖当前模板内容。

## P6 — 与组员集成（缺少契约时不阻塞本模块测试）

- [x] 按用户要求移除本模块账号密码登录页面和接口；保留安全身份适配位置。
- [x] 团队入口配置、401/403、换账号 CSRF、退出成功/失败与跳转均通过测试。
- [ ] 组员尚未实现登录；等待地址、身份验证/退出契约，填写真实适配并联调。

- [ ] 对齐统一身份、HR 主键、角色及公司/团队可见范围。
- [ ] 对齐 APPLICATION/CANDIDATE/JOB_POSITION 列类型、时间戳、归属字段。
- [ ] 对齐“查看关联申请”前端路径、通知触发事件、模板用法和发送职责。
- [x] 编写 docs/INTEGRATION.md 记录待对齐契约；尚未与组员实际联调。
- [ ] 与真实上游联调事件重复、事务失败及提交后 DB 失败；本地 mock 与真实 MySQL 并发去重已验证；上游联调仍未完成。
- [ ] 若需要真实邮件测试，使用获准测试邮箱与显式 SMTP 配置。

验收：真实上游事件能生成正确通知/日志，权限来自团队身份系统；不是仅把
INTEGRATION_MODE 改成 team。未获授权不向真实候选人发送。

## P7 — 文档、全面测试与交付

- [x] 当前模块 OpenAPI/Swagger 补齐 cookie/CSRF、请求/响应/错误示例与必填字段；未知团队认证仍属 P6。
- [x] docs:check 验证结构/316 处 JSON 示例；真实 MySQL HTTP 响应也按契约校验。
- [x] 实现 docs:export，已导出 OpenAPI JSON 和 Postman 集合；Postman GUI 手测待完成。
- [x] Postman 集合已移除本模块 Login；包含上游身份前置条件、/me 更新 CSRF、Cookie jar 说明。
      真实团队接口与 Postman GUI 手测仍待完成；新增空白本地环境、保存响应示例、环境 token 和 Logout 最后执行。
- [x] README 写出 Windows 环境、配置、建库/迁移/种子、启动和排错步骤。
- [x] 验证 npm test、npm run test:mysql、npm run build、npm run docs:export。
- [x] 检查约 390/768/1440px 及中间宽度，真实浏览器检查键盘/焦点/弹窗。
- [x] 从干净目录重新安装和启动，记录所用版本与测试结果。
- [x] 清查硬编码演示、真实凭据、私有文件；更新 HANDOFF/PLAN/WORK_IN_PROGRESS。
- [x] 保持仅本地演示；发布、真实邮件和 GitHub 推送仍未授权、未执行。

## 本阶段验收与当前下一项行动

2026-09-09 P7：后端 157 + 前端 38、真实 MySQL 12 项通过；build、docs:export、
docs:check 通过。OpenAPI 22 操作/316 处 JSON 示例（包括各操作重复使用的错误示例）。
Edge 14 检查、23 截图、0 错误；包含真实业务数据与 Swagger 展开的样例。
依赖更新后，隔离目录离线 npm ci 安装 373 包、npm ls 成功。安装验证不等于再次跑全套干净副本业务。

Vitest 4.1.11 已修复新审计发现的问题，当前仍有 Sequelize/UUID 的 2 moderate，
无 high/critical。证据、失败与测试边界见 VERIFICATION、DEPENDENCIES、API_TESTING。

本地入口 http://localhost:5173。组员尚未实现登录，当前正常显示待接入提示；
测试进程内的可信身份不是正式登录功能。专用库已完成，不要重新初始化或执行旧 SQL。

下一步：
1. 组员提供真实登录/验证/退出接口后，按 TEAM_AUTH 接入并补真实端到端与 Postman GUI 演练。
2. 对齐上游事件、申请路由、附件和可见范围；当前并发去重已在专用 MySQL 测过。
3. 跟进 Sequelize/UUID 遗留修复；头像离线孤儿文件清理仍可补强。

