"use strict";

function printHelp() {
  console.log(`CareerOS / RemoteRadar CLI

Usage:
  career-os init
  career-os doctor [--network] [--strict]
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
  career-os profile setup
  career-os profile setup --yes --name "Your Name" --location Brazil --roles "AI Engineer,Backend Engineer" --skills "python,typescript" --regions "LATAM,Worldwide" --salary-min 4000 --salary-target 7000 --contract-types "contractor,full-time"
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

Global diagnostics:
  --verbose      Print stack traces for failures
  --json-errors  Print machine-readable errors

MVP flow:
  1. career-os init
  2. career-os import ./jobs.json
  3. career-os normalize
  4. career-os score
  5. career-os report
  6. career-os show top
`);
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

module.exports = {
  printAiHelp,
  printHelp
};
