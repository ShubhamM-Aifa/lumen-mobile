/**
 * Hands-free voice conversation with Lumen AI: listen → think (send) → speak → listen again.
 * Tapping the orb while it speaks interrupts the reply and listens; while listening it finishes
 * the utterance now. Two silent turns in a row pause the loop (tap to talk again). With the mic
 * muted it stops after each reply.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useDictation, type DictationError } from '../services/voice/useDictation';
import { speakReply, stopSpeaking } from '../services/voice/tts';

export type VoicePhase = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface VoiceTurn {
  ok: boolean;
  reply: string;
}

export interface VoiceConversationOptions {
  lang: 'en-IN' | 'hi-IN';
  voice: string;
  natural: boolean;
  /** Sends what the member said; resolves with the reply to speak. */
  send: (text: string) => Promise<VoiceTurn>;
}

const MAX_SILENT_TURNS = 2;

export const DICTATION_ERROR_TEXT: Record<DictationError, string> = {
  permission: 'Lumen needs microphone access. Allow it in your phone settings, then tap to talk.',
  unavailable: 'Speech recognition is not available on this phone. Make sure the Google app is installed and up to date.',
  network: 'Speech recognition needs a connection right now. Tap to try again.',
  'no-speech': 'I did not hear anything. Tap to talk.',
  other: 'Something went wrong while listening. Tap to try again.',
};

export function useVoiceConversation({ lang, voice, natural, send }: VoiceConversationOptions) {
  const [phase, setPhaseState] = useState<VoicePhase>('idle');
  const [heard, setHeard] = useState('');
  const [reply, setReply] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const active = useRef(false);
  const silentTurns = useRef(0);
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  const phaseRef = useRef<VoicePhase>('idle');
  const opts = useRef({ voice, natural, send });
  opts.current = { voice, natural, send };

  const setPhase = (p: VoicePhase) => {
    phaseRef.current = p;
    setPhaseState(p);
    if (p === 'listening') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    else if (p === 'thinking') Haptics.selectionAsync().catch(() => undefined);
  };

  const listenRef = useRef<() => Promise<void>>(async () => undefined);

  const pause = (message: string | null) => {
    active.current = false;
    setNotice(message);
    setPhase('idle');
  };

  const onFinal = async (text: string) => {
    if (!active.current) return;
    if (!text) {
      silentTurns.current += 1;
      if (silentTurns.current >= MAX_SILENT_TURNS) pause(DICTATION_ERROR_TEXT['no-speech']);
      else await listenRef.current();
      return;
    }
    silentTurns.current = 0;
    setHeard(text);
    setPhase('thinking');
    let turn: VoiceTurn;
    try {
      turn = await opts.current.send(text);
    } catch (err) {
      turn = { ok: false, reply: err instanceof Error ? err.message : 'Lumen AI could not answer just now.' };
    }
    if (!active.current) return;
    setReply(turn.reply);
    setPhase('speaking');
    await speakReply(turn.reply, { voice: opts.current.voice, natural: opts.current.natural, id: 'voice-mode' });
    if (!active.current) return;
    if (mutedRef.current) pause(null);
    else await listenRef.current();
  };

  const dictation = useDictation({
    lang,
    onFinal: text => { onFinal(text).catch(() => pause(DICTATION_ERROR_TEXT.other)); },
    onError: err => pause(DICTATION_ERROR_TEXT[err]),
  });

  listenRef.current = async () => {
    if (!active.current) return;
    setPhase('listening');
    const started = await dictation.start();
    if (!started && active.current) setPhase('idle');
  };

  /** Start (or resume) the conversation. */
  const start = useCallback(async () => {
    active.current = true;
    silentTurns.current = 0;
    setNotice(null);
    await listenRef.current();
  }, []);

  /** The big orb: talk / finish talking / interrupt the reply. */
  const tapOrb = useCallback(() => {
    switch (phaseRef.current) {
      case 'idle': start().catch(() => undefined); break;
      case 'listening': dictation.stop(); break;
      // Stopping the speech resolves speakReply, and the loop goes on to listen.
      case 'speaking': stopSpeaking().catch(() => undefined); break;
      default: break;
    }
  }, [dictation, start]);

  const end = useCallback(() => {
    active.current = false;
    dictation.cancel();
    stopSpeaking().catch(() => undefined);
    setPhase('idle');
  }, [dictation]);

  // Leaving the screen ends the conversation.
  useEffect(() => () => {
    active.current = false;
    stopSpeaking().catch(() => undefined);
  }, []);

  return {
    phase,
    /** Live words while listening, then the last thing the member said. */
    heard: phase === 'listening' ? dictation.partial : heard,
    reply,
    level: dictation.level,
    notice,
    muted,
    setMuted,
    start,
    tapOrb,
    end,
  };
}
