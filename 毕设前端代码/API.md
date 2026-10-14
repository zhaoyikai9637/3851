# JRS API 接口文档

更新日期：2026-10-14。本文根据当前后端代码整理，可直接交给前端及其他模块队友使用。文中的 ID、姓名和请求值为格式示例；联调时请替换为实际返回的数据。

## 1. 启动、地址与登录约定

在项目根目录运行 `npm start`，本机默认地址为 `http://localhost:3001`。以下所有接口路径都接在该地址后。其他电脑上的队友需运行自己的后端或使用双方约定的服务器地址，不能用自己的 localhost 访问你的电脑。

| 类型 | 前缀 | 说明 |
|---|---|---|
| 统一账号、求职者资料 | `/api` | 注册、登录、会话、求职者资料及简历 |
| HR 工作台 | `/hr/api` | HR 身份、招聘业务、通知、模板等 |

除文件上传外，请求体使用 JSON，设置 `Content-Type: application/json`。统一登录使用 **HttpOnly Cookie**，不使用 localStorage 中的 token，也不使用 Bearer Token。浏览器请求须带 `credentials: 'same-origin'`，并从同源网页调用；当前没有启用跨域联调。

登录响应、`GET /api/me` 或 `GET /hr/api/auth/me` 会返回 `csrfToken`。已登录后的写操作必须带请求头 `X-CSRF-Token: <csrfToken>`。注册、登录和公开找回密码接口不要求预先登录或 CSRF token；写请求的来源仍须匹配后端 `APP_ORIGIN`。Cookie 名为 `jrs_candidate_session`，HR 与求职者共用这一个会话。

角色约定：统一账号的 `role` 为 `candidate` 或 `hr`；HR 工作台身份的 `role` 为 `HR_MANAGER` 或 `HR_STAFF`。公开注册只能创建求职者。后端依据账号及数据库中的 HR 关联资料授权，客户端不能通过提交 role 或修改跳转地址获得 HR 权限。

前端跳转：统一登录成功后，`user.role === 'hr'` 跳到 `/hr/`，否则跳到 `/pages/profile/profile.html`。登录接口返回 JSON，本身不执行网页重定向。

## 2. 统一账号接口

| 方法 | 路径 | 登录要求 | JSON 请求体 | 成功返回 |
|---|---|---|---|---|
| POST | `/api/register` | 无 | `email, password, first_name, last_name` | 201：`{"valid":true}` |
| POST | `/api/login` | 无 | `email, password` | 200：`valid, user, csrfToken`，同时设置 Cookie |
| GET | `/api/me` | 求职者或 HR | 无 | 200：`valid, user, csrfToken` |
| POST | `/api/logout` | 求职者或 HR + CSRF | 无，可传 `{}` | 200：`{"valid":true}`，撤销会话并清除 Cookie |
| POST | `/api/forgot-password` | 无，仅处理求职者邮箱 | `email` | 200：`valid, message` |
| POST | `/api/check-email` | 无 | `email, code` | 200：`valid, resetToken` |
| POST | `/api/set-new-password` | 无，须持有有效 resetToken | `resetToken, newPassword` | 200：`{"valid":true}`，撤销该账号已有会话 |

### 注册与登录参数

| 字段 | 类型 | 约束 |
|---|---|---|
| email | string | 必填、有效邮箱、最长 150 字符；后端转为小写 |
| password（注册） | string | 至少 8 字符，UTF-8 编码不超过 72 字节 |
| password（登录） | string | 非空、UTF-8 编码不超过 72 字节；与 bcrypt 哈希核对 |
| first_name | string | 注册必填，最长 50 字符 |
| last_name | string | 可空，最长 49 字符 |

登录请求示例：

```json
{"email":"applicant@example.test","password":"<your-password>"}
```

求职者登录响应示例（HR 的 `role` 为 `hr`）：

```json
{
  "valid": true,
  "user": {"account_id": 2, "email": "applicant@example.test", "role": "candidate"},
  "csrfToken": "<server-generated-token>"
}
```

登录响应的 user 不包含姓名。求职者姓名从 `/api/profile` 的 `profile.full_name` 获取；HR 姓名从 `/hr/api/auth/me` 的 `user.name` 获取。

