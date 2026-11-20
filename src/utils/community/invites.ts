/**
 * Direct-message invites: a personal link ("lumen://community/invite/<code>"), a typed @handle,
 * and group chats. Pure helpers shared by the New message screen and the invite screens.
 */
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_LENGTH = 12;
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);
export const MAX_GROUP_MEMBERS = 10;
export const MIN_GROUP_MEMBERS = 3;
export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

/** The invite code inside a pasted link, or a bare code; null when it is neither. */
export function extractInviteCode(input: string | null | undefined): string | null {
  const s = String(input ?? '').trim().toLowerCase();
  const fromLink = /(?:^|\/)invite\/([a-z0-9]+)\/?(?:[?#].*)?$/.exec(s)?.[1];
  const code = fromLink ?? s;
  return CODE_RE.test(code) ? code : null;
}

/** What the New message box was given: a link/code, an @handle, or plain name text. */
export type PeopleQuery =
  | { kind: 'invite'; code: string }
  | { kind: 'handle'; handle: string }
  | { kind: 'name'; text: string }
  | { kind: 'empty' };

export function parsePeopleQuery(raw: string): PeopleQuery {
  const q = raw.trim();
  if (!q) return { kind: 'empty' };
  const code = extractInviteCode(q);
  if (code) return { kind: 'invite', code };
  if (q.startsWith('@')) {
    const handle = q.slice(1).trim().toLowerCase();
    return handle.length >= 3 && HANDLE_RE.test(handle) ? { kind: 'handle', handle } : { kind: 'empty' };
  }
  return q.length >= 2 ? { kind: 'name', text: q } : { kind: 'empty' };
}

export function validHandle(raw: string): { ok: true; handle: string } | { ok: false; reason: string } {
  const h = raw.trim().replace(/^@/, '').toLowerCase();
  return HANDLE_RE.test(h) ? { ok: true, handle: h } : { ok: false, reason: 'Use 3 to 20 letters, numbers or underscores.' };
}

/** The message shared with the link. */
export function inviteShareText(link: string, handle: string | null): string {
  return `Message me on Lumen: ${link}${handle ? `\nOr search @${handle} in New message.` : ''}`;
}

/** Everyone in a chat except me, for the group header ("Sam, Priya and 1 more"). */
export function groupSubtitle(members: Array<{ displayName: string; isMe?: boolean }> | undefined): string {
  const others = (members ?? []).filter(m => !m.isMe).map(m => m.displayName);
  const total = (members ?? []).length;
  if (others.length === 0) return total ? 'Just you' : 'Group chat';
  const head = others.slice(0, 3).join(', ');
  return others.length > 3 ? `${head} and ${others.length - 3} more · ${total} people` : `${head} · ${total} people`;
}

/** People I can put in a group: my accepted 1-on-1 chats (a pending or declined request does not count). */
export function groupCandidates<T extends { type?: string; isGroup?: boolean; dmStatus?: string; dmUser?: { _id: string; displayName: string } | null }>(
  dms: T[],
): Array<{ userId: string; displayName: string }> {
  const seen = new Set<string>();
  const out: Array<{ userId: string; displayName: string }> = [];
  for (const c of dms) {
    if (c.type !== 'dm' || c.isGroup || (c.dmStatus && c.dmStatus !== 'accepted') || !c.dmUser?._id || seen.has(c.dmUser._id)) continue;
    seen.add(c.dmUser._id);
    out.push({ userId: c.dmUser._id, displayName: c.dmUser.displayName });
  }
  return out.sort((a, b) => a.displayName.localeCompare(b.displayName));
}
