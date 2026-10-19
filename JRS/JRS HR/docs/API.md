> **当前版本 2.5.0 已取消自动学历关卡。学历条件只写在 Job Requirements 中，HR 查看简历决定是否推进；不再要求录入学历、专业或毕业日期。下列自动筛选和暂停 Offer 的内容仅为历史版本说明，以 [HR_REVIEW_v2.5.md](HR_REVIEW_v2.5.md) 为准。**

> v2.4.1 更新：candidate-save 只编辑联系资料、经验和技能；实际修改学历、专业、毕业日期、学历说明或旧 graduateStatus 返回 422。原值/省略兼容，原始事实不重写。新申请通过 application-create 的 candidate 记录真实学历。见 [SCREENING_UX_v2.4.1.md](SCREENING_UX_v2.4.1.md)。

> v2.4.0 更新：学历、专业及毕业状态改为自动判断，手动 Graduate status 已移除。规则与当前字段见 [AUTO_SCREENING_v2.4.md](AUTO_SCREENING_v2.4.md)，以下旧版说明以该更新为准。

> v2.3.2：Job Requirements 改为保存 8–12 条实质要求，前端与 API 共用验证；详情见 [REQUIREMENTS_v2.3.2.md](REQUIREMENTS_v2.3.2.md)。以下旧版描述以该更新为准。

# v2.3.0 毕业状态接口约定

`application-create` 的 `candidate.graduateStatus` 与 `candidate-save` 的 `graduateStatus` 使用 Experienced / Fresh graduate / Not recorded。创建时省略则 Not recorded；编辑省略则保留旧值。应届或未录入身份不能执行面试和 Offer 推进操作，返回业务错误；不能通过操作请求中的伪造字段覆盖数据库身份。界面称 Applications Review，API 阶段值仍为 Pending Review。

# JRS HR API 与小组对接

本地基础地址：`http://localhost:3000/api`；随附团队配置使用 `http://localhost:3001/api`。浏览器前端和 API 由同一个 Node 进程提供；路径、端口可通过 `.env` 调整。

## 调用约定

1. `POST /auth/login`，JSON：`{"email":"你的HR账号","password":"你的密码"}`。成功返回 `user` 和 `csrfToken`，并设置 HttpOnly 会话 Cookie。
2. `GET /hr/workspace` 获取一致的工作区快照，其中 `revision` 是当前版本。
3. 修改请求携带会话 Cookie、`X-CSRF-Token`、`If-Match: 当前revision`、`Idempotency-Key: 新UUID`，请求体是 JSON。
4. 网络中断后重试同一个操作时复用同一个 key。已提交的操作返回之前的结果；同一个 key 不能配不同的内容。去重记录保留 7 天。
5. 普通业务操作成功返回 `{result, revision, db}`。用 `db` 更新界面，它可能比操作结果的版本更新。收到 `409 REVISION_CONFLICT` 时先刷新、检查新数据，再决定是否重试。

浏览器内调用例子（已完成登录）：

```js
const db = await fetch('/api/hr/workspace').then(r => r.json());
const response = await fetch('/api/hr/commands/move-interview', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
    'If-Match': String(db.revision),
    'Idempotency-Key': crypto.randomUUID()
  },
  body: JSON.stringify({applicationId, notes: 'Review completed', notify: true})
});
const result = await response.json();
if (!response.ok) throw new Error(result.error.message);
```

所有命令使用 `POST /hr/commands/{命令名}`。采用明确的业务命令，避免直接把任意 `stage` 写进数据库。

| 命令 | 主要字段 | 业务限制 |
|---|---|---|
| application-create | jobId, candidateId；或 candidate 对象；priority | 职位必须 Active；同一候选人和职位不可重复申请 |
| candidate-save | id, name, email, phone, location, experience, skills | 邮箱唯一；skills 为逗号分隔字符串；学历资料只读 |
| move-interview | applicationId, notes?, notify? | Pending Review → Interview；职位 Active |
| reject | applicationId, reason, notes?, notify? | 原因必填；取消预约；未发送旧草稿失效 |
| confirm-rejection | applicationId, reason | 仅 Rejected |
| schedule | applicationId, date, time, duration, format, location, interviewer, notes?, notify?, interviewId? | Interview；将来时间；冲突校验；带 interviewId 为改期 |
| cancel-interview | applicationId, interviewId, reason | 仅 Scheduled |
| feedback | applicationId, interviewId, rating, recommendation, notes | 面试结束后；评分 1–5；转 Interview Results |
| offer | applicationId, salary, startDate, expiry, terms | 来自 Results 或修改未发送的 Offer；薪资最多两位小数；开始日期晚于截止日期 |
| approve-offer | applicationId | 仅 HR_MANAGER；审批有效草稿 |
| offer-message | applicationId | 有效且批准的 Offer；生成草稿 |
| accept-offer | applicationId, notes | 有效且批准的 Offer；接受证据必填；转 Hired |
| message | applicationId, subject, body, notificationId?, templateId? | 创建/编辑草稿；保留模板名称与文本快照 |
| task | applicationId, title, assignee, due, notes? | 截止日不早于今天 |
| complete-task | id | Open → Completed，不可重复 |
| candidate-notes | applicationId, notes | 仅内部可见 |
| job-save | id?, title, department, type, mode, location, experience, education, description, skills, requirements, status | skills 用逗号、requirements 用换行；字段枚举由服务端验证 |
| job-status | id, status | Active / Closed；保留全部申请 |
| profile-save | phone, officeLocation | 只修改当前账号；其他系统字段不接受写入 |
| template-save | id?, name, kind, subject, body | 仅经理；变量白名单 |
| template-delete | id | 仅经理；归档而非删历史 |
| system-read / system-read-all | id / 空对象 | 当前 HR 个人的已读状态 |
| read-notification / read-all | id / 空对象 | 兼容原草稿页面的阅读标记；不改变发送状态 |

