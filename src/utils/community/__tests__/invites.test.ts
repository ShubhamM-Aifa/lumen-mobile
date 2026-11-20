import { extractInviteCode, groupCandidates, groupSubtitle, inviteShareText, parsePeopleQuery, validHandle } from '../invites';

describe('invite links and @names', () => {
  const code = 'abcdefghjk23';

  it('pulls a code out of a pasted link or reads a bare code', () => {
    expect(extractInviteCode(`lumen://community/invite/${code}`)).toBe(code);
    expect(extractInviteCode(`  Lumen://Community/Invite/${code.toUpperCase()}/ `)).toBe(code);
    expect(extractInviteCode(code)).toBe(code);
    expect(extractInviteCode('lumen://community/invite/short')).toBeNull();
    expect(extractInviteCode('hello there')).toBeNull();
    expect(extractInviteCode(null)).toBeNull();
  });

  it('tells apart a link, an @name, a plain name and nothing', () => {
    expect(parsePeopleQuery(`lumen://community/invite/${code}`)).toEqual({ kind: 'invite', code });
    expect(parsePeopleQuery('@Sam_K')).toEqual({ kind: 'handle', handle: 'sam_k' });
    expect(parsePeopleQuery('@x')).toEqual({ kind: 'empty' });
    expect(parsePeopleQuery('Priya')).toEqual({ kind: 'name', text: 'Priya' });
    expect(parsePeopleQuery('P')).toEqual({ kind: 'empty' });
    expect(parsePeopleQuery('   ')).toEqual({ kind: 'empty' });
  });

  it('checks an @name the same way the server does', () => {
    expect(validHandle('@Sam_K')).toEqual({ ok: true, handle: 'sam_k' });
    expect(validHandle('no spaces').ok).toBe(false);
    expect(validHandle('ab').ok).toBe(false);
  });

  it('words the share message with the link, and the @name when there is one', () => {
    expect(inviteShareText(`lumen://community/invite/${code}`, null)).toBe(`Message me on Lumen: lumen://community/invite/${code}`);
    expect(inviteShareText('lumen://x', 'sam_k')).toContain('@sam_k');
  });
});

describe('groups', () => {
  const dm = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ type: 'dm', dmStatus: 'accepted', dmUser: { _id: id, displayName: name }, ...extra });

  it('only offers people from accepted one-on-one chats, once each, sorted', () => {
    const list = groupCandidates([
      dm('u2', 'Priya'),
      dm('u1', 'Ali'),
      dm('u3', 'Pending Pat', { dmStatus: 'pending' }),
      dm('u4', 'Declined Dee', { dmStatus: 'declined' }),
      dm('u5', 'A group', { isGroup: true }),
      { type: 'text', dmUser: null },
      dm('u1', 'Ali again'),
      { type: 'dm', dmUser: { _id: 'u6', displayName: 'Old chat' } }, // from before requests existed: counts as accepted
    ]);
    expect(list.map(p => p.displayName)).toEqual(['Ali', 'Old chat', 'Priya']);
  });

  it('describes who is in a group without listing everyone', () => {
    const m = (n: string, isMe = false) => ({ displayName: n, isMe });
    expect(groupSubtitle([m('Me', true), m('Sam'), m('Priya')])).toBe('Sam, Priya · 3 people');
    expect(groupSubtitle([m('Me', true), m('A'), m('B'), m('C'), m('D'), m('E')])).toBe('A, B, C and 2 more · 6 people');
    expect(groupSubtitle([m('Me', true)])).toBe('Just you');
    expect(groupSubtitle(undefined)).toBe('Group chat');
  });
});
