const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const childProcess = require("child_process");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const OUTPUTS_DIR = path.join(ROOT, "outputs");

const PATHS = {
  searchProfile: path.join(ROOT, "config", "search_profile.json"),
  scoringWeights: path.join(ROOT, "config", "scoring_weights.json"),
  sourcesConfig: path.join(ROOT, "config", "sources.json"),
  aiConfig: path.join(ROOT, "config", "ai.json"),
  candidateProfile: path.join(ROOT, "profile", "candidate-profile.md"),
  candidateProfileJson: path.join(ROOT, "profile", "candidate-profile.json"),
  skillTaxonomy: path.join(ROOT, "profile", "skill-taxonomy.json"),
  rolePreferences: path.join(ROOT, "profile", "role-preferences.md"),
  rawJobs: path.join(DATA_DIR, "jobs_raw.jsonl"),
  normalizedJobs: path.join(DATA_DIR, "jobs_normalized.json"),
  seenJobs: path.join(DATA_DIR, "seen_jobs.json"),
  sourceCache: path.join(DATA_DIR, "source_cache.json"),
  applications: path.join(DATA_DIR, "applications.csv"),
  reports: path.join(OUTPUTS_DIR, "reports"),
  tables: path.join(OUTPUTS_DIR, "tables"),
  aiOutputs: path.join(OUTPUTS_DIR, "ai")
};

const APPLICATION_HEADERS = [
  "application_id",
  "job_id",
  "company",
  "role_title",
  "status",
  "recommendation",
  "score_fit",
  "created_at",
  "approved_at",
  "drafted_at",
  "applied_at",
  "last_follow_up",
  "next_follow_up",
  "application_dir",
  "job_url",
  "apply_url",
  "source_site",
  "salary_range",
  "notes"
];

const APPLICATION_STATUSES = new Set([
  "ready_to_apply",
  "drafted",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
  "archived"
]);

function main(args) {
  const command = args[0];
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "init") return initProject();
  if (command === "sources" && args[1] === "list") return listSources();
  if (command === "search") return searchJobs(args.slice(1));
  if (command === "import") return importJobs(args[1]);
  if (command === "normalize") return normalizeJobs();
  if (command === "dedupe") return dedupeJobs();
  if (command === "extract") return extractJobs();
  if (command === "score") return scoreJobs();
  if (command === "report") return generateReport();
  if (command === "run") return runPipeline(args.slice(1));
  if (command === "status") return showStatus();
  if (command === "profile" && args[1] === "check") return checkProfile();
  if (command === "ai") return runAiCommand(args.slice(1));
  if (command === "applications" && args[1] === "list") return listApplications(args[2]);
  if (command === "applications" && args[1] === "status") return updateApplicationStatus(args[2], args[3]);
  if (command === "applications" && args[1] === "followup") return updateApplicationFollowup(args[2], args.slice(3));
  if (command === "application" && args[1] === "plan") return generateApplicationArtifact(args[2], "plan");
  if (command === "application" && args[1] === "cv-notes") return generateApplicationArtifact(args[2], "cv-notes");
  if (command === "application" && args[1] === "draft") return generateApplicationArtifact(args[2], "draft");
  if (command === "interview") return generateInterviewPrep(args[1]);
  if (command === "approve") return approveJob(args[1]);
  if (command === "apply") return applyJob(args[1]);
  if (command === "reset") return resetData(args.slice(1));
  if (command === "show" && args[1] === "top") return showTop(args[2]);
  if (command === "show" && args[1] === "extracted") return showExtracted(args[2]);
  if (command === "show" && args[1] === "gaps") return showTable("skill_gap_heatmap", args[2]);
  if (command === "show" && args[1] === "red-flags") return showTable("red_flags", args[2]);
  if (command === "explain") return explainJob(args[1]);
  if (command === "show" && args[1]) return showTable(args[1], args[2]);

  throw new Error(`Unknown command: ${args.join(" ")}`);
}

function printHelp() {
  console.log(`CareerOS / RemoteRadar CLI

Usage:
  career-os init
  career-os sources list
  career-os search <source|all> --query "AI Engineer" --limit 20
  career-os import <jobs.json|jobs.jsonl|jobs.csv>
  career-os normalize
  career-os dedupe
  career-os extract
  career-os score
  career-os report
  career-os status
  career-os profile check
  career-os ai doctor
  career-os ai profile-sync [--dry-run]
  career-os ai extract <job_id|new> [--limit 5] [--dry-run]
  career-os ai review-fit <job_id> [--dry-run]
  career-os ai summarize-report [--dry-run]
  career-os ai draft <application_id|job_id> [--dry-run]
  career-os ai review-draft <application_id|job_id> [--dry-run]
  career-os ai interview <application_id|job_id> [--dry-run]
  career-os applications list [limit]
  career-os applications status <application_id> <status>
  career-os applications followup <application_id> --date YYYY-MM-DD
  career-os application plan <application_id|job_id>
  career-os application cv-notes <application_id|job_id>
  career-os application draft <application_id|job_id>
  career-os interview <application_id|job_id>
  career-os show top [limit]
  career-os show gaps [limit]
  career-os show red-flags [limit]
  career-os show <table-name> [limit]
  career-os explain <job_id>
  career-os approve <job_id>
  career-os apply <job_id>
  career-os reset --data
  career-os run <jobs-file>

MVP flow:
  1. career-os init
  2. career-os import ./jobs.json
  3. career-os normalize
  4. career-os score
  5. career-os report
  6. career-os show top
`);
}

function initProject() {
  ensureDirs();
  writeIfMissing("AGENTS.md", agentsMd());
  writeIfMissing("README.md", readmeMd());
  writeIfMissing("SETUP.md", setupMd());
  writeIfMissing(PATHS.searchProfile, JSON.stringify(defaultSearchProfile(), null, 2) + "\n");
  writeIfMissing(PATHS.scoringWeights, JSON.stringify(defaultScoringWeights(), null, 2) + "\n");
  writeIfMissing(PATHS.sourcesConfig, JSON.stringify(defaultSourcesConfig(), null, 2) + "\n");
  writeIfMissing(PATHS.aiConfig, JSON.stringify(defaultAiConfig(), null, 2) + "\n");
  writeIfMissing(PATHS.candidateProfile, candidateProfileMd());
  writeIfMissing(PATHS.candidateProfileJson, JSON.stringify(defaultCandidateProfileJson(), null, 2) + "\n");
  writeIfMissing(PATHS.skillTaxonomy, JSON.stringify(defaultSkillTaxonomy(), null, 2) + "\n");
  writeIfMissing(PATHS.rolePreferences, rolePreferencesMd());
  writeIfMissing(path.join(ROOT, "workflows", "search.md"), workflowSearchMd());
  writeIfMissing(path.join(ROOT, "workflows", "search-remote.md"), workflowSearchRemoteMd());
  writeIfMissing(path.join(ROOT, "workflows", "score.md"), workflowScoreMd());
  writeIfMissing(path.join(ROOT, "workflows", "report.md"), workflowReportMd());
  writeIfMissing(path.join(ROOT, "workflows", "setup.md"), workflowSetupMd());
  writeIfMissing(path.join(ROOT, "workflows", "apply.md"), workflowApplyMd());
  writeIfMissing(path.join(ROOT, "workflows", "ai.md"), workflowAiMd());
  writeIfMissing(path.join(ROOT, "workflows", "reset.md"), workflowResetMd());
  writeIfMissing(path.join(ROOT, "skills", "job-radar", "SKILL.md"), jobRadarSkillMd());
  writeIfMissing(path.join(ROOT, "skills", "job-radar", "scoring-rules.md"), scoringRulesMd());
  writeIfMissing(path.join(ROOT, "skills", "job-radar", "search-rules.md"), searchRulesMd());
  writeIfMissing(path.join(ROOT, "skills", "job-radar", "red-flags.md"), redFlagsMd());
  writeIfMissing(path.join(ROOT, "skills", "job-application", "SKILL.md"), jobApplicationSkillMd());
  writeIfMissing(path.join(ROOT, "skills", "job-application", "evaluation-framework.md"), evaluationFrameworkMd());
  writeIfMissing(path.join(ROOT, "docs", "claude-to-codex-migration.md"), migrationMd());
  writeIfMissing(path.join(ROOT, "docs", "codex-cli-integration.md"), codexCliIntegrationMd());
  writeIfMissing(path.join(ROOT, "sources", "README.md"), sourcesReadmeMd());
  writeIfMissing(PATHS.rawJobs, "");
  writeIfMissing(PATHS.normalizedJobs, "[]\n");
  writeIfMissing(PATHS.seenJobs, JSON.stringify({ seen: {} }, null, 2) + "\n");
  writeIfMissing(PATHS.sourceCache, JSON.stringify({ searches: {} }, null, 2) + "\n");
  writeIfMissing(PATHS.applications, applicationHeaderLine());
  console.log("Initialized CareerOS CLI project.");
}

async function listSources() {
  ensureDirs();
  const config = readJson(PATHS.sourcesConfig, defaultSourcesConfig());
  const rows = Object.entries(config.sources || {}).map(([name, source]) => ({
    source: name,
    enabled: source.enabled !== false,
    type: source.type || "unknown",
    phase: source.phase || "unknown",
    url: source.base_url || source.feed_url || ""
  }));
  console.log(toCsv(rows));
}

async function searchJobs(args) {
  const sourceName = args[0];
  if (!sourceName) throw new Error("Missing source. Usage: career-os search <source|all> --query \"AI Engineer\" --limit 20");
  ensureDirs();
  const flags = parseFlags(args.slice(1));
  const config = readJson(PATHS.sourcesConfig, defaultSourcesConfig());
  const sources = config.sources || {};
  const selected = sourceName === "all"
    ? Object.keys(sources).filter((name) => sources[name].enabled !== false)
    : [sourceName];

  const allJobs = [];
  const manualLinks = [];
  for (const name of selected) {
    if (!sources[name]) throw new Error(`Unknown source: ${name}`);
    if (sources[name].enabled === false) continue;
    if (sources[name].type === "manual_search") {
      manualLinks.push({ source: name, url: buildManualSearchUrl(sources[name], flags.query || "") });
      continue;
    }
    const jobs = await searchSource(name, sources[name], flags, config);
    allJobs.push(...jobs.map((job) => ({ ...job, source_site: job.source_site || name })));
  }

  if (flags["dry-run"]) {
    console.log(JSON.stringify({ dry_run: true, count: allJobs.length, jobs: allJobs.slice(0, Number(flags.limit || 10)), manual_links: manualLinks }, null, 2));
    return;
  }

  appendRawJobs(allJobs, { source: sourceName, query: flags.query || "", imported_via: "search" });
  if (manualLinks.length) {
    for (const link of manualLinks) console.log(`${link.source}: ${link.url}`);
  }
  console.log(`Search complete. Wrote ${allJobs.length} raw jobs into ${relative(PATHS.rawJobs)}.`);
}

async function searchSource(name, source, flags, config) {
  const query = String(flags.query || "");
  const limit = Math.max(1, Math.min(Number(flags.limit || config.default_limit || 25), source.max_limit || 100));
  const cacheKey = stableId([name, query, limit, flags.days || "", flags.location || ""]);
  const cache = readJson(PATHS.sourceCache, { searches: {} });
  const cacheTtlHours = Number(config.cache_ttl_hours || 6);
  const cached = cache.searches[cacheKey];
  if (!flags["no-cache"] && cached && Date.now() - Date.parse(cached.fetched_at) < cacheTtlHours * 60 * 60 * 1000) {
    return cached.jobs.slice(0, limit);
  }

  let jobs;
  if (name === "remotive") jobs = await searchRemotive(source, query, limit);
  else if (name === "jobicy") jobs = await searchJobicy(source, query, limit);
  else if (name === "remoteok") jobs = await searchRemoteOk(source, query, limit);
  else if (name === "wwr") jobs = await searchWwr(source, query, limit);
  else throw new Error(`No connector implemented for source: ${name}`);

  cache.searches[cacheKey] = { source: name, query, limit, fetched_at: new Date().toISOString(), jobs };
  fs.writeFileSync(PATHS.sourceCache, JSON.stringify(cache, null, 2) + "\n");
  return jobs.slice(0, limit);
}

function appendRawJobs(jobs, meta) {
  if (!jobs.length) return;
  const now = new Date().toISOString();
  const lines = jobs.map((job) => JSON.stringify({ imported_at: now, ...meta, raw: job }));
  fs.appendFileSync(PATHS.rawJobs, lines.join("\n") + "\n");
}

function importJobs(filePath) {
  if (!filePath) throw new Error("Missing jobs file. Usage: career-os import <jobs.json|jobs.jsonl|jobs.csv>");
  ensureDirs();
  const absolute = path.resolve(ROOT, filePath);
  const text = fs.readFileSync(absolute, "utf8");
  const ext = path.extname(absolute).toLowerCase();
  const jobs = ext === ".csv" ? parseCsv(text) : parseJsonOrJsonl(text);
  if (!jobs.length) throw new Error("No jobs found in input file.");

  const now = new Date().toISOString();
  const lines = jobs.map((job) => JSON.stringify({ imported_at: now, source_file: absolute, raw: job }));
  fs.appendFileSync(PATHS.rawJobs, lines.join("\n") + "\n");
  console.log(`Imported ${jobs.length} raw jobs into ${relative(PATHS.rawJobs)}.`);
}

function normalizeJobs() {
  ensureDirs();
  const rawEntries = readJsonl(PATHS.rawJobs);
  const normalized = rawEntries.map((entry) => normalizeJob(entry.raw || entry, entry));
  const unique = dedupeById(normalized);
  fs.writeFileSync(PATHS.normalizedJobs, JSON.stringify(unique, null, 2) + "\n");
  updateSeenJobs(unique);
  console.log(`Normalized ${unique.length} unique jobs into ${relative(PATHS.normalizedJobs)}.`);
}

function dedupeJobs() {
  ensureDirs();
  const jobs = readJson(PATHS.normalizedJobs, []);
  const unique = dedupeById(jobs);
  fs.writeFileSync(PATHS.normalizedJobs, JSON.stringify(unique, null, 2) + "\n");
  updateSeenJobs(unique);
  console.log(`Deduped ${jobs.length} normalized jobs down to ${unique.length}.`);
}

function extractJobs() {
  ensureDirs();
  const jobs = readJson(PATHS.normalizedJobs, []);
  const profile = readJson(PATHS.candidateProfileJson, defaultCandidateProfileJson());
  const taxonomy = readJson(PATHS.skillTaxonomy, defaultSkillTaxonomy());
  const extracted = jobs.map((job) => extractJobSignals(job, profile, taxonomy));
  fs.writeFileSync(PATHS.normalizedJobs, JSON.stringify(extracted, null, 2) + "\n");
  console.log(`Extracted deterministic signals for ${extracted.length} jobs.`);
}

