const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const https = require("https");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const OUTPUTS_DIR = path.join(ROOT, "outputs");

const PATHS = {
  searchProfile: path.join(ROOT, "config", "search_profile.json"),
  scoringWeights: path.join(ROOT, "config", "scoring_weights.json"),
  sourcesConfig: path.join(ROOT, "config", "sources.json"),
  candidateProfile: path.join(ROOT, "profile", "candidate-profile.md"),
  rolePreferences: path.join(ROOT, "profile", "role-preferences.md"),
  rawJobs: path.join(DATA_DIR, "jobs_raw.jsonl"),
  normalizedJobs: path.join(DATA_DIR, "jobs_normalized.json"),
  seenJobs: path.join(DATA_DIR, "seen_jobs.json"),
  sourceCache: path.join(DATA_DIR, "source_cache.json"),
  applications: path.join(DATA_DIR, "applications.csv"),
  reports: path.join(OUTPUTS_DIR, "reports"),
  tables: path.join(OUTPUTS_DIR, "tables")
};

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
  if (command === "score") return scoreJobs();
  if (command === "report") return generateReport();
  if (command === "run") return runPipeline(args.slice(1));
  if (command === "status") return showStatus();
  if (command === "profile" && args[1] === "check") return checkProfile();
  if (command === "approve") return approveJob(args[1]);
  if (command === "apply") return applyJob(args[1]);
  if (command === "reset") return resetData(args.slice(1));
  if (command === "show" && args[1] === "top") return showTop(args[2]);
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
  career-os score
  career-os report
  career-os status
  career-os profile check
  career-os show top [limit]
  career-os show <table-name> [limit]
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
  writeIfMissing(PATHS.candidateProfile, candidateProfileMd());
  writeIfMissing(PATHS.rolePreferences, rolePreferencesMd());
  writeIfMissing(path.join(ROOT, "workflows", "search.md"), workflowSearchMd());
  writeIfMissing(path.join(ROOT, "workflows", "search-remote.md"), workflowSearchRemoteMd());
  writeIfMissing(path.join(ROOT, "workflows", "score.md"), workflowScoreMd());
  writeIfMissing(path.join(ROOT, "workflows", "report.md"), workflowReportMd());
  writeIfMissing(path.join(ROOT, "workflows", "setup.md"), workflowSetupMd());
  writeIfMissing(path.join(ROOT, "workflows", "apply.md"), workflowApplyMd());
  writeIfMissing(path.join(ROOT, "workflows", "reset.md"), workflowResetMd());
  writeIfMissing(path.join(ROOT, "skills", "job-radar", "SKILL.md"), jobRadarSkillMd());
  writeIfMissing(path.join(ROOT, "skills", "job-radar", "scoring-rules.md"), scoringRulesMd());
  writeIfMissing(path.join(ROOT, "skills", "job-radar", "search-rules.md"), searchRulesMd());
  writeIfMissing(path.join(ROOT, "skills", "job-radar", "red-flags.md"), redFlagsMd());
  writeIfMissing(path.join(ROOT, "skills", "job-application", "SKILL.md"), jobApplicationSkillMd());
  writeIfMissing(path.join(ROOT, "skills", "job-application", "evaluation-framework.md"), evaluationFrameworkMd());
  writeIfMissing(path.join(ROOT, "docs", "claude-to-codex-migration.md"), migrationMd());
  writeIfMissing(path.join(ROOT, "sources", "README.md"), sourcesReadmeMd());
  writeIfMissing(PATHS.rawJobs, "");
  writeIfMissing(PATHS.normalizedJobs, "[]\n");
  writeIfMissing(PATHS.seenJobs, JSON.stringify({ seen: {} }, null, 2) + "\n");
  writeIfMissing(PATHS.sourceCache, JSON.stringify({ searches: {} }, null, 2) + "\n");
  writeIfMissing(PATHS.applications, "application_id,company,role_title,job_url,apply_url,source_site,score_fit,status,applied_at,last_follow_up,next_follow_up,salary_range,notes\n");
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

function scoreJobs() {
  ensureDirs();
  const jobs = readJson(PATHS.normalizedJobs, []);
  const config = readJson(PATHS.searchProfile, defaultSearchProfile());
  const weights = readJson(PATHS.scoringWeights, defaultScoringWeights());
  const profileText = readText(PATHS.candidateProfile);
  const scored = jobs.map((job) => scoreJob(job, config, weights, profileText));
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
  const allowed = new Set(["top_matches", "high_salary_medium_fit", "easy_wins", "stretch_roles", "skip", "skill_gap_heatmap"]);
  if (!allowed.has(tableName)) throw new Error(`Unknown table: ${tableName}`);
  const limit = Math.max(1, Number(limitArg || 25));
  const tablePath = path.join(PATHS.tables, `${tableName}.csv`);
  if (!fs.existsSync(tablePath)) throw new Error(`Missing ${relative(tablePath)}. Run: career-os report`);
  const rows = fs.readFileSync(tablePath, "utf8").trim().split(/\r?\n/);
  console.log(rows.slice(0, limit + 1).join("\n"));
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
    ["role preferences", PATHS.rolePreferences],
    ["search profile", PATHS.searchProfile],
    ["scoring weights", PATHS.scoringWeights]
  ].map(([label, filePath]) => {
    const exists = fs.existsSync(filePath);
    const text = exists ? fs.readFileSync(filePath, "utf8") : "";
    const todoCount = (text.match(/\bTODO\b|\[[A-Z0-9_]+\]/g) || []).length;
    return { label, path: relative(filePath), exists, todo_count: todoCount, ready: exists && todoCount === 0 };
  });
  console.log(JSON.stringify({ ready: checks.every((check) => check.ready), checks }, null, 2));
}

