import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AiChatScreen from '../../../app/ai/[id]';
import { useAiAccess, useAiConversation, useSendAiMessage } from '../../hooks/useAiChat';
import { useDictation, type DictationOptions } from '../../services/voice/useDictation';
import { speakReply } from '../../services/voice/tts';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() }, useLocalSearchParams: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('../../services/mediaUpload', () => ({ uploadMedia: jest.fn(), getMimeType: () => 'image/jpeg' }));
jest.mock('../../services/todo/outbox', () => ({ flushOutbox: jest.fn(async () => undefined) }));
jest.mock('../../services/mediaService', () => ({ resolveMediaUrl: jest.fn(async () => 'https://files/x.pdf') }));
jest.mock('../../hooks/useTodo', () => ({ useTodayStr: () => '2026-11-19' }));
jest.mock('../../components/ios/ScreenTopBar', () => ({ ScreenTopBar: () => null }));
jest.mock('../../components/ai/AiPhotoThumb', () => ({ AiPhotoThumb: () => null }));
jest.mock('../../services/voice/useDictation', () => ({ useDictation: jest.fn() }));
jest.mock('../../services/voice/tts', () => ({ speakReply: jest.fn(async () => undefined), stopSpeaking: jest.fn(async () => undefined) }));
jest.mock('../../services/voice/useSpeechState', () => ({ useSpeechState: () => ({ status: 'idle', id: null }) }));
const mockSaveNote = jest.fn();
jest.mock('../../hooks/useAiChat', () => ({
  useAiAccess: jest.fn(), useAiConversation: jest.fn(), useSendAiMessage: jest.fn(),
  useSaveMessageAsNote: jest.fn(() => ({ mutate: mockSaveNote, isPending: false })),
  useAttachables: jest.fn((kind: string | null) => ({
    isLoading: false, isError: false,
    data: kind === 'note' ? [{ id: 'n7', title: 'Doctor visit', subtitle: 'Edited today' }] : kind ? [] : undefined,
  })),
}));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);
const press = async (t: ReactTestRenderer, text: string) => {
  const node = t.root.findAll(n => typeof n.props.onPress === 'function' && n.findAll(c => flat(c.props.children) === text).length > 0)[0];
  await act(async () => { node.props.onPress(); });
};

const mutate = jest.fn();
const on = {
  fullAccess: true, photoAccess: true, configured: true, modelLabel: 'Gemini 3.1 Flash-Lite', chosenModelUnavailable: false,
  voice: { ttsVoice: 'Puck', natural: true, sttLang: 'hi-IN' },
};
let dictationOpts: DictationOptions;
const dictation = { listening: false, partial: '', level: 0, start: jest.fn(async () => true), stop: jest.fn(), cancel: jest.fn() };

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<AiChatScreen />); });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'new' });
  (useAiAccess as jest.Mock).mockReturnValue({ data: on });
  (useAiConversation as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
  (useSendAiMessage as jest.Mock).mockReturnValue({ mutate, isPending: false });
  (useDictation as jest.Mock).mockImplementation((o: DictationOptions) => { dictationOpts = o; return dictation; });
});

