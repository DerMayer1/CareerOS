"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const cli = path.resolve(__dirname, "..", "bin", "career-os.js");

test("JSONL import preserves valid rows and records rejected rows", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "career-os-jsonl-"));
  try {
    assertSuccess(run(workspace, ["init"]));
    const input = path.join(workspace, "mixed.jsonl");
    fs.writeFileSync(input, [
      JSON.stringify({ title: "Engineer", company: "Example", source_url: "https://example.com/1" }),
      "{not valid json}",
      JSON.stringify({ title: "Designer", company: "Example", source_url: "https://example.com/2" })
    ].join("\n") + "\n");

    const result = run(workspace, ["import", input]);
    assertSuccess(result);
    assert.match(result.stderr, /Skipped 1 invalid JSONL rows/);
    assert.equal(fs.readFileSync(path.join(workspace, "data", "jobs_raw.jsonl"), "utf8").trim().split(/\r?\n/).length, 2);
    const errors = fs.readdirSync(path.join(workspace, "outputs", "import-errors"));
    assert.equal(errors.length, 1);
    const report = JSON.parse(fs.readFileSync(path.join(workspace, "outputs", "import-errors", errors[0]), "utf8"));
    assert.equal(report.rejected[0].line, 2);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("CLI errors are concise by default and machine-readable on request", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "career-os-errors-"));
  try {
    const concise = run(workspace, ["search", "remotive", "--unknown"]);
    assert.equal(concise.status, 2);
    assert.match(concise.stderr, /^CareerOS: Unknown flag/m);
    assert.doesNotMatch(concise.stderr, /\n\s+at /);

    const json = run(workspace, ["search", "remotive", "--unknown", "--json-errors"]);
    assert.equal(json.status, 2);
    const error = JSON.parse(json.stderr);
    assert.equal(error.error.code, "CAREER_OS_USAGE_ERROR");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

function run(workspace, args) {
  return childProcess.spawnSync(process.execPath, [cli, ...args], {
    cwd: workspace,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000
  });
}

function assertSuccess(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
