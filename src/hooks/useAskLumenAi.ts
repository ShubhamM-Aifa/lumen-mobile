/**
 * "Ask Lumen AI" on a note, task, list, day, record, medicine, insight or weekly review: opens a
 * new chat with that item already attached; the member writes the question.
 */
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useAiAccess } from './useAiChat';
import { encodeRef, type ChatRef } from '../utils/ai/refs';

export function useAskLumenAi() {
  const access = useAiAccess();
  const fullAccess = !!access.data?.fullAccess;

  const ask = useCallback((ref: ChatRef, prompt?: string) => {
    if (!fullAccess) {
      Alert.alert(
        'Lumen AI is off',
        'Turn on Lumen AI in Settings → AI & Insights to ask it about your data.',
        [{ text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: () => router.push('/settings') }],
      );
      return;
    }
    router.push({ pathname: '/ai/[id]', params: { id: 'new', attach: encodeRef(ref), ...(prompt ? { prompt } : {}) } });
  }, [fullAccess]);

  return { ask, fullAccess };
}
