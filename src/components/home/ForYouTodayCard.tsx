import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useIntelligenceStore } from '../../store/intelligenceStore';

/**
 * "For you today": shows flare mode status and any observations the daily budget kept off the
 * lock screen. Renders nothing when there is nothing to show, so it never adds noise.
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

  if (!flareActive && inbox.length === 0) return null;

  return (
    <View style={styles.wrap} accessibilityRole="summary" accessibilityLabel="For you today">
      <Text style={styles.heading}>For you today</Text>

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

      {inbox.map(({ candidate }) => {
        const open = expandedId === candidate.id;
        return (
          <View key={candidate.id} style={styles.item}>
            <Text style={styles.itemTitle}>{candidate.title}</Text>
            <Text style={styles.body}>{candidate.body}</Text>

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
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  heading: { ...typography.h3, color: palette.text },
  flareBox: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  flareTitle: { ...typography.body, fontWeight: '700', color: palette.text },
  item: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 12,
    gap: 6,
  },
  itemTitle: { ...typography.body, fontWeight: '700', color: palette.text },
  body: { ...typography.small, color: palette.textSecondary, lineHeight: 20 },
  provenance: { backgroundColor: palette.surfaceAlt, borderRadius: 10, padding: 10, gap: 4 },
  provenanceLine: { ...typography.caption, color: palette.textSecondary, lineHeight: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  linkBtn: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 10 },
  linkText: { ...typography.small, fontWeight: '600', color: palette.primary },
  secondaryBtn: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.primary,
  },
  secondaryText: { ...typography.small, fontWeight: '700', color: palette.primary },
}));
