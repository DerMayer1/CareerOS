"use strict";

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
  return { score: clampScore(score), explanation: "Application friction estimated from process language and blocking flags." };
}

function scoreRiskDimension(job) {
  const flags = job.red_flags || [];
  const blocking = flags.filter((flag) => flag.severity === "blocking").length;
  const warnings = flags.filter((flag) => flag.severity === "warning").length;
  const infos = flags.filter((flag) => flag.severity === "info").length;
  const score = clampScore(100 - blocking * 60 - warnings * 20 - infos * 5);
  return { score, explanation: `${blocking} blocking, ${warnings} warning, ${infos} info red flags.` };
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

function scoreSeniority(seniority) {
  if (seniority === "senior" || seniority === "staff" || seniority === "lead") return 80;
  if (seniority === "mid") return 70;
  if (seniority === "junior") return 40;
  return 55;
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function listCell(value) {
  return Array.isArray(value) ? value.join("; ") : "";
}

module.exports = {
  buildTables,
  scoreJob,
  toTableRow
};
