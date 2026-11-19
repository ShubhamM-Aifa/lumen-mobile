/** Today's medicines: one row per planned dose; Taken / Skipped mark it; tapping again clears it. */
import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn().mockResolvedValue(undefined), ImpactFeedbackStyle: { Light: 'light' } }));
const mockMark = jest.fn();
const mockClear = jest.fn();
let mockData: unknown;
jest.mock('../../../hooks/useDoses', () => ({
  useDoses: () => ({ data: mockData }),
  useMarkDose: () => ({ mutate: mockMark }),
  useClearDose: () => ({ mutate: mockClear }),
  slotLabel: (s: string) => s,
}));

import { TodayMedsCard } from '../TodayMedsCard';

const day = (slots: Array<{ slot: string; state: string; doseId?: string | null }>) => ({
  day: '2026-11-19', today: '2026-11-19',
  items: [{ medicationId: 'm1', name: 'HCQ', dose: '200', unit: 'mg', prn: false, slots: slots.map(s => ({ amount: null, doseId: null, ...s })), extras: [] }],
});

async function render(): Promise<ReactTestRenderer> {
  let t!: ReactTestRenderer;
  await act(async () => { t = create(<TodayMedsCard />); });
  return t;
}
const btn = (t: ReactTestRenderer, startsWith: string) => t.root.find(n => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith(startsWith) && typeof n.props.onPress === 'function');

describe('TodayMedsCard', () => {
  beforeEach(() => { mockMark.mockClear(); mockClear.mockClear(); });

  it('hides itself when nothing is planned today', async () => {
    mockData = { day: '2026-11-19', today: '2026-11-19', items: [] };
    expect((await render()).toJSON()).toBeNull();
  });

  it('marks a dose taken or skipped', async () => {
    mockData = day([{ slot: '08:00', state: 'unmarked' }, { slot: '20:00', state: 'upcoming' }]);
    const t = await render();
    await act(async () => { btn(t, 'HCQ · 200 mg at 08:00: Skipped').props.onPress(); });
    expect(mockMark).toHaveBeenCalledWith({ medicationId: 'm1', dayKey: '2026-11-19', slot: '08:00', status: 'skipped', source: 'checklist' }, expect.anything());
  });

  it('clears a mark when the chosen state is tapped again', async () => {
    mockData = day([{ slot: '08:00', state: 'taken', doseId: 'd1' }]);
    const t = await render();
    await act(async () => { btn(t, 'HCQ · 200 mg at 08:00: Taken, selected').props.onPress(); });
    expect(mockClear).toHaveBeenCalledWith({ medicationId: 'm1', doseId: 'd1' });
    expect(mockMark).not.toHaveBeenCalled();
  });
});
