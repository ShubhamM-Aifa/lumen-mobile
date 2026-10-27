import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppleSwitch } from '../common/AppleSwitch';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

export type IconComponent = LucideIcon | React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Rounded 30pt coloured square with a white glyph, as used in iOS grouped lists. */
export function IconTile({ icon: Icon, emoji, color, size = 30 }: { icon?: IconComponent; emoji?: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.27, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      {emoji ? (
        <Text style={{ fontSize: Math.round(size * 0.55) }} allowFontScaling={false}>{emoji}</Text>
      ) : Icon ? (
        <Icon size={Math.round(size * 0.58)} color="#FFFFFF" strokeWidth={2.2} />
      ) : null}
    </View>
  );
}

export interface RowProps {
  label: string;
  sub?: string;
  value?: string;
  icon?: IconComponent;
  /** Emoji glyph on the tile, for user-defined icons that are not Lucide components. */
  emoji?: string;
  tile?: string;
  /** 0 to 1. Draws a thin progress bar under the label. */
  progress?: number;
  progressColor?: string;
  chevron?: boolean;
  /** Renders a switch instead of a chevron. */
  toggle?: boolean;
  toggled?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  destructive?: boolean;
  accessibilityLabel?: string;
  /** Custom control at the end of the row, e.g. a stepper. Shown instead of the chevron. */
  trailing?: React.ReactNode;
  disabled?: boolean;
  /** Colour for the value text, e.g. blue for an unread time. */
  valueColor?: string;
  /** Greys out the label and sub text, e.g. for something already read. */
  muted?: boolean;
  /** Lines of sub text to show before cutting it off. */
  subLines?: number;
}

/** One row of an InsetGroup. Min height 52pt, hairline separator inset to the label. */
export function GroupedRow({ label, sub, value, icon, emoji, tile, progress, progressColor, chevron, toggle, toggled, onToggle, onPress, destructive, accessibilityLabel, trailing, disabled, valueColor, muted, subLines }: RowProps & { isLast?: boolean }) {
  const styles = useStyles();
  const { palette } = useTheme();
  const interactive = !!onPress && !toggle;

  const content = (
    <>
      {(icon || emoji) && tile ? <IconTile icon={icon} emoji={emoji} color={tile} /> : null}
      <View style={styles.body}>
        <View style={styles.main}>
          <Text style={[styles.label, destructive && { color: palette.errorText }, muted && { color: palette.textSecondary }]} numberOfLines={2} maxFontSizeMultiplier={1.4}>{label}</Text>
          {sub ? <Text style={styles.sub} numberOfLines={subLines} maxFontSizeMultiplier={1.4}>{sub}</Text> : null}
          {progress !== undefined ? (
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`, backgroundColor: progressColor ?? palette.tint }]} />
            </View>
          ) : null}
        </View>
        {value ? <Text style={[styles.value, valueColor ? { color: valueColor } : null]} numberOfLines={1} maxFontSizeMultiplier={1.4}>{value}</Text> : null}
        {toggle ? (
          <AppleSwitch
            value={!!toggled}
            onValueChange={onToggle}
            disabled={disabled}
            activeColor={palette.success || '#34C759'}
            accessibilityLabel={accessibilityLabel ?? label}
          />
        ) : trailing ? (
          trailing
        ) : chevron ? (
          <ChevronRight size={18} color={palette.textSecondary} />
        ) : null}
      </View>
    </>
  );

  if (interactive) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? [label, value, sub].filter(Boolean).join(', ')}
      >
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.row}>{content}</View>;
}

interface GroupProps {
  title?: string;
  footer?: string;
  children: React.ReactNode;
}

/** Inset grouped list container: white card, radius 26, rows separated by hairlines. */
export function InsetGroup({ title, footer, children }: GroupProps) {
  const styles = useStyles();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.groupWrap}>
      {title ? <Text style={styles.groupTitle} accessibilityRole="header">{title}</Text> : null}
      <View style={styles.card}>
        {rows.map((child, i) => (
          <View key={i} style={i < rows.length - 1 ? styles.separated : undefined}>{child}</View>
        ))}
      </View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  groupWrap: { gap: 7 },
  groupTitle: { ...typography.sectionLabel, color: palette.textSecondary, paddingHorizontal: 20 },
  footer: { ...typography.footnote, color: palette.textSecondary, paddingHorizontal: 20 },
  card: { marginHorizontal: 16, backgroundColor: palette.surface, borderRadius: 26, overflow: 'hidden' },
  separated: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, minHeight: 52 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16, paddingVertical: 8, minHeight: 52 },
  main: { flex: 1, gap: 1 },
  label: { ...typography.bodyLarge, color: palette.text },
  sub: { ...typography.footnote, color: palette.textSecondary },
  value: { ...typography.bodyLarge, color: palette.textSecondary, maxWidth: '45%' },
  barTrack: { width: 140, height: 4, borderRadius: 2, backgroundColor: palette.surfaceAlt, overflow: 'hidden', marginTop: 5 },
  barFill: { height: '100%', borderRadius: 2 },
}));
