import test from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { mkdtemp, rm, writeFile, symlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAppServer } from "../scripts/serve.mjs";

async function start(t, root) {
  const server = createAppServer(root);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return (path, method = "GET") => new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port: server.address().port, path, method }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("serves only reviewed frontend assets", async (t) => {
  const get = await start(t);
  for (const path of ["/", "/index.html", "/styles.css", "/app.js", "/favicon.svg", "/data/example-garmin-day.json", "/data/example-ready-day.json"]) {
    const result = await get(path);
    assert.equal(result.status, 200, path);
    assert.ok(result.body.length > 0);
    assert.equal(result.headers["x-content-type-options"], "nosniff");
  }
  assert.equal((await get("/?view=today")).status, 200);
});

test("private files, repository history and experiments are inaccessible", async (t) => {
  const get = await start(t);
  for (const path of ["/.git/config", "/.git/HEAD", "/.env", "/.private/probe.json", "/%2eprivate/probe.json", "/README.md", "/scripts/serve.mjs", "/garmin-grafana/README.md", "/data/new-user.json", "/output/probe.png", "/.jez/probe.md", "/../README.md", "/%2e%2e/README.md", "//app.js"]) {
    assert.equal((await get(path)).status, 404, path);
  }
});

test("malformed paths are rejected", async (t) => {
  const get = await start(t);
  assert.equal((await get("/%ZZ")).status, 400);
  assert.equal((await get("/%00")).status, 400);
});

test("read-only methods and HEAD behave correctly", async (t) => {
  const get = await start(t);
  const head = await get("/", "HEAD");
  assert.equal(head.status, 200);
  assert.equal(head.body, "");
  assert.equal((await get("/", "POST")).status, 405);
});

test("an allowed filename cannot expose a symlink target", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "yuliang-server-test-"));
  try {
    await writeFile(join(directory, "private.txt"), "synthetic test sentinel");
    await symlink("private.txt", join(directory, "index.html"));
    const get = await start(t, directory);
    assert.equal((await get("/")).status, 404);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("missing allowed assets return 404", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "yuliang-empty-test-"));
  try {
    const get = await start(t, directory);
    assert.equal((await get("/")).status, 404);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("bundled fixtures are explicitly synthetic", async () => {
  for (const filename of ["example-garmin-day.json", "example-ready-day.json"]) {
    const data = JSON.parse(await readFile(new URL(`../data/${filename}`, import.meta.url), "utf8"));
    assert.equal(data.meta.demo, true);
    assert.match(data.meta.source, /合成示例/);
  }
});
