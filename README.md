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
| `career-os sources list` | List configured remote sources |
| `career-os search <source|all>` | Search remote sources and append raw jobs |
| `career-os profile check` | Report missing/TODO profile fields |
| `career-os import <file>` | Import JSON, JSONL, or CSV jobs into `data/jobs_raw.jsonl` |
| `career-os normalize` | Convert raw jobs into the CareerOS job model |
| `career-os dedupe` | Deduplicate normalized jobs and update seen state |
| `career-os extract` | Extract deterministic requirements and job signals |
| `career-os score` | Apply deterministic multidimensional scoring |
| `career-os report` | Export CSV tables and Markdown report |
| `career-os show top [limit]` | Print top apply/maybe roles |
| `career-os show gaps [limit]` | Print skill gap heatmap |
| `career-os show red-flags [limit]` | Print red flags table |
| `career-os show <table> [limit]` | Print an exported table |
| `career-os explain <job_id>` | Explain one scored job |
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

## Remote Search

Phase 2 adds public remote sources:

```bash
career-os sources list
career-os search remotive --query "AI Engineer" --limit 10
career-os search jobicy --query "python" --limit 10
career-os search remoteok --query "backend" --limit 10
career-os search wwr --query "full stack" --limit 10
career-os search all --query "AI Engineer" --limit 20
career-os search wellfound --query "AI Engineer"
career-os search indeed_br --query "Python Developer"
career-os search glassdoor_br --query "Backend Engineer"
```

Search writes raw payloads to `data/jobs_raw.jsonl`. The same deterministic pipeline still runs afterward:

```bash
career-os normalize
career-os dedupe
career-os extract
career-os score
career-os report
career-os show top
```

Use `--dry-run` to inspect results without writing raw jobs.

Wellfound, Indeed Brazil, and Glassdoor Brazil are configured as manual search sources. They print search URLs and do not write fake job rows, because no low-risk public search API is configured for them.

## Scoring

`career-os score` writes component scores and explanations back to `data/jobs_normalized.json`:

- `score_skills`
- `score_experience`
- `score_salary`
- `score_remote`
- `score_company`
- `score_growth`
- `score_application_friction`
- `score_risk`
- `score_explanation`

Recommendations are based on fit, salary, remote compatibility, skill coverage, risk, and blocking red flags.

## Decision Reports

`career-os report` exports decision tables:

- `top_matches.csv`
- `high_salary_medium_fit.csv`
- `easy_wins.csv`
- `stretch_roles.csv`
- `skip.csv`
- `skill_gap_heatmap.csv`
- `red_flags.csv`
- `salary_transparency.csv`
- `remote_fit.csv`
- `best_next_actions.csv`

Useful commands:

```bash
career-os show gaps
career-os show red-flags
career-os explain <job_id>
```
