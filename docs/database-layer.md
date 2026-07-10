# Database Layer

CareerOS now uses a storage interface for local data access.

Current backend:

- `src/storage/file-store.js`
- JSONL for raw imported jobs
- JSON for normalized jobs, seen state, and source cache
- CSV for application tracker
- JSON Schemas under `schemas/` for the public data contracts
- Atomic replace-on-success writes for state and generated artifacts

The CLI should call the store instead of reading or writing `data/*` files directly.

## Store Responsibilities

- `readRawJobs()`
- `appendRawJobs(jobs, meta)`
- `readNormalizedJobs()`
- `writeNormalizedJobs(jobs)`
- `readSeenJobs()`
- `writeSeenJobs(data)`
- `updateSeenJobs(jobs)`
- `readSourceCache()`
- `writeSourceCache(cache)`
- `readApplications()`
- `writeApplications(rows)`
- `resetData()`

## Migration Path

The next backend can be SQLite without changing command handlers:

1. Add a `sqlite-store` with the same public methods.
2. Add schema migrations for jobs, raw imports, seen state, source cache, and applications.
3. Keep JSONL/CSV export commands for portability.
4. Move reports and tables to generated outputs only, not authoritative storage.

## Boundaries

Configuration and profile files remain plain local files for now. They are operator-owned inputs, not database records.
Runtime validators reject malformed jobs, tracker rows, scoring weights, search profiles, source configuration, candidate profiles, and AI configuration before those values reach critical operations.
