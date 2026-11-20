import React from 'react';
import { Alert } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AiNotificationsGroup } from '../settings/AiNotificationsGroup';
import { useAiAccess, useSendTestAiNotification } from '../../hooks/useAiChat';
import { DEFAULT_POLICY } from '../../store/intelligenceStore';
import { ForYouTodayCard } from '../home/ForYouTodayCard';
import { useIntelligenceStore } from '../../store/intelligenceStore';
import { candidateFromNote } from '../../services/intelligence/aiNotes';
import { claimTap } from '../../hooks/useNotificationSync';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../hooks/useAiChat', () => ({ useAiAccess: jest.fn(), useSendTestAiNotification: jest.fn() }));
jest.mock('../../services/notifications', () => ({
  scheduleIntelligentNotification: jest.fn(), syncReminders: jest.fn(), ensureNotificationChannel: jest.fn(),
  setupNotificationCategories: jest.fn(), handleNotificationActionResponse: jest.fn(),
  CHANNEL_ID_SAFETY: 's', CHANNEL_ID_HEADS_UP: 'h', CHANNEL_ID_INSIGHTS: 'i', CHANNEL_ID_PACING: 'p', CHANNEL_ID_ALARM: 'a',
}));
jest.mock('../../services/alarmScheduler', () => ({ getPendingAlarm: jest.fn() }));
jest.mock('../../services/notificationInbox', () => ({ recordNotification: jest.fn() }));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);
const row = (t: ReactTestRenderer, label: string) => t.root.findAll(n => n.props.label === label && (n.props.onToggle || n.props.onPress))[0];

const patch = jest.fn();
const mutate = jest.fn();
const stepperCalls: Array<{ value: string; onMinus: () => void; onPlus: () => void; label: string }> = [];

async function renderGroup(aiOn = true, provider = 'gemini') {
  (useAiAccess as jest.Mock).mockReturnValue({ data: { fullAccess: aiOn, provider, modelLabel: provider === 'claude' ? 'Claude Opus 5.5' : 'Gemini 3.1 Flash-Lite' } });
  (useSendTestAiNotification as jest.Mock).mockReturnValue({ mutate, isPending: false });
  let t!: ReactTestRenderer;
  await act(async () => {
    t = create(
      <AiNotificationsGroup
        policy={DEFAULT_POLICY}
        off={false}
        patch={patch}
        shiftTime={(v, d) => (v === '08:00' && d === 30 ? '08:30' : v === '08:00' && d === -30 ? '07:30' : v)}
        formatTime={v => v}
        renderTimeStepper={o => { stepperCalls.push(o); return null; }}
      />,
    );
  });
  return t;
}

beforeEach(() => {
  jest.clearAllMocks();
  stepperCalls.length = 0;
});

describe('AiNotificationsGroup', () => {
  it('lists the four kinds with times for the scheduled ones', async () => {
    const t = await renderGroup();
    expect(texts(t)).toEqual(expect.arrayContaining(['Morning briefing', 'Midday nudge', 'Evening check-in', 'Reply to serious logs']));
    expect(stepperCalls.map(s => s.value)).toEqual(['08:00', '13:30', '20:30']);
    expect(texts(t).join(' ')).toContain('count toward your 2 per day');
  });

  it('turns a kind off and moves a time', async () => {
    const t = await renderGroup();
    await act(async () => { row(t, 'Midday nudge').props.onToggle(false); });
    expect(patch).toHaveBeenCalledWith({ capabilities: { aiNudge: false } });
    await act(async () => { stepperCalls[0].onPlus(); });
    expect(patch).toHaveBeenCalledWith({ aiTimes: { briefing: '08:30' } });
  });

  it('is disabled with a way to turn Lumen AI on when it is off', async () => {
    const t = await renderGroup(false);
    expect(row(t, 'Morning briefing').props.disabled).toBe(true);
    await act(async () => { row(t, 'Turn on Lumen AI').props.onPress(); });
    expect(router.push).toHaveBeenCalledWith('/settings');
  });

  it('warns that Claude notifications are paid', async () => {
    const t = await renderGroup(true, 'claude');
    expect(texts(t).join(' ')).toContain('paid Claude call');
  });

  it('sends a test and explains when the phone is not registered for push', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const t = await renderGroup();
    mutate.mockImplementation((_v, o) => o.onSuccess({ notification: { id: 'n', title: 'Hi', body: 'B', route: '/ai/c', pushed: true }, error: null }));
    await act(async () => { row(t, 'Send a test notification').props.onPress(); });
    expect(alert).toHaveBeenLastCalledWith('Test sent', expect.stringContaining('“Hi”'));
    mutate.mockImplementation((_v, o) => o.onSuccess({ notification: { id: 'n', title: 'Hi', body: 'B', route: '/ai/c', pushed: false }, error: 'no_token' }));
    await act(async () => { row(t, 'Send a test notification').props.onPress(); });
    expect(alert).toHaveBeenLastCalledWith('Not sent', expect.stringContaining('not registered for push'));
  });
});

describe('ForYouTodayCard with a Lumen AI note', () => {
  it('labels it as from Lumen AI and opens its chat', async () => {
    const candidate = candidateFromNote({
      id: 'n1', kind: 'briefing', title: 'Good morning', body: 'Keep today light.', route: '/ai/c1', conversationId: 'c1',
      pushed: true, reason: null, dateKey: '2026-11-17', createdAt: new Date().toISOString(),
    });
    useIntelligenceStore.setState({ inbox: [{ candidate, reason: 'watch', addedAt: Date.now() }] });
    let t!: ReactTestRenderer;
    await act(async () => { t = create(<ForYouTodayCard />); });
    expect(texts(t)).toEqual(expect.arrayContaining(['From Lumen AI', 'Good morning', 'Keep today light.', 'Ask Lumen about this']));
    const open = t.root.findAll(n => n.props.accessibilityLabel === 'Ask Lumen about this' && n.props.onPress)[0];
    await act(async () => { open.props.onPress(); });
    expect(router.push).toHaveBeenCalledWith('/ai/c1');
  });
});

describe('notification taps', () => {
  it('routes a tap only once, even if the launch tap is reported again', async () => {
    await AsyncStorage.clear();
    const response = { actionIdentifier: 'default', notification: { date: 1, request: { identifier: 'abc', content: { data: { route: '/ai/c1' } } } } };
    expect(await claimTap(response)).toBe(true);
    expect(await claimTap(response)).toBe(false);
    expect(await claimTap({ ...response, notification: { ...response.notification, request: { ...response.notification.request, identifier: 'def' } } })).toBe(true);
  });
});
