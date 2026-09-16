# 当前验证记录 — P7 API 契约，2026-09-09

开发仍在 E:/textProject/jrs-hr-module。测试只写已批准的独立测试库；未改团队库/表结构，
邮件使用内存 preview。没有恢复个人登录、自动登录、发布、GitHub 推送。

| 实际命令/检查 | 最终结果 |
|---|---|
| node --version / npm.cmd --version / npm.cmd ls --depth=0 | 24.16.0 / 11.13.0；依赖无缺失 |
| npm.cmd test | 退出 0；Vitest 4.1.11，后端 10 文件/157 项、前端 2 文件/38 项 |
| npm.cmd run test:mysql | 退出 0；专用 MySQL 12 项，含并发重复事件与实际 JSON 响应契约 |
| npm.cmd run docs:check | 退出 0；22 操作、316 处 JSON 示例，禁用外部引用 |
| npm.cmd run docs:export | 退出 0；OpenAPI + Postman 集合 + 空白本地环境 |
| npm.cmd run build | 退出 0；Vite 7.3.6，49 模块 |
| node scripts/browser-check.mjs（使用下文 NODE_PATH） | 最终退出 0；14 检查、23 截图、0 console/page 错误 |
| 隔离目录 npm.cmd ci --offline --cache ../npm-cache --no-audit --no-fund | 退出 0，373 packages；只复制清单和锁文件，不含环境文件 |
| 隔离目录 npm.cmd ls --depth=0 | 退出 0；确认前后端同用 Vitest 4.1.11 与原 Vite 7 |
| npm.cmd audit --json --cache ./work/npm-cache | 退出 1；2 moderate、0 high、0 critical，未声称审计清零 |

新增验证器仅是开发依赖：@apidevtools/swagger-parser 13.0.0、ajv 8.20.0、ajv-formats 3.0.1。
先核对 engines，再按实际权限安装；原锁文件备份在 work/before-api-contracts-20260909。
审计文件 work/audit-api-contracts-20260909.json 曾报告 4 moderate，其中新增识别的
Vitest/mocker 问题来自原有测试工具；升级前后端到 4.1.11 后，final 审计文件为 2 moderate。
详见 DEPENDENCIES，保留原有 Sequelize/UUID 风险，没有强制降级或改写团队数据。

过程失败均已处理：

- Postman 导出器第一次括号笔误阻止其测试导入：149 通过、1 suite 失败。修正后通过。
- 新文档测试误要求 Swagger HTML 页面也有 JSON 示例：156 通过、1 失败。改为尊重响应类型。
- 浏览器因保留的通知/历史跨页且有同标题而失去目标。进一步确认 ORM update 不会重置
  createdAt；改为每轮独立通知、内容/来源定位及真实日志搜索，最终完整流程通过。

316 是各操作中的示例条目数，共用错误会重复计数。Swagger Parser 负责结构校验，
Ajv 负责示例/响应数据；团队认证协议尚未提供，文档不捏造安全 scheme。
MySQL 并发测试用 4 个同时调用，断言一条通知/一次预览尝试；不是跨服务分布式事务证明。
Postman 脚本测试使用最小 pm 替身，不等于 Postman GUI/Cookie jar 实际联调。
浏览器仍使用仅限测试进程的上游身份，不能证明组员尚未完成的登录已经可用。
离线干净目录只检查安装与依赖树；本轮完整测试、构建和浏览器运行都在原工程。

---

# 历史验证记录 — 登录职责调整，2026-09-09

在原 E:/textProject/jrs-hr-module 完成。用户明确组员尚未实现登录，本轮删除自建
登录页面/API，保留团队身份接入位置与失败时拒绝访问。依赖和数据库结构未变更。

| 实际命令 | 最新结果 |
|---|---|
| npm.cmd test | 退出 0；后端 10 文件/150 项，前端 2 文件/38 项 |
| npm.cmd run test:mysql | 退出 0；专用测试库 9 项，真实 SQL/约束/持久化和模块会话 |
| npm.cmd run build | 退出 0；49 模块，最新 client/dist 不含账号密码表单 |
| npm.cmd run docs:export | 退出 0；OpenAPI/Postman 无本模块 login 操作 |
| node scripts/browser-check.mjs | 最终退出 0；14 项检查、22 张截图、0 浏览器错误 |

