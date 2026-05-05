---
name: production-readiness
description: Assess production readiness for deployable software. Use when Easy Wins analyzes deployment readiness, release hardening, reliability, operational risk, rollback plans, observability, configuration, CI/CD, security basics, or production launch blockers.
---

# Production Readiness

Use this skill to turn release readiness into concrete, low-drama next steps. Prefer evidence from files, scripts, CI config, docs, tests, and deployment targets over generic advice.

## Checks

- Confirm there is a reproducible build, test command, type/lint gate when applicable, dependency lockfile, and documented local setup.
- Check CI runs the same verification commands developers use locally.
- Check release configuration is documented: required environment variables, secrets, build artifacts, install steps, migration steps, and rollback path.
- Check operational basics: health endpoint or launch smoke test, error logging, crash reporting, backups for stateful systems, and a clear owner for release failures.
- Check security basics: no committed secrets, dependency hygiene, least-privilege tokens, production-safe debug settings, and documented privacy/data handling.
- Check distribution packaging for the selected profile before recommending Docker, app stores, installers, or web deployment.

## Easy Wins

- Prefer one small readiness improvement that can be verified in under an hour.
- Good wins include adding a release checklist, documenting env vars, adding a smoke test, wiring CI to build/test, adding a health check, or documenting rollback.
- Avoid suggesting infrastructure rewrites, cloud migrations, or new platforms that are not in the selected analysis profile.

## Output Guidance

- Tie every recommendation to a detected gap and likely file.
- Mark mature projects as ready when evidence is present; do not invent blockers.
- For Production-ready projects, focus on auditability and release confidence rather than lowering the score for missing optional tooling.
