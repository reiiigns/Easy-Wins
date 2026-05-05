---
name: store-publishing
description: Assess publishing readiness for Web/PWA, Steam, Apple App Store, Google Play, Microsoft Store, macOS notarization, Linux packages, and GitHub releases. Use when Easy Wins analyzes selected publishing targets, store checklists, release artifacts, screenshots, signing, privacy, metadata, or platform submission steps.
---

# Store Publishing

Use this skill to generate platform-specific checklist items only for publishing targets selected in the analysis profile.

## Shared Checks

- Verify build artifacts can be produced from documented commands.
- Check versioning, changelog or release notes, license, install instructions, and support/contact path.
- Check screenshots, icon assets, app description, privacy notes, and required legal links when the target is a public store.
- Check signing, notarization, package identity, bundle identifiers, or store metadata only for platforms that require them.

## Target Guidance

- Web/PWA: require production build, deploy target, manifest, icons, offline/update expectations, and basic performance/accessibility checks.
- GitHub release: require version tag, release notes, packaged artifacts, checksums when useful, and upgrade/install notes.
- Apple App Store: require bundle ID, signing, privacy labels, screenshots, review notes, and accessibility/privacy compliance.
- Google Play: require package ID, signing, target API readiness, privacy policy, store listing, screenshots, and testing track.
- Microsoft Store: require MSIX/AppX packaging, identity, signing, screenshots, metadata, and certification notes.
- Mac notarized app: require signing certificate, entitlements, hardened runtime, notarization, stapling, and distribution notes.
- Linux package: require package format, desktop file, icon assets, install path, dependencies, and distro guidance.
- Steam: require store assets, depot/package plan, controller notes, OS compatibility, save-data behavior, and launch checklist.

## Easy Wins

- Prefer checklist/documentation wins when packaging evidence is missing.
- Prefer concrete file targets: `README.md`, `CHANGELOG.md`, package config, Electron/Tauri config, platform folders, or store asset folders.
- Do not recommend submission automation in v1; keep guidance checklist-style.
