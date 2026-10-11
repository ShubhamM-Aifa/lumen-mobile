/**
 * ChestMap — Clinical 8-zone anatomical chest & rib cage mapping.
 * Used for costochondritis, pleuritis, Tietze syndrome, pericarditis, and chest pain tracking.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Path, Rect, Circle, G, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { FieldDefinition } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

export interface ChestRegion {
  key: string;
  label: string;
  shortName: string;
  subtext: string;
  d: string;
  textPos: { x: number; y: number };
}

export const CHEST_REGIONS: ChestRegion[] = [
  // 1. Right Upper / Infraclavicular
  {
    key: 'chest_right_upper',
    label: 'R. Upper Ribs / Infraclavicular',
    shortName: 'R. Upper',
    subtext: 'Ribs 1-2 & Apex',
    d: 'M 50 40 C 65 35, 85 45, 95 65 L 95 95 L 35 90 C 35 65, 42 48, 50 40 Z',
    textPos: { x: 65, y: 70 },
  },
  // 2. Left Upper / Infraclavicular
  {
    key: 'chest_left_upper',
    label: 'L. Upper Ribs / Infraclavicular',
    shortName: 'L. Upper',
    subtext: 'Ribs 1-2 & Apex',
    d: 'M 150 40 C 135 35, 115 45, 105 65 L 105 95 L 165 90 C 165 65, 158 48, 150 40 Z',
    textPos: { x: 135, y: 70 },
  },
  // 3. Right Parasternal (Ribs 2-5)
  {
    key: 'chest_right_parasternal',
    label: 'Right Parasternal (Costochondral)',
    shortName: 'R. Parasternal',
    subtext: 'Ribs 2-5 Joints',
    d: 'M 35 98 L 95 102 L 95 160 L 30 152 C 28 130, 31 112, 35 98 Z',
    textPos: { x: 62, y: 130 },
  },
  // 4. Mid-Sternum / Substernal
  {
    key: 'chest_substernal',
    label: 'Mid-Sternum / Substernal',
    shortName: 'Sternum',
    subtext: 'Sternal Body',
    d: 'M 98 68 L 102 68 L 105 168 L 95 168 Z',
    textPos: { x: 100, y: 118 },
  },
  // 5. Left Sternal Border / Precordial (Ribs 3-5)
  {
    key: 'chest_precordial',
    label: 'Precordial (Costochondritis)',
    shortName: 'Precordial',
    subtext: 'Left Ribs 3-5',
    d: 'M 105 102 L 165 98 C 169 112, 172 130, 170 152 L 105 160 Z',
    textPos: { x: 138, y: 130 },
  },
  // 6. Xiphisternal / Epigastric
  {
    key: 'chest_xiphoid',
    label: 'Xiphoid Process (Lower Sternum)',
    shortName: 'Xiphoid',
    subtext: 'Epigastric junction',
    d: 'M 95 174 L 105 174 L 102 205 L 98 205 Z',
    textPos: { x: 100, y: 190 },
  },
  // 7. Right Subcostal Margin
  {
    key: 'chest_right_subcostal',
    label: 'Right Lower Rib Margin',
    shortName: 'R. Subcostal',
    subtext: 'Lower Ribs 7-10',
    d: 'M 28 160 L 92 168 L 90 205 C 70 215, 45 208, 25 195 C 26 182, 27 170, 28 160 Z',
    textPos: { x: 58, y: 185 },
  },
  // 8. Left Subcostal Margin
  {
    key: 'chest_left_subcostal',
    label: 'Left Lower Rib Margin',
    shortName: 'L. Subcostal',
    subtext: 'Lower Ribs 7-10',
    d: 'M 172 160 L 108 168 L 110 205 C 130 215, 155 208, 175 195 C 174 182, 173 170, 172 160 Z',
    textPos: { x: 142, y: 185 },
  },
];

interface Props {
  field?: FieldDefinition;
  value: string[];
  onChange: (keys: string[]) => void;
}

export function ChestMap({ value = [], onChange }: Props) {
  const { palette, colorScheme } = useTheme();
  const styles = useStyles();
  const isDark = colorScheme === 'dark';

  const selected = new Set(value);

  const toggle = (key: string) => {
    Haptics.selectionAsync();
    if (selected.has(key)) {
      onChange(value.filter(k => k !== key));
    } else {
      onChange([...value, key]);
    }
  };

  const clearAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange([]);
  };

  return (
    <View style={styles.container}>
      {/* Top Header / Instructions */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>8-Zone Clinical Chest Map</Text>
          <Text style={styles.subtitle}>
            Tap anatomical areas experiencing pain, costochondral swelling, or pleuritic tightness
          </Text>
        </View>
        {value.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear ({value.length})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* SVG Interactive Rib Cage Graphic */}
      <View style={styles.svgCard}>
        <Svg width="100%" height={250} viewBox="0 0 200 230">
          {/* Background Rib Cage Bone Outline */}
          <G opacity={isDark ? 0.25 : 0.2} stroke={palette.textSecondary} strokeWidth={1.5} fill="none">
            {/* Clavicles */}
            <Path d="M 15 35 Q 60 45, 95 50 M 185 35 Q 140 45, 105 50" />
            {/* Rib Arches */}
            <Path d="M 30 75 Q 65 85, 95 88 M 170 75 Q 135 85, 105 88" />
            <Path d="M 25 110 Q 65 120, 95 125 M 175 110 Q 135 120, 105 125" />
            <Path d="M 22 145 Q 65 155, 95 160 M 178 145 Q 135 155, 105 160" />
            <Path d="M 20 180 Q 60 195, 92 205 M 180 180 Q 140 195, 108 205" />
          </G>

          {/* Interactive Topographical Zones */}
          {CHEST_REGIONS.map((r) => {
            const isSelected = selected.has(r.key);
            const fill = isSelected ? palette.primary + 'EE' : (isDark ? '#2A241E' : '#F5EFEB');
            const stroke = isSelected ? palette.primary : (isDark ? '#4A4036' : '#D8CEC4');

            return (
              <G key={r.key} onPress={() => toggle(r.key)}>
                <Path
                  d={r.d}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected ? 2.5 : 1}
                  strokeLinejoin="round"
                />
                <SvgText
                  x={r.textPos.x}
                  y={r.textPos.y}
                  fill={isSelected ? '#FFFFFF' : palette.text}
                  fontSize={8.5}
                  fontWeight={isSelected ? 'bold' : '600'}
                  textAnchor="middle"
                >
                  {r.shortName}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Selected Zones Badges */}
      {value.length > 0 && (
        <View style={styles.chipsContainer}>
          <Text style={styles.chipsTitle}>Selected Pain Sites:</Text>
          <View style={styles.chipsRow}>
            {value.map((k) => {
              const region = CHEST_REGIONS.find(r => r.key === k);
              if (!region) return null;
              return (
                <TouchableOpacity
                  key={k}
                  style={[styles.chip, { borderColor: palette.primary, backgroundColor: palette.primary + '18' }]}
                  onPress={() => toggle(k)}
                >
                  <Text style={[styles.chipText, { color: palette.primary }]}>
                    {region.label} ✕
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  container: {
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    ...typography.bodyBold,
    fontSize: 14.5,
    color: palette.text,
  },
  subtitle: {
    ...typography.caption,
    color: palette.textSecondary,
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: palette.surfaceAlt,
  },
  clearBtnText: {
    fontSize: 11,
    color: palette.primary,
    fontWeight: '600',
  },
  svgCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  chipsContainer: {
    marginTop: 10,
    gap: 6,
  },
  chipsTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
}));