function approveJob(jobId) {
  if (!jobId) throw new Error("Missing job id. Usage: career-os approve <job_id>");
  const jobs = readJson(PATHS.normalizedJobs, []);
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index < 0) throw new Error(`Job not found: ${jobId}`);
  if (!Number.isFinite(jobs[index].score_fit)) throw new Error("Job must be scored before approval.");
  if (!["apply", "maybe"].includes(jobs[index].recommendation)) {
    throw new Error(`Job recommendation is ${jobs[index].recommendation}; refusing approval.`);
  }
  jobs[index] = { ...jobs[index], state: "ready_to_apply", approved_at: new Date().toISOString() };
  fs.writeFileSync(PATHS.normalizedJobs, JSON.stringify(jobs, null, 2) + "\n");
  upsertApplication(jobs[index], "ready_to_apply");
  console.log(`Approved ${jobId} for application.`);
}

function applyJob(jobId) {
  if (!jobId) throw new Error("Missing job id. Usage: career-os apply <job_id>");
  const jobs = readJson(PATHS.normalizedJobs, []);
  const job = jobs.find((item) => item.id === jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  if (job.state !== "ready_to_apply") {
    throw new Error("Application generation is gated. Run career-os approve <job_id> first.");
  }
  const slug = slugify(`${job.company}-${job.title}-${new Date().toISOString().slice(0, 10)}`);
  const dir = path.join(OUTPUTS_DIR, "applications", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "job.md"), jobMarkdown(job));
  fs.writeFileSync(path.join(dir, "fit-analysis.md"), fitAnalysisMarkdown(job));
  fs.writeFileSync(path.join(dir, "application-message.md"), applicationPlaceholderMarkdown(job));
  upsertApplication(job, "saved");
  console.log(`Prepared gated application workspace: ${relative(dir)}`);
}

function resetData(args) {
  if (!args.includes("--data")) throw new Error("Refusing reset without explicit flag. Usage: career-os reset --data");
  ensureDirs();
  fs.writeFileSync(PATHS.rawJobs, "");
  fs.writeFileSync(PATHS.normalizedJobs, "[]\n");
  fs.writeFileSync(PATHS.seenJobs, JSON.stringify({ seen: {} }, null, 2) + "\n");
  fs.writeFileSync(PATHS.applications, "application_id,company,role_title,job_url,apply_url,source_site,score_fit,status,applied_at,last_follow_up,next_follow_up,salary_range,notes\n");
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

function scoreJob(job, config, weights, profileText) {
  const text = `${job.title} ${job.description}`.toLowerCase();
  const profile = profileText.toLowerCase();
  const targetKeywords = (config.keywords_required_any || []).map((item) => String(item).toLowerCase());
  const requirementsInJob = targetKeywords.filter((keyword) => includesTerm(text, keyword));
  const matched = requirementsInJob.filter((keyword) => includesTerm(profile, keyword));
  const missing = requirementsInJob.filter((keyword) => !includesTerm(profile, keyword));

  const scoreSkills = requirementsInJob.length ? Math.round((matched.length / requirementsInJob.length) * 100) : 20;
  const scoreExperience = scoreSeniority(job.seniority);
  const scoreSalary = scoreSalaryCompatibility(job, config);
  const scoreRemote = scoreRemoteCompatibility(job);
  const scoreCompany = job.company_size !== "unknown" || job.company_stage !== "unknown" ? 70 : 50;
  const scoreApplicationFriction = job.red_flags.some((flag) => flag.severity === "blocking") ? 20 : 75;

  const scoreFit = Math.round(
    scoreSkills * ((weights.skills || 30) / 100) +
    scoreExperience * ((weights.experience || 20) / 100) +
    scoreSalary * ((weights.salary || 15) / 100) +
    scoreRemote * ((weights.remote_compatibility || 15) / 100) +
    scoreCompany * ((weights.company_quality || 10) / 100) +
    60 * ((weights.growth_potential || 5) / 100) +
    scoreApplicationFriction * ((weights.application_friction || 5) / 100)
  );

  return {
    ...job,
    requirements_required: matched,
    matched_requirements: matched,
    missing_requirements: missing,
    score_fit: scoreFit,
    score_skills: scoreSkills,
    score_experience: scoreExperience,
    score_salary: scoreSalary,
    score_remote: scoreRemote,
    score_company: scoreCompany,
    score_application_friction: scoreApplicationFriction,
    recommendation: recommendationFor(job, scoreFit, scoreSalary, scoreRemote, scoreSkills),
    notes: explanationFor(scoreFit, scoreSalary, scoreRemote, missing)
  };
}

function recommendationFor(job, scoreFit, scoreSalary, scoreRemote, scoreSkills) {
  if (job.red_flags.some((flag) => flag.severity === "blocking") || scoreRemote < 35 || scoreSalary < 25) return "skip";
  if (scoreSkills < 30) return scoreRemote >= 60 && scoreSalary >= 50 ? "watch" : "skip";
  if (scoreFit >= 75) return "apply";
  if (scoreFit >= 55) return "maybe";
  if (scoreRemote >= 60) return "watch";
  return "skip";
}

function explanationFor(scoreFit, scoreSalary, scoreRemote, missing) {
  const parts = [`fit=${scoreFit}`, `salary=${scoreSalary}`, `remote=${scoreRemote}`];
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
    skill_gap_heatmap: buildSkillGapHeatmap(sorted)
  };
}

