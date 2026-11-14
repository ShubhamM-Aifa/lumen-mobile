/**
 * Date helpers for the To Do feature. Everything works on local calendar dates ('YYYY-MM-DD'),
 * never on `toISOString().slice(0, 10)`, which is the UTC date and can be a day off.
 * "Today" always comes from getTrackingDayDateString so the day-boundary hour is respected.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local date at noon, so adding days never lands on the wrong day across a DST change. */
export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDays(s: string, n: number): string {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Adds calendar months and clamps to the last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  return `${year}-${pad(month + 1)}-${pad(Math.min(d, daysInMonth(year, month)))}`;
}

export function dayOfWeek(s: string): number {
  return parseDateStr(s).getDay();
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

export function formatDateShort(s: string, todayStr: string): string {
  const d = parseDateStr(s);
  const sameYear = s.slice(0, 4) === todayStr.slice(0, 4);
  const base = `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return sameYear ? base : `${base} ${d.getFullYear()}`;
}

/** "Thursday, 12 November" */
export function formatLongDate(s: string): string {
  const d = parseDateStr(s);
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

export interface DueLabel {
  label: string;
  overdue: boolean;
  today: boolean;
}

export function formatDue(dueDate: string, todayStr: string): DueLabel {
  const diff = diffDays(todayStr, dueDate);
  if (diff === 0) return { label: 'Today', overdue: false, today: true };
  if (diff === 1) return { label: 'Tomorrow', overdue: false, today: false };
  if (diff === -1) return { label: 'Yesterday', overdue: true, today: false };
  return { label: formatDateShort(dueDate, todayStr), overdue: diff < 0, today: false };
}

export function formatTime(d: Date): string {
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Today 3:00 PM", "Tomorrow 9:00 AM", "Fri, 20 Nov 9:00 AM". */
export function formatReminder(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const day = toDateStr(d);
  const today = toDateStr(now);
  const diff = diffDays(today, day);
  const dayLabel = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : formatDateShort(day, today);
  return `${dayLabel} ${formatTime(d)}`;
}

export interface ReminderPreset {
  key: 'later' | 'tomorrow' | 'nextweek';
  label: string;
  /** Right-hand hint, e.g. "3:00 PM". */
  hint: string;
  iso: string;
}

function at(dateStr: string, hour: number): Date {
  const d = parseDateStr(dateStr);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Days from `dateStr` to the next Monday (always 1-7). */
function daysUntilNextMonday(dateStr: string): number {
  return ((8 - dayOfWeek(dateStr)) % 7) || 7;
}

/** Later today (3 hours on, rounded up to the hour, only while still today), Tomorrow 9 AM, next Monday 9 AM. */
export function reminderPresets(now: Date = new Date()): ReminderPreset[] {
  const out: ReminderPreset[] = [];
  const today = toDateStr(now);

  const later = new Date(now.getTime() + 3 * 3600 * 1000);
  if (later.getMinutes() > 0 || later.getSeconds() > 0 || later.getMilliseconds() > 0) {
    later.setHours(later.getHours() + 1, 0, 0, 0);
  }
  if (toDateStr(later) === today) {
    out.push({ key: 'later', label: 'Later today', hint: formatTime(later), iso: later.toISOString() });
  }

  const tomorrow = at(addDays(today, 1), 9);
  out.push({ key: 'tomorrow', label: 'Tomorrow', hint: `${WEEKDAYS[tomorrow.getDay()]} ${formatTime(tomorrow)}`, iso: tomorrow.toISOString() });

  const nextWeek = at(addDays(today, daysUntilNextMonday(today)), 9);
  out.push({ key: 'nextweek', label: 'Next week', hint: `${WEEKDAYS[nextWeek.getDay()]} ${formatTime(nextWeek)}`, iso: nextWeek.toISOString() });
  return out;
}

export interface DuePreset {
  key: 'today' | 'tomorrow' | 'nextweek';
  label: string;
  hint: string;
  date: string;
}

export function duePresets(todayStr: string): DuePreset[] {
  const tomorrow = addDays(todayStr, 1);
  const nextWeek = addDays(todayStr, daysUntilNextMonday(todayStr));
  return [
    { key: 'today', label: 'Today', hint: WEEKDAYS[dayOfWeek(todayStr)], date: todayStr },
    { key: 'tomorrow', label: 'Tomorrow', hint: WEEKDAYS[dayOfWeek(tomorrow)], date: tomorrow },
    { key: 'nextweek', label: 'Next week', hint: WEEKDAYS[dayOfWeek(nextWeek)], date: nextWeek },
  ];
}

/** Moves a reminder instant by whole days, keeping its local time of day. */
export function shiftIsoByDays(iso: string, days: number): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Local calendar date a reminder instant falls on. */
export function isoToDateStr(iso: string): string | null {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : toDateStr(d);
}
