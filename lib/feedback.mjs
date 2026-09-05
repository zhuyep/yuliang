import { mkdir, lstat, readFile, open, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

export const defaultStateDir = () => join(homedir(), ".local", "share", "yuliang");
export function createFeedbackStore(directory = defaultStateDir()) {
  let queue = Promise.resolve();
  async function prepare() {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077)) throw new Error("unsafe_state_directory");
  }
  async function list() {
    await prepare();
    try {
      const path = join(directory, "feedback.json");
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) || info.size > 4 * 1024 * 1024) throw new Error("unsafe_feedback_file");
      const rows = JSON.parse(await readFile(path, "utf8"));
      if (!Array.isArray(rows)) throw new Error("invalid_feedback_file");
      return rows;
    } catch (error) { if (error.code === "ENOENT") return []; throw error; }
  }
  function save(report, input) {
    if (!["adopted", "modified", "ignored"].includes(input.decision) || !["unrecorded", "better", "same", "worse"].includes(input.outcome)
      || typeof input.note !== "string" || input.note.length > 500) throw new Error("invalid_feedback");
    if (report.source === "demo") return Promise.resolve({ saved: false, demo: true });
    const task = queue.then(async () => {
      const rows = await list();
      const record = { id: report.id, date: report.dataDate, savedAt: new Date().toISOString(), decision: input.decision, outcome: input.outcome,
        note: input.note.trim(), source: report.source, headline: report.headline, action: report.action, plan: report.plan, checkin: report.checkin,
        quality: report.quality, evidence: report.evidence };
      const existing = rows.findIndex((item) => item.id === report.id);
      // A later read or code change must never rewrite the original evidence.
      if (existing >= 0) rows[existing] = { ...rows[existing], savedAt: record.savedAt,
        decision: record.decision, outcome: record.outcome, note: record.note };
      else if (rows.length >= 365) throw new Error("feedback_capacity");
      else rows.push(record);
      const temporary = join(directory, `.feedback-${randomUUID()}.tmp`);
      try {
        const handle = await open(temporary, "wx", 0o600);
        try { await handle.writeFile(JSON.stringify(rows)); await handle.sync(); } finally { await handle.close(); }
        await rename(temporary, join(directory, "feedback.json"));
      } finally { await unlink(temporary).catch(() => {}); }
      return { saved: true, id: record.id };
    });
    queue = task.catch(() => {});
    return task;
  }
  return { list, save };
}