### 找回密码参数与行为

- `code`：**字符串**，恰好 4 位数字，例如 `"0123"`，不能传数字而丢失前导零。邮件验证码有效期 10 分钟，错误达到 5 次需重新申请。
- `resetToken`：验证码校验成功后获得的 64 位十六进制字符串，有效期 10 分钟，仅能消费一次。
- `newPassword`：与注册密码相同，至少 8 字符、最多 72 UTF-8 字节。
- `/api/forgot-password` 为防止泄露账号是否存在，对有效格式的邮箱返回通用提示。返回成功不代表邮箱存在，也不代表邮件已送达；SMTP 未配置时返回 503。
- 当前邮件找回流程只用于求职者；HR 已登录后的改密码见第 4 节。

找回密码顺序：`forgot-password → 收到验证码 → check-email → set-new-password → 重新登录`。

## 3. 求职者 Profile 接口

以下接口都要求当前账号角色为 `candidate`；写操作还须携带 CSRF token。接口从会话定位当前求职者，**不接受通过 email、account_id 或 candidate_id 指定其他人的资料**。HR 调用这些接口返回 403。

| 方法 | 路径 | 请求体 | 成功返回 |
|---|---|---|---|
| GET | `/api/profile` | 无 | 200：`{"valid":true,"profile":{...}}` |
| PUT | `/api/profile` | 基本资料，见下表 | 200：`{"valid":true}` |
| PUT | `/api/profile/summary` | `{"personal_summary":"..."}` | 200：`{"valid":true}` |
| PUT | `/api/profile/skills` | `{"skills":["JavaScript","SQL"]}` | 200：`{"valid":true}` |
| PUT | `/api/profile/languages` | `{"languages":[...]}` | 200：`{"valid":true}` |
| POST | `/api/profile/{section}` | 该区块的字段，见下文 | 201：`{"valid":true,"id":7}` |
| PUT | `/api/profile/{section}/{id}` | 该区块的完整字段 | 200：`{"valid":true,"id":7}` |
| DELETE | `/api/profile/{section}/{id}` | 无 | 200：`{"valid":true}` |
| POST | `/api/profile/resume` | multipart 文件，字段名 `resume` | 201：`{"valid":true,"id":8}` |
| GET | `/api/profile/resume/{id}` | 无 | 200：文件下载流，非 JSON |

`{section}` 只允许 `career`、`education`、`certifications`。`{id}` 为正整数，并且记录必须属于当前求职者。当前没有求职者简历 DELETE 接口。

### 3.1 读取 Profile

`profile` 包含基本信息及以下区块：

| 字段 | 类型／内容 |
|---|---|
| candidate_id, account_id | 数字 ID |
| full_name, first_name, last_name, email | 姓名及邮箱 |
| country_code, contact_number, home_location | 电话区号、号码、所在地 |
| personal_summary | 简介，可为空 |
| career | 经历数组，记录主键 `role_id` |
| education | 教育数组，记录主键 `education_id` |
| certifications | 证书数组，记录主键 `cert_id` |
| skills | 字符串数组 |
| languages | 语言数组，含 `language_id, language_name, can_read, can_write` |
| resumes | 简历元数据数组：`file_id, file_name, file_type, file_size, uploaded_at` |

数据库布尔字段在读取响应中可能表现为 `0/1`；提交 JSON 时应使用真正的 `true/false`。简历响应不暴露本地存储路径或 storage_key。

### 3.2 基本资料和简介

`PUT /api/profile`：

| 字段 | 类型 | 约束 |
|---|---|---|
| first_name | string | 必填，最多 50 字符 |
| last_name | string | 可空，最多 49 字符 |
| country_code | string | 必填，例如 `+65`；必须符合区号格式 |
| contact_number | string | 可空，最多 20 字符；填写时按区号校验号码长度 |
| home_location | string | 可空，最多 200 字符 |

```json
{
  "first_name": "Alex", "last_name": "Tan",
  "country_code": "+65", "contact_number": "91234567", "home_location": "Singapore"
}
```