当前 `candidate` 必填资料为 `name,email,phone,location,experience,skills`；学历信息无需填写。旧字段可兼容读取保存，但不决定能否推进；`skills` 为逗号分隔字符串。

## 其他接口

| 方法与路径 | 用途 |
|---|---|
| GET /health | 数据库连接是否可用；不暴露账号和表数据 |
| GET /auth/me | 当前账号、CSRF token |
| POST /auth/logout | 注销当前会话 |
| POST /auth/password | currentPassword,newPassword；成功后注销该账号所有会话 |
| GET /hr/workspace | 前端所有页面使用的快照，不含密码、会话、PDF 二进制 |
| GET /hr/applications / candidates / jobs / interviews / tasks / notifications / systemNotifications / mailLogs | 分页列表；page,limit,q,stage,status,jobId；limit 最大 100 |
| GET /hr/templates/variables | 模板变量白名单 |
| POST /hr/templates/:id/preview | applicationId；填充模板，缺少业务字段时拒绝 |
| POST /hr/notifications/:id/send | attachResume:boolean；带 CSRF 与 If-Match；草稿 ID 防重复发送 |
| PUT /hr/candidates/:id/resume | 原始 PDF body；Content-Type: application/pdf；X-Filename: encodeURIComponent(文件名)；带 CSRF 与 If-Match |
| GET /hr/candidates/:id/resume | 预览 PDF；加 ?download=1 下载；需要登录 |
| GET /hr/mailLogs/:id/attachments | 历史附件清单 |
| GET /hr/attachments/:id | 下载历史附件；需要登录 |

模板类型：Interview Invite、Offer Letter、Accepted、Rejected、In Progress。变量以 API 返回的白名单为准，内部备注与拒绝原因不作为邮件变量。

错误结构：`{error:{code,message,requestId}}`。常见状态：400 格式错误；401 未登录；403 权限/CSRF；404 不存在；409 冲突；413 文件过大；422 业务验证失败；428 缺少版本；429 登录次数过多；502 邮件状态无法确认；503 服务未准备好。

## 小组集成边界

- 此包实现本轮已确认的整个 HR 页面流程。Employee、Manager、Finance 的页面、薪资发放和入职后的员工管理不在本包范围。
- 当前 `hr_user` 是可独立运行的账号模块。小组已有统一登录时，在 `server/auth.cjs` 对接实际用户与角色；业务层使用 `req.user`，不要让客户端自行提交操作者或权限。
- 当前候选人、职位、申请作为 HR 自足运行所需的关联实体。小组已有同类表时，应根据统一 ERD 对齐主外键，并调整 `repository.cjs` 映射；不要再维护两套独立申请状态。
- 新申请可由已授权的集成端调用 `application-create`，在一个事务中生成申请和 HR 内部通知。录用交给其他模块时，以数据库中已成功提交的 Hired 状态为依据。
- Notifications 负责展示系统事件、模板及邮件记录；修改申请状态的规则集中在 Applications 命令中。没有把 Employee、Finance 的权限混入 HR。
- 本轮没有原始 `jrs_hr_system.sql` 和统一后端合同，当前表结构是根据现有 HR 页面建立的独立实现，不是对旧 SQL 的直接迁移。

技术资料：[MySQL2 参数化查询与连接池](https://sidorares.github.io/node-mysql2/docs)；接口中提交给 SQL 的值使用参数绑定，表名和字段名来自代码内的固定映射。

## v2.1 保留期与团队写入策略

申请快照增加 retentionStartedAt，由服务端管理。Offer / Rejected 满五年后可被后台清理，旧版本提交返回版本冲突；已清理申请的缓存请求返回 410 RETENTION_EXPIRED。

团队模式未完成写入配置时，所有修改请求（包括登录、注销）返回 503 TEAM_READ_ONLY。db:check 与 health 可用于只读诊断。统一登录适配并未由环境文件自动完成，具体见 TEAM_SETUP.md。
