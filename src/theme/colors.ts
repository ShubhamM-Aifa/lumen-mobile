/**
 * Lumen Design System: colour tokens.
 * iOS-style palette: system grays, true-black dark mode, system blue tint.
 *
 * Blue has two roles because the system blue (#007AFF) is only 4.0:1 with white:
 *   - `tint` (#007AFF) for icons, rings, toggles and other large or decorative elements
 *   - `primary` / `primaryText` (#0066CC) for blue text and for buttons with white text
 */

export const palette = {
  // Brand
  tint:        '#007AFF',  // system blue: icons, rings, switches (large/decorative)
  primary:     '#0066CC',  // fills with white text (5.57:1)
  primaryText: '#0066CC',  // blue text on the page background (4.99:1)
  secondary:   '#30B0C7',  // system teal
  accent:      '#FFCC00',  // system yellow

  // Category colours (iOS system colours)
  catSymptom:  '#FF3B30',
  catFood:     '#34C759',
  catHabits:   '#007AFF',
  catMeds:     '#AF52DE',
  catBody:     '#A2845E',
  catMood:     '#5856D6',
  catVitals:   '#FF2D55',

  // Severity / alert
  severityNone:   '#34C759',
  severityLow:    '#FFCC00',
  severityMedium: '#FF9500',
  severityHigh:   '#FF3B30',

  // Neutrals (light mode)
  background:    '#F2F2F7',
  surface:       '#FFFFFF',
  surfaceAlt:    '#EEEEF3',
  border:        '#D1D1D6',
  divider:       '#E5E5EA',

  text:          '#000000',
  textSecondary: '#6C6C70',
  textDisabled:  '#6C6C70',
  placeholder:   '#6C6C70',

  // Dark mode overrides (re-defined as tokens in darkColors below)
  darkBackground:    '#000000',
  darkSurface:       '#1C1C1E',
  darkSurfaceAlt:    '#2C2C2E',
  darkBorder:        '#38383A',
  darkText:          '#FFFFFF',
  darkTextSecondary: '#98989F',

  // Status
  success: '#34C759',
  warning: '#FF9500',
  error:   '#FF3B30',
  info:    '#007AFF',

  // Status colours safe to use as text (4.5:1+ on background and surface)
  successText:   '#1E7B34',
  warningText:   '#B25000',
  errorText:     '#D70015',
  infoText:      '#0066CC',
  secondaryText: '#00798A',

  // Special
  white:       '#FFFFFF',
  black:       '#000000',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof palette;

// Light and dark theme tokens
export const lightColors = {
  background:    palette.background,
  surface:       palette.surface,
  surfaceAlt:    palette.surfaceAlt,
  border:        palette.border,
  divider:       palette.divider,
  text:          palette.text,
  textSecondary: palette.textSecondary,
  textDisabled:  palette.textDisabled,
  placeholder:   palette.placeholder,
  primary:       palette.primary,
  secondary:     palette.secondary,
};

export const darkColors = {
  background:    palette.darkBackground,
  surface:       palette.darkSurface,
  surfaceAlt:    palette.darkSurfaceAlt,
  border:        palette.darkBorder,
  divider:       palette.darkBorder,
  text:          palette.darkText,
  textSecondary: palette.darkTextSecondary,
  textDisabled:  '#8E8E93',
  placeholder:   '#8E8E93',
  primary:       palette.primary,
  secondary:     palette.secondary,
};
