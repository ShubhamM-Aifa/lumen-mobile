import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  INote,
  INoteBlock,
  INoteTreeNode,
  INoteBreadcrumb,
  NoteBlockType,
  IDatabaseConfig,
} from '../shared/types';
import {
  blocksToDoc,
  docToPlainText,
  extractLinks,
  emptyDoc,
} from '../shared/notes/docUtils';
import { api } from '../api/client';
import { newObjectId } from '../utils/todo/objectId';
import {
  enqueueNotesWrite,
  flushNotesOutbox,
  getNotesPendingCount,
  loadNotesOutbox,
} from '../services/notes/outbox';

const NOTES_CACHE_KEY = 'lumen:notes:cache_v1';
const NOTES_TREE_CACHE_KEY = 'lumen:notes_tree:cache_v1';
const NOTE_DOC_CACHE_PREFIX = 'lumen:note:';
const NOTES_TEMPLATES_CACHE_KEY = 'lumen:notes_templates:cache_v1';

export interface NoteTemplate {
  key: string;
  title: string;
  icon: string;
  coverGradient: string;
  tags: string[];
  description: string;
  blocks: INoteBlock[];
  doc?: Record<string, unknown>;
}

export const FALLBACK_TEMPLATES: NoteTemplate[] = [
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
      {
        id: 'm5', type: 'toggle', content: 'Week 1 Observations', isCollapsed: false, children: [
          { id: 'm5_1', type: 'bullet_list', content: 'Mild nausea on days 1-2, resolved by day 4' },
          { id: 'm5_2', type: 'bullet_list', content: 'Noticeable reduction in brain fog around 2 PM' },
        ]
      },
      { id: 'm6', type: 'heading_2', content: '3. Efficacy Verdict' },
      { id: 'm7', type: 'paragraph', content: 'To be evaluated with physician at 30-day mark.' },
    ],
  },
];

export const PREBUILT_TEMPLATES = FALLBACK_TEMPLATES;

export interface TrashedNoteSummary {
  _id: string;
  title: string;
  icon?: string;
  deletedAt?: string;
  trashRootId?: string;
  kind?: string;
}

export interface NoteSearchHit {
  _id: string;
  title: string;
  icon?: string;
  kind?: string;
  updatedAt?: string;
  snippet?: string;
}

export interface ActiveNoteDetails extends INote {
  breadcrumbs?: INoteBreadcrumb[];
  subPages?: any[];
  backlinks?: any[];
}

