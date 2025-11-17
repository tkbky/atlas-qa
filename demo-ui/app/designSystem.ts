export const colors = {
  background: "#040404",
  surface: "#080808",
  surfaceRaised: "#101010",
  overlay: "#151515",
  border: "#1f1f1f",
  divider: "#242424",
  textPrimary: "#f4fff4",
  textSecondary: "#a1b5a1",
  textMuted: "#6f776f",
  accent: "#7ef29d",
  accentMuted: "#1a3b25",
  warning: "#f3c46b",
  danger: "#ff7b7b",
  info: "#7ad1ff",
} as const;

export const typography = {
  fontFamily:
    '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
  sizes: {
    xs: "10px",
    sm: "12px",
    md: "14px",
    lg: "16px",
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
  },
  letterSpacing: {
    caps: "0.08em",
  },
} as const;

export const spacing = {
  xxs: "2px",
  xs: "4px",
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  xxl: "20px",
} as const;

export const radii = {
  sm: "2px",
  md: "4px",
  pill: "999px",
} as const;

export const zIndex = {
  base: 1,
  overlay: 10,
  popover: 100,
} as const;

export const tokens = {
  colors,
  typography,
  spacing,
  radii,
  zIndex,
  status: {
    success: colors.accent,
    running: colors.warning,
    warning: colors.warning,
    danger: colors.danger,
    info: colors.info,
  },
} as const;

const cssVariableMap: Record<string, string | number> = {
  "--color-background": colors.background,
  "--color-surface": colors.surface,
  "--color-surface-raised": colors.surfaceRaised,
  "--color-overlay": colors.overlay,
  "--color-border": colors.border,
  "--color-divider": colors.divider,
  "--color-text-primary": colors.textPrimary,
  "--color-text-secondary": colors.textSecondary,
  "--color-text-muted": colors.textMuted,
  "--color-accent": colors.accent,
  "--color-accent-muted": colors.accentMuted,
  "--color-warning": colors.warning,
  "--color-danger": colors.danger,
  "--color-info": colors.info,
  "--font-mono": typography.fontFamily,
  "--font-size-xs": typography.sizes.xs,
  "--font-size-sm": typography.sizes.sm,
  "--font-size-md": typography.sizes.md,
  "--font-size-lg": typography.sizes.lg,
  "--line-height-tight": typography.lineHeights.tight,
  "--line-height-normal": typography.lineHeights.normal,
  "--letter-spacing-caps": typography.letterSpacing.caps,
  "--space-xxs": spacing.xxs,
  "--space-xs": spacing.xs,
  "--space-sm": spacing.sm,
  "--space-md": spacing.md,
  "--space-lg": spacing.lg,
  "--space-xl": spacing.xl,
  "--space-xxl": spacing.xxl,
  "--radius-sm": radii.sm,
  "--radius-md": radii.md,
};

export const cssVariables = Object.entries(cssVariableMap)
  .map(([key, value]) => `${key}: ${value};`)
  .join("\n");
