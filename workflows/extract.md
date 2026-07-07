# Workflow: Extract

Deterministic extraction prepares jobs for scoring.

```bash
career-os extract
career-os show extracted
```

Inputs:

- `data/jobs_normalized.json`
- `profile/candidate-profile.json`
- `profile/skill-taxonomy.json`

Outputs written back to each normalized job:

- `requirements_required`
- `requirements_nice_to_have`
- `matched_requirements`
- `partial_matches`
- `missing_requirements`
- `extracted_signals`
- updated `red_flags`

This phase does not use AI. It uses dictionaries and regex so the scoring inputs remain auditably deterministic.