interface NoteState {
  tree: INoteTreeNode[];
  notes: INote[];
  activeNote: ActiveNoteDetails | null;
  trash: TrashedNoteSummary[];
  templates: NoteTemplate[];
  searchResults: NoteSearchHit[];
  selectedTag: string | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchTree: () => Promise<void>;
  fetchNotes: () => Promise<void>;
  fetchNoteById: (id: string) => Promise<ActiveNoteDetails | null>;
  createNote: (input?: Partial<INote>) => Promise<INote>;
  createFromTemplate: (templateKey: string, parentNoteId?: string) => Promise<INote>;
  updateNote: (id: string, updates: Partial<INote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  moveNote: (id: string, parentNoteId: string | null, sortOrder?: number) => Promise<void>;
  duplicateNote: (id: string) => Promise<INote | null>;
  togglePin: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  setSelectedTag: (tag: string | null) => void;
  setSearchQuery: (query: string) => void;
  setActiveNote: (note: ActiveNoteDetails | null) => void;

  // Trash actions
  fetchTrash: () => Promise<void>;
  restoreFromTrash: (id: string) => Promise<void>;
  permanentlyDelete: (id: string) => Promise<void>;

  // Search
  searchNotes: (query: string) => Promise<void>;

  // Templates
  fetchTemplates: () => Promise<void>;

  // Legacy Block level operations (compatibility)
  addBlock: (noteId: string, type: NoteBlockType, afterBlockId?: string, initialContent?: string) => Promise<void>;
  updateBlock: (noteId: string, blockId: string, updates: Partial<INoteBlock>) => Promise<void>;
  deleteBlock: (noteId: string, blockId: string) => Promise<void>;
  toggleTodoBlock: (noteId: string, blockId: string) => Promise<void>;
  toggleBlockCollapse: (noteId: string, blockId: string) => Promise<void>;

  // Health context linking
  toggleHealthLink: (noteId: string, type: 'symptom' | 'medication', targetId: string) => Promise<void>;
}

let mutations = 0;

export const useNoteStore = create<NoteState>((set, get) => ({
  tree: [],
  notes: [],
  activeNote: null,
  trash: [],
  templates: FALLBACK_TEMPLATES,
  searchResults: [],
  selectedTag: null,
  searchQuery: '',
  isLoading: false,
  error: null,

  fetchTree: async () => {
    // 1. Fast cache hydrate
    try {
      const cached = await AsyncStorage.getItem(NOTES_TREE_CACHE_KEY);
      if (cached) {
        set({ tree: JSON.parse(cached) });
      }
    } catch { }

    // Flush pending changes before reading
    await loadNotesOutbox();
    await flushNotesOutbox();

    // Overwrite guard: never let remote fetch replace pending un-flushed writes
    if (mutations > 0 || getNotesPendingCount() > 0) return;

    try {
      const res = await api.get<INoteTreeNode[]>('/notes/tree');
      const tree = Array.isArray(res) ? res : (res as any)?.data || [];
      set({ tree });
      AsyncStorage.setItem(NOTES_TREE_CACHE_KEY, JSON.stringify(tree)).catch(() => { });
    } catch (err) {
      console.warn('[noteStore] fetchTree error, using cached:', err);
    }
  },

  fetchNotes: async () => {
    set({ isLoading: true, error: null });

    // 1. Fast cache hydrate
    try {
      const cached = await AsyncStorage.getItem(NOTES_CACHE_KEY);
      if (cached) {
        set({ notes: JSON.parse(cached) });
      }
    } catch { }

    // 2. Fetch from backend
    try {
      const res = await api.get<INote[]>('/notes');
        const serverNotes: INote[] = Array.isArray(res) ? res : (res as any)?.data || [];
        set({ notes: serverNotes, isLoading: false });
        AsyncStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(serverNotes)).catch(() => { });

        // Derive tree from notes if tree is empty
        if (get().tree.length === 0) {
          const treeNodes: INoteTreeNode[] = serverNotes.map((n) => ({
            _id: n._id,
            title: n.title,
            icon: n.icon,
            parentNoteId: n.parentNoteId,
            sortOrder: n.sortOrder ?? 0,
            kind: n.kind || 'page',
            isFavorite: Boolean(n.isFavorite),
            isPinned: Boolean(n.isPinned),
            updatedAt: n.updatedAt,
          }));
          set({ tree: treeNodes });
          AsyncStorage.setItem(NOTES_TREE_CACHE_KEY, JSON.stringify(treeNodes)).catch(() => { });
        }
      } catch (err) {
        set({ isLoading: false, error: 'Could not fetch notes' });
      }
    },

    fetchNoteById: async (id: string) => {
        // 1. Check if activeNote already matches
        const current = get().activeNote;
        if (current && current._id === id) {
          return current;
        }

        // 2. Fast cache hydrate from individual note cache or notes list
        try {
            const raw = await AsyncStorage.getItem(NOTE_DOC_CACHE_PREFIX + id);
            if (raw) {
              const parsed = JSON.parse(raw);
              set({ activeNote: parsed });
            } else {
              const found = get().notes.find((n) => n._id === id);
              if (found) {
                set({ activeNote: found as ActiveNoteDetails });
              }
            }
          } catch { }

          // 3. Fetch from server
          try {
            const res = await api.get<any>(`/notes/${id}`);
            const data = res?.data || res;
            if (data && data._id) {
              // Ensure doc exists
              if (!data.doc && Array.isArray(data.blocks) && data.blocks.length > 0) {
                data.doc = blocksToDoc(data.blocks);
              }
              set({ activeNote: data });
              AsyncStorage.setItem(NOTE_DOC_CACHE_PREFIX + id, JSON.stringify(data)).catch(() => { });
              return data;
            }
          } catch (err) {
            console.warn(`[noteStore] fetchNoteById(${id}) network error:`, err);
          }

          return get().activeNote;
        },

              createNote: async (input) => {
                mutations++;
                const noteId = input?._id || newObjectId();
                const title = input?.title !== undefined ? input.title : 'Untitled Note';
                const icon = input?.icon || '📝';
                const kind = input?.kind || 'page';
                const sortOrder = typeof input?.sortOrder === 'number' ? input.sortOrder : Date.now();
                const coverGradient = input?.coverGradient || 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)';

                let initialDoc = input?.doc;
                let initialBlocks = input?.blocks;

                if (!initialDoc) {
                  if (Array.isArray(initialBlocks) && initialBlocks.length > 0) {
                    initialDoc = blocksToDoc(initialBlocks);
                  } else {
                    initialDoc = emptyDoc();
                  }
                }

                if (!initialBlocks || initialBlocks.length === 0) {
                  initialBlocks = [
                    {
                      id: `b_${Date.now()}_1`,
                      type: 'paragraph',
                      content: '',
                    },
      ];
          }

          const plainText = docToPlainText(initialDoc);
          const { noteIds, mediaIds } = extractLinks(initialDoc);

          const newNote: ActiveNoteDetails = {
            _id: noteId,
            userId: '',
            title,
            icon,
            coverGradient,
            coverMediaId: input?.coverMediaId,
            doc: initialDoc,
            plainText,
            kind,
            sortOrder,
            isFavorite: Boolean(input?.isFavorite),
            isPinned: Boolean(input?.isPinned),
            deletedAt: null,
            trashRootId: null,
            linkedNoteIds: noteIds,
            mediaIds,
            database: input?.database,
            rowProps: input?.rowProps,
            blocks: initialBlocks,
            parentNoteId: input?.parentNoteId,
            isArchived: false,
            tags: input?.tags || [],
            linkedSymptomIds: input?.linkedSymptomIds || [],
            linkedMedicationIds: input?.linkedMedicationIds || [],
            linkedLogEntryIds: input?.linkedLogEntryIds || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            breadcrumbs: [],
            subPages: [],
            backlinks: [],
          };

          // Optimistic update of local states
          const updatedNotes = [newNote, ...get().notes];
          const newTreeNode: INoteTreeNode = {
            _id: noteId,
            title,
            icon,
            parentNoteId: newNote.parentNoteId,
            sortOrder,
            kind,
            isFavorite: Boolean(newNote.isFavorite),
            isPinned: Boolean(newNote.isPinned),
            updatedAt: newNote.updatedAt,
          };
          const updatedTree = [newTreeNode, ...get().tree];

            set({
              notes: updatedNotes,
              tree: updatedTree,
              activeNote: newNote,
            });

          // Save caches
          AsyncStorage.setItem(NOTE_DOC_CACHE_PREFIX + noteId, JSON.stringify(newNote)).catch(() => { });
          AsyncStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(updatedNotes)).catch(() => { });
          AsyncStorage.setItem(NOTES_TREE_CACHE_KEY, JSON.stringify(updatedTree)).catch(() => { });

          // Enqueue write to outbox
          const payload = {
            _id: noteId,
            title: newNote.title,
            icon: newNote.icon,
            coverGradient: newNote.coverGradient,
            coverMediaId: newNote.coverMediaId,
            doc: newNote.doc,
            plainText: newNote.plainText,
            kind: newNote.kind,
            sortOrder: newNote.sortOrder,
            isFavorite: Boolean(newNote.isFavorite),
            isPinned: Boolean(newNote.isPinned),
            parentNoteId: newNote.parentNoteId,
            tags: newNote.tags,
            database: newNote.database,
            rowProps: newNote.rowProps,
            blocks: newNote.blocks,
          };

          await enqueueNotesWrite('POST', '/notes', payload);
          mutations--;
          return newNote;
        },

