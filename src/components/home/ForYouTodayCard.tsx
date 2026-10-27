import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useIntelligenceStore } from '../../store/intelligenceStore';
import { IconTile } from '../ios/InsetGroup';

/**
 * "For you today": flare mode status and the observations Lumen has for the patient, such as
 * "You logged Dairy at lunch. Digestive issues have been more common 6-24 h after it."
 * Renders nothing when there is nothing to show, so it never adds noise.
 */
export function ForYouTodayCard() {
  const styles = useStyles();
  const { palette } = useTheme();
  const flareActive = useIntelligenceStore(s => s.policy.flareMode.active);
  const flareSource = useIntelligenceStore(s => s.policy.flareMode.source);
  const inbox = useIntelligenceStore(s => s.inbox);
  const setFlareMode = useIntelligenceStore(s => s.setFlareMode);
  const dismiss = useIntelligenceStore(s => s.dismissInboxItem);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const now = Date.now();
  const waiting = inbox
    .filter(i => i.candidate.expiresAt === undefined || i.candidate.expiresAt > now)
    .sort((a, b) => (b.candidate.confidence * b.candidate.timeliness) - (a.candidate.confidence * a.candidate.timeliness) || b.addedAt - a.addedAt);
  // Only the best observation is shown; dismissing it brings the next one forward.
  const items = waiting.slice(0, 1);

  if (!flareActive && items.length === 0) return null;

  return (
    <View style={styles.wrap} accessibilityRole="summary" accessibilityLabel="For you today">
      {flareActive && (
        <View style={styles.flareBox}>
          <Text style={styles.flareTitle}>Flare mode is on</Text>
          <Text style={styles.body}>
            I'll keep things quiet and only remind you about medication.
            {flareSource === 'auto' ? ' I turned this on because your recent logs have been higher than usual.' : ''}
          </Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setFlareMode(false)}
              accessibilityRole="button"
              accessibilityLabel="Turn flare mode off"
            >
              <Text style={styles.secondaryText}>Turn off</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => router.push('/notification-settings')}
              accessibilityRole="button"
              accessibilityLabel="Open notification settings"
            >
              <Text style={styles.linkText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {items.map(({ candidate }, index) => {
        const open = expandedId === candidate.id;
        const route = typeof candidate.data?.route === 'string' ? candidate.data.route : undefined;
        const isWatch = candidate.type === 'TRIGGER_WATCH';
        return (
          <View key={candidate.id} style={[styles.item, (index > 0 || flareActive) && styles.itemSeparated]}>
            <View style={styles.head}>
              <IconTile icon={Sparkles} color="#5856D6" size={26} />
              <Text style={styles.label} maxFontSizeMultiplier={1.3}>For you today</Text>
              {waiting.length > 1 ? (
                <Text style={styles.count} maxFontSizeMultiplier={1.3}>{`1 of ${waiting.length}`}</Text>
              ) : null}
            </View>

            {isWatch ? (
              <Text style={styles.paragraph}>{`${candidate.title}. ${candidate.body}`}</Text>
            ) : (
              <>
                <Text style={styles.itemTitle}>{candidate.title}</Text>
                <Text style={styles.body}>{candidate.body}</Text>
              </>
            )}

            {route ? (
              <TouchableOpacity
                style={styles.primaryLink}
                onPress={() => router.push(route as never)}
                accessibilityRole="button"
                accessibilityLabel="See pattern"
              >
                <Text style={styles.primaryLinkText} maxFontSizeMultiplier={1.3}>{isWatch ? 'See Pattern' : 'See details'}</Text>
              </TouchableOpacity>
            ) : null}

            {open && candidate.provenance && candidate.provenance.length > 0 && (
              <View style={styles.provenance}>
                {candidate.provenance.map((line, i) => (
                  <Text key={i} style={styles.provenanceLine}>{`• ${line}`}</Text>
                ))}
              </View>
            )}

            <View style={styles.row}>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => setExpandedId(open ? null : candidate.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel="Why am I seeing this?"
              >
                <Text style={styles.linkText}>{open ? 'Hide why' : 'Why am I seeing this?'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => dismiss(candidate.id, 'not_useful')}
                accessibilityRole="button"
                accessibilityLabel="Not useful"
              >
                <Text style={[styles.linkText, { color: palette.textSecondary }]}>Not useful</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => dismiss(candidate.id)}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
              >
                <Text style={[styles.linkText, { color: palette.textSecondary }]}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  wrap: {
    backgroundColor: palette.surface,
    marginHorizontal: 16,
    borderRadius: 26,
    padding: 16,
    gap: 12,
  },
  flareBox: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  flareTitle: { ...typography.headline, color: palette.text },
  item: { gap: 8 },
  itemSeparated: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { ...typography.sectionLabel, color: palette.textSecondary },
  count: { ...typography.footnote, color: palette.textSecondary, marginLeft: 'auto' },
  paragraph: { ...typography.bodyLarge, color: palette.text },
  itemTitle: { ...typography.headline, color: palette.text },
  body: { ...typography.subhead, color: palette.textSecondary },
  primaryLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  primaryLinkText: { ...typography.subheadBold, color: palette.primaryText },
  provenance: { backgroundColor: palette.surfaceAlt, borderRadius: 14, padding: 12, gap: 4 },
  provenanceLine: { ...typography.footnote, color: palette.textSecondary },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 4 },
  linkBtn: { minHeight: 44, justifyContent: 'center', paddingRight: 12 },
  linkText: { ...typography.footnote, fontWeight: '600', color: palette.primaryText },
  secondaryBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: palette.tint + '1F',
  },
  secondaryText: { ...typography.subheadBold, color: palette.primaryText },
}));
