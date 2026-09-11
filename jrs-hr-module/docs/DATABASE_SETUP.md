# 专用 MySQL 数据库

2026-09-09 用户明确同意新建，并在本机运行 scripts/setup-local.mjs，隐藏输入管理密码。
随后以专用账号核对：两个库均为 0 张表；MySQL 26.7.0，127.0.0.1:3306。

| 用途 | 新库 | 专用账号 |
|---|---|---|
| 开发 | jrs_hr_module_dev_20260908 | jrs_hr_module_dev |
| 测试 | jrs_hr_module_test_20260908 | jrs_hr_module_test |

凭据只在 server/.env、server/.env.test。管理密码未保存；两个应用账号的密码不同，
权限分别仅限各自精确库名的 SELECT/INSERT/UPDATE/DELETE/CREATE/INDEX/REFERENCES，
没有全局、DROP、ALTER 权限。localhost 和 127.0.0.1 条目只用于本机连接。
DB_WRITE_CONFIRMED 与实际 DB_NAME 完全一致，MAIL_MODE=preview、MAIL_ALLOW_SMTP=false。
没有操作团队数据库、旧 SQL、sync force/alter 或真实邮件。

## 初次建库工具

node scripts/setup-local.mjs 仅用于首次创建。现在已经建好，不要再次运行。
工具拒绝已有环境文件、同名库和同名账号；在 DDL 前独占写入本地生成凭据，
部分失败会保留已建对象及配置用于诊断，不自动删库或覆盖密码。
GRANT 对下划线的处理根据 partial_revokes 设置选择，避免误授通配库名权限。
参考 [MySQL GRANT 文档](https://dev.mysql.com/doc/refman/8.4/en/grant.html)。

## 首次迁移问题和已完成的恢复

开发库首次迁移建好 HR_USER、MODULE_ACCOUNT、MODULE_SESSION 后，在索引步骤报
ALTER command denied。Sequelize addIndex 发出 ALTER TABLE；改为 CREATE INDEX
后，原有 INDEX 权限即可完成，不需要扩大账号权限。

先在全新的测试库成功迁移并验证，再运行一次：

    node scripts/recover-initial-index.mjs --resume-20260909-index-failure

恢复工具只允许本次精确开发库名、主机和端口，要求恰好 3 张空模块表和空 metadata，
逐列、索引、FK 与已测试的完整测试库比对，拒绝额外触发器。保留这 3 张表，仅创建
缺失的表和索引；完成结构比对后才记录 001-module。现在库已完整，该恢复命令会拒绝
再次运行。常规迁移仍拒绝不完整/未知结构。没有删表、重建已有表或清除数据。

## 日常开发

```powershell
Set-Location 'E:\textProject\jrs-hr-module'
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run test:mysql
npm.cmd run dev
```

迁移复跑为空操作，种子复跑保留编辑和密码。初始演示账号为 hr1@example.test、
hr2@example.test，密码取对应本地环境文件的 SEED_PASSWORD；开发/测试种子密码不同。
人员、邮件、职位均为虚构数据，成功样例有 isDemo=true 与 SIMULATED 标记；PREVIEW
没有 sentAt。测试会保留带 Test/QA 标识的测试记录，不执行 DROP/TRUNCATE。

真实 MySQL 测试现为 9 项通过：类型、可空性、PK/FK 动作、唯一约束/索引、迁移复跑、
种子稳定性、归属限制、新连接已读持久化、软删除后的历史快照、UTC+08 发送日期边界、
数据库会话及并发头像替换。完整命令和结果见 VERIFICATION.md。
