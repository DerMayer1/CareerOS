# Scoring Rules

The baseline score is deterministic:

```text
score_fit =
  skills * 0.30 +
  experience * 0.20 +
  salary * 0.15 +
  remote_compatibility * 0.15 +
  company_quality * 0.10 +
  growth_potential * 0.05 +
  application_friction * 0.05
```

Recommendations:

- `apply`: strong score, compatible salary and remote setup.
- `maybe`: medium score or incomplete information worth review.
- `watch`: interesting but not ready for application.
- `skip`: blocked by salary, remote restrictions, eligibility, or red flags.
