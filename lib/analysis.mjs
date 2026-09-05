export const METRICS = {
  sleepMinutes: { label: "睡眠时长", unit: "分钟", range: [1, 1440] },
  hrvMs: { label: "夜间平均 HRV", unit: "毫秒", range: [1, 300] },
  restingHeartRate: { label: "静息心率", unit: "次/分", range: [25, 220] },
  bodyBatteryMorning: { label: "晨起 Body Battery", unit: "点", range: [0, 100] },
  steps: { label: "步数", unit: "步", range: [0, 150000] },
};
export const localDate = (value = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
export const validDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const validMetric = (key, value) => typeof value === "number" && Number.isFinite(value) && value >= METRICS[key].range[0] && value <= METRICS[key].range[1];
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
};
const round = (value) => Math.round(value * 10) / 10;

export function normalizeRows(rows) {
  if (!Array.isArray(rows) || rows.length > 400) throw new Error("invalid_rows");
  const dates = new Set();
  return rows.map((row) => {
    if (!validDate(row?.date) || dates.has(row.date)) throw new Error("invalid_or_duplicate_date");
    dates.add(row.date);
    const invalidKeys = Object.keys(METRICS).filter((key) => (row[key] !== undefined && row[key] !== null && !validMetric(key, row[key])) || (Array.isArray(row.invalidKeys) && row.invalidKeys.includes(key)));
    return Object.fromEntries([["date", row.date], ["invalidKeys", invalidKeys], ...Object.keys(METRICS).map((key) => [key, validMetric(key, row[key]) ? row[key] : null])]);
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function normalizeInput(body = {}) {
  const plan = body.plan || {};
  const checkin = body.checkin || {};
  if (typeof plan.activity !== "string" || !plan.activity.trim() || plan.activity.length > 40
    || !Number.isInteger(plan.minutes) || plan.minutes < 5 || plan.minutes > 240
    || !["easy", "moderate", "hard"].includes(plan.intensity)
    || !["low", "normal", "high"].includes(checkin.energy)
    || ["pain", "illness", "soreness"].some((key) => typeof checkin[key] !== "boolean")) throw new Error("invalid_plan");
  return { plan: { activity: plan.activity.trim(), minutes: plan.minutes, intensity: plan.intensity },
    checkin: Object.fromEntries(["energy", "pain", "illness", "soreness"].map((key) => [key, checkin[key]])) };
}

export function buildReport(snapshot, input, now = new Date()) {
  const { plan, checkin } = normalizeInput(input);
  const rows = normalizeRows(snapshot.rows);
  const calendarToday = localDate(now);
  const eligible = rows.filter((row) => row.date <= calendarToday);
  const current = eligible.at(-1);
  if (!current) throw new Error("no_data");
  const cutoff = new Date(Date.parse(current.date) - 28 * 86400000).toISOString().slice(0, 10);
  const history = eligible.filter((row) => row.date >= cutoff && row.date < current.date);
  const syncTime = Date.parse(snapshot.syncedAt);
  const stale = current.date !== calendarToday || !Number.isFinite(syncTime) || now.getTime() - syncTime > 36 * 3600000 || syncTime > now.getTime() + 300000;
  const evidence = Object.entries(METRICS).map(([key, spec], index) => {
    const prior = history.map((row) => row[key]).filter((value) => validMetric(key, value));
    const baseline = prior.length >= 7 ? round(median(prior)) : null;
    const value = current[key];
    const invalid = current.invalidKeys.includes(key);
    return { id: `E${index + 1}`, key, ...spec, range: undefined, date: current.date, value, invalid,
      baseline, baselineCount: prior.length, baselineStart: cutoff, baselineEnd: new Date(Date.parse(current.date) - 86400000).toISOString().slice(0, 10),
      delta: key === "steps" && current.date === calendarToday ? null : value !== null && baseline !== null ? round(value - baseline) : null,
      partial: key === "steps" && current.date === calendarToday,
      note: invalid ? "原始值类型或范围无效，已排除；不将它解释为零或没有佩戴。" : key === "steps" && current.date === calendarToday ? "今天尚未结束，不与全天步数比较。" : prior.length < 7 ? "历史有效样本不足，不计算个人常态。" : "与此前 28 天内有效记录的中位数比较；不是医学阈值。" };
  });
  const essentials = evidence.filter((item) => ["sleepMinutes", "hrvMs", "restingHeartRate"].includes(item.key));
  const missing = essentials.filter((item) => item.value === null && !item.invalid).map((item) => item.label);
  const invalid = evidence.filter((item) => item.invalid).map((item) => item.label);
  const insufficient = essentials.some((item) => item.baseline === null);
  const limits = ["本页为活动安排辅助，不用于疾病诊断；设备分数不能推翻你的不适或专业意见。"];
  if (stale) limits.unshift("数据不是当天、同步时间未知或已过期：以下为历史回顾，不生成今天的训练调整。");
  if (missing.length) limits.push(`缺少：${missing.join("、")}。缺失不代表零。`);
  if (invalid.length) limits.push(`记录值无效：${invalid.join("、")}。已排除计算，请核对来源。`);
  if (insufficient) limits.push("部分指标不足 7 个有效历史日，暂不建立其个人常态。7 天是产品展示门槛，不是医学有效性标准。");
  if (snapshot.source === "demo") limits.unshift("合成演示数据，不是你的真实健康状况；演示反馈不会落盘。");
  if (snapshot.source === "import") limits.push("本地文件由你提供，来源和完整性未独立核验。");
  let mode = "observe";
  let headline = "先看变化，再决定今天怎么安排。";
  let action = `原计划：${plan.activity} ${plan.minutes} 分钟。仅凭这些指标无法确认训练安全性；先结合体感决定，不主动增加强度。`;
  if (stale || missing.length || invalid.length || insufficient) {
    mode = "insufficient";
    headline = "信息还不够，先不替你调整训练。";
    action = "先核对同步时间与缺失记录。原计划保留供你参考，不把数据不足解释成身体状态差。";
  } else if (checkin.energy === "low" || checkin.soreness) {
    mode = "lighten";
    headline = "你感觉累，今天给安排留些余地。";
    action = "基于你补充的低精力或酸痛，可以选择缩短、降低强度或休息；这是可选安排，不是设备作出的诊断。";
  }
  if (checkin.pain || checkin.illness) {
    mode = "pause";
    headline = "先处理不适，不让设备分数催你训练。";
    action = "不继续推荐原定训练。设备无法判断疼痛或生病原因；明显、加重或持续的不适应寻求专业评估。";
  }
  const summary = essentials.filter((item) => item.value !== null).map((item) => `${item.label} ${item.value} ${item.unit}${item.baseline !== null ? `，此前常态 ${item.baseline} ${item.unit}` : "，历史样本不足"} [${item.id}]`).join("；");
  return { source: snapshot.source, generatedAt: now.toISOString(), dataDate: current.date, syncedAt: snapshot.syncedAt || null,
    historyDays: history.length, windowDays: 28, mode, headline, action, summary, evidence, limits, plan, checkin,
    quality: { stale, missing, invalid, insufficient }, engine: "本机计算与规则解释 · 非生成式 AI" };
}

export function answerLocally(report, question) {
  let chosen = report.evidence.filter((item) => {
    const words = { sleepMinutes: /睡|sleep/i, hrvMs: /hrv|变异/i, restingHeartRate: /心率|rhr/i, bodyBatteryMorning: /电量|battery|余量/i, steps: /步|走路|steps/i };
    return words[item.key].test(question);
  });
  if (!chosen.length && /为什么|依据|安排|运动|跑|分钟|累|疲劳/.test(question)) chosen = report.evidence.filter((item) => item.key !== "steps").slice(0, 3);
  if (!chosen.length) return { engine: "本机依据检索", answer: "生成式 AI 尚未启用。当前可以查询睡眠、HRV、静息心率、晨起电量、步数和建议依据；其他问题暂不能可靠回答。", evidenceIds: [] };
  const facts = chosen.map((item) => item.value === null ? `${item.label}${item.invalid ? "的原始值无效，已排除" : "没有记录"} [${item.id}]。` : `${item.date} 的${item.label}为 ${item.value} ${item.unit}；${item.baseline === null ? "有效历史不足，不作个人常态比较" : `此前有效 ${item.baselineCount} 天中位数为 ${item.baseline} ${item.unit}`}。${item.note} [${item.id}]`).join("\n");
  return { engine: "本机依据检索", answer: `${facts}\n\n${report.action}\n这不是生成式 AI 回答，相关性也不等于原因。若要修改可用时间，请在“今天的安排”中修改后重新解读。`, evidenceIds: chosen.map((item) => item.id) };
}

export function demoSnapshot(now = new Date()) {
  const date = localDate(now);
  const rows = Array.from({ length: 29 }, (_, index) => ({ date: new Date(Date.parse(date) - (28 - index) * 86400000).toISOString().slice(0, 10),
    sleepMinutes: index === 28 ? 395 : 420 + (index % 5) * 8, hrvMs: index === 28 ? 40 : 45 + index % 3,
    restingHeartRate: index === 28 ? 59 : 55 + index % 3, bodyBatteryMorning: 60 + index % 8, steps: index === 28 ? 1800 : 6000 + index * 30 }));
  return { source: "demo", syncedAt: now.toISOString(), rows };
}

export function importSnapshot(value) {
  if (!value || !Array.isArray(value.days) || value.days.length < 1 || value.days.length > 90
    || typeof value.syncedAt !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(value.syncedAt) || !Number.isFinite(Date.parse(value.syncedAt))) throw new Error("invalid_import");
  return { source: value.demo === true ? "demo" : "import", syncedAt: value.syncedAt, rows: normalizeRows(value.days) };
}
