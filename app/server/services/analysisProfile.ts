import type {
  AccessibilityStandard,
  AnalysisOsTarget,
  AnalysisPlatform,
  AnalysisProfile,
  AnalysisReadinessFocus,
  PublishingTarget,
  ScanSummary,
} from "../types/report.js";

export const DEFAULT_ANALYSIS_PROFILE: AnalysisProfile = {
  platforms: ["Web"],
  osTargets: [],
  readinessFocuses: ["Solo/Indie"],
  accessibilityStandards: ["WCAG 2.2 AA"],
  publishingTargets: ["Web/PWA", "GitHub release"],
};

const PLATFORMS: AnalysisPlatform[] = ["Web", "Mobile", "Desktop", "Server/API", "CLI/Tool", "Game"];
const OS_TARGETS: AnalysisOsTarget[] = ["Android", "iOS", "Linux", "Windows", "macOS"];
const READINESS_FOCUSES: AnalysisReadinessFocus[] = [
  "Solo/Indie",
  "Launch",
  "Accessibility",
  "Publishing",
  "Security",
  "Enterprise Readiness",
];
const ACCESSIBILITY_STANDARDS: AccessibilityStandard[] = [
  "WCAG 2.2 AA",
  "WCAG 2.2 AAA",
  "Section 508",
  "Apple HIG accessibility",
  "Android accessibility",
  "Steam Deck accessibility",
];
const PUBLISHING_TARGETS: PublishingTarget[] = [
  "Web/PWA",
  "Steam",
  "Apple App Store",
  "Google Play",
  "Microsoft Store",
  "Mac notarized app",
  "Linux package",
  "GitHub release",
];

export function sanitizeAnalysisProfile(value: unknown): AnalysisProfile {
  if (!value || typeof value !== "object") return DEFAULT_ANALYSIS_PROFILE;
  const raw = value as Partial<AnalysisProfile>;
  const platforms = pickAllowed(raw.platforms, PLATFORMS);
  const osTargets = pickAllowed(raw.osTargets, OS_TARGETS);
  const readinessFocuses = pickAllowed(raw.readinessFocuses, READINESS_FOCUSES);
  const accessibilityStandards = pickAllowed(raw.accessibilityStandards, ACCESSIBILITY_STANDARDS);
  const publishingTargets = pickAllowed(raw.publishingTargets, PUBLISHING_TARGETS);
  const notes = typeof raw.notes === "string" ? raw.notes.trim().slice(0, 500) : undefined;

  return {
    platforms: platforms.length > 0 ? platforms : DEFAULT_ANALYSIS_PROFILE.platforms,
    osTargets,
    readinessFocuses: readinessFocuses.length > 0 ? readinessFocuses : DEFAULT_ANALYSIS_PROFILE.readinessFocuses,
    accessibilityStandards: accessibilityStandards.length > 0
      ? accessibilityStandards
      : DEFAULT_ANALYSIS_PROFILE.accessibilityStandards,
    publishingTargets: publishingTargets.length > 0 ? publishingTargets : DEFAULT_ANALYSIS_PROFILE.publishingTargets,
    ...(notes ? { notes } : {}),
  };
}

export function detectAnalysisProfile(summary: ScanSummary): AnalysisProfile {
  const deps = new Set(getDependencyNames(summary).map(dep => dep.toLowerCase()));
  const files = summary.srcFiles.map(file => file.toLowerCase());
  const configs = summary.configFiles.map(file => file.toLowerCase());
  const platforms = new Set<AnalysisPlatform>();
  const osTargets = new Set<AnalysisOsTarget>();
  const readinessFocuses = new Set<AnalysisReadinessFocus>(["Solo/Indie"]);
  const accessibilityStandards = new Set<AccessibilityStandard>(["WCAG 2.2 AA"]);
  const publishingTargets = new Set<PublishingTarget>(["GitHub release"]);

  if (deps.has("electron") || deps.has("tauri") || configs.some(file => file.includes("electron-builder"))) {
    platforms.add("Desktop");
    osTargets.add("Windows");
    osTargets.add("macOS");
    osTargets.add("Linux");
    publishingTargets.add("Microsoft Store");
    publishingTargets.add("Mac notarized app");
    publishingTargets.add("Linux package");
  }

  if (deps.has("react-native") || deps.has("expo") || configs.some(file => file.includes("capacitor"))) {
    platforms.add("Mobile");
    osTargets.add("Android");
    osTargets.add("iOS");
    accessibilityStandards.add("Apple HIG accessibility");
    accessibilityStandards.add("Android accessibility");
    publishingTargets.add("Apple App Store");
    publishingTargets.add("Google Play");
  }

  if (deps.has("phaser") || deps.has("three") || deps.has("@react-three/fiber") || files.some(file => file.includes("game"))) {
    platforms.add("Game");
    publishingTargets.add("Steam");
    accessibilityStandards.add("Steam Deck accessibility");
  }

  if (deps.has("react") || deps.has("vue") || deps.has("svelte") || deps.has("vite") || deps.has("next") || deps.has("@vitejs/plugin-react") || configs.some(file => file.includes("vite"))) {
    platforms.add("Web");
    publishingTargets.add("Web/PWA");
  }

  if (deps.has("express") || deps.has("fastify") || deps.has("@nestjs/core") || files.some(file => file.includes("server/"))) {
    platforms.add("Server/API");
  }

  if (summary.packageJson?.scripts && Object.values(summary.packageJson.scripts).some(script => script.includes("commander") || script.includes("bin"))) {
    platforms.add("CLI/Tool");
  }

  if (platforms.size === 0) platforms.add("Web");

  return {
    platforms: [...platforms],
    osTargets: [...osTargets],
    readinessFocuses: [...readinessFocuses],
    accessibilityStandards: [...accessibilityStandards],
    publishingTargets: [...publishingTargets],
  };
}

export function describeAnalysisProfile(profile?: AnalysisProfile): string {
  const current = profile || DEFAULT_ANALYSIS_PROFILE;
  return [
    `Platforms: ${current.platforms.join(", ") || "General"}`,
    `OS targets: ${current.osTargets.join(", ") || "None selected"}`,
    `Readiness focus: ${(current.readinessFocuses || DEFAULT_ANALYSIS_PROFILE.readinessFocuses || []).join(", ") || "Solo/Indie"}`,
    `Accessibility: ${current.accessibilityStandards.join(", ") || "WCAG 2.2 AA"}`,
    `Publishing: ${current.publishingTargets.join(", ") || "None selected"}`,
    current.notes ? `Notes: ${current.notes}` : "",
  ].filter(Boolean).join("\n");
}

function pickAllowed<T extends string>(values: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is T => typeof value === "string" && allowed.includes(value as T));
}

function getDependencyNames(summary: ScanSummary): string[] {
  return [
    ...Object.keys(summary.packageJson?.dependencies || {}),
    ...Object.keys(summary.packageJson?.devDependencies || {}),
  ];
}
