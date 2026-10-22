> **当前版本 2.5.0 已取消自动学历关卡。学历条件只写在 Job Requirements 中，HR 查看简历决定是否推进；不再要求录入学历、专业或毕业日期。下列自动筛选和暂停 Offer 的内容仅为历史版本说明，以 [HR_REVIEW_v2.5.md](HR_REVIEW_v2.5.md) 为准。**

# 自动学历、专业和毕业状态筛选

版本 2.4.1 · 2026-10-17

## 已确认的规则

候选人的学历、专业和毕业日期作为事实资料保存。HR 不再选择是否应届或是否通过，系统针对每一份申请对应的职位自动判断。

- 学历低于职位的最低学历：Not eligible，禁止进入面试或 Offer。
- 专业不在该职位的允许专业列表中：Not eligible，禁止进入面试或 Offer。
- 毕业日期在当前日历年，且已经毕业：Fresh graduate，禁止进入面试或 Offer。
- 毕业日期在未来：Not graduated，禁止进入面试或 Offer。
- 必要资料缺失，或职位没有配置最低学历：Information required，禁止推进，补齐资料后重新判断。
- 全部条件满足：Eligible，可继续正常审核和招聘流程。

使用新加坡时区的日期，按日历年判断，不采用毕业后 12 个月的滚动窗口。例如以 2026 年为例：2026 年已毕业属于应届；2025 年毕业属于往年毕业；尚未到来的毕业日期属于尚未毕业。跨年会重新计算，不依赖过去保存的分类。

筛选不会自动拒绝、删除申请或改变申请阶段。HR 仍根据完整材料作出招聘决定，但不符合已确认条件的申请无法推进至面试和 Offer。

## 职位设置

在 Job Postings 创建或编辑职位：

1. Minimum qualification：配置最低学历；No minimum qualification 表示该职位不限制学历等级。
2. Accepted fields of study：用逗号分隔允许的专业，任意一项匹配即可；明确留空表示不限制专业。
3. Job Requirements：仍保留 8–12 条实质岗位要求。Role template 可填入该角色建议的专业条件和岗位要求，保存前可编辑。

学历按 Secondary school、Certificate、Diploma、Associate degree、Bachelor degree、Master degree、Doctorate 排序。更高学历满足较低的最低等级。

专业比较忽略大小写及标点，识别明确的同义缩写（例如 CS / Computer Science、IT / Information Technology），不使用模糊子字符串判断或自行推断“相关专业”。如需允许额外专业，在职位配置中明确添加。

## 申请资料和页面

在 Receive Application 接收新申请时记录申请人提交的 Highest qualification、Field of study、Graduation date。Qualification details 为可选补充说明，不用它替代结构化字段。既有申请的学历资料只读，不在 HR 审核过程中修改以通过筛选。Edit Contact Details 只更新联系资料、经验和技能。

接收新申请时，毕业日期的只读预览自动显示毕业状态；保存后系统逐职位判断，无需 HR 手动选择通过或应届身份。

审核及面试结果页只显示简短筛选结论：Requirements met、Requirements not met 或 Awaiting applicant info。确认不匹配时附一行具体原因，列表保留实际业务状态和简短提示，不再重复毕业日期长说明。职位未配置条件时显示 Job criteria not configured。推进按钮随结果启用或禁用，后台接口再次检查。

没有新增独立的候选人门户；现有 HR 收取申请功能可记录候选人提供的事实资料，小组申请模块也可通过既有认证 API 传递这些字段。

## 数据升级

当前电脑本地数据库已升级，原有申请、职位、阶段和记录保留。新增：

| 表 | 字段 |
|---|---|
| hr_candidate | education_level、education_major、graduation_date |
| hr_job_position | minimum_education_level、accepted_majors |

迁移只把明确的旧学历文本转换为结构化等级和专业，不推测毕业日期。十个完全匹配现有演示模板的职位会填入对应的最低学历和专业条件，自定义职位需确认自己的条件。

旧记录没有毕业日期时，页面简短显示 Awaiting applicant info，后台仍为 Information required。此前手动选择的 graduate_status 保留为兼容旧备份的字段，不再参与自动筛选；传入 Experienced 等旧标记不能绕过规则。

解压到新目录时复制原来的 .env.local，在项目目录运行 npm ci、npm run db:init:local、npm run start:local。已有数据不要执行 db:seed:local。共享数据库仍需按 TEAM_SETUP.md 审核适配；本次没有修改共享库。

## API 字段

- application-create 的 candidate：educationLevel、educationMajor、graduationDate。毕业日期为 YYYY-MM-DD 或 null。
- candidate-save 仅编辑联系资料、经验和技能；学历、专业、毕业日期、学历说明和旧版 graduateStatus 不允许实际更改，返回 422。兼容旧客户端省略或提交等同原值的字段，既有事实原样保留。
- job-save：minimumEducationLevel、acceptedMajors。允许专业可为数组或逗号分隔文本；省略编辑字段会保留原条件。
- Screening 的结果实时计算；客户端提交的通过标记、graduateStatus、伪造的职位条件不会替代数据库中的实际资料。

## 验证

99 项自动测试、两组本地真实 MySQL 集成测试和完整 HTTP 招聘流程通过，覆盖学历全部等级组合、逐职位专业匹配、跨年、未来及无效毕业日期、资料不足、字段持久化、迁移保护、六类面试/Offer 操作、正式邮件重新校验及伪造请求。

实际浏览器确认手动应届选择已移除；日期预览分别识别 2026 年、2023 年和未来日期；职位模板可填写自动匹配所需的专业条件。检查未保存测试日期到既有申请人，也未发送邮件。

本文件取代旧版本中由 HR 手动选择 Graduate status 或在审核时修改学历资料的说明。v2.4.1 的界面、拒绝确认及验证说明见 [SCREENING_UX_v2.4.1.md](SCREENING_UX_v2.4.1.md)。
