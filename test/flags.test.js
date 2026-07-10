"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { parseFlags } = require("../src/core/flags");

test("flags support equals syntax and typed validation", () => {
  assert.deepEqual(
    parseFlags(["--limit=5", "--dry-run"], { limit: { type: "number", min: 1 }, "dry-run": "boolean" }, "test"),
    { limit: 5, "dry-run": true }
  );
});

test("unknown, duplicate, and invalid flags are rejected", () => {
  assert.throws(() => parseFlags(["--wat"], {}, "test"), /Unknown flag/);
  assert.throws(() => parseFlags(["--name", "a", "--name", "b"], { name: "string" }, "test"), /Duplicate flag/);
  assert.throws(() => parseFlags(["--limit", "zero"], { limit: "number" }, "test"), /expects a number/);
});
