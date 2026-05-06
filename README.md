# Easy Wins Project Tracker

Local project analysis for builders who want a clear answer to: "What should I work on next?"

[![CI](https://github.com/reiiigns/project-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/reiiigns/project-tracker/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-20232a?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-20232a?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7-20232a?logo=vite)
![License](https://img.shields.io/badge/license-MIT-20232a)

Easy Wins scans a local project folder, reads its code and docs, and returns a practical dashboard with project stage, completion scores, risks, readiness checks, and the next small useful task. It is designed for local-first development: use the heuristic analyzer immediately, connect a local llama.cpp model for offline AI, or opt into OpenAI analysis when configured.

## What It Does

- Scans project structure, docs, package files, source counts, TODOs, git status, tests, CI, Docker, and release signals.
- Scores project health across core functionality, UI polish, code quality, stability, performance, documentation, and deployment readiness.
- Generates a short "today plan" with file-level starting points.
- Supports analysis profiles for web, desktop, mobile, server/API, CLI, games, accessibility, and publishing targets.
- Writes local `.easywins/` metadata so agents and humans can pick up the project context later.
- Runs as a Vite + React dashboard with an Express API, plus optional Electron packaging.

## Current Readiness

| Area | Status |
| --- | --- |
| App stage | Production-ready local tool |
| Tests | Node test runner suite in `app/tests/` |
| Build | Vite client build and TypeScript server build |
| Accessibility | WCAG 2.2 AA pass documented in `app/docs/accessibility.md` |
| Release | GitHub release checklist documented in `app/docs/release-checklist.md` |
| CI | GitHub Actions workflow at `.github/workflows/ci.yml` |

## Quick Start

```bash
cd app
npm ci
npm run dev
```

Open [http://localhost:3000/site](http://localhost:3000/site).

The API runs on [http://localhost:3001](http://localhost:3001), and the Vite dev server proxies `/api` requests to it.

## Validation

Run these from `app/`:

```bash
npm run typecheck
npm test
npm run build
```

The GitHub workflow runs `npm ci`, lint, typecheck, build, tests, and Docker build from the app directory.

## Analyzer Modes

| Mode | Use When |
| --- | --- |
| Heuristics | You want a fast, no-key baseline analysis. |
| Local llama.cpp | You want offline AI analysis with a local GGUF model. |
| OpenAI | You want cloud fallback analysis with an OpenAI API key. |

Configuration lives in `app/.env.example`.

## Release Checklist

Before publishing a GitHub release:

- Update `app/package.json` version.
- Add release notes to `app/CHANGELOG.md`.
- Run `npm run typecheck`, `npm test`, and `npm run build` from `app/`.
- Build desktop artifacts with `npm run electron:build` when shipping an installer.
- For macOS releases, complete code signing and notarization before publishing DMG or ZIP artifacts.
- For Linux releases, verify AppImage/deb packaging, desktop metadata, icon rendering, and install instructions.
- Attach release artifacts and checksums where applicable.
- Confirm WCAG notes, keyboard flow, labels, focus states, and reduced-motion behavior are still current.

The full release checklist is in [app/docs/release-checklist.md](app/docs/release-checklist.md).

## Repository Layout

```text
.
├── .github/workflows/ci.yml       # GitHub Actions checks
├── app/                           # Product source
│   ├── src/                       # React dashboard
│   ├── server/                    # Express API and analyzer
│   ├── tests/                     # Node test runner tests
│   ├── docs/                      # Accessibility and release notes
│   └── package.json
├── AGENTS.md                      # Agent workflow guidance
└── README.md                      # GitHub overview
```

## License

MIT
