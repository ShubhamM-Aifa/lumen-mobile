/**
 * Lumen AI chat thread. `id` is a conversation id, or "new" for a fresh chat.
 * The AI can read all of the member's own data (logs, notes, sleep, activity, medicines, records,
 * photos) through server-side tools; attached photos go with the question.
 * The paperclip also attaches Lumen items (a day, a note, a task or list, a medicine, a health
 * record, an insight...) and PDFs; the server reads the full item. `/ai/new?attach=<ref>` (from
 * "Ask Lumen AI" on other screens, see useAskLumenAi) opens with that item already attached.
 * Voice: the mic dictates into the box (on-device recognizer), each reply has a speaker button,
 * and the header opens hands-free voice mode (./voice.tsx). The chip under the title picks the model.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, StyleSheet, Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowUp, AudioLines, BookmarkPlus, CalendarDays, CalendarRange, Camera, ChevronDown, FileText, Flame, FlaskConical,
  Images, Lightbulb, ListTodo, Mic, NotebookPen, Paperclip, Pill, Square, Stethoscope, Volume2, X,
} from 'lucide-react-native';
import { ScreenTopBar } from '../../src/components/ios/ScreenTopBar';
import { AiMessageText } from '../../src/components/ai/AiMessageText';
import { AiPhotoThumb } from '../../src/components/ai/AiPhotoThumb';
import { AiSetupNotice } from '../../src/components/ai/AiSetupNotice';
import { RefChip } from '../../src/components/ai/RefChip';
import { AttachPickerModal, type PickerKind } from '../../src/components/ai/AttachPickerModal';
import { OptionsSheet, type SheetSection } from '../../src/components/todo/OptionsSheet';
import { AppDateTimePicker } from '../../src/components/common/AppDateTimePicker';
import { useTodayStr } from '../../src/hooks/useTodo';
import { flushOutbox } from '../../src/services/todo/outbox';
import { resolveMediaUrl } from '../../src/services/mediaService';
import { toDateStr, parseDateStr } from '../../src/utils/todo/dates';
import {
  addRef, dayRefTitle, decodeRef, MAX_FILE_REFS, MAX_PDF_BYTES, MAX_REFS, refRoute, sameRef, type ChatRef,
} from '../../src/utils/ai/refs';
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

/** Opens a sent attachment: its screen, or for a PDF its file. */
async function openRef(ref: ChatRef) {
  const route = refRoute(ref);
  if (route) { router.push(route as never); return; }
  try {
    const url = await resolveMediaUrl(ref.id);
    if (url) await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open the file', 'Check your connection and try again.');
  }
}

