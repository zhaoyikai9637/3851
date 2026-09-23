# JRS HR 更新版

版本 2.1.0 · 2026-09-20

本版调整 Applications 导航、移除独立 Candidates 页面，并为当前处于 Offer / Rejected 的申请增加五年自动清理。后端仍为 Node.js + Express，数据库为 MySQL。

## 先选择运行方式

**本地 MySQL 可完整运行，已经实测。小组 Aiven 连接配置已准备，但交付时主机解析失败 ENOTFOUND，因此尚未验证远程表结构、账号登录及联合模块运行。**

### 使用你现有的本地数据库

1. 解压源码包到新目录，在 VS Code 打开含 package.json 的目录。
2. 运行 `npm install`。
3. 把旧项目的本地 `.env` 复制到此目录。保持 DB_HOST 为 localhost / 127.0.0.1，添加 `INTEGRATION_MODE=local`。如果新建配置，复制 `.env.local.example` 为 `.env` 并填写自己的本地密码。
4. 运行 `npm run db:init`，更新缺失的表字段并回填保留期。它不会直接执行五年删除，不重置已有密码。
5. 如果数据库完全为空、且需要演示数据，才运行 `npm run db:seed`。已有数据时跳过。
6. 运行 `npm start`，打开终端显示的地址；默认本地 http://localhost:3000。

已有数据库在启动本版前应确认 `docs/RETENTION.md` 的清理规则。启动后将立即清理已超过期限的记录。编辑 Offer 不会重新计算五年。

### 使用小组 Aiven 数据库

源码包不含密码。把随附的个人配置包解压到项目根目录，得到 `.env`；CA 已在 `certs/jrs-ca.pem`。该配置使用 Junye Shen 的个人数据库账号，不包含其他组员或迁移账号密码。

```powershell
npm install
npm run db:check
```

`db:check` 只检查连接和所需表字段，不写数据。交付时返回 ENOTFOUND，需先由数据库负责人确认 Aiven 服务状态和当前主机名。

连接成功后按 `docs/TEAM_SETUP.md` 完成表结构审核与写入配置，再运行 `npm start`。团队模式的确认字段默认留空，此时登录也被阻止，因为登录本身需要写会话和限流记录。不要对共享库运行 `db:init`、`db:seed` 或集成测试。

数据库密码用于后端连接数据库；网页登录仍使用 `hr_user` 表中的 HR 账号，两者不是同一个账号。

## 本次界面修改

- 点击 Applications 旁的小箭头展开或收起分类。
- Pending Review、Interview Results、Rejected、Offer 直接打开对应列表，支持刷新、前进与后退。
- 删除原顶部四张工作流卡片和重复的状态筛选。分类列表不再显示重复 Workflow 列。
- 点击 Applications 主项可查看所有申请，包括 Interview 与 Hired；总列表保留 Workflow 列以区分状态。
- 删除独立 Candidates 导航及目录页面。点击申请中的姓名仍能看资料和上传简历，Start Review 保留 CV 与 Job Requirements 对照。

## 五年自动清理

进入 Offer 或 Rejected 时记录开始时间；满五个日历年后，在服务启动和每小时任务中删除申请及其关联记录。服务需要保持运行；停机期间错过的清理在下一次启动执行。

同一候选人仍有其他申请时保留其资料和简历。其他阶段、HR 账号、职位和邮件模板不在这条清理规则内。正在交给邮件服务器发送的记录先暂缓，避免破坏发送事务。细节及备份限制见 `docs/RETENTION.md`。

## 常用命令

| 命令 | 用途 |
|---|---|
| npm start | 启动后端与网页 |
| npm run dev | 开发模式，修改后端后自动重启 |
| npm run db:check | 只读检查数据库连接和所需字段 |
| npm run db:init | 本地创建或升级结构与初始账号 |
| npm run db:seed | 仅向空的本地库添加虚构演示数据 |
| npm run db:migrate | 由协调人显式执行审核过的共享库结构迁移 |
| npm test | 无外部数据库的自动测试 |
| npm run test:jest | 同一组测试的 Jest 入口 |
| npm run test:integration | 仅限本地，创建并清理独立临时测试数据库 |
| npm run db:backup | mysqldump 备份；支持验证 CA 和主机身份的 TLS |

## 关键文件

| 文件 | 作用 |
|---|---|
| dist/app.js、views.js、styles.css | Applications 导航、分类页面和交互 |
| dist/state.js | 共享业务规则与状态进入时间 |
| server/retention.cjs | 五年计算、迁移、关联数据清理 |
| server/config.cjs | 本地或团队配置、CA 证书验证、写入模式 |
| server/app.cjs | API、权限边界及团队只读保护 |
| server/index.cjs | 服务启动及定时任务 |
| database/schema.sql | 本模块完整表结构 |
| docs/TEAM_SETUP.md | 小组配置与迁移步骤 |
| docs/TESTING.md | 本次实测结果及尚未完成的外部验证 |

真实 `.env` 和个人配置压缩包只在本机保存，不要放入 GitHub。源码中的 `.env.example` 与 `.env.local.example` 均只有占位符。
