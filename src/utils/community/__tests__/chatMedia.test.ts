import { voiceNoteMimeType, nextRate } from '../voiceNote';
import { gridRows, messagePhotos, singleSize } from '../photoGrid';
import { tickFor, statusLine, messageInfo, applyReceiptEvent, ReceiptState } from '../receipts';

describe('voice notes', () => {
  it('names the upload type from the recorded file', () => {
    expect(voiceNoteMimeType('file:///data/rec_1.m4a')).toBe('audio/mp4');
    expect(voiceNoteMimeType('blob:http://localhost/abc.webm')).toBe('audio/webm');
    expect(voiceNoteMimeType('file:///x.caf?token=1')).toBe('audio/mp4');
    expect(voiceNoteMimeType('file:///x.3gp')).toBe('audio/3gpp');
  });

  it('cycles the playback speed 1x, 1.5x, 2x and back', () => {
    expect(nextRate(1)).toBe(1.5);
    expect(nextRate(1.5)).toBe(2);
    expect(nextRate(2)).toBe(1);
    expect(nextRate(0.75)).toBe(1); // an unknown speed starts the cycle again
  });
});

describe('photo grid', () => {
  it('lays out 1, 2, 3 and 4+ photos, with the rest behind "+N"', () => {
    expect(gridRows(0)).toEqual({ rows: [], hidden: 0 });
    expect(gridRows(1).rows).toEqual([[0]]);
    expect(gridRows(2).rows).toEqual([[0, 1]]);
    expect(gridRows(3).rows).toEqual([[0], [1, 2]]);
    expect(gridRows(4)).toEqual({ rows: [[0, 1], [2, 3]], hidden: 0 });
    expect(gridRows(10)).toEqual({ rows: [[0, 1], [2, 3]], hidden: 6 });
  });

  it('reads old single-photo messages, new multi-photo messages and GIFs the same way', () => {
    expect(messagePhotos('photo', { photoUrl: 'u1' })).toEqual([{ photoUrl: 'u1', photoMediaId: undefined }]);
    expect(messagePhotos('photo', { photos: [{ photoUrl: 'a' }, { photoUrl: 'b' }, { photoMediaId: 'no-link-yet' }] }).map(p => p.photoUrl)).toEqual(['a', 'b']);
    expect(messagePhotos('gif', { gifUrl: 'g', width: 200, height: 100 })).toEqual([{ photoUrl: 'g', width: 200, height: 100, isGif: true }]);
    expect(messagePhotos('note', { photoUrl: 'x' })).toEqual([]);
    expect(messagePhotos('photo', undefined)).toEqual([]);
  });

  it('keeps a single photo in its own shape but never too tall or tiny', () => {
    expect(singleSize(1000, 500, 260)).toEqual({ width: 260, height: 130 });
    expect(singleSize(500, 2000, 260, 320)).toEqual({ width: 120, height: 320 });
    expect(singleSize(undefined, undefined, 260)).toEqual({ width: 260, height: 260 });
  });
});

describe('ticks', () => {
  // ids sort by time, like real ObjectIds
  const id = (n: number) => String(n).padStart(24, '0');
  const state = (members: Array<{ delivered?: number; read?: number; name?: string }>, viewerReadOn = true): ReceiptState => ({
    applies: true,
    viewerReadOn,
    members: members.map((m, i) => ({
      userId: `u${i}`, displayName: m.name ?? `P${i}`,
      lastDeliveredMessageId: m.delivered ? id(m.delivered) : null,
      lastReadMessageId: m.read ? id(m.read) : null,
      lastReadAt: m.read ? '2026-11-23T10:42:00Z' : null,
    })),
  });

  it('shows a clock while sending and nothing where ticks do not apply', () => {
    expect(tickFor('temp_1', undefined)).toEqual({ status: 'sending', label: 'Sending' });
    expect(tickFor(id(5), undefined)).toBeNull();
    expect(tickFor(id(5), { applies: false, viewerReadOn: true, members: [] })).toBeNull();
  });

  it('goes sent, delivered, seen in a one-to-one chat', () => {
    expect(tickFor(id(5), state([{}]))!.status).toBe('sent');
    expect(tickFor(id(5), state([{ delivered: 5 }]))!.status).toBe('delivered');
    expect(tickFor(id(5), state([{ delivered: 9, read: 4 }]))!.status).toBe('delivered');
    expect(tickFor(id(5), state([{ delivered: 9, read: 5 }]))!.status).toBe('seen');
    expect(tickFor(id(5), state([{ read: 7 }]))!.status).toBe('seen'); // seen implies delivered
  });

  it('in a group, delivered and seen mean everyone', () => {
    const g = state([{ delivered: 5, read: 5 }, { delivered: 5 }, {}]);
    expect(tickFor(id(5), g)!.status).toBe('sent');
    expect(tickFor(id(5), state([{ delivered: 5, read: 5 }, { delivered: 6 }]))!.status).toBe('delivered');
    expect(tickFor(id(5), state([{ read: 5 }, { read: 8 }]))!.status).toBe('seen');
  });

  it('words the line under your last message', () => {
    const fmt = () => '10:42';
    expect(statusLine(id(5), state([{ delivered: 5, read: 5 }]), fmt)).toBe('Seen 10:42');
    expect(statusLine(id(5), state([{ delivered: 5 }]), fmt)).toBe('Delivered');
    expect(statusLine(id(5), state([{ read: 5, name: 'Sam' }, { read: 5, name: 'Ali' }]), fmt)).toBe('Seen by Sam and Ali');
    expect(statusLine(id(5), state([{ read: 5, name: 'A' }, { read: 5, name: 'B' }, { read: 5, name: 'C' }, { read: 5, name: 'D' }]), fmt)).toBe('Seen by A, B and 2 more');
  });

  it('lists who has seen it, who has it delivered, and who is waiting', () => {
    const info = messageInfo(id(5), state([{ read: 5, name: 'Sam' }, { delivered: 5, name: 'Ali' }, { name: 'Priya' }]));
    expect(info.seenBy.map(p => p.name)).toEqual(['Sam']);
    expect(info.deliveredTo.map(p => p.name)).toEqual(['Ali']);
    expect(info.waiting.map(p => p.name)).toEqual(['Priya']);
  });

  it('moves forward from live events, never back, and ignores seen when you switched it off', () => {
    const s = state([{ delivered: 5, read: 3 }]);
    const a = applyReceiptEvent(s, { userId: 'u0', lastReadMessageId: id(7), lastDeliveredMessageId: id(7), at: 'T' })!;
    expect(a.members[0].lastReadMessageId).toBe(id(7));
    expect(a.members[0].lastDeliveredMessageId).toBe(id(7));
    const back = applyReceiptEvent(a, { userId: 'u0', lastReadMessageId: id(2) })!;
    expect(back.members[0].lastReadMessageId).toBe(id(7));
    const off = applyReceiptEvent(state([{ delivered: 5 }], false), { userId: 'u0', lastReadMessageId: id(9) })!;
    expect(off.members[0].lastReadMessageId).toBeNull();
    expect(applyReceiptEvent(undefined, { userId: 'u0' })).toBeUndefined();
  });
});
