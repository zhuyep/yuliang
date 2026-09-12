import { scenarioReport } from "./scenarios.mjs";

const copy = {
  zh: {
    skip: "跳到试用", eyebrow: "无需安装 · 合成数据在线试用", title: "数字说了一堆。\n今天，怎么安排？",
    lead: "用一个虚构的早晨，试试设备数据、原计划与身体感受如何一起影响建议。",
    privacy: "只用合成示例，不连接账号、不导入健康数据。切换条件不会发送或保存任何输入。",
    choose: "选一个情境", usual: "照常的一天", tired: "今天有点累", missing: "设备漏了记录",
    minutes: "原计划活动时长", unitMinutes: "分钟", discomfort: "假设出现疼痛不适", overrideHint: "看看身体感受能否否决设备分数。", reset: "重置示例",
    synthetic: "合成情境 · 非本人数据", why: "为什么会这样？", evidence: "依据，摊开看。",
    tableCaption: "合成当天数据与此前个人中位数比较", metric: "指标", today: "示例当天", baseline: "此前中位数", sample: "有效历史日",
    evidenceNote: "“此前中位数”取合成当天之前 28 天内的有效值；它不是医学阈值。缺失值不会被当作零。",
    nextTitle: "这个判断过程，对你有用吗？", nextBody: "本地版支持自己选择的日汇总 JSON、依据追问和本机反馈。欢迎告诉我们：哪里看不懂，或哪一步还解决不了你的问题。",
    local: "试用本地版 ↗", feedback: "反馈一个问题 ↗", feedbackNote: "反馈会由你在 GitHub 确认后发布；请只描述体验，不填写健康指标、账号或私人截图。",
    footer: "公共预览 · 确定性规则，未启用生成式 AI。不是医疗建议，也不判断训练是否安全。与 Garmin 无隶属或背书关系。",
    missingValue: "缺失", plan: (n) => `原计划：日常活动 ${n} 分钟 · 中等强度（虚构）`, coverage: (r) => `合成日期 ${r.dataDate} · ${r.historyDays} 个历史日`,
    modes: { observe: "先观察", lighten: "留些余地", insufficient: "信息不足", pause: "不适优先" },
    reasons: {
      observe: "数据变化只供你核对，不能单独确认训练安全。没有额外体感信号时，规则不主动提高或降低训练量。",
      lighten: "触发可选调整的是你选择的“今天有点累”，不是一个 HRV 数字。不适和主观感受有独立作用。",
      insufficient: "合成当天的 HRV 缺失。规则暂停调整，保留未知，不把没有记录解释成状态差。",
      pause: "“疼痛不适”覆盖其他情境，即使数据齐全或分数看起来不错，也停止推荐原定训练。",
    },
  },
  en: {
    skip: "Skip to demo", eyebrow: "No install · Interactive synthetic example", title: "Plenty of numbers.\nWhat changes today?",
    lead: "Try a fictional morning. See how wearable data, your plan, and how you feel contribute to one activity suggestion.",
    privacy: "Synthetic examples only. No account or health-data import. Changing a condition sends and stores no input.",
    choose: "Choose a situation", usual: "An ordinary day", tired: "Feeling tired", missing: "A missing record",
    minutes: "Planned activity time", unitMinutes: "min", discomfort: "Suppose there is pain", overrideHint: "See whether discomfort can overrule device scores.", reset: "Reset example",
    synthetic: "Fictional situation · Not your data", why: "Why this result?", evidence: "Open the evidence.",
    tableCaption: "Synthetic current values and prior personal medians", metric: "Metric", today: "Example day", baseline: "Prior median", sample: "Valid prior days",
    evidenceNote: "Medians use valid values from the 28 days before the synthetic example day. They are not medical thresholds. Missing values never become zero.",
    nextTitle: "Would this help you decide?", nextBody: "The local app adds daily-summary JSON import, evidence questions, and local feedback. Tell us what was unclear, or what still fails to solve your problem.",
    local: "Try the local app ↗", feedback: "Share a problem ↗", feedbackNote: "You review and submit feedback on GitHub. Describe the experience only; do not include health values, accounts, or private screenshots.",
    footer: "Public preview · Deterministic rules, no generative AI. Not medical advice or a training-safety assessment. Not affiliated with or endorsed by Garmin.",
    missingValue: "Missing", plan: (n) => `Original plan: ${n} minutes of moderate activity (fictional)`, coverage: (r) => `Synthetic date ${r.dataDate} · ${r.historyDays} prior days`,
    modes: { observe: "Observe first", lighten: "Leave some room", insufficient: "Not enough data", pause: "Discomfort first" },
    reasons: {
      observe: "Changes in these values cannot confirm training safety. Without an additional check-in signal, the rules do not increase or reduce your planned activity.",
      lighten: "Your selection of feeling tired triggers the optional adjustment, not a single HRV value. How you feel has an independent role.",
      insufficient: "HRV is missing on the synthetic example day. The rules withhold an adjustment rather than treating missing data as a poor condition.",
      pause: "Pain overrides the other scenarios. Even complete records or apparently good scores cannot justify recommending the original activity.",
    },
  },
};
const englishResults = {
  observe: ["Look at the changes before deciding.", "Use the original plan as a reference. These values cannot establish training safety; consider how you feel and do not automatically raise intensity."],
  lighten: ["Feeling tired? Leave some room today.", "You can choose to shorten the activity, reduce intensity, or rest based on low energy. This is an optional adjustment, not a diagnosis from the device."],
  insufficient: ["Not enough information to adjust the plan.", "Check the record and its time first. Keep the original plan for reference; insufficient data does not mean you are in poor condition."],
  pause: ["Attend to discomfort before device scores.", "The original activity is no longer recommended. A device cannot explain pain or illness; significant, worsening, or persistent discomfort calls for professional assessment."],
};
const englishMetrics = { sleepMinutes: ["Sleep duration", "min"], hrvMs: ["Nightly HRV", "ms"], restingHeartRate: ["Resting heart rate", "bpm"] };
const requestedLanguage = new URLSearchParams(location.search).get("lang");
let language = ["zh", "en"].includes(requestedLanguage) ? requestedLanguage : navigator.language.startsWith("zh") ? "zh" : "en";
let scenario = "usual";
const $ = (selector) => document.querySelector(selector);

