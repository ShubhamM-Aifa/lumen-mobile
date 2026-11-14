import { useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { useTaskStore } from '../store/taskStore';
import { useTodoPrefs } from '../store/todoPrefsStore';
import { getTrackingDayDateString } from '../utils/dayBoundary';

export function useBoundaryHour(): number {
  return useAuthStore((s) => s.user?.preferences?.dayBoundaryHour) ?? 4;
}

/** Today's date ('YYYY-MM-DD') on the user's own day boundary. */
export function useTodayStr(): string {
  const boundaryHour = useBoundaryHour();
  // Recomputed on every render; the string only changes at the boundary hour.
  return useMemo(() => getTrackingDayDateString(new Date(), boundaryHour), [boundaryHour, new Date().getHours()]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Loads preferences and syncs tasks, lists, groups and categories when a To Do screen opens. */
export function useTodoBootstrap(): void {
  const boundaryHour = useBoundaryHour();
  useEffect(() => {
    const s = useTaskStore.getState();
    void useTodoPrefs.getState().load();
    void s.pruneDayBoundary(boundaryHour);
    void s.fetchTasks(boundaryHour).then(() => Promise.all([s.fetchLists(), s.fetchGroups(), s.fetchCategories()]));
  }, [boundaryHour]);
}