后端根据 first_name 和 last_name 生成 full_name。此接口不修改登录邮箱、账号角色或简介。简介通过 `/api/profile/summary` 更新，`personal_summary` 最多 2000 字符；传空字符串清空。

### 3.3 经历、教育、证书字段

新增和编辑均提交该区块的完整表单。带“布尔”的字段须明确传 `true` 或 `false`；日期月份使用 `YYYY-MM`，可空日期可不传、传 null 或空字符串。起止日期必须有合理顺序。

| section | 字段 | 类型／约束 |
|---|---|---|
| career | job_title, company_name | 必填 string，各最多 150 字符 |
| career | start_month_year, end_month_year | 可空月份；结束不得早于开始 |
| career | is_current_role | 必填 boolean；true 时忽略结束日期 |
| career | description | 可空 string，最多 5000 字符 |
| education | institution, qualification | 必填 string，各最多 150 字符 |
| education | is_current_study | 必填 boolean |
| education | finished_year | 可空的四位年份字符串；在读时忽略 |
| education | end_month_year | 在读时预计结束月份，否则忽略 |
| education | description | 可空 string，最多 5000 字符 |
| certifications | cert_name | 必填 string，最多 150 字符 |
| certifications | issuing_org | 可空 string，最多 150 字符 |
| certifications | issue_month_year, expiry_month_year | 可空月份，过期日期不得早于签发日期 |
| certifications | no_expiry | 必填 boolean；true 时忽略过期日期 |
| certifications | description | 可空 string，最多 5000 字符 |

新增经历示例，发送到 `POST /api/profile/career`：

```json
{
  "job_title": "Frontend Developer Intern", "company_name": "Fictional Studio",
  "start_month_year": "2025-06", "end_month_year": "2025-12",
  "is_current_role": false, "description": "Built accessible web interfaces."
}
```

### 3.4 技能和语言

这两个 PUT 接口是**整组替换**，不是追加。空数组表示清空；每组最多 50 条，不允许忽略大小写后重复的名称。

- `skills`：string 数组，每个名称必填且最多 50 字符。
- `languages`：对象数组，每条包含 `language_name`（最多 80 字符）、`can_read`、`can_write`（两者为 boolean，至少一个为 true）。

```json
{"languages":[{"language_name":"English","can_read":true,"can_write":true}]}
```

### 3.5 简历上传及下载

`POST /api/profile/resume` 使用 `multipart/form-data`，只上传一个文件，字段名为 `resume`，不附带其他文本字段。最大 **5 MiB（5 × 1024 × 1024 字节）**，支持 `pdf/doc/docx/txt/rtf`，后端会核对文件内容而不只检查后缀，txt 须为 UTF-8。

浏览器使用 FormData 时，不要手动设置 Content-Type；让浏览器自动生成 boundary。上传成功返回 id，之后可通过 `/api/profile/resume/{id}` 下载，也可重新 GET Profile 获取文件列表。

## 4. HR 身份接口

HR 首先通过 **`POST /api/login`** 登录。以下受保护接口要求统一账号为 `hr`、关联 HR_USER 为活动状态，且工作台用户角色匹配；写操作要求共享 CSRF token。

| 方法 | 路径 | 请求体 | 返回 |
|---|---|---|---|
| GET | `/hr/api/health` | 无；不要求登录 | 200：`{"ok":true,"database":"connected"}`；数据库异常为 503 |
| GET | `/hr/api/auth/me` | 无 | 200：`user, csrfToken` |
| POST | `/hr/api/auth/logout` | `{}` | 200：`{"ok":true}`，撤销共享会话 |
| POST | `/hr/api/auth/password` | `currentPassword, newPassword` | 200：`{"ok":true}`，修改统一账号密码并撤销其所有会话 |
| POST | `/hr/api/auth/login` | 不使用 | 409：独立 HR 登录已关闭，请使用统一 `/api/login` |

HR 的 user 包含：`id, email, name, role, status, employeeId, department, phone, officeLocation`。`id` 是工作台字符串 ID（如 `team-hr-1`），不同于统一账号的数字 account_id。密码修改的后端约束为新密码至少 8 字符、最多 72 UTF-8 字节；现有 HR 表单另要求至少 12 字符。

