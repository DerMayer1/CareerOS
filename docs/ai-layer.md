# AI Layer

CareerOS uses an AI provider boundary for Codex CLI integration.

Current provider:

- `src/ai/codex-cli-provider.js`

The CLI remains responsible for deciding when an AI task is allowed and for building CareerOS-specific prompts. The provider is responsible for:

- reading AI execution config through the injected config reader
- writing prompt artifacts
- invoking `codex exec`
- writing final response artifacts
- probing Codex CLI availability for `career-os ai doctor`

## Provider Methods

```js
doctor()
runPrompt(label, prompt, flags)
```

## Boundaries

- `src/cli.js` owns command gates, job/application context, and prompt content.
- `src/ai/codex-cli-provider.js` owns process execution and Codex CLI flags.
- AI output remains reviewable Markdown under `outputs/ai`.
- Application AI output may be copied into approved application workspaces.
- The provider must not submit applications, contact employers, mutate scores, or update tracker state by itself.

## Future Providers

Additional providers can use the same boundary:

- local mock provider for tests
- OpenAI API provider
- offline/no-op provider for fully deterministic runs

The command surface should stay `career-os ai ...` regardless of provider.
