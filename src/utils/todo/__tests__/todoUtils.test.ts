import { ITask } from '../../../shared/types';
import { newObjectId, isObjectId } from '../objectId';
import {
  addDays,
  addMonths,
  diffDays,
  formatDue,
  formatReminder,
  reminderPresets,
  duePresets,
  toDateStr,
  shiftIsoByDays,
} from '../dates';
import { computeNextOccurrence, describeRepeat } from '../recurrence';
import {
  filterForView,
  countOpen,
  sortTasks,
  groupPlanned,
  searchTasks,
  nextSortOrder,
  applyListFilters,
} from '../views';

function task(over: Partial<ITask>): ITask {
  return {
    _id: over._id ?? 'a',
    userId: '',
    title: 'T',
    isCompleted: false,
    isImportant: false,
    inMyDay: false,
    steps: [],
    sortOrder: 0,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...over,
  };
}

describe('objectId', () => {
  it('makes unique 24-hex ids', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newObjectId()));
    expect(ids.size).toBe(500);
    ids.forEach((id) => expect(isObjectId(id)).toBe(true));
    expect(isObjectId('temp_123')).toBe(false);
  });
});

describe('dates', () => {
  it('adds days and months with clamping', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(diffDays('2026-11-12', '2026-11-19')).toBe(7);
  });

  it('formats due labels', () => {
    expect(formatDue('2026-11-12', '2026-11-12')).toEqual({ label: 'Today', overdue: false, today: true });
    expect(formatDue('2026-11-13', '2026-11-12').label).toBe('Tomorrow');
    expect(formatDue('2026-11-11', '2026-11-12')).toMatchObject({ label: 'Yesterday', overdue: true });
    expect(formatDue('2026-11-19', '2026-11-12').label).toBe('Thu, 19 Nov');
    expect(formatDue('2025-12-01', '2026-11-12')).toMatchObject({ overdue: true });
  });

  it('builds reminder presets', () => {
    const now = new Date(2026, 10, 12, 10, 20); // Thu 12 Nov 10:20
    const presets = reminderPresets(now);
    expect(presets.map((p) => p.key)).toEqual(['later', 'tomorrow', 'nextweek']);
    expect(new Date(presets[0].iso).getHours()).toBe(14); // 13:20 rounded up
    expect(toDateStr(new Date(presets[2].iso))).toBe('2026-11-16'); // next Monday
    expect(new Date(presets[1].iso).getHours()).toBe(9);
  });

  it('drops "later today" late in the evening', () => {
    const presets = reminderPresets(new Date(2026, 10, 12, 21, 30));
    expect(presets.map((p) => p.key)).toEqual(['tomorrow', 'nextweek']);
  });

  it('due presets and reminder text', () => {
    expect(duePresets('2026-11-12').map((p) => p.date)).toEqual(['2026-11-12', '2026-11-13', '2026-11-16']);
    const now = new Date(2026, 10, 12, 8, 0);
    expect(formatReminder(new Date(2026, 10, 12, 15, 0).toISOString(), now)).toBe('Today 3:00 PM');
    expect(formatReminder(new Date(2026, 10, 13, 9, 5).toISOString(), now)).toBe('Tomorrow 9:05 AM');
  });

  it('shifts an instant by whole days keeping the local time', () => {
    const iso = new Date(2026, 10, 12, 9, 0).toISOString();
    const shifted = new Date(shiftIsoByDays(iso, 3));
    expect(shifted.getDate()).toBe(15);
    expect(shifted.getHours()).toBe(9);
  });
});

