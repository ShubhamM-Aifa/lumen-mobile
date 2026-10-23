import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { INote, INoteBlock, NoteBlockType } from '../shared/types';
import { api } from '../api/client';

const NOTES_CACHE_KEY = 'lumen:notes:cache_v1';

export interface NoteTemplate {
  key: string;
  title: string;
  icon: string;
  coverGradient: string;
  tags: string[];
  description: string;
  blocks: INoteBlock[];
}

export const PREBUILT_TEMPLATES: NoteTemplate[] = [
  {
    key: 'doctor_visit_prep',
    title: 'Clinical Appointment Prep & Debrief',
    icon: '🩺',
    coverGradient: 'linear-gradient(135deg, #0F172A 0%, #0369A1 100%)',
    tags: ['Doctor Visit', 'Clinical', 'Appointment'],
    description: 'Prepare chief complaints, questions, medication review, and record doctor instructions.',
    blocks: [
      {
        id: 'b1',
        type: 'callout',
        content: 'Appointment objective: Review ongoing dysautonomia/fatigue management and lab results.',
        calloutIcon: '💡',
        calloutColor: '#0284C7',
      },
      { id: 'b2', type: 'heading_2', content: '1. Top 3 Issues to Discuss Today' },
      { id: 'b3', type: 'bullet_list', content: 'Recent worsening of orthostatic dizziness in morning hours' },
      { id: 'b4', type: 'bullet_list', content: 'Review blood panel (ferritin, thyroid, B12)' },
      { id: 'b5', type: 'bullet_list', content: 'Discuss prescription dosage adjustment' },
      { id: 'b6', type: 'heading_2', content: '2. Current Medications & Tolerability' },
      { id: 'b7', type: 'quote', content: 'Bring full medication list and recent vitals summary to exam room.' },
      { id: 'b8', type: 'heading_2', content: '3. Clinical Action Items & Plan' },
      { id: 'b9', type: 'todo', content: 'Pick up modified prescription from pharmacy', completed: false },
      { id: 'b10', type: 'todo', content: 'Schedule follow-up appointment in 6 weeks', completed: false },
      { id: 'b11', type: 'todo', content: 'Log morning blood pressure daily for 2 weeks', completed: false },
    ],
  },
  {
    key: 'flare_retrospective',
    title: 'Symptom Flare Analysis & Protocol',
    icon: '⚡',
    coverGradient: 'linear-gradient(135deg, #450A0A 0%, #DC2626 100%)',
    tags: ['Flare', 'PEM', 'Pacing'],
    description: 'Analyze potential triggers, symptom severity, pacing breakdown, and resting recovery plan.',
    blocks: [
      {
        id: 'f1',
        type: 'callout',
        content: 'Active flare protocol: Transition to emergency resting baseline. Cancel non-urgent demands.',
        calloutIcon: '⚠️',
        calloutColor: '#EF4444',
      },
      { id: 'f2', type: 'heading_2', content: '1. Suspected Triggers (24-48h prior)' },
      { id: 'f3', type: 'bullet_list', content: 'Physical exertion: Extended walking / stairs' },
      { id: 'f4', type: 'bullet_list', content: 'Environmental: Weather pressure drop or poor sleep' },
      { id: 'f5', type: 'heading_2', content: '2. Recovery Care Plan' },
      { id: 'f6', type: 'todo', content: 'Aggressive hydration with electrolyte solution (2.5L)', completed: false },
      { id: 'f7', type: 'todo', content: 'Horizontal bed rest with legs elevated', completed: false },
      { id: 'f8', type: 'todo', content: 'Postpone tasks in To Do for 2 days', completed: false },
      { id: 'f9', type: 'heading_2', content: '3. Learnings for Future Pacing' },
      { id: 'f10', type: 'paragraph', content: 'Set an earlier timer when running errands to prevent crossing anaerobic threshold.' },
    ],
  },
  {
    key: 'medication_trial',
    title: 'New Medication & Treatment Trial Log',
    icon: '💊',
    coverGradient: 'linear-gradient(135deg, #1E1B4B 0%, #7C3AED 100%)',
    tags: ['Medication', 'Treatment', 'Trial'],
    description: 'Track side effects, therapeutic response, and titration schedule over weeks.',
    blocks: [
      {
        id: 'm1',
        type: 'callout',
        content: 'Dosage instructions: Take with morning meal. Do not skip doses.',
        calloutIcon: '📋',
        calloutColor: '#8B5CF6',
      },
      { id: 'm2', type: 'heading_2', content: '1. Target Symptoms & Baseline' },
      { id: 'm3', type: 'paragraph', content: 'Goal: Reduce cognitive fatigue and improve resting heart rate stability.' },
      { id: 'm4', type: 'heading_2', content: '2. Weekly Check-In Log' },
      { id: 'm5', type: 'toggle', content: 'Week 1 Observations', isCollapsed: false, children: [
        { id: 'm5_1', type: 'bullet_list', content: 'Mild nausea on days 1-2, resolved by day 4' },
        { id: 'm5_2', type: 'bullet_list', content: 'Noticeable reduction in brain fog around 2 PM' },
      ] },
      { id: 'm6', type: 'heading_2', content: '3. Efficacy Verdict' },
      { id: 'm7', type: 'paragraph', content: 'To be evaluated with physician at 30-day mark.' },
    ],
  },
];

