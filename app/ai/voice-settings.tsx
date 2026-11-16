/**
 * Lumen AI voice settings: natural AI voice (Gemini TTS) or the phone's own voice, which Gemini
 * voice, and the listening language for the on-device recognizer.
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { Check, Square, Volume2 } from 'lucide-react-native';
import { ScreenTopBar } from '../../src/components/ios/ScreenTopBar';
import { AiSetupNotice } from '../../src/components/ai/AiSetupNotice';
import { useAiAccess, useAiModels, useUpdateAiSettings, type AiSettingsChange } from '../../src/hooks/useAiChat';
import { speakReply, stopSpeaking } from '../../src/services/voice/tts';
import { useSpeechState } from '../../src/services/voice/useSpeechState';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';

const PREVIEW_TEXT = 'Namaste! Main Lumen AI hoon. Pichle hafte aapki neend thodi behtar rahi, average saat ghante.';

const LANGS: { id: 'en-IN' | 'hi-IN'; label: string; note: string }[] = [
  { id: 'en-IN', label: 'English / Hinglish', note: 'Best when you mix English and Hindi in Roman letters' },
  { id: 'hi-IN', label: 'Hindi', note: 'Writes what you say in Devanagari' },
];

export default function AiVoiceSettingsScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const access = useAiAccess();
  const enabled = !!access.data?.fullAccess;
  const models = useAiModels(enabled);
  const update = useUpdateAiSettings();
  const speech = useSpeechState();
  const v = access.data?.voice;

  if (access.data && !enabled) {
    return (
      <View style={styles.screen}>
        <ScreenTopBar title="Voice" fallbackRoute="/settings" />
        <AiSetupNotice configured={access.data.configured} />
      </View>
    );
  }

  const save = (change: AiSettingsChange['voice']) =>
    update.mutate({ voice: change }, { onError: err => Alert.alert('Could not save', err instanceof Error ? err.message : '') });

  const preview = (voiceId: string) => {
    const id = `preview-${voiceId}`;
    if (speech.id === id && speech.status !== 'idle') { stopSpeaking().catch(() => {}); return; }
    speakReply(PREVIEW_TEXT, { voice: voiceId, natural: true, id }).catch(() => {});
  };

  return (
    <View style={styles.screen}>
      <ScreenTopBar title="Voice" fallbackRoute="/settings" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.group}>
          <View style={[styles.card, styles.row]}>
            <View style={styles.rowText}>
              <Text style={styles.label} maxFontSizeMultiplier={1.3}>Natural AI voice</Text>
              <Text style={styles.note} maxFontSizeMultiplier={1.3}>
                Gemini speaks the replies. Off uses your phone’s own voice (works offline, sounds more robotic).
              </Text>
            </View>
            <Switch
              value={v?.natural ?? true}
              onValueChange={natural => save({ natural })}
              disabled={!v || update.isPending}
              accessibilityLabel="Natural AI voice"
            />
          </View>
          <Text style={styles.footer} maxFontSizeMultiplier={1.3}>
            Each spoken reply uses extra Gemini free-tier requests. When the limit is reached, Lumen switches to the phone’s voice by itself.
          </Text>
        </View>

        <View style={[styles.group, !(v?.natural ?? true) && styles.dim]}>
          <Text style={styles.groupTitle} maxFontSizeMultiplier={1.3}>Reply voice</Text>
          <View style={styles.card}>
            {models.isLoading ? <ActivityIndicator style={{ margin: 16 }} /> : null}
            {models.data?.voices.map((voice, i) => {
              const selected = v?.ttsVoice === voice.id;
              const previewing = speech.id === `preview-${voice.id}` && speech.status !== 'idle';
              return (
                <View key={voice.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                  <TouchableOpacity
                    style={styles.rowMain}
                    onPress={() => save({ ttsVoice: voice.id })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${voice.label}, ${voice.tone}`}
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.label} maxFontSizeMultiplier={1.3}>{voice.label}</Text>
                      <Text style={styles.note} maxFontSizeMultiplier={1.3}>{voice.tone}</Text>
                    </View>
                    {selected ? <Check size={20} color={palette.primaryText} /> : null}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.previewBtn}
                    onPress={() => preview(voice.id)}
                    accessibilityRole="button"
                    accessibilityLabel={previewing ? `Stop ${voice.label} preview` : `Preview ${voice.label}`}
                  >
                    {previewing
                      ? (speech.status === 'loading' ? <ActivityIndicator size="small" /> : <Square size={14} color={palette.primaryText} fill={palette.primaryText} />)
                      : <Volume2 size={20} color={palette.primaryText} />}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle} maxFontSizeMultiplier={1.3}>Listening language</Text>
          <View style={styles.card}>
            {LANGS.map((l, i) => {
              const selected = (v?.sttLang ?? 'en-IN') === l.id;
              return (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.row, i > 0 && styles.rowDivider]}
                  onPress={() => save({ sttLang: l.id })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${l.label}. ${l.note}`}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.label} maxFontSizeMultiplier={1.3}>{l.label}</Text>
                    <Text style={styles.note} maxFontSizeMultiplier={1.3}>{l.note}</Text>
                  </View>
                  {selected ? <Check size={20} color={palette.primaryText} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.footer} maxFontSizeMultiplier={1.3}>
            Listening happens on your phone (Google’s speech recognizer). Lumen AI replies in the language you speak.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  body: { padding: 16, gap: 20, paddingBottom: 40 },
  group: { gap: 6 },
  dim: { opacity: 0.5 },
  groupTitle: { ...typography.footnote, color: palette.textSecondary, textTransform: 'uppercase', marginLeft: 16 },
  card: { backgroundColor: palette.surface, borderRadius: 22, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 10 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  rowDivider: { borderTopWidth: 0.5, borderTopColor: palette.border },
  rowText: { flex: 1, gap: 2 },
  label: { ...typography.body, color: palette.text },
  note: { ...typography.footnote, color: palette.textSecondary, lineHeight: 18 },
  footer: { ...typography.footnote, color: palette.textSecondary, marginHorizontal: 16, lineHeight: 18 },
  previewBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
}));
