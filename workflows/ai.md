# Workflow: Codex AI

Use Codex CLI only after the deterministic CareerOS data exists.

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

Prompts and outputs are saved under `outputs/ai`. Application AI outputs are copied into the approved application workspace for manual review.

Do not use AI output to bypass scoring, approval, or manual submission.
