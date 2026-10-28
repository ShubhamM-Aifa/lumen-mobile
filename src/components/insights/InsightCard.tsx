/**
 * InsightCard: one pattern from the member's own logs.
 *
 * Plain sentence, the counts behind it ("9 of 14 days"), a verbal strength, and an always-visible
 * line that this is not a cause. Words come from insightCopy.ts, which has one test for all of them.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import type { InsightFinding } from '../../hooks/useInsights';
import { RateBars } from './RateBars';
import { useExplain } from '../../hooks/useExplain';
import {
  headline, notSeenSince, rates, statLine, tierLabel, tierNote, TOGETHER_NOT_CAUSE,
} from '../../services/insights/insightCopy';

interface Props {
  finding: InsightFinding;
  /** "Not useful": hide this pattern on this phone. */
  onDismiss?: (finding: InsightFinding) => void;
  /** "Test it": start a 6-week guided experiment on this exposure and outcome. */
  onTestIt?: (finding: InsightFinding) => void;
  /** Disables "Test it" while another experiment is already running. */
  testItDisabled?: boolean;
  /** preferences.aiExplanations — off by default; "Explain" only shows when the member turned it on. */
  aiExplanationsEnabled?: boolean;
}

export function InsightCard({ finding, onDismiss, onTestIt, testItDisabled, aiExplanationsEnabled }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const { withRate, otherRate } = rates(finding);
  const faded = finding.noLongerSeen;
  const tone = finding.tier === 'consistent' ? palette.success : palette.warning;
  const explain = useExplain();
  const [explanation, setExplanation] = useState<{ text: string; source: 'ai' | 'template' } | null>(null);

  const handleExplain = () => {
    explain.mutate(
      { kind: 'finding', exposureKey: finding.exposureKey, outcomeKey: finding.outcomeKey, lagDays: finding.lagDays },
      { onSuccess: res => setExplanation(res) },
    );
  };

  return (
    <View
      style={[styles.card, faded && styles.faded]}
      accessible
      accessibilityLabel={`${faded ? 'Earlier pattern. ' : ''}${headline(finding)} ${statLine(finding)}`}
    >
      <View style={styles.top}>
        <View style={styles.entities}>
          {finding.exposure.categoryIcon ? <Text style={styles.icon}>{finding.exposure.categoryIcon}</Text> : null}
          <Text style={styles.entity} numberOfLines={1} maxFontSizeMultiplier={1.3}>{finding.exposure.optionLabel}</Text>
          <Text style={styles.arrow}>→</Text>
          {finding.outcome.categoryIcon ? <Text style={styles.icon}>{finding.outcome.categoryIcon}</Text> : null}
          <Text style={styles.entity} numberOfLines={1} maxFontSizeMultiplier={1.3}>{finding.outcome.optionLabel}</Text>
        </View>
        <View style={[styles.badge, { borderColor: tone + '66', backgroundColor: tone + '16' }]}>
          <View style={[styles.dot, { backgroundColor: tone }]} />
          <Text style={[styles.badgeText, { color: tone }]} maxFontSizeMultiplier={1.2}>{tierLabel(finding.tier)}</Text>
        </View>
      </View>

      <Text style={styles.headline} maxFontSizeMultiplier={1.3}>{headline(finding)}</Text>
      <Text style={styles.stat} maxFontSizeMultiplier={1.3}>{statLine(finding)}</Text>

      <RateBars
        withRate={withRate}
        otherRate={otherRate}
        withLabel={finding.lagDays <= 0 ? `With ${finding.exposure.optionLabel}` : `After ${finding.exposure.optionLabel}`}
      />

      <Text style={styles.note} maxFontSizeMultiplier={1.3}>
        {faded ? `${notSeenSince(finding.lastShownDay)}. ` : `${tierNote(finding.tier)} `}
        {finding.weakDays ? 'Some of these days had only a little logged, so treat it gently.' : ''}
      </Text>
      <Text style={styles.together} maxFontSizeMultiplier={1.3}>{TOGETHER_NOT_CAUSE}</Text>

      {explanation ? (
        <View style={styles.explainBox}>
          <Text style={styles.explainTag} maxFontSizeMultiplier={1.3}>{explanation.source === 'ai' ? 'AI-written' : 'Plain-language summary'}</Text>
          <Text style={styles.explainText} maxFontSizeMultiplier={1.3}>{explanation.text}</Text>
        </View>
      ) : null}

      {(onDismiss || onTestIt || (aiExplanationsEnabled && !faded)) ? (
        <View style={styles.actions}>
          {aiExplanationsEnabled && !faded && !explanation ? (
            <TouchableOpacity
              style={styles.action}
              onPress={handleExplain}
              disabled={explain.isPending}
              accessibilityRole="button"
              accessibilityLabel={`Explain this pattern about ${finding.exposure.optionLabel} and ${finding.outcome.optionLabel} in plain words`}
            >
              {explain.isPending
                ? <ActivityIndicator size="small" color={palette.primaryText} />
                : <Text style={styles.actionText} maxFontSizeMultiplier={1.3}>Explain</Text>}
            </TouchableOpacity>
          ) : null}
          {onTestIt && !faded ? (
            <TouchableOpacity
              style={styles.action}
              onPress={() => onTestIt(finding)}
              disabled={testItDisabled}
              accessibilityRole="button"
              accessibilityLabel={`Test it: start a 6-week experiment on ${finding.exposure.optionLabel} and ${finding.outcome.optionLabel}`}
            >
              <Text style={[styles.actionText, testItDisabled && styles.actionTextDisabled]} maxFontSizeMultiplier={1.3}>Test it</Text>
            </TouchableOpacity>
          ) : null}
          {onDismiss ? (
            <TouchableOpacity
              style={styles.action}
              onPress={() => onDismiss(finding)}
              accessibilityRole="button"
              accessibilityLabel={`Not useful: hide this pattern about ${finding.exposure.optionLabel} and ${finding.outcome.optionLabel}`}
            >
              <Text style={styles.actionText} maxFontSizeMultiplier={1.3}>Not useful</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  card: { backgroundColor: palette.surface, borderRadius: 26, padding: 16, gap: 10 },
  faded: { opacity: 0.7 },
  top: { gap: 8 },
  entities: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  icon: { fontSize: 16 },
  entity: { ...typography.bodyBold, color: palette.text, flexShrink: 1 },
  arrow: { ...typography.body, color: palette.textSecondary },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  badgeText: { ...typography.caption, fontWeight: '700' },
  headline: { ...typography.headline, color: palette.text, lineHeight: 24 },
  stat: { ...typography.body, color: palette.textSecondary, lineHeight: 22 },
  note: { ...typography.footnote, color: palette.textSecondary, lineHeight: 19 },
  together: { ...typography.footnote, fontWeight: '600', color: palette.text, lineHeight: 19 },
  explainBox: { backgroundColor: palette.primaryText + '0f', borderRadius: 16, padding: 12, gap: 4 },
  explainTag: { ...typography.caption, fontWeight: '700', color: palette.primaryText },
  explainText: { ...typography.body, color: palette.text, lineHeight: 21 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  action: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 8 },
  actionText: { ...typography.body, color: palette.primaryText },
  actionTextDisabled: { color: palette.textDisabled },
}));