## 5. HR 查询接口

本节接口要求 HR 登录，方法均为 GET。

| 路径 | 参数 | 成功返回 |
|---|---|---|
| `/hr/api/hr/workspace` | 无 | 完整工作台对象，见下文 |
| `/hr/api/hr/{resource}` | 可选查询参数，见下文 | `items, total, page, limit, revision` |
| `/hr/api/hr/templates/variables` | 无 | `{"variables":[...]}` |
| `/hr/api/hr/candidates/{id}/resume` | id：HR候选人字符串 ID；可选 `download=1` | application/pdf 文件流；默认 inline，download=1 则下载 |
| `/hr/api/hr/mailLogs/{id}/attachments` | id：发送日志字符串 ID | `{"items":[{"id":"...","filename":"...","size":123}]}` |
| `/hr/api/hr/attachments/{id}` | id：附件字符串 ID | PDF 附件下载流 |

`{resource}` 允许：`applications`（申请）、`candidates`（HR候选人）、`jobs`（职位）、`interviews`（面试）、`tasks`（任务）、`notifications`（邮件草稿）、`systemNotifications`（系统通知）、`mailLogs`（发送日志）。没有单独的 `GET /hr/api/hr/templates`；模板列表从 workspace.templates 获取。

列表查询参数：

| 参数 | 类型／规则 |
|---|---|
| page | 页码，默认 1，最小 1 |
| limit | 每页条数，默认 20，范围 1–100 |
| q | 搜索文本，匹配记录适用的 name/title/subject/id/email 字段 |
| stage | 精确筛选申请 stage |
| status | 精确筛选记录 status |
| jobId | 精确筛选记录 jobId |

例如：`GET /hr/api/hr/applications?page=1&limit=20&stage=Pending%20Review`。

```json
{"items":[],"total":0,"page":1,"limit":20,"revision":0}
```

workspace 是直接返回的对象，**没有 valid 包装**，包含 `schemaVersion, revision, createdAt, updatedAt, currentUser, mailEnabled, timezone` 及 `jobs, candidates, applications, interviews, tasks, notifications, activity, templates, systemNotifications, mailLogs` 等数组。面试/业务日期按 `Asia/Singapore`（UTC+08:00）解释。

申请阶段：`Pending Review / Interview / Interview Results / Offer / Rejected / Hired`。职位状态：`Active / Draft / Closed`。面试状态：`Scheduled / Completed / Cancelled`。这些字符串区分大小写。

## 6. HR 写接口与命令

| 方法 | 路径 | 参数／请求体 | 成功返回 |
|---|---|---|---|
| POST | `/hr/api/hr/commands/{command}` | JSON 命令载荷，见下表；须有 If-Match 与 Idempotency-Key | 200：`result, revision, db`；db 为更新后的完整工作台 |
| POST | `/hr/api/hr/templates/{id}/preview` | `{"applicationId":"实际申请ID"}` | 200：`subject, body` |
| POST | `/hr/api/hr/notifications/{id}/send` | `{"attachResume":false}`；须有 If-Match | 200：发送结果及 db；当前集成关闭发送，返回 409，草稿保留 |
| PUT | `/hr/api/hr/candidates/{id}/resume` | 原始 PDF 二进制，Content-Type 为 application/pdf；须有 If-Match 与 X-Filename | 200：`{"db":{...}}` |

以上写请求都须有 `X-CSRF-Token`。HR PDF 上传不是 multipart：请求体就是 PDF 字节，最大 5 MiB；`X-Filename` 传经过 `encodeURIComponent` 编码的 `.pdf` 文件名。

### 6.1 命令的公共请求头

```http
Content-Type: application/json
X-CSRF-Token: <csrfToken>
If-Match: <latest workspace.revision>
Idempotency-Key: <unique request key, for example a UUID>
```

revision 从最新 workspace 获取。请求键须为 16–80 位字母、数字或连字符。同一操作因网络中断重试时保留原键和原载荷；新操作换新键。版本过期会返回 409 / REVISION_CONFLICT，需要重新读取工作台再由用户确认操作。缺少 If-Match 返回 428。

