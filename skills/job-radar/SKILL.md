# Job Radar Skill

Use this skill when operating CareerOS to import, normalize, deduplicate, score, and report on remote job opportunities.

## Core Rule

The CLI is the source of action. Prefer `career-os` commands over ad hoc edits.

## Phase 1 Commands

```bash
career-os import <file>
career-os normalize
career-os dedupe
career-os score
career-os report
career-os show top
career-os status
```

## Deterministic Responsibilities

- Parse JSON, JSONL, and CSV input.
- Normalize job fields.
- Deduplicate by source ID or stable hash.
- Normalize salary periods into monthly USD.
- Export CSV tables and Markdown reports.

## AI Responsibilities

AI may help inspect data quality and explain results, but Phase 1 scoring must remain deterministic and reproducible.
