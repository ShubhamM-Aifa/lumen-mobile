import { toLocalDateString, parseLocalDate } from '../useTimelineSummary';

describe('useTimelineSummary date helpers', () => {
  describe('toLocalDateString', () => {
    it('formats a date as YYYY-MM-DD in local time without UTC offset drift', () => {
      const testDate = new Date(2026, 9, 3, 14, 30, 0); // Month is 0-indexed (9 = Oct)
      expect(toLocalDateString(testDate)).toBe('2026-10-03');
    });

    it('pads single-digit month and day with leading zeroes', () => {
      const testDate = new Date(2026, 0, 5, 2, 5, 0); // Jan 5
      expect(toLocalDateString(testDate)).toBe('2026-01-05');
    });

    it('defaults to current date when called without arguments', () => {
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      expect(toLocalDateString()).toBe(expected);
    });
  });

  describe('parseLocalDate', () => {
    it('returns exact local start and end of day dates', () => {
      const { startOfDay, endOfDay } = parseLocalDate('2026-10-03');

      expect(startOfDay.getFullYear()).toBe(2026);
      expect(startOfDay.getMonth()).toBe(9);
      expect(startOfDay.getDate()).toBe(3);
      expect(startOfDay.getHours()).toBe(0);
      expect(startOfDay.getMinutes()).toBe(0);
      expect(startOfDay.getSeconds()).toBe(0);
      expect(startOfDay.getMilliseconds()).toBe(0);

      expect(endOfDay.getFullYear()).toBe(2026);
      expect(endOfDay.getMonth()).toBe(9);
      expect(endOfDay.getDate()).toBe(3);
      expect(endOfDay.getHours()).toBe(23);
      expect(endOfDay.getMinutes()).toBe(59);
      expect(endOfDay.getSeconds()).toBe(59);
      expect(endOfDay.getMilliseconds()).toBe(999);
    });

    it('falls back safely to current day bounds if empty or invalid string is passed', () => {
      const { startOfDay, endOfDay } = parseLocalDate('');
      const now = new Date();

      expect(startOfDay.getDate()).toBe(now.getDate());
      expect(startOfDay.getHours()).toBe(0);
      expect(endOfDay.getHours()).toBe(23);
    });

    it('respects custom boundaryHour (e.g. 4 AM)', () => {
      const { startOfDay, endOfDay } = parseLocalDate('2026-10-03', 4);

      expect(startOfDay.getFullYear()).toBe(2026);
      expect(startOfDay.getMonth()).toBe(9);
      expect(startOfDay.getDate()).toBe(3);
      expect(startOfDay.getHours()).toBe(4);

      expect(endOfDay.getFullYear()).toBe(2026);
      expect(endOfDay.getMonth()).toBe(9);
      expect(endOfDay.getDate()).toBe(4);
      expect(endOfDay.getHours()).toBe(3);
      expect(endOfDay.getMinutes()).toBe(59);
    });
  });
});
