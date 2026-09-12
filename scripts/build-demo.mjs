import { copyFile, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");
export const demoAssets = {
  "index.html": "demo/index.html", "styles.css": "demo/styles.css", "app.mjs": "demo/app.mjs",
  "scenarios.mjs": "demo/scenarios.mjs", "lib/analysis.mjs": "lib/analysis.mjs", "favicon.svg": "favicon.svg",
};

export async function buildDemo() {
  // Always create a fresh artifact from this explicit public list. Never copy
  // the checkout, backend, database adapter, health files or local experiments.
  const destination = await mkdtemp(join(tmpdir(), "yuliang-demo-"));
  for (const [target, source] of Object.entries(demoAssets)) {
    await mkdir(dirname(join(destination, target)), { recursive: true });
    await copyFile(join(root, source), join(destination, target));
  }
  return destination;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${await buildDemo()}\n`);
}
