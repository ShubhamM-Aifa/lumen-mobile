/**
 * Pick Lumen AI's provider and model: Gemini (free tier) or Claude (paid per use, needs
 * ANTHROPIC_API_KEY on the server). The first switch to Claude shows what it costs and how
 * Anthropic treats the data. Also shows this month's usage and estimated cost.
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Check } from 'lucide-react-native';
import { ScreenTopBar } from '../../src/components/ios/ScreenTopBar';
import { AiSetupNotice } from '../../src/components/ai/AiSetupNotice';
import {
  formatInr, useAiAccess, useAiModels, useAiUsage, useUpdateAiSettings, type AiModelInfo, type AiProviderId,
} from '../../src/hooks/useAiChat';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';

export const CLAUDE_NOTICE =
  'Claude is made by Anthropic and is paid per use from the prepaid credit on the server’s Anthropic account.\n\n' +
  'Roughly per question (more with photos): Haiku ₹0.1–0.5, Sonnet ₹2–8, Opus ₹4–15, Fable ₹8–30. Weekly reviews also run on the model you pick.\n\n' +
  'Your logs, notes, records and allowed photos are sent to Anthropic to answer. Under Anthropic’s API terms this data is not used to train their models by default.';

const PROVIDERS: { id: AiProviderId; title: string; footer: string }[] = [
  { id: 'gemini', title: 'Google Gemini', footer: 'Free tier: Google may use this data to improve its models.' },
  { id: 'claude', title: 'Anthropic Claude', footer: 'Paid per use. Prices are USD per million tokens (input / output).' },
];

export default function AiModelScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const access = useAiAccess();
  const enabled = !!access.data?.fullAccess;
  const models = useAiModels(enabled);
  const usage = useAiUsage(undefined, enabled);
  const update = useUpdateAiSettings();
  const current = access.data?.model;

  if (access.data && !enabled) {
    return (
      <View style={styles.screen}>
        <ScreenTopBar title="AI model" fallbackRoute="/settings" />
        <AiSetupNotice configured={access.data.configured} />
      </View>
    );
  }

  const choose = (m: AiModelInfo) => {
    if (!m.available || m.id === current || update.isPending) return;
    const apply = (acknowledgeClaude?: boolean) =>
      update.mutate({ model: m.id, ...(acknowledgeClaude ? { acknowledgeClaude: true } : {}) }, {
        onError: err => Alert.alert('Could not switch model', err instanceof Error ? err.message : ''),
      });
    if (m.provider === 'claude' && !access.data?.claudeAcknowledged) {
      Alert.alert('Switch to Claude?', CLAUDE_NOTICE, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'I understand, switch', onPress: () => apply(true) },
      ]);
      return;
    }
    apply();
  };

  const paidUsage = usage.data?.models.filter(u => u.provider === 'claude') ?? [];

  return (
    <View style={styles.screen}>
      <ScreenTopBar title="AI model" fallbackRoute="/settings" />
      <ScrollView contentContainerStyle={styles.body}>
        {models.isLoading ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}
        {access.data?.chosenModelUnavailable ? (
          <Text style={styles.warning} maxFontSizeMultiplier={1.3}>
            The model you picked can’t run right now, so Lumen AI is using {access.data.modelLabel}.
          </Text>
        ) : null}

        {PROVIDERS.map(p => {
          const list = models.data?.models.filter(m => m.provider === p.id) ?? [];
          if (!list.length) return null;
          const unavailable = list.every(m => !m.available);
          return (
            <View key={p.id} style={styles.group}>
              <Text style={styles.groupTitle} maxFontSizeMultiplier={1.3}>{p.title}</Text>
              <View style={styles.card}>
                {list.map((m, i) => {
                  const selected = m.id === current;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.row, i > 0 && styles.rowDivider, !m.available && styles.rowOff]}
                      onPress={() => choose(m)}
                      disabled={!m.available}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled: !m.available }}
                      accessibilityLabel={`${m.label}. ${m.note}${m.available ? '' : '. Not set up on the server'}`}
                    >
                      <View style={styles.rowText}>
                        <Text style={styles.label} maxFontSizeMultiplier={1.3}>{m.label}</Text>
                        <Text style={styles.note} maxFontSizeMultiplier={1.3}>
                          {m.note}{m.inputPerM > 0 ? ` · $${m.inputPerM} / $${m.outputPerM}` : ''}
                        </Text>
                      </View>
                      {selected
                        ? (update.isPending ? <ActivityIndicator /> : <Check size={20} color={palette.primaryText} />)
                        : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.footer} maxFontSizeMultiplier={1.3}>
                {unavailable && p.id === 'claude'
                  ? 'Not set up yet: add ANTHROPIC_API_KEY to the server’s .env (with prepaid credit at console.anthropic.com) and redeploy.'
                  : p.footer}
              </Text>
            </View>
          );
        })}

        <View style={styles.group}>
          <Text style={styles.groupTitle} maxFontSizeMultiplier={1.3}>This month</Text>
          <View style={[styles.card, styles.usageCard]}>
            {usage.isLoading ? <ActivityIndicator /> : null}
            {usage.data && usage.data.models.length === 0 ? (
              <Text style={styles.note} maxFontSizeMultiplier={1.3}>No Lumen AI replies yet this month.</Text>
            ) : null}
            {usage.data?.models.map(u => (
              <View key={u.model} style={styles.usageRow}>
                <Text style={styles.label} maxFontSizeMultiplier={1.3}>{u.label}</Text>
                <Text style={styles.note} maxFontSizeMultiplier={1.3}>
                  {u.replies} {u.replies === 1 ? 'reply' : 'replies'}
                  {u.provider === 'claude' ? ` · ≈ $${u.estimatedUsd.toFixed(2)} (${formatInr(u.estimatedUsd)})` : ' · free'}
                </Text>
              </View>
            ))}
          </View>
          {paidUsage.length ? (
            <Text style={styles.footer} maxFontSizeMultiplier={1.3}>
              Estimate from list prices; your Anthropic console shows the exact bill.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  body: { padding: 16, gap: 20, paddingBottom: 40 },
  warning: { ...typography.footnote, color: palette.text, backgroundColor: palette.warning + '22', borderRadius: 14, padding: 12, lineHeight: 19 },
  group: { gap: 6 },
  groupTitle: { ...typography.footnote, color: palette.textSecondary, textTransform: 'uppercase', marginLeft: 16 },
  card: { backgroundColor: palette.surface, borderRadius: 22, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16, paddingVertical: 10 },
  rowDivider: { borderTopWidth: 0.5, borderTopColor: palette.border },
  rowOff: { opacity: 0.45 },
  rowText: { flex: 1, gap: 2 },
  label: { ...typography.body, color: palette.text },
  note: { ...typography.footnote, color: palette.textSecondary, lineHeight: 18 },
  footer: { ...typography.footnote, color: palette.textSecondary, marginHorizontal: 16, lineHeight: 18 },
  usageCard: { padding: 16, gap: 10 },
  usageRow: { gap: 2 },
}));
