# Claude To Codex Migration

CareerOS adapts the useful parts of `ai-job-search` without carrying over Claude Code as a runtime dependency.

| Claude Code base | CareerOS Phase 1 |
|---|---|
| `CLAUDE.md` | `AGENTS.md` |
| Slash commands | `career-os` CLI commands |
| `.claude/skills` | `skills/` |
| Job scraper skill | `skills/job-radar` and future source connectors |
| Application assistant skill | `skills/job-application` |
| `job_search_tracker.csv` | `data/applications.csv` |
| Direct apply workflow | Approval-gated application workspace |

## Command Mapping

| Original command | CareerOS command | Phase |
|---|---|---|
| `/setup` | `career-os init`, `career-os profile check` | 1 |
| `/scrape` | `career-os search <source>` | 2 |
| `/apply` | `career-os approve <job_id>`, `career-os apply <job_id>` | 1 gate, 4 full writing |
| `/expand` | `career-os profile expand` | later |
| `/add-portal` | `career-os sources add` | 2 |
| `/reset` | `career-os reset --data` | 1 |

## Product Shift

The original project is application-first. CareerOS is decision-first:

1. Import or collect jobs.
2. Normalize and deduplicate.
3. Score and produce decision tables.
4. Shortlist.
5. Approve.
6. Generate application material only for approved jobs.
