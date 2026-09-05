// Read the Git index, not private working-directory contents. Report categories,
// never matched secret values. This is an accidental-commit guard, not a guarantee.
import { execFileSync, spawnSync } from "node:child_process";

const allowed = new Set([
  ".gitignore", ".gitattributes", "AGENTS.md", "README.md", "README.en.md",
  "DOGFOOD.md", "THIRD_PARTY_NOTICES.md", "package.json", "index.html",
  "app.js", "styles.css", "favicon.svg", "data/example-garmin-day.json",
  "data/example-ready-day.json", "scripts/serve.mjs", "scripts/check-repo.mjs",
  "tests/server.test.mjs", "docs/ARCHITECTURE.md", "docs/ROADMAP.md",
  "insights.html", "insights.css", "insights.js", "lib/analysis.mjs", "lib/api.mjs",
  "lib/garmin-database.mjs", "lib/feedback.mjs", "lib/model.mjs", "tests/insights.test.mjs", "docs/LOCAL_INSIGHTS.md",
]);
const patterns = [
  ["GitHub credential", /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ["API credential", /\bsk-[A-Za-z0-9_-]{20,}/],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["personal machine path", /\/(?:Users|home)\/[A-Za-z0-9._-]+\//],
  ["possible phone number", /(?<!\d)1[3-9]\d{9}(?!\d)/],
  ["saved authentication token", /["'](?:access_token|refresh_token|oauth_token|oauth_token_secret)["']\s*:\s*["'][^"']{8,}["']/],
];
const errors = [];
const entries = execFileSync("git", ["ls-files", "--stage", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
if (!entries.length) errors.push("No reviewed files are staged/tracked yet.");
for (const entry of entries) {
  const [header, path] = entry.split("\t");
  if (!allowed.has(path) || !/^100(?:644|755) [a-f0-9]+ 0$/.test(header)) {
    errors.push(`Disallowed path, link, submodule or merge stage: ${path}`);
    continue;
  }
  const content = execFileSync("git", ["show", `:${path}`], { encoding: "utf8", maxBuffer: 1024 * 1024 });
  for (const [label, pattern] of patterns) {
    if (pattern.test(content)) errors.push(`${label}: ${path}`);
  }
  if (path.startsWith("data/")) {
    try {
      const fixture = JSON.parse(content);
      if (fixture.meta?.demo !== true || !fixture.meta?.source?.includes("合成示例")) errors.push(`Unlabelled synthetic fixture: ${path}`);
    } catch {
      errors.push(`Invalid fixture: ${path}`);
    }
  }
}
for (const path of [".private/probe.json", ".env", ".git-secret-probe", "data/garmin-live-probe.json", "data/new-user.json", "garmin-grafana/README.md", "scripts/sync_garmin_once.py", "output/probe.png", ".jez/probe.md"]) {
  if (spawnSync("git", ["check-ignore", "--no-index", "--quiet", path]).status !== 0) errors.push(`Private path not ignored: ${path}`);
}
if (errors.length) {
  for (const error of errors) process.stderr.write(`${error}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Repository boundary check passed (${entries.length} reviewed files).\n`);
}
