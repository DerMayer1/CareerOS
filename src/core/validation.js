"use strict";

const ALLOWED_AI_SANDBOXES = new Set(["read-only", "workspace-write"]);
const ALLOWED_APPROVALS = new Set(["never", "on-request", "untrusted"]);
const APPLICATION_STATUSES = new Set([
  "ready_to_apply", "drafted", "applied", "interviewing", "offer",
  "rejected", "withdrawn", "archived"
]);
const SCORE_WEIGHT_KEYS = [
  "skills", "experience", "salary", "remote_compatibility",
  "company_quality", "growth_potential", "application_friction"
];

function validationError(scope, message) {
  const error = new Error(`Invalid ${scope}: ${message}`);
  error.code = "CAREER_OS_VALIDATION_ERROR";
  return error;
}

function assertObject(value, scope) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw validationError(scope, "expected an object");
  }
  return value;
}

function assertString(value, scope, { allowEmpty = false } = {}) {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    throw validationError(scope, allowEmpty ? "expected a string" : "expected a non-empty string");
  }
}

function assertStringArray(value, scope) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw validationError(scope, "expected an array of strings");
  }
}

function assertFiniteNumber(value, scope, { min = -Infinity, max = Infinity } = {}) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw validationError(scope, `expected a number between ${min} and ${max}`);
  }
}

function validateJob(job, index = 0) {
  assertObject(job, `job[${index}]`);
  assertString(job.id, `job[${index}].id`);
  assertString(job.title, `job[${index}].title`);
  assertString(job.company, `job[${index}].company`);
  if (job.score_fit !== undefined && job.score_fit !== null) {
    assertFiniteNumber(job.score_fit, `job[${index}].score_fit`, { min: 0, max: 100 });
  }
  if (job.recommendation !== undefined && !["unscored", "apply", "maybe", "watch", "skip"].includes(job.recommendation)) {
    throw validationError(`job[${index}].recommendation`, "expected unscored, apply, maybe, watch, or skip");
  }
  if (job.red_flags !== undefined && !Array.isArray(job.red_flags)) {
    throw validationError(`job[${index}].red_flags`, "expected an array");
  }
  return job;
}

function validateJobs(jobs) {
  if (!Array.isArray(jobs)) throw validationError("jobs", "expected an array");
  jobs.forEach(validateJob);
  return jobs;
}

function validateApplicationRows(rows) {
  if (!Array.isArray(rows)) throw validationError("applications", "expected an array");
  rows.forEach((row, index) => {
    assertObject(row, `application[${index}]`);
    assertString(row.application_id, `application[${index}].application_id`);
    assertString(row.job_id, `application[${index}].job_id`);
    if (row.status && !APPLICATION_STATUSES.has(row.status)) {
      throw validationError(`application[${index}].status`, `unknown status ${row.status}`);
    }
  });
  return rows;
}

function validateScoringWeights(value) {
  const weights = assertObject(value, "scoring weights");
  for (const key of SCORE_WEIGHT_KEYS) {
    assertFiniteNumber(weights[key], `scoring weights.${key}`, { min: 0, max: 100 });
  }
  const total = SCORE_WEIGHT_KEYS.reduce((sum, key) => sum + weights[key], 0);
  if (total !== 100) throw validationError("scoring weights", `weights must total 100, received ${total}`);
  return weights;
}

function validateSearchProfile(value) {
  const profile = assertObject(value, "search profile");
  for (const key of ["locations", "remote_modes", "target_roles", "keywords_required_any", "keywords_excluded"]) {
    assertStringArray(profile[key], `search profile.${key}`);
  }
  assertFiniteNumber(profile.job_age_days, "search profile.job_age_days", { min: 1, max: 365 });
  assertFiniteNumber(profile.salary_min_monthly_usd, "search profile.salary_min_monthly_usd", { min: 0, max: 1000000 });
  assertString(profile.timezone, "search profile.timezone");
  return profile;
}

function validateCandidateProfile(value) {
  const profile = assertObject(value, "candidate profile");
  assertString(profile.name, "candidate profile.name", { allowEmpty: true });
  for (const key of [
    "languages", "skills_strong", "skills_medium", "skills_learning", "skills_adjacent",
    "target_roles", "avoid_roles", "work_authorization", "accepted_regions", "contract_types"
  ]) assertStringArray(profile[key], `candidate profile.${key}`);
  assertFiniteNumber(profile.salary_min_monthly_usd, "candidate profile.salary_min_monthly_usd", { min: 0, max: 1000000 });
  assertFiniteNumber(profile.salary_target_monthly_usd, "candidate profile.salary_target_monthly_usd", { min: 0, max: 1000000 });
  assertString(profile.location, "candidate profile.location", { allowEmpty: true });
  assertString(profile.timezone, "candidate profile.timezone");
  return profile;
}

function validateSourcesConfig(value) {
  const config = assertObject(value, "sources config");
  assertFiniteNumber(config.default_limit, "sources config.default_limit", { min: 1, max: 1000 });
  assertFiniteNumber(config.cache_ttl_hours, "sources config.cache_ttl_hours", { min: 0, max: 8760 });
  const sources = assertObject(config.sources, "sources config.sources");
  for (const [name, source] of Object.entries(sources)) {
    assertObject(source, `source ${name}`);
    if (typeof source.enabled !== "boolean") throw validationError(`source ${name}.enabled`, "expected a boolean");
    assertString(source.type, `source ${name}.type`);
    if (source.max_limit !== undefined) assertFiniteNumber(source.max_limit, `source ${name}.max_limit`, { min: 0, max: 1000 });
  }
  return config;
}

function validateAiConfig(value) {
  const config = assertObject(value, "AI config");
  if (config.provider !== "codex-cli") throw validationError("AI config.provider", "only codex-cli is supported");
  if (typeof config.enabled !== "boolean") throw validationError("AI config.enabled", "expected a boolean");
  assertString(config.command, "AI config.command");
  if (!/^[\w@./:\\-]+(?:\.cmd|\.exe)?$/i.test(config.command)) {
    throw validationError("AI config.command", "contains unsafe shell characters");
  }
  if (!ALLOWED_AI_SANDBOXES.has(config.sandbox)) {
    throw validationError("AI config.sandbox", "expected read-only or workspace-write");
  }
  if (config.sandbox === "workspace-write" && config.allow_workspace_write !== true) {
    throw validationError("AI config", "workspace-write requires explicit allow_workspace_write=true");
  }
  if (!ALLOWED_APPROVALS.has(config.approval)) {
    throw validationError("AI config.approval", "expected never, on-request, or untrusted");
  }
  assertString(config.output_dir, "AI config.output_dir");
  if (pathEscapesWorkspace(config.output_dir)) {
    throw validationError("AI config.output_dir", "must be a relative path inside the workspace");
  }
  assertFiniteNumber(config.timeout_ms, "AI config.timeout_ms", { min: 1000, max: 900000 });
  assertFiniteNumber(config.max_prompt_chars, "AI config.max_prompt_chars", { min: 1000, max: 1000000 });
  assertFiniteNumber(config.max_output_chars, "AI config.max_output_chars", { min: 1000, max: 1000000 });
  if (typeof config.web_search !== "boolean") throw validationError("AI config.web_search", "expected a boolean");
  return config;
}

function pathEscapesWorkspace(value) {
  const normalized = String(value).replace(/\\/g, "/");
  return normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized) || normalized.split("/").includes("..");
}

module.exports = {
  validateAiConfig,
  validateApplicationRows,
  validateCandidateProfile,
  validateJob,
  validateJobs,
  validateScoringWeights,
  validateSearchProfile,
  validateSourcesConfig
};
