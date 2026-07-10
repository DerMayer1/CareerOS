"use strict";

const readline = require("readline/promises");
const { usageError } = require("../core/flags");

async function collectProfileSetup({ flags, currentProfile, currentSearch, input = process.stdin, output = process.stdout }) {
  const values = {
    name: flags.name ?? currentProfile.name ?? "",
    location: flags.location ?? currentProfile.location ?? "",
    timezone: flags.timezone ?? currentProfile.timezone ?? "America/Sao_Paulo",
    target_roles: csvFlag(flags.roles, currentProfile.target_roles),
    skills_strong: csvFlag(flags.skills, currentProfile.skills_strong),
    accepted_regions: csvFlag(flags.regions, currentProfile.accepted_regions),
    salary_min_monthly_usd: numericFlag(flags["salary-min"], currentProfile.salary_min_monthly_usd),
    salary_target_monthly_usd: numericFlag(flags["salary-target"], currentProfile.salary_target_monthly_usd),
    contract_types: csvFlag(flags["contract-types"], currentProfile.contract_types)
  };

  if (!flags.yes) {
    if (!input.isTTY) {
      throw usageError("Profile setup needs an interactive terminal. Use --yes with explicit profile flags for non-interactive setup.");
    }
    const terminal = readline.createInterface({ input, output });
    try {
      values.name = await ask(terminal, "Name", values.name);
      values.location = await ask(terminal, "Location", values.location);
      values.timezone = await ask(terminal, "Timezone", values.timezone);
      values.target_roles = splitList(await ask(terminal, "Target roles (comma separated)", values.target_roles.join(", ")));
      values.skills_strong = splitList(await ask(terminal, "Strong skills (comma separated)", values.skills_strong.join(", ")));
      values.accepted_regions = splitList(await ask(terminal, "Accepted remote regions (comma separated)", values.accepted_regions.join(", ")));
      values.salary_min_monthly_usd = parseMoney(await ask(terminal, "Minimum monthly salary in USD", values.salary_min_monthly_usd));
      values.salary_target_monthly_usd = parseMoney(await ask(terminal, "Target monthly salary in USD", values.salary_target_monthly_usd));
      values.contract_types = splitList(await ask(terminal, "Contract types (comma separated)", values.contract_types.join(", ")));
    } finally {
      terminal.close();
    }
  }

  validateRequired(values);
  const profile = { ...currentProfile, ...values };
  const search = {
    ...currentSearch,
    locations: values.accepted_regions,
    target_roles: values.target_roles,
    salary_min_monthly_usd: values.salary_min_monthly_usd,
    timezone: values.timezone
  };
  return {
    profile,
    search,
    profileMarkdown: profileMarkdown(profile),
    preferencesMarkdown: preferencesMarkdown(profile)
  };
}

async function ask(terminal, label, current) {
  const suffix = current === "" || current === undefined ? "" : ` [${current}]`;
  const answer = (await terminal.question(`${label}${suffix}: `)).trim();
  return answer || current;
}

function validateRequired(values) {
  const missing = [];
  if (!String(values.name || "").trim()) missing.push("--name");
  if (!String(values.location || "").trim()) missing.push("--location");
  if (!String(values.timezone || "").trim()) missing.push("--timezone");
  if (!values.target_roles.length) missing.push("--roles");
  if (!values.skills_strong.length) missing.push("--skills");
  if (!values.accepted_regions.length) missing.push("--regions");
  if (!values.contract_types.length) missing.push("--contract-types");
  if (!Number.isFinite(values.salary_min_monthly_usd)) missing.push("--salary-min");
  if (!Number.isFinite(values.salary_target_monthly_usd)) missing.push("--salary-target");
  if (missing.length) throw usageError(`Profile setup is missing required values: ${missing.join(", ")}`);
  if (values.salary_target_monthly_usd < values.salary_min_monthly_usd) {
    throw usageError("--salary-target must be greater than or equal to --salary-min");
  }
}

function csvFlag(value, fallback = []) {
  return value === undefined ? [...(fallback || [])] : splitList(value);
}

function numericFlag(value, fallback) {
  return value === undefined ? Number(fallback) : Number(value);
}

function splitList(value) {
  return [...new Set(String(value || "").split(",").map((item) => item.trim()).filter(Boolean))];
}

function parseMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw usageError(`Invalid salary value: ${value}`);
  return number;
}

function profileMarkdown(profile) {
  return `# Candidate Profile

## Identity

- Name: ${profile.name}
- Location: ${profile.location}
- Timezone: ${profile.timezone}
- Languages: ${(profile.languages || []).join(", ") || "unknown"}

## Strong Skills

${bullets(profile.skills_strong)}

## Additional Skills

${bullets([...(profile.skills_medium || []), ...(profile.skills_adjacent || [])])}

## Work Authorization

${bullets(profile.work_authorization)}
`;
}

function preferencesMarkdown(profile) {
  return `# Role Preferences

## Target Roles

${bullets(profile.target_roles)}

## Accepted Regions

${bullets(profile.accepted_regions)}

## Compensation

- Minimum monthly USD: ${profile.salary_min_monthly_usd}
- Target monthly USD: ${profile.salary_target_monthly_usd}

## Contract Types

${bullets(profile.contract_types)}

## Avoid

${bullets(profile.avoid_roles)}
`;
}

function bullets(values) {
  return (values || []).length ? values.map((value) => `- ${value}`).join("\n") : "- unknown";
}

module.exports = {
  collectProfileSetup,
  profileMarkdown,
  splitList
};