### 6.2 支持的 command 与请求字段

表中 `?` 表示可选；`notify?` 为 boolean，true 表示准备邮件草稿，**不直接发送邮件**。ID 均应从工作台或创建响应取得，不能把求职者 Profile 的数字 candidate_id 当作 HR 候选人 ID。

| command | 用途 | JSON 字段 |
|---|---|---|
| profile-save | 编辑当前HR联系方式 | `phone, officeLocation`（string，可空） |
| job-save | 新增/编辑职位 | `id?, title, department, type, mode, location, experience, education, description, requirements, skills, status` |
| job-status | 开启/关闭职位 | `id, status`（Active 或 Closed） |
| application-create | 录入申请 | `jobId, candidateId` 或 `jobId, candidate` 对象；`priority?` |
| candidate-save | 编辑HR候选人 | `id, name, email, phone, location, experience, education, skills` |
| move-interview | 从初审进入面试 | `applicationId, notes?, notify?` |
| reject | 拒绝申请 | `applicationId, reason, notes?, notify?` |
| schedule | 安排/重排面试 | `applicationId, interviewId?, date, time, duration, format, interviewer, location, notes?, notify?` |
| cancel-interview | 取消已安排的面试 | `applicationId, interviewId, reason` |
| feedback | 记录已结束面试的反馈 | `applicationId, interviewId, rating, recommendation, notes` |
| offer | 准备/编辑Offer | `applicationId, salary, startDate, expiry, terms` |
| approve-offer | 审批Offer，仅HR Manager | `applicationId` |
| offer-message | 准备Offer邮件草稿 | `applicationId` |
| accept-offer | 记录候选人已确认接受Offer | `applicationId, notes` |
| confirm-rejection | 确认拒绝原因 | `applicationId, reason` |
| message | 新增/编辑邮件草稿 | `applicationId, notificationId?, templateId?, subject, body`；选模板时可省略 subject/body 由模板填充 |
| read-notification | 标记邮件草稿已读 | `id` |
| read-all | 标记全部邮件草稿已读 | `{}` |
| task | 新增面试任务 | `applicationId, title, assignee, due, notes?` |
| complete-task | 完成任务 | `id` |
| candidate-notes | 更新内部候选人备注 | `applicationId, notes` |
| template-save | 新增/编辑模板，仅HR Manager | `id?, name, kind, subject, body` |
| template-delete | 归档模板，仅HR Manager | `id`；保留历史草稿快照，不物理删除 |
| system-read | 当前用户标记一条系统通知已读 | `id` |
| system-read-all | 当前用户标记全部系统通知已读 | `{}` |

补充约束：

- job-save：type 为 Full-time/Part-time/Contract/Internship；mode 为 On-site/Hybrid/Remote；status 为 Active/Draft/Closed。requirements 传换行分隔的字符串，skills 传逗号分隔字符串，后端转换为数组。
- application-create 新候选人的 candidate 对象包含 `name, email, phone, location, experience, education, skills`；experience 为 0–70 年数值，skills 为逗号分隔字符串。已有候选人传 candidateId。priority 为 High 或 Normal，默认 Normal。职位须为 Active。
- schedule：date 为 YYYY-MM-DD，time 为 HH:mm；duration 为 15/30/45/60/90/120 分钟；format 为 Video/On-site/Phone。时间须在未来，且不能与候选人、面试官或现场会议室已有安排冲突。
- feedback：rating 为 1–5 整数，recommendation 为 Proceed/Hold/Reject，须等面试结束后提交。
- offer：salary 为正数且最多两位小数；币种为 SGD。expiry 为今天或未来日期，startDate 必须晚于 expiry。只有符合当前阶段和审批状态的操作会成功。
- task：due 为 YYYY-MM-DD，不能是过去日期。
- template-save：kind 为 Interview Invite/Offer Letter/Accepted/Rejected/In Progress。可用变量从 templates/variables 获取，包括 candidateName/jobTitle/hrName/date/time/interviewer/location/format/salary/currency/startDate/expiry。

HR资料保存示例：

