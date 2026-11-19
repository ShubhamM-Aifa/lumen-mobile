/** Today screen: ask Lumen AI straight away, and see what is new in the community. */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Sparkles, Send, MessageCircle, ChevronRight } from 'lucide-react-native';
import { useAiAccess } from '../../hooks/useAiChat';
import { useCommunityStore } from '../../store/communityStore';
import { useAuthStore } from '../../store/authStore';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

const IDEAS = ['How did I sleep this week?', 'Any patterns before my flares?'];
const MAX_UNREAD_ROWS = 3;

export function ChatShortcutsCard() {
  const { palette } = useTheme();
  const styles = useStyles();
  const access = useAiAccess();
  const { user } = useAuthStore();
  const { channels, dmChannels, fetchChannels, fetchDms } = useCommunityStore();
  const [question, setQuestion] = useState('');

  const aiOn = !!access.data?.fullAccess;

  useEffect(() => {
    // Quietly refresh the unread counts; failures just leave the card as it was.
    fetchChannels().catch(() => {});
    fetchDms().catch(() => {});
  }, [fetchChannels, fetchDms]);

  const ask = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setQuestion('');
    router.push({ pathname: '/ai/[id]', params: { id: 'new', prompt: q, autosend: '1' } });
  };

  const unreadChannels = channels
    .filter(c => (c.unreadCount ?? 0) > 0)
    .sort((a, b) => (b.unreadCount ?? 0) - (a.unreadCount ?? 0));
  const unreadTotal = unreadChannels.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
  const requests = dmChannels.filter(c => c.dmStatus === 'pending' && !!user?._id && c.dmInitiatorId !== user._id).length;

  const openChannel = (slugOrId: string) =>
    router.push({ pathname: '/community/[channelId]', params: { channelId: slugOrId } });

  return (
    <View style={styles.wrap}>
      {/* Lumen AI */}
      <View style={styles.card}>
        <View style={styles.header}>
          <Sparkles size={18} color={palette.primaryText} />
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>Lumen AI</Text>
          {aiOn ? (
            <TouchableOpacity onPress={() => router.push('/ai')} accessibilityRole="button" accessibilityLabel="Past Lumen AI chats" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.link} maxFontSizeMultiplier={1.3}>Past chats</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {access.data && !aiOn ? (
          <>
            <Text style={styles.sub} maxFontSizeMultiplier={1.3}>
              Chat about all your logs, sleep, medicines and photos. Turn it on in Settings first.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={() => router.push('/settings')} accessibilityRole="button">
              <Text style={styles.btnText} maxFontSizeMultiplier={1.3}>Set up Lumen AI</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Ask Lumen AI anything…"
                placeholderTextColor={palette.placeholder}
                value={question}
                onChangeText={setQuestion}
                onSubmitEditing={() => ask(question)}
                returnKeyType="send"
                editable={!!access.data}
                accessibilityLabel="Ask Lumen AI"
                maxLength={2000}
              />
              <TouchableOpacity
                style={[styles.send, { opacity: question.trim() ? 1 : 0.4 }]}
                disabled={!question.trim()}
                onPress={() => ask(question)}
                accessibilityRole="button"
                accessibilityLabel="Send question to Lumen AI"
              >
                <Send size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.chips}>
              {IDEAS.map(idea => (
                <TouchableOpacity
                  key={idea}
                  style={styles.chip}
                  disabled={!access.data}
                  onPress={() => ask(idea)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ask: ${idea}`}
                >
                  <Text style={styles.chipText} maxFontSizeMultiplier={1.3}>{idea}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>

      {/* Community */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.header}
          onPress={() => router.push('/community')}
          accessibilityRole="button"
          accessibilityLabel={unreadTotal > 0 ? `Community, ${unreadTotal} unread messages` : 'Community'}
        >
          <MessageCircle size={18} color={palette.primaryText} />
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>Community</Text>
          {unreadTotal > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadTotal > 99 ? '99+' : unreadTotal}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <ChevronRight size={16} color={palette.textSecondary} />
        </TouchableOpacity>

        {requests > 0 ? (
          <TouchableOpacity style={styles.row} onPress={() => router.push('/community')} accessibilityRole="button">
            <Text style={styles.rowText} maxFontSizeMultiplier={1.3}>
              {requests} message {requests === 1 ? 'request' : 'requests'} waiting
            </Text>
            <ChevronRight size={16} color={palette.textSecondary} />
          </TouchableOpacity>
        ) : null}

        {unreadChannels.length > 0 ? (
          unreadChannels.slice(0, MAX_UNREAD_ROWS).map(c => (
            <TouchableOpacity
              key={c._id}
              style={styles.row}
              onPress={() => openChannel(c.slug || c._id)}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}, ${c.unreadCount} unread`}
            >
              <Text style={styles.rowText} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {c.icon} {c.name}
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{c.unreadCount}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : requests === 0 ? (
          <Text style={styles.sub} maxFontSizeMultiplier={1.3}>You are all caught up. Open the community to chat or share a note.</Text>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  wrap: { gap: 12, paddingHorizontal: 16 },
  card: { backgroundColor: palette.surface, borderRadius: 26, padding: 16, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...typography.headline, color: palette.text },
  link: { ...typography.footnote, color: palette.primaryText, marginLeft: 8 },
  sub: { ...typography.footnote, color: palette.textSecondary, lineHeight: 18 },
  btn: { minHeight: 46, borderRadius: 23, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  btnText: { ...typography.bodyBold, color: '#fff' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.background, borderRadius: 24, paddingLeft: 14, paddingRight: 4, minHeight: 48 },
  input: { flex: 1, minHeight: 44, ...typography.body, color: palette.text },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: palette.background, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { ...typography.footnote, color: palette.text },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, gap: 8 },
  rowText: { ...typography.body, color: palette.text, flex: 1 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
}));
