> v2.4.0 更新：学历、专业及毕业状态改为自动判断，手动 Graduate status 已移除。规则与当前字段见 [AUTO_SCREENING_v2.4.md](AUTO_SCREENING_v2.4.md)，以下旧版说明以该更新为准。

# Job Requirements 完善

版本 2.3.2 · 2026-10-16

## 显示与内容

审核和面试结果页面的 Job Requirements 现在直接读取职位中保存的岗位要求，不再用部门、地点、雇佣类型或工作方式补数量，也不把超出的条目挤进最后一条。

项目现有十类演示职位各提供 10 条可编辑的要求：Software Developer、UI Designer、Data Analyst、Marketing Executive、Support Officer、System Analyst、Backend Engineer、HR Business Partner、DevOps Engineer、Finance Executive。内容包括相关学历、专业经验、具体技能、实践能力、沟通协作及已确认的非应届毕业生规则。

例如 Software Developer 包含 Java / Spring Boot、React、SQL / REST API、Docker / 云部署、Git 与代码审查、调试与单元测试。其他职位采用各自的要求，不复用一份通用列表。

部门、地点、雇佣类型和工作方式放在独立的 Job Information 展开区。Job Description 仍单独显示。

8–12 条是录入项数：编辑器每行一条。显示时长句会按屏幕宽度自然换行，保留完整内容。

## 新建和编辑职位

- Job Requirements 编辑器显示当前条数，要求 8–12 条不同的条件。
- 支持粘贴带编号或项目符号的列表，保存时清理列表标记和空行。
- 前端与后台共同检查条数、重复、单条长度和总长度；不合格的输入不能保存。
- 可选择 Role template，再点击 Use role template 填入建议内容。模板是编辑起点，只有点击 Save Job Posting 才会保存。
- 已有自定义职位不会被自动改写。旧要求不足 8 条时原样显示，并提供补全提示；编辑保存时必须满足规则。

## 已有演示数据升级

当前电脑的十个本地默认演示职位已升级，每个职位保存 10 条要求。升级前备份了职位记录；其他职位字段、申请人资料和申请阶段保留。

其他目录使用旧演示数据库时，可先预览再升级：

```powershell
npm run db:preview-requirements:local
npm run db:upgrade-requirements:local
```

脚本只处理完全匹配旧版默认条件的十个样例职位，保留改过的资格、技能和自定义要求。重复执行不会再次更改数据。共享或远程数据库会被阻止，不需要为本次改动增加数据库字段。

## 主要文件

| 文件 | 用途 |
|---|---|
| dist/job-requirements.js | 十类职位模板、解析和规则；浏览器与后台共用 |
| dist/state.js | 新样例数据和职位保存时的强制检查 |
| dist/review.js | 原样显示要求，以及独立的 Job Information |
| dist/app.js | 条数提示、角色模板和保存前检查 |
| scripts/upgrade-demo-requirements.cjs | 旧默认演示职位的安全升级 |

## 验证

81 项自动测试通过；两组真实本地 MySQL 集成测试通过，覆盖要求持久化、升级预览不写入、只更新要求、事务版本和重复执行。独立本地 HTTP 完整流程通过。

浏览器确认审核页展示 10 条实质要求、无整页溢出；Job Information 独立显示；编辑页 3 条要求被阻止保存；新建页 UI Designer 模板能填入 10 条要求。测试表单未保存额外职位。

本文件取代旧版文档中“通过职位资料补足要求条数”的描述。
