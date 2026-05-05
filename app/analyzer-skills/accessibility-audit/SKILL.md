---
name: accessibility-audit
description: Assess accessibility readiness for WCAG 2.2 AA/AAA, Section 508, Apple HIG accessibility, Android accessibility, and Steam Deck accessibility. Use when Easy Wins analyzes UI, mobile, desktop, game, or publishing profiles that include accessibility standards, keyboard flow, focus states, labels, contrast, reduced motion, screen readers, input methods, or accessibility testing gaps.
---

# Accessibility Audit

Use this skill to turn accessibility standards into practical checks and small fixes. Treat accessibility as release quality, not visual polish.

## Core Checks

- Keyboard: all interactive controls are reachable, visible focus is present, tab order is logical, and escape/enter/space behavior is predictable.
- Labels: buttons, icon-only controls, inputs, status messages, dialogs, and charts have accessible names or text alternatives.
- Contrast: text, icons, borders that convey state, focus indicators, and disabled states meet the selected standard.
- Structure: headings, landmarks, dialogs, forms, errors, and dynamic content have semantic structure.
- Motion: animations respect reduced-motion preferences and do not hide critical information.
- Assistive tech: state changes, loading, errors, selected filters, and progress are announced or represented semantically.

## Platform Notes

- Apple HIG accessibility: check Dynamic Type expectations, VoiceOver labels, hit targets, color-independent meaning, and motion settings.
- Android accessibility: check TalkBack labels, touch targets, content descriptions, font scaling, and contrast.
- Steam Deck accessibility: check controller navigation, readable handheld text, remappable controls, subtitles/captions where applicable, and performance stability.
- Section 508: map findings to WCAG-oriented web/software criteria and documentation needs.

## Easy Wins

- Prefer focused fixes: add labels to icon buttons, add visible focus, improve contrast tokens, document keyboard flow, add an axe/jest-axe smoke test, or add a manual accessibility checklist.
- Point to likely UI files and avoid broad rewrites.
- If no UI target is selected, keep recommendations to docs, CLI readability, or API error clarity.
