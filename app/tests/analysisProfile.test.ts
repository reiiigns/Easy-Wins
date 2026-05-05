import assert from "node:assert/strict";
import test from "node:test";
import { detectAnalysisProfile, sanitizeAnalysisProfile } from "../server/services/analysisProfile";
import { buildPrompt } from "../server/services/promptBuilder";
import type { ScanSummary } from "../server/types/report";

test("detectAnalysisProfile detects Electron desktop targets", () => {
  const profile = detectAnalysisProfile(createSummary({
    dependencies: { electron: "^41.0.0" },
    configFiles: ["electron-builder.config.json"],
  }));

  assert.deepEqual(profile.platforms, ["Desktop"]);
  assert.deepEqual(profile.osTargets, ["Windows", "macOS", "Linux"]);
  assert.ok(profile.publishingTargets.includes("Microsoft Store"));
  assert.ok(profile.publishingTargets.includes("Mac notarized app"));
});

test("detectAnalysisProfile detects React Vite web targets", () => {
  const profile = detectAnalysisProfile(createSummary({
    dependencies: { react: "^19.0.0" },
    devDependencies: { vite: "^7.0.0" },
    configFiles: ["vite.config.ts"],
  }));

  assert.deepEqual(profile.platforms, ["Web"]);
  assert.ok(profile.publishingTargets.includes("Web/PWA"));
  assert.deepEqual(profile.readinessFocuses, ["Solo/Indie"]);
  assert.deepEqual(profile.accessibilityStandards, ["WCAG 2.2 AA"]);
});

test("detectAnalysisProfile detects mobile and game targets", () => {
  const mobile = detectAnalysisProfile(createSummary({
    dependencies: { expo: "^54.0.0", "react-native": "^0.82.0" },
  }));
  const game = detectAnalysisProfile(createSummary({
    dependencies: { phaser: "^3.90.0" },
    srcFiles: ["src/game/scene.ts"],
  }));

  assert.ok(mobile.platforms.includes("Mobile"));
  assert.deepEqual(mobile.osTargets, ["Android", "iOS"]);
  assert.ok(mobile.publishingTargets.includes("Apple App Store"));
  assert.ok(mobile.publishingTargets.includes("Google Play"));
  assert.ok(game.platforms.includes("Game"));
  assert.ok(game.publishingTargets.includes("Steam"));
  assert.ok(game.accessibilityStandards.includes("Steam Deck accessibility"));
});

test("sanitizeAnalysisProfile preserves valid selections and defaults missing fields", () => {
  const profile = sanitizeAnalysisProfile({
    platforms: ["CLI/Tool", "Invalid"],
    osTargets: ["Linux"],
    readinessFocuses: ["Enterprise Readiness", "Invalid"],
    accessibilityStandards: [],
    publishingTargets: ["GitHub release"],
    notes: "ship as a command line helper",
  });

  assert.deepEqual(profile.platforms, ["CLI/Tool"]);
  assert.deepEqual(profile.osTargets, ["Linux"]);
  assert.deepEqual(profile.readinessFocuses, ["Enterprise Readiness"]);
  assert.deepEqual(profile.accessibilityStandards, ["WCAG 2.2 AA"]);
  assert.deepEqual(profile.publishingTargets, ["GitHub release"]);
  assert.equal(profile.notes, "ship as a command line helper");
});

test("buildPrompt includes selected analysis profile constraints", () => {
  const summary = createSummary();
  summary.analysisProfile = {
    platforms: ["Mobile"],
    osTargets: ["Android"],
    readinessFocuses: ["Launch", "Publishing"],
    accessibilityStandards: ["WCAG 2.2 AA", "Android accessibility"],
    publishingTargets: ["Google Play"],
    notes: "Prioritize tablet flow",
  };

  const prompt = buildPrompt(summary);

  assert.match(prompt, /Platforms: Mobile/);
  assert.match(prompt, /OS targets: Android/);
  assert.match(prompt, /Readiness focus: Launch, Publishing/);
  assert.match(prompt, /Accessibility: WCAG 2\.2 AA, Android accessibility/);
  assert.match(prompt, /Publishing: Google Play/);
  assert.match(prompt, /Prioritize tablet flow/);
});

function createSummary(overrides: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  configFiles?: string[];
  srcFiles?: string[];
} = {}): ScanSummary {
  return {
    projectPath: "/workspace/app",
    projectName: "fixture",
    fileCount: 10,
    dirCount: 3,
    fileTree: "src/",
    topLevelFiles: ["package.json"],
    configFiles: overrides.configFiles || [],
    srcFiles: overrides.srcFiles || ["src/index.ts"],
    fileTypeCounts: { ".ts": 1 },
    todoComments: [],
    totalLinesOfCode: 100,
    dependencyCount: Object.keys(overrides.dependencies || {}).length + Object.keys(overrides.devDependencies || {}).length,
    hasTests: false,
    testFileCount: 0,
    hasCiCd: false,
    hasDocker: false,
    packageJson: {
      name: "fixture",
      scripts: {},
      dependencies: overrides.dependencies || {},
      devDependencies: overrides.devDependencies || {},
    },
  };
}
