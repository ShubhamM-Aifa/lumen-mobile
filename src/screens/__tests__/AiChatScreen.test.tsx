import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AiChatScreen from '../../../app/ai/[id]';
import { useAiAccess, useAiConversation, useSendAiMessage } from '../../hooks/useAiChat';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() }, useLocalSearchParams: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('../../services/mediaUpload', () => ({ uploadMedia: jest.fn(), getMimeType: () => 'image/jpeg' }));
jest.mock('../../components/ios/ScreenTopBar', () => ({ ScreenTopBar: () => null }));
jest.mock('../../components/ai/AiPhotoThumb', () => ({ AiPhotoThumb: () => null }));
jest.mock('../../hooks/useAiChat', () => ({
  useAiAccess: jest.fn(), useAiConversation: jest.fn(), useSendAiMessage: jest.fn(),
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
const on = { fullAccess: true, photoAccess: true, configured: true };

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
});
