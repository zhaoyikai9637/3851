# JRS 候选人模块

本次修复实现候选人注册、登录、退出、身份校验、邮件验证码找回密码，以及资料、经历、教育、证书、技能、语言和私有简历文件的持久化。另将同学的 Jobs、My Resume、Application Status 页面适配为 HTML 展示页，复用其门户样式。展示页复用同学 server/data/seedData.js 的默认职位和资料数据，页面不再显示展示提示；不接招聘后端、不投递申请、不修改真实资料。

侧栏的 Profile、展示页右上角头像均可打开真实个人资料页。Jobs 支持本地搜索、筛选和详情弹窗；My Resume 与 Application Status 的业务操作禁用。所有展示页沿用现有真实登录会话。

## 目录规范

VS Code 直接打开当前项目根目录，不再进入旧的 `Code` 子目录。依赖安装、启动、测试和维护命令均在根目录运行。

```text
项目根目录/
├── client/
│   ├── assets/css/style.css       # 公共样式
│   ├── assets/images/             # 公共图片资源，目前没有本地图片
│   ├── pages/
│   │   ├── login/                 # login.html、login.js
│   │   ├── forgot-password/
│   │   ├── check-email/
│   │   ├── set-new-password/
│   │   ├── profile/               # 真实资料编辑和简历上传
│   │   ├── jobs/                  # 职位展示、搜索、筛选和详情
│   │   ├── resume/                # 同学简历页面的只读展示
│   │   └── application-status/    # 申请状态的默认空页面
│   └── utils/                     # API 客户端和校验工具
├── server/
│   ├── config/                    # config.js 环境配置、db.js 数据库连接
│   ├── routes/                    # auth.js、profile.js
│   ├── services/                  # 仓库、邮件、文件和服务端校验
│   ├── utils/                     # 随机凭证和哈希工具
│   ├── app.js                     # 中间件、鉴权、路由组装和静态资源
│   └── server.js                  # 服务启动入口
├── tests/                         # API、前端、迁移和 utils 单元测试
├── scripts/                       # 数据库迁移/清理和隔离 MySQL 验证
├── migrations/                    # 可审阅的 SQL
├── docs/                          # 交接记录与旧测试日志/coverage 归档
├── uploads/private/               # 私有简历，运行时创建，不静态公开
├── node_modules/                  # npm 安装生成
├── .env                           # 基础秘密配置，不提交
├── .env.local                     # 本机 SMTP 等覆盖配置，不提交
├── .env.example                   # 无秘密的团队模板
├── .gitignore
├── jrs-ca.pem                     # 数据库 CA
├── package.json
├── package-lock.json              # 固定依赖版本，团队应提交
└── README.md
```

旧 `Code/.env` 和重复证书、原凭据说明保留在 `.local-backup/`，该目录整体忽略，不参与运行或提交。根 `.env` 和 CA 保留，已填写的 QQ SMTP 配置迁至根 `.env.local`。旧测试日志和覆盖率保留在 `docs/archive/`，不会作为当前测试结果。

旧 `Code` 文件夹目前已空，但被其他进程占用而暂时保留；关闭使用它的终端或程序后可删除该空目录。它不参与项目运行。交接记录已移到 `docs/HANDOFF-2026-10-07.md`。

页面地址统一为 `/pages/<模块>/<模块>.html`；公共资源通过 `/assets/` 和 `/utils/` 提供。登录、找回、验证码、重设密码、退出和会话失效的跳转已使用新路径。根地址 `/` 自动跳转到 `/pages/login/login.html`；API 仍使用 `/api/...`。

HTML 中的公共样式、工具脚本和页面链接采用相对路径，因此从 VS Code 直接打开文件或通过 Live Server 预览时也能加载本地资源。此方式仅适合查看页面；注册、登录及保存等接口需要后端服务和完成迁移的数据库。

## 启动

### 会议演示：本机完整 Use Case

会议演示使用独立本机 MySQL，运行真实的注册、登录、会话和资料持久化，不依赖团队云库的 DNS/权限。Docker Desktop 需处于运行状态，在项目根目录执行：

