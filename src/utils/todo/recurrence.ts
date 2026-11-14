import { ITaskRepeat } from '../../shared/types';
import { addDays, addMonths, dayOfWeek, diffDays, isoToDateStr, shiftIsoByDays } from './dates';

export interface NextOccurrence {
  dueDate: string;
  reminderTime?: string;
}

const MAX_STEPS = 800;

/** One step forward from `from` (a due date) according to the repeat rule. */
function stepOnce(repeat: ITaskRepeat, from: string): string {
  const interval = Math.max(1, repeat.interval ?? 1);
  switch (repeat.frequency) {
    case 'daily':
      return addDays(from, interval);
    case 'weekdays': {
      let next = addDays(from, 1);
      while (dayOfWeek(next) === 0 || dayOfWeek(next) === 6) next = addDays(next, 1);
      return next;
    }
    case 'weekly':
    case 'custom': {
      const days = repeat.daysOfWeek && repeat.daysOfWeek.length > 0 ? [...repeat.daysOfWeek].sort((a, b) => a - b) : null;
      if (!days) {
        return repeat.frequency === 'custom' ? addDays(from, interval) : addDays(from, 7 * interval);
      }
      // Next chosen weekday later in the same (Sun-Sat) week, else the first chosen day `interval` weeks on.
      const dow = dayOfWeek(from);
      const later = days.find((d) => d > dow);
      if (later !== undefined) return addDays(from, later - dow);
      return addDays(from, 7 * interval - dow + days[0]);
    }
    case 'monthly':
      return addMonths(from, interval);
    case 'yearly':
      return addMonths(from, 12 * interval);
    default:
      return addDays(from, 1);
  }
}

/**
 * Next due date for a repeating task that was just completed.
 * Steps forward from the current due date until the result is after it AND after today, so a task
 * finished late lands on the next future occurrence, and one finished on its due day does not reappear today.
 * The reminder keeps its time of day and its offset from the due date.
 */
export function computeNextOccurrence(
  repeat: ITaskRepeat,
  dueDate: string | undefined,
  reminderTime: string | undefined,
  todayStr: string
): NextOccurrence {
  const base = dueDate || (reminderTime ? isoToDateStr(reminderTime) : null) || todayStr;

  let next = stepOnce(repeat, base);
  let guard = 0;
  while (diffDays(todayStr, next) <= 0 && guard++ < MAX_STEPS) {
    next = stepOnce(repeat, next);
  }

  const result: NextOccurrence = { dueDate: next };
  if (reminderTime) {
    const reminderDay = isoToDateStr(reminderTime) ?? base;
    const offset = diffDays(base, reminderDay);
    const targetDay = addDays(next, offset);
    result.reminderTime = shiftIsoByDays(reminderTime, diffDays(reminderDay, targetDay));
  }
  return result;
}

export function describeRepeat(repeat: ITaskRepeat): string {
  const interval = Math.max(1, repeat.interval ?? 1);
  const every = (unit: string) => (interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`);
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  switch (repeat.frequency) {
    case 'daily':
      return interval === 1 ? 'Daily' : every('day');
    case 'weekdays':
      return 'Weekdays';
    case 'weekly':
    case 'custom': {
      const days = repeat.daysOfWeek && repeat.daysOfWeek.length > 0
        ? ` on ${[...repeat.daysOfWeek].sort((a, b) => a - b).map((d) => names[d]).join(', ')}`
        : '';
      if (repeat.frequency === 'weekly' && interval === 1 && !days) return 'Weekly';
      if (repeat.frequency === 'custom' && !days) return every('day');
      return `${every('week')}${days}`;
    }
    case 'monthly':
      return interval === 1 ? 'Monthly' : every('month');
    case 'yearly':
      return interval === 1 ? 'Yearly' : every('year');
    default:
      return 'Repeats';
  }
}
