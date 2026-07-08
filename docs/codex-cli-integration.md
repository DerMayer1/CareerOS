# Codex CLI Integration

CareerOS integrates Codex CLI through `career-os ai ...` and the provider module `src/ai/codex-cli-provider.js`.

The deterministic pipeline remains responsible for import, normalization, dedupe, scoring, reporting, approvals, and tracker state. Codex is used only where language judgment helps.

## Configuration

```json
{
  "provider": "codex-cli",
  "enabled": true,
  "command": "codex",
  "model": "",
  "sandbox": "workspace-write",
  "approval": "never",
  "output_dir": "outputs/ai",
  "web_search": false,
  "timeout_ms": 300000
}
```

## Commands

- `career-os ai doctor`
- `career-os ai profile-sync [--dry-run]`
- `career-os ai extract <job_id|new> [--limit 5] [--dry-run]`
- `career-os ai review-fit <job_id> [--dry-run]`
- `career-os ai summarize-report [--dry-run]`
- `career-os ai draft <application_id|job_id> [--dry-run]`
- `career-os ai review-draft <application_id|job_id> [--dry-run]`
- `career-os ai interview <application_id|job_id> [--dry-run]`

## Safety Model

- Every command writes the prompt to `outputs/ai`.
- Codex responses are saved to `outputs/ai`.
- Application commands also copy the response into the application workspace.
- AI commands do not submit applications, contact employers, schedule meetings, or mutate scored jobs automatically.
- Use `--dry-run` to inspect prompts without spending tokens.

## Implementation Boundary

- `src/cli.js` builds task-specific prompts and enforces CareerOS gates.
- `src/ai/codex-cli-provider.js` runs `codex exec`, writes prompt/output artifacts, and powers `career-os ai doctor`.
