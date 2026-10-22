# 左侧导航精简

版本 2.3.1 · 2026-10-16

按最新要求，删除左侧 Applications 下的 Applications Review、Interview Results、Rejected、Offer 四个子菜单及展开箭头。左侧只显示 Applications 主入口和总数量。

分类切换使用右侧申请列表上方的状态筛选框。每个分类列表均提供该筛选，选择后更新页面地址和顶部路径；选择 All statuses 返回全部申请。

简历、结果及申请资料页面仍将左侧 Applications 标为当前位置。已有分类链接和 Pending Review 旧链接继续可用。

验证：35 项前端及流程检查通过；实际浏览器确认子菜单不存在，Offer → Applications Review → Interview Results → Offer 可以切换，顶部路径同步更新。

这是 v2.3.0 导航要求的后续调整。DEMO_FEEDBACK_v2.3.md 中的两级菜单描述为历史版本记录，其余简历、职位说明、毕业身份校验等功能继续适用。

当前电脑原运行目录已更新，刷新 http://localhost:3000 即可。若使用新压缩包，在含 package.json 的目录安装依赖，并复制原项目的 .env.local 后运行 npm run start:local。
