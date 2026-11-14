import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../../api/client', () => ({
  api: {
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import { api } from '../../../api/client';
import { enqueue, flushOutbox, getPendingCount, __resetOutboxForTests, __setAutoFlushForTests, useOutboxStore, OUTBOX_KEY } from '../outbox';

const mockApi = api as unknown as { post: jest.Mock; patch: jest.Mock; delete: jest.Mock };

function apiError(statusCode: number) {
  return Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });
}

describe('todo outbox', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    __resetOutboxForTests();
    __setAutoFlushForTests(false);
    mockApi.post.mockResolvedValue({});
    mockApi.patch.mockResolvedValue({});
    mockApi.delete.mockResolvedValue({});
  });

  it('sends writes in the order they were made', async () => {
    const order: string[] = [];
    mockApi.post.mockImplementation(async (p: string) => { order.push(`POST ${p}`); });
    mockApi.patch.mockImplementation(async (p: string) => { order.push(`PATCH ${p}`); });
    await enqueue('POST', '/tasks', { _id: 'a'.repeat(24), title: 'x' });
    await flushOutbox();
    await enqueue('PATCH', `/tasks/${'a'.repeat(24)}`, { isImportant: true });
    await flushOutbox();
    expect(order).toEqual(['POST /tasks', `PATCH /tasks/${'a'.repeat(24)}`]);
    expect(getPendingCount()).toBe(0);
    expect(JSON.parse((await AsyncStorage.getItem(OUTBOX_KEY)) ?? '[]')).toEqual([]);
  });

  it('keeps a request that failed on the network and retries it later', async () => {
    mockApi.patch.mockRejectedValueOnce(new TypeError('Network request failed'));
    await enqueue('PATCH', '/tasks/abc', { dueDate: null });
    await flushOutbox();
    expect(getPendingCount()).toBe(1);
    expect(useOutboxStore.getState().lastError).toBe('Network request failed');
    // persisted so a restart doesn't lose it
    expect(JSON.parse((await AsyncStorage.getItem(OUTBOX_KEY))!)).toHaveLength(1);

    await flushOutbox();
    expect(mockApi.patch).toHaveBeenCalledTimes(2);
    expect(mockApi.patch).toHaveBeenLastCalledWith('/tasks/abc', { dueDate: null });
    expect(getPendingCount()).toBe(0);
  });

  it('stops at a retryable failure so later requests are not sent out of order', async () => {
    mockApi.post.mockRejectedValueOnce(apiError(503));
    await enqueue('POST', '/tasks', { _id: 'a'.repeat(24), title: 'x' });
    await flushOutbox();
    await enqueue('PATCH', `/tasks/${'a'.repeat(24)}`, { isImportant: true });
    await flushOutbox();
    // the first POST is retried before the PATCH is attempted
    expect(mockApi.post).toHaveBeenCalledTimes(2);
    expect(mockApi.patch).toHaveBeenCalledTimes(1);
    expect(getPendingCount()).toBe(0);
  });

  it('keeps a request on 401, 408, 429 and 5xx', async () => {
    for (const status of [401, 408, 429, 500]) {
      __resetOutboxForTests();
      mockApi.patch.mockRejectedValueOnce(apiError(status));
      await enqueue('PATCH', '/tasks/abc', { title: 'x' });
      await flushOutbox();
      expect(getPendingCount()).toBe(1);
    }
  });

  it('drops a request the server rejects with 400 and continues', async () => {
    mockApi.post.mockRejectedValueOnce(apiError(400));
    await enqueue('POST', '/tasks', { _id: 'b'.repeat(24), title: '' });
    await flushOutbox();
    await enqueue('PATCH', '/tasks/ccc', { title: 'ok' });
    await flushOutbox();
    expect(getPendingCount()).toBe(0);
    expect(mockApi.patch).toHaveBeenCalledWith('/tasks/ccc', { title: 'ok' });
  });

  it('treats 404 on DELETE as done', async () => {
    mockApi.delete.mockRejectedValueOnce(apiError(404));
    await enqueue('DELETE', '/tasks/gone');
    await flushOutbox();
    expect(getPendingCount()).toBe(0);
  });

  it('merges consecutive PATCHes to the same task, later values winning', async () => {
    mockApi.patch.mockRejectedValue(new TypeError('offline'));
    await enqueue('PATCH', '/tasks/abc', { title: 'one', isImportant: true });
    await enqueue('PATCH', '/tasks/abc', { title: 'two', dueDate: null });
    expect(getPendingCount()).toBe(1);
    mockApi.patch.mockResolvedValue({});
    await flushOutbox();
    expect(mockApi.patch).toHaveBeenLastCalledWith('/tasks/abc', { title: 'two', isImportant: true, dueDate: null });
  });

  it('cancels a create and its edits when the task is deleted before it ever synced', async () => {
    const id = 'd'.repeat(24);
    mockApi.post.mockRejectedValue(new TypeError('offline'));
    await enqueue('POST', '/tasks', { _id: id, title: 'x' });
    await enqueue('PATCH', `/tasks/${id}`, { isImportant: true });
    expect(getPendingCount()).toBe(2);
    await enqueue('DELETE', `/tasks/${id}`);
    expect(getPendingCount()).toBe(0);
    expect(mockApi.delete).not.toHaveBeenCalled();
  });

  it('still sends a DELETE for something that reached the server', async () => {
    await enqueue('DELETE', `/tasks/${'e'.repeat(24)}`);
    await flushOutbox();
    expect(mockApi.delete).toHaveBeenCalledWith(`/tasks/${'e'.repeat(24)}`);
  });
});
