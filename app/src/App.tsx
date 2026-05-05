import { lazy, Suspense, useState, useEffect } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  Terminal,
  FolderOpen,
  ArrowRight,
  Loader,
  CheckCircle2,
  AlertTriangle,
  Zap,
  BarChart3,
  Target,
  Layers,
  ShieldAlert,
  FileCode,
  Search,
  Braces,
  RefreshCw,
  Trash2,
  Clock3,
  ChevronDown,
  ChevronRight,
  Settings2,
  ShieldCheck,
  Rocket,
  Star,
} from "lucide-react";
import type {
  AccessibilityStandard,
  AnalysisOsTarget,
  AnalysisPlatform,
  AnalysisProfile,
  AnalysisReadinessFocus,
  ProjectReport,
  PublishingTarget,
  Severity,
  Difficulty,
  Priority,
  ProjectStage,
} from "./types/report";
import { analyzeProject, detectAnalysisProfile, selectProjectFolder } from "./services/api";
import ProgressBar from "./components/ProgressBar";
import ScoreRing from "./components/ScoreRing";

const ScoreRadar = lazy(() => import("./components/ScoreRadar"));

// ─── Badge helpers ───────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: ProjectStage }) {
  const styles: Record<ProjectStage, string> = {
    Concept: "bg-purple-900/40 text-purple-300 border-purple-700/30",
    Prototype: "bg-yellow-900/40 text-yellow-300 border-yellow-700/30",
    MVP: "bg-blue-900/40 text-blue-300 border-blue-700/30",
    Beta: "bg-cyan-900/40 text-cyan-300 border-cyan-700/30",
    "Production-ready": "bg-green-900/40 text-green-300 border-green-700/30",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${styles[stage]}`}>
      {stage}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    Low: "bg-green-900/40 text-green-300 border-green-700/30",
    Medium: "bg-yellow-900/40 text-yellow-300 border-yellow-700/30",
    High: "bg-red-900/40 text-red-300 border-red-700/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${styles[severity]}`}>
      {severity}
    </span>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const styles: Record<Difficulty, string> = {
    Easy: "bg-green-900/40 text-green-300 border-green-700/30",
    Medium: "bg-yellow-900/40 text-yellow-300 border-yellow-700/30",
    Hard: "bg-red-900/40 text-red-300 border-red-700/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${styles[difficulty]}`}>
      {difficulty}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const styles: Record<Priority, string> = {
    Low: "bg-green-900/40 text-green-300 border-green-700/30",
    Medium: "bg-yellow-900/40 text-yellow-300 border-yellow-700/30",
    High: "bg-red-900/40 text-red-300 border-red-700/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${styles[priority]}`}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  let style = "bg-gray-900/40 text-gray-300 border-gray-700/30";
  if (status === "In Progress") style = "bg-blue-900/40 text-blue-300 border-blue-700/30";
  if (status === "Complete" || status === "Ready") style = "bg-green-900/40 text-green-300 border-green-700/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${style}`}>
      {status}
    </span>
  );
}

function TechStackTag({ tech }: { tech: string }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border"
      style={{
        backgroundColor: "rgba(139,92,246,0.12)",
        borderColor: "rgba(139,92,246,0.25)",
        color: "#A78BFA",
      }}
    >
      {tech}
    </span>
  );
}

function TimeBadge({ time }: { time: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700">
      {time}
    </span>
  );
}

function CodePill({ file }: { file: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-xs font-mono border border-[var(--border-subtle)]">
      <FileCode size={10} />
      {file}
    </span>
  );
}

const SAVED_ANALYSES_KEY = "project-tracker:saved-analyses";
const ACHIEVEMENTS_KEY = "project-tracker:achievements";
const PLATFORM_OPTIONS: AnalysisPlatform[] = ["Web", "Mobile", "Desktop", "Server/API", "CLI/Tool", "Game"];
const OS_OPTIONS: AnalysisOsTarget[] = ["Android", "iOS", "Linux", "Windows", "macOS"];
const READINESS_FOCUS_OPTIONS: AnalysisReadinessFocus[] = [
  "Solo/Indie",
  "Launch",
  "Accessibility",
  "Publishing",
  "Security",
  "Enterprise Readiness",
];
const ACCESSIBILITY_OPTIONS: AccessibilityStandard[] = [
  "WCAG 2.2 AA",
  "WCAG 2.2 AAA",
  "Section 508",
  "Apple HIG accessibility",
  "Android accessibility",
  "Steam Deck accessibility",
];
const PUBLISHING_OPTIONS: PublishingTarget[] = [
  "Web/PWA",
  "Steam",
  "Apple App Store",
  "Google Play",
  "Microsoft Store",
  "Mac notarized app",
  "Linux package",
  "GitHub release",
];
const DEFAULT_ANALYSIS_PROFILE: AnalysisProfile = {
  platforms: ["Web"],
  osTargets: [],
  readinessFocuses: ["Solo/Indie"],
  accessibilityStandards: ["WCAG 2.2 AA"],
  publishingTargets: ["Web/PWA", "GitHub release"],
  notes: "",
};

