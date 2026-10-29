import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationsScreen from '../../../app/notifications';
import { useNotificationInboxStore, InboxEntry } from '../../store/notificationInboxStore';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: () => mockBack(), canGoBack: () => true, replace: jest.fn() },
  useFocusEffect: (cb: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('react').useEffect(cb, []);
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../services/notificationInbox', () => ({ refreshInbox: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../store/intelligenceStore', () => ({
  useIntelligenceStore: (sel: (s: unknown) => unknown) =>
    sel({ policy: { quietHours: { enabled: true, start: '22:00', end: '07:00' } } }),
}));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);
const press = (t: ReactTestRenderer, label: RegExp | string) =>
  t.root.findAll(n =>
    typeof n.props.onPress === 'function' &&
    (typeof label === 'string' ? n.props.accessibilityLabel === label : label.test(n.props.accessibilityLabel ?? ''))
  ).pop()!;

const today = new Date(Date.now() - 300000);
const entry = (id: string, over: Partial<InboxEntry> = {}): InboxEntry => ({
  id, kind: 'Reminders', icon: 'droplet', tone: 'blue', title: id, body: `${id} body`, at: today.getTime(), read: false, route: '/reminders', ...over,
});

async function render(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<NotificationsScreen />); });
  return tree;
}

describe('Notifications screen', () => {
  let mounted: ReactTestRenderer | null = null;
  afterEach(async () => {
    await act(async () => { mounted?.unmount(); });
    mounted = null;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    useNotificationInboxStore.setState({
      entries: [
        entry('Drink water'),
        entry('Gentle heads-up', { kind: 'Insights', icon: 'flame', tone: 'red', route: '/(tabs)/insights', at: today.getTime() - 60000 }),
        entry('Old report', { kind: 'System', icon: 'bell', tone: 'gray', read: true, route: undefined, at: today.getTime() - 3 * 86400000 }),
      ],
      isLoaded: true,
    });
  });

  it('shows the unread count, the day groups and the rows', async () => {
    const t = await render();
    mounted = t;
    const x = texts(t);
    expect(x).toContain('Notifications');
    expect(x).toContain('2 unread');
    expect(x).toContain('Today');
    expect(x).toContain('Drink water');
    expect(x).toContain('Gentle heads-up');
    expect(x).toContain('Old report');
    expect(x.some(s => s.startsWith('Notifications held during quiet hours (22:00–07:00)'))).toBe(true);
  });

  it('filters by kind and explains an empty filter', async () => {
    const t = await render();
    mounted = t;
    await act(async () => { press(t, 'Insights').props.onPress(); });
    let x = texts(t);
    expect(x).toContain('Gentle heads-up');
    expect(x).not.toContain('Drink water');
    await act(async () => { press(t, 'Community').props.onPress(); });
    x = texts(t);
    expect(x).toContain('Nothing here in this filter.');
  });

  it('marks a row read and opens its screen when tapped', async () => {
    const t = await render();
    mounted = t;
    await act(async () => { press(t, /Drink water/).props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith('/reminders');
    expect(useNotificationInboxStore.getState().entries.find(e => e.id === 'Drink water')?.read).toBe(true);
    expect(texts(t)).toContain('1 unread');
  });

  it('marks everything read and says so', async () => {
    const t = await render();
    mounted = t;
    await act(async () => { press(t, 'Mark all as read').props.onPress(); });
    expect(texts(t)).toContain('You’re all caught up');
    expect(press(t, 'Mark all as read').props.accessibilityState).toEqual({ disabled: true });
  });

  it('opens notification settings from the header', async () => {
    const t = await render();
    mounted = t;
    await act(async () => { press(t, 'Notification settings').props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith('/notification-settings');
  });

  it('has a friendly empty state', async () => {
    useNotificationInboxStore.setState({ entries: [], isLoaded: true });
    const t = await render();
    mounted = t;
    expect(texts(t)).toContain('No notifications yet');
    expect(texts(t)).toContain('You’re all caught up');
  });
});
