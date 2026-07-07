# CareerOS

CareerOS is a local-first CLI radar for remote job opportunities. It is adapted from the `ai-job-search` idea, but the center is different: first rank opportunities, then decide whether to apply.

## Quick Start

```bash
npm install
node bin/career-os.js init
node bin/career-os.js run examples/jobs.sample.json
node bin/career-os.js status
node bin/career-os.js show top
```

After linking the package, use the CLI name directly:

```bash
npm link
career-os init
career-os import examples/jobs.sample.json
career-os normalize
career-os dedupe
career-os score
career-os report
career-os show top
```

## Commands

| Command | Purpose |
|---|---|
| `career-os init` | Create local folders, configs, profile templates, and data files |
| `career-os profile check` | Report missing/TODO profile fields |
| `career-os import <file>` | Import JSON, JSONL, or CSV jobs into `data/jobs_raw.jsonl` |
| `career-os normalize` | Convert raw jobs into the CareerOS job model |
| `career-os dedupe` | Deduplicate normalized jobs and update seen state |
| `career-os score` | Apply deterministic baseline scoring |
| `career-os report` | Export CSV tables and Markdown report |
| `career-os show top [limit]` | Print top apply/maybe roles |
| `career-os show <table> [limit]` | Print an exported table |
| `career-os approve <job_id>` | Mark a scored job as ready to apply |
| `career-os apply <job_id>` | Create a gated application workspace |
| `career-os status` | Print current local state |
| `career-os reset --data` | Clear local generated data |

## Phase 1 Scope

Phase 1 intentionally avoids scraping and full application generation. It provides the Codex CLI foundation:

- `AGENTS.md` replaces `CLAUDE.md`.
- CLI commands replace Claude slash commands.
- Skills are stored under `skills/` instead of `.claude/skills/`.
- Workflows are Markdown references for the CLI, not the operational surface.
- Local files remain the source of truth.

Remote connectors, AI-assisted extraction, full CV/carta generation, and company intelligence are later phases.
