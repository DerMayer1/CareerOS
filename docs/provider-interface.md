# Provider Interface

CareerOS source connectors live behind `src/sources/providers.js`.

The CLI should not branch per source. It should call:

```js
searchProvider(name, sourceConfig, { query, limit, flags })
```

Each provider returns normalized raw job payloads suitable for `data/jobs_raw.jsonl`. Final CareerOS normalization still happens later through `career-os normalize`.

## Provider Contract

A provider must expose a `search(source, query, limit)` function through the registry.

Returned jobs should include, when available:

- `source_site`
- `id`
- `title`
- `company`
- `location`
- `publication_date`
- `source_url`
- `apply_url`
- `salary`
- `description`
- `raw_source`

## Current Providers

- `remotive`
- `jobicy`
- `remoteok`
- `wwr`

Manual sources such as Wellfound, Indeed Brazil, and Glassdoor Brazil do not have automated providers. They use `buildManualSearchUrl()` and print review URLs only.

## Rules

- Keep provider code source-specific.
- Do not score inside providers.
- Do not fabricate job rows from manual search pages.
- Keep raw source payloads in `raw_source`.
- Prefer public APIs and RSS feeds over scraping.
