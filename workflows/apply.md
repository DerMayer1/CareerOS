# Workflow: Apply

Application work is gated by score and approval.

```bash
career-os approve <job_id>
career-os apply <job_id>
```

Phase 1 behavior:

- `approve` marks a scored `apply` or `maybe` job as `ready_to_apply`.
- `apply` creates an application workspace with `job.md`, `fit-analysis.md`, and `application-message.md`.
- Full CV, cover letter, and interview prep generation are later-phase work.

Rules:

- Do not apply to `skip` or unscored jobs.
- Do not invent experience.
- Do not create application material before approval.
