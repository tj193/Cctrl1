// Local same-origin preview for the admin UI. No build step or external packages.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.DARBGO_DEV_PORT || 5500);
const apiHost = "127.0.0.1";
const apiPort = 8001;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

http
  .createServer((request, response) => {
    const pathname = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
    if (
      pathname === "/health" ||
      pathname.startsWith("/auth/") ||
      pathname.startsWith("/admin/")
    ) {
      // Static admin assets are handled below; only API paths are proxied.
      const isApi =
        pathname === "/health" ||
        pathname.startsWith("/auth/") ||
        (pathname.startsWith("/admin/") &&
        pathname !== "/admin/dashboard.html" &&
          !pathname.startsWith("/admin/front-end/") &&
          !pathname.startsWith("/admin/JS-file/") &&
          !pathname.startsWith("/admin/css-file/"));
      if (isApi) {
        const upstream = http.request(
          {
            hostname: apiHost,
            port: apiPort,
            path: request.url,
            method: request.method,
            headers: { ...request.headers, host: `${apiHost}:${apiPort}` },
          },
          (upstreamResponse) => {
            response.writeHead(
              upstreamResponse.statusCode || 502,
              upstreamResponse.headers,
            );
            upstreamResponse.pipe(response);
          },
        );
        upstream.on("error", () => {
          if (!response.headersSent)
            response.writeHead(502, {
              "content-type": "text/plain; charset=utf-8",
            });
          response.end("DarbGo API is unavailable on port 8001.");
        });
        request.pipe(upstream);
        return;
      }
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405);
      response.end();
      return;
    }
    let target;
    try {
      target = path.resolve(root, `.${decodeURIComponent(pathname)}`);
    } catch {
      response.writeHead(400);
      response.end();
      return;
    }
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403);
      response.end();
      return;
    }
    if (pathname === "/") target = path.join(root, "index.html");
    fs.stat(target, (error, stat) => {
      if (error || !stat.isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, {
        "content-type":
          types[path.extname(target).toLowerCase()] ||
          "application/octet-stream",
        "cache-control": "no-store",
      });
      if (request.method === "HEAD") response.end();
      else fs.createReadStream(target).pipe(response);
    });
  })
  .listen(port, "127.0.0.1", () => {
    process.stdout.write(
      `DarbGo admin preview: http://127.0.0.1:${port}/admin/front-end/login.html\n`,
    );
  });
