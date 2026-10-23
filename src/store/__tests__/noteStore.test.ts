import { useNoteStore } from '../noteStore';

jest.mock('../../api/client', () => ({
  api: {
    get: jest.fn().mockImplementation((url: string) => {
      if (url.includes('/notes/templates')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    }),
    post: jest.fn().mockImplementation((url: string, body: any) =>
      Promise.resolve({ _id: 'server_note_123', ...body })
    ),
    patch: jest.fn().mockImplementation((url: string, body: any) =>
      Promise.resolve({ success: true, ...body })
    ),
    delete: jest.fn().mockResolvedValue({ success: true }),
  },
}));

describe('Notion-style NoteStore with Block Architecture & Health Linking', () => {
  beforeEach(() => {
    useNoteStore.setState({
      notes: [],
      activeNote: null,
      selectedTag: null,
      searchQuery: '',
      isLoading: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  it('creates a note with initial paragraph block', async () => {
    const note = await useNoteStore.getState().createNote({
      title: 'Tilt Table Test Notes',
      icon: '🩺',
    });

    expect(note.title).toBe('Tilt Table Test Notes');
    expect(note.icon).toBe('🩺');
    expect(note.blocks.length).toBe(1);
    expect(useNoteStore.getState().notes.length).toBe(1);
  });

  it('adds and updates various block types (callout, heading, todo)', async () => {
    const note = await useNoteStore.getState().createNote({
      title: 'POTS Protocol',
    });

    // Add a callout block
    await useNoteStore.getState().addBlock(note._id, 'callout', undefined, 'Take electrolytes before standing');
    const updated = useNoteStore.getState().notes[0];
    expect(updated.blocks.length).toBe(2);
    expect(updated.blocks[1].type).toBe('callout');
    expect(updated.blocks[1].content).toBe('Take electrolytes before standing');

    // Update the callout block
    const blockId = updated.blocks[1].id;
    await useNoteStore.getState().updateBlock(note._id, blockId, { content: 'Updated electrolyte protocol' });
    expect(useNoteStore.getState().notes[0].blocks[1].content).toBe('Updated electrolyte protocol');
  });

  it('manages todo blocks and toggles completion', async () => {
    const note = await useNoteStore.getState().createNote({
      title: 'Clinical Follow-ups',
    });

    await useNoteStore.getState().addBlock(note._id, 'todo', undefined, 'Schedule cardiac MRI');
    const todoBlock = useNoteStore.getState().notes[0].blocks[1];
    expect(todoBlock.type).toBe('todo');
    expect(todoBlock.completed).toBe(false);

    await useNoteStore.getState().toggleTodoBlock(note._id, todoBlock.id);
    expect(useNoteStore.getState().notes[0].blocks[1].completed).toBe(true);
  });

  it('instantiates notes from prebuilt clinical templates (Doctor Visit Prep)', async () => {
    const note = await useNoteStore.getState().createFromTemplate('doctor_visit_prep');
    expect(note.title).toBe('Clinical Appointment Prep & Debrief');
    expect(note.icon).toBe('🩺');
    expect(note.blocks.length).toBeGreaterThan(5);
    expect(note.tags).toContain('Doctor Visit');
  });

  it('toggles health linkage for symptoms and medications', async () => {
    const note = await useNoteStore.getState().createNote({
      title: 'Brain Fog Observation',
    });

    await useNoteStore.getState().toggleHealthLink(note._id, 'symptom', 'symptom_brain_fog');
    expect(useNoteStore.getState().notes[0].linkedSymptomIds).toContain('symptom_brain_fog');

    await useNoteStore.getState().toggleHealthLink(note._id, 'medication', 'med_ldn');
    expect(useNoteStore.getState().notes[0].linkedMedicationIds).toContain('med_ldn');

    // Untoggle
    await useNoteStore.getState().toggleHealthLink(note._id, 'symptom', 'symptom_brain_fog');
    expect(useNoteStore.getState().notes[0].linkedSymptomIds).not.toContain('symptom_brain_fog');
  });

  it('allows deleting/updating title to empty string without reverting', async () => {
    const note = await useNoteStore.getState().createNote({
      title: 'Untitled Note',
    });

    expect(note.title).toBe('Untitled Note');

    // User backspaces and clears the entire title to empty string
    await useNoteStore.getState().updateNote(note._id, { title: '' });
    expect(useNoteStore.getState().notes[0].title).toBe('');
    expect(useNoteStore.getState().activeNote?.title).toBe('');
  });
});
