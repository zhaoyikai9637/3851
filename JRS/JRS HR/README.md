# JRS HR 更新版

版本 2.6.2 · 2026-10-22

日期输入统一使用英文 YYYY-MM-DD 和英文日历，不受浏览器语言影响；提交给后台的日期格式保持不变。

本版删除拒绝弹窗中的状态变化图示。新建面试的日期、时间、地点和面试官初始为空，由用户填写；改期继续显示已保存的预约资料。

本版简化审核和面试流程：状态统一显示 Pending Review；Move to Interview 在一个表单中填写日期、时间、地点和面试官，一次保存同时进入 Interview 并完成预约。时长、面试方式及备注收在 More options 中。

删除审核页右上角 Back to list、Previous、Next、Applicant details，以及 Activity、View profile、View activity 等快捷按钮。保存后留在当前页面并显示结果提示，不再自动跳到成功页、面试列表或邮件草稿箱；通过顶栏路径返回列表时恢复原有筛选和页码。接收新申请后打开新申请的简历页，是保留的有目的跳转。

延续 2.5.0 的人工审核规则：学历、专业及是否接受应届毕业生仅写在 Job Requirements 中，由 HR 对照简历判断。表单不要求 HR 录入学历、专业或毕业日期，也不按这些旧字段拦截面试或 Offer。保留岗位关闭、阶段顺序、预约冲突、反馈结束时间、经理审批、Offer 日期及邮件确认等必要限制；既有资料与历史记录保留。

当前电脑运行目录仍为 `deliverables/JRS-HR-Updated-v2.1/JRS-HR-Updated`，代码版本为 2.6.2。在此目录运行 `npm run start:local`，打开 http://localhost:3000。若服务已运行，网页按 Ctrl+F5 刷新。新版操作说明见 [docs/SIMPLE_WORKFLOW_v2.6.md](docs/SIMPLE_WORKFLOW_v2.6.md)。

## 先选择运行方式

**本地 MySQL 主流程已验证。2026-09-28 已验证小组 Aiven 的 TLS 连接，但其 APPLICATION / MODULE_ACCOUNT 等表结构与本模块不同，统一登录及业务数据仍未对接。此版本界面和功能修复在本地验证，没有修改小组数据库。**

当前电脑已配置 `.env.local`，在原项目文件夹运行 `npm run start:local` 后打开 http://localhost:3000。登录邮箱为 `.env.local` 的 ADMIN_EMAIL，密码为 ADMIN_PASSWORD。 `.env` 保留小组配置。

界面调整与功能核对表见 [docs/UI_AND_FUNCTION_REVIEW.md](docs/UI_AND_FUNCTION_REVIEW.md)。

### 使用你现有的本地数据库

1. 解压源码包到新目录，在 VS Code 打开含 package.json 的目录。
2. 运行 `npm install`。
3. 首次解压到另一目录时，优先复制原项目的 `.env.local`；没有现有配置时，将 `.env.local.example` 复制为 `.env.local`，填写本地数据库和初始管理员密码。保持 DB_HOST 为 127.0.0.1、INTEGRATION_MODE 为 local。当前电脑原项目已有此文件，不用覆盖。
4. 运行 `npm run db:init:local`，更新缺失的表字段（包括结构化学历、专业、毕业日期及职位条件）并回填保留期。它不会直接执行五年删除，不重置已有密码。
5. 如果数据库完全为空、且需要演示数据，才运行 `npm run db:seed:local`。已有数据时跳过。
6. 运行 `npm run start:local`，打开终端显示的地址；默认本地 http://localhost:3000。

已有数据库在启动本版前应确认 `docs/RETENTION.md` 的清理规则。启动后将立即清理已超过期限的记录。编辑 Offer 不会重新计算五年。

### 使用小组 Aiven 数据库

源码包不含密码。如果已有之前的个人配置包，把它解压到项目根目录，得到 `.env`；CA 已在 `certs/jrs-ca.pem`。该配置使用 Junye Shen 的个人数据库账号，不包含其他组员或迁移账号密码。

```powershell
npm install
npm run db:check
```

`db:check` 只检查连接和所需表字段，不写数据。小组库已能够连接，但表结构不匹配；请勿直接新建一套重复的 hr_* 表，应先依据统一后端代码制定字段和登录适配方案。

连接成功后按 `docs/TEAM_SETUP.md` 完成表结构审核与写入配置，再运行 `npm start`。团队模式的确认字段默认留空，此时登录也被阻止，因为登录本身需要写会话和限流记录。不要对共享库运行 `db:init`、`db:seed` 或集成测试。

