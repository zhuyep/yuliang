# 余量 Yuliang

> 把可穿戴数据，变成今天一条有依据、可被身体感受否决的安排建议。

[English](README.en.md) · [为什么值得公开](docs/PUBLIC_RELEASE.md) · [数据接入](docs/ADAPTERS.md)

[![Quality](https://github.com/zhuyep/yuliang/actions/workflows/quality.yml/badge.svg)](https://github.com/zhuyep/yuliang/actions/workflows/quality.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb.svg)](LICENSE)
[![Local first](https://img.shields.io/badge/data-local--first-287447.svg)](#隐私与安全边界)

余量不是 Garmin 仪表盘，也不是替你诊断的 AI 教练。它只聚焦一个更窄、但每天都会遇到的问题：**睡眠、HRV、静息心率和主观体感有变化时，今天原本的活动该不该调整？**

![余量合成数据演示，画面中不含真实健康记录](docs/assets/yuliang-synthetic-demo.png)

_截图完全由合成数据生成，不代表任何人的真实健康状况。_

## 它解决什么不同的问题

| 常见工具 | 主要回答 | 余量补上的一层 |
| --- | --- | --- |
| 数据采集器 / API | 怎样把数据取出来 | 不负责登录或同步，只接收本机日汇总 |
| 趋势仪表盘 | 最近发生了什么 | 先给出今天是否需要调整，再展开证据 |
| 通用 AI 教练 | 还能生成什么建议 | 规则先于模型；数据不足和身体不适可以阻断建议 |

每次解读都会显示数据日期、有效历史天数、个人中位数和证据编号。疼痛、生病迹象和用户自己的判断优先于设备分数；建议是否采纳、结果如何，可以只在本机补记。生成式 AI 默认关闭，缺少模型时仍能完整体验核心流程。

## 60 秒本地体验

需要 Node.js 22.13 或更高版本。项目没有第三方运行时依赖，无需注册账号，也不需要先安装 npm 包。

`package.json` 中的 `private: true` 只是防止误发 npm 包，不代表 GitHub 仓库私有。

```sh
git clone https://github.com/zhuyep/yuliang.git
cd yuliang
npm run dev
```

打开 <http://127.0.0.1:4173>，点击“试用合成示例”。然后可以：

1. 查看“今天怎么安排”和对应的 E1–E5 证据；
2. 改变原计划、精力或不适状态，重新解读；
3. 追问睡眠、HRV 或安排依据；
4. 记录是否采纳。合成演示不会写入反馈历史。

提交代码前运行：

```sh
npm run check
```

## 数据接入

公开版首先支持合成示例和用户主动选择的日汇总 JSON。导入文件只在本机服务内存中处理；除非用户点击保存反馈，否则不会持久化。格式定义见 [`docs/daily-summary.schema.json`](docs/daily-summary.schema.json)，接入说明见 [`docs/ADAPTERS.md`](docs/ADAPTERS.md)。

如果你已经在本机运行兼容 garmin-grafana 数据结构的 InfluxDB，可显式启用实验性只读适配器：

```sh
YULIANG_DATA_SOURCE=garmin-grafana-influxdb npm run dev
```

它只读取已有本机数据库，不安装采集器、不登录 Garmin、不触发同步，也不会把凭证传给网页或模型。可通过 `YULIANG_GARMIN_DB_CONTAINER` 指定容器名。该兼容层不是 Garmin 官方 API 集成，也不是公开多人授权方案。

## 隐私与安全边界

- 服务只监听 `127.0.0.1`，静态资源使用明确白名单；
- 默认不调用云端服务，不收集使用遥测；
- 反馈写在仓库之外的本机用户目录，合成反馈不落盘；
- 数据缺失、过期或历史不足时，不把未知值当成零，也不生成确定的训练调整；
- 疼痛或生病迹象优先，输出不构成医疗建议、诊断或医疗器械功能；
- 可选 Ollama 解释器默认关闭，只解释已有证据，不获得账号凭证、GPS 或工具权限。

完整说明见[本机使用与模型边界](docs/LOCAL_INSIGHTS.md)、[架构](docs/ARCHITECTURE.md)和[安全策略](SECURITY.md)。

## 当前状态

这是 `v0.2.0` 公共预览版。确定性分析、合成演示、日汇总导入、本机反馈和实验性数据库兼容层已有自动化测试；以下事项仍未完成：

- 规则没有临床验证，不能据此判断训练安全或疾病；
- 没有官方 Garmin 账号授权、自动同步或活动写回；
- 可选本地模型只做过合成协议测试，尚未形成已验证的模型推荐；
- 外部用户价值与持续使用仍待验证，Star 不能替代这项验证。

维护者自用验证仍按 [`DOGFOOD.md`](DOGFOOD.md) 继续。路线图见 [`docs/ROADMAP.md`](docs/ROADMAP.md)。

## 独立来源与贡献

本仓库是独立实现，不是 garmin-grafana 或其他健康项目的 Fork。公开前已复核完整 Git 历史、长行代码重合、第三方说明和合成数据边界；审查方法与仍然存在的不确定性记录在 [`docs/PUBLIC_RELEASE.md`](docs/PUBLIC_RELEASE.md)。通用指标名和数据库字段用于兼容既有数据结构，不代表复制上游实现。

欢迎从三个小入口开始贡献：增加一种本地导出格式、补一个缺失/过期边界测试，或用不含健康数据的方式报告解释不清楚的场景。请先阅读 [`CONTRIBUTING.md`](CONTRIBUTING.md) 和 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

Yuliang 使用 [MIT License](LICENSE)。Garmin、Garmin Connect、Body Battery 及相关标识属于其各自权利人；本项目与 Garmin 无隶属、赞助或背书关系。

## English summary

Yuliang is a local-first wearable decision companion. It turns daily summaries into one explainable activity adjustment, exposes the evidence behind it, and lets discomfort override device scores. It has no account login, cloud AI, telemetry, or automatic sync. Start with the synthetic demo; see the full [English README](README.en.md).
