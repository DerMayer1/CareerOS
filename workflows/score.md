# Workflow: Score

```bash
career-os extract
career-os score
```

Scoring should happen after deterministic normalization, dedupe, and extraction. AI-assisted scoring can be added later, but the baseline must remain explainable and runnable locally.

The scorer writes:

- component scores for skills, experience, salary, remote fit, company quality, growth, application friction, and risk
- `score_explanation`
- `recommendation`
- compact notes used by CSV exports

Blocking red flags, incompatible remote setup, salary below minimum, and high risk can force `skip`.
