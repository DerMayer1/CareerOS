# AGENTS.md

You are operating CareerOS, a local-first remote job radar built for Codex CLI.

## Role

CareerOS is not a bulk application bot. It is a decision system for remote job opportunities. The primary job is to import or collect roles, normalize them, deduplicate them, score fit, expose gaps, and generate decision tables before any application material is created.

## Operating Rules

- Use `career-os` as the official operational surface.
- Do not depend on Claude Code, slash commands, or Anthropic-specific workflows.
- Do not generate applications before a job is scored and explicitly approved.
- Do not invent candidate experience, compensation, credentials, work authorization, or company facts.
- Prefer deterministic CLI commands for import, parsing, dedupe, normalization, salary conversion, sorting, and export.
- Use AI judgment only for requirement extraction, fit analysis, red flags, interview prep, and application writing.
- Keep score calculations auditable through component scores and `score_explanation`.
- Reports must render existing data only. Do not fetch, rescore, or spend AI tokens during report generation.
- Keep data in open local files: JSONL, JSON, CSV, Markdown, and PDF.
- Mark uncertain data as `unknown`. Do not fill gaps with guesses.
- Treat token economy as a product requirement.

## CLI Flow

```bash
career-os init
career-os profile check
career-os sources list
career-os search remotive --query "AI Engineer" --limit 10
career-os import examples/jobs.sample.json
career-os normalize
career-os dedupe
career-os extract
career-os score
career-os report
career-os show top
```

## Application Gate

Application generation is gated:

1. A job must exist in `data/jobs_normalized.json`.
2. It must have a score.
3. It must be recommended as `apply` or `maybe`.
4. The user or operator must run `career-os approve <job_id>`.
5. Only then may `career-os apply <job_id>` create an application workspace.

CareerOS must not submit applications automatically. It prepares local files and tracker state only. The user submits manually outside CareerOS.
Drafting commands produce reviewable Markdown only and must not claim unsupported experience.
Interview and follow-up commands prepare local notes and tracker dates only; they must not contact employers or schedule meetings automatically.

## Claude Code Migration Map

| Original Claude artifact | CareerOS replacement |
|---|---|
| `CLAUDE.md` | `AGENTS.md` |
| `.claude/commands/setup.md` | `career-os init` and `career-os profile check` |
| `.claude/commands/apply.md` | `career-os approve <job_id>` then `career-os apply <job_id>` |
| `.claude/commands/expand.md` | Future `career-os profile expand` |
| `.claude/commands/add-portal.md` | Future `career-os sources add` |
| `.claude/commands/reset.md` | `career-os reset --data` |
| `.claude/skills/job-application-assistant` | `skills/job-application` |
| `.claude/skills/job-scraper` | `skills/job-radar` |
| `.claude/skills/upskill` | Future `skills/upskill` |
