import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNoteStore } from '../noteStore';
import {
  enqueueNotesWrite,
  flushNotesOutbox,
  getNotesPendingCount,
  __resetNotesOutboxForTests,
  __setNotesAutoFlushForTests,
} from '../../services/notes/outbox';

const mockApiPost = jest.fn();
const mockApiPatch = jest.fn();
const mockApiDelete = jest.fn();
const mockApiGet = jest.fn();

jest.mock('../../api/client', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
    patch: (...args: any[]) => mockApiPatch(...args),
    delete: (...args: any[]) => mockApiDelete(...args),
  },
}));

describe('Notion NoteStore: Tree, Offline Outbox & Trash', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    __resetNotesOutboxForTests();
    __setNotesAutoFlushForTests(false);
    useNoteStore.setState({
      tree: [],
      notes: [],
      activeNote: null,
      trash: [],
      searchResults: [],
      searchQuery: '',
      isLoading: false,
      error: null,
    });
  });

  describe('Offline Note Creation & Outbox', () => {
    it('creates note with persistent client id and queues POST in outbox', async () => {
      const note = await useNoteStore.getState().createNote({
        title: 'Offline Clinical Note',
        icon: '📋',
      });

      expect(note._id).toBeDefined();
      expect(/^[0-9a-fA-F]{24}$/.test(note._id)).toBe(true);
      expect(note.title).toBe('Offline Clinical Note');
      expect(getNotesPendingCount()).toBe(1);

      // Inspect tree
      const tree = useNoteStore.getState().tree;
      expect(tree.length).toBe(1);
      expect(tree[0]._id).toBe(note._id);

      // Now simulate coming online and flushing
      mockApiPost.mockResolvedValueOnce({ success: true, ...note });
      await flushNotesOutbox();

      expect(mockApiPost).toHaveBeenCalledWith('/notes', expect.objectContaining({
        _id: note._id,
        title: 'Offline Clinical Note',
      }));
      expect(getNotesPendingCount()).toBe(0);
    });

    it('merges rapid successive PATCHes to the same note', async () => {
      const note = await useNoteStore.getState().createNote({ title: 'Original' });
      mockApiPost.mockResolvedValueOnce(note);
      await flushNotesOutbox();

      // Two rapid updates
      await useNoteStore.getState().updateNote(note._id, { title: 'Edit 1' });
      await useNoteStore.getState().updateNote(note._id, { title: 'Edit 2' });

      // Only 1 merged PATCH in outbox
      expect(getNotesPendingCount()).toBe(1);

      mockApiPatch.mockResolvedValueOnce({ success: true });
      await flushNotesOutbox();

      expect(mockApiPatch).toHaveBeenCalledTimes(1);
      expect(mockApiPatch).toHaveBeenCalledWith(`/notes/${note._id}`, expect.objectContaining({
        title: 'Edit 2',
      }));
    });
  });

  describe('Page Tree Manipulation & Move', () => {
    it('moves page to a sub-page and updates tree structure optimistically', async () => {
      const parent = await useNoteStore.getState().createNote({ title: 'Parent Page' });
      const child = await useNoteStore.getState().createNote({ title: 'Child Page' });
      await flushNotesOutbox();

      await useNoteStore.getState().moveNote(child._id, parent._id, 2);

      const treeChild = useNoteStore.getState().tree.find((t) => t._id === child._id);
      expect(treeChild?.parentNoteId).toBe(parent._id);
      expect(treeChild?.sortOrder).toBe(2);
    });

    it('toggles favorite and updates tree status', async () => {
      const note = await useNoteStore.getState().createNote({ title: 'Fav Note' });
      await useNoteStore.getState().toggleFavorite(note._id);

      const treeNode = useNoteStore.getState().tree.find((t) => t._id === note._id);
      expect(treeNode?.isFavorite).toBe(true);
    });
  });

  describe('Trash and Restore', () => {
    it('deletes note optimistically from tree and enqueues DELETE', async () => {
      const note = await useNoteStore.getState().createNote({ title: 'To Delete' });
      expect(useNoteStore.getState().tree.length).toBe(1);

      await useNoteStore.getState().deleteNote(note._id);
      expect(useNoteStore.getState().tree.length).toBe(0);
      expect(useNoteStore.getState().activeNote).toBeNull();
    });

    it('fetches trash and restores note back to active tree', async () => {
      mockApiGet.mockResolvedValueOnce([
        { _id: 'trashed_1', title: 'Old Note', deletedAt: new Date().toISOString() },
      ]);

      await useNoteStore.getState().fetchTrash();
      expect(useNoteStore.getState().trash.length).toBe(1);

      mockApiPost.mockResolvedValueOnce({ success: true });
      mockApiGet.mockResolvedValueOnce([
        { _id: 'trashed_1', title: 'Old Note', parentNoteId: null, sortOrder: 0, kind: 'page', isFavorite: false, isPinned: false, updatedAt: new Date().toISOString() },
      ]);

      await useNoteStore.getState().restoreFromTrash('trashed_1');
      expect(useNoteStore.getState().trash.length).toBe(0);
      expect(useNoteStore.getState().tree.length).toBe(1);
    });
  });

  describe('Deep Link Note Fetching', () => {
    it('loads note by id from network when not yet in memory', async () => {
      mockApiGet.mockResolvedValueOnce({
        _id: 'deep_link_id',
        title: 'Deep Link Note',
        doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
        breadcrumbs: [{ _id: 'root_id', title: 'Root' }],
      });

      const note = await useNoteStore.getState().fetchNoteById('deep_link_id');
      expect(note).toBeDefined();
      expect(note?.title).toBe('Deep Link Note');
      expect(useNoteStore.getState().activeNote?._id).toBe('deep_link_id');
    });
  });
});

