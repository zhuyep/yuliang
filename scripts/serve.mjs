import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");
const publicFiles = new Set([
  "index.html", "styles.css", "app.js", "favicon.svg",
  "data/example-garmin-day.json", "data/example-ready-day.json",
]);
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export function createAppServer(appRoot = root) {
return createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }
  let pathname;
  try {
    const rawPath = (request.url || "/").split("?", 1)[0].split("#", 1)[0];
    pathname = decodeURIComponent(rawPath);
    if (pathname.includes("\0")) throw new Error("null byte");
  } catch {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" }).end("Bad request");
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!pathname.startsWith("/") || !publicFiles.has(relativePath)) {
    response.writeHead(404).end("Not found");
    return;
  }

  let handle;
  try {
    const canonicalRoot = await realpath(appRoot);
    const file = resolve(canonicalRoot, relativePath);
    // Deny symlinks even when they point somewhere else inside the workspace.
    if (await realpath(file) !== file) {
      response.writeHead(404).end("Not found");
      return;
    }
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    if (!(await handle.stat()).isFile()) {
      await handle.close();
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-type": mime[extname(file)] || "application/octet-stream",
    });
    if (request.method === "HEAD") {
      await handle.close();
      response.end();
      return;
    }
    const stream = handle.createReadStream();
    stream.on("error", () => response.destroy());
    response.on("close", () => stream.destroy());
    stream.pipe(response);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    if (response.headersSent) response.destroy();
    else response.writeHead(["ENOENT", "ELOOP", "ENOTDIR"].includes(error.code) ? 404 : 500).end("Unavailable");
  }
});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createAppServer().listen(port, "127.0.0.1", () => {
    process.stdout.write(`余量原型已启动：http://127.0.0.1:${port}\n`);
  });
}
