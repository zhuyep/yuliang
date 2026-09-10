# 参与余量 / Contributing to Yuliang

谢谢你愿意把一个真实失败案例带回来。余量优先接受能让“今天怎么安排”更可解释、更安全、更容易本机运行的改进，而不是单纯增加指标和面板。

Thank you for bringing a concrete failure case. Yuliang prioritizes changes that make the daily decision more explainable, safer, and easier to run locally—not feature count alone.

## 开始之前 / Before you start

- 不要在 Issue、截图、测试或提交中放入真实健康值、位置、邮箱、设备编号、账号、密码、Cookie 或令牌；
- 使用明确标记的合成数据，日期与身份也应为虚构；
- 数据不足、无效、过期和零值必须保持不同语义；
- 疼痛、生病迹象与专业意见必须能覆盖设备推断；
- 新数据源应输出日汇总格式，不把登录与云同步塞进核心分析层；
- 引用或改编第三方代码时，先确认许可证并保留版权与必要声明。

Do not include real health values, location, account data, screenshots, or credentials. Use clearly labelled synthetic fixtures. Missing, invalid, stale, and zero values must remain distinct. Any third-party source reuse needs a compatible license and preserved notices.

## 本地开发 / Local development

```sh
npm run dev
npm run check
```

Node.js 22.13+ is required. There is no dependency-install step. A pull request should explain the user problem, the boundary affected, and the test that proves the behavior. UI changes should be checked once on a narrow mobile viewport as well as desktop.

## 适合先做的小改进 / Good first contributions

- 为另一种可穿戴设备导出生成 [`daily-summary.schema.json`](docs/daily-summary.schema.json) 所定义的本地 JSON；
- 增加缺失、过期、跨时区或当天未结束的合成测试；
- 改善一个解释不清楚的证据呈现；
- 补充无障碍、键盘操作或移动端问题。

涉及官方 API、云模型、远程遥测、多人账号或健康数据上传的提案，应先开 Issue 说明数据流、授权方式、服务条款和退出方案。它们不会作为普通小改动直接合入。
