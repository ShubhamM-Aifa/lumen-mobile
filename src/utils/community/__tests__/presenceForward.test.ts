import { presenceText } from '../presence';
import { forwardTargets } from '../../../components/community/ForwardSheet';

describe('online status text', () => {
  const now = new Date(2026, 10, 23, 15, 0, 0);

  it('says online, or last seen today / yesterday / weekday / date', () => {
    expect(presenceText(true, null, now)).toBe('online');
    expect(presenceText(false, new Date(2026, 10, 23, 10, 42).toISOString(), now)).toMatch(/^last seen today at /);
    expect(presenceText(false, new Date(2026, 10, 22, 22, 5).toISOString(), now)).toMatch(/^last seen yesterday at /);
    expect(presenceText(false, new Date(2026, 10, 20, 9, 0).toISOString(), now)).toMatch(/^last seen \w+ at /);
    expect(presenceText(false, new Date(2026, 9, 1, 9, 0).toISOString(), now)).toMatch(/^last seen \S+ \S+$/); // "last seen 1 Oct" or "Oct 1", depending on the phone's language
  });

  it('says nothing when it is hidden or unknown, rather than guessing "offline"', () => {
    expect(presenceText(undefined, '2026-11-23T10:00:00Z', now)).toBeNull();
    expect(presenceText(false, null, now)).toBeNull();
    expect(presenceText(false, 'not a date', now)).toBeNull();
  });
});

describe('forward targets', () => {
  const ch = (over: Record<string, unknown>) => ({ type: 'dm', _id: 'x', name: 'x', ...over }) as any;
  it('offers accepted chats and groups, not requests, not the current chat, not server channels', () => {
    const list = forwardTargets([
      ch({ _id: 'a', dmStatus: 'accepted' }),
      ch({ _id: 'b' }), // older chat from before requests existed
      ch({ _id: 'c', dmStatus: 'pending' }),
      ch({ _id: 'd', dmStatus: 'declined' }),
      ch({ _id: 'e', isGroup: true }),
      ch({ _id: 'f', type: 'text' }),
      ch({ _id: 'here', dmStatus: 'accepted' }),
    ], 'here');
    expect(list.map((c) => c._id)).toEqual(['a', 'b', 'e']);
  });
});
