/**
 * Ticks on your own messages in direct chats and groups:
 * sending → sent → delivered → seen. Message ids sort by time, so "has seen it" means "has read up to a
 * message at or after it". In a group, delivered/seen mean EVERYONE has it; Message info lists each person.
 */
export type TickStatus = 'sending' | 'sent' | 'delivered' | 'seen';

export interface MemberReceipt {
  userId: string;
  displayName?: string;
  lastDeliveredMessageId: string | null;
  lastDeliveredAt?: string | null;
  lastReadMessageId: string | null;
  lastReadAt?: string | null;
}

export interface ReceiptState {
  applies: boolean;
  viewerReadOn: boolean;
  members: MemberReceipt[];
}

const reached = (upTo: string | null | undefined, id: string) => Boolean(upTo) && String(upTo) >= id;

export function memberHas(m: MemberReceipt, messageId: string): { delivered: boolean; seen: boolean } {
  const seen = reached(m.lastReadMessageId, messageId);
  return { seen, delivered: seen || reached(m.lastDeliveredMessageId, messageId) };
}

export function tickFor(messageId: string, receipts: ReceiptState | undefined): { status: TickStatus; label: string } | null {
  if (messageId.startsWith('temp_')) return { status: 'sending', label: 'Sending' };
  if (!receipts || !receipts.applies) return null;
  const members = receipts.members;
  if (members.length === 0) return { status: 'sent', label: 'Sent' };
  const states = members.map((m) => memberHas(m, messageId));
  if (states.every((s) => s.seen)) return { status: 'seen', label: 'Seen' };
  if (states.every((s) => s.delivered)) return { status: 'delivered', label: 'Delivered' };
  return { status: 'sent', label: 'Sent' };
}

export interface MessageInfo {
  seenBy: Array<{ userId: string; name: string; at?: string | null }>;
  deliveredTo: Array<{ userId: string; name: string; at?: string | null }>;
  waiting: Array<{ userId: string; name: string }>;
}

/** Per-person breakdown for Message info. */
export function messageInfo(messageId: string, receipts: ReceiptState | undefined): MessageInfo {
  const out: MessageInfo = { seenBy: [], deliveredTo: [], waiting: [] };
  for (const m of receipts?.members ?? []) {
    const name = m.displayName || 'Member';
    const has = memberHas(m, messageId);
    if (has.seen) out.seenBy.push({ userId: m.userId, name, at: m.lastReadAt });
    else if (has.delivered) out.deliveredTo.push({ userId: m.userId, name, at: m.lastDeliveredAt });
    else out.waiting.push({ userId: m.userId, name });
  }
  return out;
}

/** The short line under your last message: "Seen 10:42", "Seen by Sam and Ali", "Delivered", "Sent". */
export function statusLine(messageId: string, receipts: ReceiptState | undefined, formatTime: (iso: string) => string): string | null {
  const tick = tickFor(messageId, receipts);
  if (!tick) return null;
  if (tick.status !== 'seen' || !receipts) return tick.label;
  const info = messageInfo(messageId, receipts);
  if (info.seenBy.length === 1 && receipts.members.length === 1) {
    const at = info.seenBy[0].at;
    return at ? `Seen ${formatTime(at)}` : 'Seen';
  }
  const names = info.seenBy.map((p) => p.name);
  return names.length <= 2 ? `Seen by ${names.join(' and ')}` : `Seen by ${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

/** Applies a live "receipt_updated" event to the stored state (only moves forward). */
export function applyReceiptEvent(state: ReceiptState | undefined, evt: { userId: string; lastDeliveredMessageId?: string; lastReadMessageId?: string; at?: string }): ReceiptState | undefined {
  if (!state) return state;
  const members = state.members.map((m) => {
    if (m.userId !== evt.userId) return m;
    const next = { ...m };
    if (evt.lastDeliveredMessageId && (!m.lastDeliveredMessageId || evt.lastDeliveredMessageId > m.lastDeliveredMessageId)) {
      next.lastDeliveredMessageId = evt.lastDeliveredMessageId;
      next.lastDeliveredAt = evt.at ?? null;
    }
    if (evt.lastReadMessageId && state.viewerReadOn && (!m.lastReadMessageId || evt.lastReadMessageId > m.lastReadMessageId)) {
      next.lastReadMessageId = evt.lastReadMessageId;
      next.lastReadAt = evt.at ?? null;
    }
    return next;
  });
  return { ...state, members };
}
