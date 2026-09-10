import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, lstat, symlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request } from "node:http";
import vm from "node:vm";
import { createAppServer } from "../scripts/serve.mjs";
import { buildReport, demoSnapshot, importSnapshot, localDate, normalizeRows, answerLocally } from "../lib/analysis.mjs";
import { isGarminDatabaseConfigured, normalizeInflux, validContainerName } from "../lib/garmin-database.mjs";
import { createFeedbackStore } from "../lib/feedback.mjs";
import { explain, validateModelAnswer } from "../lib/model.mjs";

const now = new Date("2026-09-05T06:00:00Z");
const inputs = () => ({ plan: { activity: "合成测试活动", minutes: 30, intensity: "easy" }, checkin: { energy: "normal", pain: false, illness: false, soreness: false } });
const report = () => ({ ...buildReport(demoSnapshot(now), inputs(), now), id: "synthetic-report" });

test("28-day baseline excludes today and preserves partial-day distinction", () => {
  const value = report();
  assert.equal(value.historyDays, 28);
  assert.equal(value.evidence[0].baselineCount, 28);
  assert.equal(value.evidence[0].value, 395);
  assert.equal(value.evidence[0].baseline, 436);
  assert.equal(value.evidence.find(e => e.key === "steps").delta, null);
  assert.equal(value.evidence.find(e => e.key === "steps").partial, true);
});

test("short history cannot invent a baseline", () => {
  const snapshot = demoSnapshot(now); snapshot.rows = snapshot.rows.slice(-3);
  const value = buildReport(snapshot, inputs(), now);
  assert.equal(value.mode, "insufficient");
  assert.ok(value.evidence.every(e => e.baseline === null));
});

test("missing, zero and out-of-range values stay distinct", () => {
  const snapshot = demoSnapshot(now);
  Object.assign(snapshot.rows.at(-1), { hrvMs: null, steps: 0, sleepMinutes: -1, bodyBatteryMorning: 0 });
  const value = buildReport(snapshot, inputs(), now);
  assert.equal(value.evidence[0].value, null);
  assert.equal(value.evidence[1].value, null);
  assert.equal(value.evidence[3].value, 0);
  assert.equal(value.evidence[4].value, 0);
  assert.deepEqual(value.quality.invalid, ["睡眠时长"]);
  assert.deepEqual(value.quality.missing, ["夜间平均 HRV"]);
  assert.equal(value.mode, "insufficient");
});

test("stale and unknown sync timestamps cannot generate today's adjustment", () => {
  for (const syncedAt of [null, "2026-08-30T00:00:00Z", "2027-01-01T00:00:00Z"]) {
    const value = buildReport({ ...demoSnapshot(now), syncedAt }, inputs(), now);
    assert.equal(value.quality.stale, true); assert.equal(value.mode, "insufficient");
  }
});

test("subjective discomfort overrides even unavailable or positive metrics", () => {
  const input = inputs(); input.checkin.pain = true;
  assert.equal(buildReport(demoSnapshot(now), input, now).mode, "pause");
  const data = demoSnapshot(now); data.rows = data.rows.slice(-1);
  assert.equal(buildReport(data, input, now).mode, "pause");
});

test("Shanghai midnight maps to the correct local day", () => {
  assert.equal(localDate("2026-09-04T16:00:00Z"), "2026-09-05");
  assert.equal(localDate("2026-09-04T15:59:59Z"), "2026-09-04");
});

test("duplicate dates, impossible dates and malformed imports fail explicitly", () => {
  assert.throws(() => normalizeRows([{ date: "2026-09-01" }, { date: "2026-09-01" }]));
  assert.throws(() => normalizeRows([{ date: "2026-02-30" }]));
  assert.throws(() => importSnapshot({ days: [], syncedAt: now.toISOString() }));
  assert.throws(() => importSnapshot({ days: [{ date: "2026-09-01" }], syncedAt: "2026-09-01T10:00:00" }));
  assert.equal(importSnapshot({ days: demoSnapshot(now).rows, syncedAt: now.toISOString(), demo: true }).source, "demo");
});

