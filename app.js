const SAMPLE_DATA = {
  meta: {
    source: "可穿戴合成示例",
    syncedAt: "2026-09-04T07:12:00+08:00",
    completeness: 0.96,
    demo: true,
  },
  today: {
    date: "2026-09-04",
    sleepMinutes: 402,
    deepSleepMinutes: 72,
    hrvMs: 41,
    restingHeartRate: 58,
    bodyBatteryMorning: 58,
    bodyBatteryOvernightGain: 42,
    stressYesterday: 38,
  },
  baseline: {
    windowDays: 28,
    sleepMinutes: 438,
    hrvMs: 45,
    restingHeartRate: 55,
    stress: 31,
  },
  plan: {
    activity: "跑步",
    durationMinutes: 45,
    intensity: "中等",
    time: "18:30",
  },
  week: [
    { date: "2026-08-31", activity: "步行", detail: "42 分钟", status: "complete" },
    { date: "2026-09-01", activity: "力量", detail: "28 分钟", status: "complete" },
    { date: "2026-09-02", activity: "恢复", detail: "已完成", status: "rest" },
    { date: "2026-09-03", activity: "快走", detail: "36 分钟", status: "complete" },
    { date: "2026-09-04", activity: "节奏跑", detail: "45 分钟", status: "planned" },
    { date: "2026-09-05", activity: "低强度", detail: "45 分钟", status: "planned" },
    { date: "2026-09-06", activity: "休息", detail: "散步可选", status: "rest" },
  ],
};

const state = {
  data: structuredClone(SAMPLE_DATA),
  checkin: {
    energy: "normal",
    soreness: false,
    pain: false,
    illness: false,
    stress: false,
  },
  accepted: false,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const ui = {
  title: $("#recommendation-title"),
  summary: $("#recommendation-summary"),
  actionTime: $("#action-time"),
  actionTitle: $("#action-title"),
  actionDetail: $("#action-detail"),
  confidence: $("#confidence-chip"),
  routeCaption: $("#route-caption"),
  energyLine: $("#energy-line"),
  energyLineShadow: $("#energy-line-shadow"),
  morningPoint: $("#morning-point"),
  middayPoint: $("#midday-point"),
  eveningPoint: $("#evening-point"),
  activityPin: $("#activity-pin"),
  routeDescription: $("#route-desc"),
  evidenceList: $("#evidence-list"),
  todayDate: $("#today-date"),
  weekRange: $("#week-range"),
  weekStrip: $("#week-strip"),
  weeklyLoad: $("#weekly-load"),
  baselineLabel: $("#baseline-label"),
  sourceLabel: $("#source-label"),
  railSyncTime: $("#rail-sync-time"),
  sourceDialogLabel: $("#source-dialog-label"),
  sourceDialogCopy: $("#source-dialog-copy"),
  sourceSyncTime: $("#source-sync-time"),
  sourceCompleteness: $("#source-completeness"),
  importStatusTitle: $("#import-status-title"),
  importStatusCopy: $("#import-status-copy"),
  toast: $("#toast"),
};

function minutesLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return `${hours} 小时 ${remainder} 分`;
}

