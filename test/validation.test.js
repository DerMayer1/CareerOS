"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  validateAiConfig,
  validateJob,
  validateScoringWeights
} = require("../src/core/validation");

test("accepts a valid normalized job and rejects invalid scores", () => {
  assert.doesNotThrow(() => validateJob({ id: "source:1", title: "Engineer", company: "Example", score_fit: 75 }));
  assert.throws(
    () => validateJob({ id: "source:1", title: "Engineer", company: "Example", score_fit: 101 }),
    /score_fit/
  );
});

test("scoring weights must be complete and total 100", () => {
  const valid = {
    skills: 30,
    experience: 20,
    salary: 15,
    remote_compatibility: 15,
    company_quality: 10,
    growth_potential: 5,
    application_friction: 5
  };
  assert.equal(validateScoringWeights(valid), valid);
  assert.throws(() => validateScoringWeights({ ...valid, skills: 29 }), /total 100/);
});

test("AI configuration is read-only by default and rejects unsafe commands", () => {
  const valid = {
    provider: "codex-cli",
    enabled: false,
    command: "codex",
    model: "",
    sandbox: "read-only",
    approval: "never",
    output_dir: "outputs/ai",
    web_search: false,
    timeout_ms: 300000,
    max_prompt_chars: 120000,
    max_output_chars: 120000
  };
  assert.equal(validateAiConfig(valid), valid);
  assert.throws(() => validateAiConfig({ ...valid, command: "codex & calc" }), /unsafe shell/);
  assert.throws(() => validateAiConfig({ ...valid, sandbox: "workspace-write" }), /explicit allow_workspace_write/);
  assert.throws(() => validateAiConfig({ ...valid, output_dir: "../outside" }), /inside the workspace/);
});

test("all published JSON schemas are valid JSON documents", () => {
  const dir = path.resolve(__dirname, "..", "schemas");
  const files = fs.readdirSync(dir).filter((name) => name.endsWith(".json"));
  assert(files.length >= 8);
  for (const file of files) {
    const schema = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert(schema.$id);
  }
});