执行浏览器脚本前沿用下文 NODE_PATH，使用本机 Edge。最新截图与 results.json 在
work/browser-check；身份由 server/tests/helpers/team-identity.js 供测试进程发放，
没有新增 HTTP 登录后门。它不能证明尚不存在的团队登录接口已经集成。

新增回归覆盖：无适配器时拒绝伪造用户头/令牌、无密码接口、上游身份到 ACTIVE HR
映射、CSRF 与上游账号/会话绑定、换账号拒绝旧 token、退出失败保留状态、退出成功
撤销上游身份及清模块 Cookie、团队登录链接与退出跳转、缺配置提示、重试保留路由。
浏览器仍测试通知/模板/日志/资料/头像/附件/持久化，检查 390/768/1024/1440px。

首轮浏览器在返回 HR 页面后注入测试身份过早，React 已直接进入通知页面，等待重试
按钮超时；修正为明确等待初始未登录状态后注入，复跑通过。该失败保留在 failure.json。
测试故意模拟上游 logout 503 时出现 Request failed: Error，属于通过的负例。
最近一次回归并未更改依赖、重新安装、重新联网审计或做 Postman GUI 演练。
新的公开运行入口保持未接入提示；真实团队登录与退出验证等待组员实现。

---

# 历史验证记录 — 登录移除前，2026-09-09

在原 E:/textProject/jrs-hr-module 继续实施。用户已批准新建专用数据库；新建后先验证
两个库均为空。MySQL 26.7.0 / Node 24.16.0 / npm 11.13.0。以下结果取自真实执行。

| 命令/检查 | 当前结果 |
|---|---|
| node --check scripts/setup-local.mjs | 通过；初始化预检单测 6 项通过 |
| node scripts/setup-local.mjs | 用户在本机隐藏输入密码并完成；随后 SQL 核实两库各 0 张表 |
| npm.cmd run db:migrate 首次 | 失败：addIndex 发出 ALTER TABLE，专用账号没有 ALTER 权限 |
| CREATE INDEX 修复 + 单次结构核对恢复 | 成功，保留 3 张新建空表，没有清库或扩大权限 |
| npm.cmd run db:migrate 复跑 | 退出 0，空迁移列表 |
| npm.cmd run db:seed | 退出 0，两位虚构 HR、五类模板、通知及模拟历史 |
| npm.cmd run test:mysql | 退出 0，1 文件 / 9 项真实 MySQL 测试通过 |
| npm.cmd test（最终原工程） | 退出 0，后端 9 文件 / 133 项，前端 2 文件 / 35 项 |
| npm.cmd run build | 退出 0，49 模块，生成 client/dist |
| npm.cmd run docs:export | 退出 0，OpenAPI 和 Postman 集合已更新，无凭据 |
| node scripts/browser-check.mjs | 退出 0，14 项真实浏览器检查、22 张截图、0 浏览器错误 |
| 干净副本 npm.cmd ci --cache ../npm-cache --no-audit --no-fund | 退出 0，安装 365 packages |
| 干净副本 npm.cmd test / npm.cmd run build | 全部通过，当时 132+35 项；之后增加的附件 API 测试在原工程通过 |
| 干净副本临时服务启动 | CLEAN_INSTALL_STARTUP_OK，独立 node_modules + 专用测试库，HTTP health 200 |
| npm.cmd run dev + 真实代理登录退出 | Vite localhost:5173、API 127.0.0.1:3001，DEV_PROXY_LOGIN_AND_LOGOUT_OK |
| 本地真实凭据扫描 | 66 个源码/文档文件，0 匹配；跳过本地环境文件、参考件、上传、缓存与依赖 |

## 本阶段发现并修复的问题

1. 初始化未授 ALTER 权限，Sequelize addIndex 需要它。改用 CREATE INDEX 并在干净
   测试库验证；开发库部分状态以专用脚本核对后补完。详情见 DATABASE_SETUP。
2. 前端首个 build 因 option 标签笔误失败；修复后通过。
3. 首轮前端测试 29 通过/6 失败：模板默认选中依赖 effect，短暂挂载空表单。
   改为从列表直接推导初始选中项后 35/35 通过。