const PROFILE_OPTION_HELP: Record<string, string> = {
  "Solo/Indie": "Checks whether the project is practical for a small team or solo builder to maintain and ship.",
  Launch: "Looks for the basics needed before sharing the project with real users.",
  Accessibility: "Reviews how usable the project is for people using keyboards, screen readers, or assistive settings.",
  Publishing: "Checks whether the project has the files and documentation needed for release channels.",
  Security: "Looks for common safety, secrets, dependency, and configuration risks.",
  "Enterprise Readiness": "Reviews whether the project has the governance, support, and compliance signals larger organizations expect.",
  Web: "Use this for browser apps, websites, dashboards, or progressive web apps.",
  Mobile: "Use this for phone or tablet apps.",
  Desktop: "Use this for installed apps on Windows, macOS, or Linux.",
  "Server/API": "Use this for backend services, APIs, workers, or databases.",
  "CLI/Tool": "Use this for command-line tools, local utilities, scripts, or developer tools.",
  Game: "Use this for playable games or interactive game prototypes.",
  Android: "Checks Android-specific release, accessibility, and platform expectations.",
  iOS: "Checks iPhone and iPad release, accessibility, and platform expectations.",
  Linux: "Checks Linux packaging, compatibility, and runtime expectations.",
  Windows: "Checks Windows packaging, installer, and runtime expectations.",
  macOS: "Checks macOS packaging, signing, notarization, and runtime expectations.",
  "WCAG 2.2 AA": "The common web accessibility target for keyboard access, labels, focus states, and readable contrast.",
  "WCAG 2.2 AAA": "A stricter accessibility target with higher contrast and more demanding usability requirements.",
  "Section 508": "Accessibility requirements commonly used for US government and public-sector software.",
  "Apple HIG accessibility": "Apple's accessibility expectations for iOS, iPadOS, and macOS apps.",
  "Android accessibility": "Android accessibility expectations for touch targets, TalkBack, labels, and platform behavior.",
  "Steam Deck accessibility": "Checks whether a game is usable on Steam Deck controls, display, and input constraints.",
  "Web/PWA": "Checks browser deployment, installability, metadata, and web release readiness.",
  Steam: "Checks store page, build, controller, and release expectations for Steam.",
  "Apple App Store": "Checks metadata, platform rules, privacy labels, and submission readiness for Apple's stores.",
  "Google Play": "Checks Android store metadata, policy, signing, and release readiness.",
  "Microsoft Store": "Checks packaging, identity, metadata, and submission readiness for Microsoft Store.",
  "Mac notarized app": "Checks signing and notarization requirements for distributing a macOS app.",
  "Linux package": "Checks whether the app is ready for Linux package distribution.",
  "GitHub release": "Checks whether release notes, artifacts, and repository metadata are ready for GitHub Releases.",
};

interface SavedAnalysis {
  id: string;
  path: string;
  name: string;
  updatedAt: string;
  report: ProjectReport;
  analysisProfile?: AnalysisProfile;
}

interface AchievementAward {
  key?: string;
  title: string;
  details: string;
  points: number;
}

interface AchievementEvent extends AchievementAward {
  id: string;
  projectId: string;
  projectName: string;
  earnedAt: string;
}

interface ProjectAchievementState {
  totalPoints: number;
  events: AchievementEvent[];
  awarded: Record<string, boolean>;
}

interface AchievementState {
  projects: Record<string, ProjectAchievementState>;
}

interface AchievementTier {
  level: number;
  name: string;
  currentAt: number;
  nextAt: number | null;
}

