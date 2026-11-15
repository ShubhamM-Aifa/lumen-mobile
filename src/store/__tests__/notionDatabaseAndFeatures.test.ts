import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNoteStore } from '../noteStore';
import {
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

describe('Notion Databases & Features', () => {
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

  describe('Database creation and row management', () => {
    it('creates database page with initial properties and views', async () => {
      const db = await useNoteStore.getState().createNote({
        title: 'Clinical Protocols DB',
        kind: 'database',
        icon: '📊',
        database: {
          properties: [
            { id: 'prop_status', name: 'Status', type: 'select', options: [{ id: 'opt_1', name: 'Active' }] },
            { id: 'prop_priority', name: 'Priority', type: 'select' },
          ],
          views: [{ id: 'view_1', name: 'Table', type: 'table' }],
        },
      });

      expect(db.kind).toBe('database');
      expect(db.database?.properties.length).toBe(2);
      expect(db.database?.views.length).toBe(1);

      // Add a row to this database
      const row = await useNoteStore.getState().createNote({
        parentNoteId: db._id,
        title: 'Migraine Protocol',
        rowProps: { prop_status: 'opt_1' },
      });

      expect(row.parentNoteId).toBe(db._id);
      expect(row.rowProps?.prop_status).toBe('opt_1');
    });

    it('updates rowProps on a database row note', async () => {
      const db = await useNoteStore.getState().createNote({
        title: 'Tasks DB',
        kind: 'database',
      });

      const row = await useNoteStore.getState().createNote({
        parentNoteId: db._id,
        title: 'Row 1',
        rowProps: { status: 'todo' },
      });

      await useNoteStore.getState().updateNote(row._id, {
        rowProps: { status: 'done', completedAt: '2026-11-15' },
      });

      const updated = useNoteStore.getState().notes.find((n) => n._id === row._id);
      expect(updated?.rowProps?.status).toBe('done');
      expect(updated?.rowProps?.completedAt).toBe('2026-11-15');
    });
  });

  describe('Page move and cycle prevention', () => {
    it('moves a note to a new parent note', async () => {
      const parent1 = await useNoteStore.getState().createNote({ title: 'Folder 1' });
      const parent2 = await useNoteStore.getState().createNote({ title: 'Folder 2' });
      const child = await useNoteStore.getState().createNote({
        title: 'Document',
        parentNoteId: parent1._id,
      });

      expect(child.parentNoteId).toBe(parent1._id);

      mockApiPost.mockResolvedValueOnce({
        success: true,
        note: { ...child, parentNoteId: parent2._id },
      });

      await useNoteStore.getState().moveNote(child._id, parent2._id);

      const tree = useNoteStore.getState().tree;
      const childNode = tree.find((t) => t._id === child._id);
      expect(childNode?.parentNoteId).toBe(parent2._id);
    });
  });

  describe('Favorites and Tags', () => {
    it('toggles isFavorite on a note and updates tree', async () => {
      const note = await useNoteStore.getState().createNote({ title: 'Important' });
      expect(note.isFavorite).toBe(false);

      await useNoteStore.getState().toggleFavorite(note._id);

      const inNotes = useNoteStore.getState().notes.find((n) => n._id === note._id);
      const inTree = useNoteStore.getState().tree.find((n) => n._id === note._id);
      expect(inNotes?.isFavorite).toBe(true);
      expect(inTree?.isFavorite).toBe(true);
    });
  });
});

