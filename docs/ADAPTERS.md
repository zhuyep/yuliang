# 数据接入 / Data adapters

余量把“取数”和“解释今天”分开。公开核心不登录设备账号；任何本地工具只要能生成统一日汇总，就可以复用分析、证据和反馈流程。

Yuliang separates data retrieval from the daily decision. The public core does not log in to wearable accounts. Any local tool can reuse the analysis, evidence, and feedback flow by producing the daily-summary format.

## 首选方式：日汇总 JSON

格式定义在 [`daily-summary.schema.json`](daily-summary.schema.json)。最小输入包含带时区的 `syncedAt` 和至少一天数据：

```json
{
  "syncedAt": "2026-09-10T08:00:00+08:00",
  "days": [
    {
      "date": "2026-09-10",
      "sleepMinutes": 420,
      "hrvMs": 45,
      "restingHeartRate": 56
    }
  ]
}
```

- 最多 90 天；日期不可重复，按 `YYYY-MM-DD` 表示；
- `syncedAt` 必须包含时区；
- 缺失值省略或写 `null`，不要用零冒充缺失；
- 未识别字段会被忽略，原始导入文件不会保存；
- `demo: true` 只用于完全合成的示例，真实记录不能这样标记。

The import accepts at most 90 unique dates. Missing values are omitted or `null`, never fake zeros. Unknown fields are ignored and the original file is not stored. Use `demo: true` only for fully synthetic data.

## 实验性 garmin-grafana InfluxDB 兼容层

已有兼容数据库的高级用户可以运行：

```sh
YULIANG_DATA_SOURCE=garmin-grafana-influxdb npm run dev
```

默认容器名为 `garmin-local-influxdb-1`。如名称不同：

```sh
YULIANG_DATA_SOURCE=garmin-grafana-influxdb \
YULIANG_GARMIN_DB_CONTAINER=my-local-influxdb \
npm run dev
```

该适配器通过固定 SELECT 查询读取 `DailyStats`、`SleepSummary` 和最后一次 `DeviceSync` 时间。数据库读取账号与密码由现有容器提供，经标准输入交给本机 `curl`，不出现在命令参数、网页、日志或模型提示中。设备名称只用于判断更新时间，返回值会被丢弃。

This optional adapter executes fixed read-only queries against an existing compatible local container. It does not include, install, modify, or authenticate the third-party collector. The legacy value `garmin-docker` remains accepted for existing private installations, but new documentation uses the explicit compatibility-layer name.

## 新适配器的边界

新适配器应先在仓库之外完成数据获取，再向余量提供标准化日汇总。提交前必须说明：

1. 数据来自用户主动导出、官方授权 API，还是其他方式；
2. 是否需要账号凭证，凭证存在哪里；
3. 是否向互联网发送数据，如何关闭和删除；
4. 单位、时区、当天未结束数据和重复记录如何处理；
5. 第三方许可证、商标与服务条款是否允许该用法。

Do not add a connector that requires contributors to post credentials or real health data in an issue. An official Garmin integration would require separate program approval and is outside this preview.
