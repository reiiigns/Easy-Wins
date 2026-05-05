import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { ProjectReport, ScanSummary } from "../server/types/report";
import {
  appendEasyWinsHistory,
  writeEasyWinsMetadata,
} from "../server/services/easyWinsMetadata";

test("writeEasyWinsMetadata creates metadata, history, and agent notes", async () => {
  const project = await fs.mkdtemp(path.join(os.tmpdir(), "easywins-meta-"));

  try {
    const report = createReport();
    const summary = createSummary(project);

    const metadata = await writeEasyWinsMetadata(project, report, summary);
    const metadataPath = path.join(project, ".easywins", "metadata.json");
    const historyPath = path.join(project, ".easywins", "history.jsonl");
    const notesPath = path.join(project, ".easywins", "agent-notes.md");
    const stored = JSON.parse(await fs.readFile(metadataPath, "utf-8"));

    assert.equal(metadata.project.name, "fixture-app");
    assert.equal(stored.project.name, "fixture-app");
    assert.equal(stored.analysis.overallScore, 72);
    assert.equal(stored.activeWin.task, "Add a smoke test");
    assert.match(stored.analysis.analyzedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(await fs.readFile(historyPath, "utf-8"), "");
    assert.match(await fs.readFile(notesPath, "utf-8"), /Add a smoke test/);
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

test("writeEasyWinsMetadata preserves existing history", async () => {
  const project = await fs.mkdtemp(path.join(os.tmpdir(), "easywins-history-"));

  try {
    await appendEasyWinsHistory(project, {
      timestamp: "2026-05-05T00:00:00.000Z",
      event: "session-complete",
      summary: "Finished a small refactor",
      changedFiles: ["src/App.tsx"],
    });

    await writeEasyWinsMetadata(project, createReport(), createSummary(project));

    const history = await fs.readFile(path.join(project, ".easywins", "history.jsonl"), "utf-8");
    assert.match(history, /Finished a small refactor/);
    assert.match(history, /src\/App\.tsx/);
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

function createReport(): ProjectReport {
  return {
    projectName: "fixture-app",
    purpose: "Exercise metadata persistence",
    techStack: ["TypeScript"],
    stage: "MVP",
    summary: "A fixture project",
    scores: {
      overall: 72,
      coreFunctionality: 80,
      uiUxPolish: 70,
      codeQuality: 75,
      stabilityBugs: 65,
      performance: 80,
      documentation: 60,
      deploymentReadiness: 70,
    },
    working: [],
    needsFixing: [],
    nextEasyWins: [{
      task: "Add a smoke test",
      whyItMatters: "It protects the main workflow.",
      difficulty: "Easy",
      estimatedTime: "30 min",
      filesLikelyInvolved: ["tests/smoke.test.ts"],
    }],
    accessibilityStandards: [{
      standard: "WCAG 2.2 AA",
      status: "Needs work",
      issue: "No accessibility pass recorded.",
      nextStep: "Add a keyboard and contrast pass.",
      filesLikelyInvolved: ["src/App.tsx"],
    }],
    publishingReadiness: [{
      target: "GitHub release",
      status: "Needs work",
      requirement: "Release notes and artifacts.",
      nextStep: "Add a GitHub release checklist.",
      filesLikelyInvolved: ["README.md"],
    }],
    buildOrder: [],
    risks: [],
    todayPlan: [{
      task: "Review the test harness",
      filesToOpen: ["package.json"],
      successLooksLike: "The test command is understood",
    }],
    trackerTable: [],
    confidence: "High",
    analysisProfile: {
      platforms: ["Web"],
      osTargets: [],
      accessibilityStandards: ["WCAG 2.2 AA"],
      publishingTargets: ["GitHub release"],
      notes: "",
    },
  };
}

function createSummary(projectPath: string): ScanSummary {
  return {
    projectPath,
    projectName: "fixture-app",
    fileCount: 8,
    dirCount: 3,
    fileTree: "src/",
    topLevelFiles: ["package.json"],
    configFiles: ["package.json"],
    srcFiles: ["src/index.ts"],
    fileTypeCounts: { ".ts": 1 },
    todoComments: [],
    gitInfo: {
      isGitRepo: true,
      branch: "main",
      commitCount: 3,
      lastCommit: "abc1234 - test",
      recentCommits: ["abc1234 - test"],
      hasUncommittedChanges: false,
      modifiedFiles: [],
    },
    totalLinesOfCode: 20,
    dependencyCount: 0,
    hasTests: true,
    testFileCount: 1,
    hasCiCd: false,
    hasDocker: false,
    analysisProfile: {
      platforms: ["Web"],
      osTargets: [],
      accessibilityStandards: ["WCAG 2.2 AA"],
      publishingTargets: ["GitHub release"],
      notes: "",
    },
  };
}