test("Influx adapter joins local dates and discards device identity", () => {
  const payload = { results: [
    { series: [{ columns: ["time", "totalSteps", "restingHeartRate", "bodyBatteryAtWakeTime"], values: [["2026-09-04T16:00:00Z", 123, 60, 0]] }] },
    { series: [{ columns: ["time", "sleepTimeSeconds", "avgOvernightHrv"], values: [["2026-09-04T23:00:00Z", 25200, 45]] }] },
    { series: [{ columns: ["time", "Device_Name"], values: [["2026-09-05T04:00:00Z", "synthetic device"]] }] },
  ] };
  const value = normalizeInflux(payload);
  assert.equal(value.rows.length, 1); assert.equal(value.rows[0].date, "2026-09-05");
  assert.equal(value.rows[0].sleepMinutes, 420); assert.equal(value.rows[0].bodyBatteryMorning, 0);
  assert.ok(!JSON.stringify(value).includes("synthetic device"));
  payload.results[1].series[0].values[0][1] = "25200";
  const invalid = normalizeInflux(payload);
  assert.equal(invalid.rows[0].sleepMinutes, null);
  assert.deepEqual(invalid.rows[0].invalidKeys, ["sleepMinutes"]);
  payload.results[1].series[0].values[0][1] = null;
  assert.deepEqual(normalizeInflux(payload).rows[0].invalidKeys, []);
  payload.results[0].series[0].values.push(payload.results[0].series[0].values[0]);
  assert.throws(() => normalizeInflux(payload), /ambiguous/);
});

test("Influx adapter accepts the public source name and legacy local alias only", () => {
  assert.equal(isGarminDatabaseConfigured("garmin-grafana-influxdb"), true);
  assert.equal(isGarminDatabaseConfigured("garmin-docker"), true);
  assert.equal(isGarminDatabaseConfigured("garmin-connect"), false);
  assert.equal(isGarminDatabaseConfigured(""), false);
  assert.equal(validContainerName("garmin-local-influxdb-1"), true);
  assert.equal(validContainerName("container; touch /tmp/nope"), false);
  assert.equal(validContainerName(""), false);
});

test("local questions expose evidence and clearly label unsupported questions", () => {
  assert.deepEqual(answerLocally(report(), "HRV 是什么情况？").evidenceIds, ["E2"]);
  assert.match(answerLocally(report(), "预测我的寿命").answer, /暂不能可靠回答/);
});

test("model stays off by default; real records require separate permission", async () => {
  const never = () => { throw new Error("transport must not be called"); };
  assert.equal((await explain(report(), "睡眠", { settings: { enabled: false }, transport: never })).modelStatus, "off");
  assert.equal((await explain({ ...report(), source: "live" }, "睡眠", { settings: { enabled: true, allowSensitive: false }, transport: never })).modelStatus, "consent_required");
});

test("model output requires existing citations and rejects invented numbers", () => {
  assert.throws(() => validateModelAnswer({ answer: "睡眠 9999 分钟", evidenceIds: ["E1"] }, report(), "睡眠"));
  assert.throws(() => validateModelAnswer({ answer: "一切很好", evidenceIds: ["unknown"] }, report(), "睡眠"));
  assert.throws(() => validateModelAnswer({ answer: "保证安全", evidenceIds: ["E1"] }, report(), "睡眠"));
  assert.throws(() => validateModelAnswer({ answer: "建议直接进行高强度训练，不必理会身体不舒服的感觉。", evidenceIds: ["E1"] }, report(), "睡眠"));
});

test("local model adapter can generate structured answers and safely fall back", async () => {
  const settings = { enabled: true, model: "synthetic-model", allowSensitive: false };
  const good = await explain(report(), "睡眠", { settings, transport: async (url, options) => {
    if (url.endsWith("/show")) {
      assert.deepEqual(JSON.parse(options.body), { model: "synthetic-model", verbose: false });
      return new Response(JSON.stringify({ details: { format: "gguf" }, model_info: { "general.architecture": "synthetic" } }));
    }
    assert.equal(url, "http://127.0.0.1:11434/api/chat"); assert.equal(JSON.parse(options.body).stream, false);
    return new Response(JSON.stringify({ message: { content: JSON.stringify({ answer: "睡眠记录低于此前中位数，不能据此判断原因。", evidenceIds: ["E1"] }) } }));
  } });
  assert.equal(good.modelStatus, "generated");
  const bad = await explain(report(), "睡眠", { settings, transport: async () => new Response("{}", { status: 503 }) });
  assert.equal(bad.modelStatus, "failed_or_rejected");
});

