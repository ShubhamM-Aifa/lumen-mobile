import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { FlareModeToday, pickEssentialActions, essentialReminders } from '../home/FlareModeToday';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);
const byLabel = (t: ReactTestRenderer, label: string) =>
  t.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function').pop()!;

const actions = [
  { _id: 'a1', label: 'Coffee', templateKey: 'qa_coffee' },
  { _id: 'a2', label: 'Medication taken', templateKey: 'qa_meds' },
  { _id: 'a3', label: 'Water', templateKey: 'qa_water' },
  { _id: 'a4', label: 'Nap', templateKey: 'qa_nap' },
] as never[];

const reminders = [
  { _id: 'r1', name: 'Evening medication', category: 'MEDICATION', enabled: true, scheduleType: 'DAILY', targetTime: '21:00' },
  { _id: 'r2', name: 'Drink water', category: 'HYDRATION', enabled: true, scheduleType: 'INTERVAL', intervalMinutes: 120 },
  { _id: 'r3', name: 'Stretch', category: 'MOVEMENT', enabled: true, scheduleType: 'DAILY', targetTime: '10:00' },
  { _id: 'r4', name: 'Old med', category: 'MEDICATION', enabled: true, archivedAt: '2026-01-01', scheduleType: 'DAILY', targetTime: '08:00' },
  { _id: 'r5', name: 'Off hydration', category: 'HYDRATION', enabled: false, scheduleType: 'DAILY', targetTime: '08:00' },
] as never[];

describe('flare mode helpers', () => {
  it('picks medication, water and rest first and ignores unrelated actions', () => {
    expect(pickEssentialActions(actions).map(a => a._id)).toEqual(['a2', 'a3', 'a4']);
  });

  it('returns only what exists', () => {
    expect(pickEssentialActions([actions[0]])).toEqual([]);
  });

  it('keeps only enabled, unarchived medication and hydration reminders', () => {
    expect(essentialReminders(reminders).map(r => r._id)).toEqual(['r1', 'r2']);
  });
});

describe('FlareModeToday', () => {
  async function render(over: Partial<React.ComponentProps<typeof FlareModeToday>> = {}) {
    const props = {
      essentialActions: pickEssentialActions(actions),
      renderTile: (a: { _id: string; label: string }) => <Text key={a._id}>{`tile:${a.label}`}</Text>,
      onLogSymptom: jest.fn(),
      reminders,
      onTurnOff: jest.fn(),
      tileWidth: 160,
      ...over,
    };
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<FlareModeToday {...(props as never)} />); });
    return { tree, props };
  }

  it('shows the calm heading, the essential tiles and only the reminders that still ring', async () => {
    const { tree } = await render();
    const t = texts(tree);
    expect(t).toContain('Take it easy today');
    expect(t).toContain('tile:Medication taken');
    expect(t).toContain('tile:Water');
    expect(t).toContain('tile:Nap');
    expect(t).toContain('Evening medication');
    expect(t).toContain('Drink water');
    expect(t).toContain('Every 2 h');
    expect(t).toContain('21:00');
    expect(t).not.toContain('Stretch');
    expect(t).not.toContain('Old med');
  });

  it('logs a symptom from both the tile and the button, and turns flare mode off', async () => {
    const { tree, props } = await render();
    await act(async () => { byLabel(tree, 'Log a symptom').props.onPress(); });
    await act(async () => { byLabel(tree, 'Flare now, log how you feel').props.onPress(); });
    expect(props.onLogSymptom).toHaveBeenCalledTimes(2);
    await act(async () => { byLabel(tree, 'Turn off flare mode').props.onPress(); });
    expect(props.onTurnOff).toHaveBeenCalledTimes(1);
  });

  it('still explains the pause when no essential reminders exist', async () => {
    const { tree } = await render({ reminders: [] as never });
    expect(texts(tree).some(x => x.startsWith('Other reminders, pacing nudges'))).toBe(true);
  });
});
