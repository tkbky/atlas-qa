# Demo UI Design System

The demo UI embraces a single, minimal terminal-inspired theme. Every surface, border, and piece of typography should be derived from a concise set of tokens so that interactions across the product feel consistent and calm.

Design tokens live in `demo-ui/app/designSystem.ts`. They back the CSS variables injected in `app/layout.tsx` and power inline styles throughout the React components.

## Color Palette

| Token | Value | Purpose |
| --- | --- | --- |
| `colors.background` | `#040404` | App shell background |
| `colors.surface` | `#080808` | Default card/list surface |
| `colors.surfaceRaised` | `#101010` | Elevated panels, accordions |
| `colors.overlay` | `#151515` | Overlays, hovered rows |
| `colors.border` | `#1f1f1f` | Structural borders, inputs |
| `colors.divider` | `#242424` | Subtle separators |
| `colors.textPrimary` | `#f4fff4` | Primary text |
| `colors.textSecondary` | `#a1b5a1` | Secondary text, metadata |
| `colors.textMuted` | `#6f776f` | Tertiary labels, placeholders |
| `colors.accent` | `#7ef29d` | Success, active state, primary buttons |
| `colors.accentMuted` | `#1a3b25` | Accent-tinted backgrounds |
| `colors.warning` | `#f3c46b` | Progress / running / caution |
| `colors.danger` | `#ff7b7b` | Errors, destructive actions |
| `colors.info` | `#7ad1ff` | Paused / informational badges |

All status chips, badges, and graph highlights must reuse these semantic hues. Avoid introducing bespoke blues or purples—accent + warning + danger + info cover the full state vocabulary.

## Typography

| Token | Value | Notes |
| --- | --- | --- |
| `typography.fontFamily` | `"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace` | Default stack |
| `typography.sizes.xs` | `10px` | Captions, helper text |
| `typography.sizes.sm` | `12px` | Body copy, list rows |
| `typography.sizes.md` | `14px` | Section titles |
| `typography.sizes.lg` | `16px` | Page headings |
| `typography.lineHeights.tight` | `1.2` | Labels, chips |
| `typography.lineHeights.normal` | `1.4` | Paragraphs |
| `typography.letterSpacing.caps` | `0.08em` | Uppercase labels |

Stay within this scale; the UI should not use ad-hoc 11px/13px sizes anymore.

## Spacing, Radii, and Elevation

| Token | Value | Usage |
| --- | --- | --- |
| `spacing.xxs` | `2px` | Hairline separators, chip padding |
| `spacing.xs` | `4px` | Tight gaps |
| `spacing.sm` | `6px` | Compact field padding |
| `spacing.md` | `8px` | Default internal gaps |
| `spacing.lg` | `12px` | Section spacing, cards |
| `spacing.xl` | `16px` | Panel gutters |
| `spacing.xxl` | `20px` | Page-level breathing room |
| `radii.sm` | `2px` | Badges, pills |
| `radii.md` | `4px` | Panels, inputs |

Elevation relies on stacked surfaces (`surface` → `surfaceRaised` → `overlay`) combined with the shared border token. Drop shadows are intentionally omitted to keep the interface minimal.

## Component Guidelines

- **Panels & cards** use `surface` with `border` outlines and `md` padding. Highlighted/active states switch to `surfaceRaised` or `overlay`.
- **Inputs** reuse `border`, `surfaceRaised`, and `textPrimary`. Focus states apply the accent border without changing the fill.
- **Buttons** come in three variants: primary (accent background, surface text), secondary (surface background, accent text), and danger (transparent background with danger text/border).
- **Statuses** rely on `tokens.status` mapping (`success`, `running`, `warning`, `danger`, `info`). The same hues drive run indicators, timeline pills, and graph highlights.
- **Typography** sticks to the monospace stack everywhere so numbers align cleanly and the debugging nature of the UI shows through.

By limiting the UI to this vocabulary we make room for the cognitive load of the agent data itself. Any new component should consult this document before adding visual styles.
