# Setup

## Prerequisites

- Node.js 18 or newer.
- No database is required for Phase 1.
- No Claude Code dependency is required.

## First Run

```bash
node bin/career-os.js init
node bin/career-os.js profile check
```

Then edit:

- `profile/candidate-profile.md`
- `profile/role-preferences.md`
- `config/search_profile.json`
- `config/scoring_weights.json`

## Run The Local Pipeline

```bash
node bin/career-os.js import examples/jobs.sample.json
node bin/career-os.js normalize
node bin/career-os.js dedupe
node bin/career-os.js score
node bin/career-os.js report
node bin/career-os.js show top
```

Or as a single command:

```bash
node bin/career-os.js run examples/jobs.sample.json
```

## Application Gate

Applications are blocked until a job is scored and approved:

```bash
node bin/career-os.js approve <job_id>
node bin/career-os.js apply <job_id>
```
