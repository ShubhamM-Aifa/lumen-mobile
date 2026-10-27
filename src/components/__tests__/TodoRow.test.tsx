import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { TaskItem } from '../todo/TaskItem';
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
  steps: [{ completed: true }, { completed: false }],
} as never;

describe('TaskItem row', () => {
  it('shows steps, My Day, overdue state and energy cost in one row', async () => {
    const tree = await render(
      <TaskItem task={baseTask} todayStr="2026-10-27" onPress={jest.fn()} onToggleComplete={jest.fn()} onToggleImportant={jest.fn()} />,
    );
    const t = texts(tree);
    expect(t).toContain('Stretch for ten minutes');
    expect(t).toContain('1/2');
    expect(t).toContain('My Day');
    expect(t).toContain('Overdue');
    expect(t.some(x => x.includes('Gentle'))).toBe(true);
  });

  it('completes and stars without opening the task', async () => {
    const onPress = jest.fn();
    const onToggleComplete = jest.fn();
    const onToggleImportant = jest.fn();
    const tree = await render(
      <TaskItem task={baseTask} onPress={onPress} onToggleComplete={onToggleComplete} onToggleImportant={onToggleImportant} />,
    );
    await act(async () => { byLabel(tree, 'Complete Stretch for ten minutes').props.onPress(); });
    await act(async () => { byLabel(tree, 'Mark important').props.onPress(); });
    expect(onToggleComplete).toHaveBeenCalledTimes(1);
    expect(onToggleImportant).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes completion as a checked checkbox', async () => {
    const done = { ...(baseTask as object), isCompleted: true } as never;
    const tree = await render(
      <TaskItem task={done} onPress={jest.fn()} onToggleComplete={jest.fn()} onToggleImportant={jest.fn()} />,
    );
    expect(byLabel(tree, 'Complete Stretch for ten minutes').props.accessibilityState).toEqual({ checked: true });
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
