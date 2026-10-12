/**
 * Day Reset Boundary Utilities
 *
 * In Lumen, a user's tracking "day" does not always begin at midnight (00:00).
 * Instead, it begins at the user-defined `dayBoundaryHour` (default 4:00 AM).
 *
 * For example, if boundaryHour = 4:
 * - 2026-10-10 11:00 AM -> Window: 2026-10-10 04:00:00 to 2026-10-11 03:59:59
 * - 2026-10-11 02:30 AM -> Window: 2026-10-10 04:00:00 to 2026-10-11 03:59:59 (belongs to previous tracking day!)
 */

export interface DayBoundaryWindow {
  start: Date;
  end: Date;
}

/**
 * Returns the exact Date range for the tracking day containing referenceDate.
 */
export function getDayBoundaryWindow(
  boundaryHour: number = 4,
  referenceDate: Date = new Date()
): DayBoundaryWindow {
  const ref = new Date(referenceDate);
  const start = new Date(ref);

  // If the reference hour is earlier than the boundary hour (e.g. 2 AM vs 4 AM boundary),
  // the current tracking day started yesterday at boundaryHour.
  if (ref.getHours() < boundaryHour) {
    start.setDate(start.getDate() - 1);
  }
  start.setHours(boundaryHour, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(-1); // 23:59:59.999 relative to start

  return { start, end };
}

/**
 * Checks whether a timestamp falls within the tracking day window.
 */
export function isWithinDayBoundary(
  dateToCheck: Date | string | number,
  boundaryHour: number = 4,
  referenceDate: Date = new Date()
): boolean {
  const targetTime = new Date(dateToCheck).getTime();
  if (isNaN(targetTime)) return false;

  const { start, end } = getDayBoundaryWindow(boundaryHour, referenceDate);
  return targetTime >= start.getTime() && targetTime <= end.getTime();
}

/**
 * Returns the tracking day string ('YYYY-MM-DD') for a given timestamp.
 * If the hour is earlier than boundaryHour, the tracking day belongs to the previous calendar date.
 */
export function getTrackingDayDateString(
  date: Date = new Date(),
  boundaryHour: number = 4
): string {
  const { start } = getDayBoundaryWindow(boundaryHour, date);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the start and end Date for a given tracking day date string ('YYYY-MM-DD').
 * E.g., for '2026-10-10' and boundaryHour = 4:
 * start = 2026-10-10 04:00:00.000
 * end = 2026-10-11 03:59:59.999
 */
export function getTrackingDayWindowFromDateString(
  dateStr: string,
  boundaryHour: number = 4
): DayBoundaryWindow {
  if (!dateStr || !dateStr.includes('-')) {
    return getDayBoundaryWindow(boundaryHour, new Date());
  }
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);

  const start = new Date(y, m, d, boundaryHour, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(-1);

  return { start, end };
}

/**
 * Human-friendly format for time relative to now or today:
 * e.g., "Just now", "25m ago", "2h ago", "9:30 AM"
 */
export function formatTimeRelative(date: Date | string | number, now: Date = new Date()): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 6) return `${diffHours}h ago`;

  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}