interface NoteState {
  notes: INote[];
  activeNote: INote | null;
  selectedTag: string | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchNotes: () => Promise<void>;
  fetchNoteById: (id: string) => Promise<INote | null>;
  createNote: (input?: Partial<INote>) => Promise<INote>;
  createFromTemplate: (templateKey: string) => Promise<INote>;
  updateNote: (id: string, updates: Partial<INote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  setSelectedTag: (tag: string | null) => void;
  setSearchQuery: (query: string) => void;
  setActiveNote: (note: INote | null) => void;

  // Block level operations
  addBlock: (
    noteId: string,
    type: NoteBlockType,
    afterBlockId?: string,
    initialContent?: string
  ) => Promise<void>;
  updateBlock: (noteId: string, blockId: string, updates: Partial<INoteBlock>) => Promise<void>;
  deleteBlock: (noteId: string, blockId: string) => Promise<void>;
  toggleTodoBlock: (noteId: string, blockId: string) => Promise<void>;
  toggleBlockCollapse: (noteId: string, blockId: string) => Promise<void>;

  // Health context linking
  toggleHealthLink: (
    noteId: string,
    type: 'symptom' | 'medication',
    targetId: string
  ) => Promise<void>;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  activeNote: null,
  selectedTag: null,
  searchQuery: '',
  isLoading: false,
  error: null,

  fetchNotes: async () => {
    set({ isLoading: true, error: null });

    // 1. Fast cache hydrate
    try {
      const cached = await AsyncStorage.getItem(NOTES_CACHE_KEY);
      if (cached) {
        set({ notes: JSON.parse(cached) });
      }
    } catch {}

    // 2. Fetch from backend
    try {
      const res = await api.get<INote[]>('/notes');
      if (res && Array.isArray(res)) {
        set({ notes: res });
        await AsyncStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(res));
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to sync notes' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchNoteById: async (id: string) => {
    // Check in memory first
    const local = get().notes.find((n) => n._id === id);
    if (local) {
      set({ activeNote: local });
    }

    try {
      const res = await api.get<INote>(`/notes/${id}`);
      if (res && res._id) {
        set({ activeNote: res });
        return res;
      }
    } catch {}

    return local || null;
  },

  createNote: async (input = {}) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newNote: INote = {
      _id: tempId,
      userId: '',
      title: input.title !== undefined ? input.title : 'Untitled Note',
      icon: input.icon || '📝',
      coverGradient:
        input.coverGradient || 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
      blocks: input.blocks || [
        {
          id: `b_${Date.now()}`,
          type: 'paragraph',
          content: '',
        },
      ],
      parentNoteId: input.parentNoteId,
      isPinned: input.isPinned || false,
      isArchived: false,
      tags: input.tags || [],
      linkedSymptomIds: input.linkedSymptomIds || [],
      linkedMedicationIds: input.linkedMedicationIds || [],
      linkedLogEntryIds: input.linkedLogEntryIds || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistic insert
    const previous = get().notes;
    const updated = [newNote, ...previous];
    set({ notes: updated, activeNote: newNote });
    await AsyncStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(updated));

    try {
      const serverNote = await api.post<INote>('/notes', {
        title: newNote.title,
        icon: newNote.icon,
        coverGradient: newNote.coverGradient,
        blocks: newNote.blocks,
        parentNoteId: newNote.parentNoteId,
        isPinned: newNote.isPinned,
        tags: newNote.tags,
        linkedSymptomIds: newNote.linkedSymptomIds,
        linkedMedicationIds: newNote.linkedMedicationIds,
      });

      if (serverNote && serverNote._id) {
        const finalized = get().notes.map((n) => (n._id === tempId ? serverNote : n));
        set({ notes: finalized, activeNote: serverNote });
        await AsyncStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(finalized));
        return serverNote;
      }
    } catch {}

    return newNote;
  },

  createFromTemplate: async (templateKey: string) => {
    const template = PREBUILT_TEMPLATES.find((t) => t.key === templateKey);
    if (!template) {
      return get().createNote();
    }

    return get().createNote({
      title: template.title,
      icon: template.icon,
      coverGradient: template.coverGradient,
      tags: [...template.tags],
      blocks: JSON.parse(JSON.stringify(template.blocks)),
    });
  },

