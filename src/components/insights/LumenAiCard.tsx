/** Insights tab entry to Lumen AI: chat, and a peek at the latest weekly review. */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Sparkles, ChevronRight } from 'lucide-react-native';
import { useAiAccess, useAiWeeklyReports, weekLabel } from '../../hooks/useAiChat';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

export function LumenAiCard() {
  const { palette } = useTheme();
  const styles = useStyles();
  const access = useAiAccess();
  const enabled = !!access.data?.fullAccess;
  const reports = useAiWeeklyReports(enabled);
  const latest = reports.data?.[0];

  if (!access.data) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Sparkles size={18} color={palette.primaryText} />
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>Lumen AI</Text>
      </View>
      <Text style={styles.sub} maxFontSizeMultiplier={1.3}>
        {enabled
          ? 'Ask anything about all your logs, notes, sleep, medicines and photos.'
          : 'Turn on in Settings → AI & Insights to chat about all your data, analyse photos and get a weekly review.'}
      </Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push(enabled ? '/ai/new' : '/settings')}
        accessibilityRole="button"
      >
        <Text style={styles.btnText} maxFontSizeMultiplier={1.3}>{enabled ? 'Ask Lumen AI' : 'Set up Lumen AI'}</Text>
      </TouchableOpacity>
      {enabled ? (
        <TouchableOpacity style={styles.row} onPress={() => router.push('/ai')} accessibilityRole="button">
          <Text style={styles.rowText} maxFontSizeMultiplier={1.3}>Past chats</Text>
          <ChevronRight size={16} color={palette.textSecondary} />
        </TouchableOpacity>
      ) : null}
      {latest ? (
        <TouchableOpacity style={styles.review} onPress={() => router.push('/ai/reports')} accessibilityRole="button">
          <Text style={styles.reviewTitle} maxFontSizeMultiplier={1.3}>Latest AI review · {weekLabel(latest.weekStart, latest.weekEnd)}</Text>
          <Text style={styles.reviewText} numberOfLines={3} maxFontSizeMultiplier={1.3}>{latest.text.replace(/[*#]/g, '').replace(/\s+/g, ' ').trim()}</Text>
        </TouchableOpacity>
      ) : enabled ? (
        <TouchableOpacity style={styles.row} onPress={() => router.push('/ai/reports')} accessibilityRole="button">
          <Text style={styles.rowText} maxFontSizeMultiplier={1.3}>Weekly AI reviews</Text>
          <ChevronRight size={16} color={palette.textSecondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  card: { backgroundColor: palette.surface, borderRadius: 26, padding: 16, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...typography.headline, color: palette.text },
  sub: { ...typography.footnote, color: palette.textSecondary, lineHeight: 18 },
  btn: { minHeight: 46, borderRadius: 23, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  btnText: { ...typography.bodyBold, color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  rowText: { ...typography.body, color: palette.primaryText },
  review: { backgroundColor: palette.background, borderRadius: 16, padding: 12, gap: 4 },
  reviewTitle: { ...typography.footnote, fontWeight: '600', color: palette.text },
  reviewText: { ...typography.footnote, color: palette.textSecondary, lineHeight: 18 },
}));
