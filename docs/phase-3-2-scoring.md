# Phase 3.2 Scoring

Phase 3.2 replaces the basic fit score with deterministic multidimensional scoring.

## Components

- `score_skills`
- `score_experience`
- `score_salary`
- `score_remote`
- `score_company`
- `score_growth`
- `score_application_friction`
- `score_risk`

Each scored job also gets `score_explanation`.

## Recommendation Rules

- Blocking red flags force `skip`.
- Very low remote, salary, or risk score can force `skip`.
- Low skill coverage cannot become `apply` or `maybe`; it becomes `watch` at best.
- Strong score with compatible salary, remote setup, and risk can become `apply`.

## Salary

Salary normalization handles:

- hourly, weekly, monthly, and yearly periods
- `k` ranges such as `100k-150k`
- USD, EUR, GBP, and BRL
- estimated ranges, OTE, equity, and single-value notes
