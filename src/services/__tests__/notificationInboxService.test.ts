import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncCommunityNotifications, recordNotification } from '../notificationInbox';
import { entryFromCommunity, useNotificationInboxStore } from '../../store/notificationInboxStore';
import { useReminderStore } from '../../store/reminderStore';
import { api } from '../../api/client';

jest.mock('../../api/client', () => ({ api: { get: jest.fn() } }));
jest.mock('../../store/reminderStore', () => ({
  useReminderStore: { getState: jest.fn() },
}));

const get = api.get as jest.Mock;
const entries = () => useNotificationInboxStore.getState().entries;

const reply = {
  id: 'community:m1', type: 'reply' as const, channelId: 'ch1', channelSlug: 'general',
  senderName: 'Rahul', snippet: 'Same for me.', createdAt: '2026-10-27T09:46:00.000Z',
};
const mention = {
  id: 'community:m2', type: 'mention' as const, channelId: 'ch1', channelSlug: 'general',
  senderName: 'Priya', snippet: 'Ask @Asha about salt', createdAt: '2026-10-27T09:03:00.000Z',
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useNotificationInboxStore.setState({ entries: [], isLoaded: false });
  (useReminderStore.getState as jest.Mock).mockReturnValue({ reminders: [{ _id: 'rem1', category: 'HYDRATION' }] });
});

describe('entryFromCommunity', () => {
  it('words a reply and a mention the way the design does', () => {
    expect(entryFromCommunity(reply)).toMatchObject({
      id: 'community:m1', kind: 'Community', icon: 'message', tone: 'indigo',
      title: 'Rahul replied to you in #general', body: '“Same for me.”', route: '/community/ch1', read: false,
    });
    expect(entryFromCommunity(mention)).toMatchObject({ icon: 'at', title: 'Priya mentioned you in #general' });
  });
});

describe('syncCommunityNotifications', () => {
  it('adds the server items to the inbox and does not duplicate them next time', async () => {
    get.mockResolvedValue([reply, mention]);
    await syncCommunityNotifications();
    await useNotificationInboxStore.getState().markRead('community:m1');
    await syncCommunityNotifications();
    expect(entries().map(e => e.id)).toEqual(['community:m1', 'community:m2']);
    expect(entries().find(e => e.id === 'community:m1')?.read).toBe(true);
  });

  it('stays quiet when the request fails (offline or signed out)', async () => {
    get.mockRejectedValue(new Error('Network Error'));
    await expect(syncCommunityNotifications()).resolves.toBeUndefined();
    expect(entries()).toEqual([]);
  });

  it('ignores an unexpected response', async () => {
    get.mockResolvedValue({ nope: true });
    await syncCommunityNotifications();
    expect(entries()).toEqual([]);
  });
});

describe('recordNotification', () => {
  const delivered = (over: Record<string, unknown> = {}) => ({
    date: 1793000000, // seconds, as iOS reports it
    request: { identifier: 'req-1', content: { title: 'Drink water', body: 'Time for a glass', data: { reminderId: 'rem1' } } },
    ...over,
  });

  it('records a reminder notification with its category icon and a millisecond time', async () => {
    await recordNotification(delivered());
    expect(entries()).toHaveLength(1);
    expect(entries()[0]).toMatchObject({ kind: 'Reminders', icon: 'droplet', title: 'Drink water' });
    expect(entries()[0].at).toBe(1793000000 * 1000);
  });

  it('does not record the same delivery twice', async () => {
    await recordNotification(delivered());
    await recordNotification(delivered());
    expect(entries()).toHaveLength(1);
  });

  it('ignores the Test Alarm and a malformed notification', async () => {
    await recordNotification(delivered({ request: { identifier: 't', content: { title: 'Test', body: 'x', data: { test: true } } } }));
    await recordNotification({});
    expect(entries()).toEqual([]);
  });
});
