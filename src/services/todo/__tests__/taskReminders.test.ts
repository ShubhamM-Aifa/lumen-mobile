const mockSchedule = jest.fn().mockResolvedValue('id');
const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockGetAll = jest.fn();

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...a: unknown[]) => mockSchedule(...a),
  cancelScheduledNotificationAsync: (...a: unknown[]) => mockCancel(...a),
  getAllScheduledNotificationsAsync: () => mockGetAll(),
}));

jest.mock('../../notifications', () => ({
  ensureNotificationChannel: jest.fn().mockResolvedValue(undefined),
  NOTIF_CATEGORIES: { TASK: 'lumen_category_task' },
  CHANNEL_ID_HEADS_UP: 'lumen_heads_up_v1',
  TRIGGER_TYPES: { DATE: 'date' },
}));

import { ITask } from '../../../shared/types';
import { syncTaskReminders, tasksNeedingReminder, taskNotificationId } from '../taskReminders';

function task(over: Partial<ITask>): ITask {
  return {
    _id: 'a'.repeat(24),
    userId: '',
    title: 'Call physio',
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

const future = new Date(Date.now() + 3600 * 1000).toISOString();
const past = new Date(Date.now() - 3600 * 1000).toISOString();

describe('task reminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAll.mockResolvedValue([]);
  });

  it('only wants incomplete tasks with a future reminder', () => {
    const wanted = tasksNeedingReminder([
      task({ _id: '1', reminderTime: future }),
      task({ _id: '2', reminderTime: past }),
      task({ _id: '3', reminderTime: future, isCompleted: true }),
      task({ _id: '4' }),
    ]);
    expect(wanted.map((t) => t._id)).toEqual(['1']);
  });

  it('schedules one notification per task that opens the task and offers Mark complete', async () => {
    const t = task({ _id: 'b'.repeat(24), reminderTime: future });
    await syncTaskReminders([t]);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const arg = mockSchedule.mock.calls[0][0];
    expect(arg.identifier).toBe(taskNotificationId(t._id));
    expect(arg.content.title).toBe('Call physio');
    expect(arg.content.categoryIdentifier).toBe('lumen_category_task');
    expect(arg.content.data).toEqual({ taskId: t._id, route: `/todo/task/${t._id}` });
    expect(arg.trigger.date).toEqual(new Date(future));
  });

  it('cancels task notifications that are no longer wanted and leaves others alone', async () => {
    mockGetAll.mockResolvedValue([{ identifier: 'task-old' }, { identifier: 'reminder-xyz' }]);
    await syncTaskReminders([]);
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCancel).toHaveBeenCalledWith('task-old');
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});