export default function AiChatScreen() {
  const { id, attach, prompt } = useLocalSearchParams<{ id: string; attach?: string; prompt?: string }>();
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
  const [refs, setRefs] = useState<ChatRef[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [picker, setPicker] = useState<PickerKind | null>(null);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const todayStr = useTodayStr();
  // Stable dates: the picker resets its selection whenever `value` changes.
  const todayDate = useMemo(() => parseDateStr(todayStr), [todayStr]);
  const todayEnd = useMemo(() => new Date(todayDate.getTime() + 86_399_000), [todayDate]);

  // "Ask Lumen AI" on another screen: start with that item attached; the member writes the question.
  useEffect(() => {
    const ref = decodeRef(attach);
    if (ref) setRefs(prev => addRef(prev, ref));
    if (typeof prompt === 'string' && prompt) setDraft(prev => prev || prompt);
  }, [attach, prompt]);

  // Latest refs for callbacks that finish later (a PDF upload).
  const refsNow = useRef<ChatRef[]>([]);
  refsNow.current = refs;
  const attachRef = (ref: ChatRef) => {
    const prev = refsNow.current;
    const next = addRef(prev, ref);
    if (next === prev) {
      if (!prev.some(r => sameRef(r, ref))) {
        Alert.alert('That is the limit', ref.kind === 'file' ? `You can attach up to ${MAX_FILE_REFS} PDFs to one message.` : `You can attach up to ${MAX_REFS} items to one message.`);
      }
      return;
    }
    refsNow.current = next;
    setRefs(next);
  };
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
  const uploading = uploadingFiles > 0 || attachments.some(a => !a.mediaId && !a.failed);
  const canSend = !send.isPending && !uploading && (draft.trim().length > 0 || attachments.some(a => a.mediaId) || refs.length > 0);

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

  const onSend = async (text = draft) => {
    if (dictation.listening) dictation.cancel();
    const message = text.trim();
    const mediaIds = attachments.flatMap(a => (a.mediaId ? [a.mediaId] : []));
    const sending = refs;
    if (!message && mediaIds.length === 0 && sending.length === 0) return;
    setDraft('');
    setAttachments([]);
    setRefs([]);
    // A task made offline must reach the server before the AI can read it.
    if (sending.some(r => r.kind === 'task' || r.kind === 'list')) await flushOutbox().catch(() => {});
    submit({ conversationId: isNew ? undefined : id, message, mediaIds, ...(sending.length ? { refs: sending } : {}) });
  };

  const addPdf = async () => {
    if (refsNow.current.filter(r => r.kind === 'file').length >= MAX_FILE_REFS) {
      Alert.alert('That is the limit', `You can attach up to ${MAX_FILE_REFS} PDFs to one message.`);
      return;
    }
    const picked = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
    const file = picked.canceled ? undefined : picked.assets?.[0];
    if (!file) return;
    if (file.size && file.size > MAX_PDF_BYTES) {
      Alert.alert('This PDF is too large', 'Lumen AI can read PDFs up to 10 MB.');
      return;
    }
    setUploadingFiles(n => n + 1);
    try {
      // Sensitive like health photos: lab reports and prescriptions.
      const { mediaId } = await uploadMedia(file.uri, 'application/pdf', true, file.size ?? undefined);
      attachRef({ kind: 'file', id: mediaId, title: file.name || 'Document.pdf' });
    } catch {
      Alert.alert('Could not upload the PDF', 'Check your connection and try again.');
    } finally {
      setUploadingFiles(n => n - 1);
    }
  };

  const needPhotoAccess = () => {
    Alert.alert(
      'Photos are off for Lumen AI',
      'Allow “Include photos” in Settings → AI & Insights to let Lumen AI look at photos.',
      [{ text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: () => router.push('/settings') }],
    );
  };

  const photoOption = (fromCamera: boolean) => () => {
    if (!access.data?.photoAccess) { needPhotoAccess(); return; }
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('That is the limit', `You can attach up to ${MAX_ATTACHMENTS} photos to one message.`);
      return;
    }
    addPhoto(fromCamera).catch(() => {});
  };

  const openPicker = (kind: PickerKind) => () => setPicker(kind);
  const attachSections: SheetSection[] = [
    {
      title: 'Photos and files',
      options: [
        { key: 'camera', label: 'Take photo', icon: Camera, onPress: photoOption(true), opensModal: true },
        { key: 'gallery', label: 'Choose photo', icon: Images, onPress: photoOption(false), opensModal: true },
        { key: 'pdf', label: 'PDF file', hint: 'Lab report, prescription', icon: FileText, onPress: () => { addPdf().catch(() => {}); }, opensModal: true },
      ],
    },
    {
      title: 'From Lumen',
      options: [
        { key: 'day', label: 'A day', hint: 'Everything logged', icon: CalendarDays, onPress: () => setDayPickerOpen(true), opensModal: true },
        { key: 'note', label: 'Note', icon: NotebookPen, onPress: openPicker('note'), opensModal: true },
        { key: 'task', label: 'Task or list', icon: ListTodo, onPress: openPicker('task_or_list'), opensModal: true },
        { key: 'medication', label: 'Medicine', icon: Pill, onPress: openPicker('medication'), opensModal: true },
        { key: 'record', label: 'Health record', icon: Stethoscope, onPress: openPicker('record'), opensModal: true },
      ],
    },
    {
      title: 'Insights',
      options: [
        { key: 'pattern', label: 'Insight pattern', icon: Lightbulb, onPress: openPicker('pattern'), opensModal: true },
        { key: 'experiment', label: 'Experiment', icon: FlaskConical, onPress: openPicker('experiment'), opensModal: true },
        { key: 'flare', label: 'Flare', icon: Flame, onPress: openPicker('flare'), opensModal: true },
        { key: 'weekly', label: 'Weekly review', icon: CalendarRange, onPress: openPicker('weekly_report'), opensModal: true },
      ],
    },
  ];

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
              Lumen AI can read all your logs, notes, sleep, steps, medicines, records{access.data?.photoAccess ? ' and photos' : ''}. Tap the paperclip to attach a day, a note, a task, a lab report PDF and more. It can be wrong — check important things with your doctor.
            </Text>
            {SUGGESTIONS.map(s => (
              <TouchableOpacity key={s} style={styles.suggestion} onPress={() => { onSend(s).catch(() => {}); }} accessibilityRole="button">
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
            refs={m.refs}
            modelLabel={m.modelLabel ?? undefined}
            artifacts={m.artifacts}
            onSaveNote={m.role === 'assistant' && !isNew ? () => onSaveNote(m.id) : undefined}
            onSpeak={voice ? () => { speakReply(m.text, { voice: voice.ttsVoice, natural: voice.natural, id: m.id }).catch(() => {}); } : undefined}
          />
        ))}
        {pending ? <Bubble role="user" text={pending.message} mediaIds={pending.mediaIds ?? []} refs={pending.refs} /> : null}
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
        {refs.length > 0 || uploadingFiles > 0 ? (
          <ScrollView horizontal contentContainerStyle={styles.attachRow} keyboardShouldPersistTaps="handled">
            {refs.map(r => (
              <RefChip key={`${r.kind}:${r.id}`} ref_={r} variant="composer" onRemove={() => setRefs(prev => prev.filter(x => !sameRef(x, r)))} />
            ))}
            {uploadingFiles > 0 ? (
              <View style={styles.uploadingChip} accessibilityLabel="Uploading PDF">
                <ActivityIndicator size="small" color={palette.primaryText} />
                <Text style={styles.uploadingText}>Uploading PDF…</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : null}
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
          <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="Attach">
            <Paperclip size={22} color={palette.primaryText} />
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
          {dictation.listening || (!draft.trim() && attachments.length === 0 && refs.length === 0) ? (
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
              onPress={() => { onSend().catch(() => {}); }}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send"
            >
              <ArrowUp size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <OptionsSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Attach" sections={attachSections} />
      <AttachPickerModal
        kind={picker}
        onClose={() => setPicker(null)}
        onPick={ref => { setPicker(null); attachRef(ref); }}
      />
      <AppDateTimePicker
        visible={dayPickerOpen}
        mode="date"
        title="Attach a day"
        value={todayDate}
        maximumDate={todayEnd}
        onClose={() => setDayPickerOpen(false)}
        onChange={d => {
          setDayPickerOpen(false);
          const date = toDateStr(d);
          attachRef({ kind: 'day', id: date, title: dayRefTitle(date, todayStr) });
        }}
      />
    </KeyboardAvoidingView>
  );
}

function Bubble({ id, role, text, mediaIds, refs, modelLabel, onSpeak, artifacts, onSaveNote }: {
  id?: string;
  role: 'user' | 'assistant';
  text: string;
  mediaIds: string[];
  refs?: ChatRef[];
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
      {refs?.length ? (
        <View style={styles.bubbleRefs}>
          {refs.map(r => <RefChip key={`${r.kind}:${r.id}`} ref_={r} variant="sent" onPress={() => { openRef(r).catch(() => {}); }} />)}
        </View>
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
  bubbleRefs: { gap: 6, alignItems: 'flex-end' },
  uploadingChip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background },
  uploadingText: { ...typography.footnote, color: palette.textSecondary },
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
