/**
 * Explore questions travel as short tokens (base64url JSON) — in chat attachments and links —
 * so a chip in Lumen AI can reopen exactly the same analysis.
 */
import type { ExploreQuestion } from '../../hooks/useAnalytics';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8Bytes(s: string): number[] {
  return Array.from(unescape(encodeURIComponent(s))).map(c => c.charCodeAt(0));
}

function b64urlEncode(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? B64[n & 63] : '');
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(s: string): string {
  const clean = s.replace(/-/g, '+').replace(/_/g, '/');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = clean.slice(i, i + 4);
    const n = chunk.split('').reduce((acc, ch, k) => acc | (B64.indexOf(ch) << (18 - 6 * k)), 0);
    bytes.push((n >> 16) & 255);
    if (chunk.length > 2) bytes.push((n >> 8) & 255);
    if (chunk.length > 3) bytes.push(n & 255);
  }
  return decodeURIComponent(escape(String.fromCharCode(...bytes)));
}

export function encodeQuestion(q: ExploreQuestion): string {
  return b64urlEncode(utf8Bytes(JSON.stringify(q)));
}

export function decodeQuestion(token: string | null | undefined): ExploreQuestion | null {
  if (!token || token.length > 300 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  try {
    const q = JSON.parse(b64urlDecode(token)) as ExploreQuestion;
    if (!q || typeof q !== 'object' || !q.target || typeof (q.target as { kind?: unknown }).kind !== 'string') return null;
    return { target: q.target, direction: q.direction === 'after' ? 'after' : 'before', range: q.range ?? '365d' };
  } catch {
    return null;
  }
}
