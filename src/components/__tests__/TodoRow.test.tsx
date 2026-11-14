import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { TaskRow } from '../todo/TaskRow';
import { FilterChip } from '../ios/FilterChip';
import { LargeTitleHeader } from '../ios/LargeTitleHeader';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

async function render(el: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(el); });
  return tree;
}

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);
const byLabel = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function').pop()!;

const baseTask = {
  _id: 't1',
  title: 'Stretch for ten minutes',
  isCompleted: false,
  isImportant: false,
  inMyDay: true,
  dueDate: '2026-10-20',
  energyCost: 'gentle',
  categories: ['Physio'],
  repeat: { frequency: 'daily' },
  reminderTime: '2026-10-28T09:00:00.000Z',
  notes: 'slow and gentle',
  steps: [{ completed: true }, { completed: false }],
} as never;

const noop = jest.fn();

describe('TaskRow', () => {
  it('shows list, steps, My Day, overdue state, category and energy in one row', async () => {
    const tree = await render(
      <TaskRow task={baseTask} todayStr="2026-10-27" listName="Physio list" onPress={noop} onToggleComplete={noop} onToggleImportant={noop} />,
    );
    const t = texts(tree);
    expect(t).toContain('Stretch for ten minutes');
    expect(t).toContain('Physio list');
    expect(t).toContain('1 of 2');
    expect(t).toContain('My Day');
    expect(t.some((x) => x.includes('Overdue'))).toBe(true);
    expect(t).toContain('Physio');
    expect(t).toContain('Gentle');
  });

  it('labels today and tomorrow in words', async () => {
    const today = { ...(baseTask as object), dueDate: '2026-10-27' } as never;
    expect(texts(await render(<TaskRow task={today} todayStr="2026-10-27" onPress={noop} onToggleComplete={noop} onToggleImportant={noop} />))).toContain('Due today');
    const tomorrow = { ...(baseTask as object), dueDate: '2026-10-28' } as never;
    expect(texts(await render(<TaskRow task={tomorrow} todayStr="2026-10-27" onPress={noop} onToggleComplete={noop} onToggleImportant={noop} />))).toContain('Tomorrow');
  });

  it('completes and stars without opening the task', async () => {
    const onPress = jest.fn();
    const onToggleComplete = jest.fn();
    const onToggleImportant = jest.fn();
    const tree = await render(
      <TaskRow task={baseTask} onPress={onPress} onToggleComplete={onToggleComplete} onToggleImportant={onToggleImportant} />,
    );
    await act(async () => { byLabel(tree, 'Complete Stretch for ten minutes').props.onPress(); });
    await act(async () => { byLabel(tree, 'Mark important').props.onPress(); });
    expect(onToggleComplete).toHaveBeenCalledTimes(1);
    expect(onToggleImportant).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes completion as a checked checkbox', async () => {
    const done = { ...(baseTask as object), isCompleted: true } as never;
    const tree = await render(<TaskRow task={done} onPress={noop} onToggleComplete={noop} onToggleImportant={noop} />);
    expect(byLabel(tree, 'Complete Stretch for ten minutes').props.accessibilityState).toEqual({ checked: true });
  });

  it('in selection mode the circle selects instead of completing, and the star is hidden', async () => {
    const tree = await render(
      <TaskRow task={baseTask} selectionMode selected onPress={noop} onToggleComplete={noop} onToggleImportant={noop} />,
    );
    const box = tree.root.findAll((n) => n.props.accessibilityLabel === 'Select Stretch for ten minutes').pop()!;
    expect(box.props.accessibilityState).toEqual({ checked: true });
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Mark important')).toHaveLength(0);
  });
});

describe('FilterChip with icon', () => {
  it('renders the icon before the label and reports selection', async () => {
    const onPress = jest.fn();
    const tree = await render(<FilterChip label="My Day" selected icon={<Text>☀</Text>} onPress={onPress} />);
    const chip = byLabel(tree, 'My Day');
    expect(chip.props.accessibilityState).toEqual({ selected: true });
    expect(texts(tree)).toEqual(expect.arrayContaining(['☀', 'My Day']));
    await act(async () => { chip.props.onPress(); });
    expect(onPress).toHaveBeenCalled();
  });
});

describe('LargeTitleHeader leading slot', () => {
  it('shows the leading control, the actions and the title together', async () => {
    const tree = await render(
      <LargeTitleHeader title="Reminders" subtitle="2 on · 1 off" leading={<Text>BACK</Text>} actions={<Text>ADD</Text>} />,
    );
    const t = texts(tree);
    expect(t).toEqual(expect.arrayContaining(['BACK', 'ADD', 'Reminders', '2 on · 1 off']));
  });
});
