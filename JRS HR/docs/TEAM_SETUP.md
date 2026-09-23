# 小组数据库配置与交接

## 本次连接状态

2026-09-20，使用所提供的主机、端口、数据库、Junye Shen 的个人开发账号和 CA 尝试只读连接，返回 ENOTFOUND。环境文件与说明里的主机名一致；问题发生在 DNS 解析阶段，尚未到密码验证或表结构查询。需要数据库负责人确认 Aiven 服务仍运行，以及连接地址是否变化。

本包已实现 MySQL TLS CA 和主机身份验证，没有关闭证书校验。连接恢复后先运行 `npm run db:check`。该命令不初始化、不插入、不删除数据。

## 两个交付包

- 源码包：完整可编辑代码、CA、配置示例、迁移和测试，不包含真实密码或 node_modules。
- 个人配置包：仅包含给 Junye Shen 配好的 `.env`。解压到项目根目录；不可提交到 GitHub。

这个项目通过 `node --env-file=.env` 读取根目录配置，不使用另一个项目约定的 `server/.env`。

| 配置 | 本模块处理方式 |
|---|---|
| DB_HOST / DB_PORT / DB_NAME | 使用小组提供的服务信息 |
| DB_USER / DB_PASSWORD | 使用 dev_shenjunye 的个人凭据 |
| DB_SSL_CA | 支持多行 PEM 或项目根目录相对路径，本包使用 certs/jrs-ca.pem |
| INTEGRATION_MODE=team | 强制 TLS，禁用本地初始化和示例导入 |
| DB_WRITE_CONFIRMED / DB_SHARED_INTEGRATION_CONFIRMED | 默认空；两项都等于 DB_NAME 才启用写入和后台任务 |
| MAIL_MODE=preview / MAIL_ALLOW_SMTP=false | 保持邮件草稿，禁止真实发信 |
| TEAM_AUTH_ADAPTER | 未提供统一登录实现，非空值会明确报错，不会假装已整合 |
| TEAM_LOGIN_URL | 当前未自动跳转到其他团队服务 |
| SESSION_SECRET | 当前项目使用数据库会话与随机令牌，不需要此项 |
| UPLOAD_DIR | 当前简历和邮件附件存 MySQL，不写本地上传目录 |

## 结构审核与迁移

共享连接成功并不意味着两个项目的数据模型完全一致。本包要求 `database/schema.sql` 中的 `hr_*` 表；`db:check` 会列出缺失字段。它只检查必需字段，不代表跨模块外键、数据归属、枚举和业务约定已经完成整合。

1. 协调人比较小组已有表结构与本包 schema.sql、docs/API.md、server/retention.cjs。若同名表字段含义不同，应先做专门映射，不要直接运行迁移。
2. 对已确认兼容的结构，迁移会创建缺失的表、工作区和默认邮件模板；为旧 hr_application 添加 retention_started_at，并根据已有日期回填。不会导入示例申请、删除申请或创建 HR 登录账号。
3. 协调人在本机临时配置 MIGRATION_DB_USER、MIGRATION_DB_PASSWORD，以及与 DB_NAME 完全相同的 DB_SCHEMA_CONFIRMED，执行 `npm run db:migrate`。不要将迁移账号改成运行时 DB_USER，也不要把迁移密码交给前端。
4. 再次运行 `npm run db:check`。确认共享库的 HR 登录账号、角色、密码格式和其他模块的数据写入规则符合当前实现。
5. 完成审核后，把 DB_WRITE_CONFIRMED 和 DB_SHARED_INTEGRATION_CONFIRMED 都设置为 DB_NAME 的值，重启。启动会执行五年到期清理，此后每小时检查。

默认确认字段留空时，登录 POST 也会返回 TEAM_READ_ONLY，因为它会创建会话与限流记录。此模式用于连接诊断，不是可登录的只读业务界面。

## 统一后端的边界

当前 HR 项目依旧用 Express API 和 hr_user 数据库会话。没有统一后端源码或已实现的身份适配器，不能仅靠复制 .env 就完成单点登录和跨模块整合。不要让浏览器直接连接 MySQL。

其他模块若直接写 hr_application，应遵循相同的工作区锁、revision、状态及 retention_started_at 规则。建议通过 HR API 执行业务操作。这个约定和共享外键需由小组共同确认。