function scoreJobs() {
  ensureDirs();
  const jobs = readJson(PATHS.normalizedJobs, []);
  const config = readJson(PATHS.searchProfile, defaultSearchProfile());
  const weights = readJson(PATHS.scoringWeights, defaultScoringWeights());
  const profileText = readText(PATHS.candidateProfile);
  const profile = readJson(PATHS.candidateProfileJson, defaultCandidateProfileJson());
  const scored = jobs.map((job) => scoreJob(job, config, weights, profileText, profile));
  fs.writeFileSync(PATHS.normalizedJobs, JSON.stringify(scored, null, 2) + "\n");
  console.log(`Scored ${scored.length} jobs.`);
}

function generateReport() {
  ensureDirs();
  const jobs = readJson(PATHS.normalizedJobs, []);
  const scored = jobs.filter((job) => Number.isFinite(job.score_fit));
  const tables = buildTables(scored);
  for (const [name, rows] of Object.entries(tables)) {
    fs.writeFileSync(path.join(PATHS.tables, `${name}.csv`), toCsv(rows) + "\n");
  }
  const today = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(PATHS.reports, `${today}-remote-radar.md`);
  fs.writeFileSync(reportPath, reportMarkdown(today, scored, tables));
  console.log(`Generated report: ${relative(reportPath)}`);
}

function runPipeline(args) {
  const file = args[0];
  if (file) importJobs(file);
  normalizeJobs();
  dedupeJobs();
  extractJobs();
  scoreJobs();
  generateReport();
}

function showTop(limitArg) {
  const limit = Math.max(1, Number(limitArg || 10));
  const jobs = readJson(PATHS.normalizedJobs, [])
    .filter((job) => job.recommendation === "apply" || job.recommendation === "maybe")
    .sort((a, b) => (b.score_fit || 0) - (a.score_fit || 0))
    .slice(0, limit);

  if (!jobs.length) {
    console.log("No top matches yet. Run: career-os score");
    return;
  }

  console.log(toCsv(jobs.map(toTableRow)));
}

function showTable(tableName, limitArg) {
  const allowed = new Set(["top_matches", "high_salary_medium_fit", "easy_wins", "stretch_roles", "skip", "skill_gap_heatmap", "red_flags", "salary_transparency", "remote_fit", "best_next_actions"]);
  if (!allowed.has(tableName)) throw new Error(`Unknown table: ${tableName}`);
  const limit = Math.max(1, Number(limitArg || 25));
  const tablePath = path.join(PATHS.tables, `${tableName}.csv`);
  if (!fs.existsSync(tablePath)) throw new Error(`Missing ${relative(tablePath)}. Run: career-os report`);
  const rows = fs.readFileSync(tablePath, "utf8").trim().split(/\r?\n/);
  console.log(rows.slice(0, limit + 1).join("\n"));
}

function explainJob(jobId) {
  if (!jobId) throw new Error("Missing job id. Usage: career-os explain <job_id>");
  const jobs = readJson(PATHS.normalizedJobs, []);
  const job = jobs.find((item) => item.id === jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  const lines = [
    `# ${job.company} - ${job.title}`,
    "",
    `- ID: ${job.id}`,
    `- Recommendation: ${job.recommendation}`,
    `- Score: ${job.score_fit}`,
    `- Source: ${job.source_site}`,
    `- URL: ${job.source_url}`,
    "",
    "## Component Scores",
    "",
    `- Skills: ${job.score_skills}`,
    `- Experience: ${job.score_experience}`,
    `- Salary: ${job.score_salary}`,
    `- Remote: ${job.score_remote}`,
    `- Company: ${job.score_company}`,
    `- Growth: ${job.score_growth}`,
    `- Application friction: ${job.score_application_friction}`,
    `- Risk: ${job.score_risk}`,
    "",
    "## Explanation",
    "",
    ...Object.entries(job.score_explanation || {}).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Requirements",
    "",
    `- Matched: ${listCell(job.matched_requirements) || "none"}`,
    `- Partial: ${listCell(job.partial_matches) || "none"}`,
    `- Missing: ${listCell(job.missing_requirements) || "none"}`,
    "",
    "## Red Flags",
    "",
    ...((job.red_flags || []).length ? (job.red_flags || []).map((flag) => `- ${flag.severity}: ${flag.message}`) : ["- none"])
  ];
  console.log(lines.join("\n"));
}

function showExtracted(limitArg) {
  const limit = Math.max(1, Number(limitArg || 10));
  const jobs = readJson(PATHS.normalizedJobs, []).slice(0, limit).map((job) => ({
    id: job.id,
    company: job.company,
    role_title: job.title,
    seniority: job.seniority,
    required: listCell(job.requirements_required),
    nice_to_have: listCell(job.requirements_nice_to_have),
    matched: listCell(job.matched_requirements),
    partial: listCell(job.partial_matches),
    missing: listCell(job.missing_requirements),
    years: job.extracted_signals?.years_experience_min || "",
    remote_region: job.remote_region,
    work_authorization: listCell(job.extracted_signals?.work_authorization),
    red_flags: listCell((job.red_flags || []).map((flag) => `${flag.severity}:${flag.message}`))
  }));
  if (!jobs.length) {
    console.log("No extracted jobs yet. Run: career-os extract");
    return;
  }
  console.log(toCsv(jobs));
}

function showStatus() {
  ensureDirs();
  const rawCount = readJsonl(PATHS.rawJobs).length;
  const jobs = readJson(PATHS.normalizedJobs, []);
  const applications = readCsvFile(PATHS.applications);
  const counts = countBy(jobs, "recommendation");
  const status = {
    raw_jobs: rawCount,
    normalized_jobs: jobs.length,
    scored_jobs: jobs.filter((job) => Number.isFinite(job.score_fit)).length,
    recommendations: counts,
    applications: applications.length,
    latest_report: latestFile(PATHS.reports, ".md") || null
  };
  console.log(JSON.stringify(status, null, 2));
}

function checkProfile() {
  ensureDirs();
  const checks = [
    ["candidate profile", PATHS.candidateProfile],
    ["candidate profile json", PATHS.candidateProfileJson],
    ["skill taxonomy", PATHS.skillTaxonomy],
    ["role preferences", PATHS.rolePreferences],
    ["search profile", PATHS.searchProfile],
    ["scoring weights", PATHS.scoringWeights]
  ].map(([label, filePath]) => {
    const exists = fs.existsSync(filePath);
    const text = exists ? fs.readFileSync(filePath, "utf8") : "";
    const todoCount = (text.match(/\bTODO\b|\[[A-Z0-9_]+\]/g) || []).length;
    const parseError = filePath.endsWith(".json") ? jsonParseError(text) : "";
    return { label, path: relative(filePath), exists, todo_count: todoCount, parse_error: parseError || null, ready: exists && todoCount === 0 && !parseError };
  });
  console.log(JSON.stringify({ ready: checks.every((check) => check.ready), checks }, null, 2));
}

function runAiCommand(args) {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    printAiHelp();
    return;
  }

  if (subcommand === "doctor") return aiDoctor();
  if (subcommand === "profile-sync") return aiProfileSync(args.slice(1));
  if (subcommand === "extract") return aiExtract(args.slice(1));
  if (subcommand === "review-fit") return aiReviewFit(args.slice(1));
  if (subcommand === "summarize-report") return aiSummarizeReport(args.slice(1));
  if (subcommand === "draft") return aiDraft(args.slice(1));
  if (subcommand === "review-draft") return aiReviewDraft(args.slice(1));
  if (subcommand === "interview") return aiInterview(args.slice(1));

  throw new Error(`Unknown ai command: ${subcommand}`);
}

function printAiHelp() {
  console.log(`CareerOS AI commands

Usage:
  career-os ai doctor
  career-os ai profile-sync [--dry-run]
  career-os ai extract <job_id|new> [--limit 5] [--dry-run]
  career-os ai review-fit <job_id> [--dry-run]
  career-os ai summarize-report [--dry-run]
  career-os ai draft <application_id|job_id> [--dry-run]
  career-os ai review-draft <application_id|job_id> [--dry-run]
  career-os ai interview <application_id|job_id> [--dry-run]

Rules:
  AI commands call Codex CLI through codex exec.
  Prompts and responses are saved under outputs/ai.
  Application AI commands require the normal approve/apply gate first.
  CareerOS never submits applications or contacts employers automatically.
`);
}

function aiDoctor() {
  ensureDirs();
  const config = readJson(PATHS.aiConfig, defaultAiConfig());
  const pathProbe = probeCodexCommand(config, "path");
  const versionProbe = probeCodexCommand(config, "version");
  const execProbe = probeCodexCommand(config, "exec-help");
  console.log(JSON.stringify({
    provider: config.provider || "codex-cli",
    enabled: config.enabled !== false,
    command: config.command || "codex",
    sandbox: config.sandbox || "workspace-write",
    approval: config.approval || "never",
    web_search: Boolean(config.web_search),
    available: versionProbe.ok && execProbe.ok,
    path: pathProbe.output.trim(),
    version: versionProbe.output.trim(),
    exec_help_available: execProbe.ok,
    errors: [pathProbe, versionProbe, execProbe].filter((probe) => !probe.ok).map((probe) => ({
      check: probe.check,
      error: probe.error
    }))
  }, null, 2));
}

function aiProfileSync(args) {
  const flags = parseFlags(args);
  const prompt = aiPrompt("Profile Sync", `
Review the CareerOS profile files and return practical profile improvements.

Constraints:
- Do not invent experience, compensation, credentials, work authorization, or company facts.
- Keep uncertain data as unknown.
- Do not edit files directly.
- Return Markdown with a short findings list and exact proposed patches or replacement snippets.

Files:

## profile/candidate-profile.md
${fence(readText(PATHS.candidateProfile), "markdown")}

## profile/candidate-profile.json
${fence(JSON.stringify(readJson(PATHS.candidateProfileJson, defaultCandidateProfileJson()), null, 2), "json")}

## profile/role-preferences.md
${fence(readText(PATHS.rolePreferences), "markdown")}

## profile/skill-taxonomy.json
${fence(JSON.stringify(readJson(PATHS.skillTaxonomy, defaultSkillTaxonomy()), null, 2), "json")}
`);
  runCodexPrompt("profile-sync", prompt, flags);
}

function aiExtract(args) {
  const target = args[0];
  if (!target) throw new Error("Usage: career-os ai extract <job_id|new> [--limit 5] [--dry-run]");
  const flags = parseFlags(args.slice(1));
  const limit = Math.max(1, Math.min(Number(flags.limit || 5), 20));
  const jobs = readJson(PATHS.normalizedJobs, []);
  const selected = target === "new"
    ? jobs.filter((job) => !job.extracted_signals || !Object.keys(job.extracted_signals || {}).length).slice(0, limit)
    : jobs.filter((job) => job.id === target).slice(0, limit);
  if (!selected.length) throw new Error(`No jobs found for AI extraction target: ${target}`);

  const prompt = aiPrompt("Requirement Extraction", `
Extract job requirements from the selected CareerOS jobs.

Constraints:
- Do not change files.
- Do not guess missing facts.
- Use "unknown" for missing seniority, authorization, salary, or remote constraints.
- Return one JSON object with a "jobs" array keyed by job_id.
- For each job include required_skills, nice_to_have_skills, responsibilities, seniority, work_authorization, remote_constraints, salary_notes, red_flags, and confidence.

Selected jobs:
${fence(JSON.stringify(selected.map(aiJobPayload), null, 2), "json")}
`);
  runCodexPrompt(`extract-${target}`, prompt, flags);
}

function aiReviewFit(args) {
  const jobId = args[0];
  if (!isValidIdArg(jobId)) throw new Error("Usage: career-os ai review-fit <job_id> [--dry-run]");
  const flags = parseFlags(args.slice(1));
  const job = findJob(jobId);
  const prompt = aiPrompt("Fit Review", `
Review whether the deterministic CareerOS score and recommendation are sensible.

Constraints:
- Do not edit files.
- Do not invent candidate facts.
- Keep the deterministic score as the source of truth unless you identify a concrete issue.
- Return Markdown with: verdict, score concerns, missing information, red flags, and recommended next action.

Candidate profile:
${fence(JSON.stringify(readJson(PATHS.candidateProfileJson, defaultCandidateProfileJson()), null, 2), "json")}

Profile notes:
${fence(truncateText(readText(PATHS.candidateProfile), 6000), "markdown")}

Job:
${fence(JSON.stringify(aiJobPayload(job), null, 2), "json")}
`);
  runCodexPrompt(`review-fit-${job.id}`, prompt, flags);
}

function aiSummarizeReport(args) {
  const flags = parseFlags(args);
  const latestReport = latestFile(PATHS.reports, ".md");
  if (!latestReport) throw new Error("No report found. Run career-os report first.");
  const reportPath = path.join(ROOT, latestReport);
  const tables = {};
  if (fs.existsSync(PATHS.tables)) {
    for (const file of fs.readdirSync(PATHS.tables).filter((name) => name.endsWith(".csv"))) {
      tables[file] = truncateText(readText(path.join(PATHS.tables, file)), 12000);
    }
  }
  const prompt = aiPrompt("Report Summary", `
Summarize the latest CareerOS decision report for a human operator.

Constraints:
- Do not fetch new jobs.
- Do not rescore jobs.
- Do not invent missing facts.
- Return concise Markdown with: best opportunities, avoid list, skill gaps, salary concerns, and next manual actions.

Latest report path: ${latestReport}

Report:
${fence(truncateText(readText(reportPath), 20000), "markdown")}

CSV tables:
${fence(JSON.stringify(tables, null, 2), "json")}
`);
  runCodexPrompt("report-summary", prompt, flags);
}

function aiDraft(args) {
  const id = args[0];
  if (!isValidIdArg(id)) throw new Error("Usage: career-os ai draft <application_id|job_id> [--dry-run]");
  const flags = parseFlags(args.slice(1));
  const context = getApplicationContext(id);
  const dir = ensureApplicationDir(context.job, context.application);
  const prompt = aiApplicationPrompt("Application Draft", context, dir, `
Create reviewable application drafts for the approved job.

Constraints:
- Do not claim unsupported experience or credentials.
- Do not change compensation, location, authorization, or company facts.
- Do not submit anything.
- Return Markdown with sections: application_message, cover_letter, cv_tailoring_notes, questions_to_answer_before_submitting.
- Keep the application message concise enough for a web form.
`);
  const result = runCodexPrompt(`draft-${context.application.application_id}`, prompt, flags);
  copyAiOutputToApplication(result, dir, "ai-draft.md", flags);
}

function aiReviewDraft(args) {
  const id = args[0];
  if (!isValidIdArg(id)) throw new Error("Usage: career-os ai review-draft <application_id|job_id> [--dry-run]");
  const flags = parseFlags(args.slice(1));
  const context = getApplicationContext(id);
  const dir = ensureApplicationDir(context.job, context.application);
  const prompt = aiApplicationPrompt("Draft Review", context, dir, `
Review the current application workspace for accuracy, fit, and submission risk.

Constraints:
- Do not rewrite everything unless there is a concrete reason.
- Flag unsupported claims, vague evidence, missing information, and tone problems.
- Do not submit anything.
- Return Markdown with: approval_status, required_fixes, optional_improvements, unsupported_claims, final_checklist.
`);
  const result = runCodexPrompt(`review-draft-${context.application.application_id}`, prompt, flags);
  copyAiOutputToApplication(result, dir, "ai-draft-review.md", flags);
}