function signed(value, unit = "") {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}${unit}`;
}

function analyze(data, checkin) {
  const { today, baseline, plan } = data;
  const sleepDelta = today.sleepMinutes - baseline.sleepMinutes;
  const hrvDeltaPercent = ((today.hrvMs - baseline.hrvMs) / baseline.hrvMs) * 100;
  const rhrDelta = today.restingHeartRate - baseline.restingHeartRate;
  const stressDelta = today.stressYesterday - baseline.stress;
  let load = 0;
  const evidence = [];

  if (sleepDelta <= -60) load -= 2;
  else if (sleepDelta <= -25) load -= 1;
  else if (sleepDelta >= 30) load += 1;

  if (hrvDeltaPercent <= -12) load -= 2;
  else if (hrvDeltaPercent <= -6) load -= 1;
  else if (hrvDeltaPercent >= 8) load += 1;

  if (rhrDelta >= 6) load -= 2;
  else if (rhrDelta >= 3) load -= 1;

  if (today.bodyBatteryMorning < 35) load -= 2;
  else if (today.bodyBatteryMorning < 62) load -= 1;
  else if (today.bodyBatteryMorning >= 75) load += 1;

  if (stressDelta >= 12) load -= 1;
  if (data.meta.completeness < 0.7) load -= 2;
  if (checkin.energy === "low") load -= 2;
  if (checkin.energy === "high") load += 1;
  if (checkin.soreness) load -= 1;
  if (checkin.stress) load -= 1;

  evidence.push({
    title: `睡眠比个人常态${sleepDelta < 0 ? "少" : "多"} ${Math.abs(Math.round(sleepDelta))} 分钟`,
    note: sleepDelta < -25 ? "这是今天保留强度的重要原因。" : "目前没有明显拖累今日安排。",
    weight: Math.abs(sleepDelta) / 30,
  });
  evidence.push({
    title: `夜间 HRV 比 ${baseline.windowDays} 天中位数${hrvDeltaPercent < 0 ? "低" : "高"} ${Math.abs(Math.round(hrvDeltaPercent))}%`,
    note: "单日变化只作为辅助信号，需要看连续趋势。",
    weight: Math.abs(hrvDeltaPercent) / 8,
  });
  evidence.push({
    title: `晨起 Body Battery 为 ${today.bodyBatteryMorning}`,
    note: today.bodyBatteryMorning < 62 ? "可以活动，但没有足够证据支持高强度。" : "余量较充足，可维持原计划。",
    weight: Math.abs(70 - today.bodyBatteryMorning) / 10,
  });
  evidence.push({
    title: `静息心率比个人常态${rhrDelta < 0 ? "低" : "高"} ${Math.abs(Math.round(rhrDelta))} 次/分`,
    note: rhrDelta >= 3 ? "偏高会降低今天的建议强度。" : "目前没有形成明显拖累。",
    weight: Math.abs(rhrDelta) / 2,
  });
  evidence.push({
    title: `昨日压力比个人常态${stressDelta < 0 ? "低" : "高"} ${Math.abs(Math.round(stressDelta))} 点`,
    note: stressDelta >= 12 ? "明显偏高会降低今天的建议强度。" : "目前没有单独触发减量。",
    weight: Math.abs(stressDelta) / 7,
  });
  if (data.meta.completeness < 0.9) {
    evidence.unshift({
      title: `本次数据完整性为 ${Math.round(data.meta.completeness * 100)}%`,
      note: data.meta.completeness < 0.7 ? "数据不足会让建议更保守。" : "建议置信度已相应降低。",
      weight: data.meta.completeness < 0.7 ? 4 : 2,
    });
  }

  if (checkin.energy !== "normal" || checkin.soreness || checkin.pain || checkin.illness || checkin.stress) {
    const labels = [];
    if (checkin.energy === "low") labels.push("精力偏低");
    if (checkin.energy === "high") labels.push("主观精力不错");
    if (checkin.soreness) labels.push("明显酸痛");
    if (checkin.pain) labels.push("疼痛不适");
    if (checkin.illness) labels.push("有生病迹象");
    if (checkin.stress) labels.push("压力很大");
    evidence.unshift({
      title: `你刚刚补充：${labels.join("、")}`,
      note: "主观感受优先级高于设备分数。",
      weight: 5,
    });
  }

  let mode = "normal";
  if (checkin.pain || checkin.illness || load <= -6) mode = "recover";
  else if (data.meta.completeness < 0.7 || load <= -2) mode = "lighten";

  const output = {
    mode,
    confidence: data.meta.completeness >= 0.9 ? "中等" : data.meta.completeness >= 0.7 ? "偏低" : "低",
    evidence: evidence.sort((a, b) => b.weight - a.weight),
    time: plan.time || "18:30",
  };

  if (mode === "recover") {
    const safetyOverride = checkin.pain || checkin.illness;
    output.title = checkin.pain || checkin.illness ? "今天，先照顾身体。" : "今天，把恢复放前面。";
    output.summary = checkin.pain
      ? "你报告了疼痛不适。设备数据不能判断原因，今天不建议继续原定训练。"
      : checkin.illness
        ? "你报告了可能生病的迹象。取消高强度，把观察身体变化放在第一位。"
        : "多个恢复信号同时偏弱。暂停高强度，保留非常轻松的日常活动即可。";
    output.actionTitle = checkin.pain
      ? "暂停训练，按身体情况处理"
      : checkin.illness
        ? "暂停原定训练，观察身体"
        : "10—20 分钟舒缓活动（可选）";
    output.actionDetail = checkin.pain
      ? "若疼痛明显、加重或持续，请寻求专业评估；不要用设备分数自行诊断。"
      : checkin.illness
        ? "优先休息。若症状明显、持续或加重，请寻求专业意见。"
        : "只在感觉舒服时散步或伸展；任何不适都可以直接停止。";
    output.routeCaption = "恢复优先";
    output.planLabel = "恢复 / 休息";
    output.planDuration = "按身体感觉";
    output.path = "M48 145C150 132 218 155 302 176c95 24 178 60 270 82";
    output.morningY = 145;
    output.midday = { x: 302, y: 176, label: "白天变化" };
    output.evening = { x: 572, y: 258, label: "晚间保留" };
    output.activity = { x: 425, y: 215, label: "舒缓可选" };
    output.hideActivity = safetyOverride;
    if (safetyOverride) output.time = "今天";
  } else if (mode === "lighten") {
    const adjustedDuration = Math.max(20, Math.round((plan.durationMinutes * 0.67) / 5) * 5);
    output.title = "今天，留一点力气。";
    output.summary = `恢复信号有些分歧。保留活动习惯，但把原来的${plan.intensity}${plan.activity}改成轻松活动更稳妥。`;
    output.actionTitle = `${adjustedDuration} 分钟轻松${plan.activity === "跑步" ? "跑或快走" : plan.activity}`;
    output.actionDetail = "以能完整说出一句话的强度进行；结束后留 5 分钟舒缓。";
    output.routeCaption = "适度保留";
    output.planLabel = "轻松活动";
    output.planDuration = `${adjustedDuration} 分钟`;
    output.path = "M48 118C151 88 215 124 302 142c92 19 173 37 270 88";
    output.morningY = 118;
    output.midday = { x: 302, y: 142, label: "白天变化" };
    output.evening = { x: 572, y: 230, label: "晚间保留" };
    output.activity = { x: 428, y: 182, label: "轻松活动" };
  } else {
    output.title = "今天，可以按计划出发。";
    output.summary = "恢复指标与主观感受基本一致。维持原计划即可，不需要因为单个数字临时加码。";
    output.actionTitle = `${plan.durationMinutes} 分钟${plan.intensity}${plan.activity}`;
    output.actionDetail = "按原计划进行；若热身后感觉明显不对，随时切换为轻松模式。";
    output.routeCaption = "按计划进行";
    output.planLabel = plan.activity;
    output.planDuration = `${plan.durationMinutes} 分钟`;
    output.path = "M48 105C151 82 215 101 302 121c92 20 173 44 270 75";
    output.morningY = 105;
    output.midday = { x: 302, y: 121, label: "白天变化" };
    output.evening = { x: 572, y: 196, label: "晚间保留" };
    output.activity = { x: 428, y: 161, label: `${plan.intensity}${plan.activity}` };
  }

  return output;
}

function render(output) {
  ui.title.textContent = output.title;
  ui.summary.textContent = output.summary;
  ui.actionTime.textContent = output.time;
  ui.actionTitle.textContent = output.actionTitle;
  ui.actionDetail.textContent = output.actionDetail;
  ui.confidence.textContent = `置信度：${output.confidence}`;
  ui.baselineLabel.textContent = `与个人 ${state.data.baseline.windowDays} 天基线比较`;
  ui.routeCaption.textContent = output.routeCaption;
  ui.routeDescription.textContent = output.hideActivity
    ? `晨起 Body Battery 为 ${Math.round(state.data.today.bodyBatteryMorning)}。由于用户报告了疼痛或生病迹象，今天不安排训练；曲线不是精力预测。`
    : `晨起 Body Battery 为 ${Math.round(state.data.today.bodyBatteryMorning)}，建议在 ${output.time} 进行${output.activity.label}。曲线只表示安排思路，不是精力预测。`;

  ui.energyLine.setAttribute("d", output.path);
  ui.energyLineShadow.setAttribute("d", output.path);
  ui.energyLine.style.animation = "none";
  requestAnimationFrame(() => {
    ui.energyLine.style.animation = "draw-route 780ms cubic-bezier(0.65, 0, 0.35, 1) forwards";
  });

  ui.morningPoint.setAttribute("transform", `translate(48 ${output.morningY})`);
  $("text", ui.morningPoint).textContent = `晨起 ${Math.round(state.data.today.bodyBatteryMorning)}`;
  ui.middayPoint.setAttribute("transform", `translate(${output.midday.x} ${output.midday.y})`);
  $("text", ui.middayPoint).textContent = output.midday.label;
  ui.eveningPoint.setAttribute("transform", `translate(${output.evening.x} ${output.evening.y})`);
  $("text", ui.eveningPoint).textContent = output.evening.label;
  ui.activityPin.setAttribute("transform", `translate(${output.activity.x} ${output.activity.y})`);
  $("text", ui.activityPin).textContent = output.activity.label;
  ui.activityPin.style.display = output.hideActivity ? "none" : "";

  ui.evidenceList.innerHTML = output.evidence
    .map(({ title, note }) => `<li><strong>${escapeHtml(title)}</strong><span>${escapeHtml(note)}</span></li>`)
    .join("");

  renderSignals();
  renderDateAndWeek(output);
  renderSource();
}

function renderSignals() {
  const { today, baseline } = state.data;
  const sleepDelta = today.sleepMinutes - baseline.sleepMinutes;
  const hrvDelta = ((today.hrvMs - baseline.hrvMs) / baseline.hrvMs) * 100;
  const rhrDelta = today.restingHeartRate - baseline.restingHeartRate;
  const stressDelta = today.stressYesterday - baseline.stress;

  const sleep = $('[data-signal="sleep"]');
  sleep.classList.toggle("is-attention", sleepDelta <= -25);
  $(".signal-top span:last-child", sleep).className = sleepDelta < 0 ? "trend-down" : "trend-good";
  $(".signal-top span:last-child", sleep).textContent = `${signed(sleepDelta, " 分钟")}`;
  $(":scope > strong", sleep).textContent = minutesLabel(today.sleepMinutes);
  $(".mini-track i", sleep).style.width = `${Math.min(100, Math.round((today.sleepMinutes / 510) * 100))}%`;
  $(".mini-track b", sleep).style.left = `${Math.min(98, Math.round((baseline.sleepMinutes / 510) * 100))}%`;
  $(":scope > p", sleep).textContent = sleepDelta <= -25
    ? `低于你近 ${baseline.windowDays} 天的常态，今天不宜只看睡眠分数。`
    : sleepDelta >= 25
      ? `高于你近 ${baseline.windowDays} 天的常态，为今天提供了较好的恢复基础。`
      : `与近 ${baseline.windowDays} 天常态接近，暂时没有明显异常。`;

  const hrv = $('[data-signal="hrv"]');
  hrv.classList.toggle("is-attention", hrvDelta <= -6);
  $(".signal-top span:last-child", hrv).className = hrvDelta < -3 ? "trend-down" : hrvDelta > 3 ? "trend-good" : "";
  $(".signal-top span:last-child", hrv).textContent = `${signed(hrvDelta, "%")}`;
  $(":scope > strong", hrv).innerHTML = `${Math.round(today.hrvMs)} <small>ms</small>`;
  $(".mini-track i", hrv).style.width = `${Math.max(2, Math.min(100, (today.hrvMs / 80) * 100))}%`;
  $(".mini-track b", hrv).style.left = `${Math.max(2, Math.min(98, (baseline.hrvMs / 80) * 100))}%`;
  $(".mini-track", hrv).setAttribute("aria-label", `当前 HRV 与 ${baseline.windowDays} 天中位数比较`);
  $(":scope > p", hrv).textContent = hrvDelta <= -6
    ? "略低于个人中位数；连续趋势比单日更重要。"
    : hrvDelta >= 6
      ? "高于个人中位数，是恢复较好的辅助信号。"
      : "接近个人中位数，单日变化无需过度解读。";

  const rhr = $('[data-signal="rhr"]');
  rhr.classList.toggle("is-attention", rhrDelta >= 4);
  $(".signal-top span:last-child", rhr).className = rhrDelta >= 3 ? "trend-up" : rhrDelta <= -2 ? "trend-good" : "";
  $(".signal-top span:last-child", rhr).textContent = signed(rhrDelta);
  $(":scope > strong", rhr).innerHTML = `${Math.round(today.restingHeartRate)} <small>bpm</small>`;
  $(".mini-track i", rhr).style.width = `${Math.max(2, Math.min(100, today.restingHeartRate))}%`;
  $(".mini-track b", rhr).style.left = `${Math.max(2, Math.min(98, baseline.restingHeartRate))}%`;
  $(".mini-track", rhr).setAttribute("aria-label", `当前静息心率与 ${baseline.windowDays} 天基线比较`);
  $(":scope > p", rhr).textContent = rhrDelta >= 3
    ? "比常态稍高，需要结合睡眠、压力和身体感受判断。"
    : rhrDelta <= -2
      ? "略低于个人常态，目前没有显示额外恢复压力。"
      : "与个人常态接近，目前没有明显偏离。";

  const battery = $('[data-signal="battery"]');
  battery.classList.toggle("is-attention", today.bodyBatteryMorning < 35);
  $(".signal-top span:last-child", battery).textContent = `+${Math.round(today.bodyBatteryOvernightGain)} 一夜`;
  $(":scope > strong", battery).innerHTML = `${Math.round(today.bodyBatteryMorning)} <small>/ 100</small>`;
  $(".battery-track i", battery).style.width = `${Math.max(0, Math.min(100, today.bodyBatteryMorning))}%`;
  $(":scope > p", battery).textContent = today.bodyBatteryMorning < 35
    ? "晨起余量偏低，今天优先恢复并观察身体感受。"
    : today.bodyBatteryMorning < 62
      ? "足够维持活动习惯，不适合追求峰值表现。"
      : "晨起余量充足，可以支持原定活动安排。";

  const stress = $('[data-signal="stress"]');
  stress.classList.toggle("is-attention", stressDelta >= 10);
  $(".signal-top span:last-child", stress).className = stressDelta >= 6 ? "trend-up" : stressDelta <= -4 ? "trend-good" : "";
  $(".signal-top span:last-child", stress).textContent = signed(stressDelta);
  $(":scope > strong", stress).innerHTML = `${Math.round(today.stressYesterday)} <small>/ 100</small>`;
  $(".mini-track i", stress).style.width = `${today.stressYesterday}%`;
  $(".mini-track b", stress).style.left = `${baseline.stress}%`;
  $(":scope > p", stress).textContent = stressDelta >= 10
    ? "明显高于个人常态，可能拖慢了恢复。"
    : stressDelta >= 5
      ? "略高于个人常态，需要结合当天背景判断。"
      : stressDelta <= -5
        ? "低于个人常态，昨日整体压力相对较轻。"
        : "与个人常态接近，目前没有明显偏离。";
}

function parseLocalDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) || isoDate(date) !== value ? null : date;
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeIsoTimestamp(value) {
  if (typeof value !== "string") return null;
  const isoTimestamp = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;
  if (!isoTimestamp.test(value) || !parseLocalDate(value.slice(0, 10))) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatWeekRange(start, end) {
  if (start.getMonth() === end.getMonth()) {
    return `${start.getMonth() + 1} 月 ${start.getDate()} 日—${end.getDate()} 日`;
  }
  return `${start.getMonth() + 1} 月 ${start.getDate()} 日—${end.getMonth() + 1} 月 ${end.getDate()} 日`;
}

function renderDateAndWeek(output) {
  const todayDate = parseLocalDate(state.data.today.date);
  if (!todayDate) return;

  const weekday = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][todayDate.getDay()];
  ui.todayDate.textContent = `${todayDate.getMonth() + 1} 月 ${todayDate.getDate()} 日 · ${weekday}`;

  const weekStart = new Date(todayDate);
  weekStart.setDate(todayDate.getDate() - ((todayDate.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  ui.weekRange.textContent = formatWeekRange(weekStart, weekEnd);

  const planned = new Map((state.data.week || []).map((item) => [item.date, item]));
  ui.weeklyLoad.textContent = state.data.meta.demo
    ? "示例 · 适中"
    : state.data.week.length === 0
      ? "数据不足"
      : "未计算";
  ui.weekStrip.innerHTML = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const dateKey = isoDate(date);
    const isToday = dateKey === state.data.today.date;
    const entry = planned.get(dateKey);
    const activity = isToday ? output.planLabel : entry?.activity || "未提供";
    const detail = isToday ? output.planDuration : entry?.detail || "—";
    const statusClass = isToday
      ? "is-today"
      : entry?.status === "complete"
        ? "is-complete"
        : entry?.status === "rest" || !entry
          ? "is-rest"
          : "";
    const dayName = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
    return `<article class="day-card ${statusClass}"><span>${dayName}</span><time datetime="${dateKey}">${String(date.getDate()).padStart(2, "0")}</time><i></i><strong>${escapeHtml(activity)}</strong><small>${escapeHtml(detail)}</small></article>`;
  }).join("");
}

function renderSource() {
  const { meta } = state.data;
  const date = new Date(meta.syncedAt);
  const relative = Number.isNaN(date.getTime())
    ? "时间未知"
    : `${date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;

  ui.sourceLabel.textContent = meta.source || "本地导入数据";
  $("#source-button").setAttribute("aria-label", `查看数据来源：${meta.source || "本地导入数据"}`);
  ui.railSyncTime.textContent = relative;
  ui.sourceDialogLabel.textContent = meta.source || "本地导入数据";
  ui.sourceDialogCopy.textContent = meta.demo
    ? "当前展示的是一组用于验证界面的模拟数据，没有连接任何设备账户。"
    : "当前数据来自你刚刚导入的本地文件，只在这个浏览器会话中处理。";
  ui.sourceSyncTime.textContent = Number.isNaN(date.getTime()) ? "未知" : date.toLocaleString("zh-CN", { hour12: false });
  ui.sourceCompleteness.textContent = `${Math.round((meta.completeness ?? 0) * 100)}%`;
  ui.importStatusTitle.textContent = meta.demo ? "当前为示例数据" : "当前为本地导入数据";
  ui.importStatusCopy.textContent = meta.demo
    ? "可以导入符合原型格式的 JSON；文件只在这个浏览器里处理，不会上传。"
    : "这份数据只在当前浏览器会话中处理。刷新页面后会回到示例数据。";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => ui.toast.classList.remove("is-visible"), 2600);
}

