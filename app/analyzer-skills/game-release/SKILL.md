---
name: game-release
description: Assess game release readiness for browser, desktop, mobile, and Steam targets. Use when Easy Wins detects or is asked to analyze a game project, Steam publishing, Steam Deck readiness, controller support, performance budgets, save data, onboarding, game accessibility, build packaging, or launch checklists.
---

# Game Release

Use this skill when the selected profile includes Game or Steam, or when project dependencies/files suggest a game runtime.

## Checks

- Playability: main loop starts reliably, first-time flow is understandable, pause/restart states exist, and failure states are recoverable.
- Input: keyboard/mouse, touch, controller, and Steam Deck controls match selected targets; controls are remappable or documented when relevant.
- Performance: frame rate is stable on target devices, assets are optimized, loading states exist, and build size is understood.
- Saves: save data, reset behavior, version migration, and cloud/local expectations are documented.
- Accessibility: readable text, subtitles/captions where needed, color-independent cues, reduced motion, controller navigation, and difficulty options are considered.
- Publishing: screenshots, trailer capture plan, store capsule art, age rating notes, privacy notes, platform compatibility, and release notes are tracked.

## Easy Wins

- Prefer small launch-readiness tasks: add a release checklist, add controller/keyboard mapping notes, add a performance smoke test, document save behavior, or add Steam Deck verification steps.
- Avoid suggesting Steam work unless Steam is selected or clearly detected.
- Avoid game-design expansion recommendations when the report is about release readiness.

## Output Guidance

- Keep recommendations concrete and tied to files such as README, package config, game scenes, input modules, asset manifests, or release docs.
- If the game already has strong tests/build scripts, suggest manual playtest and store-readiness tasks instead of generic code quality work.
