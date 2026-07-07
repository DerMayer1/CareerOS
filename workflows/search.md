# Workflow: Search

Use the CLI as the operational surface:

```bash
career-os import ./jobs.json
career-os normalize
```

Search connectors should write raw source payloads to `data/jobs_raw.jsonl` and leave scoring to the next workflow.
