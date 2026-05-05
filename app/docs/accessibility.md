# Accessibility Notes

Easy Wins targets WCAG 2.2 AA for the dashboard experience.

## Completed Pass

- Keyboard flow: primary controls are native buttons or inputs, and saved analysis rows support keyboard activation.
- Labels: project path input, icon-only controls, chart widgets, progress bars, loading state, and error state expose screen-reader friendly labels.
- Contrast: muted text was raised from `#5A6070` to `#737B8E` against the dark background.
- Focus states: global `:focus-visible` styling provides a clear outline without relying only on color.
- Reduced motion: users with `prefers-reduced-motion: reduce` get near-instant transitions and animations.
- Data graphics: score rings, progress bars, and radar charts include semantic values or text summaries.

## Manual Check Before Release

- Tab through the project path input, folder picker, profile options, notes field, analyze action, saved folders, and report controls.
- Confirm every icon-only action has a visible browser tooltip and a useful screen-reader label.
- Check the dashboard at desktop and narrow mobile widths.
- Re-test contrast after any color token changes.
- Confirm loading and error states are announced by assistive technology.

## Known Scope

This pass covers the app shell and dashboard controls. It does not replace a full audit with assistive technology, browser accessibility tooling, and user testing.