  updateNote: async (id: string, updates: Partial<INote>) => {
    const previous = get().notes;
    const updated = previous.map((n) =>
      n._id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
    );

    const active = get().activeNote;
    const updatedActive =
      active && active._id === id
        ? { ...active, ...updates, updatedAt: new Date().toISOString() }
        : active;

    set({ notes: updated, activeNote: updatedActive });
    await AsyncStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(updated));

    try {
      await api.patch(`/notes/${id}`, updates);
    } catch {}
  },

  deleteNote: async (id: string) => {
    const previous = get().notes;
    const updated = previous.filter((n) => n._id !== id);
    set({
      notes: updated,
      activeNote: get().activeNote?._id === id ? null : get().activeNote,
    });
    await AsyncStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(updated));

    try {
      await api.delete(`/notes/${id}`);
    } catch {}
  },

  togglePin: async (id: string) => {
    const note = get().notes.find((n) => n._id === id);
    if (!note) return;
    await get().updateNote(id, { isPinned: !note.isPinned });
  },

  setSelectedTag: (tag: string | null) => {
    set({ selectedTag: tag });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setActiveNote: (note: INote | null) => {
    set({ activeNote: note });
  },

  addBlock: async (noteId, type, afterBlockId, initialContent = '') => {
    const note = get().notes.find((n) => n._id === noteId);
    if (!note) return;

    const newBlock: INoteBlock = {
      id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      content: initialContent,
      completed: type === 'todo' ? false : undefined,
      calloutIcon: type === 'callout' ? '💡' : undefined,
      calloutColor: type === 'callout' ? '#0284C7' : undefined,
      isCollapsed: type === 'toggle' ? false : undefined,
      children: type === 'toggle' ? [] : undefined,
    };

    let updatedBlocks: INoteBlock[];
    if (afterBlockId) {
      const idx = note.blocks.findIndex((b) => b.id === afterBlockId);
      if (idx !== -1) {
        updatedBlocks = [
          ...note.blocks.slice(0, idx + 1),
          newBlock,
          ...note.blocks.slice(idx + 1),
        ];
      } else {
        updatedBlocks = [...note.blocks, newBlock];
      }
    } else {
      updatedBlocks = [...note.blocks, newBlock];
    }

    await get().updateNote(noteId, { blocks: updatedBlocks });
  },

  updateBlock: async (noteId, blockId, updates) => {
    const note = get().notes.find((n) => n._id === noteId);
    if (!note) return;

    const updateBlocksRecursive = (blocks: INoteBlock[]): INoteBlock[] => {
      return blocks.map((b) => {
        if (b.id === blockId) {
          return { ...b, ...updates };
        }
        if (b.children && b.children.length > 0) {
          return { ...b, children: updateBlocksRecursive(b.children) };
        }
        return b;
      });
    };

    const updatedBlocks = updateBlocksRecursive(note.blocks);
    await get().updateNote(noteId, { blocks: updatedBlocks });
  },

  deleteBlock: async (noteId, blockId) => {
    const note = get().notes.find((n) => n._id === noteId);
    if (!note) return;

    const deleteBlockRecursive = (blocks: INoteBlock[]): INoteBlock[] => {
      return blocks
        .filter((b) => b.id !== blockId)
        .map((b) => {
          if (b.children && b.children.length > 0) {
            return { ...b, children: deleteBlockRecursive(b.children) };
          }
          return b;
        });
    };

    const updatedBlocks = deleteBlockRecursive(note.blocks);
    await get().updateNote(noteId, { blocks: updatedBlocks });
  },

  toggleTodoBlock: async (noteId, blockId) => {
    const note = get().notes.find((n) => n._id === noteId);
    if (!note) return;

    const targetBlock = note.blocks.find((b) => b.id === blockId);
    if (!targetBlock) return;

    await get().updateBlock(noteId, blockId, { completed: !targetBlock.completed });
  },

  toggleBlockCollapse: async (noteId, blockId) => {
    const note = get().notes.find((n) => n._id === noteId);
    if (!note) return;

    const targetBlock = note.blocks.find((b) => b.id === blockId);
    if (!targetBlock) return;

    await get().updateBlock(noteId, blockId, { isCollapsed: !targetBlock.isCollapsed });
  },

  toggleHealthLink: async (noteId, type, targetId) => {
    const note = get().notes.find((n) => n._id === noteId);
    if (!note) return;

    if (type === 'symptom') {
      const current = note.linkedSymptomIds || [];
      const updated = current.includes(targetId)
        ? current.filter((id) => id !== targetId)
        : [...current, targetId];
      await get().updateNote(noteId, { linkedSymptomIds: updated });
    } else if (type === 'medication') {
      const current = note.linkedMedicationIds || [];
      const updated = current.includes(targetId)
        ? current.filter((id) => id !== targetId)
        : [...current, targetId];
      await get().updateNote(noteId, { linkedMedicationIds: updated });
    }
  },
}));
