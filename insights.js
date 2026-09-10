const $ = (selector) => document.querySelector(selector);
let session, report, selectedSource, imported, editingFeedback;
let loading = false;
let inputVersion = 0;
let feedbackVersion = 0;
let questionVersion = 0;
const labels = { live: "本机可穿戴数据", demo: "合成演示 · 非真实记录", import: "本地文件 · 来源未经核验" };
const decisions = { adopted: "采纳", modified: "部分采纳", ignored: "没有采纳" };
const outcomes = { unrecorded: "尚未记录结果", better: "比预想轻松", same: "符合预期", worse: "更累或不适" };
const text = (selector, value) => { $(selector).textContent = value; };
function resetFeedbackEditor() {
  editingFeedback = null; feedbackVersion += 1;
  $("#feedback-form").reset();
  text("#feedback-message", "当前解读的反馈尚未保存；补记旧结果请在历史记录中选择。");
}
function invalidateExplanation(message) {
  report = null; questionVersion += 1;
  text("#reading-mode", message);
  text("#reading-summary", "上一份解释已失效，重新解读后显示。");
  text("#answer-engine", ""); text("#answer", "上一份回答已失效，请先重新解读。");
  text("#reading-action", "等待重新解读。不适优先处理，不依赖设备分数。");
}
const formatTime = (value) => value ? new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : "未知";
async function api(path, body) {
  const response = await fetch(path, { method: body ? "POST" : "GET", headers: { "x-yuliang-session": session.token, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "请求未完成。");
  return value;
}
function input() {
  return { plan: { activity: $("#plan-activity").value, minutes: Number($("#plan-minutes").value), intensity: $("#plan-intensity").value },
    checkin: { energy: $("#check-energy").value, soreness: $("#check-soreness").checked, pain: $("#check-pain").checked, illness: $("#check-illness").checked } };
}
function element(tag, content, className) {
  const node = document.createElement(tag); if (content !== undefined) node.textContent = content; if (className) node.className = className; return node;
}
function render(value) {
  report = value;
  text("#source-state", labels[report.source]);
  text("#sync-state", `设备最后上传：${formatTime(report.syncedAt)} · 本页读取：${formatTime(report.generatedAt)}（均为上海时间）`);
  text("#report-date", `数据日期 ${report.dataDate}`);
  text("#reading-mode", report.engine);
  text("#reading-title", report.headline); text("#reading-summary", report.summary || "缺少可解读指标。"); text("#reading-action", report.action);
  $("#reading-limits").replaceChildren(...report.limits.map((limit) => element("li", limit)));
  text("#coverage-state", `此前 28 天窗口内有 ${report.historyDays} 天记录；各指标有效天数见下方。`);
  $("#evidence-list-live").replaceChildren(...report.evidence.map((item) => {
    const card = element("article", undefined, "evidence-item"); card.id = item.id;
    const title = element("h3"); title.append(element("span", item.id, "evidence-id"), document.createTextNode(item.label));
    const value = element("div", item.value === null ? item.invalid ? "记录无效" : "未记录" : String(Math.round(item.value * 10) / 10), "evidence-value"); value.append(element("small", ` ${item.unit}`));
    const baseline = element("p", item.value === null ? "当前值不可用，不作差值比较" : item.partial ? "今天尚未结束，不比较全天总量" : item.baseline === null ? "历史有效天数不足，不作比较" : `此前常态 ${item.baseline} ${item.unit} · 相差 ${item.delta > 0 ? "+" : ""}${item.delta} ${item.unit}`);
    const details = element("details"); details.append(element("summary", `数据依据 · ${item.baselineCount} 个有效历史日`), element("p", `当前：${item.date}。比较窗口：${item.baselineStart} 至 ${item.baselineEnd}。${item.note}`));
    card.append(title, value, baseline, details); return card;
  }));
  text("#answer", "问题会结合当前这份解读回答。"); text("#answer-engine", ""); text("#feedback-message", "");
}
async function load(source) {
  if (loading || !$("#plan-form").reportValidity()) return;
  loading = true; invalidateExplanation("正在读取新的数据来源");
  resetFeedbackEditor();
  const version = inputVersion;
  document.querySelectorAll(".source-actions button, #update-insight").forEach((button) => { button.disabled = true; });
  document.querySelectorAll("#feedback-form input, #feedback-form select, #feedback-form textarea, #feedback-form button, #feedback-history button").forEach((control) => { control.disabled = true; });
  text("#page-message", "正在读取并核对数据……"); text("#reading-mode", "读取中；旧解读暂不用于操作");
  text("#source-state", "正在读取所选来源……"); text("#sync-state", "本次结果尚未返回。");
  try {
    const value = await api("/api/insight", { source, ...input(), ...(source === "import" ? { data: imported } : {}) });
    if (version !== inputVersion) { selectedSource = source; text("#page-message", "你的安排或体感已改变，请点击重新解读。刚返回的旧结果未被采用。"); return; }
    selectedSource = source; render(value.report); text("#page-message", source === "live" ? "已读取本机数据源；这不等于刚刚同步了设备。" : labels[value.report.source]);
  } catch (error) { text("#page-message", error.message); text("#source-state", "本次读取失败"); text("#reading-title", "读取未完成，暂不生成建议。"); text("#reading-mode", "读取失败"); text("#reading-summary", "没有使用示例数据或上一次解读冒充本次结果。"); text("#reading-action", "检查数据来源后重试。"); text("#coverage-state", "本次没有可用结果"); text("#answer", "请先成功读取数据。"); $("#reading-limits").replaceChildren(); $("#evidence-list-live").replaceChildren(); }
  finally {
    loading = false;
    document.querySelectorAll(".source-actions button, #update-insight, #feedback-form input, #feedback-form select, #feedback-form textarea, #feedback-form button, #feedback-history button").forEach((control) => { control.disabled = false; });
  }
}
async function ask(question) {
  if (!report) { text("#answer", "请先成功读取数据。"); return; }
  const id = report.id;
  const version = ++questionVersion;
  text("#answer", "正在查找这次解读的依据……");
  try {
    const value = await api("/api/ask", { reportId: id, question });
    if (report?.id !== id || questionVersion !== version) return;
    text("#answer-engine", `${value.engine}${value.modelStatus === "consent_required" ? " · 尚未允许真实健康摘要进入本地模型" : ""}`);
    text("#answer", `${value.answer}${value.notice ? `\n\n${value.notice}` : ""}`);
  } catch (error) { if (report?.id === id && questionVersion === version) text("#answer", error.message); }
}
async function history() {
  try {
    const { records } = await api("/api/feedback");
    $("#feedback-history").replaceChildren(...(records.length ? records.map((record) => {
      const row = element("article", undefined, "history-row");
      const copy = element("div"); copy.append(element("strong", `${record.date} · ${decisions[record.decision]}`), element("p", `${outcomes[record.outcome]} · ${record.headline}`));
      if (record.note) copy.append(element("p", record.note));
      const edit = element("button", "补记结果", "secondary-button"); edit.type = "button";
      edit.disabled = loading;
      edit.addEventListener("click", () => { if (loading) return; feedbackVersion += 1; editingFeedback = record.id; $("#decision").value = record.decision; $("#outcome").value = record.outcome; $("#feedback-note").value = record.note; text("#feedback-message", `正在补记 ${record.date} 的这条记录。保存不会改写当时的依据。`); $("#outcome").focus(); });
      row.append(copy, edit); return row;
    }) : [element("p", "暂无记录。合成演示不会写入你的反馈历史。", "muted")]));
  } catch { text("#feedback-history", "反馈历史读取失败。请检查本机存储权限，不能将读取失败当成没有记录。"); }
}
$("#load-live").addEventListener("click", () => load("live"));
$("#load-demo").addEventListener("click", () => load("demo"));
$("#plan-form").addEventListener("submit", (event) => { event.preventDefault(); if (selectedSource) load(selectedSource); else text("#page-message", "请先选择数据来源。"); });
$("#plan-form").addEventListener("input", () => {
  inputVersion += 1; resetFeedbackEditor();
  invalidateExplanation("安排或体感已变更，需重新解读");
  text("#page-message", "修改后请重新解读；旧结果不能用于追问或保存新反馈。");
  text("#reading-action", "当前安排已变更，等待重新解读。身体不适优先处理，不依赖设备分数。");
});
for (const selector of ["#check-pain", "#check-illness"]) $(selector).addEventListener("change", () => {
  if ($(selector).checked) {
    report = null;
    text("#reading-title", "先处理不适，不继续推荐训练。"); text("#reading-action", "设备不能判断原因。请结合身体情况处理；明显、加重或持续的不适应寻求专业评估。");
    if (!loading && selectedSource) load(selectedSource);
  }
});
$("#ask-form").addEventListener("submit", (event) => { event.preventDefault(); ask($("#question").value); });
document.querySelectorAll("[data-question]").forEach((button) => button.addEventListener("click", () => { $("#question").value = button.dataset.question; ask(button.dataset.question); }));
$("#feedback-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (loading) { text("#feedback-message", "请等待这次读取结束，再记录反馈。"); return; }
  const id = editingFeedback || report?.id;
  if (!id) { text("#feedback-message", "请先读取数据，或选择一条已有记录补记结果。"); return; }
  const version = feedbackVersion;
  try {
    const result = await api("/api/feedback", { reportId: id, decision: $("#decision").value, outcome: $("#outcome").value, note: $("#feedback-note").value });
    if (feedbackVersion === version) {
      text("#feedback-message", result.demo ? "这是合成演示，未保存任何个人反馈。" : "反馈已保存到本机。刷新后仍可查看与补记结果。");
      editingFeedback = result.demo ? null : id;
    } else text("#page-message", "上一条反馈请求已完成；你正在编辑的内容和目标未被改变。");
    await history();
  } catch (error) { if (feedbackVersion === version) text("#feedback-message", error.message); else text("#page-message", "上一条反馈保存失败；当前编辑内容未被改变。请返回对应记录重试。"); }
});
$("#feedback-form").addEventListener("input", () => { feedbackVersion += 1; });
function expireReport() {
  if (!report) return;
  const day = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  if (Date.now() - Date.parse(report.generatedAt) > 3600000 || day(Date.now()) !== day(report.generatedAt)
    || (!report.quality.stale && Date.now() - Date.parse(report.syncedAt) > 36 * 3600000)) {
    invalidateExplanation("日期或新鲜度已变化，请重新读取");
    text("#page-message", "旧解读已过期。请重新读取数据，不继续使用旧的安排解释。");
  }
}
setInterval(expireReport, 30000);
document.addEventListener("visibilitychange", expireReport);
$("#import-days").addEventListener("change", async (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  try { if (file.size > 100 * 1024) throw new Error(); imported = JSON.parse(await file.text()); await load("import"); }
  catch { text("#page-message", "导入失败：请使用日汇总格式 JSON，文件不超过 100 KB。旧原型格式可在“原型演示”中导入。"); }
  finally { event.target.value = ""; }
});
try {
  const response = await fetch("/api/session"); if (!response.ok) throw new Error(); session = await response.json();
  text("#model-state", session.model.enabled ? session.model.sensitiveAllowed ? "本地 AI 已配置 · 仅本机调用" : "本地 AI 仅允许合成示例" : "生成式 AI 未启用 · 本机依据解释可用");
  await history();
  if (session.dataConfigured) await load("live");
  else text("#page-message", "尚未配置本机数据连接。可以先试用合成示例或导入日汇总。");
} catch { text("#page-message", "本机服务连接失败，请用 npm run dev 启动后访问，不要直接打开 HTML 文件。"); }
