/**
 * Lumen AI chat thread. `id` is a conversation id, or "new" for a fresh chat.
 * The AI can read all of the member's own data (logs, notes, sleep, activity, medicines, records,
 * photos) through server-side tools; attached photos go with the question.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUp, ImagePlus, X } from 'lucide-react-native';
import { ScreenTopBar } from '../../src/components/ios/ScreenTopBar';
import { AiMessageText } from '../../src/components/ai/AiMessageText';
import { AiPhotoThumb } from '../../src/components/ai/AiPhotoThumb';
import { AiSetupNotice } from '../../src/components/ai/AiSetupNotice';
import {
  useAiAccess, useAiConversation, useSendAiMessage, type SendAiMessage,
} from '../../src/hooks/useAiChat';
import { uploadMedia, getMimeType } from '../../src/services/mediaUpload';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';

const MAX_ATTACHMENTS = 4;

const SUGGESTIONS = [
  'How did my last week go?',
  'Compare my sleep this month with last month',
  'What have I written about pain or fatigue?',
  'Look at my most recent stool photo',
];

interface Attachment { local: string; mediaId?: string; failed?: boolean }

export default function AiChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const { palette } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const access = useAiAccess();
  const conversation = useAiConversation(isNew ? undefined : id);
  const send = useSendAiMessage();

  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pending, setPending] = useState<SendAiMessage | null>(null);
  const [failure, setFailure] = useState<{ text: string; retry: SendAiMessage } | null>(null);

  const messages = conversation.data?.messages ?? [];
  const uploading = attachments.some(a => !a.mediaId && !a.failed);
  const canSend = !send.isPending && !uploading && (draft.trim().length > 0 || attachments.some(a => a.mediaId));

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length, pending, failure]);

  const submit = (input: SendAiMessage) => {
    setFailure(null);
    setPending(input);
    send.mutate(input, {
      onSuccess: res => {
        setPending(null);
        if (!res.conversation) {
          setFailure({ text: res.reply, retry: input });
          return;
        }
        if (isNew) router.replace(`/ai/${res.conversation.id}`);
      },
      onError: err => {
        setPending(null);
        setFailure({ text: err instanceof Error ? err.message : 'Lumen AI could not answer just now.', retry: input });
      },
    });
  };

  const onSend = (text = draft) => {
    const message = text.trim();
    const mediaIds = attachments.flatMap(a => (a.mediaId ? [a.mediaId] : []));
    if (!message && mediaIds.length === 0) return;
    setDraft('');
    setAttachments([]);
    submit({ conversationId: isNew ? undefined : id, message, mediaIds });
  };

  const addPhoto = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const options = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, exif: false } as const;
    const picked = fromCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const uri = picked.canceled ? undefined : picked.assets?.[0]?.uri;
    if (!uri) return;
    setAttachments(prev => [...prev, { local: uri }]);
    try {
      // Treated as sensitive: it is a health photo the member chose to share with Lumen AI.
      const { mediaId } = await uploadMedia(uri, getMimeType(uri), true);
      setAttachments(prev => prev.map(a => (a.local === uri ? { ...a, mediaId } : a)));
    } catch {
      setAttachments(prev => prev.map(a => (a.local === uri ? { ...a, failed: true } : a)));
    }
  };

  const onAttach = () => {
    if (!access.data?.photoAccess) {
      Alert.alert(
        'Photos are off for Lumen AI',
        'Allow “Include photos” in Settings → AI & Insights to let Lumen AI look at photos.',
        [{ text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: () => router.push('/settings') }],
      );
      return;
    }
    if (attachments.length >= MAX_ATTACHMENTS) return;
    Alert.alert('Add a photo', undefined, [
      { text: 'Take photo', onPress: () => { addPhoto(true).catch(() => {}); } },
      { text: 'Choose from gallery', onPress: () => { addPhoto(false).catch(() => {}); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (access.data && !access.data.fullAccess) {
    return (
      <View style={styles.screen}>
        <ScreenTopBar title="Lumen AI" fallbackRoute="/(tabs)/insights" />
        <AiSetupNotice configured={access.data.configured} />
      </View>
    );
  }

  const empty = messages.length === 0 && !pending && !failure;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenTopBar title={conversation.data?.title ?? 'Lumen AI'} fallbackRoute="/ai" />

      <ScrollView ref={scrollRef} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled">
        {conversation.isLoading ? <ActivityIndicator style={{ marginTop: 40 }} /> : null}

        {empty && !conversation.isLoading ? (
          <View style={styles.intro}>
            <Text style={styles.introTitle} maxFontSizeMultiplier={1.3}>Ask anything about your data</Text>
            <Text style={styles.introBody} maxFontSizeMultiplier={1.3}>
              Lumen AI can read all your logs, notes, sleep, steps, medicines, records{access.data?.photoAccess ? ' and photos' : ''}. It can be wrong — check important things with your doctor.
            </Text>
            {SUGGESTIONS.map(s => (
              <TouchableOpacity key={s} style={styles.suggestion} onPress={() => onSend(s)} accessibilityRole="button">
                <Text style={styles.suggestionText} maxFontSizeMultiplier={1.3}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {messages.map(m => (
          <Bubble key={m.id} role={m.role} text={m.text} mediaIds={m.mediaIds} />
        ))}
        {pending ? <Bubble role="user" text={pending.message} mediaIds={pending.mediaIds ?? []} /> : null}
        {pending ? (
          <View style={[styles.bubble, styles.aiBubble, styles.typing]} accessibilityLabel="Lumen AI is looking through your data">
            <ActivityIndicator size="small" color={palette.primaryText} />
            <Text style={styles.typingText} maxFontSizeMultiplier={1.3}>Looking through your data…</Text>
          </View>
        ) : null}
        {failure ? (
          <View style={[styles.bubble, styles.errorBubble]}>
            <Text style={styles.errorText} maxFontSizeMultiplier={1.3}>{failure.text}</Text>
            <TouchableOpacity onPress={() => submit(failure.retry)} accessibilityRole="button" style={styles.retry}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
        {attachments.length > 0 ? (
          <ScrollView horizontal contentContainerStyle={styles.attachRow}>
            {attachments.map(a => (
              <View key={a.local} style={{ opacity: a.failed ? 0.4 : 1 }}>
                <AiPhotoThumb source={a.local} size={64} />
                {!a.mediaId && !a.failed ? <ActivityIndicator style={styles.attachSpinner} color="#fff" /> : null}
                <TouchableOpacity
                  style={styles.attachRemove}
                  onPress={() => setAttachments(prev => prev.filter(x => x.local !== a.local))}
                  accessibilityLabel="Remove photo"
                >
                  <X size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : null}
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={onAttach} accessibilityRole="button" accessibilityLabel="Attach a photo">
            <ImagePlus size={22} color={palette.primaryText} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Message Lumen AI"
            placeholderTextColor={palette.textSecondary}
            multiline
            maxLength={4000}
            maxFontSizeMultiplier={1.3}
            accessibilityLabel="Message Lumen AI"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnOff]}
            onPress={() => onSend()}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <ArrowUp size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ role, text, mediaIds }: { role: 'user' | 'assistant'; text: string; mediaIds: string[] }) {
  const styles = useStyles();
  const mine = role === 'user';
  return (
    <View style={[styles.bubble, mine ? styles.userBubble : styles.aiBubble]}>
      {mediaIds.length > 0 ? (
        <View style={styles.bubblePhotos}>{mediaIds.map(m => <AiPhotoThumb key={m} source={m} />)}</View>
      ) : null}
      {text ? (
        mine
          ? <Text style={styles.userText} maxFontSizeMultiplier={1.3}>{text}</Text>
          : <AiMessageText text={text} style={styles.aiText} />
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  thread: { padding: 16, gap: 10, paddingBottom: 24 },
  intro: { gap: 10, paddingVertical: 8 },
  introTitle: { ...typography.title2, color: palette.text },
  introBody: { ...typography.body, color: palette.textSecondary, lineHeight: 22 },
  suggestion: { backgroundColor: palette.surface, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  suggestionText: { ...typography.body, color: palette.primaryText },
  bubble: { maxWidth: '88%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: palette.primary },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: palette.surface },
  errorBubble: { alignSelf: 'flex-start', backgroundColor: palette.error + '18' },
  userText: { ...typography.body, color: '#fff', lineHeight: 22 },
  aiText: { ...typography.body, color: palette.text, lineHeight: 22 },
  bubblePhotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { ...typography.footnote, color: palette.textSecondary },
  errorText: { ...typography.body, color: palette.text, lineHeight: 22 },
  retry: { minHeight: 36, justifyContent: 'center' },
  retryText: { ...typography.bodyBold, color: palette.primaryText },
  composer: { borderTopWidth: 0.5, borderTopColor: palette.border, backgroundColor: palette.surface, paddingTop: 8, paddingHorizontal: 10, gap: 8 },
  attachRow: { gap: 8, paddingHorizontal: 4 },
  attachSpinner: { position: 'absolute', top: 22, left: 22 },
  attachRemove: { position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 44, maxHeight: 140, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, backgroundColor: palette.background, color: palette.text, ...typography.body },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { opacity: 0.4 },
}));
