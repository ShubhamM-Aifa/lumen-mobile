/**
 * Lumen AI Tab: AI Home with Chat and Insights segments.
 * Design spec: docs/design/Lumen.html and docs/DESIGN_HANDOFF.md
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  AudioLines,
  SquarePen,
  Paperclip,
  Send,
  CalendarDays,
  ChevronRight,
  ImageIcon,
} from 'lucide-react-native';

import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { LargeTitleHeader } from '../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { IosSegmented } from '../../src/components/ios/IosSegmented';
import { TAB_BAR_CLEARANCE } from '../../src/components/ios/iosTheme';
import { AiSetupNotice } from '../../src/components/ai/AiSetupNotice';
import { InsightsView } from '../../src/components/insights/InsightsView';
import {
  useAiAccess,
  useAiConversations,
  useDeleteAiConversation,
  useAiWeeklyReports,
  weekLabel,
} from '../../src/hooks/useAiChat';

const SUGGESTIONS = [
  'Any patterns before my flares?',
  'How did I sleep this week?',
  'Prepare a note for my next doctor visit',
];

const LUMEN_SEGMENTS: Array<{ key: 'Chat' | 'Insights'; label: string }> = [
  { key: 'Chat', label: 'Chat' },
  { key: 'Insights', label: 'Insights' },
];

export default function LumenScreen() {
  const { palette } = useTheme();
  const styles = useStyles();

  const [activeSegment, setActiveSegment] = useState<'Chat' | 'Insights'>('Chat');
  const [question, setQuestion] = useState('');

  const access = useAiAccess();
  const enabled = !!access.data?.fullAccess;
  const conversations = useAiConversations(enabled);
  const deleteConversation = useDeleteAiConversation();
  const reports = useAiWeeklyReports(enabled);
  const latestReport = reports.data?.[0];

  const submitQuestion = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setQuestion('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/ai/[id]', params: { id: 'new', prompt: q, autosend: '1' } });
  };

  const confirmDelete = (id: string, title: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert('Delete this chat?', title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteConversation.mutate(id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LargeTitleHeader
        title="Lumen"
        subtitle="Ask anything about your logs, sleep and medicines"
        actions={
          <>
            <GlassCircleButton
              accessibilityLabel="Talk to Lumen AI by voice"
              onPress={() => router.push('/ai/voice')}
            >
              <AudioLines size={20} color={palette.tint} />
            </GlassCircleButton>
            <GlassCircleButton
              accessibilityLabel="New chat"
              onPress={() => router.push('/ai/new')}
            >
              <SquarePen size={20} color={palette.text} />
            </GlassCircleButton>
          </>
        }
      />

      <View style={styles.segmentedWrap}>
        <IosSegmented
          options={LUMEN_SEGMENTS}
          value={activeSegment}
          onChange={(seg: 'Chat' | 'Insights') => {
            Haptics.selectionAsync().catch(() => {});
            setActiveSegment(seg);
          }}
        />
      </View>

      {activeSegment === 'Insights' ? (
        <View style={styles.insightsContainer}>
          <InsightsView hideHeader />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {access.data && !enabled ? (
            <AiSetupNotice configured={access.data.configured} />
          ) : (
            <>
              {/* Ask Card */}
              <View style={styles.askCard}>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ask Lumen AI anything…"
                    placeholderTextColor={palette.placeholder}
                    value={question}
                    onChangeText={setQuestion}
                    onSubmitEditing={() => submitQuestion(question)}
                    returnKeyType="send"
                    accessibilityLabel="Ask Lumen AI"
                  />
                  <TouchableOpacity
                    style={styles.attachBtn}
                    onPress={() => router.push({ pathname: '/ai/[id]', params: { id: 'new', attach: '1' } })}
                    accessibilityRole="button"
                    accessibilityLabel="Attach a day, note or file"
                  >
                    <Paperclip size={18} color={palette.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sendBtn, !question.trim() && styles.sendBtnDisabled]}
                    onPress={() => submitQuestion(question)}
                    disabled={!question.trim()}
                    accessibilityRole="button"
                    accessibilityLabel="Send question to Lumen AI"
                  >
                    <Send size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {/* Suggestion Chips */}
                <View style={styles.chipsRow}>
                  {SUGGESTIONS.map((chip, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.chip}
                      onPress={() => submitQuestion(chip)}
                      accessibilityRole="button"
                      accessibilityLabel={chip}
                    >
                      <Text style={styles.chipText} maxFontSizeMultiplier={1.2}>
                        {chip}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Weekly AI Review Card */}
              {latestReport ? (
                <TouchableOpacity
                  style={styles.reviewCard}
                  onPress={() => router.push('/ai/reports')}
                  accessibilityRole="button"
                  accessibilityLabel={`Weekly AI review: ${weekLabel(latestReport.weekStart, latestReport.weekEnd)}`}
                >
                  <View style={styles.reviewHeader}>
                    <CalendarDays size={18} color={palette.tint} />
                    <Text style={styles.reviewTitle} maxFontSizeMultiplier={1.3}>
                      Weekly AI review
                    </Text>
                    <Text style={styles.reviewDate} maxFontSizeMultiplier={1.3}>
                      {weekLabel(latestReport.weekStart, latestReport.weekEnd)}
                    </Text>
                    <ChevronRight size={16} color={palette.textSecondary} />
                  </View>
                  <Text style={styles.reviewBody} numberOfLines={3} maxFontSizeMultiplier={1.3}>
                    {latestReport.text.replace(/[*#]/g, '').replace(/\s+/g, ' ').trim()}
                  </Text>
                </TouchableOpacity>
              ) : enabled ? (
                <TouchableOpacity
                  style={styles.reviewRow}
                  onPress={() => router.push('/ai/reports')}
                  accessibilityRole="button"
                  accessibilityLabel="Weekly AI reviews"
                >
                  <CalendarDays size={18} color={palette.tint} />
                  <Text style={styles.reviewTitle} maxFontSizeMultiplier={1.3}>
                    Weekly AI reviews
                  </Text>
                  <ChevronRight size={16} color={palette.textSecondary} />
                </TouchableOpacity>
              ) : null}

              {/* Chats List */}
              <View style={styles.chatsSection}>
                <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.3}>
                  CHATS
                </Text>
                {conversations.isLoading ? (
                  <ActivityIndicator size="small" color={palette.tint} style={{ marginTop: 12 }} />
                ) : null}
                {conversations.data?.length === 0 ? (
                  <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
                    No chats yet. Start one, or tap “Analyse with AI” on any photo.
                  </Text>
                ) : null}
                {conversations.data?.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.chatRow}
                    onPress={() => router.push(`/ai/${c.id}`)}
                    onLongPress={() => confirmDelete(c.id, c.title)}
                    accessibilityRole="button"
                    accessibilityHint="Long press to delete"
                  >
                    {c.sourceMediaId ? (
                      <ImageIcon size={18} color={palette.textSecondary} />
                    ) : null}
                    <View style={styles.chatInfo}>
                      <Text style={styles.chatTitle} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                        {c.title}
                      </Text>
                      <Text style={styles.chatPreview} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                        {c.preview}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={palette.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  segmentedWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  insightsContainer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 14,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  askCard: {
    backgroundColor: palette.surface,
    borderRadius: 26,
    padding: 16,
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.background,
    borderRadius: 24,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    color: palette.text,
    fontSize: 15,
    paddingVertical: 0,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: palette.background,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    ...typography.footnote,
    color: palette.text,
  },
  reviewCard: {
    backgroundColor: palette.surface,
    borderRadius: 26,
    padding: 16,
    gap: 6,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewTitle: {
    ...typography.headline,
    color: palette.text,
    flex: 1,
  },
  reviewDate: {
    ...typography.footnote,
    color: palette.textSecondary,
  },
  reviewBody: {
    ...typography.footnote,
    color: palette.textSecondary,
    lineHeight: 18,
  },
  chatsSection: {
    gap: 10,
  },
  sectionTitle: {
    ...typography.footnote,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: palette.textSecondary,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  emptyText: {
    ...typography.body,
    color: palette.textSecondary,
    marginLeft: 4,
    marginTop: 4,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  chatInfo: {
    flex: 1,
    gap: 2,
  },
  chatTitle: {
    ...typography.bodyBold,
    color: palette.text,
  },
  chatPreview: {
    ...typography.footnote,
    color: palette.textSecondary,
  },
}));
