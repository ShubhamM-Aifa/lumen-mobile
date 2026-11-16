import { useSyncExternalStore } from 'react';
import { getSpeechState, subscribeSpeech, type SpeechState } from './tts';

/** Which reply (if any) is speaking right now. */
export function useSpeechState(): SpeechState {
  return useSyncExternalStore(subscribeSpeech, getSpeechState, getSpeechState);
}
