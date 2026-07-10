"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { appendFileAtomicSync, writeFileAtomicSync } = require("../src/storage/atomic-file");

test("atomic writes replace content without leaving temporary files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "career-os-atomic-"));
  const file = path.join(dir, "state.json");
  try {
    writeFileAtomicSync(file, "first\n");
    writeFileAtomicSync(file, "second\n");
    appendFileAtomicSync(file, "third\n");
    assert.equal(fs.readFileSync(file, "utf8"), "second\nthird\n");
    assert.deepEqual(fs.readdirSync(dir), ["state.json"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
