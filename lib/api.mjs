import { createHash, randomBytes } from "node:crypto";
import { buildReport, demoSnapshot, importSnapshot, localDate } from "./analysis.mjs";
import { readGarminDatabase } from "./garmin-database.mjs";
import { createFeedbackStore } from "./feedback.mjs";
import { explain, modelSettings } from "./model.mjs";

const send = (response, status, value) => response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }).end(JSON.stringify(value));
async function readJSON(request) {
  if (!(request.headers["content-type"] || "").startsWith("application/json")) throw new Error("invalid_content_type");
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 128 * 1024) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createAPI({ provider = readGarminDatabase, store = createFeedbackStore(), settings = modelSettings(), now = () => new Date() } = {}) {
  const token = randomBytes(32).toString("hex");
  const reports = new Map();
  let reading;
  let asking = false;
  async function liveData() {
    if (!reading) reading = provider().finally(() => { reading = null; });
    return reading;
  }
  return async function handle(request, response, pathname) {
    if (!pathname.startsWith("/api/")) return false;
    const expected = `127.0.0.1:${request.socket.localPort}`;
    const alternate = `localhost:${request.socket.localPort}`;
    if (![expected, alternate].includes(request.headers.host) || request.headers["sec-fetch-site"] === "cross-site"
      || (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`)) {
      send(response, 403, { error: "只允许当前本机页面访问。" }); return true;
    }
    if (pathname === "/api/session" && request.method === "GET") {
      send(response, 200, { token, dataConfigured: process.env.YULIANG_DATA_SOURCE === "garmin-docker", model: { enabled: settings.enabled, sensitiveAllowed: settings.allowSensitive } }); return true;
    }
    if (request.headers["x-yuliang-session"] !== token) { send(response, 403, { error: "页面会话已过期，请刷新。" }); return true; }
    try {
      if (pathname === "/api/feedback" && request.method === "GET") {
        const records = (await store.list()).slice(-30).reverse().map(({ id, date, savedAt, decision, outcome, note, headline }) => ({ id, date, savedAt, decision, outcome, note, headline }));
        send(response, 200, { records }); return true;
      }
      if (request.method !== "POST") { send(response, 405, { error: "不支持这个操作。" }); return true; }
      const body = await readJSON(request);
      if (pathname === "/api/insight") {
        let snapshot;
        if (body.source === "live") snapshot = await liveData();
        else if (body.source === "demo") snapshot = demoSnapshot(now());
        else if (body.source === "import") snapshot = importSnapshot(body.data);
        else throw new Error("invalid_source");
        const report = buildReport(snapshot, body, now());
        report.id = createHash("sha256").update(JSON.stringify({ source: report.source, date: report.dataDate, syncedAt: report.syncedAt, evidence: report.evidence, plan: report.plan, checkin: report.checkin,
          mode: report.mode, action: report.action, headline: report.headline, quality: report.quality })).digest("hex").slice(0, 24);
        reports.set(report.id, report);
        if (reports.size > 50) reports.delete(reports.keys().next().value);
        send(response, 200, { report }); return true;
      }
      if (pathname === "/api/ask") {
        const report = reports.get(body.reportId);
        const current = now();
        if (!report || current.getTime() - Date.parse(report.generatedAt) > 3600000
          || localDate(current) !== localDate(report.generatedAt)
          || (!report.quality.stale && current.getTime() - Date.parse(report.syncedAt) > 36 * 3600000)) {
          send(response, 409, { error: "解读日期或数据新鲜度已变化，请先重新读取数据，再追问。" }); return true;
        }
        if (typeof body.question !== "string" || !body.question.trim() || body.question.length > 500) throw new Error("invalid_question");
        if (asking) { send(response, 429, { error: "上一条问题仍在处理，请稍候。" }); return true; }
        asking = true;
        try { send(response, 200, await explain(report, body.question, { settings })); } finally { asking = false; }
        return true;
      }
      if (pathname === "/api/feedback") {
        let report = reports.get(body.reportId);
        if (!report) {
          const saved = (await store.list()).find((item) => item.id === body.reportId);
          if (saved) report = { ...saved, dataDate: saved.date };
        }
        if (!report) { send(response, 409, { error: "这条解读不存在，请重新读取数据。" }); return true; }
        send(response, 200, await store.save(report, body)); return true;
      }
      send(response, 404, { error: "没有这个接口。" });
    } catch (error) {
      const dataFailure = /database|no_data|data_not_configured|ambiguous/.test(error.message);
      const storageFailure = /state_directory|feedback_file|feedback_capacity|ENOSPC|EACCES/.test(error.message);
      send(response, dataFailure || storageFailure ? 503 : 400, { error: dataFailure
        ? "无法读取本机健康数据库或记录有歧义。请检查 Docker 与同步状态；没有用示例数据冒充真实数据。"
        : storageFailure ? "反馈未能保存。请检查本机存储权限或容量，原有记录没有被覆盖。"
          : "输入格式不正确或操作未完成，请检查后重试。" });
    }
    return true;
  };
}
