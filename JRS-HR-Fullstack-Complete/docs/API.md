# JRS HR API 与小组对接

基础地址：`http://localhost:3000/api`。浏览器前端和 API 由同一个 Node 进程提供；路径、端口可通过 `.env` 调整。

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
| candidate-save | id, name, email, phone, location, experience, education, skills | 邮箱唯一；skills 为逗号分隔字符串 |
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

`candidate` 字段：`name,email,phone,location,experience,education,skills`；`skills` 为逗号分隔字符串。

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