function toTableRow(job) {
  return {
    score_fit: job.score_fit,
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
    missing_requirements: listCell(job.missing_requirements),
    red_flags: listCell((job.red_flags || []).map((flag) => `${flag.severity}:${flag.message}`)),
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

function reportMarkdown(today, jobs, tables) {
  const top = tables.top_matches.slice(0, 10);
  return `# Remote Radar - ${today}

## Summary

- Jobs normalized: ${jobs.length}
- Jobs scored: ${jobs.filter((job) => Number.isFinite(job.score_fit)).length}
- Top matches: ${tables.top_matches.length}
- Easy wins: ${tables.easy_wins.length}
- Stretch roles: ${tables.stretch_roles.length}
- Skips: ${tables.skip.length}

## Top Matches

${markdownTable(top.slice(0, 10), ["score_fit", "company", "role_title", "salary_monthly_usd_min", "remote_region", "source_site", "recommendation"])}

## Next Actions

1. Review top matches manually.
2. Approve only jobs that are worth applying to.
3. Generate application material only for approved jobs.
`;
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
  const numbers = [...String(combined).matchAll(/(?:\d{1,3}(?:[,.]\d{3})+|\d+)(?:[,.]\d+)?/g)]
    .map((match) => Number(match[0].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
  const min = explicitMin || numbers[0] || null;
  const max = explicitMax || numbers[1] || min;
  const monthlyMin = min ? toMonthlyUsd(min, currency, period) : null;
  const monthlyMax = max ? toMonthlyUsd(max, currency, period) : monthlyMin;

  return {
    min,
    max,
    currency,
    period,
    monthlyUsdMin: monthlyMin,
    monthlyUsdMax: monthlyMax,
    disclosed: Boolean(min),
    confidence: min ? "medium" : "unknown"
  };
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
  if (/united states|usa|u\.s\.|us only/.test(text)) return "USA";
  if (/europe|emea|eu only/.test(text)) return "Europe";
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
  if (/eu-only|must be based in europe/.test(text)) {
    flags.push({ severity: "warning", message: "Europe-only restriction may block eligibility" });
  }
  if (/rockstar|ninja|work hard play hard/.test(text)) {
    flags.push({ severity: "warning", message: "Low-quality hiring language" });
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

function upsertApplication(job, status) {
  const rows = readCsvFile(PATHS.applications);
  const salaryRange = [job.salary_monthly_usd_min, job.salary_monthly_usd_max].filter(Boolean).join("-");
  const row = {
    application_id: job.id,
    company: job.company,
    role_title: job.title,
    job_url: job.source_url,
    apply_url: job.apply_url,
    source_site: job.source_site,
    score_fit: job.score_fit,
    status,
    applied_at: "",
    last_follow_up: "",
    next_follow_up: "",
    salary_range: salaryRange,
    notes: "Created by CareerOS CLI approval gate"
  };
  const headers = ["application_id", "company", "role_title", "job_url", "apply_url", "source_site", "score_fit", "status", "applied_at", "last_follow_up", "next_follow_up", "salary_range", "notes"];
  const nextRows = rows.filter((item) => item.application_id !== job.id);
  nextRows.push(row);
  fs.writeFileSync(PATHS.applications, `${headers.join(",")}\n${nextRows.map((item) => headers.map((header) => csvEscape(item[header])).join(",")).join("\n")}\n`);
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

function applicationPlaceholderMarkdown(job) {
  return `# Application Message Draft

Application writing belongs to a later phase. For now, this file records that ${job.company} - ${job.title} passed the approval gate.

Before writing a real message:

1. Re-read the job description.
2. Re-read the candidate profile.
3. Do not invent experience.
4. Explain any CV changes made for this role.
`;
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
    "templates/reports",
    "outputs/reports",
    "outputs/tables",
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