function render() {
  const t = copy[language];
  const report = scenarioReport({ scenario, pain: $("#discomfort").checked, minutes: Number($("#minutes").value) });
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  for (const element of document.querySelectorAll("[data-copy]")) element.textContent = t[element.dataset.copy];
  $("#language").textContent = language === "zh" ? "English" : "中文";
  $("#language").setAttribute("aria-label", language === "zh" ? "Switch to English" : "切换到中文");
  $("#duration").textContent = report.plan.minutes;
  $("#mode").textContent = t.modes[report.mode];
  $(".reading").dataset.mode = report.mode;
  $("#headline").textContent = language === "zh" ? report.headline : englishResults[report.mode][0];
  $("#action").textContent = language === "zh" ? report.action : englishResults[report.mode][1];
  $("#reason").textContent = t.reasons[report.mode];
  $("#plan").textContent = t.plan(report.plan.minutes);
  $("#coverage").textContent = t.coverage(report);
  const rows = report.evidence.slice(0, 3).map((item) => {
    const row = document.createElement("tr");
    const [label, unit] = language === "en" ? englishMetrics[item.key] : [item.label, item.unit];
    const name = document.createElement("td");
    const id = document.createElement("span");
    id.className = "evidence-id";
    id.textContent = item.id;
    name.append(id, label);
    row.append(name);
    for (const value of [item.value === null ? t.missingValue : `${item.value} ${unit}`, item.baseline === null ? t.missingValue : `${item.baseline} ${unit}`, String(item.baselineCount)]) {
      const cell = document.createElement("td"); cell.textContent = value; row.append(cell);
    }
    return row;
  });
  $("#evidence-rows").replaceChildren(...rows);
  for (const button of document.querySelectorAll("[data-scenario]")) button.setAttribute("aria-pressed", String(button.dataset.scenario === scenario));
  $("#local-link").href = language === "zh" ? "https://github.com/zhuyep/yuliang#60-秒本地体验" : "https://github.com/zhuyep/yuliang/blob/main/README.en.md#try-it-in-60-seconds";
}

for (const button of document.querySelectorAll("[data-scenario]")) button.addEventListener("click", () => { scenario = button.dataset.scenario; render(); });
$("#discomfort").addEventListener("change", render);
$("#minutes").addEventListener("input", render);
$("#language").addEventListener("click", () => { language = language === "zh" ? "en" : "zh"; render(); });
$("#reset").addEventListener("click", () => { scenario = "usual"; $("#discomfort").checked = false; $("#minutes").value = "30"; render(); });
try { render(); } catch {
  $("#headline").textContent = "示例加载失败 / Example could not load";
  $("#action").textContent = "请刷新，或从下方 GitHub 链接运行本地版。 / Reload or try the local app from the GitHub link below.";
}
