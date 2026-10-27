import { useTheme } from '../../theme/ThemeContext';

/**
 * Surfaces that depend on the colour scheme but are not part of the shared palette:
 * translucent "glass" bars, round control backgrounds and the selected-tab pill.
 */
export interface IosSurfaces {
  glass: string;
  /** Glass fill for platforms without a blur view: near opaque so content scrolling underneath does not show through. */
  glassSolid: string;
  ctrl: string;
  pill: string;
  fill: string;
  segSelected: string;
  separator: string;
  isDark: boolean;
}

export function useIosSurfaces(): IosSurfaces {
  const { colorScheme, palette } = useTheme();
  const isDark = colorScheme === 'dark';
  return {
    isDark,
    glass: isDark ? 'rgba(37,37,40,0.80)' : 'rgba(255,255,255,0.72)',
    glassSolid: isDark ? 'rgba(37,37,40,0.97)' : 'rgba(255,255,255,0.97)',
    ctrl: isDark ? 'rgba(44,44,46,0.90)' : 'rgba(255,255,255,0.75)',
    pill: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.07)',
    fill: isDark ? '#2C2C2E' : 'rgba(118,118,128,0.12)',
    segSelected: isDark ? '#636366' : '#FFFFFF',
    separator: palette.border,
  };
}

/** Space the floating tab bar occupies at the bottom of the screen. Scroll content must clear it. */
export const TAB_BAR_CLEARANCE = 118;