```http
POST /hr/api/hr/commands/profile-save
Content-Type: application/json
X-CSRF-Token: <csrfToken>
If-Match: <latest revision>
Idempotency-Key: <new UUID>
```

```json
{"phone":"+65 9123 4567","officeLocation":"Room 101"}
```

成功响应包含 `result`、递增后的 `revision`、完整 `db`；result 的具体业务字段取决于命令，例如创建申请含 application，创建模板含 template，部分命令返回空对象。

## 7. 错误格式和状态码

两套接口的 JSON 格式不同，前端必须分别处理。

统一账号／求职者错误示例：

```json
{"valid":false,"error":"Please log in."}
```

HR 错误示例：

```json
{"error":{"code":"REVISION_CONFLICT","message":"Refresh the workspace before saving.","requestId":"<request-id>"}}
```

HR 错误的 requestId 由后端生成，具体 message 可能随错误场景变化，以上仅示意响应结构。

| HTTP状态 | 说明 |
|---|---|
| 400 | 参数格式错误、无效请求键，或求职者文件上传错误 |
| 401 | 未登录、会话无效、账号禁用或登录凭据不正确 |
| 403 | 角色无权访问、CSRF 错误或请求来源不匹配 |
| 404 | 接口/记录不存在，或不属于当前求职者 |
| 409 | 重复账号、版本冲突、当前业务状态不允许、独立HR登录关闭、HR邮件发送未开启等 |
| 410 | HR 请求关联记录已按留存规则清理 |
| 413 | HR 请求体/文件过大 |
| 422 | HR 业务字段或状态校验失败 |
| 428 | HR 写操作缺少工作台版本 |
| 429 | 达到注册、登录、验证码或上传限流 |
| 500/503 | 服务、数据库或必要配置不可用 |

找回密码限流：同邮箱一分钟一次、一小时五次；验证码校验还受 IP 限流。具体限流以服务器响应为准，不自动重发邮件或反复重试失败的写操作。

## 8. 队友联调顺序与当前边界

1. 启动后端，从同源网页或 Postman 请求 `/api/login`。Postman 保留服务端 Cookie；浏览器设置 credentials。
2. 保存响应里的 csrfToken。刷新网页后可通过 `/api/me` 或 HR 的 `/hr/api/auth/me` 重新获取。
3. 求职者读取 `/api/profile`；HR读取 `/hr/api/hr/workspace`，同时保存最新 revision。
4. 写入时带 CSRF；HR commands 额外带版本和幂等请求键。执行成功后使用最新返回数据，或重新 GET。
5. 测试完成后调用对应 logout。

当前边界：

- 求职者 Jobs、My Resume、Application Status 页面仍读取静态展示数据，不存在与这些页面完全对应的真实求职者招聘 API；真正的求职者资料及简历 API 在 `/api/profile/...`。
- HR 工作台招聘记录保存在独立表中，不自动同步求职者 Profile，也不能把两套 ID 混用。
- HR 邮件发送端点存在，但当前集成明确关闭发送；创建通知草稿不代表投递成功。
- 测试账号密码保存在本机忽略目录 `.local-backup/`，不包含在本接口文档中。账号由项目维护者另行提供。

## 9. 接口代码位置

| 代码文件 | 内容 |
|---|---|
| `server/api.js` | 集中的实际 API 代码：注册、统一登录、退出、找回密码、求职者资料和简历，以及 HR 模块挂载入口 |
| `server/routes/auth.js`、`server/routes/profile.js` | 旧路径兼容导出，实际处理函数已移到 server/api.js |
| `server/app.js` | 会话鉴权、CSRF、来源校验及接口挂载 |
| `server/services/validation.js` | 求职者参数校验规则 |
| `server/services/hr-integration.js` | HR复用统一登录和账号密码 |
| `integrations/hr/server/app.cjs` | HR工作台接口定义；挂载后统一加 `/hr` 前缀 |
| `integrations/hr/server/service.cjs`、`integrations/hr/dist/state.js` | HR命令参数、业务流程及权限规则 |

本文是独立接口说明文件，不会修改数据库或改变应用运行方式。
