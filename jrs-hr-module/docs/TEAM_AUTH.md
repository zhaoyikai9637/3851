# 团队登录接入边界（2026-09-09）

用户明确：登录由组员负责；组员尚未实现。因此本模块已删除账号密码表单、
POST /api/auth/login、密码校验服务与对应前端方法，不创建替代登录系统。
没有自动登录、临时角色切换或客户端指定 HR ID 的放行入口。

## 当前打开页面时会发生什么

React 启动时读取 GET /api/auth/config 和 GET /api/auth/me。
已有可信团队身份且映射到 ACTIVE HR 时，直接显示当前路由的通知/模板/日志/资料。
无身份返回 401，显示团队入口；地址尚未配置则明确提示，不生成假的 /login 路由。
“Check sign-in status”会重新检查身份并保留原来要访问的页面。
现阶段正常启动看到尚未接入提示是预期结果，不是 Node、MySQL 或 Vite 启动失败。

本地 server/.env 可在组员完成后补以下配置，目前留空即可：

~~~dotenv
TEAM_LOGIN_URL=
TEAM_AUTH_ADAPTER=
~~~

- TEAM_LOGIN_URL：组员真实登录页面的完整 http/https 地址；生产须 https，不能带账户密码。
  登录成功回到本模块的 URL/参数需要双方约定，本模块不假定 returnTo 的参数名字。
- TEAM_AUTH_ADAPTER：相对于 server/ 的本地 JS 适配文件，或本地绝对路径。
  只能在可信服务端配置；不是浏览器参数，也不接收远程脚本 URL。
- GET /api/auth/config 只返回 loginUrl 和 adapterConfigured。后者仅表示适配器已登记，
  不能证明团队接口可用或联调完成。配置路径、凭据、用户 sessionId 不返回浏览器。
- 保持现有 INTEGRATION_MODE=standalone 和专用数据库保护。设置团队登录地址不要求
  改用团队数据库；不能通过切换 team 模式来跳过数据库检查。

## 给组员的适配契约

本模块在 server/src/team-auth.js 中加载适配文件导出的
createIdentityAdapter({ config, models })，返回以下两个方法：

1. resolve(req)：每次受保护请求都验证团队 Cookie/session 或正式约定的令牌。
   未登录/过期返回 null；验证成功返回下面的对象。网络或验证失败必须拒绝，不能回退为演示 HR。
2. logout(req, res)：撤销当前上游会话并清理它的 Cookie，成功后才 resolve；失败抛错。
   不自行发送响应、不重定向。HR 模块随后清除自身会话、返回 204，前端跳转团队登录页。
   如果上游退出失败，HR 模块报告失败，不能仅清除页面后宣称已经退出整个系统。

~~~json
{
  "subject": "verified-team-user-key",
  "sessionId": "stable-verified-session-key",
  "hrUserId": 1,
  "role": "HR"
}
~~~

上面的身份对象是接口示例，不是可提交来取得权限的请求。
subject/sessionId 必须来自服务端验证，不能是未经签名校验的 JWT 内容或任意请求头。
sessionId 应是本次上游登录会话的稳定标识，重新登录/换账号后改变；不要传原始令牌。
hrUserId 是经可信映射得到的 HR_USER.userId（目前正整数，最大 2147483647）。
HR_USER.role 是岗位展示名称，不能作为权限凭据；权限角色只接受验证后的 HR。
每个受保护请求还会从数据库重查 HR_USER.accountStatus=ACTIVE。

当前前端通过同源 /api 和 credentials=same-origin 传 Cookie。尚未实现跨域 Cookie、
JWT 获取/刷新或共享团队 session 存储；这些需要收到组员实际实现后对齐。
仅设置登录链接不会让两个独立系统自动共享登录状态。

本模块 Cookie 改为 jrs.hr.sid，存储 CSRF 和身份绑定摘要；其本身不代表认证。
GET /api/auth/me 验证上游后绑定并轮换本模块 Cookie/CSRF。
POST/PATCH/PUT/DELETE 必须附 x-csrf-token，Origin 与 APP_ORIGIN 一致；换账号后的旧
token 不能写入，新身份需先刷新 /me。Logout 会先调用团队撤销，再销毁模块会话。

## 数据与测试边界

MODULE_ACCOUNT 表、已有数据与旧种子兼容代码保留，避免删除数据库内容。
运行中的认证不再查询这些密码账号；SEED_PASSWORD 只用于旧种子兼容，不再用于页面登录。
My Profile 的最近登录时间不再由本模块模拟更新，后续由团队可信数据同步。
没有执行新迁移、DROP/ALTER、旧 SQL 或改动团队数据库。

server/tests/helpers/team-identity.js 是只供测试进程使用的可信身份夹具，不能从普通
启动入口访问；它没有 HTTP 登录接口，不代表组员的实际登录实现。
Supertest、MySQL 和浏览器测试使用该夹具验证 HR 模块；浏览器另外启动一个临时的
团队入口目标页，只验证跳转，结束时关闭。业务 API 使用真实 Express + 专用 MySQL。

实际结果：npm.cmd test 当前后端 157 + 前端 38 全通过；npm.cmd run test:mysql 12 项通过；
npm.cmd run build、npm.cmd run docs:export 成功。浏览器 14 项检查、23 张截图、0 错误。
API/Postman 详细流程及本地环境说明见 docs/API_TESTING.md。
真实团队登录、上游撤销接口、HR 主键映射和 Postman GUI 联调仍未完成。

下一步等待组员给出登录地址、身份验证和退出接口、身份到 HR 的映射规则，
再填写适配文件和配置，验证“组员登录 → HR 页面 → Logout → 无法重新访问”。
