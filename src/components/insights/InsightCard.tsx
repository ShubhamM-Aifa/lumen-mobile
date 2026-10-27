/**
 * InsightCard — displays one computed pattern finding.
 * Uses only observation language; never says "caused".
 * Expandable to show lag window details.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

export interface InsightResult {
  _id: string;
  /** `opt_<optionId>`, `qa_<quickActionId>` or `cat_<categoryId>`; used to match what the patient just logged. */
  triggerId?: string;
  symptomId?: string;
  trigger: { categoryName: string; optionLabel: string; categoryIcon?: string };
  symptom: { categoryName: string; optionLabel: string; categoryIcon?: string };
  lagWindow: string;     // e.g. '24-48h'
  lift: number;          // e.g. 1.8 = 80 % more common after trigger
  supportCount: number;
  confidence: 'Low' | 'Medium' | 'High';
  computedAt: string;
}

const LAG_LABELS: Record<string, string> = {
  '0-6h': 'within 6 h',
  '6-24h': 'within 6–24 h',
  '24-48h': 'within 24–48 h',
  '48-72h': 'within 48–72 h',
};

function liftDescription(lift: number): string {
  const pct = Math.round((lift - 1) * 100);
  if (lift < 1) return `${Math.round((1 - lift) * 100)}% less common`;
  if (pct < 20) return 'slightly more common';
  if (pct < 60) return `${pct}% more common`;
  return `${pct}% more common`;
}

export function InsightCard({ insight }: { insight: InsightResult }) {
  const { palette } = useTheme();
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);
  const confColor =
    insight.confidence === 'High'
      ? palette.success
      : insight.confidence === 'Medium'
      ? palette.warning
      : palette.textDisabled;
  const lagLabel = LAG_LABELS[insight.lagWindow] ?? insight.lagWindow;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setExpanded(v => !v)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Insight: ${insight.trigger.optionLabel} and ${insight.symptom.optionLabel}`}
    >
      {/* Trigger → Symptom header */}
      <View style={styles.header}>
        <View style={styles.entityWrap}>
          {insight.trigger.categoryIcon && <Text style={styles.entityIcon}>{insight.trigger.categoryIcon}</Text>}
          <View>
            <Text style={styles.entityCat}>{insight.trigger.categoryName}</Text>
            <Text style={styles.entityLabel}>{insight.trigger.optionLabel}</Text>
          </View>
        </View>

        <View style={styles.arrow}>
          <Text style={styles.arrowLine}>→</Text>
          <Text style={styles.lagText}>{lagLabel}</Text>
        </View>

        <View style={[styles.entityWrap, styles.symptomWrap]}>
          {insight.symptom.categoryIcon && <Text style={styles.entityIcon}>{insight.symptom.categoryIcon}</Text>}
          <View>
            <Text style={styles.entityCat}>{insight.symptom.categoryName}</Text>
            <Text style={styles.entityLabel}>{insight.symptom.optionLabel}</Text>
          </View>
        </View>
      </View>

      {/* Summary line */}
      <Text style={styles.summary}>
        <Text style={styles.bold}>{liftDescription(insight.lift)}</Text>
        {' '}after logging {insight.trigger.optionLabel} · {insight.supportCount} times observed
      </Text>

      {/* Confidence badge */}
      <View style={styles.footer}>
        <View style={[styles.badge, { borderColor: confColor + '66', backgroundColor: confColor + '16' }]}>
          <View style={[styles.badgeDot, { backgroundColor: confColor }]} />
          <Text style={[styles.badgeText, { color: confColor }]}>{insight.confidence} confidence</Text>
        </View>
        <Text style={styles.expand}>{expanded ? '▲ Less' : '▼ Details'}</Text>
      </View>

      {/* Expanded details */}
      {expanded && (
        <View style={styles.details}>
          <Text style={styles.detailsText}>
            Based on your recorded data, {insight.symptom.optionLabel.toLowerCase()} was logged{' '}
            {liftDescription(insight.lift)} in the {lagLabel} after days you recorded{' '}
            {insight.trigger.optionLabel.toLowerCase()} ({insight.supportCount} of your entries).
            {'\n\n'}
            This is an <Text style={styles.bold}>observed pattern</Text>, not a proven cause.
            Many factors may be involved. Consider discussing this with your healthcare provider.
          </Text>
          <Text style={styles.computedAt}>
            Analysed {new Date(insight.computedAt).toLocaleDateString()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles(palette => ({
  card: {
    backgroundColor: palette.surface, borderRadius: 26,
    padding: 16, gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  entityWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  symptomWrap: { justifyContent: 'flex-end' },
  entityIcon: { fontSize: 18, marginTop: 2 },
  entityCat: { ...typography.caption, color: palette.textDisabled, textTransform: 'uppercase', letterSpacing: 0.3 },
  entityLabel: { ...typography.bodyBold, color: palette.text },
  arrow: { alignItems: 'center', paddingTop: 4 },
  arrowLine: { ...typography.h4, color: palette.primaryText },
  lagText: { ...typography.caption, color: palette.textSecondary, textAlign: 'center', marginTop: 2 },
  summary: { ...typography.small, color: palette.textSecondary, lineHeight: 18 },
  bold: { fontWeight: '700', color: palette.text },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeDot: { width: 7, height: 7, borderRadius: 3.5 },
  badgeText: { ...typography.caption, fontWeight: '700' },
  expand: { ...typography.small, color: palette.primaryText },
  details: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12, gap: 8 },
  detailsText: { ...typography.small, color: palette.textSecondary, lineHeight: 20 },
  computedAt: { ...typography.caption, color: palette.textDisabled },
}));