function aiInterview(args) {
  const id = args[0];
  if (!isValidIdArg(id)) throw new Error("Usage: career-os ai interview <application_id|job_id> [--dry-run]");
  const flags = parseFlags(args.slice(1));
  const context = getApplicationContext(id);
  const dir = ensureApplicationDir(context.job, context.application);
  const prompt = aiApplicationPrompt("Interview Prep", context, dir, `
Create an interview preparation brief for this approved application.

Constraints:
- Do not invent candidate background.
- Mark unknowns explicitly.
- Return Markdown with: likely interview themes, job-specific talking points, questions to ask, gaps to prepare, and short practice prompts.
`);
  const result = runCodexPrompt(`interview-${context.application.application_id}`, prompt, flags);
  copyAiOutputToApplication(result, dir, "ai-interview-prep.md", flags);
}

function aiPrompt(title, body) {
  return `# CareerOS Codex Task: ${title}

You are assisting CareerOS, a local-first decision system for remote jobs.

Operating rules:
- Use the provided local context only unless explicitly told otherwise.
- Preserve the approval gate. Do not generate or suggest submitting applications for unapproved jobs.
- Do not invent candidate experience, compensation, credentials, work authorization, or company facts.
- Keep uncertain data as unknown.
- Prefer concise, reviewable Markdown or JSON.

${body.trim()}
`;
}

function aiApplicationPrompt(title, context, dir, task) {
  const workspaceFiles = readApplicationWorkspace(dir);
  return aiPrompt(title, `
${task.trim()}

Application tracker row:
${fence(JSON.stringify(context.application, null, 2), "json")}

Job:
${fence(JSON.stringify(aiJobPayload(context.job), null, 2), "json")}

Candidate profile JSON:
${fence(JSON.stringify(readJson(PATHS.candidateProfileJson, defaultCandidateProfileJson()), null, 2), "json")}

Candidate profile notes:
${fence(truncateText(readText(PATHS.candidateProfile), 8000), "markdown")}

Application workspace files from ${relative(dir)}:
${fence(JSON.stringify(workspaceFiles, null, 2), "json")}
`);
}

function runCodexPrompt(label, prompt, flags = {}) {
  ensureDirs();
  const config = readJson(PATHS.aiConfig, defaultAiConfig());
  const outputDir = path.resolve(ROOT, config.output_dir || "outputs/ai");
  fs.mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeLabel = slugify(label || "codex");
  const promptPath = path.join(outputDir, `${timestamp}-${safeLabel}.prompt.md`);
  const outputPath = path.join(outputDir, `${timestamp}-${safeLabel}.md`);
  fs.writeFileSync(promptPath, prompt);

  if (flags["dry-run"] || config.enabled === false) {
    console.log(`Wrote prompt: ${relative(promptPath)}`);
    if (config.enabled === false && !flags["dry-run"]) console.log("AI config is disabled; skipped Codex execution.");
    return { promptPath, outputPath, skipped: true };
  }

  const codexArgs = [
    "exec",
    "--cd", ROOT,
    "--sandbox", config.sandbox || "workspace-write",
    "--ask-for-approval", config.approval || "never",
    "--output-last-message", outputPath
  ];
  if (config.model) codexArgs.push("--model", config.model);
  if (config.web_search) codexArgs.push("--search");
  codexArgs.push("-");

  const command = config.command || "codex";
  try {
    const output = runProcess(command, codexArgs, {
      input: prompt,
      timeout: Number(config.timeout_ms || 300000)
    });
    if (output.trim()) console.log(output.trim());
  } catch (error) {
    throw new Error(`Codex CLI failed. Prompt saved at ${relative(promptPath)}. ${error.message}`);
  }

  console.log(`Wrote prompt: ${relative(promptPath)}`);
  console.log(`Wrote output: ${relative(outputPath)}`);
  return { promptPath, outputPath, skipped: false };
}

function runProcess(command, args, options = {}) {
  const common = {
    cwd: ROOT,
    input: options.input || "",
    encoding: "utf8",
    timeout: options.timeout || 30000,
    maxBuffer: 1024 * 1024 * 20,
    windowsHide: true
  };
  if (process.platform === "win32") {
    const commandLine = [command, ...args].map(quoteCmdArg).join(" ");
    return childProcess.execFileSync("cmd.exe", ["/d", "/s", "/c", commandLine], common);
  }
  return childProcess.execFileSync(command, args, common);
}

function probeCodexCommand(config, check) {
  const command = config.command || "codex";
  const argsByCheck = {
    path: process.platform === "win32" ? ["/d", "/s", "/c", `where ${quoteCmdArg(command)}`] : ["-lc", `command -v ${shellQuote(command)}`],
    version: process.platform === "win32" ? ["/d", "/s", "/c", `${quoteCmdArg(command)} --version`] : ["-lc", `${shellQuote(command)} --version`],
    "exec-help": process.platform === "win32" ? ["/d", "/s", "/c", `${quoteCmdArg(command)} exec --help`] : ["-lc", `${shellQuote(command)} exec --help`]
  };
  try {
    const output = process.platform === "win32"
      ? childProcess.execFileSync("cmd.exe", argsByCheck[check], { cwd: ROOT, encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024 * 2, windowsHide: true })
      : childProcess.execFileSync("sh", argsByCheck[check], { cwd: ROOT, encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024 * 2 });
    return { check, ok: true, output, error: "" };
  } catch (error) {
    return { check, ok: false, output: error.stdout || "", error: (error.stderr || error.message || String(error)).trim() };
  }
}

function copyAiOutputToApplication(result, dir, fileName, flags) {
  if (flags["dry-run"] || result.skipped) return;
  if (!fs.existsSync(result.outputPath)) return;
  const target = path.join(dir, fileName);
  fs.copyFileSync(result.outputPath, target);
  console.log(`Wrote ${relative(target)}`);
}

function findJob(jobId) {
  const jobs = readJson(PATHS.normalizedJobs, []);
  const job = jobs.find((item) => item.id === jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  return job;
}

function aiJobPayload(job) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    source_site: job.source_site,
    source_url: job.source_url,
    apply_url: job.apply_url,
    location_raw: job.location_raw,
    remote_region: job.remote_region,
    salary_raw: job.salary_raw,
    salary_monthly_usd_min: job.salary_monthly_usd_min,
    salary_monthly_usd_max: job.salary_monthly_usd_max,
    recommendation: job.recommendation,
    score_fit: job.score_fit,
    score_explanation: job.score_explanation,
    extracted_signals: job.extracted_signals,
    red_flags: job.red_flags,
    description: truncateText(job.description || "", 12000)
  };
}

function readApplicationWorkspace(dir) {
  if (!fs.existsSync(dir)) return {};
  const files = {};
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".md")).sort()) {
    files[file] = truncateText(readText(path.join(dir, file)), 12000);
  }
  return files;
}

function truncateText(value, maxLength) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n\n[truncated ${text.length - maxLength} chars]`;
}

function fence(value, language) {
  return `\`\`\`${language || ""}\n${String(value || "").replace(/```/g, "` ` `")}\n\`\`\``;
}

