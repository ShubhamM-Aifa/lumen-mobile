import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'lumen:emoji:animated_v1';

interface EmojiPrefs {
  /** Show big animated emoji (loaded from Google's font server by emoji code). Off = normal big emoji. */
  animated: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  setAnimated: (on: boolean) => void;
}

export const useEmojiPrefs = create<EmojiPrefs>((set, get) => ({
  animated: true,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const v = await AsyncStorage.getItem(KEY);
      set({ animated: v !== 'off', loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  setAnimated: (on) => {
    set({ animated: on });
    AsyncStorage.setItem(KEY, on ? 'on' : 'off').catch(() => {});
  },
}));
