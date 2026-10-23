import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIntelligenceStore, DEFAULT_POLICY } from '../intelligenceStore';
import { Candidate } from '../../services/intelligence/budgetEngine';
import { api } from '../../api/client';
import { scheduleIntelligentNotification } from '../../services/notifications';

jest.mock('../../api/client', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
jest.mock('../../services/notifications', () => ({
  scheduleIntelligentNotification: jest.fn(),
  CHANNEL_ID_SAFETY: 'lumen_safety_v1',
  CHANNEL_ID_HEADS_UP: 'lumen_heads_up_v1',
  CHANNEL_ID_INSIGHTS: 'lumen_insights_v1',
  CHANNEL_ID_PACING: 'lumen_pacing_v2',
  CHANNEL_ID_ALARM: 'lumen_alarm_clock_v4',
}));

const NOON = new Date(2026, 9, 23, 14, 0, 0).getTime();

function cand(id: string, type: Candidate['type']): Candidate {
  return { id, type, title: id, body: id, confidence: 1, timeliness: 1 };
}

describe('intelligenceStore', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    (api.post as jest.Mock).mockResolvedValue({});
    (scheduleIntelligentNotification as jest.Mock).mockResolvedValue('notif-id');
    useIntelligenceStore.setState({
      policy: DEFAULT_POLICY,
      loaded: false,
      saving: false,
      error: null,
      sentToday: { date: '2026-10-23', count: 0 },
      inbox: [],
    });
  });

  it('delivers up to the daily budget, records the ledger, and queues the rest in-app', async () => {
    await useIntelligenceStore.getState().submit(
      [cand('a', 'PACING'), cand('b', 'FLARE_RISK'), cand('c', 'TRIGGER_WATCH')],
      NOON,
    );
    const s = useIntelligenceStore.getState();
    expect(scheduleIntelligentNotification).toHaveBeenCalledTimes(2);
    expect(s.sentToday.count).toBe(2);
    expect(s.inbox.map(i => i.candidate.id)).toEqual(['c']);
    expect(s.inbox[0].reason).toBe('budget');
  });

  it('sends nothing more once the budget is spent', async () => {
    useIntelligenceStore.setState({ sentToday: { date: '2026-10-23', count: 2 } });
    await useIntelligenceStore.getState().submit([cand('a', 'PACING')], NOON);
    expect(scheduleIntelligentNotification).not.toHaveBeenCalled();
    expect(useIntelligenceStore.getState().inbox).toHaveLength(1);
  });

  it('resets the ledger on a new day', async () => {
    useIntelligenceStore.setState({ sentToday: { date: '2026-10-22', count: 2 } });
    await useIntelligenceStore.getState().submit([cand('a', 'PACING')], NOON);
    expect(scheduleIntelligentNotification).toHaveBeenCalledTimes(1);
    expect(useIntelligenceStore.getState().sentToday).toEqual({ date: '2026-10-23', count: 1 });
  });

  it('does not spend budget when scheduling fails', async () => {
    (scheduleIntelligentNotification as jest.Mock).mockResolvedValue(null);
    await useIntelligenceStore.getState().submit([cand('a', 'PACING')], NOON);
    expect(useIntelligenceStore.getState().sentToday.count).toBe(0);
  });

  it('sends nothing during flare mode, and does not queue it in-app', async () => {
    useIntelligenceStore.setState({
      policy: { ...DEFAULT_POLICY, flareMode: { active: true, auto: true, source: 'manual' } },
    });
    await useIntelligenceStore.getState().submit([cand('a', 'PACING'), cand('b', 'FLARE_RISK')], NOON);
    expect(scheduleIntelligentNotification).not.toHaveBeenCalled();
    expect(useIntelligenceStore.getState().inbox).toHaveLength(0);
  });

  it('delivers safety without spending budget', async () => {
    useIntelligenceStore.setState({
      policy: { ...DEFAULT_POLICY, capabilities: { ...DEFAULT_POLICY.capabilities, safety: true } },
    });
    await useIntelligenceStore.getState().submit([cand('s', 'SAFETY')], NOON);
    expect(scheduleIntelligentNotification).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: 'lumen_safety_v1' }),
    );
    expect(useIntelligenceStore.getState().sentToday.count).toBe(0);
  });

  it('does not queue the same candidate twice', async () => {
    useIntelligenceStore.setState({ sentToday: { date: '2026-10-23', count: 2 } });
    await useIntelligenceStore.getState().submit([cand('a', 'PACING')], NOON);
    await useIntelligenceStore.getState().submit([cand('a', 'PACING')], NOON);
    expect(useIntelligenceStore.getState().inbox).toHaveLength(1);
  });

  it('rolls back an optimistic policy change when saving fails', async () => {
    (api.put as jest.Mock).mockRejectedValue(new Error('offline'));
    await useIntelligenceStore.getState().updatePolicy({ dailyBudget: 5 });
    const s = useIntelligenceStore.getState();
    expect(s.policy.dailyBudget).toBe(2);
    expect(s.error).toBe('offline');
  });

  it('applies the server response after a successful save', async () => {
    (api.put as jest.Mock).mockResolvedValue({ ...DEFAULT_POLICY, dailyBudget: 3 });
    await useIntelligenceStore.getState().updatePolicy({ dailyBudget: 3 });
    expect(useIntelligenceStore.getState().policy.dailyBudget).toBe(3);
  });

  it('reports not_useful feedback and removes the item', async () => {
    useIntelligenceStore.setState({
      inbox: [{ candidate: cand('a', 'PACING'), reason: 'budget', addedAt: NOON }],
    });
    await useIntelligenceStore.getState().dismissInboxItem('a', 'not_useful');
    expect(useIntelligenceStore.getState().inbox).toHaveLength(0);
    expect(api.post).toHaveBeenCalledWith(
      '/notification-policy/events',
      expect.objectContaining({ notificationType: 'PACING', feedback: 'not_useful' }),
    );
  });
});
