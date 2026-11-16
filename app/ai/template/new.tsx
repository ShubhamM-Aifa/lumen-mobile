/**
 * "Create with Lumen AI": the member names a disease or symptoms (or leaves it empty so Lumen AI
 * uses what it already knows about them), or asks it to improve their current tracking from their
 * data. Lumen AI writes a draft; the review screen shows it before anything is added.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { Sparkles, WandSparkles } from 'lucide-react-native';
import { ScreenTopBar } from '../../../src/components/ios/ScreenTopBar';
import { AiSetupNotice } from '../../../src/components/ai/AiSetupNotice';
import { useAiAccess, useGenerateTemplateDraft } from '../../../src/hooks/useAiChat';
import { useTheme, createThemedStyles } from '../../../src/theme/ThemeContext';
import { typography } from '../../../src/theme/typography';

const EXAMPLES = ['Rheumatoid arthritis', 'Migraine with aura', 'IBS: bloating and cramps', 'Thyroid: fatigue and weight'];

const FAILED: Record<string, string> = {
  no_draft: 'Lumen AI did not find anything new to add — you may already track all of it.',
  rate_limited: 'The AI is busy (free-tier limit). Please try again in a little while.',
  busy: 'The AI is overloaded right now. Please try again in a minute.',
  timeout: 'That took too long. Try naming one condition or a few symptoms.',
};

export default function NewAiTemplateScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const access = useAiAccess();
  const generate = useGenerateTemplateDraft();
  const [request, setRequest] = useState('');
  const [mode, setMode] = useState<'create' | 'improve' | null>(null);

  if (access.data && !access.data.fullAccess) {
    return (
      <View style={styles.screen}>
        <ScreenTopBar title="Create with Lumen AI" fallbackRoute="/customize/templates" />
        <AiSetupNotice configured={access.data.configured} />
      </View>
    );
  }

  const run = (m: 'create' | 'improve') => {
    setMode(m);
    generate.mutate({ mode: m, ...(m === 'create' && request.trim() ? { request: request.trim() } : {}) }, {
      onSuccess: res => {
        if (res.draftId) router.replace(`/ai/template/${res.draftId}`);
        else Alert.alert('No template yet', FAILED[res.error ?? ''] ?? res.reply ?? 'Please try again.');
      },
      onError: err => Alert.alert('Could not create', err instanceof Error ? err.message : ''),
      onSettled: () => setMode(null),
    });
  };

  const busy = generate.isPending;

  return (
    <View style={styles.screen}>
      <ScreenTopBar title="Create with Lumen AI" fallbackRoute="/customize/templates" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro} maxFontSizeMultiplier={1.3}>
          Tell Lumen AI what you live with or what you want to keep an eye on. It uses Lumen’s ready-made trackers first, adds only what’s missing, and skips what you already track. You review everything before it’s added.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label} maxFontSizeMultiplier={1.3}>Disease or symptoms</Text>
          <TextInput
            style={styles.input}
            value={request}
            onChangeText={setRequest}
            placeholder="e.g. Rheumatoid arthritis, morning stiffness"
            placeholderTextColor={palette.textSecondary}
            multiline
            maxLength={500}
            editable={!busy}
            accessibilityLabel="Disease or symptoms"
          />
          <View style={styles.chips}>
            {EXAMPLES.map(e => (
              <TouchableOpacity key={e} style={styles.chip} onPress={() => setRequest(e)} disabled={busy} accessibilityRole="button">
                <Text style={styles.chipText} maxFontSizeMultiplier={1.2}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint} maxFontSizeMultiplier={1.2}>
            Leave it empty and Lumen AI uses what it already knows about you: your conditions, what you log and what you’ve talked about.
          </Text>
          <TouchableOpacity style={[styles.primary, busy && styles.off]} onPress={() => run('create')} disabled={busy} accessibilityRole="button">
            {mode === 'create' ? <ActivityIndicator color="#fff" /> : <Sparkles size={18} color="#fff" />}
            <Text style={styles.primaryText}>{mode === 'create' ? 'Lumen AI is building it…' : 'Build my template'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label} maxFontSizeMultiplier={1.3}>Improve my tracking</Text>
          <Text style={styles.hint} maxFontSizeMultiplier={1.2}>
            Lumen AI looks at how you actually log: things you keep typing under “Other” become options, and things you haven’t used for months can be hidden.
          </Text>
          <TouchableOpacity style={[styles.secondary, busy && styles.off]} onPress={() => run('improve')} disabled={busy} accessibilityRole="button">
            {mode === 'improve' ? <ActivityIndicator color={palette.primaryText} /> : <WandSparkles size={18} color={palette.primaryText} />}
            <Text style={styles.secondaryText}>{mode === 'improve' ? 'Looking at your logs…' : 'Suggest improvements'}</Text>
          </TouchableOpacity>
        </View>
        {busy ? <Text style={styles.hint} maxFontSizeMultiplier={1.2}>This can take up to a minute.</Text> : null}
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  body: { padding: 16, gap: 16, paddingBottom: 40 },
  intro: { ...typography.body, color: palette.textSecondary, lineHeight: 22 },
  card: { backgroundColor: palette.surface, borderRadius: 22, padding: 16, gap: 12 },
  label: { ...typography.headline, color: palette.text },
  input: { minHeight: 64, borderRadius: 14, padding: 12, backgroundColor: palette.background, color: palette.text, ...typography.body, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 18, backgroundColor: palette.background },
  chipText: { ...typography.footnote, color: palette.primaryText },
  hint: { ...typography.footnote, color: palette.textSecondary, lineHeight: 18 },
  primary: { flexDirection: 'row', gap: 8, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  primaryText: { ...typography.bodyBold, color: '#fff' },
  secondary: { flexDirection: 'row', gap: 8, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  secondaryText: { ...typography.bodyBold, color: palette.primaryText },
  off: { opacity: 0.5 },
}));
