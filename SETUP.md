# Setup

## Prerequisites

- Node.js 18 or newer.
- No database is required.
- No Claude Code dependency is required.

## First Run

```bash
node bin/career-os.js init
node bin/career-os.js profile setup
node bin/career-os.js profile check
node bin/career-os.js doctor
```

The profile wizard writes the candidate profile, role preferences, search roles, regions, timezone, and salary thresholds. For non-interactive setup:

```bash
career-os profile setup --yes --name "Your Name" --location "Brazil" --timezone "America/Sao_Paulo" --roles "AI Engineer,Backend Engineer" --skills "python,typescript" --regions "LATAM,Worldwide" --salary-min 4000 --salary-target 7000 --contract-types "contractor,full-time"
```

Run `career-os doctor --network` when you also want DNS checks for configured sources. Use `--strict` to make incomplete profile or network warnings return a failing exit code.

## Run The Local Pipeline

```bash
node bin/career-os.js import examples/jobs.sample.json
node bin/career-os.js normalize
node bin/career-os.js dedupe
node bin/career-os.js extract
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

## Troubleshooting

CareerOS prints concise errors by default. Add `--verbose` to any command for a stack trace, or `--json-errors` for machine-readable failures.