function isNumberInRange(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isShortText(value, max = 60) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function validateImportedData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (!isShortText(value?.today?.date, 10) || !parseLocalDate(value.today.date)) return false;
  if (!isShortText(value?.meta?.syncedAt, 40) || !normalizeIsoTimestamp(value.meta.syncedAt)) return false;
  if (!isNumberInRange(value.meta.completeness, 0, 1)) return false;

  const ranges = [
    [value.today.sleepMinutes, 1, 1440],
    [value.today.hrvMs, 1, 300],
    [value.today.restingHeartRate, 25, 220],
    [value.today.bodyBatteryMorning, 0, 100],
    [value.today.bodyBatteryOvernightGain, 0, 100],
    [value.today.stressYesterday, 0, 100],
    [value.baseline.sleepMinutes, 1, 1440],
    [value.baseline.hrvMs, 1, 300],
    [value.baseline.restingHeartRate, 25, 220],
    [value.baseline.stress, 0, 100],
    [value.baseline.windowDays, 7, 365],
  ];
  if (!ranges.every(([number, min, max]) => isNumberInRange(number, min, max))) return false;
  if (!Number.isInteger(value.baseline.windowDays)) return false;

  if (value.plan !== undefined) {
    if (!isShortText(value.plan?.activity, 30)) return false;
    if (!isNumberInRange(value.plan?.durationMinutes, 1, 360)) return false;
    if (!["轻松", "中等", "较高"].includes(value.plan?.intensity)) return false;
    if (typeof value.plan?.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.plan.time)) return false;
  }

  if (value.week !== undefined) {
    if (!Array.isArray(value.week) || value.week.length > 31) return false;
    if (!value.week.every((item) => isShortText(item?.date, 10) && parseLocalDate(item.date)
      && isShortText(item?.activity, 30) && isShortText(item?.detail, 40)
      && ["complete", "planned", "rest"].includes(item?.status))) return false;
  }
  return true;
}

