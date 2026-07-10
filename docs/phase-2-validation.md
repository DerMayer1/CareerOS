# Phase 2 Validation

Provider execution now includes bounded retries, a 20-second request timeout, five-redirect limit, a 5 MB response limit, concurrent `search all`, per-source failure isolation, stale-cache fallback, and bounded cache retention.

Date: 2026-07-07

## Commands

```bash
node --check src/cli.js
node bin/career-os.js sources list
node bin/career-os.js search remotive --query "python" --limit 2 --dry-run --no-cache
node bin/career-os.js search jobicy --query "python" --limit 2 --dry-run --no-cache
node bin/career-os.js search remoteok --query "python" --limit 2 --dry-run --no-cache
node bin/career-os.js search wwr --query "python" --limit 2 --dry-run --no-cache
node bin/career-os.js search all --query "AI Engineer" --limit 2 --no-cache
node bin/career-os.js normalize
node bin/career-os.js dedupe
node bin/career-os.js score
node bin/career-os.js report
node bin/career-os.js status
```

## Result

The public API/RSS connectors returned remote jobs and wrote raw jobs into `data/jobs_raw.jsonl`.

The full pipeline completed with:

- raw jobs: 6
- normalized jobs: 6
- scored jobs: 6
- recommendations: `watch` and `skip`

No top match was promoted because the candidate profile still contains placeholders, so skill coverage is intentionally low.

## Manual Sources

The following sources are configured as manual search links only:

- `wellfound`
- `indeed_br`
- `glassdoor_br`

They print search URLs and do not write synthetic rows into `data/jobs_raw.jsonl`.