describe('recurrence', () => {
  const today = '2026-11-12'; // Thursday
  it('daily and interval', () => {
    expect(computeNextOccurrence({ frequency: 'daily' }, '2026-11-12', undefined, today).dueDate).toBe('2026-11-13');
    expect(computeNextOccurrence({ frequency: 'daily', interval: 3 }, '2026-11-12', undefined, today).dueDate).toBe('2026-11-15');
  });

  it('weekdays skips the weekend', () => {
    expect(computeNextOccurrence({ frequency: 'weekdays' }, '2026-11-13', undefined, today).dueDate).toBe('2026-11-16'); // Fri -> Mon
  });

  it('weekly with chosen days', () => {
    const r = { frequency: 'weekly' as const, daysOfWeek: [1, 4] }; // Mon, Thu
    expect(computeNextOccurrence(r, '2026-11-12', undefined, today).dueDate).toBe('2026-11-16'); // Thu -> Mon
    expect(computeNextOccurrence(r, '2026-11-16', undefined, '2026-11-16').dueDate).toBe('2026-11-19'); // Mon -> Thu
    const every2 = { frequency: 'weekly' as const, interval: 2, daysOfWeek: [4] };
    expect(computeNextOccurrence(every2, '2026-11-12', undefined, today).dueDate).toBe('2026-11-26');
  });

  it('weekly without days adds 7 days', () => {
    expect(computeNextOccurrence({ frequency: 'weekly' }, '2026-11-12', undefined, today).dueDate).toBe('2026-11-19');
  });

  it('monthly clamps and yearly handles 29 Feb', () => {
    expect(computeNextOccurrence({ frequency: 'monthly' }, '2026-01-31', undefined, '2026-01-31').dueDate).toBe('2026-02-28');
    expect(computeNextOccurrence({ frequency: 'yearly' }, '2028-02-29', undefined, '2028-02-29').dueDate).toBe('2029-02-28');
  });

  it('a task finished late jumps to the next future occurrence', () => {
    expect(computeNextOccurrence({ frequency: 'daily' }, '2026-11-05', undefined, today).dueDate).toBe('2026-11-13');
    expect(computeNextOccurrence({ frequency: 'weekly' }, '2026-10-01', undefined, today).dueDate).toBe('2026-11-19');
    // finished on its due day: tomorrow, not today again
    expect(computeNextOccurrence({ frequency: 'daily' }, '2026-11-12', undefined, today).dueDate).toBe('2026-11-13');
  });

  it('no due date uses the reminder day, else today', () => {
    const reminder = new Date(2026, 10, 12, 9, 0).toISOString();
    expect(computeNextOccurrence({ frequency: 'daily' }, undefined, reminder, today).dueDate).toBe('2026-11-13');
    expect(computeNextOccurrence({ frequency: 'daily' }, undefined, undefined, today).dueDate).toBe('2026-11-13');
  });

  it('moves the reminder with the due date and keeps its time', () => {
    const reminder = new Date(2026, 10, 12, 9, 30).toISOString();
    const next = computeNextOccurrence({ frequency: 'daily' }, '2026-11-12', reminder, today);
    const r = new Date(next.reminderTime!);
    expect(toDateStr(r)).toBe('2026-11-13');
    expect(r.getHours()).toBe(9);
    expect(r.getMinutes()).toBe(30);
  });

  it('keeps a day-before reminder offset', () => {
    const reminder = new Date(2026, 10, 11, 18, 0).toISOString(); // day before due
    const next = computeNextOccurrence({ frequency: 'weekly' }, '2026-11-12', reminder, today);
    expect(next.dueDate).toBe('2026-11-19');
    expect(toDateStr(new Date(next.reminderTime!))).toBe('2026-11-18');
  });

  it('describes repeats', () => {
    expect(describeRepeat({ frequency: 'daily' })).toBe('Daily');
    expect(describeRepeat({ frequency: 'weekdays' })).toBe('Weekdays');
    expect(describeRepeat({ frequency: 'weekly', daysOfWeek: [4, 1] })).toBe('Every week on Mon, Thu');
    expect(describeRepeat({ frequency: 'monthly', interval: 2 })).toBe('Every 2 months');
    expect(describeRepeat({ frequency: 'yearly' })).toBe('Yearly');
  });
});