            createFromTemplate: async (templateKey: string, parentNoteId?: string) => {
              let template = get().templates.find((t) => t.key === templateKey);
              if (!template) {
                template = FALLBACK_TEMPLATES.find((t) => t.key === templateKey);
              }
              if (!template) {
                throw new Error(`Template not found: ${templateKey}`);
              }

              const doc = template.doc || blocksToDoc(template.blocks);
              return get().createNote({
                title: template.title,
                icon: template.icon,
                coverGradient: template.coverGradient,
                tags: template.tags,
                doc,
                blocks: template.blocks,
                parentNoteId,
              });
            },

              updateNote: async (id: string, updates: Partial<INote>) => {
                mutations++;

                // Re-derive plainText and links if doc changed
                const derivedUpdates: Partial<INote> = { ...updates, updatedAt: new Date().toISOString() };
                if (updates.doc) {
                  derivedUpdates.plainText = docToPlainText(updates.doc);
                  const { noteIds, mediaIds } = extractLinks(updates.doc);
                  derivedUpdates.linkedNoteIds = noteIds;
                  derivedUpdates.mediaIds = mediaIds;
                }

                // 1. Optimistic update of activeNote
                const active = get().activeNote;
                let nextActive: ActiveNoteDetails | null = active;
                if (active && active._id === id) {
                  nextActive = { ...active, ...derivedUpdates };
                  set({ activeNote: nextActive });
                  AsyncStorage.setItem(NOTE_DOC_CACHE_PREFIX + id, JSON.stringify(nextActive)).catch(() => { });
                }

                // 2. Optimistic update of notes list
                const updatedNotes = get().notes.map((n) => (n._id === id ? { ...n, ...derivedUpdates } : n));
                set({ notes: updatedNotes });
                AsyncStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(updatedNotes)).catch(() => { });

