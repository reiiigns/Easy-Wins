# Project Tracker

A local tool that analyzes any project directory and generates an easy-to-read dashboard showing project stage, completion percentages, what's working, what needs fixing, and next easy wins.

## Features

- **Directory scanning** — Scans file trees, README/docs, package/config files, TODO/FIXME/HACK comments, git status, recent commits, dependency files, and source file structure
- **Offline AI analysis** — Uses a local llama.cpp GGUF model when configured, with OpenAI and local heuristics as optional fallbacks
- **Visual dashboard** — Dark, clean UI with progress bars, radar chart, score cards, and actionable recommendations
- **No API key required** — Works offline with local llama.cpp or out of the box with heuristic analysis; OpenAI integration is optional
- **Single command to run** — `npm run dev` starts both frontend and backend

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Backend:** Express + TypeScript + fast-glob + simple-git
- **AI (optional):** Local llama.cpp GGUF model, OpenAI GPT-4o-mini API, or heuristic analysis

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- (Optional) llama.cpp `llama-server` executable and a sub-2GB GGUF instruct model for offline AI analysis
- (Optional) OpenAI API key for cloud fallback analysis

### Installation

```bash
# Clone or download the project, then:
npm install

# (Optional) Set up local/offline AI or OpenAI fallback
cp .env.example .env
# Edit .env and add LLAMA_CPP_SERVER_PATH + LOCAL_LLM_MODEL_PATH
```

### Development

```bash
# Start both frontend (port 3000) and backend (port 3001)
npm run dev
```

Then open http://localhost:3000 in your browser.

### Production Build

```bash
# Build both frontend and backend
npm run build

# Start production server
npm start
```

The production server serves the built frontend from `dist/` and runs the API on port 3001 (or `PORT` env var).

## API

### POST /api/analyze

Analyzes a project directory and returns a comprehensive report.

**Request:**
```json
{
  "projectPath": "/absolute/path/to/your/project"
}
```

**Response:** A `ProjectReport` object containing:
- `projectName` — detected project name
- `purpose` — inferred project purpose
- `techStack` — detected technologies
- `stage` — Concept / Prototype / MVP / Beta / Production-ready
- `scores` — completion percentages (overall + 7 categories)
- `working` — what's currently working
- `needsFixing` — issues found with severity and suggested fixes
- `nextEasyWins` — high-impact, quick tasks
- `todayPlan` — top 3 things to do today
- `trackerTable` — progress tracker by area
- `buildOrder` — suggested development order
- `risks` — identified risks and blockers

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `ANALYZER_PROVIDER` | Analyzer mode: `auto`, `local`, `openai`, or `heuristics` | `auto` |
| `LOCAL_LLM_ENABLED` | Enables the managed local llama.cpp provider | `true` |
| `LLAMA_CPP_SERVER_PATH` | Absolute path to `llama-server.exe` | (none) |
| `LOCAL_LLM_MODEL_PATH` | Absolute path to a local `.gguf` instruct model | (none) |
| `LOCAL_LLM_MODEL_NAME` | Model label sent to the local chat API | `local-llama-cpp` |
| `LOCAL_LLM_HOST` | Local llama.cpp host | `127.0.0.1` |
| `LOCAL_LLM_PORT` | Local llama.cpp port | `8081` |
| `LOCAL_LLM_CTX_SIZE` | llama.cpp context size | `4096` |
| `LOCAL_LLM_TIMEOUT_MS` | Per-request local LLM timeout | `90000` |
| `LOCAL_LLM_STARTUP_TIMEOUT_MS` | llama.cpp startup wait timeout | `120000` |
| `LOCAL_LLM_MAX_TOKENS` | Maximum local LLM response tokens | `2200` |
| `LOCAL_LLM_TEMPERATURE` | Local LLM sampling temperature | `0.1` |
| `OPENAI_API_KEY` | OpenAI API key for optional fallback analysis | (none, uses local/heuristics) |
| `PORT` | Express server port | 3001 |
| `NODE_ENV` | Environment mode | development |

## Project Structure

```
.
├── src/                     # React frontend
│   ├── App.tsx              # Main dashboard
│   ├── components/          # UI components (ProgressBar, ScoreRing)
│   ├── services/api.ts      # API client
│   ├── types/report.ts      # TypeScript types
│   └── ...
├── server/                  # Express backend
│   ├── index.ts             # Server entry
│   ├── routes/analyze.ts    # Analysis API route
│   ├── services/
│   │   ├── scanner.ts       # Directory scanner
│   │   ├── analyzer.ts      # Local llama.cpp + OpenAI + heuristic analyzer
│   │   ├── localLlm.ts      # Managed llama.cpp provider
│   │   └── promptBuilder.ts # LLM prompt builder
│   └── types/report.ts      # TypeScript types
├── .env.example             # Example environment config
├── package.json
└── README.md
```

## What Gets Scanned

The scanner collects:
- File tree (depth 3, top 60 entries)
- `package.json` — dependencies, scripts
- README files (first 2000 chars)
- Config files — webpack, vite, tsconfig, eslint, prettier, docker, CI/CD, etc.
- Source file counts by type
- TODO/FIXME/HACK comments (up to 30 items)
- Git info — branch, commits, uncommitted changes
- Approximate lines of code
- Test file detection
- CI/CD and Docker detection

### Ignored Directories

`node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `vendor`, `.turbo`, `.cache`, `out`, `target`, `bin`, `obj`

## License

MIT
