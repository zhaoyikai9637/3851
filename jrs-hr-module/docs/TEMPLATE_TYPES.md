# 模板用途类型

`shared/template-types.json` 是唯一类型定义。前端下拉框、后端输入校验和
OpenAPI 请求规则均从此文件生成；当前支持九种类型。原有五种保留以兼容已有数据，
新增四种按招聘阶段和决定方区分的类型，避免笼统使用 `Rejected`。

| 类型代码 | 页面名称 | 适用事件（供队友接入） |
| --- | --- | --- |
| APPLICATION_REJECTION | Application Rejection | Application Review → Rejected |
| INTERVIEW_REJECTION | Interview Rejection | Interview Review → Rejected |
| OFFER_WITHDRAWAL | Offer Withdrawal | Offer → Withdrawn，由公司撤回 |
| OFFER_DECLINED_ACKNOWLEDGEMENT | Offer Declined Acknowledgement | Offer → Declined，由候选人拒绝 |

四份原创英文内容在 `server/data/original-content.json`，仅使用已有四个变量。
`npm.cmd run content:install -- 1` 将缺少的模板加入已确认的本地开发库（请使用实际 HR ID）；
同名模板保留，不覆盖成员修改、旧模板或邮件快照，也不会发邮件。
公司撤回 Offer 的模板必须经 HR 按实际情况审核后使用，不应自动推断撤回原因。

上表是接入约定，不是已完成的自动触发逻辑。现有调用方通过 `templateId` 明确选模板；
仅有 `Rejected` 或 `Closed` 无法判断阶段和决定方，必须由业务模块提供原阶段和拒绝方。
不要通过模板名称猜测，也不要把候选人拒绝 Offer 当作公司拒绝候选人。

新增类型时，在文件中添加一项，例如 `"INTERVIEW_REMINDER": "Interview reminder"`。
代码应唯一、非空、不超过数据库字段的 50 个字符；建议使用大写字母和下划线。
随后执行测试、`npm run docs:export` 和构建，重启后端并刷新开发页面；部署时重新发布前后端。
这不是运行时动态配置：仅修改数据库不会自动增加选项，旧版浏览器也需更新。

遇到未知类型时，列表保留原代码，编辑下拉框显示 `Unsupported: 原代码`，页面解释原因，
禁止保存。可以取消编辑，或明确选择受支持的类型后保存；不会自动改成第一项。
后端继续拒绝未知类型的写入，但读取契约允许显示已有未知类型。
编辑其他内容而保留未知类型目前不支持，应先与团队确认并更新共享配置。

用途分类不等于自动发送规则；新增类型后，仍须与组员约定触发事件、内容变量和发送行为。
此改动不迁移数据库、不修改既有模板、不发送邮件。

回归测试在测试范围内模拟新增类型，覆盖前端选择/保存/重新打开、后端校验、
API 文档规则及未知类型保留与明确改选；模拟类型不会进入真实配置。
