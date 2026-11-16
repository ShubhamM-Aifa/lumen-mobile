/**
 * Lumen AI's spoken replies. Natural voice = Gemini TTS through POST /ai/tts (WAV), played with
 * expo-audio; anything that fails (free-tier limit, offline, no key) falls back to the phone's own
 * voice (expo-speech) for the rest of that reply. Only one reply speaks at a time.
 *
 * A reply is cleaned of markdown and split into short chunks at sentence ends, so the first words
 * start playing after one short TTS call while the next chunk is fetched in the background.
 */
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { api } from '../../api/client';

export const CHUNK_CHARS = 300;

/** Markdown and list markers out, sentence ends in. "**Sleep:** 7h" → "Sleep: 7h." */
export function speakableText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/[*_`#>]+/g, '')
    .split('\n')
    .map(line => line.replace(/^\s*(?:[-•]|\d+[.)])\s+/, '').trim())
    .filter(Boolean)
    .map(line => (/[.!?।:]$/.test(line) ? line : `${line}.`))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sentence-sized pieces of at most `max` characters (a very long sentence is cut at commas/spaces). */
export function chunkForSpeech(text: string, max = CHUNK_CHARS): string[] {
  const sentences = text.match(/[^.!?।]+[.!?।]+|[^.!?।]+$/g)?.map(s => s.trim()).filter(Boolean) ?? [];
  const pieces: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= max) { pieces.push(sentence); continue; }
    let rest = sentence;
    while (rest.length > max) {
      const cut = Math.max(rest.lastIndexOf(', ', max), rest.lastIndexOf(' ', max));
      const at = cut > max / 3 ? cut + 1 : max;
      pieces.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) pieces.push(rest);
  }
  const chunks: string[] = [];
  for (const p of pieces) {
    const last = chunks[chunks.length - 1];
    if (last && last.length + 1 + p.length <= max) chunks[chunks.length - 1] = `${last} ${p}`;
    else chunks.push(p);
  }
  return chunks;
}

/** Up to this, a reply is one natural-voice request. */
export const SINGLE_REQUEST_CHARS = 700;
const FIRST_CHUNK_CHARS = 300;
const LATER_CHUNK_CHARS = 1100;

/**
 * Gemini TTS allows only a few requests a day on the free tier, so natural-voice replies use as
 * few, large chunks as possible: one for a short reply; for a long one, a short first chunk (so
 * it starts quickly) and then big ones. The phone's own voice has no such limit.
 */
export function planSpeechChunks(text: string, natural: boolean): string[] {
  if (!natural) return chunkForSpeech(text, CHUNK_CHARS);
  if (text.length <= SINGLE_REQUEST_CHARS) return text ? [text] : [];
  const sentences = chunkForSpeech(text, FIRST_CHUNK_CHARS);
  const first = sentences[0];
  const rest = text.slice(text.indexOf(first) + first.length).trim();
  return [first, ...chunkForSpeech(rest, LATER_CHUNK_CHARS)];
}

/** Devanagari → Hindi voice; everything else (English, Hinglish) → Indian English. */
export function speechLanguage(text: string): 'hi-IN' | 'en-IN' {
  return /[ऀ-ॿ]/.test(text) ? 'hi-IN' : 'en-IN';
}

export type SpeechState = { status: 'idle' | 'loading' | 'speaking'; id: string | null };

let state: SpeechState = { status: 'idle', id: null };
const listeners = new Set<() => void>();
function setState(next: SpeechState) {
  state = next;
  listeners.forEach(l => l());
}
export function getSpeechState(): SpeechState { return state; }
export function subscribeSpeech(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let run = 0;
let player: AudioPlayer | null = null;
let audioModeSet = false;
const cache = new Map<string, string>();
const CACHE_MAX = 40;

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Natural-voice audio for one chunk as a playable URI, or null to use the phone's voice. */
async function fetchAudio(text: string, voice: string): Promise<string | null> {
  const key = `${voice}:${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const res = await api.post<{ fallback: boolean; base64?: string; mimeType?: string }>('/ai/tts', { text, voice });
    if (res.fallback || !res.base64) return null;
    let uri: string;
    if (Platform.OS === 'web' || !FileSystem.cacheDirectory) {
      uri = `data:${res.mimeType ?? 'audio/wav'};base64,${res.base64}`;
    } else {
      uri = `${FileSystem.cacheDirectory}lumen-tts-${hash(key)}.wav`;
      await FileSystem.writeAsStringAsync(uri, res.base64, { encoding: FileSystem.EncodingType.Base64 });
    }
    cache.set(key, uri);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
    return uri;
  } catch {
    return null;
  }
}

