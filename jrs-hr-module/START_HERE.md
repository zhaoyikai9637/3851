# 从 ChatGPT 迁移到 VS Code Codex

原始交接日期：2026-09-08；最新状态：2026-09-09 已移除本模块登录，保留业务功能并通过回归。
当前原工程在 E:\textProject\jrs-hr-module，专用数据库已经建好。
现在直接在这个目录运行 npm.cmd run dev，访问 http://localhost:5173。
当前会提示团队登录未接入；对方尚未实现。无需输入演示账号密码。
后续使用组员的登录页面；具体身份/退出适配说明见 docs/TEAM_AUTH.md。
无需再次解压、新建另一个工程或重跑数据库初始化。最新说明见 README、docs/HANDOFF。

以下保留最初迁移到新机器的说明，仅在确实换机器时参考。

这个包迁移的是“当前文件 + 项目背景 + 剩余计划”，不是 ChatGPT 的原生
聊天记录数据库。登录同一账号不代表 VS Code 中会出现原聊天及其所有附件。
无需为了继续项目而复制整段历史；重要决定已整理成可读取的项目文件。

## 1. 在 Windows 放好文件

1. 下载 `jrs-hr-module-codex-handoff.zip`。
2. 右键 ZIP → 全部解压，选择一个新的文件夹，避免覆盖已有工程。
3. 例如解压到 `E:\Projects`，最终项目根目录是
   `E:\Projects\jrs-hr-module`。E 盘只是示例，可换成你的实际位置。
4. 根目录应能直接看到 `AGENTS.md`、`START_HERE.md`、`package.json`、
   `client`、`server`、`docs` 和 `reference`。不要只打开 `server` 子文件夹。

## 2. 在 VS Code 接手

1. VS Code → 文件 → 打开文件夹，选择上面的项目根目录。
2. 打开已经安装的官方 Codex 扩展并登录，创建一个新对话。
3. 打开 `NEXT_PROMPT.txt`，复制全文发给 Codex。
4. 先让它读取项目说明、核对现状，再按计划实施；不必重新搭一套工程。
5. 如果它需要读取 Figma，插件连接可能需要在新环境单独配置。本包包含
   原始文档、ER 图和界面截图，可供读取；不能声称这等于完整 Figma 图层。

`AGENTS.md` 是给 Codex 的项目说明入口；长背景放在 `docs/HANDOFF.md`，
具体任务与验收放在 `docs/PLAN.md`，新对话提示放在 `NEXT_PROMPT.txt`。

## 3. 先检查环境，不要立即导入数据库

可在 VS Code 的“终端 → 新建终端”中逐条检查：

```powershell
node --version
npm --version
git --version
```

现有清单选择 Node 24.x。MySQL Server 才是真正的数据库服务，Workbench
只是管理工具；Workbench 能打开并不等于 MySQL Server 已运行。

当前缺少前端入口、OpenAPI 文件、种子脚本和测试，直接运行 `npm run dev`
不能得到完整网站。先让 Codex 修复/补齐，再由它给出经过验证的运行步骤。
不要执行 `reference/legacy-sql/` 中的旧脚本来尝试修复启动问题。

## 4. 下载和权限

安装依赖时，核对 Codex 发起的命令和下载域名，再在实际授权界面批准。
目前预期主要涉及 `registry.npmjs.org`（依赖）和 `www.figma.com`（设计素材）；
其他域名应说明用途后按需授权。安装依赖可能执行第三方安装脚本，权限应限于
本工程。聊天中的“我允许”不能替代实际环境设置。

云端之前出现过“网络授权在结果返回前被取消”的错误。这不证明 Windows
本机也有相同限制，更不证明 Node.js/MySQL 已经安装在本机。
遇到组织管理策略或明确拒绝时先解决授权，不要改镜像或关闭全部保护绕过。

## 5. 数据和版本保护

- `server/.env.example` 是占位模板，不含可用账号。生成本地 `.env` 时不要把
  密码发到聊天或提交 Git。示例中的 root 用户应优先换成专用开发账号。
- 用新的开发数据库，不连接团队已有库或生产库；先核对主机和数据库名。
- 默认邮件模式是 preview；真实 SMTP 发送需另行配置和授权。
- `reference/` 包含你的姓名、学号和原始报告，已在本交接副本中 Git-ignored。
  它仍包含在下载包中，方便本地接手，不要把整个 ZIP 上传到公开仓库。
- 未自动建立 GitHub 仓库或推送任何代码；如以后推送，先检查待提交文件。

## 可迁移的内容与不能自动迁移的内容

| 已包含 | 需要在新环境另行处理 |
|---|---|
| 现有代码草稿、依赖声明、未验证的锁文件 | 本机安装结果和锁文件可复现性验证 |
| 项目范围、决定、已知问题、后续计划 | 本机 Node、MySQL、端口及数据库凭据 |
| 两份原始 Word 文档、7 张提取图片 | Figma 连接权限和最新图层/素材读取 |
| 早期 SQL 参考副本 | 原生 ChatGPT 对话历史和云端运行会话 |

## 官方说明

- [Projects and chats](https://learn.chatgpt.com/docs/projects)：IDE 按当前打开的
  文件夹获取项目上下文；普通 ChatGPT 对话不是 Codex 侧栏中的同一类对话。
  文档还介绍了从 New chat 添加已有 ChatGPT 聊天到 Codex 聊天的入口。
  这不代表 VS Code 会自动出现你的历史；具体入口以你实际使用的客户端为准。
- [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)：
  项目说明可以随源码保留，供后续 Codex 对话读取。
