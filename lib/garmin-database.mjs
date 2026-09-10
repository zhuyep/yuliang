import { spawn } from "node:child_process";
import { localDate, normalizeRows } from "./analysis.mjs";

// Only fixed SELECT statements are sent into the existing local container.
// Reader credentials stay inside it and go to curl on stdin, never in argv/logs.
const reader = `IFS= read -r query
test -n "$INFLUXDB_READ_USER_PASSWORD" || exit 2
printf 'user = "%s:%s"\\n' "$INFLUXDB_READ_USER" "$INFLUXDB_READ_USER_PASSWORD" | curl --config - --fail --silent --show-error --max-time 15 --get http://127.0.0.1:8086/query --data-urlencode db=GarminStats --data-urlencode "q=$query"`;
const query = 'SELECT "totalSteps","restingHeartRate","bodyBatteryAtWakeTime" FROM "DailyStats" WHERE time >= now() - 35d; SELECT "sleepTimeSeconds","avgOvernightHrv" FROM "SleepSummary" WHERE time >= now() - 35d; SELECT "Device_Name" FROM "DeviceSync" ORDER BY time DESC LIMIT 1';

export function isGarminDatabaseConfigured(source = process.env.YULIANG_DATA_SOURCE) {
  return source === "garmin-grafana-influxdb" || source === "garmin-docker";
}

export function validContainerName(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value);
}

export function normalizeInflux(payload) {
  if (!Array.isArray(payload?.results) || payload.results.length !== 3 || payload.results.some((result) => result.error)) throw new Error("database_response_invalid");
  const points = (result) => (result.series || []).flatMap((series) => (series.values || []).map((row) => Object.fromEntries(series.columns.map((column, index) => [column, row[index]]))));
  const days = new Map();
  const set = (timestamp, fields) => {
    if (!Number.isFinite(Date.parse(timestamp))) throw new Error("invalid_timestamp");
    const date = localDate(timestamp);
    const previous = days.get(date) || { date };
    // Multiple summaries for one date are ambiguous; do not silently double count.
    for (const key of Object.keys(fields)) if (Object.hasOwn(previous, key)) throw new Error("ambiguous_daily_records");
    days.set(date, { ...previous, ...fields });
  };
  for (const row of points(payload.results[0])) set(row.time, { steps: row.totalSteps, restingHeartRate: row.restingHeartRate, bodyBatteryMorning: row.bodyBatteryAtWakeTime });
  // Keep malformed source types for normalizeRows to flag, instead of turning
  // a supplied invalid value into indistinguishable missing data.
  for (const row of points(payload.results[1])) set(row.time, { sleepMinutes: typeof row.sleepTimeSeconds === "number" ? row.sleepTimeSeconds / 60 : row.sleepTimeSeconds, hrvMs: row.avgOvernightHrv });
  return { source: "live", syncedAt: points(payload.results[2])[0]?.time || null, rows: normalizeRows([...days.values()]) };
}

export async function readGarminDatabase() {
  if (!isGarminDatabaseConfigured()) throw new Error("data_not_configured");
  const container = process.env.YULIANG_GARMIN_DB_CONTAINER || "garmin-local-influxdb-1";
  if (!validContainerName(container)) throw new Error("database_container_invalid");
  const stdout = await new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "sh", "-c", reader], { stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    let overflow = false;
    const timer = setTimeout(() => child.kill("SIGTERM"), 20000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; if (output.length > 512000) { overflow = true; child.kill("SIGTERM"); } });
    child.stderr.resume(); // Never expose database or subprocess errors verbatim.
    child.stdin.on("error", () => {});
    child.on("error", () => { clearTimeout(timer); reject(new Error("database_unavailable")); });
    child.on("close", (code) => { clearTimeout(timer); code === 0 && !overflow ? resolve(output) : reject(new Error("database_unavailable")); });
    child.stdin.end(query + "\n");
  });
  return normalizeInflux(JSON.parse(stdout));
}
