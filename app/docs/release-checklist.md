# GitHub Release Checklist

Use this checklist before creating a GitHub release for Easy Wins.

## Versioning

- Confirm the release version in `package.json`.
- Add the release entry to `CHANGELOG.md`.
- Commit changes before building artifacts.
- Tag the release from the commit that produced the artifacts.

## Validation

Run from `app/`:

```bash
npm run typecheck
npm test
npm run build
```

For desktop packaging:

```bash
npm run electron:build
```

## Artifacts

- Attach the Windows installer from `app/release/` when publishing a desktop build.
- For macOS, build DMG/ZIP artifacts and complete signing plus notarization before distributing outside development machines.
- For Linux, build AppImage and deb artifacts, then confirm desktop metadata, icon rendering, and install instructions.
- Include checksums for installer artifacts when practical.
- Do not commit generated `release/`, `dist/`, `node_modules/`, `models/`, or `.env` files.
- Confirm `.env.example` documents any new configuration.

## Release Notes

Include:

- What changed.
- Why it matters.
- Upgrade or migration notes.
- Validation performed.
- Known limitations.

## Accessibility And Publishing

- Confirm `docs/accessibility.md` reflects the current WCAG 2.2 AA state.
- Confirm keyboard navigation, labels, focus states, reduced motion, and contrast still pass a manual smoke test.
- Confirm GitHub Actions passes on `main`.
- Confirm the GitHub README describes setup, validation, analyzer modes, and release steps.
- Confirm macOS notarization and Linux package notes are current when those targets are selected.
