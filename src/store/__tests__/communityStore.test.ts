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
      if (url.includes('/community/users/') && url.includes('/popout')) {
        return Promise.resolve({
          userId: 'user_777',
          displayName: 'Sarah_POTS',
          avatarEmoji: '🌟',
          bannerGradient: ['#38BDF8', '#818CF8'],
          bio: 'Pacing navigator',
          energyStatus: 'Pacing & Resting 🥄',
          conditionTags: ['POTS', 'Dysautonomia'],
          roleBadges: ['POTS Veteran'],
          roleColor: '#38BDF8',
          stats: { sharedNotesCount: 5, sharedTodosCount: 2, totalClones: 35 },
        });
      }
      if (url.includes('/community/servers') && !url.includes('/channels')) {
        return Promise.resolve([
          {
            _id: 'server_lumen_hub',
            name: 'Lumen Spoonie Hub',
            slug: 'lumen-spoonie-hub',
            description: 'Official global community',
            icon: '🫀',
            color: '#38BDF8',
            conditionTags: ['All Conditions'],
            isPrivate: false,
            inviteCode: 'LUMEN1',
            ownerId: 'admin',
            membersCount: 1420,
            isOfficial: true,
            isMember: true,
            createdAt: '2026-01-01',
          },
        ]);
      }
      return Promise.resolve([]);
    }),
    post: jest.fn().mockImplementation((url: string, body: any) => {
      if (url.includes('/messages/') && url.includes('/react')) {
        return Promise.resolve({ success: true, ...body });
      }
      if (url.includes('/community/servers/join')) {
        return Promise.resolve({
          _id: 'server_eds_guild',
          name: 'EDS Zebra Guild',
          slug: 'eds-zebra-guild',
          description: 'Hypermobility support',
          icon: '🦓',
          color: '#10B981',
          conditionTags: ['EDS'],
          isPrivate: true,
          inviteCode: body.inviteCode || 'ZEBR7X',
          ownerId: 'creator_1',
          membersCount: 15,
          isOfficial: false,
          isMember: true,
          createdAt: '2026-02-01',
        });
      }
      if (url.includes('/community/servers') && !url.includes('/channels')) {
        return Promise.resolve({
          _id: 'server_custom_123',
          ...body,
          slug: 'custom-community',
          inviteCode: 'NEW999',
          ownerId: 'me',
          membersCount: 1,
          isOfficial: false,
          isMember: true,
          createdAt: new Date().toISOString(),
        });
      }
      if (url.includes('/channels')) {
        return Promise.resolve({
          _id: 'chan_custom_555',
          ...body,
          slug: `${body.name}-slug`,
          memberCount: 1,
          messageCount: 0,
          isFeatured: false,
          createdAt: new Date().toISOString(),
        });
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

  it('manages Discord inline reply state and sends message with replyTo quote', async () => {
    useCommunityStore.getState().setReplyingTo({
      messageId: 'parent_999',
      senderDisplayName: 'Alex_MECFS',
      snippet: 'Does anyone react to compression gear?',
    });

    expect(useCommunityStore.getState().replyingTo).toBeDefined();
    expect(useCommunityStore.getState().replyingTo?.senderDisplayName).toBe('Alex_MECFS');

    const replyMsg = await useCommunityStore
      .getState()
      .sendMessage('chan_pots', 'Yes, check out silicone-free bands!');

    expect(replyMsg.replyTo?.senderDisplayName).toBe('Alex_MECFS');
    // Once sent, draft replying state resets
    expect(useCommunityStore.getState().replyingTo).toBeNull();
  });

  it('toggles Discord category collapse state', () => {
    expect(useCommunityStore.getState().collapsedCategories['CONDITION HUBS']).toBeFalsy();
    useCommunityStore.getState().toggleCategoryCollapsed('CONDITION HUBS');
    expect(useCommunityStore.getState().collapsedCategories['CONDITION HUBS']).toBe(true);
    useCommunityStore.getState().toggleCategoryCollapsed('CONDITION HUBS');
    expect(useCommunityStore.getState().collapsedCategories['CONDITION HUBS']).toBe(false);
  });

  it('fetches Discord profile popout for a Spoonie user', async () => {
    const profile = await useCommunityStore.getState().fetchUserPopout('user_777');
    expect(profile).toBeDefined();
    expect(profile?.displayName).toBeDefined();
    expect(profile?.roleBadges.length).toBeGreaterThan(0);
    expect(useCommunityStore.getState().popoutUser).toBeDefined();

    useCommunityStore.getState().clearUserPopout();
    expect(useCommunityStore.getState().popoutUser).toBeNull();
  });

  it('creates and manages Discord forum health story posts', async () => {
    const post = await useCommunityStore.getState().createForumPost(
      'chan_recovery',
      'How LDN changed my heart rate spikes',
      ['POTS', 'LDN'],
      'Here is my protocol story...'
    );

    expect(post).toBeDefined();
    expect(post.title).toBe('How LDN changed my heart rate spikes');
    expect(useCommunityStore.getState().forumPosts.length).toBeGreaterThan(0);
  });

  it('fetches community servers and creates a custom Community Server', async () => {
    await useCommunityStore.getState().fetchServers();
    expect(useCommunityStore.getState().servers.length).toBeGreaterThan(0);
    expect(useCommunityStore.getState().activeServer?._id).toBe('server_lumen_hub');

    const newServer = await useCommunityStore.getState().createServer({
      name: 'POTS & Dysautonomia Lounge',
      description: 'Orthostatic intolerance and salt pacing',
      icon: '🫀',
      color: '#38BDF8',
      conditionTags: ['POTS'],
      isPrivate: false,
    });

    expect(newServer).toBeDefined();
    expect(newServer.name).toBe('POTS & Dysautonomia Lounge');
    expect(useCommunityStore.getState().activeServer?._id).toBe(newServer._id);
  });

  it('joins a private Community Server using an invite code', async () => {
    const joinedServer = await useCommunityStore.getState().joinServer('ZEBR7X');
    expect(joinedServer).toBeDefined();
    expect(joinedServer.name).toBe('EDS Zebra Guild');
    expect(joinedServer.isPrivate).toBe(true);
    expect(useCommunityStore.getState().activeServer?._id).toBe('server_eds_guild');
  });

  it('creates a custom channel within an active Community Server', async () => {
    const channel = await useCommunityStore.getState().createChannel('server_eds_guild', {
      name: 'mobility-aids',
      topic: 'Wheelchairs, rollators, and braces recommendations',
      category: 'RESOURCE EXCHANGE',
      type: 'text',
      icon: '🦯',
      color: '#10B981',
      order: 1,
    });

    expect(channel).toBeDefined();
    expect(channel.name).toBe('mobility-aids');
    expect(useCommunityStore.getState().channels).toContainEqual(channel);
  });
});