function normalizeImportedData(value) {
  const fallbackPlan = { activity: "日常活动", durationMinutes: 30, intensity: "轻松", time: "18:30" };
  return {
    meta: {
      source: isShortText(value.meta.source, 60) ? value.meta.source.trim() : "本地导入数据",
      syncedAt: normalizeIsoTimestamp(value.meta.syncedAt),
      completeness: value.meta.completeness,
      demo: value.meta.demo === true,
    },
    today: { ...value.today },
    baseline: { ...value.baseline },
    plan: value.plan ? { ...value.plan } : fallbackPlan,
    week: value.week ? value.week.map((item) => ({ ...item })) : [],
  };
}

function updateAdvice(message = "今日建议已按你的感受更新") {
  state.accepted = false;
  $("#accept-plan").textContent = "按这个安排";
  render(analyze(state.data, state.checkin));
  showToast(message);
}

function setupInteractions() {
  $$('.segmented[data-checkin="energy"] button').forEach((button) => {
    button.addEventListener("click", () => {
      $$('.segmented[data-checkin="energy"] button').forEach((item) => {
        item.classList.remove("is-selected");
        item.setAttribute("aria-pressed", "false");
      });
      button.classList.add("is-selected");
      button.setAttribute("aria-pressed", "true");
      state.checkin.energy = button.dataset.value;
    });
  });

  $$(".toggle-chip").forEach((button) => {
    button.addEventListener("click", () => {
      const pressed = button.getAttribute("aria-pressed") === "true";
      button.setAttribute("aria-pressed", String(!pressed));
      state.checkin[button.dataset.toggle] = !pressed;
      if (!pressed && ["pain", "illness"].includes(button.dataset.toggle)) {
        updateAdvice(button.dataset.toggle === "pain" ? "疼痛不适已立即覆盖原建议" : "生病迹象已立即覆盖原建议");
      }
    });
  });

  $("#update-advice").addEventListener("click", () => updateAdvice());

  $("#why-button").addEventListener("click", () => {
    const panel = $("#evidence-panel");
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    $("#why-button").setAttribute("aria-expanded", String(willOpen));
    if (willOpen) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  $("#accept-plan").addEventListener("click", () => {
    state.accepted = !state.accepted;
    $("#accept-plan").textContent = state.accepted ? "本次会话已采用" : "按这个安排";
    showToast(state.accepted ? "已在本次会话标记为采用；刷新页面后不会保留" : "已撤销本次会话的采用标记");
  });

  const planDialog = $("#plan-dialog");
  $("#change-plan").addEventListener("click", () => planDialog.showModal());
  $("#save-plan").addEventListener("click", (event) => {
    event.preventDefault();
    state.data.plan = {
      activity: $("#planned-activity").value,
      durationMinutes: Number($("#planned-duration").value),
      intensity: $("#planned-intensity").value,
      time: $("#planned-time").value,
    };
    planDialog.close();
    updateAdvice("已根据原计划重新计算");
  });

  const sourceDialog = $("#source-dialog");
  $("#source-button").addEventListener("click", () => sourceDialog.showModal());
  $("#close-source").addEventListener("click", () => sourceDialog.close());

  $("#metric-help").addEventListener("click", () => {
    $("#data").scrollIntoView({ behavior: "smooth" });
    showToast("先区分设备记录、程序判断和你的感受");
  });

  $(".avatar-button").addEventListener("click", () => {
    showToast("个人档案将在接入真实可穿戴数据时开放");
  });

  $("#import-data").addEventListener("click", () => $("#data-file").click());

  $("#data-file").addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      if (file.size > 256 * 1024) throw new Error("file too large");
      const imported = JSON.parse(await file.text());
      if (!validateImportedData(imported)) throw new Error("invalid data");
      state.data = normalizeImportedData(imported);
      updateAdvice("本地数据已导入，没有上传到服务器");
    } catch {
      showToast("无法读取：请使用原型说明中的 JSON 格式");
    } finally {
      event.target.value = "";
    }
  });

  $("#reset-demo").addEventListener("click", () => {
    state.data = structuredClone(SAMPLE_DATA);
    state.checkin = { energy: "normal", soreness: false, pain: false, illness: false, stress: false };
    $$('.segmented[data-checkin="energy"] button').forEach((button) => {
      const selected = button.dataset.value === "normal";
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    $$(".toggle-chip").forEach((button) => button.setAttribute("aria-pressed", "false"));
    updateAdvice("已恢复示例数据");
  });

  const links = $$(".nav-link, .mobile-nav a");
  const sections = ["today", "signals", "week", "data"].map((id) => document.getElementById(id));
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) => {
        const active = link.getAttribute("href") === `#${visible.target.id}`;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    },
    { rootMargin: "-25% 0px -60%", threshold: [0.05, 0.2, 0.5] },
  );
  sections.forEach((section) => observer.observe(section));
}

setupInteractions();
render(analyze(state.data, state.checkin));
