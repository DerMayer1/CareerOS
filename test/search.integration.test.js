"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const cli = path.resolve(__dirname, "..", "bin", "career-os.js");

test("search all isolates provider failures, bounds cache, and keeps dry-run read-only", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "career-os-search-"));
  let remotiveFails = false;
  await withServer((request, response) => {
    if (request.url.startsWith("/remotive")) {
      if (remotiveFails) return response.writeHead(503).end("offline");
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ jobs: [{
        id: 1,
        title: "AI Engineer",
        company_name: "Example",
        candidate_required_location: "Worldwide",
        url: "https://example.com/jobs/1",
        description: "Build AI systems"
      }] }));
      return;
    }
    response.writeHead(503).end("offline");
  }, async (baseUrl) => {
    try {
      assertSuccess(await run(workspace, ["init"]));
      const sourceConfig = {
        default_limit: 10,
        cache_ttl_hours: 6,
        cache_max_entries: 2,
        sources: {
          remotive: { enabled: true, type: "public_api", phase: 2, base_url: `${baseUrl}/remotive`, max_limit: 10 },
          jobicy: { enabled: true, type: "public_api", phase: 2, base_url: `${baseUrl}/jobicy`, max_limit: 10 }
        }
      };
      fs.writeFileSync(path.join(workspace, "config", "sources.json"), JSON.stringify(sourceConfig, null, 2));

      const first = await run(workspace, ["search", "all", "--query", "AI", "--limit", "5"]);
      assertSuccess(first);
      assert.match(first.stderr, /Source jobicy failed/);
      assert.equal(fs.readFileSync(path.join(workspace, "data", "jobs_raw.jsonl"), "utf8").trim().split(/\r?\n/).length, 1);

      const cachePath = path.join(workspace, "data", "source_cache.json");
      assertSuccess(await run(workspace, ["search", "remotive", "--query", "second", "--limit", "5"]));
      const beforeDryRun = fs.readFileSync(cachePath, "utf8");
      assert(Object.keys(JSON.parse(beforeDryRun).searches).length <= 2);
      const dryRun = await run(workspace, ["search", "all", "--query", "different", "--limit", "5", "--dry-run", "--no-cache"]);
      assertSuccess(dryRun);
      assert.equal(fs.readFileSync(cachePath, "utf8"), beforeDryRun);

      const cache = JSON.parse(beforeDryRun);
      for (const entry of Object.values(cache.searches)) entry.fetched_at = "2000-01-01T00:00:00.000Z";
      fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
      remotiveFails = true;
      const fallback = await run(workspace, ["search", "remotive", "--query", "AI", "--limit", "5"]);
      assertSuccess(fallback);
      assert.match(fallback.stderr, /using stale cache/);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});

function run(workspace, args) {
  return new Promise((resolve) => {
    const child = childProcess.spawn(process.execPath, [cli, ...args], {
      cwd: workspace,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function assertSuccess(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

async function withServer(handler, operation) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await operation(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}
