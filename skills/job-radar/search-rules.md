# Search Rules

Phase 1 does not scrape. It imports manual job files:

- JSON array
- JSON object
- JSONL
- CSV

Connectors belong to Phase 2. When added, connectors must write raw source payloads to `data/jobs_raw.jsonl` and allow the same normalization pipeline to run afterward.