4. 手机日志页面有横向页面溢出；修复滚动容器定位，表格可独立横向滚动/键盘聚焦。
5. Helmet img-src 默认不含 blob，本地头像预览被拦截；只扩展图片来源，脚本限制保留。
6. 重启测试曾在旧页面仍请求头像时关闭服务，产生 2 次连接拒绝；测试先退出页面、
   再重启同一端口并回访，保留 cookie 验证数据库会话，最终 0 浏览器错误。
7. 本轮后段写权限范围变更，干净副本创建遇到 Access denied；未把 PowerShell
   的退出码 0 当作成功。经实际提权权限流程重新执行后成功，没有绕过沙箱。

## 测试边界

- 后端 133 项由原 124 项 + 初始化预检 6 项 + 头像清理 2 项 + 真实文件下载 1 项组成。
  Express/Supertest 测试使用独立 MemoryStore/mock 服务和真实临时图片/文件。
- 前端 35 项：9 项 API transport、26 项 RTL 交互。使用模拟 fetch，不能单独证明 SQL。
- MySQL 9 项真实验证：模型列/类型/可空性/PK/FK 动作、索引和唯一约束；迁移复跑；
  seed 稳定性；HR 归属；新连接已读持久化；模板软删除不改快照；UTC+08 sentAt
  边界；MySQL 会话与 CSRF/退出；并发头像替换的前驱引用。
- 浏览器不拦截 API、不使用 mock 数据库。脚本读取 .env.test，严格拒绝开发库，
  在临时本地端口启动真实 Express 和构建前端。每次将一个已知虚构测试通知置未读，
  再通过 UI 标记并刷新验证；模板/资料/头像/附件均实际读写专用测试库。
  测试账号和附件都是虚构，不发邮件；测试记录、截图和文件保留用于诊断。
- Edge 152.0.4191.66，检查 390/768/1024/1440px；没有实际手机设备或 Safari 测试。
  原始截图和 HTML/CSS 布局参考已读报告图片，未使用 Figma 连接。
- Swagger 页面实际渲染正常；Postman 集合与 token 更新脚本有自动验证，GUI 演练未做。
- 没有团队联调、SMTP 外发、网站发布、GitHub 推送。Sequelize/UUID 审计仍有 2 项
  moderate（无 high/critical），这是之前实际 audit 的结果，本轮未再次执行 audit。
- 普通头像替换会回收旧文件；进程崩溃/文件锁造成的离线孤儿清理仍是后续项。

## 浏览器验证命令

本机使用 Codex 随附的 Playwright 包和已安装 Edge：

```powershell
Set-Location 'E:\textProject\jrs-hr-module'
$env:NODE_PATH = 'C:/Users/zhaoy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
node scripts/browser-check.mjs
```

结果：work/browser-check/results.json。失败阶段记录 failure.json 为早期诊断，不代表
最新结果。干净安装副本不含 .env，启动检查只把原 .env.test 值传给临时进程，
没有复制密码文件；开发服务始终来自原工程。

---

## 2026-09-08 历史验证记录（以下不是当前状态）

范围：P0/P1 完成，P2 代码准备；不是完整网站验收。所有命令从
E:/textProject/jrs-hr-module 执行，除特别说明外。未连接或写入任何 MySQL 数据库。

## 环境与安装

| 命令或检查 | 实际结果 |
|---|---|
| node --version | v24.16.0 |
| npm.cmd --version | 11.13.0 |
| git --version | 2.53.0.windows.3 |
| git status --short | fatal: not a git repository；未初始化 Git |
| Get-Service -Name '*mysql*' | MySQL267 Running，仅服务状态 |
| 原清单/lockfile 逐 key 对照 | root、client、server 的 dependencies/devDependencies/engines 一致 |
| 原锁 npm.cmd ci --cache ./work/npm-cache --no-audit --no-fund | 退出 0，365 packages |
| npm.cmd install -w server nodemailer@10.0.1 sharp@0.35.4 --save-exact --cache ./work/npm-cache --no-audit --no-fund | 退出 0，定向更新高风险依赖，未运行 audit fix --force |
| 更新锁后的 npm.cmd ci --cache ./work/npm-cache --no-audit --no-fund | 退出 0，再次安装 365 packages |
| npm.cmd ls --depth=0 | 退出 0，无缺失/无效直接依赖 |
| npm.cmd audit --json --cache ./work/npm-cache | 退出 1，2 moderate、0 high、0 critical；详见 DEPENDENCIES.md |