function quoteCmdArg(value) {
  const text = String(value);
  if (!/[ \t&()^|<>"%]/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function listApplications(limitArg) {
  ensureDirs();
  const limit = Math.max(1, Number(limitArg || 25));
  const rows = readCsvFile(PATHS.applications).slice(0, limit);
  if (!rows.length) {
    console.log("No applications tracked yet.");
    return;
  }
  console.log(toCsv(rows));
}

function updateApplicationStatus(applicationId, status) {
  if (!isValidIdArg(applicationId) || !status) throw new Error("Usage: career-os applications status <application_id> <status>");
  if (!APPLICATION_STATUSES.has(status)) {
    throw new Error(`Invalid status: ${status}. Valid statuses: ${[...APPLICATION_STATUSES].join(", ")}`);
  }
  const rows = readCsvFile(PATHS.applications);
  const index = rows.findIndex((row) => row.application_id === applicationId || row.job_id === applicationId);
  if (index < 0) throw new Error(`Application not found: ${applicationId}`);
  const now = new Date().toISOString();
  rows[index] = { ...rows[index], status };
  if (status === "drafted" && !rows[index].drafted_at) rows[index].drafted_at = now;
  if (status === "applied" && !rows[index].applied_at) rows[index].applied_at = now;
  writeApplications(rows);
  console.log(`Updated ${rows[index].application_id} to ${status}.`);
}

function updateApplicationFollowup(applicationId, args) {
  if (!isValidIdArg(applicationId)) throw new Error("Usage: career-os applications followup <application_id> --date YYYY-MM-DD");
  const flags = parseFlags(args);
  const date = flags.date || flags.next;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    throw new Error("Missing or invalid follow-up date. Usage: career-os applications followup <application_id> --date YYYY-MM-DD");
  }
  const rows = readCsvFile(PATHS.applications);
  const index = rows.findIndex((row) => row.application_id === applicationId || row.job_id === applicationId);
  if (index < 0) throw new Error(`Application not found: ${applicationId}`);
  rows[index] = { ...rows[index], next_follow_up: date };
  writeApplications(rows);
  console.log(`Set next follow-up for ${rows[index].application_id} to ${date}.`);
}

function generateInterviewPrep(id) {
  if (!isValidIdArg(id)) throw new Error("Usage: career-os interview <application_id|job_id>");
  const context = getApplicationContext(id);
  const { job, application } = context;
  const dir = ensureApplicationDir(job, application);
  const profile = readJson(PATHS.candidateProfileJson, defaultCandidateProfileJson());
  const profileText = readText(PATHS.candidateProfile);
  const filePath = path.join(dir, "interview-prep.md");
  fs.writeFileSync(filePath, interviewPrepMarkdown(job, profile, profileText));
  upsertApplication(job, application.status || "drafted", { application_dir: relative(dir) });
  console.log(`Wrote ${relative(filePath)}`);
}

function generateApplicationArtifact(id, artifact) {
  if (!isValidIdArg(id)) throw new Error(`Usage: career-os application ${artifact} <application_id|job_id>`);
  const context = getApplicationContext(id);
  const { job, application } = context;
  const dir = ensureApplicationDir(job, application);
  const profile = readJson(PATHS.candidateProfileJson, defaultCandidateProfileJson());
  const profileText = readText(PATHS.candidateProfile);

  if (artifact === "plan") {
    fs.writeFileSync(path.join(dir, "application-plan.md"), applicationPlanMarkdown(job, profile, profileText));
    upsertApplication(job, application.status || "ready_to_apply", { application_dir: relative(dir) });
    console.log(`Wrote ${relative(path.join(dir, "application-plan.md"))}`);
    return;
  }

  if (artifact === "cv-notes") {
    fs.writeFileSync(path.join(dir, "cv-notes.md"), cvNotesMarkdown(job, profile, profileText));
    upsertApplication(job, application.status || "ready_to_apply", { application_dir: relative(dir) });
    console.log(`Wrote ${relative(path.join(dir, "cv-notes.md"))}`);
    return;
  }

  if (artifact === "draft") {
    fs.writeFileSync(path.join(dir, "application-message.md"), applicationMessageMarkdown(job, profile, profileText));
    fs.writeFileSync(path.join(dir, "cover-letter.md"), coverLetterMarkdown(job, profile, profileText));
    upsertApplication(job, "drafted", { application_dir: relative(dir), drafted_at: new Date().toISOString() });
    console.log(`Wrote ${relative(path.join(dir, "application-message.md"))}`);
    console.log(`Wrote ${relative(path.join(dir, "cover-letter.md"))}`);
    return;
  }

  throw new Error(`Unknown application artifact: ${artifact}`);
}

function getApplicationContext(id) {
  const applications = readCsvFile(PATHS.applications);
  const application = applications.find((row) => row.application_id === id || row.job_id === id);
  if (!application) throw new Error(`Application not found: ${id}. Run career-os approve <job_id> and career-os apply <job_id> first.`);
  const jobs = readJson(PATHS.normalizedJobs, []);
  const job = jobs.find((item) => item.id === application.job_id || application.job_id === item.id);
  if (!job) throw new Error(`Job for application not found: ${application.job_id}`);
  if (!application.application_dir) throw new Error("Application workspace missing. Run career-os apply <job_id> first.");
  return { application, job };
}

function ensureApplicationDir(job, application = {}) {
  const dir = application.application_dir
    ? path.join(ROOT, application.application_dir)
    : path.join(OUTPUTS_DIR, "applications", slugify(`${job.company}-${job.title}-${new Date().toISOString().slice(0, 10)}`));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function approveJob(jobId) {
  if (!isValidIdArg(jobId)) throw new Error("Missing job id. Usage: career-os approve <job_id>");
  const jobs = readJson(PATHS.normalizedJobs, []);
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index < 0) throw new Error(`Job not found: ${jobId}`);
  validateApplicationGate(jobs[index]);
  const now = new Date().toISOString();
  jobs[index] = { ...jobs[index], state: "ready_to_apply", approved_at: now, application_id: applicationIdFor(jobs[index]) };
  fs.writeFileSync(PATHS.normalizedJobs, JSON.stringify(jobs, null, 2) + "\n");
  upsertApplication(jobs[index], "ready_to_apply", { approved_at: now });
  console.log(`Approved ${jobId} for manual application workflow.`);
}

function applyJob(jobId) {
  if (!isValidIdArg(jobId)) throw new Error("Missing job id. Usage: career-os apply <job_id>");
  const jobs = readJson(PATHS.normalizedJobs, []);
  const job = jobs.find((item) => item.id === jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  validateApplicationGate(job);
  if (job.state !== "ready_to_apply") {
    throw new Error("Application generation is gated. Run career-os approve <job_id> first.");
  }
  const slug = slugify(`${job.company}-${job.title}-${new Date().toISOString().slice(0, 10)}`);
  const dir = path.join(OUTPUTS_DIR, "applications", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "job.md"), jobMarkdown(job));
  fs.writeFileSync(path.join(dir, "fit-analysis.md"), fitAnalysisMarkdown(job));
  fs.writeFileSync(path.join(dir, "application-plan.md"), applicationPlanMarkdown(job));
  fs.writeFileSync(path.join(dir, "cv-notes.md"), cvNotesMarkdown(job));
  fs.writeFileSync(path.join(dir, "application-message.md"), applicationPlaceholderMarkdown(job));
  fs.writeFileSync(path.join(dir, "interview-prep.md"), interviewPrepPlaceholderMarkdown(job));
  upsertApplication(job, "ready_to_apply", { application_dir: relative(dir) });
  console.log(`Prepared manual application workspace: ${relative(dir)}`);
}

function resetData(args) {
  if (!args.includes("--data")) throw new Error("Refusing reset without explicit flag. Usage: career-os reset --data");
  ensureDirs();
  fs.writeFileSync(PATHS.rawJobs, "");
  fs.writeFileSync(PATHS.normalizedJobs, "[]\n");
  fs.writeFileSync(PATHS.seenJobs, JSON.stringify({ seen: {} }, null, 2) + "\n");
  fs.writeFileSync(PATHS.applications, applicationHeaderLine());
  cleanDir(PATHS.reports);
  cleanDir(PATHS.tables);
  console.log("Reset local data, tables, and reports.");
}

function normalizeJob(raw, entry) {
  const title = first(raw, ["title", "role_title", "position", "job_title", "jobTitle", "name"]);
  const company = first(raw, ["company", "company_name", "companyName", "organization"]);
  const sourceSite = first(raw, ["source_site", "source", "site"]) || inferSource(first(raw, ["source_url", "url", "job_url"]));
  const sourceUrl = first(raw, ["source_url", "url", "job_url", "jobUrl", "link"]);
  const applyUrl = first(raw, ["apply_url", "application_url"]) || sourceUrl;
  const description = first(raw, ["description", "body", "summary", "job_description", "jobDescription"]) || "";
  const locationRaw = first(raw, ["location_raw", "location", "candidate_required_location", "jobGeo"]) || "";
  const salaryRaw = first(raw, ["salary", "salary_range", "compensation"]) || "";
  const salary = normalizeSalary(raw, salaryRaw);
  const id = first(raw, ["id", "job_id", "external_id"]) || stableId([sourceSite, sourceUrl, company, title, locationRaw, description.slice(0, 120)]);

  return {
    id: `${sourceSite || "manual"}:${id}`.replace(/\s+/g, "-").toLowerCase(),
    state: "new",
    source_site: sourceSite || "manual",
    source_url: sourceUrl || "",
    apply_url: applyUrl || "",
    title: title || "Unknown role",
    company: company || "Unknown company",
    company_url: first(raw, ["company_url"]) || "",
    company_size: first(raw, ["company_size"]) || "unknown",
    company_stage: first(raw, ["company_stage"]) || "unknown",
    company_industry: first(raw, ["company_industry", "industry"]) || "unknown",
    location_raw: locationRaw,
    remote_region: inferRemoteRegion(locationRaw, description),
    country_eligibility: inferCountryEligibility(locationRaw, description),
    timezone_overlap: inferTimezoneOverlap(locationRaw, description),
    contract_type: inferContractType(raw, description),
    employment_type: first(raw, ["employment_type", "job_type"]) || "unknown",
    seniority: inferSeniority(title || description),
    salary_min: salary.min,
    salary_max: salary.max,
    salary_currency: salary.currency,
    salary_period: salary.period,
    salary_monthly_usd_min: salary.monthlyUsdMin,
    salary_monthly_usd_max: salary.monthlyUsdMax,
    salary_disclosed: salary.disclosed,
    salary_confidence: salary.confidence,
    posted_at: normalizeDate(first(raw, ["posted_at", "publication_date", "date", "created_at"])) || "",
    deadline: normalizeDate(first(raw, ["deadline", "expires_at"])) || null,
    description,
    requirements_required: [],
    requirements_nice_to_have: [],
    benefits: [],
    red_flags: inferRedFlags(locationRaw, description, salary),
    score_fit: null,
    score_skills: null,
    score_experience: null,
    score_salary: null,
    score_remote: null,
    score_company: null,
    score_application_friction: null,
    recommendation: "unscored",
    notes: "",
    imported_at: entry.imported_at || new Date().toISOString()
  };
}

function scoreJob(job, config, weights, profileText, profile) {
  const required = job.requirements_required || [];
  const matched = job.matched_requirements || [];
  const partial = job.partial_matches || [];
  const missing = job.missing_requirements || [];

  const skillScore = scoreSkillsDimension(job, profile, required, matched, partial);
  const scoreSkills = skillScore.score;
  const experienceScore = scoreExperienceDimension(job, profile);
  const scoreExperience = experienceScore.score;
  const salaryScore = scoreSalaryDimension(job, config, profile);
  const scoreSalary = salaryScore.score;
  const remoteScore = scoreRemoteDimension(job, profile);
  const scoreRemote = remoteScore.score;
  const companyScore = scoreCompanyDimension(job);
  const scoreCompany = companyScore.score;
  const growthScore = scoreGrowthDimension(job, profile);
  const scoreGrowth = growthScore.score;
  const frictionScore = scoreApplicationFrictionDimension(job);
  const scoreApplicationFriction = frictionScore.score;
  const riskScore = scoreRiskDimension(job);
  const scoreRisk = riskScore.score;

  const scoreFit = Math.round(
    scoreSkills * ((weights.skills || 30) / 100) +
    scoreExperience * ((weights.experience || 20) / 100) +
    scoreSalary * ((weights.salary || 15) / 100) +
    scoreRemote * ((weights.remote_compatibility || 15) / 100) +
    scoreCompany * ((weights.company_quality || 10) / 100) +
    scoreGrowth * ((weights.growth_potential || 5) / 100) +
    scoreApplicationFriction * ((weights.application_friction || 5) / 100)
  );

  return {
    ...job,
    requirements_required: required,
    matched_requirements: matched,
    missing_requirements: missing,
    score_fit: scoreFit,
    score_skills: scoreSkills,
    score_experience: scoreExperience,
    score_salary: scoreSalary,
    score_remote: scoreRemote,
    score_company: scoreCompany,
    score_growth: scoreGrowth,
    score_application_friction: scoreApplicationFriction,
    score_risk: scoreRisk,
    score_explanation: {
      skills: skillScore.explanation,
      experience: experienceScore.explanation,
      salary: salaryScore.explanation,
      remote: remoteScore.explanation,
      company: companyScore.explanation,
      growth: growthScore.explanation,
      application_friction: frictionScore.explanation,
      risk: riskScore.explanation
    },
    recommendation: recommendationFor(job, scoreFit, scoreSalary, scoreRemote, scoreSkills, scoreRisk),
    notes: explanationFor(scoreFit, scoreSalary, scoreRemote, missing, scoreRisk)
  };
}

function scoreSkillsDimension(job, profile, required, matched, partial) {
  if (!required.length) {
    return { score: 20, explanation: "No target skills extracted from the job description." };
  }
  const strong = matched.length;
  const partialCount = partial.length;
  const score = clampScore(Math.round(((strong + partialCount * 0.5) / required.length) * 100));
  return {
    score,
    explanation: `${strong}/${required.length} required skills matched; ${partialCount} partial; missing: ${(job.missing_requirements || []).join(", ") || "none"}.`
  };
}

function scoreExperienceDimension(job, profile) {
  const seniority = String(job.seniority || "unknown").toLowerCase();
  const years = job.extracted_signals?.years_experience_min;
  const roleFamily = job.extracted_signals?.role_family || "unknown";
  const targetFamilies = (profile.target_roles || []).join(" ").toLowerCase();
  let score = scoreSeniority(seniority);
  if (roleFamily !== "unknown" && targetFamilies.includes(roleFamily.replace(/_/g, " "))) score += 10;
  if (years && years >= 8) score -= 5;
  return {
    score: clampScore(score),
    explanation: `Seniority=${seniority}; minimum years=${years || "unknown"}; role family=${roleFamily}.`
  };
}

function scoreSalaryDimension(job, config, profile) {
  const minimum = Number(profile.salary_min_monthly_usd || config.salary_min_monthly_usd || 0);
  const target = Number(profile.salary_target_monthly_usd || minimum * 1.5);
  if (!job.salary_disclosed) {
    return { score: 55, explanation: "Salary not disclosed; lightly penalized, not skipped by salary alone." };
  }
  if (!job.salary_monthly_usd_min) {
    return { score: 50, explanation: "Salary was disclosed but could not be confidently normalized." };
  }
  if (minimum && job.salary_monthly_usd_min < minimum) {
    return { score: 10, explanation: `Minimum normalized salary ${job.salary_monthly_usd_min} USD/month is below configured minimum ${minimum}.` };
  }
  if (target && job.salary_monthly_usd_min >= target) {
    return { score: 95, explanation: `Minimum normalized salary ${job.salary_monthly_usd_min} USD/month meets target ${target}.` };
  }
  return { score: 80, explanation: `Salary is compatible: ${job.salary_monthly_usd_min || "unknown"}-${job.salary_monthly_usd_max || "unknown"} USD/month.` };
}

function scoreRemoteDimension(job, profile) {
  const region = String(job.remote_region || "").toLowerCase();
  const accepted = (profile.accepted_regions || []).map((item) => String(item).toLowerCase());
  const auth = job.extracted_signals?.work_authorization || [];
  if ((job.red_flags || []).some((flag) => /authorization|citizenship|US-only/i.test(flag.message))) {
    return { score: 10, explanation: "Blocking authorization or location restriction detected." };
  }
  if (region === "remote_unknown") {
    return { score: 60, explanation: "Remote role detected, but region restrictions are unknown." };
  }
  if (accepted.some((item) => item && region.includes(item))) {
    return { score: 90, explanation: `Remote region ${job.remote_region} is accepted.` };
  }
  if (["worldwide", "latam", "brazil"].includes(region)) {
    return { score: 85, explanation: `Remote region ${job.remote_region} is broadly compatible.` };
  }
  if (region === "europe") {
    return { score: 45, explanation: "Europe-only may be viable only with eligibility and timezone review." };
  }
  if (auth.length) {
    return { score: 35, explanation: `Work authorization signals require review: ${auth.join(", ")}.` };
  }
  return { score: 35, explanation: "Remote compatibility is unclear." };
}

function scoreCompanyDimension(job) {
  let score = 50;
  const facts = [];
  if (job.company_size && job.company_size !== "unknown") { score += 10; facts.push(`size=${job.company_size}`); }
  if (job.company_stage && job.company_stage !== "unknown") { score += 10; facts.push(`stage=${job.company_stage}`); }
  if (job.company_industry && job.company_industry !== "unknown") { score += 5; facts.push(`industry=${job.company_industry}`); }
  return { score: clampScore(score), explanation: facts.length ? facts.join("; ") : "Company metadata is mostly unknown." };
}

function scoreGrowthDimension(job, profile) {
  const text = `${job.title} ${job.description}`.toLowerCase();
  let score = 55;
  if (/ai|llm|agent|automation|platform|developer tools|devtools/.test(text)) score += 20;
  if (/legacy|maintenance only/.test(text)) score -= 15;
  return { score: clampScore(score), explanation: `Growth signal score based on role/domain keywords: ${score}.` };
}

function scoreApplicationFrictionDimension(job) {
  const text = `${job.description || ""}`.toLowerCase();
  let score = 75;
  if (/take-?home|technical test|coding challenge/.test(text)) score -= 20;
  if (/video application|recorded video/.test(text)) score -= 20;
  if (/workday|greenhouse|lever|ashby/.test(text)) score += 5;
  if ((job.red_flags || []).some((flag) => flag.severity === "blocking")) score = Math.min(score, 25);
  return { score: clampScore(score), explanation: `Application friction estimated from process language and blocking flags.` };
}

function scoreRiskDimension(job) {
  const flags = job.red_flags || [];
  const blocking = flags.filter((flag) => flag.severity === "blocking").length;
  const warnings = flags.filter((flag) => flag.severity === "warning").length;
  const infos = flags.filter((flag) => flag.severity === "info").length;
  const score = clampScore(100 - blocking * 60 - warnings * 20 - infos * 5);
  return { score, explanation: `${blocking} blocking, ${warnings} warning, ${infos} info red flags.` };
}

function extractJobSignals(job, profile, taxonomy) {
  const title = String(job.title || "");
  const description = String(job.description || "");
  const text = `${title}\n${description}`;
  const lower = text.toLowerCase();
  const skills = findSkills(text, taxonomy);
  const required = unique([...skills.required, ...skills.mentioned.filter((skill) => appearsRequired(lower, skill))]);
  const nice = unique([...skills.nice, ...skills.mentioned.filter((skill) => appearsNiceToHave(lower, skill))])
    .filter((skill) => !required.includes(skill));
  const profileSkills = collectProfileSkills(profile);
  const matched = required.filter((skill) => profileSkills.strong.includes(skill) || profileSkills.medium.includes(skill));
  const partial = required.filter((skill) => profileSkills.learning.includes(skill) || profileSkills.adjacent.includes(skill));
  const missing = required.filter((skill) => !matched.includes(skill) && !partial.includes(skill));
  const years = extractYearsExperience(text);
  const seniority = inferSeniorityFromSignals(title, description, years, job.seniority);
  const remoteSignals = extractRemoteSignals(text);
  const authorization = extractWorkAuthorization(text);
  const responsibilities = extractResponsibilities(description, taxonomy);
  const redFlags = mergeRedFlags(job.red_flags || [], inferExtractionRedFlags(text, job, profile));

  return {
    ...job,
    seniority,
    remote_region: chooseRemoteRegion(job.remote_region, remoteSignals.remote_region),
    timezone_overlap: remoteSignals.timezone_overlap || job.timezone_overlap,
    requirements_required: required,
    requirements_nice_to_have: nice,
    matched_requirements: matched,
    partial_matches: partial,
    missing_requirements: missing,
    red_flags: redFlags,
    extracted_signals: {
      extracted_at: new Date().toISOString(),
      skills_mentioned: skills.mentioned,
      years_experience_min: years,
      seniority_source: seniority === job.seniority ? "normalized" : "extracted",
      responsibilities,
      remote_region: chooseRemoteRegion(job.remote_region, remoteSignals.remote_region),
      timezone_overlap: remoteSignals.timezone_overlap || job.timezone_overlap,
      work_authorization: authorization,
      contract_signals: extractContractSignals(text),
      role_family: inferRoleFamily(title, taxonomy),
      confidence: required.length || nice.length || responsibilities.length ? "medium" : "low"
    }
  };
}

function findSkills(text, taxonomy) {
  const lower = String(text || "").toLowerCase();
  const allSkills = flattenSkills(taxonomy);
  const mentioned = allSkills.filter((skill) => includesTerm(lower, skill));
  const required = mentioned.filter((skill) => appearsRequired(lower, skill));
  const nice = mentioned.filter((skill) => appearsNiceToHave(lower, skill));
  return { mentioned: unique(mentioned), required: unique(required), nice: unique(nice) };
}

function flattenSkills(taxonomy) {
  const groups = taxonomy.skills || {};
  return unique(Object.values(groups).flatMap((items) => items || []).map(normalizeSkill));
}

function collectProfileSkills(profile) {
  return {
    strong: (profile.skills_strong || []).map(normalizeSkill),
    medium: (profile.skills_medium || []).map(normalizeSkill),
    learning: (profile.skills_learning || []).map(normalizeSkill),
    adjacent: (profile.skills_adjacent || []).map(normalizeSkill)
  };
}

function appearsRequired(lowerText, skill) {
  const escaped = escapeRegex(skill);
  return new RegExp(`(required|requirements|required experience|must have|strong|proficient|expert|hands-on|core requirement)[^\\.\\n]{0,180}\\b${escaped}\\b|\\b${escaped}\\b[^\\.\\n]{0,120}(required|must have|proficiency|experience)`, "i").test(lowerText);
}

function appearsNiceToHave(lowerText, skill) {
  const escaped = escapeRegex(skill);
  return new RegExp(`(nice to have|preferred|bonus|plus|familiarity|desirable)[^\\.\\n]{0,180}\\b${escaped}\\b|\\b${escaped}\\b[^\\.\\n]{0,120}(nice to have|preferred|bonus|plus)`, "i").test(lowerText);
}

function extractYearsExperience(text) {
  const matches = [...String(text || "").matchAll(/(\d+)\+?\s*(?:years|yrs)\s+(?:of\s+)?experience/gi)].map((match) => Number(match[1]));
  return matches.length ? Math.max(...matches.filter(Number.isFinite)) : null;
}

function inferSeniorityFromSignals(title, description, years, fallback) {
  const fromTitle = inferSeniority(title);
  if (fromTitle !== "unknown") return fromTitle;
  if (years >= 8) return "staff";
  if (years >= 5) return "senior";
  if (years >= 3) return "mid";
  if (years > 0) return "junior";
  return fallback || "unknown";
}

function extractRemoteSignals(text) {
  const remote_region = inferRemoteRegion(text, "");
  const timezone_overlap = inferTimezoneOverlap(text, "");
  return { remote_region: remote_region === "unknown" ? "" : remote_region, timezone_overlap };
}

function chooseRemoteRegion(existing, extracted) {
  if (!extracted) return existing;
  if (existing && !["unknown", "remote_unknown"].includes(String(existing).toLowerCase())) return existing;
  return extracted;
}

function extractWorkAuthorization(text) {
  const lower = String(text || "").toLowerCase();
  const signals = [];
  if (/authorized to work in the us|us work authorization|u\.s\. work authorization|us citizenship|u\.s\. citizenship/.test(lower)) signals.push("US authorization");
  if (/authorized to work in the eu|eu work authorization|european union work authorization|right to work in europe/.test(lower)) signals.push("EU authorization");
  if (/must be based in brazil|brazil only|brasil/.test(lower)) signals.push("Brazil");
  return unique(signals);
}

function extractResponsibilities(description, taxonomy) {
  const sentences = String(description || "").split(/(?<=[.!?])\s+|\n+/).map((item) => item.trim()).filter(Boolean);
  const verbs = taxonomy.responsibility_verbs || ["build", "design", "develop", "implement", "maintain", "lead", "integrate", "automate", "evaluate"];
  return sentences
    .filter((sentence) => verbs.some((verb) => new RegExp(`\\b${escapeRegex(verb)}\\b`, "i").test(sentence)))
    .slice(0, 8);
}

function extractContractSignals(text) {
  const lower = String(text || "").toLowerCase();
  return unique([
    /contractor|b2b|pj/.test(lower) ? "contractor" : "",
    /full.?time/.test(lower) ? "full-time" : "",
    /part.?time/.test(lower) ? "part-time" : "",
    /freelance/.test(lower) ? "freelance" : ""
  ].filter(Boolean));
}

function inferRoleFamily(title, taxonomy) {
  const lower = String(title || "").toLowerCase();
  const families = taxonomy.role_families || {};
  for (const [family, terms] of Object.entries(families)) {
    if ((terms || []).some((term) => lower.includes(String(term).toLowerCase()))) return family;
  }
  return "unknown";
}

function inferExtractionRedFlags(text, job, profile) {
  const lower = String(text || "").toLowerCase();
  const flags = [];
  const minSalary = Number(profile.salary_min_monthly_usd || 0);
  if (/unpaid|volunteer/.test(lower)) flags.push({ severity: "blocking", message: "Unpaid or volunteer role" });
  if (/commission.?only/.test(lower)) flags.push({ severity: "blocking", message: "Commission-only compensation" });
  if (/us citizenship|u\.s\. citizenship|security clearance/.test(lower)) flags.push({ severity: "blocking", message: "Citizenship or clearance requirement" });
  if (/take-?home.{0,80}(before|prior to).{0,80}(call|screen|interview)/.test(lower)) flags.push({ severity: "warning", message: "Take-home before screening" });
  if ((job.salary_monthly_usd_min || 0) > 0 && minSalary > 0 && job.salary_monthly_usd_min < minSalary) {
    flags.push({ severity: "blocking", message: "Salary below configured minimum" });
  }
  return flags;
}

function mergeRedFlags(existing, extra) {
  const seen = new Set();
  return [...existing, ...extra].filter((flag) => {
    const key = `${flag.severity}:${flag.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSkill(skill) {
  return String(skill || "").trim().toLowerCase();
}

function recommendationFor(job, scoreFit, scoreSalary, scoreRemote, scoreSkills, scoreRisk) {
  if (job.red_flags.some((flag) => flag.severity === "blocking") || scoreRemote < 35 || scoreSalary < 25 || scoreRisk < 35) return "skip";
  if (scoreSkills < 30) return scoreRemote >= 60 && scoreSalary >= 50 ? "watch" : "skip";
  if (scoreFit >= 75) return "apply";
  if (scoreFit >= 55) return "maybe";
  if (scoreRemote >= 60) return "watch";
  return "skip";
}

function explanationFor(scoreFit, scoreSalary, scoreRemote, missing, scoreRisk) {
  const parts = [`fit=${scoreFit}`, `salary=${scoreSalary}`, `remote=${scoreRemote}`, `risk=${scoreRisk}`];
  if (missing.length) parts.push(`missing=${missing.slice(0, 5).join("|")}`);
  return parts.join("; ");
}

function buildTables(jobs) {
  const sorted = [...jobs].sort((a, b) => (b.score_fit || 0) - (a.score_fit || 0));
  return {
    top_matches: sorted.filter((job) => job.score_fit >= 75 && job.recommendation === "apply").map(toTableRow),
    high_salary_medium_fit: sorted.filter((job) => (job.salary_monthly_usd_min || 0) >= 4000 && job.score_fit >= 55 && job.score_fit < 75).map(toTableRow),
    easy_wins: sorted.filter((job) => job.score_skills >= 80 && job.score_application_friction >= 70).map(toTableRow),
    stretch_roles: sorted.filter((job) => job.recommendation === "maybe").map(toTableRow),
    skip: sorted.filter((job) => job.recommendation === "skip").map(toTableRow),
    skill_gap_heatmap: buildSkillGapHeatmap(sorted),
    red_flags: buildRedFlagsTable(sorted),
    salary_transparency: buildSalaryTransparencyTable(sorted),
    remote_fit: buildRemoteFitTable(sorted),
    best_next_actions: buildBestNextActions(sorted)
  };
}

function toTableRow(job) {
  return {
    score_fit: job.score_fit,
    score_skills: job.score_skills,
    score_experience: job.score_experience,
    score_salary: job.score_salary,
    score_remote: job.score_remote,
    score_company: job.score_company,
    score_growth: job.score_growth,
    score_application_friction: job.score_application_friction,
    score_risk: job.score_risk,
    recommendation: job.recommendation,
    company: job.company,
    role_title: job.title,
    seniority: job.seniority,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_currency: job.salary_currency,
    salary_monthly_usd_min: job.salary_monthly_usd_min,
    salary_monthly_usd_max: job.salary_monthly_usd_max,
    remote_region: job.remote_region,
    timezone_overlap: job.timezone_overlap,
    contract_type: job.contract_type,
    company_size: job.company_size,
    company_stage: job.company_stage,
    source_site: job.source_site,
    posted_at: job.posted_at,
    matched_requirements: listCell(job.matched_requirements),
    partial_matches: listCell(job.partial_matches),
    missing_requirements: listCell(job.missing_requirements),
    red_flags: listCell((job.red_flags || []).map((flag) => `${flag.severity}:${flag.message}`)),
    score_notes: job.notes,
    job_url: job.source_url,
    apply_url: job.apply_url
  };
}

function buildSkillGapHeatmap(jobs) {
  const counts = new Map();
  for (const job of jobs.filter((item) => item.score_fit >= 55)) {
    for (const skill of job.missing_requirements || []) {
      counts.set(skill, (counts.get(skill) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([skill, occurrences]) => ({
      skill,
      occurrences_in_good_jobs: occurrences,
      current_coverage: "unknown",
      action: "review"
    }));
}

function buildRedFlagsTable(jobs) {
  return jobs.flatMap((job) => (job.red_flags || []).map((flag) => ({
    severity: flag.severity,
    message: flag.message,
    recommendation: job.recommendation,
    score_fit: job.score_fit,
    company: job.company,
    role_title: job.title,
    source_site: job.source_site,
    job_url: job.source_url
  }))).sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || (b.score_fit || 0) - (a.score_fit || 0));
}

function buildSalaryTransparencyTable(jobs) {
  return jobs.map((job) => ({
    salary_disclosed: Boolean(job.salary_disclosed),
    salary_confidence: job.salary_confidence,
    salary_notes: listCell(job.salary_notes),
    salary_monthly_usd_min: job.salary_monthly_usd_min,
    salary_monthly_usd_max: job.salary_monthly_usd_max,
    score_salary: job.score_salary,
    recommendation: job.recommendation,
    company: job.company,
    role_title: job.title,
    source_site: job.source_site,
    job_url: job.source_url
  })).sort((a, b) => Number(b.salary_disclosed) - Number(a.salary_disclosed) || (b.salary_monthly_usd_min || 0) - (a.salary_monthly_usd_min || 0));
}

function buildRemoteFitTable(jobs) {
  return jobs.map((job) => ({
    score_remote: job.score_remote,
    remote_region: job.remote_region,
    timezone_overlap: job.timezone_overlap,
    work_authorization: listCell(job.extracted_signals?.work_authorization),
    recommendation: job.recommendation,
    company: job.company,
    role_title: job.title,
    source_site: job.source_site,
    job_url: job.source_url
  })).sort((a, b) => (b.score_remote || 0) - (a.score_remote || 0));
}

function buildBestNextActions(jobs) {
  return jobs.slice(0, 20).map((job) => ({
    action: nextActionFor(job),
    recommendation: job.recommendation,
    score_fit: job.score_fit,
    company: job.company,
    role_title: job.title,
    reason: nextActionReason(job),
    job_id: job.id,
    job_url: job.source_url
  }));
}

function severityRank(severity) {
  if (severity === "blocking") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function nextActionFor(job) {
  if (job.recommendation === "apply") return "approve_for_application";
  if (job.recommendation === "maybe") return "manual_review";
  if (job.recommendation === "watch") return "save_or_monitor";
  return "ignore";
}

function nextActionReason(job) {
  if ((job.red_flags || []).some((flag) => flag.severity === "blocking")) return "blocking red flag";
  if ((job.missing_requirements || []).length) return `missing ${job.missing_requirements.slice(0, 3).join(", ")}`;
  if (!job.salary_disclosed) return "salary not disclosed";
  if (job.score_remote < 60) return "remote fit unclear";
  return job.notes || "review score details";
}

function reportMarkdown(today, jobs, tables) {
  const ranked = [...jobs].sort((a, b) => (b.score_fit || 0) - (a.score_fit || 0));
  const best = ranked.find((job) => ["apply", "maybe"].includes(job.recommendation)) || ranked[0];
  const maybes = ranked.filter((job) => job.recommendation === "maybe").slice(0, 5).map(toTableRow);
  const watch = ranked.filter((job) => job.recommendation === "watch").slice(0, 5).map(toTableRow);
  const skips = tables.skip.slice(0, 8);
  const highSalary = tables.high_salary_medium_fit.slice(0, 5);
  const gaps = tables.skill_gap_heatmap.slice(0, 10);
  const flags = tables.red_flags.slice(0, 10);
  const actions = tables.best_next_actions.slice(0, 10);
  return `# Remote Radar - ${today}

## Summary

- Jobs normalized: ${jobs.length}
- Jobs scored: ${jobs.filter((job) => Number.isFinite(job.score_fit)).length}
- Top matches: ${tables.top_matches.length}
- Easy wins: ${tables.easy_wins.length}
- Stretch roles: ${tables.stretch_roles.length}
- Skips: ${tables.skip.length}

## Best Opportunity

${best ? bestOpportunityMarkdown(best) : "_No scored jobs yet._"}

## Top Matches

${markdownTable(tables.top_matches.slice(0, 10), ["score_fit", "company", "role_title", "salary_monthly_usd_min", "remote_region", "source_site", "recommendation"])}

## Manual Review

${markdownTable(maybes, ["score_fit", "company", "role_title", "score_skills", "score_remote", "score_risk", "recommendation"])}

## Watch

${markdownTable(watch, ["score_fit", "company", "role_title", "score_skills", "score_remote", "score_risk", "recommendation"])}

## High Salary / Medium Fit

${markdownTable(highSalary, ["score_fit", "company", "role_title", "salary_monthly_usd_min", "salary_monthly_usd_max", "remote_region", "recommendation"])}

## Main Skill Gaps

${markdownTable(gaps, ["skill", "occurrences_in_good_jobs", "current_coverage", "action"])}

## Red Flags

${markdownTable(flags, ["severity", "message", "company", "role_title", "recommendation"])}

## Skips

${markdownTable(skips, ["score_fit", "company", "role_title", "red_flags", "score_notes"])}

## Next Actions

${markdownTable(actions, ["action", "recommendation", "score_fit", "company", "role_title", "reason"])}
`;
}

function bestOpportunityMarkdown(job) {
  return `**${job.company} - ${job.title}** is currently the strongest visible opportunity.

- Score: ${job.score_fit}
- Recommendation: ${job.recommendation}
- Salary: ${job.salary_monthly_usd_min || "unknown"}-${job.salary_monthly_usd_max || "unknown"} USD/month
- Remote: ${job.remote_region || "unknown"} (${job.timezone_overlap || "unknown"} timezone overlap)
- Main reason: ${job.notes || "review component scores"}
- Job ID: ${job.id}`;
}

function scoreSeniority(seniority) {
  if (seniority === "senior" || seniority === "staff" || seniority === "lead") return 80;
  if (seniority === "mid") return 70;
  if (seniority === "junior") return 40;
  return 55;
}

function scoreSalaryCompatibility(job, config) {
  const minimum = Number(config.salary_min_monthly_usd || 0);
  if (!job.salary_disclosed) return 55;
  if (!job.salary_monthly_usd_min) return 50;
  if (job.salary_monthly_usd_min < minimum) return 15;
  if (job.salary_monthly_usd_min >= minimum * 1.5) return 95;
  return 80;
}

function scoreRemoteCompatibility(job) {
  const region = String(job.remote_region || "").toLowerCase();
  const location = String(job.location_raw || "").toLowerCase();
  const text = `${region} ${location} ${job.description || ""}`.toLowerCase();
  if (/us-only|usa only|u\.s\. only|must be authorized to work in the us/.test(text)) return 10;
  if (/worldwide|global|anywhere/.test(text)) return 90;
  if (/latam|latin america|brazil|brasil|americas/.test(text)) return 85;
  if (/europe|emea/.test(text)) return 50;
  if (/remote/.test(text)) return 65;
  return 25;
}

function normalizeSalary(raw, salaryRaw) {
  const combined = `${salaryRaw || ""} ${raw.salary_min || ""} ${raw.salary_max || ""} ${raw.salary_currency || ""}`;
  const currency = inferCurrency(combined);
  const period = inferSalaryPeriod(combined);
  const explicitMin = numberOrNull(raw.salary_min);
  const explicitMax = numberOrNull(raw.salary_max);
  const parsedNumbers = parseSalaryNumbers(combined);
  const min = explicitMin || parsedNumbers[0] || null;
  const max = explicitMax || parsedNumbers[1] || min;
  const monthlyMin = min ? toMonthlyUsd(min, currency, period) : null;
  const monthlyMax = max ? toMonthlyUsd(max, currency, period) : monthlyMin;
  const notes = salaryNotes(combined, min, max, period);

  return {
    min,
    max,
    currency,
    period,
    monthlyUsdMin: monthlyMin,
    monthlyUsdMax: monthlyMax,
    disclosed: Boolean(min),
    confidence: salaryConfidence(combined, min, max),
    notes
  };
}

function parseSalaryNumbers(text) {
  const value = String(text || "").replace(/\bto\b/gi, "-");
  const matches = [...value.matchAll(/(?:[$€£]|R\$)?\s*(\d+(?:[.,]\d+)?)\s*(k|K|mil|000)?/g)];
  return matches
    .map((match) => {
      let number = Number(String(match[1]).replace(",", "."));
      const suffix = String(match[2] || "").toLowerCase();
      if (suffix === "k" || suffix === "mil" || suffix === "000") number *= 1000;
      return number;
    })
    .filter((number) => Number.isFinite(number) && number > 0 && number < 10000000);
}

function salaryConfidence(text, min, max) {
  const lower = String(text || "").toLowerCase();
  if (!min) return "unknown";
  if (/estimate|estimated|approx|about|up to|from/.test(lower)) return "low";
  if (min && max && min !== max) return "high";
  return "medium";
}

function salaryNotes(text, min, max, period) {
  const lower = String(text || "").toLowerCase();
  const notes = [];
  if (!min) notes.push("salary_not_disclosed");
  if (/ote/.test(lower)) notes.push("ote_included");
  if (/equity|stock options|options/.test(lower)) notes.push("equity_mentioned");
  if (/estimate|estimated|approx|about/.test(lower)) notes.push("estimated_range");
  if (period) notes.push(`period_${period}`);
  if (min && max && min === max) notes.push("single_value");
  return notes;
}

function toMonthlyUsd(value, currency, period) {
  const rates = { USD: 1, EUR: 1.08, BRL: 0.18, GBP: 1.27 };
  let monthly = value;
  if (period === "hour") monthly = value * 160;
  if (period === "year") monthly = value / 12;
  if (period === "week") monthly = value * 4.33;
  return Math.round(monthly * (rates[currency] || 1));
}

function inferCurrency(text) {
  const value = String(text).toUpperCase();
  if (value.includes("EUR") || value.includes("€")) return "EUR";
  if (value.includes("BRL") || value.includes("R$")) return "BRL";
  if (value.includes("GBP") || value.includes("£")) return "GBP";
  return "USD";
}

function inferSalaryPeriod(text) {
  const value = String(text).toLowerCase();
  if (/hour|\/h|hourly/.test(value)) return "hour";
  if (/year|annual|annum|\/yr|\/year/.test(value)) return "year";
  if (/week|weekly/.test(value)) return "week";
  return "month";
}

function inferRemoteRegion(location, description) {
  const text = `${location} ${description}`.toLowerCase();
  if (/worldwide|global|anywhere/.test(text)) return "worldwide";
  if (/latam|latin america|south america|brazil|brasil/.test(text)) return "LATAM";
  if (/us-only|usa only|u\.s\. only|must be based in (the )?(united states|usa|u\.s\.)|must be authorized to work in the us/.test(text)) return "USA";
  if (/eu-only|europe only|must be based in europe|must be based in the eu/.test(text)) return "Europe";
  if (/remote/.test(text)) return "remote_unknown";
  return "unknown";
}

function inferCountryEligibility(location, description) {
  const text = `${location} ${description}`.toLowerCase();
  const countries = [];
  if (/brazil|brasil/.test(text)) countries.push("Brazil");
  if (/argentina/.test(text)) countries.push("Argentina");
  if (/colombia/.test(text)) countries.push("Colombia");
  if (/mexico/.test(text)) countries.push("Mexico");
  if (/united states|usa|u\.s\./.test(text)) countries.push("United States");
  return countries;
}

function inferTimezoneOverlap(location, description) {
  const text = `${location} ${description}`.toLowerCase();
  if (/latam|americas|brazil|brasil|est|edt|cst|pst/.test(text)) return "good";
  if (/europe|emea|cet|gmt|utc/.test(text)) return "medium";
  if (/apac|asia|australia/.test(text)) return "poor";
  return "unknown";
}

function inferContractType(raw, description) {
  const text = `${first(raw, ["contract_type", "employment_type", "job_type"]) || ""} ${description}`.toLowerCase();
  if (/contractor|b2b|pj/.test(text)) return "contractor";
  if (/clt/.test(text)) return "CLT";
  if (/full.?time/.test(text)) return "full-time";
  if (/part.?time/.test(text)) return "part-time";
  return "unknown";
}

function inferSeniority(text) {
  const value = String(text).toLowerCase();
  if (/staff|principal/.test(value)) return "staff";
  if (/lead|head of/.test(value)) return "lead";
  if (/senior|sr\\.?/.test(value)) return "senior";
  if (/junior|jr\\.?|entry/.test(value)) return "junior";
  if (/mid|pleno/.test(value)) return "mid";
  return "unknown";
}

function inferRedFlags(location, description, salary) {
  const text = `${location} ${description}`.toLowerCase();
  const flags = [];
  if (/us-only|usa only|u\.s\. only|must be authorized to work in the us/.test(text)) {
    flags.push({ severity: "blocking", message: "US-only or US work authorization required" });
  }
  if (/us citizenship|u\.s\. citizenship|security clearance/.test(text)) {
    flags.push({ severity: "blocking", message: "Citizenship or clearance requirement" });
  }
  if (/eu-only|must be based in europe|right to work in europe|eu work authorization/.test(text)) {
    flags.push({ severity: "warning", message: "Europe-only or EU authorization may block eligibility" });
  }
  if (/onsite only|on-site only|must be onsite|hybrid/.test(text) && !/remote/.test(text)) {
    flags.push({ severity: "blocking", message: "Onsite or hybrid requirement without remote compatibility" });
  }
  if (/unpaid|volunteer/.test(text)) {
    flags.push({ severity: "blocking", message: "Unpaid or volunteer role" });
  }
  if (/commission.?only/.test(text)) {
    flags.push({ severity: "blocking", message: "Commission-only compensation" });
  }
  if (/rockstar|ninja|work hard play hard/.test(text)) {
    flags.push({ severity: "warning", message: "Low-quality hiring language" });
  }
  if (/take-?home|technical test|coding challenge/.test(text) && /before|prior to|first step/.test(text)) {
    flags.push({ severity: "warning", message: "Test or take-home appears early in process" });
  }
  if (description && description.length < 250) {
    flags.push({ severity: "warning", message: "Very short or generic job description" });
  }
  if (!salary.disclosed) {
    flags.push({ severity: "info", message: "Salary not disclosed" });
  }
  return flags;
}

function parseJsonOrJsonl(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  return trimmed.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  const headers = rows.shift() || [];
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

function markdownTable(rows, headers) {
  if (!rows.length) return "_No rows yet._";
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${headers.map((header) => String(row[header] || "")).join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join("; ") : String(value == null ? "" : value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function first(object, keys) {
  for (const key of keys) {
    if (object && object[key] != null && object[key] !== "") return object[key];
  }
  return "";
}

function includesTerm(text, term) {
  const escaped = String(term).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(String(text || ""));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unique(values) {
  return [...new Set((values || []).filter((value) => value != null && value !== ""))];
}

function isValidIdArg(value) {
  return Boolean(value && value !== "undefined" && value !== "null");
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function jsonParseError(text) {
  if (!text.trim()) return "empty json";
  try {
    JSON.parse(text);
    return "";
  } catch (error) {
    return error.message;
  }
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function normalizeDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

function inferSource(url) {
  const text = String(url || "").toLowerCase();
  if (text.includes("linkedin")) return "LinkedIn";
  if (text.includes("remoteok")) return "RemoteOK";
  if (text.includes("remotive")) return "Remotive";
  if (text.includes("weworkremotely")) return "WeWorkRemotely";
  if (text.includes("jobicy")) return "Jobicy";
  return "manual";
}

function stableId(parts) {
  return crypto.createHash("sha1").update(parts.filter(Boolean).join("|")).digest("hex").slice(0, 16);
}

function dedupeById(jobs) {
  return [...new Map(jobs.map((job) => [job.id, job])).values()];
}

function updateSeenJobs(jobs) {
  const data = readJson(PATHS.seenJobs, { seen: {} });
  const now = new Date().toISOString().slice(0, 10);
  for (const job of jobs) {
    const current = data.seen[job.id] || { first_seen: now, status: "seen" };
    data.seen[job.id] = { ...current, last_seen: now };
  }
  fs.writeFileSync(PATHS.seenJobs, JSON.stringify(data, null, 2) + "\n");
}

async function searchRemotive(source, query, limit) {
  const url = new URL(source.base_url);
  if (query) url.searchParams.set("search", query);
  const data = await fetchJson(url.toString());
  return (data.jobs || []).slice(0, limit).map((job) => ({
    source_site: "Remotive",
    id: job.id,
    title: job.title,
    company: job.company_name,
    company_logo: job.company_logo,
    location: job.candidate_required_location || "Remote",
    job_type: job.job_type,
    publication_date: job.publication_date,
    source_url: job.url,
    apply_url: job.url,
    salary: job.salary || salaryRangeText(job.annualSalaryMin, job.annualSalaryMax, "USD", "year"),
    category: job.category,
    tags: job.tags,
    description: stripHtml(job.description || ""),
    raw_source: job
  }));
}

async function searchJobicy(source, query, limit) {
  const url = new URL(source.base_url);
  url.searchParams.set("count", String(limit));
  if (query) url.searchParams.set("tag", query);
  const data = await fetchJson(url.toString());
  const jobs = data.jobs || data.data || [];
  return jobs.slice(0, limit).map((job) => ({
    source_site: "Jobicy",
    id: job.id || job.jobId,
    title: job.jobTitle || job.title,
    company: job.companyName || job.company,
    location: job.jobGeo || job.location || "Remote",
    job_type: job.jobType,
    publication_date: job.pubDate || job.date,
    source_url: job.url || job.jobUrl,
    apply_url: job.url || job.jobUrl,
    salary: job.salary,
    annualSalaryMin: job.annualSalaryMin,
    annualSalaryMax: job.annualSalaryMax,
    category: job.jobIndustry,
    tags: job.jobTags,
    description: stripHtml(job.jobDescription || job.description || ""),
    raw_source: job
  }));
}

async function searchRemoteOk(source, query, limit) {
  const url = new URL(source.base_url);
  if (query) url.searchParams.set("tag", query.toLowerCase().replace(/\s+/g, "-"));
  const data = await fetchJson(url.toString());
  const jobs = Array.isArray(data) ? data.filter((item) => item && item.position) : [];
  const filtered = query ? jobs.filter((job) => matchesQuery(`${job.position} ${job.company} ${(job.tags || []).join(" ")} ${job.description || ""}`, query)) : jobs;
  return filtered.slice(0, limit).map((job) => ({
    source_site: "RemoteOK",
    id: job.id || job.slug,
    title: job.position,
    company: job.company,
    company_logo: job.company_logo,
    location: job.location || "Remote",
    job_type: "remote",
    publication_date: job.date,
    source_url: job.url ? absoluteRemoteOkUrl(job.url) : `https://remoteok.com/remote-jobs/${job.id}`,
    apply_url: job.apply_url || (job.url ? absoluteRemoteOkUrl(job.url) : ""),
    salary: salaryRangeText(job.salary_min, job.salary_max, "USD", "year"),
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_currency: "USD",
    tags: job.tags,
    description: stripHtml(job.description || ""),
    raw_source: job
  }));
}

