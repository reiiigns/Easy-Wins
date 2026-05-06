import assert from "node:assert/strict";
import test from "node:test";
import type { ScanSummary } from "../server/types/report";

test("heuristic analyzer can award mature production signals", async () => {
  process.env.ANALYZER_PROVIDER = "heuristics";
  const { analyzeProject } = await import("../server/services/analyzer");
  const summary = createMatureSummary();
  const report = await analyzeProject(summary);

  assert.equal(report.stage, "Production-ready");
  assert.equal(report.needsFixing.length, 0);
  assert.equal(report.nextEasyWins.length, 0);
  assert.deepEqual(report.scores, {
    overall: 100,
    coreFunctionality: 100,
    uiUxPolish: 100,
    codeQuality: 100,
    stabilityBugs: 100,
    performance: 100,
    documentation: 100,
    deploymentReadiness: 100,
  });
});

test("heuristic analyzer gives concrete UI UX polish guidance for nested apps", async () => {
  process.env.ANALYZER_PROVIDER = "heuristics";
  const { analyzeProject } = await import("../server/services/analyzer");
  const summary = createMatureSummary();
  summary.projectPath = "/workspace";
  summary.packageJson = {
    name: "workspace-root",
    scripts: {},
    dependencies: {},
    devDependencies: {},
  };
  summary.srcFiles = [
    "app/src/main.tsx",
    "app/src/App.tsx",
    "app/src/accessibility-checklist.ts",
    "app/src/components/Dashboard.tsx",
    "app/src/components/ProgressBar.tsx",
    "app/src/components/ScoreRadar.tsx",
  ];
  summary.configFiles = [
    "app/components.json",
    "app/postcss.config.js",
    "app/tailwind.config.js",
  ];
  summary.fileTypeCounts = {
    ".css": 1,
    ".ts": 2,
    ".tsx": 5,
  };
  summary.readmeContent = [
    "# Project Tracker",
    "WCAG keyboard focus states are reviewed.",
    "The dashboard includes responsive layout, mobile checks, and empty states.",
  ].join("\n");

  const report = await analyzeProject(summary);
  const uiRow = report.trackerTable.find(row => row.area === "UI/UX Polish");

  assert.ok(report.scores.uiUxPolish >= 80);
  assert.equal(uiRow?.nextAction, "Audit mobile layout, empty states, focus rings, and chart readability");
});

test("heuristic today plan uses polished completion wording", async () => {
  process.env.ANALYZER_PROVIDER = "heuristics";
  const { analyzeProject } = await import("../server/services/analyzer");
  const summary = createMatureSummary();
  delete summary.packageJson?.devDependencies["@axe-core/playwright"];
  summary.analysisProfile = {
    platforms: ["Web"],
    osTargets: [],
    accessibilityStandards: ["WCAG 2.2 AA"],
    publishingTargets: [],
  };

  const report = await analyzeProject(summary);

  assert.equal(report.todayPlan[0]?.task, "Add a focused WCAG 2.2 AA pass for keyboard flow, labels, contrast, and focus states.");
  assert.equal(report.todayPlan[0]?.successLooksLike, "Add a focused WCAG 2.2 AA pass for keyboard flow, labels, contrast, and focus states is completed and committed");
});

test("enterprise readiness focus adds enterprise guidance without changing solo default", async () => {
  process.env.ANALYZER_PROVIDER = "heuristics";
  const { analyzeProject } = await import("../server/services/analyzer");
  const soloSummary = createMatureSummary();
  const enterpriseSummary = createMatureSummary();
  enterpriseSummary.analysisProfile = {
    platforms: ["Web", "Server/API"],
    osTargets: [],
    readinessFocuses: ["Enterprise Readiness"],
    accessibilityStandards: ["WCAG 2.2 AA"],
    publishingTargets: ["GitHub release"],
  };

  const soloReport = await analyzeProject(soloSummary);
  const enterpriseReport = await analyzeProject(enterpriseSummary);

  assert.equal(soloReport.trackerTable.some(row => row.area === "Enterprise Readiness"), false);
  assert.equal(enterpriseReport.trackerTable.some(row => row.area === "Enterprise Readiness"), true);
  assert.ok(enterpriseReport.needsFixing.some(issue => issue.problem.includes("policy") || issue.problem.includes("audit")));
  assert.ok(enterpriseReport.nextEasyWins.some(win => win.task.includes("enterprise") || win.task.includes("policy") || win.task.includes("audit")));
});

function createMatureSummary(): ScanSummary {
  const srcFiles = [
    "src/main.tsx",
    "src/App.tsx",
    "src/components/Dashboard.tsx",
    "server/routes/analyze.ts",
    "server/services/scanner.ts",
    "server/services/analyzer.ts",
    ...Array.from({ length: 70 }, (_, index) => `src/components/ui/component-${index}.tsx`),
  ];

  return {
    projectPath: "/workspace/app",
    projectName: "mature-app",
    fileCount: 120,
    dirCount: 18,
    fileTree: "src/\nserver/\ntests/",
    topLevelFiles: [".env.example", ".dockerignore", "Dockerfile", "README.md", "package-lock.json", "package.json"],
    packageJson: {
      name: "mature-app",
      scripts: {
        build: "npm run build:client && npm run build:server",
        start: "NODE_ENV=production node dist/server/index.js",
        test: "node --test",
        lint: "eslint .",
        format: "eslint . --fix",
        typecheck: "tsc -b",
      },
      dependencies: {
        "@radix-ui/react-dialog": "^1.0.0",
        express: "^5.0.0",
        "lucide-react": "^1.0.0",
        react: "^19.0.0",
        recharts: "^2.0.0",
      },
      devDependencies: {
        "@axe-core/playwright": "^4.0.0",
        eslint: "^9.0.0",
        tailwindcss: "^3.0.0",
        typescript: "^5.0.0",
        vite: "^7.0.0",
      },
    },
    readmeContent: [
      "# Mature App",
      "Features and installation guidance for collaborators.",
      "## Quick Start",
      "## Development",
      "## Production Build",
      "## API",
      "## Configuration",
      "## Project Structure",
      "## What Gets Scanned",
      "x".repeat(2200),
    ].join("\n"),
    configFiles: [
      ".github/workflows/ci.yml",
      "Dockerfile",
      "eslint.config.js",
      "postcss.config.js",
      "tailwind.config.js",
      "tsconfig.json",
      "vite.config.ts",
    ],
    srcFiles,
    fileTypeCounts: {
      ".css": 2,
      ".ts": 12,
      ".tsx": 68,
    },
    todoComments: [],
    gitInfo: {
      isGitRepo: true,
      branch: "main",
      commitCount: 25,
      lastCommit: "abc1234 - release prep",
      recentCommits: ["abc1234 - release prep"],
      hasUncommittedChanges: false,
      modifiedFiles: [],
    },
    totalLinesOfCode: 12000,
    dependencyCount: 8,
    hasTests: true,
    testFileCount: 12,
    hasCiCd: true,
    hasDocker: true,
  };
}
