> **当前版本 2.5.0 已取消自动学历关卡。学历条件只写在 Job Requirements 中，HR 查看简历决定是否推进；不再要求录入学历、专业或毕业日期。下列自动筛选和暂停 Offer 的内容仅为历史版本说明，以 [HR_REVIEW_v2.5.md](HR_REVIEW_v2.5.md) 为准。**

> v2.4.0 更新：学历、专业及毕业状态改为自动判断，手动 Graduate status 已移除。规则与当前字段见 [AUTO_SCREENING_v2.4.md](AUTO_SCREENING_v2.4.md)，以下旧版说明以该更新为准。

> v2.3.2：Job Requirements 改为保存 8–12 条实质要求，前端与 API 共用验证；详情见 [REQUIREMENTS_v2.3.2.md](REQUIREMENTS_v2.3.2.md)。以下旧版描述以该更新为准。

# 毕设演示反馈修改说明

版本 2.3.0 · 2026-10-16

## 老师反馈逐项对应

| 反馈 | 本版行为 |
|---|---|
| 补上 Job Description | 简历审核右侧直接显示职位描述，读取职位中实际保存的内容；在 Job Postings 编辑职位即可更新。 |
| Job Requirements 自身为 8–12 行 | 单独的编号列表显示 8–12 条：结合已保存的要求、经验、学历、技能、雇佣类型、工作方式、地点、部门及毕业身份规则。超过 12 条的内容归并到末条，不丢弃要求。长文字会自然换行。 |
| 应届毕业生不能进入面试或获得 Offer | 新增 Graduate status 字段，前端按钮禁用，后端再次校验。进入面试、安排/改期、准备/批准 Offer、准备正式邮件、记录接受均检查。已存在的正式面试/Offer 草稿在发送前也检查。 |
| 删除重复 Resume Review / Resume | 正文不再重复显示 Resume Review 大标题；顶栏保留当前位置，简历文件名只在文档工具栏出现一次。 |
| 简历采用滚动设计 | 示例简历两页连续排列，默认适合宽度；在简历区域滚动查看。上传 PDF 使用浏览器 PDF 阅读器，保留下载、打印、打开及全屏入口。 |
| Pending Review 改名 | 页面、导航、状态标签、报表和导出改为正确拼写 Applications Review；数据库内部状态值保留 Pending Review，旧链接自动兼容。 |
| Interview Results 独立页面，并包含简历 | 点击 View Results 或头像进入独立结果页面：左侧简历，右侧评分、建议、反馈和面试记录，底部 Prepare Offer / Reject / Activity；也可展开职位描述及要求。 |
| 面试列表列名调整 | Candidate 改为 Applicant；Position 列改为 Interview Status。职位名称保留在申请人下方，便于识别。 |
| 点击头像看简历 | 申请列表头像及姓名为简历入口；面试结果阶段直接打开带简历的结果页。 |
| 功能按钮在右侧 | 审核行右侧显示 Move to Interview、Reject、Details；其他阶段显示相应操作。搜索、职位和状态筛选在工具栏左侧，Export / Filters / Receive Application 在右侧。 |
| 增加状态筛选 | Applications Review 页面可筛选审核、面试、结果、Offer、Rejected、Hired 或全部状态。职位、姓名和高级筛选可组合使用。 |
| 左侧不要三级导航 | 左侧仍为 Applications 下的四个分类，不添加第三级菜单；右上方保留可点击的当前位置路径。 |
| 减少上下滚动 | 桌面列表按窗口大小分页；审核/结果页固定工作区，长简历和要求在各自区域内滚动。小屏采用纵向排列以保证内容和操作可访问。 |

## 升级已有数据库

当前电脑已经升级原运行目录的本地数据库，没有重新生成演示记录或重置账号。

如果解压到另一目录，将原项目的 `.env.local` 复制到新项目根目录，然后运行：

```powershell
npm ci
npm run db:init:local
npm run start:local
```

已有数据不要运行 `db:seed:local`。`.env.local` 含私人密码，不包含在本源码包中。

新增字段是 `hr_candidate.graduate_status`：

- `Fresh graduate`：应届毕业生，不能进入面试或 Offer。
- `Experienced`：界面显示 Not a fresh graduate，代表已明确确认为非应届毕业生；不根据经验年数自动设置。
- `Not recorded`：旧数据尚未录入身份，须先确认。

旧记录默认 Not recorded。打开申请头像 → Edit applicant → 根据实际情况选择 Graduate status → Save Candidate。系统保留既有阶段及历史，不自动把人标为应届毕业生或拒绝，也不猜测毕业年份。

## 演示检查顺序

1. Applications → Applications Review：确认搜索和筛选在左侧、操作在右侧，重复标题已移除。
2. 点头像：确认简历可滚动、Job Description 可见、Job Requirements 为 8–12 条。
3. 在测试申请中填入 Fresh graduate：确认 Move to Interview 禁用，提示说明原因。接口绕过检查由自动测试覆盖。
4. 为实际符合条件的申请填入 Not a fresh graduate，再按原流程进入面试、安排时间、录入反馈。
5. Interview Results → View Results：查看简历和反馈，再选择 Prepare Offer 或 Reject。
6. Interviews：检查 Applicant 和 Interview Status 列，以及原有改期/取消/反馈功能。

## 验证及边界

- 71 项 Node 自动测试通过，包含应届/未录入身份、直接命令绕过、旧客户端字段保留、模板及正式邮件检查。
- 两组独立本地 MySQL 集成测试通过，覆盖新字段保存、旧结构迁移、回滚、并发和五年清理。
- 本地 HTTP 完整流程通过：登录 → 收取申请 → 简历上传下载 → 审核 → 安排面试 → 反馈 → Offer → 批准 → 接受，以及拒绝、任务及资料保存。
- 实际浏览器验证 1304×828 和 1092×768 桌面窗口：申请列表无整页滚动或横向溢出；390×844 窄屏可访问全部内容。简历滚动到第二页时外层位置保持不变。
- 测试使用本地隔离数据，未向申请人发送真实邮件，也未写入小组共享数据库。共享库的统一表结构和登录适配仍是既有待对接事项，不能把本地测试当作共享库对接完成。