async function searchWwr(source, query, limit) {
  const xml = await fetchText(source.feed_url);
  const items = parseRssItems(xml);
  const filtered = query ? items.filter((item) => matchesQuery(`${item.title} ${item.description}`, query)) : items;
  return filtered.slice(0, limit).map((item) => {
    const parsed = parseWwrTitle(item.title);
    return {
      source_site: "WeWorkRemotely",
      id: stableId([item.link, item.guid, item.title]),
      title: parsed.title,
      company: parsed.company,
      location: "Remote",
      publication_date: item.pubDate,
      source_url: item.link,
      apply_url: item.link,
      description: stripHtml(item.description || ""),
      raw_source: item
    };
  });
}

function fetchJson(url) {
  return fetchText(url).then((text) => JSON.parse(text));
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const request = client.get(url, {
      headers: {
        "User-Agent": "CareerOS/0.1 (+https://github.com/DerMayer1/CareerOS)",
        "Accept": "application/json, application/rss+xml, application/xml, text/xml, text/plain, */*"
      }
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        resolve(fetchText(new URL(response.headers.location, url).toString()));
        return;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        response.resume();
        return;
      }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
    request.setTimeout(20000, () => request.destroy(new Error(`Timeout fetching ${url}`)));
    request.on("error", reject);
  });
}

