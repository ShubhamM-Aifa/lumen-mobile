import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn().mockResolvedValue({}),
    patch: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
}));

import { api } from '../../api/client';
import { useTaskStore } from '../taskStore';
import { useTodoPrefs, DEFAULT_SETTINGS } from '../todoPrefsStore';
import { flushOutbox, getPendingCount, __resetOutboxForTests, __setAutoFlushForTests } from '../../services/todo/outbox';
import { isObjectId } from '../../utils/todo/objectId';
import { ITask } from '../../shared/types';

const mockApi = api as unknown as { get: jest.Mock; post: jest.Mock; patch: jest.Mock; delete: jest.Mock };

const store = () => useTaskStore.getState();
const lastPatchFor = (id: string) =>
  [...mockApi.patch.mock.calls].reverse().find((c) => c[0] === `/tasks/${id}`)?.[1];

function baseTask(over: Partial<ITask>): ITask {
  return {
    _id: 'a'.repeat(24),
    userId: 'u',
    title: 'T',
    isCompleted: false,
    isImportant: false,
    inMyDay: false,
    steps: [],
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

describe('taskStore (outbox backed)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    __resetOutboxForTests();
    __setAutoFlushForTests(false);
    mockApi.post.mockResolvedValue({});
    mockApi.patch.mockResolvedValue({});
    mockApi.delete.mockResolvedValue({});
    mockApi.get.mockResolvedValue([]);
    useTodoPrefs.setState({ loaded: true, views: {}, settings: { ...DEFAULT_SETTINGS } });
    useTaskStore.setState({ tasks: [], lists: [], groups: [], categories: [], isLoading: false, error: null, undoEntry: null });
  });

  it('creates tasks with a final ObjectId and sends that id to the server', async () => {
    const task = await store().addTask({ title: '  Pacing meditation ', energyCost: 'gentle', inMyDay: true });
    expect(isObjectId(task._id)).toBe(true);
    expect(task.title).toBe('Pacing meditation');
    expect(task.myDayDate).toBeDefined();
    await flushOutbox();
    expect(mockApi.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({ _id: task._id, title: 'Pacing meditation', energyCost: 'gentle' }));
  });

  it('puts new tasks on top or bottom according to the setting', async () => {
    const first = await store().addTask({ title: 'first' });
    const second = await store().addTask({ title: 'second' });
    expect(second.sortOrder).toBeLessThan(first.sortOrder);
    useTodoPrefs.getState().setSettings({ addOnTop: false });
    const third = await store().addTask({ title: 'third' });
    expect(third.sortOrder).toBeGreaterThan(first.sortOrder);
  });

  it('sends null when a due date, repeat, energy or My Day is cleared (the lost-clear bug)', async () => {
    const t = await store().addTask({ title: 'x', dueDate: '2026-11-20', energyCost: 'gentle', repeat: { frequency: 'daily' }, inMyDay: true });
    await flushOutbox();
    await store().updateTask(t._id, { dueDate: undefined, energyCost: null, repeat: undefined });
    await store().toggleTaskMyDay(t._id);
    await flushOutbox();
    const body = lastPatchFor(t._id);
    expect(body).toEqual({ dueDate: null, energyCost: null, repeat: null, inMyDay: false, myDayDate: null });
    const local = store().tasks.find((x) => x._id === t._id)!;
    expect(local.dueDate).toBeUndefined();
    expect(local.repeat).toBeUndefined();
    expect(local.energyCost).toBeUndefined();
    expect(local.inMyDay).toBe(false);
  });

  it('edits made before the create reaches the server are not lost or sent to a wrong id', async () => {
    mockApi.post.mockRejectedValueOnce(new TypeError('offline'));
    const t = await store().addTask({ title: 'offline task' });
    await store().toggleTaskImportant(t._id);
    await flushOutbox();
    expect(getPendingCount()).toBe(2);
    expect(mockApi.patch).not.toHaveBeenCalled(); // PATCH waits behind the failed POST
    await flushOutbox();
    expect(mockApi.post).toHaveBeenCalledTimes(2);
    expect(mockApi.patch).toHaveBeenCalledWith(`/tasks/${t._id}`, { isImportant: true });
    expect(getPendingCount()).toBe(0);
  });

  it('does not overwrite local changes with the server copy while changes are pending', async () => {
    mockApi.post.mockRejectedValue(new TypeError('offline'));
    const t = await store().addTask({ title: 'only on this phone' });
    mockApi.get.mockResolvedValue([]);
    await store().fetchTasks(4);
    expect(store().tasks.map((x) => x._id)).toEqual([t._id]);
    mockApi.post.mockResolvedValue({});
    await store().fetchTasks(4);
    expect(getPendingCount()).toBe(0);
  });

  it('replaces local tasks with the server copy once everything is synced', async () => {
    const server = baseTask({ _id: 'b'.repeat(24), title: 'from server' });
    mockApi.get.mockResolvedValue([server]);
    await store().fetchTasks(4);
    expect(store().tasks.map((x) => x.title)).toEqual(['from server']);
    expect(mockApi.get.mock.calls[0][0]).toMatch(/^\/tasks\?includeCompleted=true&today=\d{4}-\d{2}-\d{2}$/);
  });

  it('clears stale My Day entries from the server copy', async () => {
    mockApi.get.mockResolvedValue([baseTask({ inMyDay: true, myDayDate: '2020-01-01' })]);
    await store().fetchTasks(4);
    expect(store().tasks[0].inMyDay).toBe(false);
  });

  it('prunes yesterday\'s My Day and queues the change', async () => {
    useTaskStore.setState({ tasks: [baseTask({ inMyDay: true, myDayDate: '2020-01-01' })] });
    await store().pruneDayBoundary(4);
    expect(store().tasks[0].inMyDay).toBe(false);
    await flushOutbox();
    expect(mockApi.patch).toHaveBeenCalledWith(`/tasks/${'a'.repeat(24)}`, { inMyDay: false, myDayDate: null });
  });

  it('keeps steps consistent: add, toggle, rename, delete all save the whole step list', async () => {
    const t = await store().addTask({ title: 'Prepare meal' });
    await store().addStep(t._id, 'Wash spinach');
    const stepId = store().tasks[0].steps[0].id;
    expect(stepId.startsWith('step_')).toBe(true);
    await store().toggleStep(t._id, stepId);
    expect(store().tasks[0].steps[0].completed).toBe(true);
    await store().renameStep(t._id, stepId, 'Wash kale');
    await store().renameStep(t._id, stepId, '   '); // ignored
    expect(store().tasks[0].steps[0].title).toBe('Wash kale');
    await flushOutbox();
    expect(lastPatchFor(t._id).steps).toEqual([expect.objectContaining({ id: stepId, title: 'Wash kale', completed: true })]);
    await store().deleteStep(t._id, stepId);
    await flushOutbox();
    expect(lastPatchFor(t._id)).toEqual({ steps: [] });
  });

  it('promotes a step to its own task in the same list', async () => {
    const list = await store().createList('Physio');
    const t = await store().addTask({ title: 'Routine', listId: list._id });
    await store().addStep(t._id, 'Neck stretch');
    const stepId = store().tasks.find((x) => x._id === t._id)!.steps[0].id;
    const created = await store().promoteStepToTask(t._id, stepId);
    expect(created?.title).toBe('Neck stretch');
    expect(created?.listId).toBe(list._id);
    expect(store().tasks.find((x) => x._id === t._id)!.steps).toHaveLength(0);
  });

  describe('repeat', () => {
    it('completing a repeating task creates the next one exactly once', async () => {
      const t = await store().addTask({ title: 'Electrolytes', dueDate: '2099-01-10', repeat: { frequency: 'daily' }, energyCost: 'gentle' });
      await store().addStep(t._id, 'Fill bottle');
      await store().toggleStep(t._id, store().tasks.find((x) => x._id === t._id)!.steps[0].id);

      await store().toggleTaskCompleted(t._id, 4);
      const all = store().tasks;
      expect(all).toHaveLength(2);
      const next = all.find((x) => x._id !== t._id)!;
      expect(next.dueDate).toBe('2099-01-11');
      expect(next.isCompleted).toBe(false);
      expect(next.energyCost).toBe('gentle');
      expect(next.steps[0].completed).toBe(false); // steps are unticked
      expect(all.find((x) => x._id === t._id)!.nextOccurrenceId).toBe(next._id);

      // un-tick and tick again: no duplicate
      await store().toggleTaskCompleted(t._id, 4);
      await store().toggleTaskCompleted(t._id, 4);
      expect(store().tasks).toHaveLength(2);

      await flushOutbox();
      expect(mockApi.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({ _id: next._id, dueDate: '2099-01-11' }));
    });

    it('does not spawn anything for a non-repeating task', async () => {
      const t = await store().addTask({ title: 'once' });
      await store().toggleTaskCompleted(t._id);
      expect(store().tasks).toHaveLength(1);
      expect(store().tasks[0].isCompleted).toBe(true);
      await store().toggleTaskCompleted(t._id);
      expect(store().tasks[0].isCompleted).toBe(false);
      expect(store().tasks[0].completedAt).toBeUndefined();
    });
  });

  describe('delete and undo', () => {
    it('undo brings the task back with the same id and recreates it on the server', async () => {
      const t = await store().addTask({ title: 'Doomed', notes: 'keep me' });
      await flushOutbox();
      await store().deleteTask(t._id);
      expect(store().tasks).toHaveLength(0);
      expect(store().undoEntry?.label).toBe('Task deleted');
      await flushOutbox();
      expect(mockApi.delete).toHaveBeenCalledWith(`/tasks/${t._id}`);

      await store().undoLast();
      expect(store().tasks.map((x) => x._id)).toEqual([t._id]);
      expect(store().tasks[0].notes).toBe('keep me');
      expect(store().undoEntry).toBeNull();
      await flushOutbox();
      expect(mockApi.post).toHaveBeenLastCalledWith('/tasks', expect.objectContaining({ _id: t._id, notes: 'keep me' }));
    });

    it('deleting a task that never synced sends nothing', async () => {
      mockApi.post.mockRejectedValue(new TypeError('offline'));
      const t = await store().addTask({ title: 'ephemeral' });
      await store().deleteTask(t._id);
      expect(getPendingCount()).toBe(0);
      expect(mockApi.delete).not.toHaveBeenCalled();
    });

    it('bulk delete is one undo', async () => {
      const a = await store().addTask({ title: 'a' });
      const b = await store().addTask({ title: 'b' });
      await store().deleteTasks([a._id, b._id]);
      expect(store().undoEntry?.label).toBe('2 tasks deleted');
      await store().undoLast();
      expect(store().tasks).toHaveLength(2);
    });
  });

  describe('ordering and bulk edits', () => {
    it('reorderTasks numbers the visible tasks and only saves the ones that changed', async () => {
      const a = await store().addTask({ title: 'a', sortOrder: 0 });
      const b = await store().addTask({ title: 'b', sortOrder: 1 });
      const c = await store().addTask({ title: 'c', sortOrder: 2 });
      await flushOutbox();
      mockApi.patch.mockClear();
      await store().reorderTasks([c._id, a._id, b._id]);
      await flushOutbox();
      const sorted = [...store().tasks].sort((x, y) => x.sortOrder - y.sortOrder).map((x) => x.title);
      expect(sorted).toEqual(['c', 'a', 'b']);
      expect(mockApi.patch).toHaveBeenCalledTimes(3);
    });

    it('bulkUpdate and bulkComplete', async () => {
      const a = await store().addTask({ title: 'a' });
      const b = await store().addTask({ title: 'b' });
      await store().bulkUpdate([a._id, b._id], { isImportant: true });
      expect(store().tasks.every((t) => t.isImportant)).toBe(true);
      await store().bulkComplete([a._id, b._id]);
      expect(store().tasks.every((t) => t.isCompleted)).toBe(true);
    });
  });

  describe('lists, groups, categories', () => {
    it('deleteList also clears listId on local tasks (the drift bug)', async () => {
      const list = await store().createList('Work');
      const t = await store().addTask({ title: 'in list', listId: list._id });
      await store().deleteList(list._id);
      expect(store().lists).toHaveLength(0);
      expect(store().tasks.find((x) => x._id === t._id)!.listId).toBeUndefined();
    });

    it('creates lists with a final id and supports rename, colour and group', async () => {
      const group = await store().createGroup('Health admin');
      const list = await store().createList('Pharmacy', '💊', '#34C759', group._id);
      expect(isObjectId(list._id)).toBe(true);
      expect(list.groupId).toBe(group._id);
      await store().updateList(list._id, { name: 'Chemist', color: '#FF9500' });
      expect(store().lists[0]).toMatchObject({ name: 'Chemist', color: '#FF9500' });
      await store().updateList(list._id, { groupId: null });
      expect(store().lists[0].groupId).toBeUndefined();
      await flushOutbox();
      // the three edits were merged into one request, later values winning
    expect(mockApi.patch).toHaveBeenCalledWith(`/tasks/lists/${list._id}`, { name: 'Chemist', color: '#FF9500', groupId: null });
    });

    it('deleting a group ungroups its lists', async () => {
      const group = await store().createGroup('G');
      await store().createList('L', '📋', '#4A90E2', group._id);
      await store().deleteGroup(group._id);
      expect(store().groups).toHaveLength(0);
      expect(store().lists[0].groupId).toBeUndefined();
    });

    it('duplicates a list with its open tasks, steps unticked', async () => {
      const list = await store().createList('Morning');
      const t = await store().addTask({ title: 'Stretch', listId: list._id });
      await store().addStep(t._id, 'Neck');
      await store().toggleStep(t._id, store().tasks.find((x) => x._id === t._id)!.steps[0].id);
      const done = await store().addTask({ title: 'Done already', listId: list._id });
      await store().toggleTaskCompleted(done._id);
      const copy = await store().duplicateList(list._id);
      const copied = store().tasks.filter((x) => x.listId === copy!._id);
      expect(copied.map((x) => x.title)).toEqual(['Stretch']);
      expect(copied[0].steps[0].completed).toBe(false);
    });

    it('renaming and deleting a category follows through to tasks', async () => {
      const cat = await store().createCategory('Doctor', '#FF3B30');
      const t = await store().addTask({ title: 'x', categories: ['Doctor'] });
      await store().updateCategory(cat._id, { name: 'GP' });
      expect(store().tasks.find((x) => x._id === t._id)!.categories).toEqual(['GP']);
      await store().deleteCategory(cat._id);
      expect(store().tasks.find((x) => x._id === t._id)!.categories).toEqual([]);
    });
  });

  it('defers a task for a flare using local dates and moves the reminder with it', async () => {
    const reminder = new Date(2026, 10, 12, 9, 0).toISOString();
    const t = await store().addTask({ title: 'Grocery trip', inMyDay: true, dueDate: '2026-11-12', reminderTime: reminder });
    await store().deferForFlare(t._id, 3);
    const d = store().tasks.find((x) => x._id === t._id)!;
    expect(d.inMyDay).toBe(false);
    expect(d.myDayDate).toBeUndefined();
    expect(d.dueDate).toBe('2026-11-15');
    expect(new Date(d.reminderTime!).getDate()).toBe(15);
  });

  it('fills the suggestions "yesterday" group when an older server omits it', async () => {
    mockApi.get.mockResolvedValue({ overdue: [], dueToday: [], important: [], recent: [] });
    const res = await store().fetchSuggestions(4);
    expect(res?.yesterday).toEqual([]);
  });
});
