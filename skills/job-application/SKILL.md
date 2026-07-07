# Job Application Skill

Use this skill only after a job has passed the CareerOS approval gate.

## Gate

Before generating any application artifact, verify:

1. The job exists in `data/jobs_normalized.json`.
2. The job has a numeric `score_fit`.
3. The job recommendation is `apply` or `maybe`.
4. The job state is `ready_to_apply`.

The CLI gate is:

```bash
career-os approve <job_id>
career-os apply <job_id>
```

## Writing Rules

- Do not invent experience.
- Do not exaggerate fit.
- Connect real profile evidence to job requirements.
- Explain any CV changes.
- Prefer direct, specific writing over generic cover-letter language.

Phase 1 creates only a gated workspace. Full CV, cover letter, and interview prep are later-phase work.
