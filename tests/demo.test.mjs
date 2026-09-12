import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildDemo } from "../scripts/build-demo.mjs";

test("public demo contains only reviewed browser assets and shares the local rule engine", async (t) => {
  const destination = await buildDemo();
  t.after(() => rm(destination, { recursive: true, force: true }));
  assert.deepEqual((await readdir(destination, { recursive: true })).sort(), ["app.mjs", "favicon.svg", "index.html", "lib", "lib/analysis.mjs", "scenarios.mjs", "styles.css"]);
  assert.equal(await readFile(join(destination, "lib/analysis.mjs"), "utf8"), await readFile(new URL("../lib/analysis.mjs", import.meta.url), "utf8"));
  const { scenarioReport } = await import(pathToFileURL(join(destination, "scenarios.mjs")));
  const now = new Date("2026-09-12T02:00:00Z");
  for (const [scenario, mode] of [["usual", "observe"], ["tired", "lighten"], ["missing", "insufficient"]]) {
    const report = scenarioReport({ scenario, minutes: 45 }, now);
    assert.equal(report.source, "demo");
    assert.equal(report.mode, mode);
    assert.equal(report.plan.minutes, 45);
    assert.equal(report.historyDays, 28);
    assert.equal(scenarioReport({ scenario, pain: true }, now).mode, "pause", "pain overrides every scenario, including missing data");
  }
  const missing = scenarioReport({ scenario: "missing" }, now).evidence.find((item) => item.key === "hrvMs");
  assert.equal(missing.value, null);
  assert.equal(missing.baselineCount, 28);
});
