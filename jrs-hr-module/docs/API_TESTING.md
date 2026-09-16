# API 文档与 Postman 操作说明

2026-09-09；当前仅本地 HR 模块。组员尚未完成登录，不把测试身份当作团队联调。
Swagger: http://localhost:5173/api/docs/ 。打开 Read own profile 等操作即可查看
请求字段、必填字段、成功/错误响应及英文虚构样例，不需要登录即可阅读文档。
点击 Try it out 执行受保护接口时，仍必须具备真实有效的上游身份。

## 自动检查

在 E:/textProject/jrs-hr-module 运行：

~~~powershell
npm.cmd test
npm.cmd run test:mysql
npm.cmd run docs:check
npm.cmd run docs:export
npm.cmd run build
~~~

docs:check 使用 Swagger Parser 校验 OpenAPI 3.0.3 文档结构，再用 Ajv 校验 JSON 示例。
外部文件/网络引用被禁止；不读取环境凭据。最新结果为 23 操作、332 处请求/响应
示例（共用的错误示例在各操作分别计数，不是 332 个不同接口或独立业务场景）。
OpenAPI 文档自身的 200 响应不嵌套整份文档；HTML/图片/下载不伪造 JSON 示例。
这不是对全部业务规则的形式化证明；业务边界另由 API/MySQL/浏览器测试覆盖。

docs:export 从 server/src/openapi.js 与 openapi-examples.js 生成：

- docs/openapi.json
- docs/JRS-HR.postman_collection.json
- docs/JRS-HR.postman_environment.example.json

请修改源文件再导出，不要手改生成文件。示例中的姓名、邮箱、ID 与全零 CSRF token
均为虚构；不是抓取的真实会话，也不能用来取得权限。

## Postman 当前可操作与后续步骤

1. 导入集合和 environment.example.json，选择本地环境。baseUrl/appOrigin 默认同为
   http://localhost:5173。也可配置同源部署，但必须与后端 APP_ORIGIN 一致。
2. 现在可以手动读取 Process health、auth/config、CSRF，以及离线查看各响应示例。
   受保护接口当前返回 401 是预期的；不要补回本模块 Login 来绕过它。
3. 组员登录可用后，按双方契约传入已验证的 Cookie/凭据，调用当前 HR 会话 /api/auth/me。
   脚本将 CSRF token 放入 pm.environment，Cookie jar 保留模块 Cookie。
4. 在本地环境中选择实际通知/日志/申请/附件 ID；空白 ID 是有意的，不能默认操作记录 1。
   请求右侧可启用类型、搜索、日期和分页查询参数。
5. Create template 使用动态唯一名字，避免复跑 409；响应保存 templateId/templateName
   到当前环境，后续编辑使用该名字。查看/编辑/删除仅选择本次创建的模板。
6. 上传先选 JPEG/PNG 文件（2 MB）；下载通过有权访问的附件 ID 获取真实文件。
   不要对 binary 响应调用 JSON.parse。204 成功没有响应正文。
7. 最后运行 Logout。成功时环境 token 清除，上游与本模块会话均应失效；再读 profile
   应为 401。上游 logout 失败时不能宣称整体退出成功。

token 不存进集合变量，实际值只用于未共享的本地环境，勿同步/导出带真实值的环境或
分享 Cookie。集合自带响应都是虚构文档示例。文件请求和写操作请按需手动执行；
不能把导入集合当作已经通过 Postman GUI 联调，也不建议整组直接自动运行。

## 身份、错误及日志语义

GET /api/auth/me 先依赖团队验证，本身不要求先有 jrs.hr.sid；它会建立模块 CSRF 会话。
GET 保护接口中的 x-team-identity-required=true 与描述明确上游验证前置条件。
尚无团队传输契约，OpenAPI 不虚构一个团队 Cookie/header；read security=[] 不能解释为
允许匿名访问。写接口仍声明 jrs.hr.sid 与 x-csrf-token，两者都不能替代上游身份。
真实团队协议接入后，需把实际认证 scheme 加入 OpenAPI 并再次联调。

| 状态 | 含义与处理 |
|---|---|
| 400 | JSON 语法错误，返回固定 Malformed JSON body，不回显提交片段 |
| 401 | 缺少/过期的可信团队身份，回到组员登录 |
| 403 | HR 状态/权限、CSRF、Origin 或切换账号后的旧 token 被拒绝 |
| 404 | 不存在或无权访问，附件文件丢失也会返回 JSON 错误 |
| 409 | 模板名称已占用（包括软删除） |
| 413 | JSON 正文超过 100 KB；文件大小限制的 Multer 错误使用 422 |
| 422 | 字段校验失败；fields 可定位出错字段，照片格式/大小错误也可用该状态 |
| 500/503 | 内部或上游服务失败，统一公开信息，不自动重放写入 |

成功日志只含 SENT 且 sentAt 非空，按 sentAt 筛选。isDemo=true 表示未实际发送的历史
示例；SMTP 接收提交也不是候选人已收到。时间戳为 UTC，日期过滤是 UTC+08 日界限。
头像是 JPEG；附件下载 MIME 根据文件类型变化，文档用 */* 二进制与 Content-Disposition。

## 当前证据与限制

- 后端 157、前端 38 项通过；新增负例会拒绝缺必填字段、错误类型和 PREVIEW 成功历史。
- 真实 MySQL 12 项通过；覆盖实际 HTTP JSON 与 OpenAPI 一致、4 个同时调用只建一条
  通知、同一邮件 eventKey 仅尝试一次。邮件适配是内存 preview，不接 SMTP。
- Postman 响应脚本已在 Node VM 的最小 pm 替身下验证环境写入/清理；这是脚本测试，
  不代表真实 Postman Cookie jar、GUI 或组员认证已完成验证。
- 真实 Edge 14 检查、23 截图、0 错误；截图含展开的 Swagger profile 样例。
- 真实团队登录/退出、Postman GUI、业务事件与附件写入/可见范围仍待对齐。

参考：[OpenAPI 3.0.3](https://spec.openapis.org/oas/v3.0.3.html)、
[Swagger Parser 选项与校验边界](https://apidevtools.com/swagger-parser/options.html)、
[Ajv 对 OpenAPI nullable 的支持](https://ajv.js.org/json-schema.html)、
[Postman 变量](https://learning.postman.com/docs/use/send-requests/variables/variables/)。
