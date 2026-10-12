import {
  getDayBoundaryWindow,
  isWithinDayBoundary,
  formatTimeRelative,
  getTrackingDayDateString,
  getTrackingDayWindowFromDateString,
} from '../dayBoundary';

describe('dayBoundary utilities', () => {
  describe('getDayBoundaryWindow', () => {
    it('calculates window correctly during daytime (e.g. 2:00 PM with 4 AM boundary)', () => {
      const refDate = new Date('2026-10-10T14:00:00');
      const { start, end } = getDayBoundaryWindow(4, refDate);

      expect(start.getFullYear()).toBe(2026);
      expect(start.getMonth()).toBe(9); // October (0-indexed)
      expect(start.getDate()).toBe(10);
      expect(start.getHours()).toBe(4);
      expect(start.getMinutes()).toBe(0);

      expect(end.getFullYear()).toBe(2026);
      expect(end.getMonth()).toBe(9);
      expect(end.getDate()).toBe(11);
      expect(end.getHours()).toBe(3);
      expect(end.getMinutes()).toBe(59);
    });

    it('calculates window correctly in early morning before boundary (e.g. 2:30 AM with 4 AM boundary)', () => {
      const refDate = new Date('2026-10-11T02:30:00');
      const { start, end } = getDayBoundaryWindow(4, refDate);

      // Should map back to Oct 10 4:00 AM as the tracking day start
      expect(start.getDate()).toBe(10);
      expect(start.getHours()).toBe(4);

      // And end at Oct 11 3:59:59.999 AM
      expect(end.getDate()).toBe(11);
      expect(end.getHours()).toBe(3);
      expect(end.getMinutes()).toBe(59);
    });

    it('works when boundary is midnight (0:00 AM)', () => {
      const refDate = new Date('2026-10-10T15:00:00');
      const { start, end } = getDayBoundaryWindow(0, refDate);

      expect(start.getDate()).toBe(10);
      expect(start.getHours()).toBe(0);

      expect(end.getDate()).toBe(10);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
    });
  });

  describe('isWithinDayBoundary', () => {
    it('returns true for logs inside the current tracking window', () => {
      const ref = new Date('2026-10-10T15:00:00');
      const log1 = new Date('2026-10-10T04:05:00');
      const log2 = new Date('2026-10-10T23:50:00');
      const log3 = new Date('2026-10-11T03:30:00'); // still before 4 AM!

      expect(isWithinDayBoundary(log1, 4, ref)).toBe(true);
      expect(isWithinDayBoundary(log2, 4, ref)).toBe(true);
      expect(isWithinDayBoundary(log3, 4, ref)).toBe(true);
    });

    it('returns false for logs outside the current tracking window', () => {
      const ref = new Date('2026-10-10T15:00:00');
      const yesterdayLog = new Date('2026-10-10T03:55:00'); // before 4 AM of Oct 10
      const nextDayLog = new Date('2026-10-11T04:05:00'); // after 4 AM of Oct 11

      expect(isWithinDayBoundary(yesterdayLog, 4, ref)).toBe(false);
      expect(isWithinDayBoundary(nextDayLog, 4, ref)).toBe(false);
    });
  });

  describe('formatTimeRelative', () => {
    it('formats recent times as minutes ago', () => {
      const now = new Date('2026-10-10T12:00:00');
      const logTime = new Date('2026-10-10T11:45:00');
      expect(formatTimeRelative(logTime, now)).toBe('15m ago');
    });

    it('formats less than 1 min as Just now', () => {
      const now = new Date('2026-10-10T12:00:00');
      const logTime = new Date('2026-10-10T11:59:45');
      expect(formatTimeRelative(logTime, now)).toBe('Just now');
    });

    it('formats older times as standard clock time', () => {
      const now = new Date('2026-10-10T20:00:00');
      const logTime = new Date('2026-10-10T09:30:00');
      expect(formatTimeRelative(logTime, now)).toBe('9:30 AM');
    });
  });

  describe('getTrackingDayDateString', () => {
    it('returns the same calendar date during the day (e.g. 2:00 PM with 4 AM boundary)', () => {
      const date = new Date(2026, 9, 10, 14, 0, 0); // Oct 10, 2:00 PM
      expect(getTrackingDayDateString(date, 4)).toBe('2026-10-10');
    });

    it('returns previous calendar date when before boundary hour (e.g. 2:30 AM with 4 AM boundary)', () => {
      const date = new Date(2026, 9, 11, 2, 30, 0); // Oct 11, 2:30 AM
      expect(getTrackingDayDateString(date, 4)).toBe('2026-10-10');
    });

    it('returns new calendar date right at or after boundary hour (e.g. 4:00 AM with 4 AM boundary)', () => {
      const date = new Date(2026, 9, 11, 4, 0, 0); // Oct 11, 4:00 AM
      expect(getTrackingDayDateString(date, 4)).toBe('2026-10-11');
    });

    it('handles midnight boundary (0 AM)', () => {
      const date = new Date(2026, 9, 11, 1, 0, 0);
      expect(getTrackingDayDateString(date, 0)).toBe('2026-10-11');
    });
  });

  describe('getTrackingDayWindowFromDateString', () => {
    it('constructs accurate tracking window for a given tracking day and boundary', () => {
      const { start, end } = getTrackingDayWindowFromDateString('2026-10-10', 4);

      expect(start.getFullYear()).toBe(2026);
      expect(start.getMonth()).toBe(9);
      expect(start.getDate()).toBe(10);
      expect(start.getHours()).toBe(4);
      expect(start.getMinutes()).toBe(0);

      expect(end.getFullYear()).toBe(2026);
      expect(end.getMonth()).toBe(9);
      expect(end.getDate()).toBe(11);
      expect(end.getHours()).toBe(3);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
    });

    it('handles midnight boundary (0 AM) as standard calendar day', () => {
      const { start, end } = getTrackingDayWindowFromDateString('2026-10-10', 0);

      expect(start.getDate()).toBe(10);
      expect(start.getHours()).toBe(0);
      expect(end.getDate()).toBe(10);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
    });
  });
});
