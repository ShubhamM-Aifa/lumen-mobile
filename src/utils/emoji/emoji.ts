/**
 * Emoji helpers: which emoji have a Google Noto animation, where to load it from, and whether a chat
 * message is "only emoji" (so it is shown big and animated, like Discord and Telegram).
 * Only the emoji's code goes to Google's font server, never the message text.
 */
import animated from './animatedSet.json';

// Google lists some codes with the FE0F selector ("2764_fe0f"); compare without it on both sides.
const ANIMATED = new Set<string>((animated as string[]).map((cp) => cp.replace(/_?fe0f/g, '')));

export const MAX_EMOJI_ONLY = 3;

const VS16 = 0xfe0f;
const ZWJ = 0x200d;

/** Hex codepoints joined by "_" (the variation selector FE0F is dropped), e.g. "❤️" → "2764". */
export function toCodepoint(emoji: string): string {
  const cps: string[] = [];
  for (const ch of Array.from(emoji)) {
    const cp = ch.codePointAt(0)!;
    if (cp === VS16) continue;
    cps.push(cp.toString(16));
  }
  return cps.join('_');
}

export function isAnimated(emoji: string): boolean {
  return ANIMATED.has(toCodepoint(emoji));
}

/** Animated WebP for an emoji (512 px; the app shows it smaller and caches it). */
export function animatedUrl(emoji: string): string {
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${toCodepoint(emoji)}/512.webp`;
}

// Emoji sequence: pictographs, flags, keycaps, skin tones, ZWJ joins, variation selectors.
const EMOJI_RE = /^(?:\p{Regional_Indicator}{2}|[0-9#*]️?⃣|(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:️|\p{Emoji_Modifier})?(?:‍(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:️|\p{Emoji_Modifier})?)*)$/u;

function graphemes(text: string): string[] {
  const Seg = (Intl as any).Segmenter;
  if (typeof Seg === 'function') {
    return Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(text), (s: any) => s.segment as string);
  }
  // Fallback: split into emoji sequences with the same pattern (good enough on older JS engines).
  const out: string[] = [];
  const re = /(?:\p{Regional_Indicator}{2}|[0-9#*]️?⃣|(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:️|\p{Emoji_Modifier})?(?:‍(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:️|\p{Emoji_Modifier})?)*)|./gsu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[0]);
  return out;
}

/** The emoji of a message that is only 1–3 emoji (spaces ignored), else null. Plain digits are not emoji. */
export function emojiOnly(text: string | undefined | null): string[] | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 60) return null;
  const parts = graphemes(trimmed).filter((g) => g.trim() !== '');
  if (parts.length === 0 || parts.length > MAX_EMOJI_ONLY) return null;
  for (const p of parts) {
    if (!EMOJI_RE.test(p)) return null;
    // A bare digit/#/* is not an emoji unless it is a keycap.
    if (/^[0-9#*]$/.test(p)) return null;
  }
  return parts;
}

/** Size of each emoji in an emoji-only message. */
export function bigEmojiSize(count: number): number {
  return count <= 1 ? 96 : count === 2 ? 72 : 56;
}

export const SKIN_TONES = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'] as const;

/** Adds a skin tone after the first person in an emoji that supports it (before any ZWJ). */
export function withSkinTone(emoji: string, tone: string): string {
  if (!tone) return emoji;
  const chars = Array.from(emoji.replace(/️/g, ''));
  const zwj = chars.indexOf(String.fromCodePoint(ZWJ));
  if (zwj === -1) return chars[0] + tone + chars.slice(1).join('');
  return chars.slice(0, zwj).join('') + tone + chars.slice(zwj).join('');
}

/** Adds an emoji to a recent list: newest first, no repeats, at most `max`. */
export function pushRecent(list: string[], emoji: string, max = 32): string[] {
  return [emoji, ...list.filter((e) => e !== emoji)].slice(0, max);
}
