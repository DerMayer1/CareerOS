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
| `career-os ai doctor` | Verify Codex CLI availability and CareerOS AI configuration |
| `career-os ai profile-sync` | Ask Codex to review profile files and propose edits |
| `career-os ai extract <job_id|new>` | Ask Codex to extract nuanced requirements from job descriptions |
| `career-os ai review-fit <job_id>` | Ask Codex to review one deterministic score and recommendation |
| `career-os ai summarize-report` | Ask Codex to summarize the latest decision report |
| `career-os ai draft <id>` | Ask Codex to draft approved application material |
| `career-os ai review-draft <id>` | Ask Codex to review approved application drafts |
| `career-os ai interview <id>` | Ask Codex to create deeper interview prep |
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
| `career-os apply <job_id>` | Create a gated manual application workspace |
| `career-os applications list [limit]` | List tracked applications |
| `career-os applications status <id> <status>` | Manually update application status |
| `career-os applications followup <id> --date YYYY-MM-DD` | Set next manual follow-up date |
| `career-os application plan <id>` | Regenerate application plan |
| `career-os application cv-notes <id>` | Regenerate CV notes |
| `career-os application draft <id>` | Generate message and cover letter drafts |
| `career-os interview <id>` | Generate interview prep brief |
| `career-os status` | Print current local state |
| `career-os reset --data` | Clear local generated data |

## Product Boundary

CareerOS intentionally avoids bulk application submission. It provides a deterministic decision pipeline and gated, reviewable application workspaces:

- `AGENTS.md` replaces `CLAUDE.md`.
- CLI commands replace Claude slash commands.
- Skills are stored under `skills/` instead of `.claude/skills/`.
- Workflows are Markdown references for the CLI, not the operational surface.
- Local files remain the source of truth.

Public connectors, deterministic extraction/scoring, application drafting, interview preparation, and the optional Codex layer are implemented. CareerOS still never submits applications or contacts employers.

## Codex CLI Integration

CareerOS uses Codex CLI as an optional judgment layer on top of the deterministic pipeline. The core commands still import, normalize, dedupe, score, and report without AI. Codex is used when the task needs language judgment: profile review, nuanced requirement extraction, fit review, report summary, application drafting, draft review, and interview prep.

Configure it in `config/ai.json`:

```json
{
  "provider": "codex-cli",
  "enabled": false,
  "command": "codex",
  "model": "",
  "sandbox": "read-only",
  "approval": "never",
  "output_dir": "outputs/ai",
  "web_search": false,
  "timeout_ms": 300000,
  "max_prompt_chars": 120000,
  "max_output_chars": 120000
}
```

AI is opt-in and read-only by default. Enable it only after reviewing `config/ai.json`. Using `workspace-write` additionally requires `allow_workspace_write: true`.

Typical use:

```bash
career-os ai doctor
career-os ai profile-sync --dry-run
career-os ai extract new --limit 5
career-os ai review-fit <job_id>
career-os ai summarize-report
career-os ai draft <application_id>
career-os ai review-draft <application_id>
career-os ai interview <application_id>
```

Every AI command writes the prompt and response under `outputs/ai`. Application AI commands also copy the final Codex response into the approved application workspace, for example `ai-draft.md` or `ai-interview-prep.md`. CareerOS still does not submit applications automatically.

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

## Manual Applications

CareerOS does not submit applications automatically. The application workflow creates local files for review:

```bash
career-os approve <job_id>
career-os apply <job_id>
career-os applications list
career-os application plan <application_id>
career-os application cv-notes <application_id>
career-os application draft <application_id>
career-os interview <application_id>
career-os applications followup <application_id> --date YYYY-MM-DD
career-os applications status <application_id> applied
```

`career-os apply` creates a workspace under `outputs/applications/` with:

- `job.md`
- `fit-analysis.md`
- `application-plan.md`
- `cv-notes.md`
- `application-message.md`
- `cover-letter.md`
- `interview-prep.md`

## Development Verification

```bash
npm ci
npm run ci
```

The CI command performs syntax checks, unit and end-to-end tests, and validates the exact npm package manifest. GitHub Actions runs it on Node 18, 20, and 22 across Linux, Windows, and macOS.
