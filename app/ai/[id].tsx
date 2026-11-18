/**
 * Lumen AI chat thread. `id` is a conversation id, or "new" for a fresh chat.
 * The AI can read all of the member's own data (logs, notes, sleep, activity, medicines, records,
 * photos) through server-side tools; attached photos go with the question.
 * Voice: the mic dictates into the box (on-device recognizer), each reply has a speaker button,
 * and the header opens hands-free voice mode (./voice.tsx). The chip under the title picks the model.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUp, AudioLines, BookmarkPlus, ChevronDown, ImagePlus, Mic, Square, Volume2, X } from 'lucide-react-native';
import { ScreenTopBar } from '../../src/components/ios/ScreenTopBar';
import { AiMessageText } from '../../src/components/ai/AiMessageText';
import { AiPhotoThumb } from '../../src/components/ai/AiPhotoThumb';
import { AiSetupNotice } from '../../src/components/ai/AiSetupNotice';
import { useKeyboard } from '../../src/hooks/useKeyboard';
import {
  useAiAccess, useAiConversation, useSaveMessageAsNote, useSendAiMessage, type AiArtifact, type SendAiMessage,
} from '../../src/hooks/useAiChat';
import { uploadMedia, getMimeType } from '../../src/services/mediaUpload';
import { useDictation } from '../../src/services/voice/useDictation';
import { speakReply, stopSpeaking } from '../../src/services/voice/tts';
import { useSpeechState } from '../../src/services/voice/useSpeechState';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';

const MAX_ATTACHMENTS = 4;

const SUGGESTIONS = [
  'How did my last week go?',
  'Prepare a note for my next doctor visit',
  'Build a log template for my condition',
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
  const { isKeyboardVisible } = useKeyboard();

  const access = useAiAccess();
  const conversation = useAiConversation(isNew ? undefined : id);
  const send = useSendAiMessage();
  const saveNote = useSaveMessageAsNote();

  const onSaveNote = (messageId: string) => {
    if (isNew || !id) return;
    saveNote.mutate({ conversationId: id, messageId }, {
      onSuccess: res => Alert.alert('Saved to Notes', `“${res.title}”`, [
        { text: 'OK', style: 'cancel' },
        { text: 'Open note', onPress: () => router.push(`/notes/${res.noteId}`) },
      ]),
      onError: err => Alert.alert('Could not save', err instanceof Error ? err.message : ''),
    });
  };

  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pending, setPending] = useState<SendAiMessage | null>(null);
  const [failure, setFailure] = useState<{ text: string; retry: SendAiMessage } | null>(null);

  const voice = access.data?.voice;
  const dictation = useDictation({
    lang: voice?.sttLang ?? 'en-IN',
    onFinal: text => { if (text) setDraft(prev => (prev.trim() ? `${prev.trim()} ${text}` : text)); },
    onError: err => Alert.alert(
      'Could not listen',
      err === 'permission' ? 'Allow microphone access for Lumen in your phone settings.'
        : err === 'unavailable' ? 'Speech recognition is not available on this phone. Make sure the Google app is installed and up to date.'
          : err === 'network' ? 'Speech recognition needs a connection right now. Please try again.'
            : 'Please try again.',
    ),
  });

  // Never keep talking after leaving the chat.
  useEffect(() => () => { stopSpeaking().catch(() => {}); }, []);

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
    if (dictation.listening) dictation.cancel();
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
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Pinned Solid Header Bar with Model Switcher */}
      <View style={[styles.headerContainer, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <ScreenTopBar
          title={conversation.data?.title ?? 'Lumen AI'}
          fallbackRoute="/ai"
          right={(
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => router.push(`/ai/voice?id=${isNew ? 'new' : id}`)}
              accessibilityRole="button"
              accessibilityLabel="Talk to Lumen AI by voice"
            >
              <AudioLines size={22} color={palette.primaryText} />
            </TouchableOpacity>
          )}
        />
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.modelChip, { backgroundColor: palette.surface, borderColor: palette.border }]}
            onPress={() => router.push('/ai/model')}
            accessibilityRole="button"
            accessibilityLabel={`Model: ${access.data?.modelLabel ?? ''}. Change model`}
          >
            <View style={[styles.modelStatusDot, { backgroundColor: palette.primary }]} />
            <Text style={styles.modelChipText} maxFontSizeMultiplier={1.2} numberOfLines={1}>
              {access.data?.modelLabel ?? 'Model'}{access.data?.chosenModelUnavailable ? ' · your pick is unavailable' : ''}
            </Text>
            <ChevronDown size={13} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.thread}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
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
          <Bubble
            key={m.id}
            id={m.id}
            role={m.role}
            text={m.text}
            mediaIds={m.mediaIds}
            modelLabel={m.modelLabel ?? undefined}
            artifacts={m.artifacts}
            onSaveNote={m.role === 'assistant' && !isNew ? () => onSaveNote(m.id) : undefined}
            onSpeak={voice ? () => { speakReply(m.text, { voice: voice.ttsVoice, natural: voice.natural, id: m.id }).catch(() => {}); } : undefined}
          />
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

      <View
        style={[
          styles.composer,
          {
            paddingBottom: isKeyboardVisible
              ? (Platform.OS === 'ios' ? 8 : 6)
              : (Platform.OS === 'android' ? Math.max(insets.bottom, 16) : insets.bottom + 8),
          },
        ]}
      >
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
            value={dictation.listening ? [draft.trim(), dictation.partial].filter(Boolean).join(' ') : draft}
            onChangeText={setDraft}
            editable={!dictation.listening}
            placeholder={dictation.listening ? 'Listening…' : 'Message Lumen AI'}
            placeholderTextColor={palette.textSecondary}
            multiline
            maxLength={4000}
            maxFontSizeMultiplier={1.3}
            accessibilityLabel="Message Lumen AI"
          />
          {dictation.listening || (!draft.trim() && attachments.length === 0) ? (
            <TouchableOpacity
              style={[styles.sendBtn, dictation.listening ? styles.micBtnOn : styles.micBtn, { transform: [{ scale: 1 + dictation.level * 0.15 }] }]}
              onPress={() => { if (dictation.listening) dictation.stop(); else dictation.start().catch(() => {}); }}
              disabled={send.isPending}
              accessibilityRole="button"
              accessibilityLabel={dictation.listening ? 'Stop dictating' : 'Dictate a message'}
            >
              {dictation.listening ? <Square size={16} color="#fff" fill="#fff" /> : <Mic size={20} color={palette.primaryText} />}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnOff]}
              onPress={() => onSend()}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send"
            >
              <ArrowUp size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ id, role, text, mediaIds, modelLabel, onSpeak, artifacts, onSaveNote }: {
  id?: string;
  role: 'user' | 'assistant';
  text: string;
  mediaIds: string[];
  modelLabel?: string;
  onSpeak?: () => void;
  artifacts?: AiArtifact[];
  onSaveNote?: () => void;
}) {
  const styles = useStyles();
  const { palette } = useTheme();
  const speech = useSpeechState();
  const mine = role === 'user';
  const speakingThis = !!id && speech.id === id && speech.status !== 'idle';
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
      {!mine && artifacts?.length ? artifacts.map(a => (
        <TouchableOpacity
          key={a.id}
          style={styles.artifact}
          onPress={() => router.push(a.type === 'note' ? `/notes/${a.id}` : `/ai/template/${a.id}`)}
          accessibilityRole="button"
          accessibilityLabel={a.type === 'note' ? `Open note ${a.title}` : `Review template ${a.title}`}
        >
          <Text style={styles.artifactIcon}>{a.type === 'note' ? '📝' : '🧩'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.artifactKind} maxFontSizeMultiplier={1.2}>{a.type === 'note' ? 'Note saved' : 'Log template draft'}</Text>
            <Text style={styles.artifactTitle} maxFontSizeMultiplier={1.3} numberOfLines={2}>{a.title}</Text>
          </View>
          <Text style={styles.artifactAction} maxFontSizeMultiplier={1.2}>{a.type === 'note' ? 'Open' : 'Review'}</Text>
        </TouchableOpacity>
      )) : null}
      {!mine && (modelLabel || onSpeak || onSaveNote) ? (
        <View style={styles.bubbleFooter}>
          <Text style={styles.modelLabel} maxFontSizeMultiplier={1.2} numberOfLines={1}>{modelLabel ?? ''}</Text>
          {onSaveNote ? (
            <TouchableOpacity style={styles.speakBtn} onPress={onSaveNote} accessibilityRole="button" accessibilityLabel="Save as note">
              <BookmarkPlus size={18} color={palette.primaryText} />
            </TouchableOpacity>
          ) : null}
          {onSpeak ? (
            <TouchableOpacity
              style={styles.speakBtn}
              onPress={() => { if (speakingThis) stopSpeaking().catch(() => {}); else onSpeak(); }}
              accessibilityRole="button"
              accessibilityLabel={speakingThis ? 'Stop reading aloud' : 'Read this reply aloud'}
            >
              {speakingThis
                ? (speech.status === 'loading'
                  ? <ActivityIndicator size="small" color={palette.primaryText} />
                  : <Square size={14} color={palette.primaryText} fill={palette.primaryText} />)
                : <Volume2 size={18} color={palette.primaryText} />}
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  headerContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
    elevation: 3,
  },
  chipRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
    paddingTop: 2,
  },
  modelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: '85%',
  },
  modelStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modelChipText: {
    ...typography.caption,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  thread: { padding: 16, gap: 12, paddingBottom: 24 },
  intro: { gap: 10, paddingVertical: 8 },
  introTitle: { ...typography.title2, color: palette.text },
  introBody: { ...typography.body, color: palette.textSecondary, lineHeight: 22 },
  suggestion: { backgroundColor: palette.surface, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  suggestionText: { ...typography.body, color: palette.primaryText },
  bubble: { borderRadius: 20, paddingHorizontal: 15, paddingVertical: 12, gap: 8 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: palette.primary, borderBottomRightRadius: 6, maxWidth: '85%' },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: palette.surface, borderBottomLeftRadius: 6, maxWidth: '92%', borderWidth: 1, borderColor: palette.border },
  errorBubble: { alignSelf: 'flex-start', backgroundColor: palette.error + '18' },
  userText: { ...typography.body, color: '#fff', lineHeight: 22 },
  aiText: { ...typography.body, color: palette.text, lineHeight: 22 },
  bubblePhotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { ...typography.footnote, color: palette.textSecondary },
  errorText: { ...typography.body, color: palette.text, lineHeight: 22 },
  retry: { minHeight: 36, justifyContent: 'center' },
  retryText: { ...typography.bodyBold, color: palette.primaryText },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, backgroundColor: palette.surface, paddingTop: 8, paddingHorizontal: 10, gap: 8 },
  attachRow: { gap: 8, paddingHorizontal: 4 },
  attachSpinner: { position: 'absolute', top: 22, left: 22 },
  attachRemove: { position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 44, maxHeight: 140, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, backgroundColor: palette.background, color: palette.text, ...typography.body },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { opacity: 0.4 },
  micBtn: { backgroundColor: palette.background },
  micBtnOn: { backgroundColor: palette.error },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  modelLabel: { ...typography.caption, color: palette.textSecondary, flexShrink: 1 },
  artifact: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: palette.background,
  },
  artifactIcon: { fontSize: 22 },
  artifactKind: { ...typography.caption, color: palette.textSecondary },
  artifactTitle: { ...typography.bodyBold, color: palette.text },
  artifactAction: { ...typography.bodyBold, color: palette.primaryText },
  speakBtn: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
}));
