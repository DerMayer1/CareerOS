"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { fetchText, searchProvider } = require("../src/sources/providers");

test("providers retry transient failures and normalize the successful response", async () => {
  let attempts = 0;
  await withServer((request, response) => {
    if (request.url.startsWith("/jobs")) {
      attempts += 1;
      if (attempts === 1) {
        response.writeHead(500).end("temporary");
        return;
      }
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ jobs: [{
        id: 1,
        title: "AI Engineer",
        company_name: "Example",
        candidate_required_location: "Worldwide",
        url: "https://example.com/jobs/1",
        description: "<p>Build systems</p>"
      }] }));
      return;
    }
    response.writeHead(404).end();
  }, async (baseUrl) => {
    const jobs = await searchProvider("remotive", { base_url: `${baseUrl}/jobs`, max_limit: 10 }, { query: "AI", limit: 10 });
    assert.equal(attempts, 2);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].description, "Build systems");
  });
});

test("HTTP reader limits redirects and response size", async () => {
  await withServer((request, response) => {
    if (request.url === "/loop") {
      response.writeHead(302, { location: "/loop" }).end();
      return;
    }
    response.end("x".repeat(128));
  }, async (baseUrl) => {
    await assert.rejects(() => fetchText(`${baseUrl}/loop`, { maxRedirects: 1, retries: 0 }), /Too many redirects/);
    await assert.rejects(() => fetchText(`${baseUrl}/large`, { maxBytes: 16, retries: 0 }), /exceeds 16 bytes/);
  });
});

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
