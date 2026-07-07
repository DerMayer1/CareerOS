# Sources

Remote source connectors belong to Phase 2.

Phase 1 accepts imported files only:

- JSON
- JSONL
- CSV

Every future connector should write raw payloads to `data/jobs_raw.jsonl` and then reuse the same normalization, dedupe, scoring, and reporting pipeline.
