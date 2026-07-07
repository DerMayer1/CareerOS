# Workflow: Remote Search

Remote search is CLI-first:

```bash
career-os sources list
career-os search all --query "AI Engineer" --limit 20
career-os normalize
career-os dedupe
career-os score
career-os report
career-os show top
```

Rules:

- Keep limits small by default.
- Prefer public APIs and RSS feeds.
- Write raw source payloads before normalization.
- Do not score inside connectors.
- Use `--dry-run` before adding a new source or broad query.
- Manual sources such as Wellfound, Indeed Brazil, and Glassdoor Brazil generate search URLs only. Do not fabricate rows from search-result pages.
