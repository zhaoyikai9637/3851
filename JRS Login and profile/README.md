# JRS 统一登录与求职者模块

注册、求职者/HR统一登录、退出、求职者资料及私有简历已实现。完整JRS HR工作台在同一服务的 /hr/ 下接入。实际API代码集中在 [server/api.js](server/api.js)，接口说明见 [API.md](API.md)。

## 启动

VS Code打开当前目录，在本目录执行：

```powershell
npm ci
Copy-Item .env.example .env
# 在本地填写数据库连接、会话密钥和可选SMTP配置
npm start
```

浏览器打开 http://localhost:3001/pages/login/login.html 。使用Node.js 22.12或以上版本（支持file-type依赖）。数据库须为MySQL；将团队提供的CA证书保存为本地jrs-ca.pem，保持TLS验证开启。真实配置、证书、账号密码及上传文件不随代码发布。不要通过Live Server执行业务流程。

## 角色与数据

公开注册始终创建candidate。统一登录按服务器返回的角色跳转：candidate进入Profile，hr进入HR工作台。两类接口由后端鉴权和CSRF保护，HR账号需关联有效HR_USER身份。HR改密码使用统一账号；邮件找回密码目前只处理求职者。

求职者Jobs、My Resume和Application Status仍是静态展示页。HR工作台使用独立的jrs_portal_hr_表，目前不自动同步求职者模块的招聘记录。HR邮件发送保持关闭，不自动运行留存清理。

## 目录

- client/：求职者前端与展示页
- server/api.js：实际统一账号及Profile接口、HR挂载入口
- server/app.js：中间件、鉴权和应用组装
- integrations/hr/：HR原工作台及适配代码
- migrations/：候选人与HR表结构SQL
- scripts/：迁移、测试数据、备份及验证工具
- tests/：项目自动化测试
- docs/：模块接入说明及截图

## 数据库维护

团队现有云库的候选人17步和HR21步迁移已完成。连接该库时先只读检查，不要重复建库或导入旧SQL：

```powershell
npm run db:check
npm run hr:check
```

新环境需要由维护者审阅SQL、备份并确认目标库后执行迁移。普通运行账号不使用迁移管理员。scripts/seed-candidates.js、scripts/seed-hr.js可在显式指定目标库后新增虚构测试账号，遇到现有账号时跳过；生成的随机密码只保存在本机.local-backup中。不要把私有凭据文件发到GitHub。

npm run demo使用独立本机Docker演示库，不能用于查看团队云库的新HR账号。

## 验证

```powershell
npm test -- --runInBand
node --test integrations/hr/tests/backend.test.cjs integrations/hr/tests/http.test.cjs integrations/hr/tests/mail.test.cjs integrations/hr/tests/retention.test.cjs integrations/hr/tests/workflow.test.cjs integrations/hr/tests/frontend.test.cjs
```

最近验证：项目12套69项、HR后端/HTTP/业务47项及HR前端12项通过。真实云库与浏览器验证过经理/职员登录、HR工作台与资料、退出及求职者Profile回归。上述测试不代表所有跨成员模块已经完成联调。
