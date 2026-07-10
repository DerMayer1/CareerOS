"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { canonicalUrl, dedupeJobs } = require("../src/core/dedupe");

test("canonical URLs remove tracking parameters and fragments", () => {
  assert.equal(
    canonicalUrl("HTTPS://Example.com/jobs/123/?utm_source=x&ref=feed#apply"),
    "https://example.com/jobs/123"
  );
});

test("dedupe merges richer duplicate records while preserving stable identity", () => {
  const jobs = dedupeJobs([
    {
      id: "source:old",
      source_site: "Example",
      source_url: "https://example.com/jobs/1?utm_source=feed",
      title: "AI Engineer",
      company: "Example",
      location_raw: "Remote",
      description: "Short"
    },
    {
      id: "source:new",
      source_site: "Example",
      source_url: "https://example.com/jobs/1#details",
      title: "AI Engineer",
      company: "Example",
      location_raw: "Remote",
      description: "A substantially richer description of the same role"
    }
  ]);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, "source:old");
  assert.match(jobs[0].description, /substantially richer/);
});
