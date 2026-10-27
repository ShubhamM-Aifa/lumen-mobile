/**
 * BodyMap — tappable SVG body outline for selecting pain/symptom locations.
 * Multi-select. Shows a simplified front-view human silhouette.
 * Requires react-native-svg (bundled with Expo SDK 51).
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Svg, { Ellipse, Rect, Path, G, Text as SvgText } from 'react-native-svg';
import { FieldDefinition } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Region {
  key: string;
  label: string;
  shape: 'ellipse' | 'rect';
  // for ellipse
  cx?: number; cy?: number; rx?: number; ry?: number;
  // for rect
  x?: number; y?: number; w?: number; h?: number;
}

const REGIONS: Region[] = [
  { key: 'head',         label: 'Head',         shape: 'ellipse', cx: 100, cy:  48, rx: 24, ry: 28 },
  { key: 'neck',         label: 'Neck',         shape: 'rect',    x: 90,  y:  78, w: 20, h: 20 },
  { key: 'l_shoulder',   label: 'L. Shoulder',  shape: 'ellipse', cx: 62,  cy: 112, rx: 20, ry: 15 },
  { key: 'r_shoulder',   label: 'R. Shoulder',  shape: 'ellipse', cx: 138, cy: 112, rx: 20, ry: 15 },
  { key: 'chest',        label: 'Chest',        shape: 'ellipse', cx: 100, cy: 128, rx: 28, ry: 24 },
  { key: 'upper_abd',    label: 'Upper Abdomen',shape: 'ellipse', cx: 100, cy: 166, rx: 24, ry: 18 },
  { key: 'lower_abd',    label: 'Lower Abdomen',shape: 'ellipse', cx: 100, cy: 200, rx: 22, ry: 16 },
  { key: 'l_upper_arm',  label: 'L. Upper Arm', shape: 'ellipse', cx: 50,  cy: 148, rx: 14, ry: 26 },
  { key: 'r_upper_arm',  label: 'R. Upper Arm', shape: 'ellipse', cx: 150, cy: 148, rx: 14, ry: 26 },
  { key: 'l_forearm',    label: 'L. Forearm',   shape: 'ellipse', cx: 44,  cy: 194, rx: 12, ry: 22 },
  { key: 'r_forearm',    label: 'R. Forearm',   shape: 'ellipse', cx: 156, cy: 194, rx: 12, ry: 22 },
  { key: 'l_hand',       label: 'L. Hand',      shape: 'ellipse', cx: 38,  cy: 228, rx: 12, ry: 13 },
  { key: 'r_hand',       label: 'R. Hand',      shape: 'ellipse', cx: 162, cy: 228, rx: 12, ry: 13 },
  { key: 'l_hip',        label: 'L. Hip',       shape: 'ellipse', cx: 84,  cy: 230, rx: 20, ry: 22 },
  { key: 'r_hip',        label: 'R. Hip',       shape: 'ellipse', cx: 116, cy: 230, rx: 20, ry: 22 },
  { key: 'l_knee',       label: 'L. Knee',      shape: 'ellipse', cx: 82,  cy: 284, rx: 15, ry: 14 },
  { key: 'r_knee',       label: 'R. Knee',      shape: 'ellipse', cx: 118, cy: 284, rx: 15, ry: 14 },
  { key: 'l_lower_leg',  label: 'L. Lower Leg', shape: 'ellipse', cx: 80,  cy: 318, rx: 12, ry: 24 },
  { key: 'r_lower_leg',  label: 'R. Lower Leg', shape: 'ellipse', cx: 120, cy: 318, rx: 12, ry: 24 },
  { key: 'l_foot',       label: 'L. Foot',      shape: 'ellipse', cx: 78,  cy: 350, rx: 14, ry:  9 },
  { key: 'r_foot',       label: 'R. Foot',      shape: 'ellipse', cx: 122, cy: 350, rx: 14, ry:  9 },
];

interface Props {
  field: FieldDefinition;
  value: string[];      // array of region keys
  onChange: (keys: string[]) => void;
}

export function BodyMap({ field, value, onChange }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const toggle = (key: string) => {
    onChange(
      value.includes(key) ? value.filter(k => k !== key) : [...value, key],
    );
  };

  const selected = new Set(value);

  return (
    <View style={styles.wrapper}>
      <View style={styles.svgContainer}>
        <Svg width={200} height={370} viewBox="0 0 200 370">
          {REGIONS.map((r) => {
            const isSelected = selected.has(r.key);
            const fill = isSelected ? palette.error + 'CC' : palette.surfaceAlt;
            const stroke = isSelected ? palette.error : palette.border;
            const props = {
              key: r.key,
              fill,
              stroke,
              strokeWidth: isSelected ? 2 : 1,
              onPress: () => toggle(r.key),
              accessibilityLabel: r.label,
              accessibilityRole: 'checkbox' as const,
              accessibilityState: { checked: isSelected },
            };
            if (r.shape === 'ellipse') {
              return (
                <Ellipse
                  {...props}
                  cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry}
                />
              );
            }
            return (
              <Rect
                {...props}
                x={r.x} y={r.y} width={r.w} height={r.h} rx={6}
              />
            );
          })}
        </Svg>
      </View>

      {/* Selected region chips */}
      {value.length > 0 && (
        <View style={styles.chips}>
          {value.map(key => {
            const region = REGIONS.find(r => r.key === key);
            return (
              <View key={key} style={styles.chip}>
                <Text style={styles.chipText}>{region?.label ?? key}</Text>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.instruction}>Tap body parts to mark affected areas</Text>
      {field.helpText ? <Text style={styles.hint}>{field.helpText}</Text> : null}
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  wrapper: { gap: 10, alignItems: 'center' },
  svgContainer: {
    borderWidth: 1, borderColor: palette.border,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: palette.surface,
    padding: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'stretch' },
  chip: {
    backgroundColor: palette.error + '22',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  chipText: { ...typography.small, color: palette.errorText, fontWeight: '600' },
  instruction: { ...typography.small, color: palette.textSecondary, textAlign: 'center' },
  hint: { ...typography.small, color: palette.textSecondary },
}));
