# Codex CLI Integration

CareerOS integrates Codex CLI through `career-os ai ...` and the provider module `src/ai/codex-cli-provider.js`.

The deterministic pipeline remains responsible for import, normalization, dedupe, scoring, reporting, approvals, and tracker state. Codex is used only where language judgment helps.

## Configuration

```json
{
  "provider": "codex-cli",
  "enabled": false,
  "command": "codex",
  "model": "",
  "sandbox": "read-only",
  "approval": "never",
  "output_dir": "outputs/ai",
  "web_search": false,
  "timeout_ms": 300000,
  "max_prompt_chars": 120000,
  "max_output_chars": 120000
}
```

AI is disabled and read-only by default. To opt into `workspace-write`, set both `sandbox` to `workspace-write` and `allow_workspace_write` to `true`. `danger-full-access`, shell metacharacters in the configured command, paths outside the workspace, and oversized prompts or outputs are rejected.

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
- Fenced profile, job, report, and workspace content is labeled as untrusted data; instructions found inside it must not be followed.
- Prompt and response files are written atomically and kept inside the configured workspace output directory.
- Use `--dry-run` to inspect prompts without spending tokens.

## Implementation Boundary

- `src/cli.js` builds task-specific prompts and enforces CareerOS gates.
- `src/ai/codex-cli-provider.js` runs `codex exec`, writes prompt/output artifacts, and powers `career-os ai doctor`.