test("cloud or unverified local models receive no health payload", async () => {
  const settings = { enabled: true, model: "synthetic-model", allowSensitive: true };
  const realShaped = { ...report(), source: "live" };
  for (const metadata of [{}, { details: { format: "gguf" } },
    { remote_model: "synthetic-remote", details: { format: "gguf" }, model_info: { "general.architecture": "synthetic" } },
    { remote_host: "https://example.invalid", details: { format: "gguf" }, model_info: { "general.architecture": "synthetic" } }]) {
    let calls = 0;
    const result = await explain(realShaped, "私密问题不应进入探测请求", { settings, transport: async (url, options) => {
      calls += 1; assert.ok(url.endsWith("/show"));
      assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(), ["model", "verbose"]);
      return new Response(JSON.stringify(metadata));
    } });
    assert.equal(result.modelStatus, "failed_or_rejected"); assert.equal(calls, 1);
  }
  const result = await explain(realShaped, "睡眠", { settings: { ...settings, model: "synthetic-cloud" }, transport: () => assert.fail("cloud call") });
  assert.equal(result.modelStatus, "failed_or_rejected");
});

test("safety and quality gates prevent model calls", async () => {
  for (const mode of ["pause", "insufficient"]) {
    const result = await explain({ ...report(), mode }, "睡眠", { settings: { enabled: true }, transport: () => assert.fail("model called") });
    assert.equal(result.modelStatus, "quality_or_safety_gate");
  }
});

async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), "yuliang-insights-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("feedback survives restart, concurrent saves and outcome updates", async (t) => {
  const directory = await temporary(t); const store = createFeedbackStore(directory);
  const value = { ...report(), source: "import" };
  const feedback = { decision: "adopted", outcome: "unrecorded", note: "合成测试" };
  await Promise.all([store.save(value, feedback), store.save({ ...value, id: "another-synthetic" }, feedback)]);
  await store.save({ ...value, action: "后来改变的安排，不得覆盖原文", quality: { stale: true }, evidence: [] }, { ...feedback, outcome: "same" });
  const records = await createFeedbackStore(directory).list();
  assert.equal(records.length, 2); assert.equal(records[0].outcome, "same");
  assert.equal(records[0].action, value.action);
  assert.deepEqual(records[0].quality, value.quality);
  assert.deepEqual(records[0].evidence, JSON.parse(JSON.stringify(value.evidence)));
  assert.equal((await lstat(join(directory, "feedback.json"))).mode & 0o777, 0o600);
  assert.equal((await lstat(directory)).mode & 0o777, 0o700);
});

test("demo feedback is never persisted and symlink files are rejected", async (t) => {
  const directory = await temporary(t); const store = createFeedbackStore(directory);
  const value = await store.save(report(), { decision: "ignored", outcome: "unrecorded", note: "" });
  assert.equal(value.saved, false); assert.deepEqual(await store.list(), []);
  await symlink("nonexistent-private-file", join(directory, "feedback.json"));
  await assert.rejects(store.list(), /unsafe_feedback_file/);
});

