import { addRef, dayRefTitle, decodeRef, encodeRef, MAX_REFS, refRoute, type ChatRef } from '../refs';

const note = (id: string): ChatRef => ({ kind: 'note', id, title: `Note ${id}` });

describe('chat refs', () => {
  it('round-trips through the attach route param', () => {
    const ref: ChatRef = { kind: 'pattern', id: 'opt_a|opt_b|1', title: 'Dairy → Bloating' };
    expect(decodeRef(encodeRef(ref))).toEqual(ref);
  });

  it('rejects broken or unknown params, and fills a missing title', () => {
    expect(decodeRef(undefined)).toBeNull();
    expect(decodeRef('not json')).toBeNull();
    expect(decodeRef(JSON.stringify({ kind: 'wallet', id: '1' }))).toBeNull();
    expect(decodeRef(JSON.stringify({ kind: 'note', id: '' }))).toBeNull();
    expect(decodeRef(JSON.stringify({ kind: 'record', id: 'r1' }))).toEqual({ kind: 'record', id: 'r1', title: 'Health record' });
  });

  it('adds without duplicates, up to the limits', () => {
    let refs: ChatRef[] = [];
    refs = addRef(refs, note('1'));
    expect(addRef(refs, note('1'))).toBe(refs);
    for (let i = 2; i <= MAX_REFS + 2; i++) refs = addRef(refs, note(String(i)));
    expect(refs).toHaveLength(MAX_REFS);
    const files = addRef(addRef([], { kind: 'file', id: 'f1', title: 'a.pdf' }), { kind: 'file', id: 'f2', title: 'b.pdf' });
    expect(addRef(files, { kind: 'file', id: 'f3', title: 'c.pdf' })).toBe(files);
  });

  it('opens each kind on its own screen', () => {
    expect(refRoute({ kind: 'day', id: '2026-11-17' })).toBe('/(tabs)/timeline?date=2026-11-17');
    expect(refRoute({ kind: 'note', id: 'n1' })).toBe('/notes/n1');
    expect(refRoute({ kind: 'task', id: 't1' })).toBe('/todo/task/t1');
    expect(refRoute({ kind: 'list', id: 'l1' })).toBe('/todo/list/l1');
    expect(refRoute({ kind: 'record', id: 'r1' })).toBe('/records/r1');
    expect(refRoute({ kind: 'file', id: 'f1' })).toBeNull();
  });

  it('titles a day like the rest of the app', () => {
    expect(dayRefTitle('2026-11-17', '2026-11-19')).toBe('Tue, 17 Nov');
    expect(dayRefTitle('2025-12-31', '2026-11-19')).toBe('Wed, 31 Dec 2025');
  });
});
