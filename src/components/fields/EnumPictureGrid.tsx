/**
 * EnumPictureGrid — a 2- or 3-column grid of illustrated cards.
 * Used for Bristol stool scale (1-7) and urine colour chart.
 * Each card shows a color swatch, optional emoji, label, and description.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { FieldDefinition, EnumValue } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  field: FieldDefinition;
  value: string;
  onChange: (v: string) => void;
}

export function EnumPictureGrid({ field, value, onChange }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = React.useState<number>(0);
  const items: EnumValue[] = field.enumValues ?? [];
  const cols = items.length <= 4 ? 2 : 3;
  const gap = 8;
  const availableWidth = containerWidth > 0 ? containerWidth : Math.max(180, width - 64);
  const cardW = Math.max(70, Math.floor((availableWidth - gap * (cols - 1)) / cols));

  return (
    <View
      style={styles.wrapper}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - containerWidth) > 2) {
          setContainerWidth(w);
        }
      }}
    >
      <View style={[styles.grid, { gap }]}>
        {items.map((item) => {
          const selected = value === item.value;
          const swatchColor = item.color ?? palette.border;
          return (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.card,
                { width: cardW },
                selected && styles.cardSelected,
              ]}
              onPress={() => onChange(selected ? '' : item.value)}
              accessibilityRole="radio"
              accessibilityLabel={`${item.label}${item.description ? ': ' + item.description : ''}`}
              accessibilityState={{ checked: selected }}
            >
              {/* Color swatch */}
              <View style={[styles.swatch, { backgroundColor: swatchColor }]}>
                {item.icon ? (
                  <Text style={styles.swatchIcon}>{item.icon}</Text>
                ) : null}
                {selected && <Text style={styles.checkmark}>✓</Text>}
              </View>

              <View style={styles.cardBody}>
                <Text style={[styles.cardLabel, selected && styles.cardLabelSelected]} numberOfLines={2}>
                  {item.label}
                </Text>
                {item.description ? (
                  <Text style={styles.cardDesc} numberOfLines={3}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {field.helpText ? <Text style={styles.hint}>{field.helpText}</Text> : null}
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  wrapper: { gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  cardSelected: {
    borderColor: palette.primary,
    shadowColor: palette.primary,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  swatch: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchIcon: { fontSize: 32 },
  checkmark: {
    position: 'absolute', top: 6, right: 8,
    fontSize: 18, color: palette.white,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  cardBody: { padding: 10 },
  cardLabel: { ...typography.smallBold, color: palette.text },
  cardLabelSelected: { color: palette.primaryText },
  cardDesc: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  hint: { ...typography.small, color: palette.textSecondary },
}));
