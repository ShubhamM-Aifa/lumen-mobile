/**
 * Design tokens for light and dark themes.
 * Components that support dark mode import `useTheme()` and access
 * `palette` from there instead of from the static `colors.ts` file.
 *
 * Migration pattern for existing components:
 *   - Before: import { palette } from '../../theme/colors'
 *             const styles = StyleSheet.create({ ... palette.text ... })
 *   - After:  import { useTheme } from '../../theme/ThemeContext'
 *             function MyComponent() {
 *               const { palette } = useTheme()
 *               const styles = useMemo(() => createStyles(palette), [palette])
 *               ...
 *             }
 */
import { palette as lightPaletteSource } from './colors';

export type ThemeTokens = Record<keyof typeof lightPaletteSource, string>;

// Independent, immutable light design tokens so theme changes never mutate source values
export const lightTokens: ThemeTokens = Object.freeze({
  // Brand. Two blues: `tint` for large/decorative, `primary`/`primaryText` for text and white-text fills.
  tint:        '#007AFF',
  primary:     '#0066CC',  // white text on it is 5.57:1
  primaryText: '#0066CC',  // 4.99:1 on the page background
  secondary:   '#30B0C7',
  accent:      '#FFCC00',

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

  // Dark mode compatibility overrides
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
});

export const darkTokens: ThemeTokens = Object.freeze({
  ...lightTokens,

  // Backgrounds: true black with iOS elevated grays
  background:    '#000000',
  surface:       '#1C1C1E',
  surfaceAlt:    '#2C2C2E',

  // Text
  text:          '#FFFFFF',
  textSecondary: '#98989F',
  textDisabled:  '#8E8E93',  // 6.44:1 on background, 5.22:1 on surface
  placeholder:   '#8E8E93',

  // Brand: fills keep #0066CC so white text passes (5.57:1);
  // text and icons use the lighter system blue, which passes on dark surfaces (4.66:1+)
  tint:          '#0A84FF',
  primary:       '#0066CC',
  primaryText:   '#0A84FF',
  secondary:     '#64D2FF',
  secondaryText: '#64D2FF',

  // Borders
  border:        '#38383A',
  divider:       '#38383A',

  // Status fills (iOS dark system colours)
  success:  '#30D158',
  warning:  '#FF9F0A',
  error:    '#FF453A',
  info:     '#0A84FF',
  successText: '#30D158',
  warningText: '#FF9F0A',
  errorText:   '#FF453A',
  infoText:    '#0A84FF',

  // Category colours (iOS dark system colours)
  catSymptom:  '#FF453A',
  catFood:     '#30D158',
  catHabits:   '#0A84FF',
  catMeds:     '#BF5AF2',
  catBody:     '#AC8E68',
  catMood:     '#5E5CE6',
  catVitals:   '#FF375F',
  severityNone:   '#30D158',
  severityLow:    '#FFD60A',
  severityMedium: '#FF9F0A',
  severityHigh:   '#FF453A',
});