describe('Lumen AI chat screen', () => {
  it('asks the member to turn Lumen AI on first', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: { ...on, fullAccess: false } });
    const t = await render();
    expect(texts(t)).toContain('Lumen AI is off');
  });

  it('sends a suggested question as a new chat, then opens the saved conversation', async () => {
    mutate.mockImplementation((_input, opts) => opts.onSuccess({ conversation: { id: 'c1', messages: [] }, reply: 'ok', error: null, requests: 2 }));
    const t = await render();
    await press(t, 'How did my last week go?');
    expect(mutate).toHaveBeenCalledWith({ conversationId: undefined, message: 'How did my last week go?', mediaIds: [] }, expect.anything());
    expect(router.replace).toHaveBeenCalledWith('/ai/c1');
  });

  it('sends typed text in an existing conversation', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'c9' });
    const t = await render();
    await act(async () => { t.root.findByType(TextInput).props.onChangeText('  sleep vs dairy?  '); });
    await act(async () => { t.root.findAll(n => n.props.accessibilityLabel === 'Send' && n.props.onPress)[0].props.onPress(); });
    expect(mutate).toHaveBeenCalledWith({ conversationId: 'c9', message: 'sleep vs dairy?', mediaIds: [] }, expect.anything());
  });

  it('shows a failed turn and lets the member retry the same message', async () => {
    mutate.mockImplementationOnce((_input, opts) => opts.onSuccess({ conversation: null, reply: "Gemini's free tier is busy.", error: 'rate_limited', requests: 1 }));
    const t = await render();
    await press(t, 'How did my last week go?');
    expect(texts(t)).toContain("Gemini's free tier is busy.");
    await press(t, 'Try again');
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate.mock.calls[1][0]).toEqual(mutate.mock.calls[0][0]);
  });

  it('renders the saved conversation, with the AI reply as bullets', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'c2' });
    (useAiConversation as jest.Mock).mockReturnValue({
      isLoading: false,
      data: {
        id: 'c2', title: 'Sleep', messages: [
          { id: 'm1', role: 'user', text: 'How is my sleep?', mediaIds: [], createdAt: '' },
          { id: 'm2', role: 'assistant', text: 'Better this week.\n- 7.1 h average\n- fewer late nights', mediaIds: [], createdAt: '' },
        ],
      },
    });
    const t = await render();
    const all = texts(t);
    expect(all).toContain('How is my sleep?');
    expect(all).toContain('Better this week.');
    expect(all).toContain('7.1 h average');
    expect(all).not.toContain('Ask anything about your data');
  });

  it('dictates into the message box in the chosen language, without sending', async () => {
    const t = await render();
    expect(dictationOpts.lang).toBe('hi-IN');
    await act(async () => { t.root.findAll(n => n.props.accessibilityLabel === 'Dictate a message' && n.props.onPress)[0].props.onPress(); });
    expect(dictation.start).toHaveBeenCalled();
    await act(async () => { dictationOpts.onFinal('meri neend kaisi rahi'); });
    expect(t.root.findByType(TextInput).props.value).toBe('meri neend kaisi rahi');
    expect(mutate).not.toHaveBeenCalled();
    // With text in the box the button becomes Send.
    expect(t.root.findAll(n => n.props.accessibilityLabel === 'Send' && n.props.onPress).length).toBeGreaterThan(0);
  });

  it('reads a reply aloud in the chosen voice and shows which model wrote it', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'c2' });
    (useAiConversation as jest.Mock).mockReturnValue({
      isLoading: false,
      data: { id: 'c2', title: 'Sleep', messages: [
        { id: 'm2', role: 'assistant', text: 'Better this week.', mediaIds: [], createdAt: '', modelLabel: 'Claude Opus 5.5' },
      ] },
    });
    const t = await render();
    expect(texts(t)).toContain('Claude Opus 5.5');
    await act(async () => { t.root.findAll(n => n.props.accessibilityLabel === 'Read this reply aloud' && n.props.onPress)[0].props.onPress(); });
    expect(speakReply).toHaveBeenCalledWith('Better this week.', { voice: 'Puck', natural: true, id: 'm2' });
  });

  it('shows the current model and opens the model picker', async () => {
    const t = await render();
    expect(texts(t).join(' ')).toContain('Gemini 3.1 Flash-Lite');
    await act(async () => { t.root.findAll(n => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Model:') && n.props.onPress)[0].props.onPress(); });
    expect(router.push).toHaveBeenCalledWith('/ai/model');
  });

  it('shows note and template cards under a reply, and saves a reply as a note', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'c3' });
    (useAiConversation as jest.Mock).mockReturnValue({
      isLoading: false,
      data: { id: 'c3', title: 'RA', messages: [
        { id: 'm1', role: 'assistant', text: 'Saved it and drafted a tracker.', mediaIds: [], createdAt: '',
          artifacts: [{ type: 'note', id: 'n1', title: 'RA plan' }, { type: 'template_draft', id: 'd1', title: 'RA tracking' }] },
      ] },
    });
    const t = await render();
    expect(texts(t)).toEqual(expect.arrayContaining(['Note saved', 'RA plan', 'Log template draft', 'RA tracking', 'Review']));
    await act(async () => { t.root.findAll(n => n.props.accessibilityLabel === 'Open note RA plan' && n.props.onPress)[0].props.onPress(); });
    expect(router.push).toHaveBeenCalledWith('/notes/n1');
    await act(async () => { t.root.findAll(n => n.props.accessibilityLabel === 'Review template RA tracking' && n.props.onPress)[0].props.onPress(); });
    expect(router.push).toHaveBeenCalledWith('/ai/template/d1');
    await act(async () => { t.root.findAll(n => n.props.accessibilityLabel === 'Save as note' && n.props.onPress)[0].props.onPress(); });
    expect(mockSaveNote).toHaveBeenCalledWith({ conversationId: 'c3', messageId: 'm1' }, expect.anything());
  });
});