原 Word 提取首次因 PowerShell 管道的 GBK 输出遇到 UnicodeEncodeError；给提取脚本
显式指定 UTF-8 后，两份 Word 正文完整读取。原文件未改动。报告 ER image1.png
无法正常解码，Pillow 报 image file is truncated；未将其当作完整可读 ER 图。
其余五张页面截图已查看。未取得 Figma 连接或图层导出。

## 测试和构建

| 命令或阶段 | 实际结果 |
|---|---|
| 原 createApp import | 退出 1，ERR_MODULE_NOT_FOUND: server/src/openapi.js |
| 创建 OpenAPI 后的首轮 npm.cmd run test -w server | 67 通过、5 失败：Unicode CSRF 返回 500；日志成功状态、时间和详情范围不足 |
| 修复 CSRF / 日志后的后端测试 | 72/72 通过 |
| 加入工作流、邮件和 SessionStore 测试 | 97/97 通过 |
| npm.cmd run test -w server，含 P2 保护/seed 与文档契约 | 退出 0，8 文件、124/124 通过 |
| 更新锁 npm ci 后的 npm.cmd test | 后端 124/124 通过；前端 No test files found，整个命令退出 1 |
| npm.cmd run build | 退出 1，Could not resolve entry module "index.html"；前端尚未实现 |
| node --input-type=module -e "import('./server/src/app.js').then(() => console.log('createApp import OK'))" | 退出 0，createApp import OK |
| npm.cmd run docs:export | 退出 0，生成 docs/openapi.json 和 docs/JRS-HR.postman_collection.json |
| npm.cmd run test:mysql | 未执行；等待新专用测试数据库确认及本地配置 |
| npm.cmd run db:migrate / npm.cmd run db:seed | 未执行；等待新专用数据库确认 |

## 124 项后端测试组成与边界

| 文件 | 数量 | 覆盖内容 |
|---|---:|---|
| server/tests/validation.test.js | 31 | 方括号变量、安全文本、必填/只读字段、DTO、ID、日期和分页 |
| server/tests/services.test.js | 14 | HR 归属、SENT + sentAt、UTC+08 日期边界、快照、软删除、授权撤销 |
| server/tests/app.test.js | 27 | Supertest、独立 MemoryStore、CSRF/Origin、登录轮换、退出重放、401/403/404/409/422、真实 Sharp 字节处理和路径限制 |
| server/tests/workflow.test.js | 18 | 可信事件、密码校验、预览/提交/失败、重复事件、SMTP 后 DB 失败时不重发 |
| server/tests/mailer.test.js | 5 | 默认无网络 preview、显式 SMTP 开关、字段白名单、模拟传输和真实内存 MIME |
| server/tests/session-store.test.js | 2 | 模拟 DB 的序列化、过期、touch、销毁和错误传递 |
| server/tests/database-safety.test.js | 25 | 新库名确认、用途/账号限制、迁移冲突、失败保留、模拟种子顺序重跑 |
| server/tests/openapi.test.js | 2 | 文档引用/操作 ID、写请求 CSRF、Postman token 流程和不导出密码 |

这 124 项均不验证真实 Sequelize SQL、MySQL FK/索引/事务或真实并发。MySQL 专用套件
已编写但未执行；实际配置仍不存在。HTTP 测试使用实际 Express 路由和临时测试文件，
服务层通过 mock 验证调用约束。SMTP 没有真实连接，也没有候选人收信证据。

## 修改范围和下一步

保留已有模型/会话存储主体；定向修正 app/services/validation/mailer/config/db/index/
迁移代码。新增 openapi/env/database-safety/seed、8 个单元/API 测试文件、MySQL 专用
套件/配置、导出脚本、数据库与集成/依赖说明。HANDOFF/PLAN/WORK_IN_PROGRESS 已更新。
没有新建另一个项目，没有运行旧 SQL、sync force/alter、发真实邮件、发布或推送。

下一步：确认 127.0.0.1:3306 上两个全新专用库（建议名见 DATABASE_SETUP），配置
仅本地凭据，检查目标后执行 P2。随后实现 P3 的 DB → API → React 通知已读流程，
补 RTL/构建/手机与桌面浏览器验证，再推进模板/日志/资料页面。

