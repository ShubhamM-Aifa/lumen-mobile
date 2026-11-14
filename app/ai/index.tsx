/** Lumen AI home: past chats, a new chat, and the weekly reviews. */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { CalendarDays, MessageCirclePlus, ChevronRight, ImageIcon } from 'lucide-react-native';
import { ScreenTopBar } from '../../src/components/ios/ScreenTopBar';
import { AiSetupNotice } from '../../src/components/ai/AiSetupNotice';
import { useAiAccess, useAiConversations, useDeleteAiConversation } from '../../src/hooks/useAiChat';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';

export default function AiHomeScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const access = useAiAccess();
  const enabled = !!access.data?.fullAccess;
  const list = useAiConversations(enabled);
  const remove = useDeleteAiConversation();

  if (access.data && !enabled) {
    return (
      <View style={styles.screen}>
        <ScreenTopBar title="Lumen AI" fallbackRoute="/(tabs)/insights" />
        <AiSetupNotice configured={access.data.configured} />
      </View>
    );
  }

  const confirmDelete = (id: string, title: string) =>
    Alert.alert('Delete this chat?', title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(id) },
    ]);

  return (
    <View style={styles.screen}>
      <ScreenTopBar title="Lumen AI" fallbackRoute="/(tabs)/insights" />
      <ScrollView contentContainerStyle={styles.body}>
        <TouchableOpacity style={styles.primary} onPress={() => router.push('/ai/new')} accessibilityRole="button">
          <MessageCirclePlus size={22} color="#fff" />
          <Text style={styles.primaryText} maxFontSizeMultiplier={1.3}>New chat</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => router.push('/ai/reports')} accessibilityRole="button">
          <CalendarDays size={20} color={palette.primaryText} />
          <Text style={styles.rowTitle} maxFontSizeMultiplier={1.3}>Weekly AI reviews</Text>
          <ChevronRight size={18} color={palette.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.section} maxFontSizeMultiplier={1.3}>Chats</Text>
        {list.isLoading ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}
        {list.data?.length === 0 ? (
          <Text style={styles.empty} maxFontSizeMultiplier={1.3}>No chats yet. Start one, or tap “Analyse with AI” on any photo.</Text>
        ) : null}
        {list.data?.map(c => (
          <TouchableOpacity
            key={c.id}
            style={styles.row}
            onPress={() => router.push(`/ai/${c.id}`)}
            onLongPress={() => confirmDelete(c.id, c.title)}
            accessibilityRole="button"
            accessibilityHint="Long press to delete"
          >
            {c.sourceMediaId ? <ImageIcon size={18} color={palette.textSecondary} /> : null}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowTitle} numberOfLines={1} maxFontSizeMultiplier={1.3}>{c.title}</Text>
              <Text style={styles.preview} numberOfLines={2} maxFontSizeMultiplier={1.3}>{c.preview}</Text>
            </View>
            <ChevronRight size={18} color={palette.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  primary: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 26, backgroundColor: palette.primary },
  primaryText: { ...typography.headline, color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, minHeight: 52 },
  rowTitle: { ...typography.bodyBold, color: palette.text, flex: 1 },
  preview: { ...typography.footnote, color: palette.textSecondary },
  section: { ...typography.footnote, fontWeight: '600', color: palette.textSecondary, textTransform: 'uppercase', marginTop: 12, marginLeft: 4 },
  empty: { ...typography.body, color: palette.textSecondary, marginLeft: 4 },
}));
