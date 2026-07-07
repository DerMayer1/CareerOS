# Workflow: Apply

Application work is gated by score and approval.

```bash
career-os approve <job_id>
career-os apply <job_id>
career-os applications list
career-os applications status <application_id> applied
```

Behavior:

- `approve` marks a scored `apply` or `maybe` job as `ready_to_apply`.
- `apply` creates a manual application workspace with `job.md`, `fit-analysis.md`, `application-plan.md`, `cv-notes.md`, `application-message.md`, and `interview-prep.md`.
- `applications status` records the user's manual status changes.
- CareerOS does not submit applications.

Rules:

- Do not apply to `skip` or unscored jobs.
- Do not invent experience.
- Do not create application material before approval.
- Do not click submit, fill portals, send emails, or message recruiters automatically.
