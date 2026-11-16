import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../../api/client';
import { candidateFromNote, syncAiNotes, takeUnseen, type AiNoteDto } from '../aiNotes';
import { useIntelligenceStore } from '../../../store/intelligenceStore';
import { useNotificationInboxStore } from '../../../store/notificationInboxStore';

jest.mock('../../../api/client', () => ({ api: { get: jest.fn(), post: jest.fn(() => Promise.resolve()), put: jest.fn() } }));
jest.mock('../../notifications', () => ({
  scheduleIntelligentNotification: jest.fn(),
  CHANNEL_ID_SAFETY: 's', CHANNEL_ID_HEADS_UP: 'h', CHANNEL_ID_INSIGHTS: 'i', CHANNEL_ID_PACING: 'p', CHANNEL_ID_ALARM: 'a',
}));

const NOW = new Date('2026-11-16T09:00:00').getTime();
const note = (over: Partial<AiNoteDto> = {}): AiNoteDto => ({
  id: 'n1', kind: 'briefing', title: 'Good morning', body: 'Kal neend 5 ghante thi.', route: '/ai/c1', conversationId: 'c1',
  pushed: true, reason: null, dateKey: '2026-11-16', createdAt: new Date('2026-11-16T08:00:00').toISOString(), ...over,
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useIntelligenceStore.setState({ inbox: [], sentToday: { date: '2026-11-16', count: 0 } });
  useNotificationInboxStore.setState({ entries: [] } as never);
});

describe('candidateFromNote', () => {
  it('becomes an AI_NOTE shown at once, for a day, with its chat route', () => {
    const c = candidateFromNote(note());
    expect(c).toMatchObject({ id: 'ai:n1', type: 'AI_NOTE', title: 'Good morning', inAppNow: true, data: { route: '/ai/c1', kind: 'briefing' } });
    expect(c.expiresAt).toBe(new Date('2026-11-16T08:00:00').getTime() + 24 * 3600_000);
    expect(c.provenance?.[0]).toMatch(/Lumen AI/);
  });

  it('ranks a reply to a serious log above a nudge', () => {
    expect(candidateFromNote(note({ kind: 'log_reply' })).timeliness).toBeGreaterThan(candidateFromNote(note({ kind: 'nudge' })).timeliness);
  });
});

describe('takeUnseen', () => {
  it('returns each note only once, oldest first', async () => {
    const a = note({ id: 'a', createdAt: '2026-11-16T08:00:00Z' });
    const b = note({ id: 'b', createdAt: '2026-11-16T07:00:00Z' });
    expect((await takeUnseen([a, b])).map(n => n.id)).toEqual(['b', 'a']);
    expect(await takeUnseen([a, b, note({ id: 'c' })])).toEqual([expect.objectContaining({ id: 'c' })]);
  });
});

describe('syncAiNotes', () => {
  it('adds only new notes, and stays quiet when Lumen AI is off', async () => {
    (api.get as jest.Mock).mockResolvedValue([note()]);
    const add = jest.fn();
    await syncAiNotes(add);
    expect((api.get as jest.Mock).mock.calls[0][0]).toMatch(/^\/ai\/notifications\?since=/);
    expect(add).toHaveBeenCalledWith([expect.objectContaining({ id: 'n1' })]);
    await syncAiNotes(add);
    expect(add).toHaveBeenCalledTimes(1);

    (api.get as jest.Mock).mockRejectedValue(Object.assign(new Error('off'), { statusCode: 403 }));
    await expect(syncAiNotes(add)).resolves.toBeUndefined();
  });
});

describe('intelligence store addAiNotes', () => {
  it('shows the notes in "For you today" and the inbox, and counts today\'s pushes against the budget', () => {
    useIntelligenceStore.getState().addAiNotes([
      note(),
      note({ id: 'n2', kind: 'nudge', pushed: false, reason: 'budget' }),
      note({ id: 'n3', kind: 'log_reply', route: '/ai/c3' }),
    ], NOW);
    const s = useIntelligenceStore.getState();
    expect(s.inbox.map(i => i.candidate.id).sort()).toEqual(['ai:n1', 'ai:n2', 'ai:n3']);
    // Only the pushed briefing counts: the held-back nudge didn't arrive, a log reply is outside the budget.
    expect(s.sentToday).toEqual({ date: '2026-11-16', count: 1 });
    const entries = useNotificationInboxStore.getState().entries;
    expect(entries.find(e => e.id === 'intel:ai:n3')).toMatchObject({ kind: 'Insights', icon: 'sparkles', route: '/ai/c3' });
  });

  it('does not add the same note twice', () => {
    useIntelligenceStore.getState().addAiNotes([note()], NOW);
    useIntelligenceStore.getState().addAiNotes([note()], NOW);
    expect(useIntelligenceStore.getState().inbox).toHaveLength(1);
  });
});
