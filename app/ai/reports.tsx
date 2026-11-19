/** Lumen AI's weekly reviews (written every Monday; the latest week can also be written now). */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { ScreenTopBar } from '../../src/components/ios/ScreenTopBar';
import { AiSetupNotice } from '../../src/components/ai/AiSetupNotice';
import { AiMessageText } from '../../src/components/ai/AiMessageText';
import { router } from 'expo-router';
import { useAiAccess, useAiWeeklyReports, useGenerateWeeklyReport, useSaveReviewAsNote, weekLabel } from '../../src/hooks/useAiChat';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { useAskLumenAi } from '../../src/hooks/useAskLumenAi';
import { typography } from '../../src/theme/typography';

export default function AiWeeklyReportsScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const access = useAiAccess();
  const enabled = !!access.data?.fullAccess;
  const reports = useAiWeeklyReports(enabled);
  const generate = useGenerateWeeklyReport();
  const saveReview = useSaveReviewAsNote();
  const { ask } = useAskLumenAi();
  const [open, setOpen] = useState<string | null>(null);

  if (access.data && !enabled) {
    return (
      <View style={styles.screen}>
        <ScreenTopBar title="Weekly AI reviews" fallbackRoute="/ai" />
        <AiSetupNotice configured={access.data.configured} />
      </View>
    );
  }

  const writeNow = () =>
    generate.mutate({}, {
      onSuccess: res => {
        if (!res.report) Alert.alert('Could not write the review', res.error === 'rate_limited' ? "Gemini's free tier is busy. Try again in a little while." : 'Please try again shortly.');
        else setOpen(res.report.id);
      },
      onError: e => Alert.alert('Could not write the review', e instanceof Error ? e.message : ''),
    });

  const shownOpen = open ?? reports.data?.[0]?.id ?? null;

  return (
    <View style={styles.screen}>
      <ScreenTopBar title="Weekly AI reviews" fallbackRoute="/ai" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.intro} maxFontSizeMultiplier={1.3}>
          Every Monday morning Lumen AI reads everything you logged the week before and writes a review. It can be wrong — treat it as a second pair of eyes, not a diagnosis.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={writeNow} disabled={generate.isPending} accessibilityRole="button">
          {generate.isPending
            ? <><ActivityIndicator color={palette.primaryText} /><Text style={styles.btnText}>Writing… this can take a minute</Text></>
            : <Text style={styles.btnText}>Write last week’s review now</Text>}
        </TouchableOpacity>

        {reports.isLoading ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}
        {reports.data?.length === 0 ? <Text style={styles.empty}>No reviews yet.</Text> : null}
        {reports.data?.map(r => {
          const expanded = shownOpen === r.id;
          return (
            // A View with sibling buttons: a button inside the card's own button breaks on web.
            <View key={r.id} style={styles.card}>
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() => setOpen(expanded ? '' : r.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
              >
                <Text style={styles.week} maxFontSizeMultiplier={1.3}>Week of {weekLabel(r.weekStart, r.weekEnd)}</Text>
                {r.modelLabel ? <Text style={styles.model} maxFontSizeMultiplier={1.2}>Written by {r.modelLabel}</Text> : null}
                {expanded
                  ? <AiMessageText text={r.text} style={styles.text} />
                  : <Text style={styles.preview} numberOfLines={3} maxFontSizeMultiplier={1.3}>{r.text.replace(/[*#]/g, '').replace(/\s+/g, ' ').trim()}</Text>}
              </TouchableOpacity>
              {expanded ? (
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => saveReview.mutate(r.id, {
                      onSuccess: res => Alert.alert('Saved to Notes', `“${res.title}”`, [
                        { text: 'OK', style: 'cancel' },
                        { text: 'Open note', onPress: () => router.push(`/notes/${res.noteId}`) },
                      ]),
                      onError: err => Alert.alert('Could not save', err instanceof Error ? err.message : ''),
                    })}
                    disabled={saveReview.isPending}
                    accessibilityRole="button"
                    accessibilityLabel="Save this review as a note"
                  >
                    <Text style={styles.saveText}>{saveReview.isPending ? 'Saving…' : 'Save to Notes'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => ask({ kind: 'weekly_report', id: r.id, title: `Week of ${weekLabel(r.weekStart, r.weekEnd)}` })}
                    accessibilityRole="button"
                    accessibilityLabel="Ask Lumen AI about this week"
                  >
                    <Text style={styles.saveText}>Ask about this week</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  intro: { ...typography.footnote, color: palette.textSecondary, lineHeight: 19 },
  btn: { flexDirection: 'row', gap: 8, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface },
  btnText: { ...typography.bodyBold, color: palette.primaryText },
  empty: { ...typography.body, color: palette.textSecondary },
  card: { backgroundColor: palette.surface, borderRadius: 22, padding: 16, gap: 8 },
  cardMain: { gap: 8 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20 },
  week: { ...typography.headline, color: palette.text },
  model: { ...typography.caption, color: palette.textSecondary, marginTop: -6 },
  saveBtn: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  saveText: { ...typography.bodyBold, color: palette.primaryText },
  preview: { ...typography.body, color: palette.textSecondary, lineHeight: 22 },
  text: { ...typography.body, color: palette.text, lineHeight: 22 },
}));