describe('views', () => {
  const ctx = { todayStr: '2026-11-12' };
  const list = [
    task({ _id: '1', title: 'Banana', inMyDay: true, dueDate: '2026-11-12', listId: 'L1' }),
    task({ _id: '2', title: 'apple', isImportant: true, listId: 'L1', sortOrder: 5 }),
    task({ _id: '3', title: 'Cherry', isCompleted: true, dueDate: '2026-11-01' }),
    task({ _id: '4', title: 'Date', dueDate: '2026-11-13', steps: [{ id: 's', title: 'buy figs', completed: false }] }),
  ];

  it('filters views and counts open tasks', () => {
    expect(filterForView(list, 'my-day', ctx).map((t) => t._id)).toEqual(['1']);
    expect(filterForView(list, 'important', ctx).map((t) => t._id)).toEqual(['2']);
    expect(filterForView(list, 'planned', ctx).map((t) => t._id)).toEqual(['1', '3', '4']);
    expect(filterForView(list, 'tasks', ctx).map((t) => t._id)).toEqual(['3', '4']);
    expect(filterForView(list, 'L1', ctx).map((t) => t._id)).toEqual(['1', '2']);
    expect(countOpen(list, 'planned', ctx)).toBe(2);
    expect(countOpen(list, 'completed', ctx)).toBe(1);
  });

  it('can add tasks due today to My Day', () => {
    const dueToday = [task({ _id: 'x', dueDate: '2026-11-12' }), task({ _id: 'y', dueDate: '2026-11-12', isCompleted: true })];
    expect(filterForView(dueToday, 'my-day', { ...ctx, dueTodayInMyDay: true }).map((t) => t._id)).toEqual(['x']);
    expect(filterForView(dueToday, 'my-day', ctx)).toEqual([]);
  });

  it('sorts alphabetically, by due date (none last), reversed, and starred to top', () => {
    expect(sortTasks(list, { field: 'alpha', dir: 'asc' }).map((t) => t._id)).toEqual(['2', '1', '3', '4']);
    expect(sortTasks(list, { field: 'dueDate', dir: 'asc' }).map((t) => t._id)).toEqual(['3', '1', '4', '2']);
    expect(sortTasks(list, { field: 'alpha', dir: 'desc' }).map((t) => t._id)).toEqual(['4', '3', '1', '2']);
    expect(sortTasks(list, { field: 'alpha', dir: 'asc' }, { starredToTop: true })[0]._id).toBe('2');
  });

  it('custom order uses sortOrder and falls back to newest first', () => {
    const a = task({ _id: 'a', sortOrder: 0, createdAt: '2026-11-01T00:00:00.000Z' });
    const b = task({ _id: 'b', sortOrder: 0, createdAt: '2026-11-02T00:00:00.000Z' });
    const c = task({ _id: 'c', sortOrder: -3 });
    expect(sortTasks([a, b, c], { field: 'custom', dir: 'asc' }).map((t) => t._id)).toEqual(['c', 'b', 'a']);
    expect(nextSortOrder([a, b, c], 'top')).toBe(-4);
    expect(nextSortOrder([a, b, c], 'bottom')).toBe(1);
    expect(nextSortOrder([], 'top')).toBe(0);
  });

  it('groups Planned into dated buckets', () => {
    const tasks = [
      task({ _id: 'o', dueDate: '2026-11-10' }),
      task({ _id: 't', dueDate: '2026-11-12' }),
      task({ _id: 'tm', dueDate: '2026-11-13' }),
      task({ _id: 'w', dueDate: '2026-11-15' }), // Sunday of this week
      task({ _id: 'n', dueDate: '2026-11-18' }),
      task({ _id: 'l', dueDate: '2026-12-25' }),
      task({ _id: 'none' }),
    ];
    const groups = groupPlanned(tasks, '2026-11-12');
    expect(groups.map((g) => [g.key, g.tasks.map((t) => t._id)])).toEqual([
      ['overdue', ['o']],
      ['today', ['t']],
      ['tomorrow', ['tm']],
      ['this-week', ['w']],
      ['next-week', ['n']],
      ['later', ['l']],
    ]);
  });

  it('searches titles, notes and step titles', () => {
    expect(searchTasks(list, 'figs').map((t) => t._id)).toEqual(['4']);
    expect(searchTasks(list, 'APPLE').map((t) => t._id)).toEqual(['2']);
    expect(searchTasks(list, '  ')).toEqual([]);
  });

  it('filters by energy and category', () => {
    const t = [
      task({ _id: '1', energyCost: 'gentle', categories: ['Doctor'] }),
      task({ _id: '2', energyCost: 'demanding' }),
    ];
    expect(applyListFilters(t, { energy: 'gentle' }).map((x) => x._id)).toEqual(['1']);
    expect(applyListFilters(t, { category: 'Doctor' }).map((x) => x._id)).toEqual(['1']);
    expect(applyListFilters(t, {})).toHaveLength(2);
  });
});