function getAnalysisId(projectPath: string): string {
  return projectPath.trim().replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

function getProjectNameFromPath(projectPath: string): string {
  const cleanPath = projectPath.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
  return cleanPath.split("/").filter(Boolean).pop() || cleanPath || "Untitled Project";
}

function loadSavedAnalyses(): SavedAnalysis[] {
  try {
    const raw = window.localStorage.getItem(SAVED_ANALYSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SavedAnalysis => {
      return Boolean(item?.id && item?.path && item?.name && item?.updatedAt && item?.report);
    });
  } catch {
    return [];
  }
}

function persistSavedAnalyses(items: SavedAnalysis[]): void {
  window.localStorage.setItem(SAVED_ANALYSES_KEY, JSON.stringify(items));
}

function loadAchievementState(): AchievementState {
  try {
    const raw = window.localStorage.getItem(ACHIEVEMENTS_KEY);
    if (!raw) return { projects: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { projects: {} };

    if (parsed.projects && typeof parsed.projects === "object") {
      return { projects: parsed.projects as Record<string, ProjectAchievementState> };
    }

    const events = Array.isArray(parsed.events) ? parsed.events.slice(0, 120) as AchievementEvent[] : [];
    const projects: Record<string, ProjectAchievementState> = {};

    for (const event of events) {
      const projectId = event.projectId || "global";
      const current = projects[projectId] || { totalPoints: 0, events: [], awarded: {} };
      current.totalPoints += typeof event.points === "number" ? event.points : 0;
      current.events.push(event);
      if (event.key) current.awarded[event.key] = true;
      projects[projectId] = current;
    }

    return { projects };
  } catch {
    return { projects: {} };
  }
}

function persistAchievementState(state: AchievementState): void {
  window.localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(state));
}

function emptyProjectAchievements(): ProjectAchievementState {
  return { totalPoints: 0, events: [], awarded: {} };
}

function getProjectAchievements(state: AchievementState, projectId: string | null): ProjectAchievementState {
  if (!projectId) return emptyProjectAchievements();
  return state.projects[projectId] || emptyProjectAchievements();
}

function getAchievementTier(points: number): AchievementTier {
  const tiers = [
    { level: 1, name: "Started", currentAt: 0 },
    { level: 2, name: "Cleaner", currentAt: 100 },
    { level: 3, name: "Builder", currentAt: 250 },
    { level: 4, name: "Stabilizer", currentAt: 500 },
    { level: 5, name: "Release Ready", currentAt: 900 },
    { level: 6, name: "Gold Standard", currentAt: 1400 },
  ];
  const current = tiers.filter(tier => points >= tier.currentAt).at(-1) || tiers[0];
  const next = tiers.find(tier => tier.currentAt > points);

  return {
    ...current,
    nextAt: next?.currentAt || null,
  };
}

function getStarRank(points: number): number {
  if (points >= 900) return 5;
  if (points >= 500) return 4;
  if (points >= 250) return 3;
  if (points >= 100) return 2;
  if (points > 0) return 1;
  return 0;
}

function stageRank(stage: ProjectStage): number {
  const ranks: Record<ProjectStage, number> = {
    Concept: 1,
    Prototype: 2,
    MVP: 3,
    Beta: 4,
    "Production-ready": 5,
  };
  return ranks[stage] || 0;
}

function completedTrackerRows(report: ProjectReport): number {
  return report.trackerTable.filter(row => row.status === "Complete" || row.completionPercent >= 80).length;
}

function buildAchievementAwards(projectId: string, previous: ProjectReport | undefined, next: ProjectReport): AchievementAward[] {
  const awards: AchievementAward[] = [];
  const scoreGain = previous ? next.scores.overall - previous.scores.overall : 0;
  const fixesCleared = previous ? Math.max(0, previous.needsFixing.length - next.needsFixing.length) : 0;
  const winsCleared = previous ? Math.max(0, previous.nextEasyWins.length - next.nextEasyWins.length) : 0;
  const trackerRowsCompleted = previous ? Math.max(0, completedTrackerRows(next) - completedTrackerRows(previous)) : 0;

  awards.push({
    key: `${projectId}:tracked`,
    title: "Project tracked",
    details: "Saved the project analysis.",
    points: 10,
  });

  if (scoreGain > 0) {
    awards.push({
      title: "Score improved",
      details: `Overall completion increased by ${scoreGain} point${scoreGain === 1 ? "" : "s"}.`,
      points: Math.min(100, Math.max(10, scoreGain * 2)),
    });
  }

  if (fixesCleared > 0) {
    awards.push({
      title: "Fixes cleared",
      details: `${fixesCleared} issue${fixesCleared === 1 ? "" : "s"} moved out of Needs Fixing.`,
      points: fixesCleared * 25,
    });
  }

  if (winsCleared > 0) {
    awards.push({
      title: "Easy wins completed",
      details: `${winsCleared} quick win${winsCleared === 1 ? "" : "s"} cleared from the report.`,
      points: winsCleared * 15,
    });
  }

  if (trackerRowsCompleted > 0) {
    awards.push({
      title: "Tracker progress",
      details: `${trackerRowsCompleted} tracker area${trackerRowsCompleted === 1 ? "" : "s"} reached Complete.`,
      points: trackerRowsCompleted * 10,
    });
  }

  if (previous && stageRank(next.stage) > stageRank(previous.stage)) {
    awards.push({
      title: "Stage advanced",
      details: `Project moved from ${previous.stage} to ${next.stage}.`,
      points: 40,
    });
  }

  for (const milestone of [50, 75, 90, 100]) {
    if (next.scores.overall >= milestone) {
      awards.push({
        key: `${projectId}:score-${milestone}`,
        title: `${milestone}% milestone`,
        details: `Overall completion reached ${milestone}%.`,
        points: milestone === 100 ? 100 : milestone,
      });
    }
  }

  if (next.needsFixing.length === 0) {
    awards.push({
      key: `${projectId}:no-fixes`,
      title: "Clean report",
      details: "No items remain in Needs Fixing.",
      points: 35,
    });
  }

  if (next.stage === "Production-ready") {
    awards.push({
      key: `${projectId}:production-ready`,
      title: "Production ready",
      details: "The project reached the Production-ready stage.",
      points: 60,
    });
  }

  return awards;
}

function formatSavedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scrollToAnalysisReport(): void {
  window.setTimeout(() => {
    document.getElementById("analysis-report")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}

function SavedAnalysesPanel({
  items,
  selectedId,
  expanded,
  loading,
  reanalyzingId,
  onOpen,
  onToggle,
  onReanalyze,
  onDelete,
}: {
  items: SavedAnalysis[];
  selectedId: string | null;
  expanded: boolean;
  loading: boolean;
  reanalyzingId: string | null;
  onOpen: (item: SavedAnalysis) => void;
  onToggle: (item: SavedAnalysis) => void;
  onReanalyze: (item: SavedAnalysis) => void;
  onDelete: (item: SavedAnalysis) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div
      className="rounded-xl border p-4 mb-8"
      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Saved folders
        </h2>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {items.length} saved
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const isSelected = item.id === selectedId;
          const isExpanded = isSelected && expanded;
          const isReanalyzing = reanalyzingId === item.id;

          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={`${isExpanded ? "Collapse" : "Expand"} saved analysis for ${item.name}`}
              onClick={() => onToggle(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onToggle(item);
                }
              }}
              className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-4 rounded-lg border p-4 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
              style={{
                backgroundColor: isSelected ? "rgba(61,139,255,0.07)" : "var(--bg-elevated)",
                borderColor: isSelected ? "var(--accent-blue)" : "var(--border-subtle)",
              }}
            >
              <div className="flex items-center gap-2" aria-label={`Controls for ${item.name}`}>
                <button
                  type="button"
                  aria-label={`Load ${item.name}`}
                  title="Load saved analysis"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpen(item);
                  }}
                  className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                  style={{
                    backgroundColor: isSelected ? "rgba(61,139,255,0.08)" : "transparent",
                    borderColor: isSelected ? "var(--accent-blue)" : "var(--border-subtle)",
                    color: "var(--accent-blue)",
                  }}
                >
                  <FolderOpen size={30} />
                </button>
                <div className="flex h-16 flex-col gap-1">
                  <button
                    type="button"
                    aria-label={`Reanalyze ${item.name}`}
                    title="Reanalyze saved folder"
                    disabled={loading}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onReanalyze(item);
                    }}
                    className="h-[30px] w-8 rounded-md border flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] hover:bg-[var(--bg-card)]"
                    style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
                  >
                    <RefreshCw size={15} className={isReanalyzing ? "animate-spin-loader" : ""} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${item.name}`}
                    title="Delete saved folder"
                    disabled={loading}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onDelete(item);
                    }}
                    className="h-[30px] w-8 rounded-md border flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] hover:bg-[var(--bg-card)]"
                    style={{ borderColor: "var(--border-subtle)", color: "var(--accent-red)" }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="min-w-0 flex items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {item.name}
                    </p>
                    <StageBadge stage={item.report.stage} />
                  </div>
                  <p className="text-xs font-mono truncate mt-1" style={{ color: "var(--text-secondary)" }}>
                    {item.path}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      <Clock3 size={12} />
                      {formatSavedDate(item.updatedAt)}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {item.report.nextEasyWins.length} wins · {item.report.todayPlan.length} today
                    </span>
                  </div>
                  {isSelected && (
                    <div className="mt-3 flex items-center gap-1 text-xs" style={{ color: "var(--accent-blue)" }}>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {isExpanded ? "Analysis expanded below" : "Analysis collapsed"}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 md:justify-self-end">
                <ScoreRing
                  score={item.report.scores.overall}
                  label={`${item.name} overall completion`}
                  size={82}
                  strokeWidth={5}
                  showPercent
                />
                <span className="hidden sm:block text-xs w-[72px]" style={{ color: "var(--text-muted)" }}>
                  completion
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AchievementsPanel({ state, projectId, projectName }: { state: AchievementState; projectId: string | null; projectName: string }) {
  const projectState = getProjectAchievements(state, projectId);
  const tier = getAchievementTier(projectState.totalPoints);
  const progress = tier.nextAt
    ? Math.round(((projectState.totalPoints - tier.currentAt) / (tier.nextAt - tier.currentAt)) * 100)
    : 100;
  const recentEvents = projectState.events.slice(0, 4);
  const stars = getStarRank(projectState.totalPoints);

  if (!projectId) return null;

  return (
    <div
      className="rounded-xl border p-4 mb-8"
      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr] md:items-center">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Folder rewards
          </h2>
          <p className="mt-1 truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {projectName}
          </p>
          <div className="mt-2 flex items-end gap-2">
            <p className="text-3xl font-bold leading-none" style={{ color: "var(--text-primary)" }}>
              {projectState.totalPoints}
            </p>
            <span className="pb-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
              points
            </span>
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            Level {tier.level}: {tier.name}
          </p>
          <div className="mt-2 flex items-center gap-1" aria-label={`${stars} star rank`}>
            {[0, 1, 2, 3, 4].map(index => (
              <Star
                key={index}
                size={14}
                fill={index < stars ? "#F59E0B" : "transparent"}
                style={{ color: index < stars ? "#F59E0B" : "var(--text-muted)" }}
              />
            ))}
          </div>
          <div className="mt-3">
            <ProgressBar value={progress} label={`${projectName} reward progress`} height={6} animated={false} />
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              {tier.nextAt ? `${tier.nextAt - projectState.totalPoints} points to next reward` : "Top reward reached"}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {recentEvents.length > 0 ? recentEvents.map(event => (
            <div
              key={event.id}
              className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
              style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {event.title}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  {event.projectName} · {event.details}
                </p>
              </div>
              <span className="flex-shrink-0 text-sm font-semibold" style={{ color: "var(--accent-green)" }}>
                +{event.points}
              </span>
            </div>
          )) : (
            <div
              className="rounded-lg border px-3 py-3 text-sm"
              style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
            >
              Reanalyze after completing fixes to earn points and unlock rewards.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Today Win Hero ──────────────────────────────────────────────────────────

function toggleProfileValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value];
}

function toggleReadinessFocus(values: AnalysisReadinessFocus[] | undefined, value: AnalysisReadinessFocus): AnalysisReadinessFocus[] {
  const current: AnalysisReadinessFocus[] = values?.length ? values : ["Solo/Indie"];
  if (value === "Solo/Indie") return ["Solo/Indie"];
  const withoutSolo = current.filter(item => item !== "Solo/Indie");
  const next: AnalysisReadinessFocus[] = withoutSolo.includes(value) ? withoutSolo.filter(item => item !== value) : [...withoutSolo, value];
  return next.length > 0 ? next : ["Solo/Indie"];
}

function ProfileChip<T extends string>({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: T;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const helpText = PROFILE_OPTION_HELP[label] || `Include ${label} in this analysis.`;

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${label}. ${helpText}`}
      disabled={disabled}
      onClick={onClick}
      title={helpText}
      className="rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        backgroundColor: selected ? "rgba(61,139,255,0.12)" : "var(--bg-elevated)",
        borderColor: selected ? "var(--accent-blue)" : "var(--border-subtle)",
        color: selected ? "var(--accent-blue)" : "var(--text-secondary)",
      }}
    >
      {label}
    </button>
  );
}

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {title}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function AnalysisProfilePanel({
  profile,
  disabled,
  detecting,
  analyzeDisabled,
  loading,
  onChange,
  onAnalyze,
}: {
  profile: AnalysisProfile;
  disabled: boolean;
  detecting: boolean;
  analyzeDisabled: boolean;
  loading: boolean;
  onChange: (profile: AnalysisProfile) => void;
  onAnalyze: () => void;
}) {
  const update = (patch: Partial<AnalysisProfile>) => onChange({ ...profile, ...patch });
  const readinessFocuses: AnalysisReadinessFocus[] = profile.readinessFocuses?.length ? profile.readinessFocuses : ["Solo/Indie"];

  return (
    <div
      className="rounded-xl border p-4 mb-8"
      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          <Settings2 size={16} style={{ color: "var(--accent-blue)" }} />
          Analysis profile
        </h2>
        {detecting && (
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
            <Loader size={12} className="animate-spin-loader" />
            Detecting
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProfileSection title="Readiness focus">
          {READINESS_FOCUS_OPTIONS.map(option => (
            <ProfileChip
              key={option}
              label={option}
              selected={readinessFocuses.includes(option)}
              disabled={disabled}
              onClick={() => update({ readinessFocuses: toggleReadinessFocus(readinessFocuses, option) })}
            />
          ))}
        </ProfileSection>
        <ProfileSection title="Platforms">
          {PLATFORM_OPTIONS.map(option => (
            <ProfileChip
              key={option}
              label={option}
              selected={profile.platforms.includes(option)}
              disabled={disabled}
              onClick={() => update({ platforms: toggleProfileValue(profile.platforms, option) })}
            />
          ))}
        </ProfileSection>
        <ProfileSection title="OS targets">
          {OS_OPTIONS.map(option => (
            <ProfileChip
              key={option}
              label={option}
              selected={profile.osTargets.includes(option)}
              disabled={disabled}
              onClick={() => update({ osTargets: toggleProfileValue(profile.osTargets, option) })}
            />
          ))}
        </ProfileSection>
        <ProfileSection title="Accessibility standards">
          {ACCESSIBILITY_OPTIONS.map(option => (
            <ProfileChip
              key={option}
              label={option}
              selected={profile.accessibilityStandards.includes(option)}
              disabled={disabled}
              onClick={() => update({ accessibilityStandards: toggleProfileValue(profile.accessibilityStandards, option) })}
            />
          ))}
        </ProfileSection>
        <ProfileSection title="Publishing targets">
          {PUBLISHING_OPTIONS.map(option => (
            <ProfileChip
              key={option}
              label={option}
              selected={profile.publishingTargets.includes(option)}
              disabled={disabled}
              onClick={() => update({ publishingTargets: toggleProfileValue(profile.publishingTargets, option) })}
            />
          ))}
        </ProfileSection>
      </div>
      <label className="mt-4 block">
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Notes
        </span>
        <textarea
          value={profile.notes || ""}
          disabled={disabled}
          onChange={(event) => update({ notes: event.target.value })}
          className="mt-2 min-h-[76px] w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
          placeholder="Project context, audience, launch constraints..."
        />
      </label>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={analyzeDisabled}
          className="h-11 px-6 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98]"
          style={{ backgroundColor: "var(--accent-blue)" }}
        >
          {loading ? (
            <>
              <Loader size={16} className="animate-spin-loader" />
              Scanning...
            </>
          ) : (
            <>
              Analyze Project
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ReadinessPanel({ report }: { report: ProjectReport }) {
  const accessibility = report.accessibilityStandards || [];
  const publishing = report.publishingReadiness || [];
  if (accessibility.length === 0 && publishing.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <ChecklistCard
        icon={<ShieldCheck size={20} style={{ color: "var(--accent-green)" }} />}
        title="Accessibility Standards"
        items={accessibility.map(item => ({
          name: item.standard,
          status: item.status,
          detail: item.issue,
          nextStep: item.nextStep,
          files: item.filesLikelyInvolved,
        }))}
      />
      <ChecklistCard
        icon={<Rocket size={20} style={{ color: "var(--accent-blue)" }} />}
        title="Publishing Readiness"
        items={publishing.map(item => ({
          name: item.target,
          status: item.status,
          detail: item.requirement,
          nextStep: item.nextStep,
          files: item.filesLikelyInvolved,
        }))}
      />
    </div>
  );
}

function ChecklistCard({
  icon,
  title,
  items,
}: {
  icon: ReactNode;
  title: string;
  items: Array<{ name: string; status: string; detail: string; nextStep: string; files: string[] }>;
}) {
  return (
    <div
      className="rounded-xl border p-6"
      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
    >
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        {icon}
        {title}
      </h3>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`${item.name}-${index}`} className="rounded-lg border p-3" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {item.name}
              </p>
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              {item.detail}
            </p>
            <p className="mt-2 text-[13px]" style={{ color: "var(--text-primary)" }}>
              {item.nextStep}
            </p>
            {item.files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.files.slice(0, 4).map(file => <CodePill key={file} file={file} />)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const ENCOURAGING_LINES = [
  "You've got this. One small move forward.",
  "This is the one. Start here and the rest gets easier.",
  "Fifteen minutes. That's all this needs.",
  "Small wins stack up. This is your next one.",
  "The hardest part is starting. You're already here.",
];

function TodayWinHero({ report, onShowFull }: { report: ProjectReport; onShowFull: () => void }) {
  const [copied, setCopied] = useState(false);

  const win = report.nextEasyWins.find((w) => w.difficulty === "Easy") ?? report.nextEasyWins[0];
  const fallbackTask = report.todayPlan[0];

  if (!win && !fallbackTask) return null;

  const task = win?.task ?? fallbackTask?.task ?? "";
  const why = win?.whyItMatters ?? fallbackTask?.successLooksLike ?? "";
  const time = win?.estimatedTime ?? "";
  const startFile = win?.filesLikelyInvolved[0] ?? fallbackTask?.filesToOpen[0] ?? "";
  const encouragement = ENCOURAGING_LINES[task.length % ENCOURAGING_LINES.length];

  const handleCopy = () => {
    if (startFile) {
      navigator.clipboard.writeText(startFile).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div
      id="easy-win-0"
      className="app-card rounded-xl border p-6 mb-6 scroll-mt-6"
      style={{
        background: "linear-gradient(135deg, rgba(245,158,11,0.07) 0%, transparent 60%)",
        borderColor: "rgba(245,158,11,0.35)",
        borderLeftWidth: 3,
        borderLeftColor: "#F59E0B",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Zap size={20} className="shrink-0" style={{ color: "#F59E0B" }} />
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#F59E0B" }}>
          Today's Win
        </span>
      </div>

      <p className="text-xl sm:text-2xl font-bold leading-snug mb-3" style={{ color: "var(--text-primary)" }}>
        {task}
      </p>

      {why && (
        <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {why}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        {time && <TimeBadge time={time} />}
        {win?.difficulty && <DifficultyBadge difficulty={win.difficulty} />}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {startFile && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`Copy start file ${startFile}`}
            className="h-9 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all hover:brightness-110 active:scale-95"
            style={{ backgroundColor: "#F59E0B", color: "#0d0d0d" }}
          >
            {copied ? <CheckCircle2 size={15} /> : <FileCode size={15} />}
            {copied ? "Copied!" : startFile}
          </button>
        )}
        <button
          type="button"
          onClick={onShowFull}
          aria-controls="analysis-report"
          className="h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          style={{
            backgroundColor: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <ChevronDown size={14} />
          See full analysis
        </button>
      </div>

      <p className="mt-5 text-sm italic" style={{ color: "var(--text-muted)" }}>
        {encouragement}
      </p>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>(loadSavedAnalyses);
  const [achievements, setAchievements] = useState<AchievementState>(loadAchievementState);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [analysisProfile, setAnalysisProfile] = useState<AnalysisProfile>(DEFAULT_ANALYSIS_PROFILE);
  const [detectingProfile, setDetectingProfile] = useState(false);

  // Electron tray "What's my win today?" — focus the hero card
  useEffect(() => {
    const api = (window as { electronAPI?: { onHighlightWin: (cb: () => void) => void } }).electronAPI;
    if (!api) return;
    api.onHighlightWin(() => {
      document.getElementById("easy-win-0")?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  const recordAchievements = (projectId: string, projectName: string, previous: ProjectReport | undefined, next: ProjectReport) => {
    setAchievements((current) => {
      const projectState = getProjectAchievements(current, projectId);
      const awards = buildAchievementAwards(projectId, previous, next).filter(award => {
        return !award.key || !projectState.awarded[award.key];
      });

      if (awards.length === 0) return current;

      const earnedAt = new Date().toISOString();
      const events = awards.map((award, index): AchievementEvent => ({
        ...award,
        id: `${projectId}:${earnedAt}:${index}`,
        projectId,
        projectName,
        earnedAt,
      }));
      const awarded = { ...projectState.awarded };

      for (const award of awards) {
        if (award.key) awarded[award.key] = true;
      }

      const nextState = {
        projects: {
          ...current.projects,
          [projectId]: {
            totalPoints: projectState.totalPoints + awards.reduce((total, award) => total + award.points, 0),
            events: [...events, ...projectState.events].slice(0, 80),
            awarded,
          },
        },
      };

      persistAchievementState(nextState);
      return nextState;
    });
  };

  const saveAnalysis = (projectPath: string, data: ProjectReport, profile: AnalysisProfile) => {
    const id = getAnalysisId(projectPath);
    const previous = savedAnalyses.find((saved) => saved.id === id)?.report;
    const item: SavedAnalysis = {
      id,
      path: projectPath,
      name: data.projectName || getProjectNameFromPath(projectPath),
      updatedAt: new Date().toISOString(),
      report: data,
      analysisProfile: data.analysisProfile || profile,
    };

    recordAchievements(id, item.name, previous, data);

    setSavedAnalyses((current) => {
      const next = [item, ...current.filter((saved) => saved.id !== id)].slice(0, 30);
      persistSavedAnalyses(next);
      return next;
    });
    setSelectedAnalysisId(id);
    setAnalysisExpanded(true);
  };

  const handleAnalyze = async () => {
    if (!path.trim()) return;
    await runAnalysis(path.trim(), analysisProfile);
  };

  const runAnalysis = async (projectPath: string, profile: AnalysisProfile) => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const data = await analyzeProject(projectPath, profile);
      const resolvedProfile = data.analysisProfile || profile;
      setAnalysisProfile(resolvedProfile);
      saveAnalysis(projectPath, data, resolvedProfile);
      setReport(data);
      setShowFullAnalysis(false);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err.response as { data?: { error?: string } })?.data?.error || "Analysis failed"
        : "Failed to analyze project. Make sure the server is running.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    setSelectingFolder(true);
    setError(null);
    try {
      const selectedPath = await selectProjectFolder();
      if (!selectedPath) return;
      setPath(selectedPath);
      setDetectingProfile(true);
      const profile = await detectAnalysisProfile(selectedPath);
      setAnalysisProfile(profile);
      setReport(null);
      setSelectedAnalysisId(getAnalysisId(selectedPath));
      setAnalysisExpanded(false);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err.response as { data?: { error?: string } })?.data?.error || "Folder selection failed"
        : "Failed to open folder picker. Make sure the server is running.";
      setError(msg);
    } finally {
      setSelectingFolder(false);
      setDetectingProfile(false);
    }
  };

  const handleOpenSaved = (item: SavedAnalysis) => {
    setPath(item.path);
    setReport(item.report);
    setAnalysisProfile(item.analysisProfile || item.report.analysisProfile || DEFAULT_ANALYSIS_PROFILE);
    setError(null);
    setSelectedAnalysisId(item.id);
    setAnalysisExpanded(true);
    scrollToAnalysisReport();
  };

  const handleToggleSaved = (item: SavedAnalysis) => {
    setPath(item.path);
    setError(null);
    setAnalysisProfile(item.analysisProfile || item.report.analysisProfile || DEFAULT_ANALYSIS_PROFILE);

    if (selectedAnalysisId === item.id) {
      setAnalysisExpanded((current) => !current);
      setReport(item.report);
      return;
    }

    setReport(item.report);
    setSelectedAnalysisId(item.id);
    setAnalysisExpanded(true);
  };

  const handleReanalyzeSaved = async (item: SavedAnalysis) => {
    setPath(item.path);
    const profile = item.analysisProfile || item.report.analysisProfile || analysisProfile;
    setAnalysisProfile(profile);
    setLoading(true);
    setError(null);
    setReport(null);
    setReanalyzingId(item.id);
    try {
      const data = await analyzeProject(item.path, profile);
      const resolvedProfile = data.analysisProfile || profile;
      setAnalysisProfile(resolvedProfile);
      saveAnalysis(item.path, data, resolvedProfile);
      setReport(data);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err.response as { data?: { error?: string } })?.data?.error || "Analysis failed"
        : "Failed to analyze project. Make sure the server is running.";
      setError(msg);
      setSelectedAnalysisId(item.id);
      setAnalysisExpanded(true);
      setReport(item.report);
    } finally {
      setLoading(false);
      setReanalyzingId(null);
      setDetectingProfile(false);
    }
  };

  const handleDeleteSaved = (item: SavedAnalysis) => {
    setSavedAnalyses((current) => {
      const next = current.filter((saved) => saved.id !== item.id);
      persistSavedAnalyses(next);
      return next;
    });

    if (selectedAnalysisId === item.id) {
      setSelectedAnalysisId(null);
      setAnalysisExpanded(false);
      setReport(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleAnalyze();
  };

  const activeSavedAnalysis = selectedAnalysisId
    ? savedAnalyses.find((item) => item.id === selectedAnalysisId)
    : null;
  const activeProjectName = activeSavedAnalysis?.name || report?.projectName || getProjectNameFromPath(path);
  const profileDisabled = loading || selectingFolder || detectingProfile;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-gradient)" }}>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ─── Header ──────────────────────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-6 mb-8 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <Terminal size={28} style={{ color: "var(--accent-blue)" }} />
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Easy Wins Project Tracker
            </h1>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            What should you work on next?
          </p>
        </header>

        {/* ─── Input Bar ───────────────────────────────────────────────── */}
        <div
          className="app-card rounded-xl border p-5 mb-8"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <button
                type="button"
                aria-label="Choose a project directory"
                title="Choose project directory"
                disabled={loading || selectingFolder}
                onClick={handleSelectFolder}
                className="absolute left-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors disabled:cursor-default disabled:opacity-40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] enabled:hover:bg-[var(--bg-card)]"
                style={{ color: "var(--text-muted)" }}
              >
                {selectingFolder ? <Loader size={15} className="animate-spin-loader" /> : <FolderOpen size={17} />}
              </button>
              <input
                id="project-path"
                type="text"
                aria-label="Project directory path"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="/path/to/your/project"
                className="w-full h-11 pl-11 pr-4 rounded-lg text-sm outline-none transition-all font-mono border"
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--border-focus)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
              />
            </div>
          </div>
          <p className="mt-2.5 text-xs" style={{ color: "var(--text-muted)" }}>
            Enter an absolute path to a local project directory. We'll scan it and generate a report.
          </p>
        </div>

        {path.trim() && (
          <AnalysisProfilePanel
            profile={analysisProfile}
            disabled={profileDisabled}
            detecting={detectingProfile}
            analyzeDisabled={profileDisabled || !path.trim()}
            loading={loading}
            onChange={setAnalysisProfile}
            onAnalyze={handleAnalyze}
          />
        )}

        <SavedAnalysesPanel
          items={savedAnalyses}
          selectedId={selectedAnalysisId}
          expanded={analysisExpanded}
          loading={loading}
          reanalyzingId={reanalyzingId}
          onOpen={handleOpenSaved}
          onToggle={handleToggleSaved}
          onReanalyze={handleReanalyzeSaved}
          onDelete={handleDeleteSaved}
        />

        <AchievementsPanel state={achievements} projectId={selectedAnalysisId} projectName={activeProjectName} />

        {/* ─── Loading State ───────────────────────────────────────────── */}
        {loading && (
          <div
            role="status"
            aria-live="polite"
            className="app-card rounded-xl border p-16 flex flex-col items-center justify-center"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
          >
            <svg className="animate-spin-loader" width={40} height={40} viewBox="0 0 40 40">
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="var(--bg-elevated)"
                strokeWidth="3"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="var(--accent-blue)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="60 40"
              />
            </svg>
            <p className="mt-5 text-base font-medium" style={{ color: "var(--text-primary)" }}>
              Scanning project...
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              Reading files, checking git history, analyzing structure
            </p>
          </div>
        )}

        {/* ─── Error State ─────────────────────────────────────────────── */}
        {error && !loading && (
          <div
            role="alert"
            className="rounded-lg border-l-4 p-6 mb-8"
            style={{
              backgroundColor: "rgba(239,68,68,0.05)",
              borderLeftColor: "var(--accent-red)",
              borderColor: "var(--accent-red)",
            }}
          >
            <h3 className="text-base font-semibold mb-1" style={{ color: "var(--accent-red)" }}>
              Analysis Failed
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
              {error}
            </p>
            <button
              type="button"
              onClick={handleAnalyze}
              className="h-9 px-4 rounded-lg text-sm font-semibold text-white flex items-center gap-2 hover:brightness-110"
              style={{ backgroundColor: "var(--accent-blue)" }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* ─── Empty State ─────────────────────────────────────────────── */}
        {!report && !loading && !error && savedAnalyses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <FolderOpen size={80} style={{ color: "var(--border-subtle)", opacity: 0.3 }} />
              <Search
                size={32}
                className="absolute -bottom-1 -right-1"
                style={{ color: "var(--accent-blue)", opacity: 0.5 }}
              />
            </div>
            <p className="mt-6 text-base" style={{ color: "var(--text-muted)" }}>
              Enter a project path to get started
            </p>
          </div>
        )}

        {/* ─── Report ──────────────────────────────────────────────────── */}
        {report && !loading && analysisExpanded && (
          <div id="analysis-report" className="space-y-6 animate-fade-in scroll-mt-6">
            {/* ─── Today's Win Hero ──────────────────────────────────── */}
            <TodayWinHero report={report} onShowFull={() => setShowFullAnalysis(true)} />

            {/* ─── Full Analysis Toggle ──────────────────────────────── */}
            {!showFullAnalysis && (
              <div className="text-center py-2">
                <button
                  type="button"
                  onClick={() => setShowFullAnalysis(true)}
                  aria-controls="analysis-report"
                  className="text-sm flex items-center gap-1.5 mx-auto transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  <ChevronDown size={14} />
                  Show full report
                </button>
              </div>
            )}

            {showFullAnalysis && (
            <>
            {/* ─── Project Snapshot Card ─────────────────────────────── */}
            <div
              className="rounded-xl border p-6"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-subtle)",
                borderTopWidth: 3,
                borderTopColor: "var(--accent-blue)",
              }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left: project info */}
                <div className="lg:col-span-3">
                  <h2 className="text-2xl sm:text-[28px] font-bold" style={{ color: "var(--text-primary)" }}>
                    {report.projectName}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {report.purpose}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {report.techStack.map((tech) => (
                      <TechStackTag key={tech} tech={tech} />
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <StageBadge stage={report.stage} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Confidence: {report.confidence}
                    </span>
                  </div>
                </div>
                {/* Right: overall score */}
                <div className="lg:col-span-2 flex flex-col items-center justify-center">
                  <ScoreRing score={report.scores.overall} size={80} strokeWidth={5} />
                  <p
                    className="mt-3 text-xs font-medium uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Overall Completion
                  </p>
                  <p className="mt-4 text-sm text-center leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {report.summary}
                  </p>
                </div>
              </div>
            </div>

            {/* ─── Completion Scores Grid ────────────────────────────── */}
            <div>
              <h3
                className="text-lg font-semibold mb-4 flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <BarChart3 size={20} style={{ color: "var(--accent-blue)" }} />
                Completion Scores
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Core Functionality", value: report.scores.coreFunctionality },
                  { label: "UI/UX Polish", value: report.scores.uiUxPolish },
                  { label: "Code Quality", value: report.scores.codeQuality },
                  { label: "Stability & Bugs", value: report.scores.stabilityBugs },
                  { label: "Performance", value: report.scores.performance },
                  { label: "Documentation", value: report.scores.documentation },
                  { label: "Deployment Readiness", value: report.scores.deploymentReadiness },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="app-card rounded-xl border p-5 animate-fade-in"
                    style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
                  >
                    <p
                      className="text-xs font-medium uppercase tracking-wider mb-3"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {item.label}
                    </p>
                    <p
                      className="text-[32px] font-bold leading-none"
                      style={{
                        color:
                          item.value >= 80
                            ? "var(--accent-green)"
                            : item.value >= 50
                            ? "var(--accent-yellow)"
                            : "var(--accent-red)",
                      }}
                    >
                      {item.value}%
                    </p>
                    <ProgressBar value={item.value} label={`${item.label} score`} className="mt-3" />
                  </div>
                ))}
              </div>
            </div>

            {/* ─── Radar Chart ────────────────────────────────────────── */}
            <div
              className="rounded-xl border p-6"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
            >
              <h3
                className="text-lg font-semibold mb-4 flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <Braces size={20} style={{ color: "var(--accent-cyan)" }} />
                Score Overview
              </h3>
              <div className="flex justify-center">
                <Suspense fallback={<div className="h-80 w-full" />}>
                  <ScoreRadar scores={report.scores} />
                </Suspense>
              </div>
            </div>

            {/* ─── What's Working vs Needs Fixing ────────────────────── */}
            <ReadinessPanel report={report} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* What's Working */}
              <div
                className="rounded-xl border p-6"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-subtle)",
                  borderTopWidth: 3,
                  borderTopColor: "var(--accent-green)",
                }}
              >
                <h3
                  className="text-base font-semibold mb-4 flex items-center gap-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  <CheckCircle2 size={20} style={{ color: "var(--accent-green)" }} />
                  What's Working
                </h3>
                <div className="space-y-0">
                  {report.working.map((item, i) => (
                    <div
                      key={i}
                      className="py-3"
                      style={{
                        borderBottom:
                          i < report.working.length - 1 ? "1px solid var(--border-subtle)" : "none",
                      }}
                    >
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {item.area}
                      </p>
                      <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
                        {item.details}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Needs Fixing */}
              <div
                className="rounded-xl border p-6"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-subtle)",
                  borderTopWidth: 3,
                  borderTopColor: "var(--accent-red)",
                }}
              >
                <h3
                  className="text-base font-semibold mb-4 flex items-center gap-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  <AlertTriangle size={20} style={{ color: "var(--accent-red)" }} />
                  Needs Fixing
                </h3>
                <div className="space-y-0">
                  {report.needsFixing.map((item, i) => (
                    <div
                      key={i}
                      className="py-3"
                      style={{
                        borderBottom:
                          i < report.needsFixing.length - 1 ? "1px solid var(--border-subtle)" : "none",
                      }}
                    >
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {item.problem}
                      </p>
                      <p className="text-[13px] mt-1 italic" style={{ color: "var(--text-secondary)" }}>
                        {item.evidence}
                      </p>
                      <div className="mt-1.5">
                        <SeverityBadge severity={item.severity} />
                      </div>
                      <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--accent-blue)" }}>Fix:</span> {item.suggestedFix}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── Next Easy Wins ────────────────────────────────────── */}
            <div
              className="rounded-xl border p-6"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
            >
              <h3
                className="text-base font-semibold flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <Zap size={20} style={{ color: "var(--accent-yellow)" }} />
                Next Easy Wins
              </h3>
              <p className="text-sm mt-1 mb-4" style={{ color: "var(--text-secondary)" }}>
                High-impact tasks you can knock out quickly
              </p>
              <div className="space-y-3">
                {report.nextEasyWins.map((win, i) => (
                  <div
                    key={i}
                    className="rounded-lg border p-4 transition-all hover:border-[var(--accent-blue)]"
                    style={{
                      borderColor: "var(--border-subtle)",
                      backgroundColor: "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "rgba(61,139,255,0.03)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <div className="flex flex-wrap items-start gap-2 mb-2">
                      <DifficultyBadge difficulty={win.difficulty} />
                      <TimeBadge time={win.estimatedTime} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {win.task}
                    </p>
                    <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
                      {win.whyItMatters}
                    </p>
                    {win.filesLikelyInvolved.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {win.filesLikelyInvolved.map((f, j) => (
                          <CodePill key={j} file={f} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ─── Project Tracker Table ─────────────────────────────── */}
            <div
              className="rounded-xl border p-6"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
            >
              <h3
                className="text-base font-semibold mb-4 flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <BarChart3 size={20} style={{ color: "var(--accent-blue)" }} />
                Project Tracker
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-subtle)" }}>
                      {["Area", "Status", "Completion", "Priority", "Next Action"].map((h) => (
                        <th
                          key={h}
                          className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.trackerTable.map((row, i) => (
                      <tr
                        key={i}
                        className="transition-colors hover:bg-white/[0.02]"
                        style={{ borderBottom: "1px solid var(--border-subtle)" }}
                      >
                        <td className="px-4 py-3.5 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {row.area}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-[120px]">
                              <ProgressBar value={row.completionPercent} height={6} />
                            </div>
                            <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                              {row.completionPercent}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <PriorityBadge priority={row.priority} />
                        </td>
                        <td
                          className="px-4 py-3.5 text-[13px] max-w-[300px] truncate"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {row.nextAction}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ─── Today's Action Plan ───────────────────────────────── */}
            <div
              className="rounded-xl border p-6"
              style={{
                backgroundColor: "rgba(61,139,255,0.04)",
                borderColor: "var(--border-subtle)",
                borderLeftWidth: 4,
                borderLeftColor: "var(--accent-blue)",
              }}
            >
              <h3
                className="text-lg font-bold mb-5 flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <Target size={20} style={{ color: "var(--accent-blue)" }} />
                What Should I Do Today?
              </h3>
              <div className="space-y-5">
                {report.todayPlan.map((task, i) => (
                  <div key={i} className="flex gap-4">
                    <div
                      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white"
                      style={{ backgroundColor: "var(--accent-blue)" }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {task.task}
                      </p>
                      {task.filesToOpen.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {task.filesToOpen.map((f, j) => (
                            <CodePill key={j} file={f} />
                          ))}
                        </div>
                      )}
                      <p className="text-[13px] mt-1.5" style={{ color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--accent-green)" }}>Done when:</span> {task.successLooksLike}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── Build Order ───────────────────────────────────────── */}
            <div
              className="rounded-xl border p-6"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
            >
              <h3
                className="text-base font-semibold mb-4 flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <Layers size={20} style={{ color: "var(--accent-purple)" }} />
                Suggested Build Order
              </h3>
              <div className="space-y-0">
                {report.buildOrder.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className="text-xl font-bold"
                        style={{ color: "var(--accent-purple)" }}
                      >
                        {i + 1}
                      </span>
                      {i < report.buildOrder.length - 1 && (
                        <div
                          className="w-0.5 h-6 mt-1"
                          style={{ backgroundColor: "var(--border-subtle)" }}
                        />
                      )}
                    </div>
                    <p
                      className="text-sm pt-1"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── Risks & Blockers ──────────────────────────────────── */}
            <div
              className="rounded-xl border p-6"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
            >
              <h3
                className="text-base font-semibold mb-4 flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <ShieldAlert size={20} style={{ color: "var(--accent-red)" }} />
                Risks & Blockers
              </h3>
              <div className="space-y-2.5">
                {report.risks.map((risk, i) => {
                  const isHigh = risk.toLowerCase().includes("fixme") || risk.toLowerCase().includes("error-prone");
                  const color = isHigh ? "var(--accent-red)" : "var(--accent-yellow)";
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                        {risk}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── Footer ────────────────────────────────────────────── */}
            <footer className="pt-6 pb-4 mt-8 border-t text-center" style={{ borderColor: "var(--border-subtle)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Project Tracker — Local analysis tool. Results are heuristic estimates.
              </p>
            </footer>
            </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
