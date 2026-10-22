import { useCommunityStore } from '../communityStore';
import { useNoteStore } from '../noteStore';
import { useTaskStore } from '../taskStore';

jest.mock('../../api/client', () => ({
  api: {
    get: jest.fn().mockImplementation((url: string) => {
      if (url.includes('/community/channels')) {
        return Promise.resolve([
          {
            _id: 'chan_pots',
            slug: 'pots-dysautonomia',
            name: 'POTS & Dysautonomia',
            icon: '🫀',
            color: '#38BDF8',
            topic: 'Pacing & Hydration',
            memberCount: 142,
            messageCount: 520,
            isFeatured: true,
          },
        ]);
      }
      return Promise.resolve([]);
    }),
    post: jest.fn().mockImplementation((url: string, body: any) => {
      if (url.includes('/messages/') && url.includes('/react')) {
        return Promise.resolve({ success: true, ...body });
      }
      return Promise.resolve({ _id: 'server_msg_999', ...body });
    }),
  },
}));

describe('Community Chat Store: Real-time Messages & 1-Tap Artifact Cloning', () => {
  beforeEach(() => {
    useCommunityStore.setState({
      channels: [],
      activeChannel: null,
      messages: [],
      isAnonymous: false,
      isLoading: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  it('fetches community channels and sets default active channel', async () => {
    await useCommunityStore.getState().fetchChannels();
    const channels = useCommunityStore.getState().channels;
    expect(channels.length).toBe(1);
    expect(channels[0].name).toBe('POTS & Dysautonomia');
    expect(useCommunityStore.getState().activeChannel?._id).toBe('chan_pots');
  });

  it('sends an anonymous spoonie chat message with rich ToDo embed', async () => {
    useCommunityStore.getState().toggleAnonymous();
    expect(useCommunityStore.getState().isAnonymous).toBe(true);

    const msg = await useCommunityStore.getState().sendMessage(
      'chan_pots',
      'Sharing my low-spoon recovery checklist!',
      'todo_list',
      {
        todo: {
          listName: 'Gentle Crash Protocol',
          energyCost: 'gentle',
          tasks: [
            {
              title: 'Elevate legs 15 mins',
              steps: [{ title: 'Put pillow under calves' }],
            },
          ],
        },
      }
    );

    expect(msg.isAnonymous).toBe(true);
    expect(msg.senderDisplayName).toBe('Anonymous Spoonie');
    expect(msg.embedType).toBe('todo_list');
    expect(useCommunityStore.getState().messages.length).toBe(1);
  });

  it('toggles chronic empathy reactions (🥄 Spoon, 🫂 Hug)', async () => {
    const msg = await useCommunityStore.getState().sendMessage(
      'chan_pots',
      'Having a severe flare today.'
    );

    await useCommunityStore.getState().toggleReaction(msg._id, '🥄');
    let currentMsg = useCommunityStore.getState().messages[0];
    expect(currentMsg.reactions['🥄']).toBe(1);
    expect(currentMsg.userReactions).toContain('🥄');

    // Untoggle
    await useCommunityStore.getState().toggleReaction(msg._id, '🥄');
    currentMsg = useCommunityStore.getState().messages[0];
    expect(currentMsg.reactions['🥄']).toBeUndefined();
    expect(currentMsg.userReactions).not.toContain('🥄');
  });

  it('1-tap clones a shared Lumen Note embed directly into personal noteStore', async () => {
    const noteEmbed = {
      title: 'Community Hydration Cheat Sheet',
      icon: '💧',
      coverGradient: 'linear-gradient(135deg, #0F172A 0%, #0369A1 100%)',
      tags: ['Hydration', 'Sodium'],
      blocksPreview: [{ type: 'paragraph', content: 'Drink 2.5L electrolyte daily' }],
      blocksFull: [
        { id: 'b1', type: 'paragraph' as const, content: 'Drink 2.5L electrolyte daily' },
      ],
    };

    await useCommunityStore.getState().cloneNoteToPersonal(noteEmbed, 'msg_123');

    // Verify it was instantiated into noteStore!
    const personalNotes = useNoteStore.getState().notes;
    expect(personalNotes.length).toBeGreaterThan(0);
    const importedNote = personalNotes[0];
    expect(importedNote.title).toBe('Community Hydration Cheat Sheet');
    expect(importedNote.tags).toContain('Community Shared');
  });

  it('1-tap clones a shared Lumen ToDo routine directly into personal taskStore', async () => {
    const todoEmbed = {
      listName: 'PEM Pacing Routine',
      energyCost: 'gentle' as const,
      tasks: [
        {
          title: 'Morning vagus reset',
          steps: [{ title: 'Humming breathing 5m' }],
        },
      ],
    };

    await useCommunityStore.getState().cloneTodoToPersonal(todoEmbed, 'msg_456');

    // Verify task list and tasks exist in taskStore!
    const personalTasks = useTaskStore.getState().tasks;
    expect(personalTasks.length).toBeGreaterThan(0);
    expect(personalTasks[0].title).toBe('Morning vagus reset');
  });
});