                // 3. Optimistic update of tree
                if (
                  updates.title !== undefined ||
                  updates.icon !== undefined ||
                  updates.parentNoteId !== undefined ||
                  updates.sortOrder !== undefined ||
                  updates.isFavorite !== undefined ||
                  updates.isPinned !== undefined ||
                  updates.kind !== undefined
                ) {
                  const updatedTree = get().tree.map((node) => {
                    if (node._id === id) {
                      return {
                        ...node,
                        title: updates.title !== undefined ? updates.title : node.title,
                        icon: updates.icon !== undefined ? updates.icon : node.icon,
                        parentNoteId: updates.parentNoteId !== undefined ? updates.parentNoteId : node.parentNoteId,
                        sortOrder: updates.sortOrder !== undefined ? updates.sortOrder : node.sortOrder,
                        isFavorite: updates.isFavorite !== undefined ? updates.isFavorite : node.isFavorite,
                        isPinned: updates.isPinned !== undefined ? updates.isPinned : node.isPinned,
                        kind: (updates.kind as any) || node.kind,
                        updatedAt: derivedUpdates.updatedAt!,
                      };
                    }
                    return node;
                  });
                  set({ tree: updatedTree });
                  AsyncStorage.setItem(NOTES_TREE_CACHE_KEY, JSON.stringify(updatedTree)).catch(() => { });
                }

