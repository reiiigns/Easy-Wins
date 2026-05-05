import fs from "fs/promises";
import path from "path";
import type { NextWin, ProjectReport, ScanSummary, TodayTask } from "../types/report.js";

export const EASY_WINS_DIR = ".easywins";
export const METADATA_FILE = "metadata.json";
export const HISTORY_FILE = "history.jsonl";
export const AGENT_NOTES_FILE = "agent-notes.md";

export interface EasyWinsMetadata {
  schemaVersion: 1;
  project: {
    name: string;
    path: string;
    gitBranch: string | null;
    lastCommit: string | null;
    hasUncommittedChanges: boolean;
  };
  analysis: {
    analyzedAt: string;
    source: "api/analyze";
    confidence: ProjectReport["confidence"];
    stage: ProjectReport["stage"];
    overallScore: number;
  };
  analysisProfile?: ScanSummary["analysisProfile"];
  activeWin: NextWin | TodayTask | null;
  nextEasyWins: NextWin[];
  todayPlan: TodayTask[];
  provenance: {
    fileCount: number;
    sourceFileCount: number;
    testFileCount: number;
    hasTests: boolean;
    hasCiCd: boolean;
    hasDocker: boolean;
  };
}

export interface EasyWinsHistoryEntry {
  timestamp: string;
  event: "analysis" | "session-complete" | "win-complete";
  summary: string;
  activeWin?: string;
  changedFiles?: string[];
  score?: number;
}

export async function ensureEasyWinsDir(projectPath: string): Promise<string> {
  const dir = path.join(projectPath, EASY_WINS_DIR);
  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.writeFile(path.join(dir, HISTORY_FILE), "", { flag: "wx" });
  } catch (err) {
    if (!isAlreadyExistsError(err)) throw err;
  }

  return dir;
}

export async function writeEasyWinsMetadata(
  projectPath: string,
  report: ProjectReport,
  scanSummary: ScanSummary
): Promise<EasyWinsMetadata> {
  const dir = await ensureEasyWinsDir(projectPath);
  const metadata = buildMetadata(projectPath, report, scanSummary);

  await fs.writeFile(path.join(dir, METADATA_FILE), `${JSON.stringify(metadata, null, 2)}\n`, "utf-8");
  await fs.writeFile(path.join(dir, AGENT_NOTES_FILE), renderAgentNotes(metadata), "utf-8");

  return metadata;
}

export async function appendEasyWinsHistory(projectPath: string, entry: EasyWinsHistoryEntry): Promise<void> {
  const dir = await ensureEasyWinsDir(projectPath);
  await fs.appendFile(path.join(dir, HISTORY_FILE), `${JSON.stringify(entry)}\n`, "utf-8");
}

function buildMetadata(projectPath: string, report: ProjectReport, scanSummary: ScanSummary): EasyWinsMetadata {
  return {
    schemaVersion: 1,
    project: {
      name: report.projectName,
      path: projectPath,
      gitBranch: scanSummary.gitInfo?.branch || null,
      lastCommit: scanSummary.gitInfo?.lastCommit || null,
      hasUncommittedChanges: Boolean(scanSummary.gitInfo?.hasUncommittedChanges),
    },
    analysis: {
      analyzedAt: new Date().toISOString(),
      source: "api/analyze",
      confidence: report.confidence,
      stage: report.stage,
      overallScore: report.scores.overall,
    },
    analysisProfile: scanSummary.analysisProfile,
    activeWin: pickActiveWin(report),
    nextEasyWins: report.nextEasyWins.slice(0, 5),
    todayPlan: report.todayPlan.slice(0, 5),
    provenance: {
      fileCount: scanSummary.fileCount,
      sourceFileCount: scanSummary.srcFiles.length,
      testFileCount: scanSummary.testFileCount,
      hasTests: scanSummary.hasTests,
      hasCiCd: scanSummary.hasCiCd,
      hasDocker: scanSummary.hasDocker,
    },
  };
}

function pickActiveWin(report: ProjectReport): NextWin | TodayTask | null {
  return (
    report.nextEasyWins.find(win => win.difficulty === "Easy") ||
    report.nextEasyWins[0] ||
    report.todayPlan[0] ||
    null
  );
}

function renderAgentNotes(metadata: EasyWinsMetadata): string {
  const win = metadata.activeWin;
  const task = win?.task || "No active win selected.";
  const startFiles = getStartFiles(win);

  return [
    "# Easy Wins Agent Notes",
    "",
    `Project: ${metadata.project.name}`,
    `Last analyzed: ${metadata.analysis.analyzedAt}`,
    `Overall score: ${metadata.analysis.overallScore}%`,
    `Stage: ${metadata.analysis.stage}`,
    "",
    "## Active Win",
    "",
    task,
    "",
    `Start here: ${startFiles.length > 0 ? startFiles.join(", ") : "open your terminal"}`,
    "",
    "## Agent Ritual",
    "",
    "- At session start, read `.easywins/metadata.json` before choosing work.",
    "- If metadata is missing or stale, run Easy Wins analysis for this project.",
    "- At session finish, append an outcome to `.easywins/history.jsonl` and refresh these notes.",
    "",
  ].join("\n");
}

function getStartFiles(win: NextWin | TodayTask | null): string[] {
  if (!win) return [];
  if ("filesLikelyInvolved" in win) return win.filesLikelyInvolved;
  return win.filesToOpen;
}

function isAlreadyExistsError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "EEXIST";
}