function parseFlags(args) {
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      index += 1;
    }
  }
  return flags;
}

function buildManualSearchUrl(source, query) {
  const template = source.search_url_template || source.base_url || "";
  return template.replace("{query}", encodeURIComponent(query || ""));
}

function matchesQuery(text, query) {
  return String(query).toLowerCase().split(/\s+/).filter(Boolean).every((term) => String(text || "").toLowerCase().includes(term));
}

function absoluteRemoteOkUrl(url) {
  return String(url).startsWith("http") ? url : `https://remoteok.com${String(url).startsWith("/") ? "" : "/"}${url}`;
}

function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item\b[\s\S]*?<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml))) {
    const item = match[0];
    items.push({
      title: decodeXml(readXmlTag(item, "title")),
      link: decodeXml(readXmlTag(item, "link")),
      guid: decodeXml(readXmlTag(item, "guid")),
      pubDate: decodeXml(readXmlTag(item, "pubDate")),
      description: decodeXml(readXmlTag(item, "description"))
    });
  }
  return items;
}

function readXmlTag(xml, tag) {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  return match ? match[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "") : "";
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function parseWwrTitle(title) {
  const parts = String(title || "").split(":");
  if (parts.length >= 2) {
    return { company: parts.shift().trim(), title: parts.join(":").trim() };
  }
  return { company: "Unknown company", title: title || "Unknown role" };
}

function salaryRangeText(min, max, currency, period) {
  if (!min && !max) return "";
  return `${currency} ${min || max}-${max || min} / ${period}`;
}

function stripHtml(value) {
  return decodeXml(String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function validateApplicationGate(job) {
  if (!Number.isFinite(job.score_fit)) throw new Error("Job must be scored before approval.");
  if (!job.score_explanation) throw new Error("Job must have score_explanation before application workflow.");
  if (!["apply", "maybe"].includes(job.recommendation)) {
    throw new Error(`Job recommendation is ${job.recommendation}; refusing application workflow.`);
  }
  if ((job.red_flags || []).some((flag) => flag.severity === "blocking")) {
    throw new Error("Job has blocking red flags; refusing application workflow.");
  }
}

function applicationIdFor(job) {
  return `app:${stableId(["application", job.id])}`;
}

function applicationHeaderLine() {
  return `${APPLICATION_HEADERS.join(",")}\n`;
}

function upsertApplication(job, status, extras = {}) {
  const rows = readCsvFile(PATHS.applications);
  const existing = rows.find((item) => item.application_id === applicationIdFor(job) || item.job_id === job.id) || {};
  const now = new Date().toISOString();
  const salaryRange = [job.salary_monthly_usd_min, job.salary_monthly_usd_max].filter(Boolean).join("-");
  const row = {
    application_id: existing.application_id || applicationIdFor(job),
    job_id: job.id,
    company: job.company,
    role_title: job.title,
    status,
    recommendation: job.recommendation,
    score_fit: job.score_fit,
    created_at: existing.created_at || now,
    approved_at: extras.approved_at || existing.approved_at || job.approved_at || "",
    drafted_at: extras.drafted_at || existing.drafted_at || "",
    applied_at: existing.applied_at || "",
    last_follow_up: existing.last_follow_up || "",
    next_follow_up: existing.next_follow_up || "",
    application_dir: extras.application_dir || existing.application_dir || "",
    job_url: job.source_url,
    apply_url: job.apply_url,
    source_site: job.source_site,
    salary_range: salaryRange,
    notes: extras.notes || existing.notes || "Manual application workflow. CareerOS does not submit automatically."
  };
  const nextRows = rows.filter((item) => item.application_id !== row.application_id && item.job_id !== job.id);
  nextRows.push(row);
  writeApplications(nextRows);
}

function writeApplications(rows) {
  fs.writeFileSync(PATHS.applications, `${APPLICATION_HEADERS.join(",")}\n${rows.map((item) => APPLICATION_HEADERS.map((header) => csvEscape(item[header])).join(",")).join("\n")}\n`);
}

function readCsvFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf8").trim();
  return text ? parseCsv(text) : [];
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function latestFile(dir, ext) {
  if (!fs.existsSync(dir)) return "";
  const files = fs.readdirSync(dir)
    .filter((file) => file.endsWith(ext))
    .map((file) => ({ file, time: fs.statSync(path.join(dir, file)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  return files[0] ? relative(path.join(dir, files[0].file)) : "";
}

function cleanDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cleanDir(target);
      fs.rmdirSync(target);
    } else {
      fs.unlinkSync(target);
    }
  }
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

function jobMarkdown(job) {
  return `# ${job.company} - ${job.title}

- Job ID: ${job.id}
- Source: ${job.source_site}
- Job URL: ${job.source_url}
- Apply URL: ${job.apply_url}
- Recommendation: ${job.recommendation}
- Score: ${job.score_fit}
- Remote region: ${job.remote_region}
- Salary USD/month: ${job.salary_monthly_usd_min || "unknown"}-${job.salary_monthly_usd_max || "unknown"}

## Description

${job.description || "No description captured."}
`;
}

function fitAnalysisMarkdown(job) {
  return `# Fit Analysis

## Decision State

This job was approved through the CLI gate before application material was generated.

## Scores

- Overall: ${job.score_fit}
- Skills: ${job.score_skills}
- Experience: ${job.score_experience}
- Salary: ${job.score_salary}
- Remote: ${job.score_remote}
- Company: ${job.score_company}
- Application friction: ${job.score_application_friction}

## Matched Requirements

${bulletList(job.matched_requirements)}

## Missing Requirements

${bulletList(job.missing_requirements)}

## Red Flags

${bulletList((job.red_flags || []).map((flag) => `${flag.severity}: ${flag.message}`))}
`;
}

function applicationPlanMarkdown(job, profile = readJson(PATHS.candidateProfileJson, defaultCandidateProfileJson()), profileText = readText(PATHS.candidateProfile)) {
  const pitch = buildPitch(job, profile);
  return `# Application Plan

## Decision

- Recommendation: ${job.recommendation}
- Score: ${job.score_fit}
- Job ID: ${job.id}

## Why Apply

${job.notes || "Review the component scores and fit analysis before applying."}

## Short Pitch

${pitch}

## Positioning

- Emphasize matched requirements: ${listCell(job.matched_requirements) || "none captured"}
- Address partial matches honestly: ${listCell(job.partial_matches) || "none captured"}
- Do not overclaim missing requirements: ${listCell(job.missing_requirements) || "none captured"}

## Profile Evidence To Review

${profileEvidenceMarkdown(job, profile, profileText)}

## Risks To Review

${bulletList((job.red_flags || []).map((flag) => `${flag.severity}: ${flag.message}`))}

## Manual Steps

1. Review the original job post.
2. Review the candidate profile.
3. Draft application material manually or in a later CareerOS drafting phase.
4. Submit manually outside CareerOS.
5. Update tracker status with \`career-os applications status ${applicationIdFor(job)} applied\`.
`;
}

function cvNotesMarkdown(job, profile = readJson(PATHS.candidateProfileJson, defaultCandidateProfileJson()), profileText = readText(PATHS.candidateProfile)) {
  return `# CV Notes

## Keywords To Consider

${bulletList([...(job.requirements_required || []), ...(job.requirements_nice_to_have || [])])}

## Evidence To Use

- Use only real candidate experience from \`profile/candidate-profile.md\` and \`profile/candidate-profile.json\`.
- Prioritize evidence for: ${listCell(job.matched_requirements) || "none captured"}.
- Explain, do not hide, gaps around: ${listCell(job.missing_requirements) || "none captured"}.

## Suggested Emphasis

${bulletList(cvEmphasis(job, profile))}

## Profile Source Snapshot

${profileText.trim() ? profileText.slice(0, 1200) : "No Markdown profile details filled yet."}

## Honesty Checklist

- No invented experience.
- No invented employment history.
- No inflated seniority.
- No claim of work authorization unless true.
`;
}

function applicationPlaceholderMarkdown(job) {
  return applicationMessageMarkdown(job, readJson(PATHS.candidateProfileJson, defaultCandidateProfileJson()), readText(PATHS.candidateProfile));
}

function applicationMessageMarkdown(job, profile, profileText) {
  const pitch = buildPitch(job, profile);
  return `# Application Message Draft

This is a reviewable draft. CareerOS does not send it automatically.

## Short Version

Hi ${job.company} team,

I'm interested in the ${job.title} role. ${pitch}

The role stood out because it connects with ${listCell(job.matched_requirements) || "the strongest requirements I currently match"}. I would be glad to share more context and discuss where I can contribute.

Best,

[Your name]

## Direct Notes For Review

- Matched requirements: ${listCell(job.matched_requirements) || "none captured"}
- Partial matches: ${listCell(job.partial_matches) || "none captured"}
- Gaps to avoid overclaiming: ${listCell(job.missing_requirements) || "none captured"}
- Red flags to review: ${listCell((job.red_flags || []).map((flag) => `${flag.severity}: ${flag.message}`)) || "none"}
`;
}

function coverLetterMarkdown(job, profile, profileText) {
  const pitch = buildPitch(job, profile);
  return `# Cover Letter Draft

This is a reviewable draft. CareerOS does not send it automatically.

Dear ${job.company} team,

I am writing to express interest in the ${job.title} role. ${pitch}

Based on the posting, the strongest areas of alignment are ${listCell(job.matched_requirements) || "the requirements currently marked as matched"}. I would position my application around practical execution, clear communication, and the ability to connect technical implementation with product outcomes.

I also want to be precise about gaps. The current analysis marks ${listCell(job.missing_requirements) || "no major missing requirements"} as areas to review before submitting. I would not claim experience that is not supported by the profile.

Thank you for considering my application.

Sincerely,

[Your name]
`;
}

function interviewPrepPlaceholderMarkdown(job) {
  return interviewPrepMarkdown(job, readJson(PATHS.candidateProfileJson, defaultCandidateProfileJson()), readText(PATHS.candidateProfile));
}

function interviewPrepMarkdown(job, profile, profileText) {
  const matched = job.matched_requirements || [];
  const missing = job.missing_requirements || [];
  const partial = job.partial_matches || [];
  return `# Interview Prep

This is a reviewable preparation brief. CareerOS does not schedule, message, or submit anything automatically.

## Role Snapshot

- Company: ${job.company}
- Role: ${job.title}
- Recommendation: ${job.recommendation}
- Score: ${job.score_fit}
- Remote: ${job.remote_region || "unknown"} (${job.timezone_overlap || "unknown"} timezone overlap)
- Salary: ${job.salary_monthly_usd_min || "unknown"}-${job.salary_monthly_usd_max || "unknown"} USD/month
- Source: ${job.source_site}
- Job URL: ${job.source_url}

## Fit Narrative

${buildPitch(job, profile)}

## Strong Talking Points

${bulletList(matched.map((skill) => `${skill}: prepare one concrete example from your real experience.`))}

## Gaps To Handle Honestly

${bulletList(missing.map((skill) => `${skill}: do not claim mastery; prepare a learning plan or adjacent experience.`))}

## Partial Matches

${bulletList(partial.map((skill) => `${skill}: describe as adjacent, learning, or limited exposure only if true.`))}

## Likely Questions

${bulletList(likelyInterviewQuestions(job))}

## STAR Answer Outlines

${starOutlines(job)}

## Questions For The Interviewer

${bulletList(interviewerQuestions(job))}

## Negotiation Notes

- Minimum target from profile: ${profile.salary_min_monthly_usd || "unknown"} USD/month.
- Target compensation from profile: ${profile.salary_target_monthly_usd || "unknown"} USD/month.
- Clarify contract type: ${job.contract_type || "unknown"}.
- Clarify remote restrictions and work authorization before investing in long process steps.

## Risks To Validate

${bulletList((job.red_flags || []).map((flag) => `${flag.severity}: ${flag.message}`))}

## Profile Review Reminder

${profileText.trim() ? "Review profile/candidate-profile.md for concrete examples before the interview." : "Markdown profile is still sparse. Add concrete examples before the interview."}
`;
}

function buildPitch(job, profile) {
  const matched = job.matched_requirements || [];
  const targetRoles = profile.target_roles || [];
  const roleFit = targetRoles.find((role) => includesTerm(job.title, role)) || targetRoles[0] || "the target role";
  if (matched.length) {
    return `My background is most relevant to this role through ${matched.slice(0, 4).join(", ")}, with additional context around ${roleFit}.`;
  }
  return `The role appears aligned with ${roleFit}, but the application should be reviewed carefully because matched requirements are still limited.`;
}

function profileEvidenceMarkdown(job, profile, profileText) {
  const evidence = [];
  const strong = profile.skills_strong || [];
  const medium = profile.skills_medium || [];
  for (const skill of job.matched_requirements || []) {
    if (strong.map(normalizeSkill).includes(normalizeSkill(skill))) evidence.push(`${skill}: listed as strong in structured profile`);
    else if (medium.map(normalizeSkill).includes(normalizeSkill(skill))) evidence.push(`${skill}: listed as medium in structured profile`);
  }
  if (!evidence.length && profileText.trim()) evidence.push("Review Markdown profile for concrete examples before submitting.");
  return bulletList(evidence);
}

function cvEmphasis(job, profile) {
  const items = [];
  for (const skill of job.matched_requirements || []) items.push(`Make ${skill} visible if supported by real experience.`);
  for (const skill of job.partial_matches || []) items.push(`Mention ${skill} only as adjacent or learning context.`);
  for (const skill of job.missing_requirements || []) items.push(`Do not claim ${skill}; prepare a gap explanation if needed.`);
  return items;
}

function likelyInterviewQuestions(job) {
  const questions = [
    `Walk me through your experience relevant to ${job.title}.`,
    `Why are you interested in ${job.company}?`,
    "How do you approach ambiguous technical requirements?",
    "Tell me about a project where you shipped production-ready software.",
    "How do you communicate tradeoffs with product or business stakeholders?"
  ];
  for (const skill of (job.matched_requirements || []).slice(0, 4)) {
    questions.push(`Describe a concrete project where you used ${skill}.`);
  }
  for (const skill of (job.missing_requirements || []).slice(0, 3)) {
    questions.push(`The role mentions ${skill}. What is your current level and learning plan?`);
  }
  if ((job.red_flags || []).some((flag) => /Salary not disclosed/i.test(flag.message))) {
    questions.push("What is the expected compensation range for this role?");
  }
  return questions;
}

function starOutlines(job) {
  const skills = (job.matched_requirements || []).slice(0, 3);
  if (!skills.length) {
    return "Prepare at least two STAR stories from real projects before the interview.";
  }
  return skills.map((skill) => `### ${skill}

- Situation: Choose a real project where ${skill} mattered.
- Task: Explain your responsibility and constraints.
- Action: Describe the concrete implementation decisions you made.
- Result: Quantify or clearly state the outcome.
`).join("\n");
}

function interviewerQuestions(job) {
  return [
    "What does success look like in the first 90 days?",
    "Which parts of the stack or product are most urgent for this role?",
    "How is remote collaboration structured across time zones?",
    "What is the interview process after this step?",
    "Are there any work authorization or country restrictions I should confirm now?",
    "What compensation range is budgeted for this role?"
  ];
}

function bulletList(items) {
  return items && items.length ? items.map((item) => `- ${item}`).join("\n") : "- none";
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const text = fs.readFileSync(filePath, "utf8").trim();
  return text ? JSON.parse(text) : fallback;
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function listCell(value) {
  return Array.isArray(value) ? value.join("; ") : "";
}

function ensureDirs() {
  [
    "config",
    "docs",
    "profile",
    "workflows",
    "skills/job-application",
    "skills/job-radar",
    "sources",
    "scripts",
    "data",
    "templates/cv",
    "templates/cover_letters",
    "templates/applications",
    "templates/reports",
    "outputs/reports",
    "outputs/tables",
    "outputs/ai",
    "outputs/applications"
  ].forEach((dir) => fs.mkdirSync(path.join(ROOT, dir), { recursive: true }));
}

function writeIfMissing(filePath, content) {
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  if (!fs.existsSync(absolute)) fs.writeFileSync(absolute, content);
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function defaultSearchProfile() {
  return {
    locations: ["Remote", "LATAM", "Brazil", "Europe", "United States"],
    remote_modes: ["remote"],
    job_age_days: 14,
    target_roles: ["AI Engineer", "Full Stack Engineer", "Backend Engineer", "Developer Tools Engineer", "AI Product Engineer"],
    keywords_required_any: ["AI", "LLM", "automation", "backend", "typescript", "python"],
    keywords_excluded: ["unpaid", "volunteer", "onsite only"],
    salary_min_monthly_usd: 4000,
    timezone: "America/Sao_Paulo"
  };
}

function defaultCandidateProfileJson() {
  return {
    name: "",
    location: "Brazil",
    timezone: "America/Sao_Paulo",
    languages: [],
    skills_strong: ["python", "typescript", "ai", "llm", "automation"],
    skills_medium: ["react", "node.js", "backend", "postgres", "docker"],
    skills_learning: ["kubernetes", "soc2", "langchain"],
    skills_adjacent: ["product", "data pipelines", "apis"],
    target_roles: ["AI Engineer", "Full Stack Engineer", "Backend Engineer", "Developer Tools Engineer", "AI Product Engineer"],
    avoid_roles: ["unpaid internship", "commission-only", "onsite-only"],
    work_authorization: ["Brazil"],
    accepted_regions: ["LATAM", "Worldwide", "Brazil", "Remote"],
    salary_min_monthly_usd: 4000,
    salary_target_monthly_usd: 7000,
    contract_types: ["contractor", "full-time", "PJ", "B2B"]
  };
}

function defaultSkillTaxonomy() {
  return {
    skills: {
      languages: ["python", "typescript", "javascript", "go", "java", "ruby", "php", "sql"],
      frontend: ["react", "next.js", "vue", "angular", "tailwind", "react native"],
      backend: ["node.js", "express", "fastapi", "django", "rails", "graphql", "rest", "apis", "microservices"],
      ai: ["ai", "llm", "rag", "agents", "openai", "anthropic", "langchain", "langgraph", "llamaindex", "embeddings", "vector databases", "prompt engineering"],
      data: ["postgres", "mysql", "redis", "bigquery", "snowflake", "etl", "data pipelines", "analytics"],
      cloud: ["aws", "gcp", "azure", "docker", "kubernetes", "terraform", "serverless", "vercel"],
      product: ["product", "roadmap", "stakeholders", "experimentation", "analytics", "customer discovery"],
      security: ["soc2", "security", "oauth", "sso", "compliance"]
    },
    role_families: {
      ai_engineering: ["ai engineer", "llm engineer", "machine learning engineer", "ml engineer"],
      full_stack: ["full stack", "fullstack"],
      backend: ["backend", "back end", "api engineer"],
      frontend: ["frontend", "front end"],
      product: ["product manager", "technical product", "ai product"],
      devtools: ["developer tools", "devtools", "platform engineer"]
    },
    responsibility_verbs: ["build", "design", "develop", "implement", "maintain", "lead", "integrate", "automate", "evaluate", "ship", "architect", "collaborate", "optimize"]
  };
}

function defaultScoringWeights() {
  return {
    skills: 30,
    experience: 20,
    salary: 15,
    remote_compatibility: 15,
    company_quality: 10,
    growth_potential: 5,
    application_friction: 5
  };
}

function defaultAiConfig() {
  return {
    provider: "codex-cli",
    enabled: true,
    command: "codex",
    model: "",
    sandbox: "workspace-write",
    approval: "never",
    output_dir: "outputs/ai",
    web_search: false,
    timeout_ms: 300000
  };
}

function defaultSourcesConfig() {
  return {
    default_limit: 25,
    cache_ttl_hours: 6,
    sources: {
      remotive: {
        enabled: true,
        type: "public_api",
        phase: 2,
        base_url: "https://remotive.com/api/remote-jobs",
        max_limit: 100,
        attribution_required: true
      },
      jobicy: {
        enabled: true,
        type: "public_api",
        phase: 2,
        base_url: "https://jobicy.com/api/v2/remote-jobs",
        max_limit: 50,
        attribution_required: true
      },
      remoteok: {
        enabled: true,
        type: "public_api",
        phase: 2,
        base_url: "https://remoteok.com/api",
        max_limit: 100,
        attribution_required: true
      },
      wwr: {
        enabled: true,
        type: "rss",
        phase: 2,
        feed_url: "https://weworkremotely.com/remote-jobs.rss",
        max_limit: 50,
        attribution_required: true
      },
      wellfound: {
        enabled: true,
        type: "manual_search",
        phase: 2,
        base_url: "https://wellfound.com/jobs",
        search_url_template: "https://wellfound.com/jobs?keyword={query}&remote=true",
        max_limit: 0,
        notes: "Manual source. No official public search API is configured."
      },
      indeed_br: {
        enabled: true,
        type: "manual_search",
        phase: 2,
        base_url: "https://br.indeed.com",
        search_url_template: "https://br.indeed.com/jobs?q={query}&l=remoto",
        max_limit: 0,
        notes: "Manual source. Indeed API access is partner-oriented; no scraping connector is enabled."
      },
      glassdoor_br: {
        enabled: true,
        type: "manual_search",
        phase: 2,
        base_url: "https://www.glassdoor.com.br",
        search_url_template: "https://www.glassdoor.com.br/Job/jobs.htm?sc.keyword={query}&locT=C&locId=0",
        max_limit: 0,
        notes: "Manual source. No public low-risk job search API is configured."
      },
      linkedin: {
        enabled: false,
        type: "low_volume_reference",
        phase: 2,
        base_url: "",
        max_limit: 10,
        notes: "Optional low-volume connector. Keep disabled until explicitly needed."
      }
    }
  };
}

function agentsMd() {
  return `# AGENTS.md

You are operating CareerOS, a local-first remote job radar.

Rules:

- Do not generate applications before a job is scored and manually approved.
- Do not invent candidate experience, compensation, credentials, or work authorization.
- Prefer deterministic CLI commands for import, parsing, dedupe, normalization, sorting, and export.
- Use AI judgment only for requirement extraction, fit analysis, red flags, interview prep, and application writing.
- Use \`career-os ai ...\` as the Codex CLI integration surface.
- Keep data in open local files: JSONL, JSON, CSV, Markdown, and PDF.
- Mark unknown data as unknown. Do not fill gaps with guesses.
- Treat token economy as a product requirement.
`;
}

function readmeMd() {
  return `# CareerOS

CareerOS is a local-first CLI radar for remote job opportunities.

It collects or imports jobs, normalizes them, deduplicates seen roles, scores fit, exports decision tables, and generates Markdown reports before any application material is created.

## Quick Start

\`\`\`bash
npm install
npm run init
npm start -- import ./jobs.json
npm start -- normalize
npm start -- score
npm start -- report
npm start -- show top
\`\`\`

After global linking, the same commands can run as:

\`\`\`bash
career-os init
career-os import ./jobs.json
career-os normalize
career-os score
career-os report
career-os show top
\`\`\`

## Codex CLI Integration

CareerOS can call Codex CLI through \`career-os ai ...\` for profile review, requirement extraction, fit review, report summaries, application drafts, draft review, and interview prep.

\`\`\`bash
career-os ai doctor
career-os ai profile-sync --dry-run
career-os ai extract new --limit 5
career-os ai review-fit <job_id>
career-os ai summarize-report
career-os ai draft <application_id>
\`\`\`

AI prompts and responses are saved under \`outputs/ai\`. Application AI responses are copied into the approved application workspace. CareerOS does not submit applications automatically.

## MVP Scope

The first version intentionally supports manual, JSON, JSONL, and CSV imports before scraping. Remote source connectors come after the scoring and reporting loop is useful.
`;
}

function setupMd() {
  return `# Setup

1. Run \`career-os init\`.
2. Edit \`profile/candidate-profile.md\`.
3. Edit \`profile/role-preferences.md\`.
4. Tune \`config/search_profile.json\`.
5. Tune \`config/scoring_weights.json\`.
6. Import jobs with \`career-os import <file>\`.
7. Run \`career-os run\` or the individual pipeline commands.
`;
}

function candidateProfileMd() {
  return `# Candidate Profile

## Experience

TODO

## Stack

TODO

## Domains

TODO

## Languages

TODO

## Location And Remote Constraints

- Current timezone: America/Sao_Paulo
- Work authorization: TODO
- Accepted contract types: TODO

## Compensation

- Minimum monthly USD: 4000
- Target monthly USD: TODO
`;
}

function rolePreferencesMd() {
  return `# Role Preferences

## Target Roles

- AI Product Engineer
- Full Stack Engineer
- Backend Engineer
- Developer Tools Engineer
- Technical Product Manager
- Automation Engineer
- AI Solutions Engineer

## Avoid

- Unpaid internships
- Commission-only roles
- On-site roles outside Brazil
- Roles requiring citizenship or work authorization not currently held
- Roles with no timezone overlap
`;
}

function workflowSearchMd() {
  return `# Workflow: Search

Use the CLI as the operational surface:

\`\`\`bash
career-os import ./jobs.json
career-os normalize
\`\`\`

Search connectors should write raw source payloads to \`data/jobs_raw.jsonl\` and leave scoring to the next workflow.
`;
}

function workflowSearchRemoteMd() {
  return `# Workflow: Remote Search

\`\`\`bash
career-os sources list
career-os search all --query "AI Engineer" --limit 20
career-os normalize
career-os dedupe
career-os score
career-os report
career-os show top
\`\`\`

Keep limits small, prefer public APIs/RSS, and write raw source payloads before normalization.
`;
}

function workflowScoreMd() {
  return `# Workflow: Score

\`\`\`bash
career-os score
\`\`\`

Scoring should happen after deterministic normalization and dedupe. AI-assisted scoring can be added later, but the baseline must remain explainable and runnable locally.
`;
}

function workflowReportMd() {
  return `# Workflow: Report

\`\`\`bash
career-os report
career-os show top
\`\`\`

Reports should not reprocess descriptions or spend tokens. They should render from the current normalized/scored data.
`;
}

function workflowSetupMd() {
  return `# Workflow: Setup

Phase 1 setup is CLI-first.

\`\`\`bash
career-os init
career-os profile check
\`\`\`

The setup command creates the file structure. The profile check command tells the operator what still contains placeholders.
`;
}

function workflowApplyMd() {
  return `# Workflow: Apply

Application work is gated by score and approval.

\`\`\`bash
career-os approve <job_id>
career-os apply <job_id>
\`\`\`

Phase 1 creates a gated application workspace only. Full CV, cover letter, and interview prep generation are later-phase work.
`;
}

function workflowAiMd() {
  return `# Workflow: Codex AI

Use Codex CLI only after the deterministic CareerOS data exists.

\`\`\`bash
career-os ai doctor
career-os ai profile-sync --dry-run
career-os ai extract new --limit 5
career-os ai review-fit <job_id>
career-os ai summarize-report
career-os ai draft <application_id>
career-os ai review-draft <application_id>
career-os ai interview <application_id>
\`\`\`

Prompts and outputs are saved under \`outputs/ai\`. Application AI outputs are copied into the approved application workspace for manual review.

Do not use AI output to bypass scoring, approval, or manual submission.
`;
}

function workflowResetMd() {
  return `# Workflow: Reset

\`\`\`bash
career-os reset --data
\`\`\`

The explicit flag is required. This clears local generated data, reports, and tables only.
`;
}

function jobRadarSkillMd() {
  return `# Job Radar Skill

Use this skill when operating CareerOS to import, normalize, deduplicate, score, and report on remote job opportunities.

The CLI is the source of action. Prefer \`career-os\` commands over ad hoc edits.
`;
}

function scoringRulesMd() {
  return `# Scoring Rules

The deterministic baseline score is composed from skills, experience, salary, remote compatibility, company quality, growth potential, and application friction.
`;
}

function searchRulesMd() {
  return `# Search Rules

Phase 1 does not scrape. It imports JSON, JSONL, and CSV. Connectors belong to Phase 2.
`;
}

function redFlagsMd() {
  return `# Red Flags

Blocking flags include incompatible work authorization, onsite-only requirements outside accepted regions, and salary below the configured minimum.
`;
}

function jobApplicationSkillMd() {
  return `# Job Application Skill

Use this skill only after a job has passed the CareerOS approval gate.

\`\`\`bash
career-os approve <job_id>
career-os apply <job_id>
\`\`\`

Do not invent experience. Do not generate application material for unapproved jobs.
`;
}

function evaluationFrameworkMd() {
  return `# Evaluation Framework

Evaluate roles across technical skills, experience, salary, remote compatibility, company quality, and application friction. Keep unknowns explicit.
`;
}

function migrationMd() {
  return `# Claude To Codex Migration

CareerOS replaces Claude Code slash commands with the \`career-os\` CLI.

| Claude Code base | CareerOS Phase 1 |
|---|---|
| \`CLAUDE.md\` | \`AGENTS.md\` |
| Slash commands | \`career-os\` CLI commands |
| \`.claude/skills\` | \`skills/\` |
| \`job_search_tracker.csv\` | \`data/applications.csv\` |

The original project is application-first. CareerOS is decision-first.
`;
}

function codexCliIntegrationMd() {
  return `# Codex CLI Integration

CareerOS integrates Codex CLI through \`career-os ai ...\`.

The deterministic pipeline remains responsible for import, normalization, dedupe, scoring, reporting, approvals, and tracker state. Codex is used only where language judgment helps.

## Configuration

\`\`\`json
{
  "provider": "codex-cli",
  "enabled": true,
  "command": "codex",
  "model": "",
  "sandbox": "workspace-write",
  "approval": "never",
  "output_dir": "outputs/ai",
  "web_search": false,
  "timeout_ms": 300000
}
\`\`\`

## Commands

- \`career-os ai doctor\`
- \`career-os ai profile-sync [--dry-run]\`
- \`career-os ai extract <job_id|new> [--limit 5] [--dry-run]\`
- \`career-os ai review-fit <job_id> [--dry-run]\`
- \`career-os ai summarize-report [--dry-run]\`
- \`career-os ai draft <application_id|job_id> [--dry-run]\`
- \`career-os ai review-draft <application_id|job_id> [--dry-run]\`
- \`career-os ai interview <application_id|job_id> [--dry-run]\`

## Safety Model

- Every command writes the prompt to \`outputs/ai\`.
- Codex responses are saved to \`outputs/ai\`.
- Application commands also copy the response into the application workspace.
- AI commands do not submit applications, contact employers, schedule meetings, or mutate scored jobs automatically.
- Use \`--dry-run\` to inspect prompts without spending tokens.
`;
}

function sourcesReadmeMd() {
  return `# Sources

Remote source connectors belong to Phase 2.

Phase 1 accepts imported files only:

- JSON
- JSONL
- CSV

Every future connector should write raw payloads to \`data/jobs_raw.jsonl\` and then reuse the same normalization, dedupe, scoring, and reporting pipeline.
`;
}

module.exports = { main };
