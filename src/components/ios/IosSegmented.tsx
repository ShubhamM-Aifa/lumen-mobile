import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useIosSurfaces } from './iosTheme';

interface Props<T extends string> {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
}

/** iOS segmented control: gray track, white selected thumb. */
export function IosSegmented<T extends string>({ options, value, onChange }: Props<T>) {
  const styles = useStyles();
  const s = useIosSurfaces();
  return (
    <View style={[styles.track, { backgroundColor: s.fill }]} accessibilityRole="tablist">
      {options.map(o => {
        const selected = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            style={[styles.seg, selected && { backgroundColor: s.segSelected }, selected && !s.isDark && styles.shadow]}
            onPress={() => onChange(o.key)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} maxFontSizeMultiplier={1.3}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  track: { marginHorizontal: 16, flexDirection: 'row', padding: 3, borderRadius: 20 },
  seg: { flex: 1, minHeight: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  shadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 },
  label: { ...typography.subhead, color: palette.text },
  labelSelected: { fontWeight: '600' },
}));
