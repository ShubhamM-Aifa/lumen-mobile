import { useTaskStore } from '../taskStore';

jest.mock('../../api/client', () => ({
  api: {
    get: jest.fn().mockImplementation((url: string) => {
      if (url.includes('/tasks/suggestions')) {
        return Promise.resolve({
          overdue: [],
          dueToday: [],
          important: [],
          recent: [],
        });
      }
      return Promise.resolve([]);
    }),
    post: jest.fn().mockImplementation((url: string, body: any) =>
      Promise.resolve({ _id: 'server_task_123', ...body })
    ),
    patch: jest.fn().mockImplementation((url: string, body: any) =>
      Promise.resolve({ success: true, ...body })
    ),
    delete: jest.fn().mockResolvedValue({ success: true }),
  },
}));

describe('Microsoft To Do style TaskStore with Day Boundary', () => {
  beforeEach(() => {
    useTaskStore.setState({
      tasks: [],
      lists: [],
      activeFilter: 'my-day',
      selectedTaskId: null,
      isLoading: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  it('adds a task with gentle energy cost and steps', async () => {
    const task = await useTaskStore.getState().addTask({
      title: 'Pacing meditation',
      energyCost: 'gentle',
      inMyDay: true,
      steps: [{ id: 's1', title: 'Find quiet spot', completed: false }],
    });

    expect(task.title).toBe('Pacing meditation');
    expect(task.energyCost).toBe('gentle');
    expect(task.inMyDay).toBe(true);

    const storeTasks = useTaskStore.getState().tasks;
    expect(storeTasks.length).toBe(1);
    expect(storeTasks[0].title).toBe('Pacing meditation');
  });

  it('toggles task completion and important state', async () => {
    const task = await useTaskStore.getState().addTask({
      title: 'Take afternoon vitals',
    });

    await useTaskStore.getState().toggleTaskCompleted(task._id);
    expect(useTaskStore.getState().tasks[0].isCompleted).toBe(true);

    await useTaskStore.getState().toggleTaskImportant(task._id);
    expect(useTaskStore.getState().tasks[0].isImportant).toBe(true);
  });

  it('manages steps sub-items: add, toggle, delete', async () => {
    const task = await useTaskStore.getState().addTask({
      title: 'Prepare healthy meal',
    });

    await useTaskStore.getState().addStep(task._id, 'Wash spinach');
    const updated = useTaskStore.getState().tasks[0];
    expect(updated.steps.length).toBe(1);
    expect(updated.steps[0].title).toBe('Wash spinach');
    expect(updated.steps[0].completed).toBe(false);

    const stepId = updated.steps[0].id;
    await useTaskStore.getState().toggleStep(task._id, stepId);
    expect(useTaskStore.getState().tasks[0].steps[0].completed).toBe(true);

    await useTaskStore.getState().deleteStep(task._id, stepId);
    expect(useTaskStore.getState().tasks[0].steps.length).toBe(0);
  });

  it('prunes My Day tasks from yesterday when day boundary resets', () => {
    useTaskStore.setState({
      tasks: [
        {
          _id: 'task_yesterday',
          userId: 'u1',
          title: 'Yesterday task',
          isCompleted: false,
          isImportant: false,
          inMyDay: true,
          myDayDate: '2020-01-01', // old tracking day
          steps: [],
          sortOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    // Prune with boundary hour 4
    useTaskStore.getState().pruneDayBoundary(4);

    // The task should now have inMyDay = false (unpinned for clean slate!)
    const pruned = useTaskStore.getState().tasks[0];
    expect(pruned.inMyDay).toBe(false);
  });

  it('defers task for chronic illness flare with one tap', async () => {
    const task = await useTaskStore.getState().addTask({
      title: 'Heavy grocery trip',
      inMyDay: true,
      dueDate: '2026-10-22',
      energyCost: 'demanding',
    });

    await useTaskStore.getState().deferForFlare(task._id, 3);
    const deferred = useTaskStore.getState().tasks[0];
    expect(deferred.inMyDay).toBe(false);
    expect(deferred.dueDate).toBeDefined();
  });
});