                // 4. Outbox
                await enqueueNotesWrite('PATCH', `/notes/${id}`, derivedUpdates);
                mutations--;
              },

                deleteNote: async (id: string) => {
                  mutations++;

                  // Optimistically remove from tree and notes
                  const updatedTree = get().tree.filter((t) => t._id !== id && t.parentNoteId !== id);
                  const updatedNotes = get().notes.filter((n) => n._id !== id);
                  set({
                    tree: updatedTree,
                    notes: updatedNotes,
                    activeNote: get().activeNote?._id === id ? null : get().activeNote,
                  });

                  AsyncStorage.setItem(NOTES_TREE_CACHE_KEY, JSON.stringify(updatedTree)).catch(() => { });
                  AsyncStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(updatedNotes)).catch(() => { });
                  AsyncStorage.removeItem(NOTE_DOC_CACHE_PREFIX + id).catch(() => { });

                  await enqueueNotesWrite('DELETE', `/notes/${id}`);
                  mutations--;
                },

                  moveNote: async (id: string, parentNoteId: string | null, sortOrder?: number) => {
                    mutations++;
                    const updatedTree = get().tree.map((n) => {
                      if (n._id === id) {
                        return {
                          ...n,
                          parentNoteId: parentNoteId ?? undefined,
                          sortOrder: typeof sortOrder === 'number' ? sortOrder : n.sortOrder,
                          updatedAt: new Date().toISOString(),
                        };
                      }
                      return n;
                    });
                    set({ tree: updatedTree });
                    AsyncStorage.setItem(NOTES_TREE_CACHE_KEY, JSON.stringify(updatedTree)).catch(() => { });

                    const active = get().activeNote;
                    if (active && active._id === id) {
                      set({ activeNote: { ...active, parentNoteId: parentNoteId ?? undefined } });
                    }

                    await enqueueNotesWrite('POST', `/notes/${id}/move`, { parentNoteId, sortOrder });
                    mutations--;
                  },

                    duplicateNote: async (id: string) => {
                      try {
                      const res = await api.post<any>(`/notes/${id}/duplicate`, {});
                      const duplicated = res?.data || res;
                      if (duplicated && duplicated._id) {
                        await get().fetchTree();
                        return duplicated;
                      }
                    } catch (err) {
                      console.warn('[noteStore] duplicateNote error:', err);
                    }
            return null;
          },

            togglePin: async (id: string) => {
              const note = get().notes.find((n) => n._id === id) || (get().activeNote?._id === id ? get().activeNote : null);
              const isPinned = note ? !note.isPinned : true;
              await get().updateNote(id, { isPinned });
            },

                toggleFavorite: async (id: string) => {
                  const node = get().tree.find((n) => n._id === id);
                  const isFavorite = node ? !node.isFavorite : true;
                  await get().updateNote(id, { isFavorite });
                },

                    setSelectedTag: (tag) => set({ selectedTag: tag }),
                      setSearchQuery: (query) => set({ searchQuery: query }),
                        setActiveNote: (note) => set({ activeNote: note }),

                          fetchTrash: async () => {
                            try {
                              const res = await api.get<any>('/notes/trash');
                              const items = Array.isArray(res) ? res : res?.data || [];
                              set({ trash: items });
                            } catch (err) {
                              console.warn('[noteStore] fetchTrash error:', err);
                            }
                          },

                              restoreFromTrash: async (id: string) => {
                                try {
                                  await api.post(`/notes/${id}/restore`, {});
                                  set({ trash: get().trash.filter((t) => t._id !== id) });
                                  await get().fetchTree();
                                } catch (err) {
                                  console.warn('[noteStore] restoreFromTrash error:', err);
                                }
                              },

                                permanentlyDelete: async (id: string) => {
                                  try {
                                    await api.delete(`/notes/${id}/permanent`);
                                    set({ trash: get().trash.filter((t) => t._id !== id) });
                                  } catch (err) {
                                    console.warn('[noteStore] permanentlyDelete error:', err);
                                  }
                                },

                                  searchNotes: async (query: string) => {
                                    const q = query.trim();
                                    set({ searchQuery: q });
                                    if (!q) {
                                      set({ searchResults: [] });
                                      return;
                                    }

                                    try {
                                      const res = await api.get<any>(`/notes/search?q=${encodeURIComponent(q)}`);
                                      const hits = Array.isArray(res) ? res : res?.data || [];
                                      set({ searchResults: hits });
                                    } catch {
                                      // Offline fallback: search title in tree
                                      const lower = q.toLowerCase();
                                      const localHits = get().tree
                                        .filter((n) => n.title.toLowerCase().includes(lower))
                                        .map((n) => ({
                                          _id: n._id,
                                          title: n.title,
                                          icon: n.icon,
                                          kind: n.kind,
                                          snippet: n.title,
                                        }));
                                      set({ searchResults: localHits });
                                    }
                                  },

                                    fetchTemplates: async () => {
                                      try {
                                        const cached = await AsyncStorage.getItem(NOTES_TEMPLATES_CACHE_KEY);
                                        if (cached) {
                                          set({ templates: JSON.parse(cached) });
                                        }
                                      } catch { }

                                      try {
                                        const res = await api.get<any>('/notes/templates');
                                        const tmpls = Array.isArray(res) ? res : res?.data || [];
                                        if (tmpls.length > 0) {
                                          set({ templates: tmpls });
                                          AsyncStorage.setItem(NOTES_TEMPLATES_CACHE_KEY, JSON.stringify(tmpls)).catch(() => { });
                                        }
                                      } catch { }
                                    },

                                      // ─────────────────────────────────────────────────────────────
                                      // LEGACY BLOCK LEVEL OPERATIONS (For backwards compatibility)
                                      // ─────────────────────────────────────────────────────────────

                                      addBlock: async (noteId, type, afterBlockId, initialContent = '') => {
                                        const note = get().notes.find((n) => n._id === noteId) || (get().activeNote?._id === noteId ? get().activeNote : null);
                                        if (!note) return;

                                        const newBlock: INoteBlock = {
                                          id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                                          type,
                                          content: initialContent,
                                          completed: type === 'todo' ? false : undefined,
                                        };

                                        let updatedBlocks: INoteBlock[];
                                        if (afterBlockId) {
                                            const index = note.blocks.findIndex((b) => b.id === afterBlockId);
                                            if (index !== -1) {
                                              updatedBlocks = [...note.blocks.slice(0, index + 1), newBlock, ...note.blocks.slice(index + 1)];
                                            } else {
                                              updatedBlocks = [...note.blocks, newBlock];
                                            }
                                          } else {
                                            updatedBlocks = [...note.blocks, newBlock];
                                          }

                                          const doc = blocksToDoc(updatedBlocks);
                                          await get().updateNote(noteId, { blocks: updatedBlocks, doc });
                                        },

                                        updateBlock: async (noteId, blockId, updates) => {
                                          const note = get().notes.find((n) => n._id === noteId) || (get().activeNote?._id === noteId ? get().activeNote : null);
                                          if (!note) return;

                                          const updatedBlocks = note.blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b));
                                          const doc = blocksToDoc(updatedBlocks);
                                          await get().updateNote(noteId, { blocks: updatedBlocks, doc });
                                        },

                                          deleteBlock: async (noteId, blockId) => {
                                            const note = get().notes.find((n) => n._id === noteId) || (get().activeNote?._id === noteId ? get().activeNote : null);
                                            if (!note) return;

                                            const updatedBlocks = note.blocks.filter((b) => b.id !== blockId);
                                            const doc = blocksToDoc(updatedBlocks);
                                            await get().updateNote(noteId, { blocks: updatedBlocks, doc });
                                          },

                                            toggleTodoBlock: async (noteId, blockId) => {
                                              const note = get().notes.find((n) => n._id === noteId) || (get().activeNote?._id === noteId ? get().activeNote : null);
                                              if (!note) return;

                                              const updatedBlocks = note.blocks.map((b) =>
                                                b.id === blockId && b.type === 'todo' ? { ...b, completed: !b.completed } : b
                                              );
                                              const doc = blocksToDoc(updatedBlocks);
                                              await get().updateNote(noteId, { blocks: updatedBlocks, doc });
                                            },

                                              toggleBlockCollapse: async (noteId, blockId) => {
                                                const note = get().notes.find((n) => n._id === noteId) || (get().activeNote?._id === noteId ? get().activeNote : null);
                                                if (!note) return;

                                                const updatedBlocks = note.blocks.map((b) =>
                                                  b.id === blockId ? { ...b, isCollapsed: !b.isCollapsed } : b
                                                );
                                                await get().updateNote(noteId, { blocks: updatedBlocks });
                                              },

                                                toggleHealthLink: async (noteId, type, targetId) => {
                                                  const note = get().notes.find((n) => n._id === noteId) || (get().activeNote?._id === noteId ? get().activeNote : null);
                                                  if (!note) return;

                                                  if (type === 'symptom') {
                                                    const current = note.linkedSymptomIds || [];
                                                    const updated = current.includes(targetId) ? current.filter((id) => id !== targetId) : [...current, targetId];
                                                    await get().updateNote(noteId, { linkedSymptomIds: updated });
                                                  } else {
                                                    const current = note.linkedMedicationIds || [];
                                                    const updated = current.includes(targetId) ? current.filter((id) => id !== targetId) : [...current, targetId];
                                                    await get().updateNote(noteId, { linkedMedicationIds: updated });
                                                  }
                                                },
}));

// Hydrate outbox and templates on startup
loadNotesOutbox().catch(() => { });
useNoteStore.getState().fetchTemplates().catch(() => { });