```powershell
npm run demo
```

打开 `http://localhost:3001/pages/login/login.html`，不要通过 Live Server 或直接打开 HTML 来测试业务。当前服务已启动时不需要重复运行命令；需要重启时先在原终端按 Ctrl+C，再运行上面的命令。

演示顺序：

1. 点击 Create a candidate account，输入姓名、未注册过的邮箱和至少 8 字符密码，提交注册。
2. 看到 Account created 后，使用同一邮箱和密码登录。
3. 自动进入 Profile，查看账号所属的姓名、邮箱和资料。
4. Editing materials 修改电话/所在地，或 Add summary 保存简介，然后刷新页面，展示持久化。
5. Log out 后再次登录，资料仍然存在。

备用本机测试账号：`demo@example.test` / `DemoPass2026!`。浏览器实测账号：`meeting@example.test` / `DemoPass2026!`，已有电话和简介，用于直接展示。它们是公开的本机演示凭据，不是用户或云库账号。现场演示注册应换一个未注册邮箱，例如 `meeting2@example.test`；本轮注册/登录/资料演示不需要给该地址发送邮件。

容器名 `jrs-candidate-demo`，数据库 `jrs_candidate_demo`，只绑定本机端口 33306，数据保存在命名卷 `jrs-candidate-demo-data`，Ctrl+C 不会删除数据。TLS 密钥存 Linux 命名卷 `jrs-candidate-demo-tls`，使用含 localhost/127.0.0.1 SAN 的本机证书，并保留证书验证。随机数据库秘密保存在忽略目录 `.local-backup/demo/`，不要删除该目录或数据卷，以免丢失本机连接配置/演示数据。简历单独存放在 `uploads/demo-private`。

`npm run demo` 是显式选择本机演示环境；正常 `npm start` 仍使用原云库配置，不存在失败后自动切换或假登录逻辑。团队云库迁移目前仍未完成。本机演示沿用已填写的 SMTP 配置，但这轮验收只执行注册、登录和个人资料，没有发送新邮件。

2026-10-07 已在浏览器实际验证新账号注册、登录跳转、查看资料、修改电话/所在地/简介、刷新后读取真实 MySQL 数据。

### 团队云库运行

要求 Node.js >= 22.12.0、MySQL 8.x 和已审阅的数据库迁移。在项目根目录（本 README 所在目录）操作：

```powershell
npm ci
npm run db:check
# 按下面的迁移流程完成数据库准备后
npm start
```

浏览器打开 `http://localhost:3001`。前端由同一 Express 服务提供，不使用独立 Live Server 或 5173 端口；这样 Cookie、CSRF 和 Origin 校验才能一致工作。服务默认仅监听 `127.0.0.1`。生产环境应配置 HTTPS、`NODE_ENV=production`、正确的 `APP_ORIGIN`，并保留 Cookie 安全属性。若部署反向代理，需要另行按可信代理边界配置客户端 IP；目前限流使用直接连接 IP。

配置优先级从低到高：根目录 `.env`（或由 `ENV_FILE` 指定）、根目录 `.env.local`、进程环境变量。模板在 `.env.example`。不要提交真实 `.env`、授权码或证书私钥；不得打印数据库密码。`DB_SSL_CA` 支持 PEM 内容或相对于基础 env 文件的 CA 路径；数据库 TLS 证书校验默认开启。

`RESET_SECRET` 应为至少 32 字符的随机秘密；未配置时使用现有 `SESSION_SECRET`。改变它会使未完成的验证码失效。会话有效期为 8 小时。账号密码创建/重置要求至少 8 字符且不超过 72 UTF-8 字节，已有较短 bcrypt 密码仍可登录，明文旧密码不兼容，需要找回重设。

## 团队数据库迁移：先备份、审阅、确认

目标真实表是 `MODULE_ACCOUNT`、`CANDIDATE`、`MODULE_SESSION`；不是设计 ER 图中的 APPLICANT 表。本迁移保留现有主键、HR 关联和团队会话表结构，不更改招聘、申请、通知等团队业务表。

