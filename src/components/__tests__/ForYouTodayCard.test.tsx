import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { ForYouTodayCard } from '../home/ForYouTodayCard';
import { useIntelligenceStore, DEFAULT_POLICY } from '../../store/intelligenceStore';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('../../api/client', () => ({ api: { get: jest.fn(), post: jest.fn().mockResolvedValue({}), put: jest.fn() } }));
jest.mock('../../services/notifications', () => ({
  scheduleIntelligentNotification: jest.fn(),
  CHANNEL_ID_SAFETY: 'a', CHANNEL_ID_HEADS_UP: 'b', CHANNEL_ID_INSIGHTS: 'c', CHANNEL_ID_PACING: 'd', CHANNEL_ID_ALARM: 'e',
}));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);
const press = (t: ReactTestRenderer, label: string) =>
  t.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function').pop()!;

const item = (over: Record<string, unknown> = {}) => ({
  candidate: {
    id: 'tw:1', type: 'TRIGGER_WATCH' as const,
    title: 'You logged Dairy at lunch',
    body: 'Digestive issues have been more common 6–24 h after it.',
    confidence: 0.7, timeliness: 0.7,
    expiresAt: Date.now() + 5 * 3600000,
    provenance: ['You logged Dairy at 12:30 PM today.'],
    data: { route: '/(tabs)/insights' },
    ...over,
  },
  reason: 'watch' as const,
  addedAt: Date.now(),
});

async function render(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<ForYouTodayCard />); });
  return tree;
}

describe('ForYouTodayCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useIntelligenceStore.setState({ policy: DEFAULT_POLICY, inbox: [] });
  });

  it('shows nothing when there is nothing to say', async () => {
    const t = await render();
    expect(t.toJSON()).toBeNull();
  });

  it('reads like the design: label, one sentence, See Pattern', async () => {
    useIntelligenceStore.setState({ inbox: [item()] });
    const t = await render();
    const x = texts(t);
    expect(x).toContain('For you today');
    expect(x).toContain('You logged Dairy at lunch. Digestive issues have been more common 6–24 h after it.');
    expect(x).toContain('See Pattern');
  });

  it('opens the Insights tab from See Pattern', async () => {
    useIntelligenceStore.setState({ inbox: [item()] });
    const t = await render();
    await act(async () => { press(t, 'See pattern').props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/insights');
  });

  it('explains why, and removes the card when dismissed', async () => {
    useIntelligenceStore.setState({ inbox: [item()] });
    const t = await render();
    expect(texts(t).some(s => s.includes('You logged Dairy at 12:30 PM today.'))).toBe(false);
    await act(async () => { press(t, 'Why am I seeing this?').props.onPress(); });
    expect(texts(t).some(s => s.includes('You logged Dairy at 12:30 PM today.'))).toBe(true);
    await act(async () => { press(t, 'Dismiss').props.onPress(); });
    expect(useIntelligenceStore.getState().inbox).toEqual([]);
  });

  it('shows only the best observation, with a count, and the next one after a dismiss', async () => {
    useIntelligenceStore.setState({
      inbox: [
        item({ id: 'tw:weak', title: 'You logged Coffee this afternoon', confidence: 0.4 }),
        item({ id: 'tw:strong', title: 'You logged Dairy at lunch', confidence: 0.85 }),
        item({ id: 'tw:mid', title: 'You logged Gluten at dinner', confidence: 0.65 }),
      ],
    });
    const t = await render();
    const x = texts(t);
    // count real <Text> nodes: `texts` also matches the wrappers around them
    const own = t.root.findAllByType(Text).map(n => flat(n.props.children));
    expect(own.filter(s => s === 'For you today')).toHaveLength(1);
    expect(own.filter(s => s?.startsWith('You logged'))).toHaveLength(1);
    expect(x.some(s => s.startsWith('You logged Dairy at lunch'))).toBe(true);
    expect(x).toContain('1 of 3');
    await act(async () => { press(t, 'Dismiss').props.onPress(); });
    const after = texts(t);
    expect(after.some(s => s.startsWith('You logged Gluten at dinner'))).toBe(true);
    expect(after).toContain('1 of 2');
  });

  it('hides an observation once its window has passed', async () => {
    useIntelligenceStore.setState({ inbox: [item({ expiresAt: Date.now() - 1000 })] });
    const t = await render();
    expect(t.toJSON()).toBeNull();
  });
});
