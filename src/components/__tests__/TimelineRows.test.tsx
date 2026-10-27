import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { TimelineItem } from '../timeline/TimelineItem';
import { CalendarHeatMap, DaySeverity } from '../timeline/CalendarHeatMap';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Warning: 'warning', Success: 'success' },
}));
jest.mock('../timeline/BodyMapPreview', () => ({ BodyMapPreview: () => null }));
jest.mock('../timeline/LogPhotoGallery', () => ({ LogPhotoGallery: () => null }));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);
const press = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const pressLabelStartingWith = (tree: ReactTestRenderer, prefix: string) =>
  tree.root.findAll(
    n => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith(prefix) && typeof n.props.onPress === 'function',
  )[0];

async function render(el: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(el); });
  return tree;
}

const category = { _id: 'c1', name: 'Symptoms', icon: '🩺', color: '#FF3B30', role: 'symptom', order: 0, isActive: true } as never;
const logEntry = {
  _id: 'e1',
  source: 'questionnaire',
  categoryId: 'c1',
  occurredAt: new Date(2026, 9, 27, 14, 5).toISOString(),
  note: 'Worse after the walk',
  answers: [
    {
      optionId: 'o1',
      optionLabelSnapshot: 'Joint pain',
      values: [{ fieldKey: 'severity', dataType: 'range', value: 7 }],
    },
  ],
} as never;

describe('TimelineItem row', () => {
  it('shows title, answer summary and time in one collapsed row', async () => {
    const tree = await render(<TimelineItem entry={logEntry} category={category} options={[]} onEdit={jest.fn()} onDelete={jest.fn()} />);
    const t = texts(tree);
    expect(t).toContain('Symptoms');
    expect(t).toContain('2:05 PM');
    expect(t).toContain('Joint pain');
    expect(t.some(x => x.includes('7/10 Severe'))).toBe(true);
    // actions and note stay hidden until the row is opened
    expect(press(tree, 'Edit log entry')).toBeUndefined();
    expect(t).not.toContain('Worse after the walk');
  });

  it('opens on tap to reveal the note and Edit / Delete, and edits with the entry id', async () => {
    const onEdit = jest.fn();
    const tree = await render(<TimelineItem entry={logEntry} category={category} options={[]} onEdit={onEdit} onDelete={jest.fn()} />);
    await act(async () => { pressLabelStartingWith(tree, 'Symptoms,').props.onPress(); });
    expect(texts(tree)).toContain('Worse after the walk');
    expect(press(tree, 'Delete log entry')).toBeDefined();
    await act(async () => { press(tree, 'Edit log entry').props.onPress(); });
    expect(onEdit).toHaveBeenCalledWith('e1');
  });

  it('describes a quick tap with its value', async () => {
    const quick = { _id: 'e2', source: 'quick_action', quickActionId: 'q1', occurredAt: new Date(2026, 9, 27, 9, 0).toISOString(), answers: [] } as never;
    const qa = { _id: 'q1', label: 'Water', icon: '💧', color: '#007AFF', defaultValue: 250, unit: 'ml' } as never;
    const tree = await render(<TimelineItem entry={quick} options={[]} quickAction={qa} />);
    const t = texts(tree);
    expect(t).toContain('Water');
    expect(t.some(x => x.includes('+250 ml'))).toBe(true);
    expect(t).toContain('9:00 AM');
  });
});

describe('CalendarHeatMap', () => {
  const data: DaySeverity[] = [
    { date: '2026-10-26', maxSeverity: 8, hasLogs: true, progress: 1, percentage: 100, isComplete: true },
    { date: '2026-10-27', maxSeverity: 2, hasLogs: true, progress: 0.4, percentage: 40, isComplete: false },
  ];
  const base = {
    year: 2026,
    month: 9,
    data,
    selectedDate: '2026-10-27',
    onSelectDate: jest.fn(),
    onPrevMonth: jest.fn(),
    onNextMonth: jest.fn(),
    onToggleViewMode: jest.fn(),
    onPrevWeek: jest.fn(),
    onNextWeek: jest.fn(),
    todayDate: '2026-10-27',
  };

  beforeEach(() => jest.clearAllMocks());

  it('week view shows each day with its percentage and flags severe days for screen readers', async () => {
    const tree = await render(<CalendarHeatMap {...base} viewMode="week" />);
    const t = texts(tree);
    expect(t).toContain('100%');
    expect(t).toContain('40%');
    expect(press(tree, 'Monday 26, 100 percent logged, severe symptoms')).toBeDefined();
    expect(press(tree, 'Tuesday 27, 40 percent logged, selected')).toBeDefined();
  });

  it('selects a day and pages by week or month depending on the mode', async () => {
    const tree = await render(<CalendarHeatMap {...base} viewMode="week" />);
    await act(async () => { press(tree, 'Monday 26, 100 percent logged, severe symptoms').props.onPress(); });
    expect(base.onSelectDate).toHaveBeenCalledWith('2026-10-26');
    await act(async () => { press(tree, 'Previous week').props.onPress(); });
    expect(base.onPrevWeek).toHaveBeenCalled();

    const month = await render(<CalendarHeatMap {...base} viewMode="month" />);
    await act(async () => { press(month, 'Next month').props.onPress(); });
    expect(base.onNextMonth).toHaveBeenCalled();
    expect(texts(month)).toContain('1 complete · 2 logged');
    expect(texts(month)).toContain('Severe symptoms');
  });

  it('switches between Week and Month with the segmented control', async () => {
    const tree = await render(<CalendarHeatMap {...base} viewMode="week" />);
    await act(async () => { press(tree, 'Month').props.onPress(); });
    expect(base.onToggleViewMode).toHaveBeenCalledWith('month');
  });
});
