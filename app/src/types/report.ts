export type ProjectStage = "Concept" | "Prototype" | "MVP" | "Beta" | "Production-ready";
export type Severity = "Low" | "Medium" | "High";
export type Difficulty = "Easy" | "Medium" | "Hard";
export type TimeEstimate = "15 min" | "30 min" | "1 hour" | "2+ hours";
export type Priority = "Low" | "Medium" | "High";
export type Confidence = "Low" | "Medium" | "High";
export type AnalysisPlatform = "Web" | "Mobile" | "Desktop" | "Server/API" | "CLI/Tool" | "Game";
export type AnalysisOsTarget = "Android" | "iOS" | "Linux" | "Windows" | "macOS";
export type AnalysisReadinessFocus =
  | "Solo/Indie"
  | "Launch"
  | "Accessibility"
  | "Publishing"
  | "Security"
  | "Enterprise Readiness";
export type AccessibilityStandard =
  | "WCAG 2.2 AA"
  | "WCAG 2.2 AAA"
  | "Section 508"
  | "Apple HIG accessibility"
  | "Android accessibility"
  | "Steam Deck accessibility";
export type PublishingTarget =
  | "Web/PWA"
  | "Steam"
  | "Apple App Store"
  | "Google Play"
  | "Microsoft Store"
  | "Mac notarized app"
  | "Linux package"
  | "GitHub release";

export interface AnalysisProfile {
  platforms: AnalysisPlatform[];
  osTargets: AnalysisOsTarget[];
  readinessFocuses?: AnalysisReadinessFocus[];
  accessibilityStandards: AccessibilityStandard[];
  publishingTargets: PublishingTarget[];
  notes?: string;
}

export interface WorkingItem {
  area: string;
  details: string;
}

export interface IssueItem {
  problem: string;
  evidence: string;
  severity: Severity;
  suggestedFix: string;
}

export interface NextWin {
  task: string;
  whyItMatters: string;
  difficulty: Difficulty;
  estimatedTime: TimeEstimate;
  filesLikelyInvolved: string[];
}

export interface TodayTask {
  task: string;
  filesToOpen: string[];
  successLooksLike: string;
}

export interface TrackerRow {
  area: string;
  status: string;
  completionPercent: number;
  priority: Priority;
  nextAction: string;
}

export interface AccessibilityChecklistItem {
  standard: AccessibilityStandard;
  status: "Ready" | "Needs work";
  issue: string;
  nextStep: string;
  filesLikelyInvolved: string[];
}

export interface PublishingChecklistItem {
  target: PublishingTarget;
  status: "Ready" | "Needs work";
  requirement: string;
  nextStep: string;
  filesLikelyInvolved: string[];
}

export interface Scores {
  overall: number;
  coreFunctionality: number;
  uiUxPolish: number;
  codeQuality: number;
  stabilityBugs: number;
  performance: number;
  documentation: number;
  deploymentReadiness: number;
}

export interface ProjectReport {
  projectName: string;
  purpose: string;
  techStack: string[];
  stage: ProjectStage;
  summary: string;
  scores: Scores;
  working: WorkingItem[];
  needsFixing: IssueItem[];
  nextEasyWins: NextWin[];
  buildOrder: string[];
  risks: string[];
  todayPlan: TodayTask[];
  trackerTable: TrackerRow[];
  accessibilityStandards: AccessibilityChecklistItem[];
  publishingReadiness: PublishingChecklistItem[];
  analysisProfile?: AnalysisProfile;
  confidence: Confidence;
}