`migrations/001_candidate.sql` 包含 17 步：给 CANDIDATE 增加账号关联、姓名分栏、电话、所在地、简介及唯一约束/外键；新增 CAREER_HISTORY、EDUCATION、CERTIFICATION、SKILL、LANGUAGE、RESUME_FILE、JRS_PASSWORD_RESET、JRS_RATE_LIMIT。运行器另建 JRS_SCHEMA_MIGRATION 记录每步校验和。

1. 由数据库负责人完成目标库备份并确认可以恢复，同时备份私有上传目录。团队共享库的实际迁移必须得到明确写入授权。
2. 暂停目标模块的注册、资料修改等写入，审阅 SQL、目标库名和 `npm run db:check` 输出。检查重复候选人邮箱和旧密码格式；该检查不会证明真实密码正确。
3. 经授权后执行以下命令。这里的库名是现有团队目标库，**不要在未获授权时执行**：

```powershell
npm run db:migrate -- --apply --database=jrs_hr_module_dev_team
```

4. 可选的历史资料关联必须单独审阅：只将邮箱匹配、role 为 candidate 且尚未关联的现有账号和历史资料建立关联；重复候选人邮箱会拒绝关联。原姓名和候选人 ID 保留。确认需要该行为后可把 `--link-existing` 加到迁移命令，或在迁移完成后再次运行：

```powershell
npm run db:migrate -- --apply --database=jrs_hr_module_dev_team --link-existing
```

仅执行迁移不会自动认领历史资料。有同邮箱未关联资料的旧账号登录会返回 409，需管理员完成审核关联。新注册账号不会凭邮箱自动接管历史资料。

MySQL DDL 自动提交，17 步不是一个可整体回滚的事务。运行器使用数据库命名锁，同一连接执行 DDL 和账本写入，重复执行会跳过已记账且校验和一致的步骤。存在账本缺口、未知步骤、校验和变化或无账本的部分结构时停止。若进程在 DDL 成功而账本未写入之间退出，管理员必须核对实际结构和该步骤，再决定如何恢复；不要删除账本或盲目重跑 SQL。需要整体撤回时使用已验证的备份恢复方案。迁移脚本不会自动恢复备份。

服务启动仅执行读取检查，不自动迁移或创建测试账号。缺少迁移字段时会拒绝启动。迁移后再次运行只读检查，再启动服务进行业务验收。

迁移使用的数据库账号需要具备目标库的 CREATE、ALTER、REFERENCES、INDEX 等结构权限，以及脚本需要的数据读写权限。只有 SELECT/INSERT/UPDATE/DELETE 的日常账号不能初始化表结构。出现 `ER_TABLEACCESS_DENIED_ERROR` 时，应请管理员提供迁移账号或授予所需权限；不要绕开账本手工粘贴整份 SQL。可在本机根 `.env.local` 临时覆盖 DB_USER/DB_PASSWORD，迁移后移除这些覆盖值，恢复日常账号；凭据不要发到聊天或提交。

可见 InnoDB 基表的只读本地备份和本机恢复验证工具：

```powershell
node scripts/backup.js --database=jrs_hr_module_dev_team
# 备份输出保存在 .local-backup/database/<时间戳>/，含私有数据，禁止提交
# 下面仅连接本机一次性 MySQL，不读取 .env；密码为本机测试服务的密码
$env:TEST_MYSQL_PASSWORD='your-disposable-local-password'
node scripts/verify-backup.js --directory=.local-backup/database/<实际备份目录>
Remove-Item Env:TEST_MYSQL_PASSWORD
```

导出工具针对可见基表和数据，非完整服务器备份；发现可见视图、触发器、存储程序、事件或非 InnoDB 表会拒绝导出，需要管理员备份。备份过程中需暂停并发 DDL。2026-10-07 已完成当前 11 张表、3 条记录的快照并在本机恢复核验通过。用户已授权云迁移，但当前数据库账号缺少结构权限，迁移在创建账本时被拒绝，尚未应用任何结构变更。

## QQ 邮箱 SMTP

