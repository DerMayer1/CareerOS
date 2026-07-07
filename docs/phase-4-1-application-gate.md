# Phase 4.1 Application Gate

Phase 4.1 creates a manual application workflow. CareerOS prepares local files and tracker state; it does not submit applications.

## Commands

```bash
career-os approve <job_id>
career-os apply <job_id>
career-os applications list
career-os applications status <application_id> <status>
```

## Tracker Statuses

- `ready_to_apply`
- `drafted`
- `applied`
- `interviewing`
- `offer`
- `rejected`
- `withdrawn`
- `archived`

## Workspace

`career-os apply <job_id>` creates:

- `job.md`
- `fit-analysis.md`
- `application-plan.md`
- `cv-notes.md`
- `application-message.md`
- `interview-prep.md`

The generated files are placeholders and decision aids. Full application drafting belongs to a later phase.
