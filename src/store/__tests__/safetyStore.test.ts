import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafetyStore, SAFETY_SEEN_KEY } from '../safetyStore';
import { api, SafetyFlag } from '../../api/client';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;
const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300, status, headers: { get: () => 'application/json' },
  text: () => Promise.resolve(JSON.stringify(body)),
}) as unknown as Response;

const flag = (id: string, level: SafetyFlag['level'] = 'today'): SafetyFlag => ({ id, level, title: `Title ${id}`, message: `Message ${id}` });
const DAY1 = new Date(2026, 9, 27, 9, 0);
const DAY2 = new Date(2026, 9, 28, 9, 0);

describe('safetyStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useSafetyStore.setState({ flags: [] });
  });

  it('queues a notice and clears it when read', async () => {
    await useSafetyStore.getState().show([flag('fever')], DAY1);
    expect(useSafetyStore.getState().flags.map(f => f.id)).toEqual(['fever']);
    useSafetyStore.getState().dismiss();
    expect(useSafetyStore.getState().flags).toEqual([]);
  });

  it('shows an everyday notice once per day, not on every log', async () => {
    await useSafetyStore.getState().show([flag('bleeding')], DAY1);
    useSafetyStore.getState().dismiss();
    await useSafetyStore.getState().show([flag('bleeding')], DAY1);
    expect(useSafetyStore.getState().flags).toEqual([]);
    // a new day starts fresh
    await useSafetyStore.getState().show([flag('bleeding')], DAY2);
    expect(useSafetyStore.getState().flags).toHaveLength(1);
  });

  it('always shows an urgent notice, however often it comes up', async () => {
    await useSafetyStore.getState().show([flag('chest_breathless', 'now')], DAY1);
    useSafetyStore.getState().dismiss();
    await useSafetyStore.getState().show([flag('chest_breathless', 'now')], DAY1);
    expect(useSafetyStore.getState().flags).toHaveLength(1);
  });

  it('puts urgent notices first and does not queue the same one twice', async () => {
    await useSafetyStore.getState().show([flag('fever'), flag('vision_loss', 'now')], DAY1);
    await useSafetyStore.getState().show([flag('fever')], DAY1);
    expect(useSafetyStore.getState().flags.map(f => f.id)).toEqual(['vision_loss', 'fever']);
  });

  it('remembers which everyday notices were shown, only for today', async () => {
    await useSafetyStore.getState().show([flag('fever'), flag('vision_loss', 'now')], DAY1);
    const saved = JSON.parse((await AsyncStorage.getItem(SAFETY_SEEN_KEY)) as string);
    expect(saved).toEqual({ day: '2026-10-27', ids: ['fever'] });
  });

  it('is wired to the API client: a notice in any save response reaches the store', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, data: { _id: 'x' }, safety: { flags: [flag('fever')] } }));
    const saved = await api.post<{ _id: string }>('/logs', {});
    expect(saved).toEqual({ _id: 'x' });
    await new Promise(r => setTimeout(r, 0));
    expect(useSafetyStore.getState().flags.map(f => f.id)).toEqual(['fever']);
  });

  it('leaves normal responses alone', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, data: { _id: 'y' } }));
    await api.post('/logs', {});
    await new Promise(r => setTimeout(r, 0));
    expect(useSafetyStore.getState().flags).toEqual([]);
  });
});
