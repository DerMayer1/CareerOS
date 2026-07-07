# Sources

Remote source connectors are implemented in Phase 2.

Configured sources live in `config/sources.json`.

Current sources:

- `remotive`
- `jobicy`
- `remoteok`
- `wwr`
- `wellfound` manual search link
- `indeed_br` manual search link
- `glassdoor_br` manual search link
- `linkedin` disabled by default

Usage:

```bash
career-os sources list
career-os search remotive --query "AI Engineer" --limit 10
career-os search all --query "backend" --limit 25
career-os search wellfound --query "AI Engineer"
career-os search indeed_br --query "Python Developer"
career-os search glassdoor_br --query "Backend Engineer"
```

API/RSS connectors write raw payloads to `data/jobs_raw.jsonl` and then reuse the same normalization, dedupe, scoring, and reporting pipeline.

Manual search sources print a search URL and do not write fake job rows. Use them to inspect results and then import selected jobs via JSON, JSONL, or CSV.

Use `--dry-run` to inspect remote results without writing data.
