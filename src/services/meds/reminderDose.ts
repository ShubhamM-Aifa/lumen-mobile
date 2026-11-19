/**
 * Marks a medicine dose from a reminder (notification button or the full-screen alarm).
 * Only reminders linked to a medicine can mark a dose; the slot is the reminder's dose time.
 */
import { markDose } from '../../hooks/useDoses';
import { getTrackingDayDateString } from '../../utils/dayBoundary';
import { getActiveBoundaryHour } from '../../store/quickLogStore';

export interface DoseReminderInfo {
  medicationId?: string | null;
  doseSlot?: string | null;
  targetTime?: string | null;
}

const SLOT = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The planned dose a reminder stands for: its own dose time, else its alarm time. */
export function reminderSlot(r: DoseReminderInfo): string {
  if (r.doseSlot && SLOT.test(r.doseSlot)) return r.doseSlot;
  if (r.targetTime && SLOT.test(r.targetTime)) return r.targetTime;
  return 'unscheduled';
}

export async function markReminderDose(r: DoseReminderInfo, status: 'taken' | 'skipped', now: Date = new Date()): Promise<boolean> {
  if (!r.medicationId) return false;
  const dayKey = getTrackingDayDateString(now, getActiveBoundaryHour());
  await markDose({ medicationId: r.medicationId, dayKey, slot: reminderSlot(r), status, source: 'notification' });
  return true;
}
