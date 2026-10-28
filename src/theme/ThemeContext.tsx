/**
 * ThemeContext — provides the active colour palette to components.
 *
 * Reads the system colour scheme and switches between lightTokens / darkTokens.
 * Also exposes a manual override for in-app theme switching (stored in AsyncStorage).
 *
 * Usage in a component:
 *   const { palette, colorScheme } = useTheme();
 *   const styles = useMemo(() => createStyles(palette), [palette]);
 */
import React, {
  createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode,
} from 'react';
import { Appearance, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTokens, darkTokens, ThemeTokens } from './tokens';
import { palette as staticPalette } from './colors';

type ColorScheme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  palette: ThemeTokens;
  colorScheme: 'light' | 'dark';
  preference: ColorScheme;
  setPreference: (scheme: ColorScheme) => void;
}

const PREF_KEY = 'lumen:theme:preference';

const ThemeContext = createContext<ThemeContextValue>({
  palette: lightTokens,
  colorScheme: 'light',
  preference: 'system',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(() => {
    return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  });
  const [preference, setPreferenceState] = useState<ColorScheme>('system');

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY).then(stored => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
        if (typeof (Appearance as any).setColorScheme === 'function') {
          try {
            (Appearance as any).setColorScheme(stored === 'system' ? 'unspecified' : stored);
          } catch {}
        }
      }
    }).catch(() => {});
  }, []);

  const setPreference = useCallback((scheme: ColorScheme) => {
    setPreferenceState(scheme);
    AsyncStorage.setItem(PREF_KEY, scheme).catch(() => {});
    if (typeof (Appearance as any).setColorScheme === 'function') {
      try {
        (Appearance as any).setColorScheme(scheme === 'system' ? 'unspecified' : scheme);
      } catch {}
    }
  }, []);

  const colorScheme: 'light' | 'dark' =
    preference === 'system'
      ? systemScheme
      : preference;
  const palette = colorScheme === 'dark' ? darkTokens : lightTokens;

  // Keep static palette in colors.ts in sync for immediate read access
  useEffect(() => {
    Object.assign(staticPalette, palette);
  }, [palette]);

  const value = useMemo<ThemeContextValue>(
    () => ({ palette, colorScheme, preference, setPreference }),
    [palette, colorScheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** Convenience hook — just the palette, for migrated components. */
export function usePalette(): ThemeTokens {
  return useContext(ThemeContext).palette;
}

/**
 * Helper to generate reactive stylesheets that cleanly re-render when theme changes.
 */
export function createThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (palette: ThemeTokens) => T
): () => T {
  return function useStyles(): T {
    const { palette } = useTheme();
    return useMemo(() => {
      const raw = factory(palette);
      const styleRules: any = {};
      const primitives: any = {};
      for (const key of Object.keys(raw)) {
        const val = (raw as any)[key];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          styleRules[key] = val;
        } else {
          primitives[key] = val;
        }
      }
      const created = StyleSheet.create(styleRules);
      return Object.assign(created, primitives) as T;
    }, [palette]);
  };
}
