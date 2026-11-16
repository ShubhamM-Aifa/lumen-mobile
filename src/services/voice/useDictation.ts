/**
 * On-device speech-to-text for Lumen AI (expo-speech-recognition: Google's recognizer on Android).
 * One utterance per start(): it stops by itself after a pause, then calls onFinal with the text.
 * `en-IN` copes with English and Hinglish; `hi-IN` is for Hindi (Devanagari output).
 */
import { useCallback, useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

export type DictationError = 'permission' | 'unavailable' | 'no-speech' | 'network' | 'other';

export interface DictationOptions {
  lang: 'en-IN' | 'hi-IN';
  /** The whole utterance, once the recognizer is done. Empty string when nothing was heard. */
  onFinal: (text: string) => void;
  onError?: (error: DictationError) => void;
}

export async function ensureMicPermission(): Promise<boolean> {
  try {
    const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return !!res.granted;
  } catch {
    return false;
  }
}

function mapError(code: string): DictationError {
  if (code === 'not-allowed') return 'permission';
  if (code === 'service-not-allowed' || code === 'language-not-supported') return 'unavailable';
  if (code === 'no-speech' || code === 'speech-timeout') return 'no-speech';
  if (code === 'network') return 'network';
  return 'other';
}

export function useDictation({ lang, onFinal, onError }: DictationOptions) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  /** Roughly 0..1, for the mic animation. */
  const [level, setLevel] = useState(0);
  const finalText = useRef('');
  const active = useRef(false);
  const reported = useRef(false);
  const cb = useRef({ onFinal, onError });
  cb.current = { onFinal, onError };

  useSpeechRecognitionEvent('result', ev => {
    if (!active.current) return;
    const text = ev.results[0]?.transcript ?? '';
    if (ev.isFinal) finalText.current = [finalText.current, text].filter(Boolean).join(' ').trim();
    setPartial(ev.isFinal ? finalText.current : [finalText.current, text].filter(Boolean).join(' ').trim());
  });

  useSpeechRecognitionEvent('volumechange', ev => {
    if (active.current) setLevel(Math.max(0, Math.min(1, (ev.value + 2) / 12)));
  });

  useSpeechRecognitionEvent('error', ev => {
    if (!active.current || ev.error === 'aborted') return;
    const err = mapError(ev.error);
    if (err !== 'no-speech') { reported.current = true; cb.current.onError?.(err); }
  });

  useSpeechRecognitionEvent('end', () => {
    if (!active.current) return;
    active.current = false;
    setListening(false);
    setLevel(0);
    const text = finalText.current.trim();
    if (!reported.current) cb.current.onFinal(text);
  });

  const start = useCallback(async () => {
    if (active.current) return true;
    if (!(await ensureMicPermission())) { cb.current.onError?.('permission'); return false; }
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) { cb.current.onError?.('unavailable'); return false; }
    } catch { /* older Android: try anyway */ }
    finalText.current = '';
    reported.current = false;
    setPartial('');
    active.current = true;
    setListening(true);
    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
      androidIntentOptions: {
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1500,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1500,
      },
    });
    return true;
  }, [lang]);

  /** Finish now and deliver what was heard so far. */
  const stop = useCallback(() => {
    if (active.current) ExpoSpeechRecognitionModule.stop();
  }, []);

  /** Throw away this utterance (no onFinal). */
  const cancel = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    setListening(false);
    setLevel(0);
    ExpoSpeechRecognitionModule.abort();
  }, []);

  return { listening, partial, level, start, stop, cancel };
}
