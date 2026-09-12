import { buildReport, demoSnapshot } from "./lib/analysis.mjs";

// All inputs are fictional. The exact same rule engine powers the local app.
export function scenarioReport({ scenario = "usual", pain = false, minutes = 30 } = {}, now = new Date()) {
  if (!["usual", "tired", "missing"].includes(scenario)) throw new Error("invalid_scenario");
  const snapshot = demoSnapshot(now);
  if (scenario === "missing") snapshot.rows.at(-1).hrvMs = null;
  return buildReport(snapshot, {
    plan: { activity: "日常活动", minutes, intensity: "moderate" },
    checkin: { energy: scenario === "tired" ? "low" : "normal", pain, illness: false, soreness: false },
  }, now);
}
