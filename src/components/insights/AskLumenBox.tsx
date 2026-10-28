/**
 * "Ask Lumen": a single bounded question answered only from facts already shown elsewhere on
 * this screen (recent patterns, progress, early warning). Crisis / medicine-change / diagnosis
 * questions are redirected server-side before they ever reach the model — see
 * server/src/services/llm/router.ts. Only shown when preferences.aiExplanations is on.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useAskLumen } from '../../hooks/useExplain';

export function AskLumenBox() {
  const { palette } = useTheme();
  const styles = useStyles();
  const ask = useAskLumen();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ text: string; source: 'ai' | 'template' } | null>(null);

  const submit = () => {
    const q = question.trim();
    if (!q || ask.isPending) return;
    ask.mutate(q, { onSuccess: res => setAnswer(res) });
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MessageCircle size={18} color={palette.primaryText} />
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>Ask about your patterns</Text>
      </View>
      <Text style={styles.sub} maxFontSizeMultiplier={1.3}>Answers only use patterns already shown in your Insights — never medical advice.</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={question}
          onChangeText={setQuestion}
          placeholder="e.g. Is my sleep getting better?"
          placeholderTextColor={palette.textSecondary}
          onSubmitEditing={submit}
          returnKeyType="send"
          maxFontSizeMultiplier={1.3}
          accessibilityLabel="Ask a question about your patterns"
        />
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={submit}
          disabled={!question.trim() || ask.isPending}
          accessibilityRole="button"
          accessibilityLabel="Send question"
        >
          {ask.isPending ? <ActivityIndicator size="small" color={palette.primaryText} /> : <Text style={styles.sendText}>Ask</Text>}
        </TouchableOpacity>
      </View>
      {answer ? (
        <View style={styles.answerBox}>
          <Text style={styles.answerTag} maxFontSizeMultiplier={1.3}>{answer.source === 'ai' ? 'AI-written' : 'Lumen'}</Text>
          <Text style={styles.answerText} maxFontSizeMultiplier={1.3}>{answer.text}</Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  card: { backgroundColor: palette.surface, borderRadius: 26, padding: 16, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...typography.headline, color: palette.text },
  sub: { ...typography.footnote, color: palette.textSecondary, lineHeight: 18 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minHeight: 44, borderRadius: 14, paddingHorizontal: 14, backgroundColor: palette.background, color: palette.text, ...typography.body },
  sendBtn: { minWidth: 56, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryText + '16' },
  sendText: { ...typography.bodyBold, color: palette.primaryText },
  answerBox: { backgroundColor: palette.primaryText + '0f', borderRadius: 16, padding: 12, gap: 4 },
  answerTag: { ...typography.caption, fontWeight: '700', color: palette.primaryText },
  answerText: { ...typography.body, color: palette.text, lineHeight: 21 },
}));