function playUri(uri: string, myRun: number): Promise<void> {
  return new Promise(resolve => {
    if (myRun !== run) return resolve();
    const p = createAudioPlayer({ uri });
    player = p;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      sub.remove();
      clearInterval(guard);
      try { p.remove(); } catch { /* already released */ }
      if (player === p) player = null;
      resolve();
    };
    // SharedObject.addListener exists at runtime (see soundService.ts); its typing doesn't surface here.
    const events = p as unknown as {
      addListener: (event: 'playbackStatusUpdate', cb: (status: { didJustFinish?: boolean }) => void) => { remove(): void };
    };
    const sub = events.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish) done();
    });
    // Stopped from outside (stop() bumps `run`), or the player never reports finishing.
    const startedAt = Date.now();
    const guard = setInterval(() => {
      if (myRun !== run || Date.now() - startedAt > 90_000) done();
    }, 250);
    p.play();
  });
}

function speakWithPhone(text: string, myRun: number): Promise<void> {
  return new Promise(resolve => {
    if (myRun !== run) return resolve();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearInterval(guard);
      resolve();
    };
    // Some engines don't report onStopped after Speech.stop(); stop() bumps `run`, so watch it too.
    const guard = setInterval(() => { if (myRun !== run) done(); }, 250);
    Speech.speak(text, { language: speechLanguage(text), onDone: done, onStopped: done, onError: done });
  });
}

export interface SpeakOptions {
  /** Gemini voice name. */
  voice: string;
  /** False = always the phone's own voice. */
  natural: boolean;
  /** Which message is speaking, so its speaker button can show "stop". */
  id?: string;
}

/** Speaks a reply; resolves when it finished or was stopped. Starting a new one stops the old one. */
export async function speakReply(text: string, opts: SpeakOptions): Promise<void> {
  await stopSpeaking();
  const myRun = ++run;
  let chunks = planSpeechChunks(speakableText(text), opts.natural);
  if (!chunks.length) return;
  if (!audioModeSet) {
    audioModeSet = true;
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }
  setState({ status: 'loading', id: opts.id ?? null });
  let natural = opts.natural;
  let next: Promise<string | null> | null = natural ? fetchAudio(chunks[0], opts.voice) : null;
  for (let i = 0; i < chunks.length; i++) {
    if (myRun !== run) return;
    const uri = next ? await next : null;
    if (myRun !== run) return;
    // One failed TTS call means the rest of this reply uses the phone's voice too (no stop-start),
    // re-split into the phone voice's smaller pieces.
    if (natural && !uri) {
      natural = false;
      chunks = [...chunks.slice(0, i), ...chunkForSpeech(chunks.slice(i).join(' '), CHUNK_CHARS)];
    }
    next = natural && i + 1 < chunks.length ? fetchAudio(chunks[i + 1], opts.voice) : null;
    setState({ status: 'speaking', id: opts.id ?? null });
    if (uri) await playUri(uri, myRun);
    else await speakWithPhone(chunks[i], myRun);
  }
  if (myRun === run) setState({ status: 'idle', id: null });
}

export async function stopSpeaking(): Promise<void> {
  run++;
  const p = player;
  player = null;
  if (p) {
    try { p.pause(); p.remove(); } catch { /* already released */ }
  }
  await Speech.stop().catch(() => undefined);
  if (state.status !== 'idle') setState({ status: 'idle', id: null });
}
