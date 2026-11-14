/** Shown on Lumen AI screens until the member turns on AI full access in Settings. */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

export function AiSetupNotice({ configured = true }: { configured?: boolean }) {
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <Sparkles size={28} color={palette.primaryText} />
      <Text style={styles.title} maxFontSizeMultiplier={1.3}>Lumen AI is off</Text>
      <Text style={styles.body} maxFontSizeMultiplier={1.3}>
        {configured
          ? 'Turn on “Lumen AI full access” in Settings → AI & Insights to chat about all of your data, analyse photos and get a weekly review.'
          : 'The server has no Gemini API key yet, so Lumen AI cannot run.'}
      </Text>
      {configured ? (
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/settings')} accessibilityRole="button">
          <Text style={styles.btnText}>Open Settings</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  card: { margin: 16, padding: 20, borderRadius: 26, backgroundColor: palette.surface, alignItems: 'center', gap: 10 },
  title: { ...typography.headline, color: palette.text },
  body: { ...typography.body, color: palette.textSecondary, textAlign: 'center', lineHeight: 22 },
  btn: { marginTop: 6, minHeight: 44, paddingHorizontal: 22, borderRadius: 22, backgroundColor: palette.primary, justifyContent: 'center' },
  btnText: { ...typography.bodyBold, color: '#fff' },
}));
