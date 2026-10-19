# JRS 独立整合工作区

本目录为 `E:\textProject\JRS`，不替换原来的 `E:\textProject\jrs-hr-module`。
仅用于本机开发与联调，不是生产部署版本。

## GitHub 目录与分支

仓库 main 只保留 `JRS/` 整合项目；克隆后先进入 `JRS/` 再执行下方命令。
`team-files` 保存整理前 main 的所有成员原文件和报告，历史未删除。
其他分支按用途命名：`hr-login`、`hr-notifications`、`profile-cleanup`、
`login-profile`、`project-structure`，改名时不改变各自的提交历史。
私有配置、本机数据库、上传文件、依赖及生成的构建产物不上传。

## 当前模块边界（2026-10-19）

| 目录 | 用途 | 默认运行 |
| --- | --- | --- |
| `JRS Login and profile` | 郑晨竣：统一登录、求职者个人资料 | 是 |
| `jrs-hr-module` | 赵易凯：HR 外框、通知、邮件模板、发送记录、HR 资料 | 是，保留当前本地 UI |
| `JRS HR` | 团队 HR 招聘业务，通过适配层嵌入上述 HR 外框 | 是 |
| `JRS job-management` | 旧职位/面试模块原文件 | 保留，不启动重复 SQLite 后端 |
| `JRS Applicant Portal` | 司寰嘉：求职、简历、申请模块，**尚未定稿** | **否，独立保留** |

郑晨竣的目录原名为 `毕设前端代码`，已按提交
`940a7da43139f12384917e3f3f05bed7c988e84d` 更新命名。
同时采用最新 `profile.html`、`profile.js`；个人资料页不再混放简历上传。
整合专用的统一会话和 HR 路由适配继续保留。

默认求职者登录进入郑晨竣的 Personal Profile；HR 登录进入 `/hr/`。
郑晨竣保留的 Jobs、My Resume、Application Status 静态页面仍是原有演示页面，
不能据此认为真实投递流程已经完成。司寰嘉最终版到齐前，不把该模块作为正式投递入口。

## 本机启动

双击根目录 `start-jrs.cmd`，或在此目录执行：

```powershell
npm.cmd start
```

入口：<http://localhost:3100/>。本机登录资料在忽略提交的 `.local/accounts.json`，
密码是本机新生成的密码，不是云数据库账号密码。不要分享或提交该文件。

已经配置独立 MySQL 实例：`127.0.0.1:3307`；数据位于本目录 `.local/mysql`。
启动器只启动这一独立实例，不改变原来的 3306 服务。云端资料仅以只读方式获取，未写云库。
开发库为 `jrs_integrated_dev_20261019`，自动测试使用独立测试库，不向开发库制造测试申请。

修改 HR 前端后执行 `npm.cmd run build`。默认只构建 HR，不依赖求职者模块的产物。
首次在其他电脑部署还需要本机 MySQL 初始化、私有 `.env` 和经授权的 HR 资料导入；
本工作区不是无需配置即可联网部署的安装包。

## 司寰嘉模块：仅供显式实验联调

源码完整保留在自己的目录，适配代码为 `server/applicant-data.mjs`、
`server/applicant-facts.mjs`，路由接入独立在 `server/experimental/applicant.mjs`，
由 `server/runtime.mjs` 的实验开关按需加载。
默认不导入其服务、不挂载 `/applicant-api` 和 `/applicant/*`，HR 写入也不更新它的业务表。
此前独立开发库中的联调数据保留，不作为真实业务数据迁入云端。

只有开发者主动设置 `ENABLE_EXPERIMENTAL_APPLICANT_PORTAL=true` 并执行
`npm.cmd run build:experimental` 后，才可启动其原有联调入口。
此开关不是完成验收的标志，最终版仍需重新核对接口和数据。

## 验证命令

```powershell
npm.cmd test
npm.cmd run test:workflow
npm.cmd run test:experimental
npm.cmd run build
```

`test:workflow` 检查默认隔离、登录/资料/HR 可用和 HR 数据不会写入求职者表。
`test:experimental` 显式开启实验模块，仅验证已有投递联调适配，不代表司寰嘉最终版验收。

已知遗留问题：旧 `JRS job-management` 有 11 项测试引用不存在的导出，
编辑职位脚本混有面试列表逻辑；原文件保留，未将其失败算作通过。
生产 SMTP、真实邮件送达、完整招聘业务验收和云端部署尚未完成。

## 本次验证结果（2026-10-19）

- 根项目单元测试：14/14；默认流程隔离：1/1；显式实验联调：2/2。
- 郑晨竣模块 Jest：12 套件，69/69。
- HR 前端 Vitest：69/69；HR 后端 Vitest：183/183。
- HR Jest：5 套件，73/73；独立 MySQL 回归：12/12。
- 默认 HR 生产构建成功。
- 原工程源文件 SHA-256 清单与操作前完全相同。
- 浏览器已打开 HR 通知中心，显示原 HR 外框和当前本机 HR 身份。

上述结果不覆盖旧职位模块的 11 项遗留失败，也不代表最终求职者模块验收完成。
