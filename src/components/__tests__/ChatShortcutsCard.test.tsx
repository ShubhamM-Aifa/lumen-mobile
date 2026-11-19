import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import { ChatShortcutsCard } from '../home/ChatShortcutsCard';
import { useAiAccess } from '../../hooks/useAiChat';
import { useCommunityStore } from '../../store/communityStore';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../hooks/useAiChat', () => ({ useAiAccess: jest.fn() }));
jest.mock('../../store/authStore', () => ({ useAuthStore: () => ({ user: { _id: 'me' } }) }));
jest.mock('../../store/communityStore', () => ({ useCommunityStore: jest.fn() }));

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

const fetchChannels = jest.fn().mockResolvedValue(undefined);
const fetchDms = jest.fn().mockResolvedValue(undefined);
function setup(opts: { ai?: boolean; channels?: unknown[]; dms?: unknown[] }) {
  (useAiAccess as jest.Mock).mockReturnValue({ data: { fullAccess: opts.ai ?? true, configured: true } });
  (useCommunityStore as unknown as jest.Mock).mockReturnValue({
    channels: opts.channels ?? [], dmChannels: opts.dms ?? [], fetchChannels, fetchDms,
  });
}
async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<ChatShortcutsCard />); });
  return tree;
}

beforeEach(() => jest.clearAllMocks());

describe('ChatShortcutsCard', () => {
  it('sends a typed question straight into a new Lumen AI chat', async () => {
    setup({});
    const t = await render();
    const input = t.root.findByProps({ accessibilityLabel: 'Ask Lumen AI' });
    await act(async () => { input.props.onChangeText('Why am I so tired?'); });
    await act(async () => { input.props.onSubmitEditing(); });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/ai/[id]', params: { id: 'new', prompt: 'Why am I so tired?', autosend: '1' } });
  });

  it('offers a one-tap question', async () => {
    setup({});
    const t = await render();
    await press(t, 'How did I sleep this week?');
    expect(router.push).toHaveBeenCalledWith({ pathname: '/ai/[id]', params: { id: 'new', prompt: 'How did I sleep this week?', autosend: '1' } });
  });

  it('points to Settings while Lumen AI is off, and does not show the question box', async () => {
    setup({ ai: false });
    const t = await render();
    await press(t, 'Set up Lumen AI');
    expect(router.push).toHaveBeenCalledWith('/settings');
    expect(t.root.findAllByProps({ accessibilityLabel: 'Ask Lumen AI' })).toHaveLength(0);
  });

  it('lists channels with unread messages and opens one', async () => {
    setup({
      channels: [
        { _id: 'c1', slug: 'general', name: 'General', icon: '💬', unreadCount: 2 },
        { _id: 'c2', slug: 'pots', name: 'POTS', icon: '🫀', unreadCount: 5 },
        { _id: 'c3', slug: 'quiet', name: 'Quiet', icon: '🌿', unreadCount: 0 },
      ],
    });
    const t = await render();
    expect(texts(t)).toContain('7');
    expect(texts(t).join(' ')).not.toContain('Quiet');
    const first = t.root.findAllByProps({ accessibilityLabel: 'POTS, 5 unread' })[0];
    await act(async () => { first.props.onPress(); });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/community/[channelId]', params: { channelId: 'pots' } });
    expect(fetchChannels).toHaveBeenCalled();
  });

  it('counts message requests from other people and says when all is read', async () => {
    setup({ dms: [{ _id: 'd1', dmStatus: 'pending', dmInitiatorId: 'other' }, { _id: 'd2', dmStatus: 'pending', dmInitiatorId: 'me' }] });
    expect(texts(await render())).toContain('1 message request waiting');
    setup({});
    expect(texts(await render()).join(' ')).toContain('all caught up');
  });
});