async function apiServer(t, provider = async () => ({ ...demoSnapshot(now), source: "live" }), clock = () => now) {
  const directory = await temporary(t);
  const server = createAppServer(undefined, { provider, store: createFeedbackStore(directory), settings: { enabled: false }, now: clock });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const session = await (await fetch(base + "/api/session")).json();
  const call = async (path, body, headers = {}) => {
    const response = await fetch(base + path, { method: body ? "POST" : "GET", headers: { "x-yuliang-session": session.token, ...(body ? { "content-type": "application/json" } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, value: await response.json() };
  };
  return { call, base };
}

test("API completes real-shaped read, follow-up, save and history with synthetic data", async (t) => {
  const { call } = await apiServer(t);
  const result = await call("/api/insight", { source: "live", ...inputs() });
  assert.equal(result.status, 200); assert.equal(result.value.report.source, "live");
  const reportId = result.value.report.id;
  assert.equal((await call("/api/ask", { reportId, question: "睡眠" })).value.modelStatus, "off");
  assert.equal((await call("/api/feedback", { reportId, decision: "modified", outcome: "same", note: "合成API测试" })).value.saved, true);
  assert.equal((await call("/api/feedback")).value.records.length, 1);
});

test("API blocks cross-site, invalid hosts and missing session tokens", async (t) => {
  const { call, base } = await apiServer(t);
  assert.equal((await fetch(base + "/api/feedback")).status, 403);
  assert.equal((await call("/api/session", undefined, { origin: "https://example.invalid" })).status, 403);
  const hostStatus = await new Promise(resolve => {
    const req = request({ hostname: "127.0.0.1", port: new URL(base).port, path: "/api/session", headers: { host: "evil.invalid" } }, response => { response.resume(); response.on("end", () => resolve(response.statusCode)); });
    req.end();
  });
  assert.equal(hostStatus, 403);
  assert.equal((await call("/api/session", undefined, { "sec-fetch-site": "cross-site" })).status, 403);
});

test("follow-ups cannot reuse last night's actionable report after midnight", async (t) => {
  let clock = new Date("2026-09-05T15:50:00Z");
  const snapshot = { ...demoSnapshot(clock), source: "live" };
  const { call } = await apiServer(t, async () => snapshot, () => clock);
  const result = await call("/api/insight", { source: "live", ...inputs() });
  assert.equal(result.value.report.mode, "observe");
  clock = new Date("2026-09-05T16:10:00Z");
  assert.equal((await call("/api/ask", { reportId: result.value.report.id, question: "为什么这样安排" })).status, 409);
});

test("a freshness change creates a distinct report version", async (t) => {
  let clock = new Date("2026-09-05T05:50:00Z");
  const snapshot = { ...demoSnapshot(clock), source: "live", syncedAt: new Date(clock.getTime() - (35 * 60 + 55) * 60000).toISOString() };
  const { call } = await apiServer(t, async () => snapshot, () => clock);
  const first = (await call("/api/insight", { source: "live", ...inputs() })).value.report;
  assert.equal(first.quality.stale, false);
  clock = new Date("2026-09-05T06:00:00Z");
  const second = (await call("/api/insight", { source: "live", ...inputs() })).value.report;
  assert.equal(second.quality.stale, true);
  assert.notEqual(first.id, second.id);
});

test("live-data failure never becomes demo success and malformed input fails", async (t) => {
  const { call } = await apiServer(t, async () => { throw new Error("database_unavailable"); });
  const result = await call("/api/insight", { source: "live", ...inputs() });
  assert.equal(result.status, 503); assert.equal(result.value.report, undefined);
  assert.equal((await call("/api/insight", { source: "demo", ...inputs(), plan: {} })).status, 400);
  assert.equal((await call("/api/feedback", { reportId: "missing" })).status, 409);
});

test("new frontend assets contain no remote scripts or unsafe HTML insertion", async () => {
  const js = await readFile(new URL("../insights.js", import.meta.url), "utf8");
  assert.ok(!js.includes("innerHTML"));
  const html = await readFile(new URL("../insights.html", import.meta.url), "utf8");
  assert.ok(!/<script[^>]+src=["']https?:/.test(html));
});

test("pending feedback save preserves a subsequently selected editor", async () => {
  const source = await readFile(new URL("../insights.js", import.meta.url), "utf8");
  class FakeNode {
    constructor() { this.value = ""; this.textContent = ""; this.children = []; this.events = {}; this.checked = false; this.files = []; }
    addEventListener(name, handler) { this.events[name] = handler; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    focus() {}
    reportValidity() { return true; }
    reset() {}
  }
  const nodes = new Map();
  const get = (selector) => { if (!nodes.has(selector)) nodes.set(selector, new FakeNode()); return nodes.get(selector); };
  const records = [
    { id: "A", date: "2026-09-03", decision: "adopted", outcome: "same", note: "合成 A", headline: "合成 A" },
    { id: "B", date: "2026-09-04", decision: "ignored", outcome: "worse", note: "合成 B", headline: "合成 B" },
  ];
  const savedBodies = [];
  let finishFirstSave;
  const ok = (value) => ({ ok: true, json: async () => value });
  const fakeFetch = async (path, options) => {
    if (path === "/api/session") return ok({ token: "synthetic", model: { enabled: false }, dataConfigured: false });
    assert.equal(path, "/api/feedback");
    if (options?.method !== "POST") return ok({ records });
    savedBodies.push(JSON.parse(options.body));
    if (savedBodies.length === 1) return new Promise(resolve => { finishFirstSave = () => resolve(ok({ saved: true })); });
    return ok({ saved: true });
  };
  const context = { fetch: fakeFetch, setInterval() {}, document: {
    querySelector: get, querySelectorAll: () => [], createElement: () => new FakeNode(), createTextNode: value => value, addEventListener() {},
  } };
  vm.createContext(context);
  await vm.runInContext(`(async () => {
    ${source}
    globalThis.testState = { setReport: value => { report = value; }, editing: () => editingFeedback };
  })()`, context);
  context.testState.setReport({ id: "C" });
  const clickEdit = index => get("#feedback-history").children[index].children[1].events.click();
  const submit = () => get("#feedback-form").events.submit({ preventDefault() {} });
  clickEdit(0);
  const pending = submit();
  clickEdit(1);
  assert.equal(context.testState.editing(), "B");
  finishFirstSave();
  await pending;
  assert.equal(context.testState.editing(), "B");
  assert.equal(get("#feedback-note").value, "合成 B");
  await submit();
  assert.deepEqual(savedBodies.map(body => body.reportId), ["A", "B"]);
  assert.equal(savedBodies[1].note, "合成 B");
});