在本机 根目录 `.env.local` 填写以下配置。`SMTP_PASS` 使用 QQ 邮箱 SMTP 授权码，不能使用邮箱登录密码，也不要把授权码发到聊天或提交到仓库。

```dotenv
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-address@qq.com
SMTP_PASS=fill-locally
SMTP_FROM=your-address@qq.com
MAIL_ALLOW_SMTP=true
```

未启用或配置不全时，找回接口返回 503。启用后，已存在和不存在账号得到相同公开响应；该响应不保证邮件送达，SMTP 失败会删除对应未送达验证码并记录不含地址和验证码的错误代码。2026-10-07：用户已在本机填写测试配置，TLS/认证检查通过；经用户授权，向同一个 QQ 邮箱发送了一封普通测试邮件，SMTP 接受 1 封、拒绝 0 封，用户已确认实际收到。这不代表云端找回密码流程已经验收。

验证码有效 10 分钟，最多 5 次错误尝试；发送间隔 60 秒，另有 IP/邮箱窗口限流。验证码只存 HMAC，验证成功后交换一次性随机重置凭证，数据库只存其哈希。新验证码会撤销旧重置凭证。重置密码与消费凭证、撤销该候选人的会话在同一个事务中，保留团队其他会话。

## 私有文件和维护

`UPLOAD_DIR` 默认 根目录 `uploads/private`，应保持在前端静态目录之外，持久化并与数据库一起备份。简历最多 5 MB，支持 PDF、DOCX、DOC、TXT、RTF，服务端检查内容类型并使用随机存储键；下载需要登录及文件归属校验。文件类型识别不代表病毒扫描或完整文档有效性检查。文件写入后若数据库保存失败，会删除刚写入的文件；进程崩溃可能留下孤立文件，应在备份后人工对照 RESUME_FILE 检查。

清理过期的候选人会话、找回凭证和限流记录是显式写入操作，需数据库维护权限。不要把 `db:check` 的只读许可当作清理许可：

```powershell
npm run db:cleanup -- --database=jrs_hr_module_dev_team
```

候选人会话键使用 `candidate:` 前缀，存储 Cookie 随机值的哈希；清理及密码重置不删除其他前缀的团队会话。

## 验证

```powershell
npm test -- --runInBand
```

2026-10-07：目录整理及路由拆分后，11 个套件、64 项测试通过，包含页面跳转/资源路径和敏感目录访问检查。HTTP 测试使用真实 Express、中间件、bcrypt 和临时文件，但使用内存仓库；前端回归使用 jsdom。Jest 的 ESM 支持会输出实验性警告。

真实数据库验证脚本 **不加载任何 .env，也不接受远程 host**，仅连接 `127.0.0.1`。需要一个可创建和删除测试库的本机 root 测试账号，默认端口 33306；可设置 `TEST_MYSQL_PORT`。它创建随机命名的 `jrs_isolated_*` 库，按已知真实表结构建立合成基线，最终删除该测试库和临时上传文件，不复制团队数据。

```powershell
# 对照 scripts/test-mysql.js 审阅；只填写本机一次性测试服务的密码
$env:TEST_MYSQL_PASSWORD='your-disposable-local-password'
npm run test:mysql
Remove-Item Env:TEST_MYSQL_PASSWORD
```

2026-10-07：在仅绑定本机 33306 端口的 MySQL 8.4 容器中通过验证：只读预检无写入、17 步迁移及重跑、历史资料关联及重复邮箱拒绝、资料/全部明细/列表/简历持久化、跨账号访问限制、注册和列表替换回滚、一次性凭证并发消费、登录与重置竞争、其他候选人和团队会话保留。

该结果验证了合成基线上的真实 SQL/事务，不代表已在 Aiven 应用迁移或完成云端端到端验收。Aiven 当前仅完成只读检查，云端迁移仍待授权；QQ SMTP 配置和普通测试邮件发送已完成，用户已确认实际收到。此前运行依赖 audit 未报告已知漏洞；开发依赖曾报告 33 项，尚未逐项修复，不应据此宣称全部依赖无漏洞。

