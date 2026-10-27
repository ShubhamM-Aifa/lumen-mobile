import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useNotificationInboxStore,
  countUnread,
  dayLabel,
  entryFromNotification,
  INBOX_STORAGE_KEY,
  MAX_INBOX_ENTRIES,
  InboxEntry,
} from '../notificationInboxStore';

const HOUR = 3600000;
const NOW = new Date(2026, 9, 27, 14, 0, 0).getTime();

const entry = (id: string, over: Partial<InboxEntry> = {}): InboxEntry => ({
  id, kind: 'Reminders', icon: 'bell', tone: 'blue', title: id, body: '', at: NOW - HOUR, read: false, ...over,
});

const reset = () => useNotificationInboxStore.setState({ entries: [], isLoaded: false });
const unread = () => countUnread(useNotificationInboxStore.getState().entries, NOW);

describe('notification inbox store', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    reset();
  });

  it('adds newest first and ignores an id it already has', async () => {
    const s = useNotificationInboxStore.getState();
    await s.add([entry('a', { at: NOW - 3 * HOUR }), entry('b', { at: NOW - HOUR })]);
    await s.add([entry('a', { title: 'changed' }), entry('c', { at: NOW - 2 * HOUR })]);
    const e = useNotificationInboxStore.getState().entries;
    expect(e.map(x => x.id)).toEqual(['b', 'c', 'a']);
    expect(e.find(x => x.id === 'a')?.title).toBe('a');
  });

  it('keeps only the most recent 100', async () => {
    const many = Array.from({ length: MAX_INBOX_ENTRIES + 10 }, (_, i) => entry(`e${i}`, { at: NOW - i * 1000 }));
    await useNotificationInboxStore.getState().add(many);
    const e = useNotificationInboxStore.getState().entries;
    expect(e).toHaveLength(MAX_INBOX_ENTRIES);
    expect(e[0].id).toBe('e0');
  });

  it('marks one or all read, and the count follows', async () => {
    const s = useNotificationInboxStore.getState();
    await s.add([entry('a'), entry('b'), entry('c')]);
    expect(unread()).toBe(3);
    await s.markRead('a');
    expect(unread()).toBe(2);
    await s.markAllRead();
    expect(unread()).toBe(0);
  });

  it('does not count a notification scheduled for later as unread', () => {
    expect(countUnread([entry('later', { at: NOW + HOUR }), entry('now')], NOW)).toBe(1);
  });

  it('survives a restart, including the read state', async () => {
    const s = useNotificationInboxStore.getState();
    await s.add([entry('a', { at: NOW - 2 * HOUR }), entry('b', { at: NOW - HOUR })]);
    await s.markRead('a');
    reset();
    await useNotificationInboxStore.getState().load();
    const e = useNotificationInboxStore.getState().entries;
    expect(e.map(x => [x.id, x.read])).toEqual([['b', false], ['a', true]]);
    expect(useNotificationInboxStore.getState().isLoaded).toBe(true);
  });

  it('keeps entries added before the saved ones finished loading', async () => {
    await AsyncStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify([entry('old', { at: NOW - 5 * HOUR })]));
    useNotificationInboxStore.setState({ entries: [entry('new')], isLoaded: false });
    await useNotificationInboxStore.getState().load();
    expect(useNotificationInboxStore.getState().entries.map(x => x.id)).toEqual(['new', 'old']);
  });

  it('copes with corrupt saved data', async () => {
    await AsyncStorage.setItem(INBOX_STORAGE_KEY, '{not json');
    await useNotificationInboxStore.getState().load();
    expect(useNotificationInboxStore.getState().entries).toEqual([]);
    expect(useNotificationInboxStore.getState().isLoaded).toBe(true);
  });
});

describe('entryFromNotification', () => {
  it('turns an intelligence notification into an Insights entry keyed by its candidate', () => {
    const e = entryFromNotification({
      identifier: 'x', title: 'Pacing nudge', body: 'Activity is ahead of your usual.',
      data: { type: 'INTEL_PACING', candidateId: 'cand-1' }, at: NOW,
    })!;
    expect(e).toMatchObject({ id: 'intel:cand-1', kind: 'Insights', icon: 'battery', tone: 'green', title: 'Pacing nudge', read: false });
  });

  it('uses the reminder category for the icon and sends the tap to Reminders', () => {
    const e = entryFromNotification(
      { identifier: 'r1', title: 'Drink water', body: 'Time for a glass', data: { reminderId: 'rem-1' }, at: NOW },
      'HYDRATION',
    )!;
    expect(e).toMatchObject({ kind: 'Reminders', icon: 'droplet', tone: 'blue', route: '/reminders' });
  });

  it('gives each delivery of a repeating reminder its own entry', () => {
    const a = entryFromNotification({ identifier: 'r1', title: 'Drink water', data: { reminderId: 'x' }, at: NOW })!;
    const b = entryFromNotification({ identifier: 'r1', title: 'Drink water', data: { reminderId: 'x' }, at: NOW + 2 * HOUR })!;
    const again = entryFromNotification({ identifier: 'r1', title: 'Drink water', data: { reminderId: 'x' }, at: NOW + 5000 })!;
    expect(a.id).not.toBe(b.id);
    expect(again.id).toBe(a.id);
  });

  it('skips the Test Alarm and empty notifications', () => {
    expect(entryFromNotification({ title: 'Test', body: 'x', data: { test: true, reminderId: 'test_alarm' }, at: NOW })).toBeNull();
    expect(entryFromNotification({ title: '', body: '', at: NOW })).toBeNull();
  });

  it('files a notification with no known source under System', () => {
    const e = entryFromNotification({ identifier: 'z', title: 'Hello', body: 'World', at: NOW })!;
    expect(e).toMatchObject({ kind: 'System', tone: 'gray' });
    expect(e.route).toBeUndefined();
  });
});

describe('dayLabel', () => {
  it('names today and yesterday, then dates', () => {
    expect(dayLabel(NOW - HOUR, NOW)).toBe('Today');
    expect(dayLabel(NOW - 20 * HOUR, NOW)).toBe('Yesterday');
    expect(dayLabel(NOW - 72 * HOUR, NOW)).not.toMatch(/^(Today|Yesterday)$/);
  });
});