describe('Lumen AI chat attachments', () => {
  const byLabel = (t: ReactTestRenderer, label: string) => t.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
  const tap = async (t: ReactTestRenderer, label: string) => { await act(async () => { byLabel(t, label).props.onPress(); }); };
  // The attach menu waits for its close animation before opening the next sheet.
  const settle = () => act(async () => { await new Promise(r => setTimeout(r, 400)); });

  it('attaches a note from the picker and sends it with the question', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'c9' });
    const t = await render();
    await tap(t, 'Attach');
    await tap(t, 'Note');
    await settle();
    await tap(t, 'Attach Doctor visit');
    expect(texts(t)).toContain('Doctor visit');
    await act(async () => { t.root.findByType(TextInput).props.onChangeText('What should I ask?'); });
    await tap(t, 'Send');
    expect(mutate).toHaveBeenCalledWith(
      { conversationId: 'c9', message: 'What should I ask?', mediaIds: [], refs: [{ kind: 'note', id: 'n7', title: 'Doctor visit' }] },
      expect.anything(),
    );
  });

  it('opens with an item from "Ask Lumen AI" attached, and can send it without text', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'new', attach: JSON.stringify({ kind: 'day', id: '2026-11-17', title: 'Tue, 17 Nov' }) });
    const t = await render();
    expect(texts(t)).toContain('Tue, 17 Nov');
    await tap(t, 'Send');
    expect(mutate).toHaveBeenCalledWith(
      { conversationId: undefined, message: '', mediaIds: [], refs: [{ kind: 'day', id: '2026-11-17', title: 'Tue, 17 Nov' }] },
      expect.anything(),
    );
  });

  it('removes an attachment before sending', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'new', attach: JSON.stringify({ kind: 'note', id: 'n1', title: 'Visit' }) });
    const t = await render();
    await tap(t, 'Remove Visit');
    expect(texts(t)).not.toContain('Visit');
  });

  it('uploads a picked PDF as a sensitive file and attaches it by name', async () => {
    const { getDocumentAsync } = jest.requireMock('expo-document-picker') as { getDocumentAsync: jest.Mock };
    const { uploadMedia } = jest.requireMock('../../services/mediaUpload') as { uploadMedia: jest.Mock };
    getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cbc.pdf', name: 'cbc.pdf', size: 2048, mimeType: 'application/pdf' }] });
    uploadMedia.mockResolvedValue({ mediaId: 'f1', url: '' });
    const t = await render();
    await tap(t, 'Attach');
    await tap(t, 'PDF file');
    await settle();
    expect(uploadMedia).toHaveBeenCalledWith('file:///cbc.pdf', 'application/pdf', true, 2048);
    expect(texts(t)).toContain('cbc.pdf');
  });

  it('shows sent attachments as chips that open the item', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'c4' });
    (useAiConversation as jest.Mock).mockReturnValue({
      isLoading: false,
      data: { id: 'c4', title: 'Tasks', messages: [
        { id: 'm1', role: 'user', text: 'Help me plan this', mediaIds: [], createdAt: '', refs: [{ kind: 'task', id: 't1', title: 'Book blood test' }] },
      ] },
    });
    const t = await render();
    await tap(t, 'Task: Book blood test. Open');
    expect(router.push).toHaveBeenCalledWith('/todo/task/t1');
  });
});