本阶段最后核对：源码/文档 67 文件与本地真实凭据值比较，0 匹配（未打印凭据）。
复用原本已运行的 Vite/API 服务，通过真实 localhost:5173 页面确认没有密码框、
loginUrl=null、adapterConfigured=false、受保护 profile 返回 401；额外截图为
work/browser-check/team-pending-development-1440.png，不计入上表脚本的 22 张截图。
曾重复执行 npm.cmd run dev 返回 Port 5173 is already in use；随后确认是原工程
已有服务，直接复用并验证通过，未停掉其他进程、未更换端口或放宽 CSRF 来源。
最后验证：本地现有 Vite/API 实际提供 22 个 OpenAPI 操作及新增虚构 profile 示例。
当前前端仍没有密码表单，待接入配置明确，未认证 profile 401；源码/文档 72 文件
与本地真实凭据值比较为 0 匹配（不打印凭据）。额外开发页截图保存在原 work/browser-check。
一次 PowerShell 操作计数因集合 .Count 结果未展开而报错，改用显式数组计数后确认 22；
未把该错误输出的 14 当作接口数量。npm docs:check 与实时服务现在一致。

## 2026-09-11 历史日期上限回归

| 检查 | 实际结果 |
|---|---|
| npm.cmd test | 后端 10 文件/161 项、前端 3 文件/46 项通过 |
| npm.cmd run test:mysql | 专用测试库 12/12 通过；未改数据库结构 |
| npm.cmd run docs:check | 22 operations、316 JSON examples，退出 0 |
| npm.cmd run docs:export | OpenAPI/Postman/空白环境重新导出，退出 0 |
| npm.cmd run build | Vite 50 modules，退出 0 |
| 本机浏览器（本地虚构 demo） | 日期控件 max=2026-09-11；手输 12/31/9999 后显示 Future dates are not available for activity history. |

新增覆盖包括：日历动态 max、手动未来日期不发请求、通知/日志 API 在服务调用前返回
422、UTC+08 午夜边界。现有 browser-check.mjs 另行运行时因本地未安装可选 Playwright
包而退出 1；未为本次变更擅自增加依赖，改用现有浏览器完成上述定向真实界面核对。

## 2026-09-11 日期筛选对齐与滚轮保护回归

- `npm.cmd test`：后端 161/161、前端 46/46 通过；前端用例确认日期控件的滚轮默认动作被取消且控件失焦。
- `npm.cmd run test:mysql`：专用测试库 12/12 通过；`npm.cmd run docs:check`：22 个操作、316 个 JSON 示例通过。
- `npm.cmd run build`：Vite 50 modules，退出 0。
- 本机浏览器 1264×712 实际检查：Notification type、From date、To date 与操作按钮输入区域恢复同一水平线；帮助文字保留且不再影响网格行高。

## 2026-09-12 整体视觉优化回归

- `npm.cmd test`：后端 10 文件/161 项、前端 3 文件/46 项通过。
- `npm.cmd run test:mysql`：专用测试库 12/12 通过，无结构变更。
- `npm.cmd run build`：Vite 50 modules，退出 0。
- `npm.cmd run docs:check`：22 operations、316 JSON examples，退出 0。
- 本地虚构 demo 浏览器检查：桌面 Notification Center、Email Templates、Notification Log、My Profile；390px 手机端同样检查四页。手机日期帮助文字与 Apply filters 按钮已分离。
- 此轮只改样式和文档；没有声称真实团队登录或真实邮件已验证。

## 2026-09-13 Jest 单元测试与兼容性回归

- `npm.cmd run test:jest`：2 文件/46 用例通过；指定三个后端源文件覆盖率：语句/行 92.39%、分支 86.15%、函数 90.9%。逐项结果见 `docs/UNIT_TEST_REPORT.md`。
- `npm.cmd test`：原有 Vitest 后端 10 文件/161 项、前端 3 文件/46 项通过。
- `npm.cmd run test:mysql`：专用测试库 12/12 通过；`npm.cmd run build`：Vite 50 modules；`npm.cmd run docs:check`：22 operations、316 JSON examples，均退出 0。
- 本次没有修改 UI 或运行浏览器流程；Jest 的数据库替身不代替真实 MySQL 测试，邮件测试没有对外发送。

## 2026-09-14 English-only Jest report rerun