数据库密码用于后端连接数据库；网页登录仍使用 `hr_user` 表中的 HR 账号，两者不是同一个账号。

## 本次界面修改

- Pending Review 使用 `#/applications/pending-review`；旧的 `#/applications/applications-review` 链接仍可打开，并统一到新路径。
- 左侧 Applications 仅保留一个主入口，删除展开箭头和四个分类子菜单；在右侧申请列表的状态筛选中切换分类。
- 申请头像/姓名直接打开简历；审核操作位于列表右侧，状态、职位及搜索筛选位于左侧。
- 删除正文重复标题与多余详情、活动快捷按钮；顶栏保留可点击的当前位置路径，返回列表时保留筛选和页码。
- Move to Interview 直接收集预约信息，保存后无需再进入另一个页面安排面试。旧的 Interview 申请没有预约时仍可补排；已有预约直接打开实际面试，继续改期、取消或记录反馈。
- 保存拒绝、Offer、面试及邮件草稿后在原页提示结果，不强制跳到成功页、面试列表或草稿箱。
- 简历连续滚动，右侧直接显示 Job Description 和独立的 8–12 条实质 Job Requirements，部门、地点等另列 Job Information。
- Interview Results 使用独立页面，在同页查看简历、反馈与决策操作。
- Interviews 列名改为 Applicant 和 Interview Status，职位放在申请人信息下方。
- 学历等条件统一保留为 Job Requirements 的文字，由 HR 查看简历后决定；接收申请及编辑资料不显示学历、专业、毕业日期的录入项。

本版 119 项自动测试、两组独立临时 MySQL 测试及完整 HTTP 招聘流程检查通过。邮件是否真实发送取决于邮件配置；当前本地预览配置只生成未发送草稿。小组统一登录及共享数据库字段对接仍未完成。

## 五年自动清理

进入 Offer 或 Rejected 时记录开始时间；满五个日历年后，在服务启动和每小时任务中删除申请及其关联记录。服务需要保持运行；停机期间错过的清理在下一次启动执行。

同一候选人仍有其他申请时保留其资料和简历。其他阶段、HR 账号、职位和邮件模板不在这条清理规则内。正在交给邮件服务器发送的记录先暂缓，避免破坏发送事务。细节及备份限制见 `docs/RETENTION.md`。

## 常用命令

| 命令 | 用途 |
|---|---|
| npm run start:local | 用 .env.local 启动本地后端与网页 |
| npm start | 使用 .env 配置启动（当前小组结构尚未对接） |
| npm run dev | 开发模式，修改后端后自动重启 |
| npm run db:check | 只读检查数据库连接和所需字段 |
| npm run db:init | 本地创建或升级结构与初始账号 |
| npm run db:seed | 仅向空的本地库添加虚构演示数据 |
| npm run db:migrate | 由协调人显式执行审核过的共享库结构迁移 |
| npm test | 无外部数据库的自动测试 |
| npm run db:preview-requirements:local | 预览旧默认演示职位的要求升级 |
| npm run db:upgrade-requirements:local | 更新匹配的本地旧演示要求，保留自定义内容 |
| npm run test:jest | 同一组测试的 Jest 入口 |
| npm run test:integration | 仅限本地，创建并清理独立临时测试数据库 |
| npm run db:backup | mysqldump 备份；支持验证 CA 和主机身份的 TLS |

## 关键文件

| 文件 | 作用 |
|---|---|
| dist/app.js、views.js、review.js、hr-extra.js | 导航、列表、简历/结果页面与交互 |
| dist/layout.js、workspace.css | 固定工作区、表单布局、手机菜单与整页简历 |
| dist/state.js | 共享业务规则、职位要求验证与状态进入时间 |
| dist/screening.js | 旧数据兼容工具；不参与当前招聘决定或操作拦截 |
| dist/job-requirements.js | 岗位要求模板和条数、重复、长度检查 |
| server/eligibility-schema.cjs | 学历、专业、毕业日期、职位条件的安全升级与启动检查 |
| server/retention.cjs | 五年计算、迁移、关联数据清理 |
| server/config.cjs | 本地或团队配置、CA 证书验证、写入模式 |
| server/app.cjs | API、权限边界及团队只读保护 |
| server/index.cjs | 服务启动及定时任务 |
| database/schema.sql | 本模块完整表结构 |
| docs/TEAM_SETUP.md | 小组配置与迁移步骤 |
| docs/TESTING.md | 本次实测结果及尚未完成的外部验证 |

真实 `.env` 和个人配置压缩包只在本机保存，不要放入 GitHub。源码中的 `.env.example` 与 `.env.local.example` 均只有占位符。
