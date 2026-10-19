# 云库检查、目录对齐与原创内容（2026-10-07）

## 云库实际结果

以赵一凯个人数据库账号通过 TLS 和 CA 校验读取
`jrs_hr_module_dev_team`，在只读事务内执行精确 COUNT。

| 表 | 云库记录数 | 本地检查时记录数 |
| --- | ---: | ---: |
| HR_USER | 0 | 1 |
| CANDIDATE | 0 | 0 |
| JOB_POSITION | 0 | 0 |
| APPLICATION | 0 | 0 |
| EMAIL_TEMPLATE | 0 | 5 |
| SYSTEM_NOTIFICATION | 0 | 0 |
| NOTIFICATION_LOG | 0 | 0 |
| NOTIFICATION_ATTACHMENT | 0 | 0 |
| MODULE_ACCOUNT | 1 | 1 |
| MODULE_SESSION | 0 | 3 |

云库暂时没有可搬入的业务记录。唯一登录账号属于认证模块，不导出密码哈希、
不复制会话、不据此自动授予 HR 权限。此次云库写入为 0；保留本地 HR 资料和模板。
表结构与本模块的主要实体一致，但云库目前没有 HR 身份映射，不能仅切换连接
就宣称完成团队登录或端到端整合。

私有结构/数据快照保存于 `work/cloud-sync/`，受 Git 忽略保护。
后续使用以下命令重新读取，先检查再决定是否导入；不会自动覆盖本地记录：

```powershell
npm run db:cloud:inspect -- --team-handoff work/team-credentials/JRS_TEAM_DATABASE_CREDENTIALS.txt
```

其他工作站可使用私有 `server/.env.cloud`，配置 DB_HOST、DB_PORT、DB_NAME、
DB_USER、DB_PASSWORD、DB_SSL_CA_FILE（相对项目根目录的证书路径），然后执行
`npm run db:cloud:inspect`。凭据和快照不要提交到 Git。

## 与登录负责人约定的目录格式

项目根目录仍是 `jrs-hr-module`，各成员工程独立维护。

```text
jrs-hr-module/
  client/
    assets/css/styles.css
    assets/images/
    pages/notifications/Notifications.jsx
    pages/templates/Templates.jsx
    pages/logs/Logs.jsx
    pages/profile/Profile.jsx
    utils/
    src/                 # 路由、公共组件、功能组件与测试
  server/
    config/database.js
    config/runtime.js
    routes/hr.js
    data/original-content.json
    server.js
    src/                 # 服务、验证、模型、迁移与兼容入口
    tests/
  uploads/
  scripts/
  docs/
  package.json
  README.md
```

采用 React 页面文件而非复制组员的 HTML 登录文件。`server/src` 的三个旧入口
保留一行导出，供现有测试、迁移和组员引用继续使用。上传目录仍按本地环境配置
读取，避免移动已有照片后失效。

## 哪些内容属于你需要原创的部分

需要体现你模块设计的内容：邮件模板正文、通知文案、通知分类和交互规则、
个人资料可编辑范围、业务验收场景。候选人、职位、申请状态由负责招聘和求职者
业务的组员提供；真实账号、HR身份、邮件发送历史应由系统操作生成。

`server/data/original-content.json` 已为本项目编写：

- 五类英文邮件模板：面试邀请、Offer审阅、接受确认、申请结果、审核进度；
- 两类通知示例：新申请、状态变化；
- 一个明确虚构的 HR 资料示例，使用 `example.test` 邮箱。

内容由 AI 协助起草，供赵一凯审阅和修改，不应在报告中声称全部由本人独立手写。
只使用系统已有的四种变量，不编造薪资、时间、会议链接或候选人的真实资料。
实际面试时间和正式 Offer 由负责相应业务的模块提供。

原创模板使用独立 `JRS — ...` 名称安装到本地开发库，不覆盖原来的五个模板。
重复安装保留已有修改，不产生重复模板、不创建登录账号、不发送邮件。

```powershell
npm run content:install -- 1
```

通知与 HR 资料示例只保存在内容文件中，不冒充云库数据。
PREVIEW、PENDING、FAILED 不属于成功发送历史；不要手工伪造 SENT 记录。

## 原创验收场景

1. 新申请事件仅生成一次通知，HR打开摘要后可追踪相关申请。
2. 已读/未读操作刷新后仍保留；批量已读可撤销。
3. 模板四种变量全部替换；未知变量提示错误。
4. 编辑模板后，已有发送历史正文保持原始快照。
5. 邮件预览不进入成功日志，失败时可解释失败原因。
6. HR只能编辑姓名、电话、办公地点和照片，角色与员工编号由后端管理。
7. 退出后受保护接口拒绝访问，页面回到组员负责的登录入口。
