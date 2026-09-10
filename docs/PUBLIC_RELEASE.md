# 公共预览评估 / Public preview review

评估日期：2026-09-10

## 结论

**余量有被参考的价值，适合以公共预览版公开；但不适合包装成成熟的 Garmin AI 教练。**

真正可复用的部分不是采集更多指标，而是一个小而完整的决策回路：日汇总输入 → 个人历史中位数 → 数据质量闸门 → 主观感受否决 → 带证据的当日安排 → 采纳与结果反馈。这个切口与采集器、趋势仪表盘和通用聊天教练不同，也能在没有 Garmin 账号、云服务和生成式模型时独立运行。

**Yuliang has enough reference value for a public preview, but not enough evidence to present itself as a mature AI coach.** Its reusable contribution is the decision loop and safety boundary, not another data collector or dashboard.

## 外部项目说明了什么

以下为 GitHub 在评估日显示的公开数据，数字会继续变化：

| 项目 | Star | 主要价值 | 对余量的启示 |
| --- | ---: | --- | --- |
| [garmin-grafana](https://github.com/arpanghosh8453/garmin-grafana) | 3,455 | 本地采集、InfluxDB、Grafana 趋势 | 本地可穿戴数据存在真实需求，但采集和看板不是余量应重复建设的层 |
| [open-wearables](https://github.com/the-momentum/open-wearables) | 2,482 | 统一多品牌可穿戴 API | 跨设备输入有价值，公开核心应保持设备中立 |
| [python-garminconnect](https://github.com/cyberjunky/python-garminconnect) | 2,966 | Garmin Connect Python 客户端 | 连接层需求强，但非官方登录不是本项目的公开产品基础 |
| [open-health](https://github.com/OpenHealthForAll/open-health) | 3,949 | 广义个人健康 AI 助手 | 大而全赛道已有强项目，余量需要坚持窄问题和本机边界 |

评估日抽查的五个直接“Garmin + AI/coach/assistant”小项目只有 0–3 Star。这个对比不能证明余量会获得 Star，但说明简单拼接 Garmin 数据和 AI 文案没有明显传播优势。余量应坚持四个差异点：

1. **决策优先**：先回答今天原计划是否需要调整，再展示指标；
2. **证据可追溯**：日期、有效天数、中位数和 E1–E5 引用始终可见；
3. **现实可以否决设备**：疼痛、生病迹象和用户判断高于分数；
4. **本地即可完整运行**：无账号、无遥测、无第三方运行时依赖，模型关闭也能工作。

Garmin 官方的 [Developer Program](https://developer.garmin.com/gc-developer-program/)、[Health API](https://developer.garmin.com/gc-developer-program/health-api/) 与 [FAQ](https://developer.garmin.com/gc-developer-program/program-faq/) 表明正式云端集成需要申请和相应授权。因此，本次公开不加入 Garmin 登录、自动同步或多人授权。未来若做更通用的文件互操作，可另行评估官方免费的 [FIT SDK](https://developer.garmin.com/fit/overview/)。

## 独立来源审查

公开前完成了以下有边界的来源检查：

- 仓库不是 GitHub Fork；现有历史只有两个由 `zhuyep` 提交的线性提交，没有第三方合并提交；
- 遍历全部历史路径，没有数据库、私人目录、截图、定位或大于 100 KB 的历史 Blob；
- 历史敏感模式扫描只命中检查器自身的凭证正则和测试里的 `synthetic` 会话值；
- 将当前仓库 1,498 条长度至少 48 字符的唯一源码/文档行，与本机独立 checkout 的 garmin-grafana 1,123 条同类行逐行比较，精确重合为 0；
- 对四条独特产品文案或环境变量做 GitHub 代码检索，仓库外没有精确结果；
- 运行时没有第三方 npm 依赖、远程字体、远程脚本或复制的上游资源。

这些证据支持“目前没有发现复制他人实现”的结论，但不是数学意义上的原创性证明。标准 HTTP 服务器写法、通用健康指标名、`DailyStats` 等兼容字段和公开协议形状可能与其他项目相似；这类事实性接口相似不应被说成独家发明。相关第三方关系已在 [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) 明示。

## 公开适应性改进

- 项目名称和首页定位改为设备中立的 wearable decision companion；
- 以 MIT 许可公开，补充中英文 README、贡献指南、安全报告入口和 Issue/PR 模板；
- 发布标准日汇总 JSON Schema，允许其他本地导出工具复用核心；
- 将数据库环境变量命名改为明确的 `garmin-grafana-influxdb` 兼容层，并保留旧值作为本机兼容；
- 容器名可配置且受字符白名单约束，不接收任意命令；
- 增加只读 CI、公开截图的合成数据声明和完整历史检查记录；
- 保留 28 天中位数、数据新鲜度、缺失/零值区分和不适覆盖等原有安全边界。

## 仍未验证与停止条件

公开仓库、CI 通过、页面可打开或 Star 增加，都不能证明真实采用和健康收益。当前仍未验证：独立用户能否顺利导入、建议是否持续帮助决策、实际本地模型是否改善解释，以及经验规则是否适用于更多人。

出现以下情况时应停止增长动作，先修产品或缩小范围：

- 用户必须交出 Garmin 密码或真实健康数据才能体验；
- 建议让用户忽视疼痛、生病迹象或专业意见；
- 外部试用反复卡在数据导入，核心价值无法在合成示例中理解；
- 公开维护成本主要消耗在非官方登录失效，而不是决策体验；
- 两轮独立试用后仍没有具体的“帮助了哪次决策”证据。

因此，本次发布等级定义为 **public preview / code and product reference**，不是医疗产品、官方 Garmin 客户端或已验证的 AI 教练。