- `npm.cmd run test:jest`: 2 suites, 46 tests passed; statements/lines 92.39%, branches 86.15%, functions 90.9% for the three selected source files.
- `rg -n '[\p{Han}]'` found no Chinese characters in the two Jest test files, Jest configuration, report generator, or regenerated `docs/UNIT_TEST_REPORT.md`.
- No application behavior changed. The existing Vitest, MySQL, and build results above were not rerun for this report-language correction.

## 2026-09-16 rollback and demo-banner removal

- `npm.cmd test`: server Vitest 161/161 and client Vitest 46/46 passed.
- `npm.cmd run test:jest`: 2 suites and 46/46 tests passed; the English-only report was regenerated.
- `npm.cmd run test:mysql`: 12/12 tests passed against the dedicated test database; no schema migration was run.
- `npm.cmd run build`: Vite production build passed with 50 modules.
- `npm.cmd run docs:check`: 22 operations and 316 JSON examples passed contract validation.
- Live `http://localhost:5173/notifications` browser verification confirmed that the previous top Communication tabs are restored and the in-workspace demo status banner and `Reset demo` button are absent.
- The change does not alter routes, fictional demo isolation, authorization, API contracts, database behavior, or email safeguards.

## 2026-09-16 Notification Center redesign

- \`npm.cmd test\`: server Vitest 10 files and 164/164 tests passed; client Vitest 3 files and 47/47 tests passed.
- \`npm.cmd run test:jest\`: 2 suites and 46/46 tests passed. Selected-source coverage: statements/lines 92.78%, branches 86.15%, functions 90.9%. The English-only report was regenerated.
- \`npm.cmd run test:mysql\`: 12/12 tests passed against the dedicated test database. Search/count changes and persistent read behavior used the existing schema; no migration was run.
- \`npm.cmd run build\`: Vite production build passed with 51 modules.
- \`npm.cmd run docs:check\`: 23 operations and 332 JSON request/response examples passed contract validation.
- \`npm.cmd run docs:export\`: OpenAPI, Postman collection, and the blank example environment were regenerated without credentials.
- Live local-demo browser verification at the default desktop viewport showed all three notifications above the fold, real All 3 / Unread 2 counts, semantic actions, and no pagination. At 390×844, two notifications were visible without horizontal overflow.
- The initial redesign verification exercised bulk read and its then-present Undo flow; the later refinement below supersedes that interface. Automated coverage still includes automatic search/type/date filtering, chips, dynamic date groups, semantic actions, hidden small-result pagination, and invalid date handling.

## 2026-09-16 Notification row action refinement

- `npm.cmd test`: server Vitest 10 files and 164/164 tests passed; client Vitest 3 files and 48/48 tests passed.
- `npm.cmd run test:jest`: 2 suites and 46/46 tests passed. The English-only unit-test report was regenerated.
- `npm.cmd run test:mysql`: 12/12 tests passed against the dedicated test database; no migration was run.
- `npm.cmd run build`: Vite production build passed with 51 modules.
- `npm.cmd run docs:check`: 23 operations and 332 JSON request/response examples passed contract validation.
- Live desktop verification confirmed that row action labels have no arrow suffix, per-row read changes are available through the accessible overflow menu, and bulk read changes the unread count to zero without rendering a success panel or Undo action.
- Live 390×844 verification confirmed that the overflow menu remains within the notification card and no horizontal overflow is introduced.

## 2026-09-16 notification, template, and profile regression

- `npm.cmd test`: server Vitest 10 files and 164/164 tests passed; client Vitest 3 files and 49/49 tests passed.
- `npm.cmd run test:jest`: 2 suites and 46/46 tests passed. The English-only unit-test report was regenerated.
- `npm.cmd run test:mysql`: 12/12 tests passed against the dedicated test database; no migration was run.
- `npm.cmd run build`: Vite production build passed with 51 modules.
- `npm.cmd run docs:check`: 23 operations and 332 JSON request/response examples passed contract validation.
- Live desktop verification confirmed that opening the unread application notification changed the summary from 2 unread to 1 unread, and closing the summary returned to a row without the unread marker.
- Desktop and 390×844 checks confirmed that the final row's overflow menu opens upward and remains fully visible.
- Live Email Templates verification showed neutral `5 saved` inventory text with no unread-style badge.
- Live desktop and 390×844 profile checks confirmed that communication tabs are absent and the `Back` and `Edit profile` actions remain available.
