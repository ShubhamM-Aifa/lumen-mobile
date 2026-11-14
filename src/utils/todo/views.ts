import { ITask, TaskEnergyCost } from '../../shared/types';
import { addDays, dayOfWeek, diffDays } from './dates';

export const SMART_VIEW_IDS = ['my-day', 'important', 'planned', 'all', 'completed', 'tasks'] as const;
export type SmartViewId = (typeof SMART_VIEW_IDS)[number];

export function isSmartView(id: string): id is SmartViewId {
  return (SMART_VIEW_IDS as readonly string[]).includes(id);
}

export type SortField = 'custom' | 'importance' | 'dueDate' | 'myDay' | 'alpha' | 'created';
export type SortDir = 'asc' | 'desc';

export interface SortSpec {
  field: SortField;
  dir: SortDir;
}

export interface ViewContext {
  todayStr: string;
  /** Show tasks due today in My Day even if they were never added (a To Do setting). */
  dueTodayInMyDay?: boolean;
}

/** Tasks that belong in a view, completed ones included (the screen splits them out). */
export function filterForView(tasks: ITask[], viewId: string, ctx: ViewContext): ITask[] {
  switch (viewId) {
    case 'my-day':
      return tasks.filter((t) => t.inMyDay || (!!ctx.dueTodayInMyDay && !t.isCompleted && t.dueDate === ctx.todayStr));
    case 'important':
      return tasks.filter((t) => t.isImportant);
    case 'planned':
      return tasks.filter((t) => !!t.dueDate);
    case 'completed':
      return tasks.filter((t) => t.isCompleted);
    case 'all':
      return tasks;
    case 'tasks':
      return tasks.filter((t) => !t.listId);
    default:
      return tasks.filter((t) => t.listId === viewId);
  }
}

export function countOpen(tasks: ITask[], viewId: string, ctx: ViewContext): number {
  const inView = filterForView(tasks, viewId, ctx);
  return viewId === 'completed' ? inView.length : inView.filter((t) => !t.isCompleted).length;
}

export interface ListFilters {
  energy?: TaskEnergyCost | null;
  category?: string | null;
}

export function applyListFilters(tasks: ITask[], filters: ListFilters): ITask[] {
  return tasks.filter((t) => {
    if (filters.energy && t.energyCost !== filters.energy) return false;
    if (filters.category && !(t.categories ?? []).includes(filters.category)) return false;
    return true;
  });
}

const byCreatedDesc = (a: ITask, b: ITask) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);

function compareBy(field: SortField, a: ITask, b: ITask): number {
  switch (field) {
    case 'importance':
      return Number(b.isImportant) - Number(a.isImportant);
    case 'dueDate': {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    }
    case 'myDay':
      return Number(b.inMyDay) - Number(a.inMyDay);
    case 'alpha':
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    case 'created':
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    case 'custom':
    default:
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  }
}

/**
 * Sorts a copy. "custom" is the drag order (lowest sortOrder first). Ties fall back to newest first,
 * which also keeps old tasks (all sortOrder 0) in a sensible order.
 */
export function sortTasks(tasks: ITask[], spec: SortSpec, opts: { starredToTop?: boolean } = {}): ITask[] {
  const sign = spec.dir === 'desc' ? -1 : 1;
  return [...tasks].sort((a, b) => {
    if (opts.starredToTop && a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
    const primary = compareBy(spec.field, a, b) * sign;
    return primary !== 0 ? primary : byCreatedDesc(a, b);
  });
}

/** sortOrder for a task added to the top or the bottom of the custom order. */
export function nextSortOrder(tasks: ITask[], position: 'top' | 'bottom'): number {
  if (tasks.length === 0) return 0;
  const orders = tasks.map((t) => t.sortOrder ?? 0);
  return position === 'top' ? Math.min(...orders) - 1 : Math.max(...orders) + 1;
}

export interface PlannedGroup {
  key: 'overdue' | 'today' | 'tomorrow' | 'this-week' | 'next-week' | 'later';
  title: string;
  tasks: ITask[];
}

/** Planned view groups: Overdue, Today, Tomorrow, This week, Next week, Later. Empty groups are dropped. */
export function groupPlanned(tasks: ITask[], todayStr: string): PlannedGroup[] {
  // Weeks run Monday to Sunday: "this week" ends on the coming Sunday.
  const dow = dayOfWeek(todayStr);
  const daysToSunday = (7 - dow) % 7;
  const thisWeekEnd = addDays(todayStr, daysToSunday);
  const nextWeekEnd = addDays(thisWeekEnd, 7);

  const groups: PlannedGroup[] = [
    { key: 'overdue', title: 'Earlier', tasks: [] },
    { key: 'today', title: 'Today', tasks: [] },
    { key: 'tomorrow', title: 'Tomorrow', tasks: [] },
    { key: 'this-week', title: 'Later this week', tasks: [] },
    { key: 'next-week', title: 'Next week', tasks: [] },
    { key: 'later', title: 'Later', tasks: [] },
  ];
  const by = (k: PlannedGroup['key']) => groups.find((g) => g.key === k)!;

  for (const t of tasks) {
    if (!t.dueDate) continue;
    const diff = diffDays(todayStr, t.dueDate);
    if (diff < 0) by('overdue').tasks.push(t);
    else if (diff === 0) by('today').tasks.push(t);
    else if (diff === 1) by('tomorrow').tasks.push(t);
    else if (t.dueDate <= thisWeekEnd) by('this-week').tasks.push(t);
    else if (t.dueDate <= nextWeekEnd) by('next-week').tasks.push(t);
    else by('later').tasks.push(t);
  }
  return groups.filter((g) => g.tasks.length > 0);
}

/** Matches title, notes and step titles, case-insensitive. */
export function searchTasks(tasks: ITask[], query: string): ITask[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      (t.notes ? t.notes.toLowerCase().includes(q) : false) ||
      (t.steps ?? []).some((s) => s.title.toLowerCase().includes(q))
  );
}
