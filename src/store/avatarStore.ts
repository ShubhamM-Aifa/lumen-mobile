import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface IModularAvatarConfig {
  aura: 'none' | 'cosmic_pulse' | 'healing_leaves' | 'golden_spoons' | 'ember_glow' | 'stardust_twinkle';
  base: 'spoonie_mascot' | 'calm_human' | 'celestial_feline';
  skinTone: string;
  eyes: 'calm' | 'sleepy' | 'sparkle' | 'winking' | 'cool_glasses' | 'zen';
  hair: 'none' | 'sprout' | 'cat_ears' | 'beanie' | 'cozy_bun' | 'soft_waves' | 'short_curl';
  hairColor: string;
  outfit: 'none' | 'oversized_hoodie' | 'flare_pajamas' | 'spoonie_cape' | 'knit_sweater' | 'herbal_robe';
  outfitColor: string;
  accessory: 'none' | 'chamomile_tea' | 'golden_spoon' | 'glowing_sprite' | 'hot_water_bottle' | 'sprout_branch';
}

export interface AvatarArchetype {
  id: string;
  name: string;
  icon: string;
  description: string;
  config: IModularAvatarConfig;
}

export const AVATAR_SKIN_PALETTE = [
  '#FDDFD0', // Fair
  '#F3C3A0', // Warm Sand
  '#D79462', // Honey Tan
  '#9E5B32', // Rich Caramel
  '#593116', // Deep Bronze
  '#DDD6FE', // Dreamy Lavender
  '#A7F3D0', // Mint Sprig
  '#BAE6FD', // Sky Pastel
];

export const AVATAR_HAIR_PALETTE = [
  '#262626', // Midnight Black
  '#654321', // Dark Brown
  '#B45309', // Warm Chestnut
  '#EA580C', // Tangerine Flame
  '#FBBF24', // Sunbeam Blonde
  '#38BDF8', // Cyan Starlight
  '#A855F7', // Royal Violet
  '#F43F5E', // Rose Berry
  '#10B981', // Forest Green
  '#E2E8F0', // Platinum Silver
];

export const AVATAR_OUTFIT_PALETTE = [
  '#38BDF8', // Lumen Sky
  '#10B981', // Sage Green
  '#8B5CF6', // Gentle Amethyst
  '#F59E0B', // Amber Spoon
  '#EC4899', // Blossom Pink
  '#64748B', // Cozy Slate
  '#EF4444', // Warm Crimson
  '#1E293B', // Night Owl
];

export const DEFAULT_AVATAR_CONFIG: IModularAvatarConfig = {
  aura: 'golden_spoons',
  base: 'spoonie_mascot',
  skinTone: '#FDDFD0',
  eyes: 'calm',
  hair: 'sprout',
  hairColor: '#10B981',
  outfit: 'oversized_hoodie',
  outfitColor: '#38BDF8',
  accessory: 'chamomile_tea',
};

export const AVATAR_ARCHETYPES: AvatarArchetype[] = [
  {
    id: 'spoon_warrior',
    name: 'Spoon Warrior',
    icon: '🥄',
    description: 'Guarding energy reserves with pride',
    config: {
      aura: 'golden_spoons',
      base: 'spoonie_mascot',
      skinTone: '#FDDFD0',
      eyes: 'sparkle',
      hair: 'sprout',
      hairColor: '#10B981',
      outfit: 'spoonie_cape',
      outfitColor: '#F59E0B',
      accessory: 'golden_spoon',
    },
  },
  {
    id: 'cozy_rest',
    name: 'Cozy Rest',
    icon: '☕',
    description: 'Warm tea, soft blankets & deep pacing',
    config: {
      aura: 'ember_glow',
      base: 'spoonie_mascot',
      skinTone: '#F3C3A0',
      eyes: 'sleepy',
      hair: 'beanie',
      hairColor: '#B45309',
      outfit: 'knit_sweater',
      outfitColor: '#64748B',
      accessory: 'chamomile_tea',
    },
  },
  {
    id: 'healing_spirit',
    name: 'Forest Sprite',
    icon: '🌿',
    description: 'One with nature and gentle herbal rhythms',
    config: {
      aura: 'healing_leaves',
      base: 'spoonie_mascot',
      skinTone: '#A7F3D0',
      eyes: 'zen',
      hair: 'cozy_bun',
      hairColor: '#10B981',
      outfit: 'herbal_robe',
      outfitColor: '#10B981',
      accessory: 'sprout_branch',
    },
  },
  {
    id: 'cosmic_dreamer',
    name: 'Cosmic Dreamer',
    icon: '✨',
    description: 'Floating through stellar clouds and quiet thoughts',
    config: {
      aura: 'cosmic_pulse',
      base: 'celestial_feline',
      skinTone: '#DDD6FE',
      eyes: 'sparkle',
      hair: 'cat_ears',
      hairColor: '#A855F7',
      outfit: 'oversized_hoodie',
      outfitColor: '#8B5CF6',
      accessory: 'glowing_sprite',
    },
  },
  {
    id: 'low_spoons_chill',
    name: 'Zen Flare Day',
    icon: '🛌',
    description: 'Recharging gracefully in comfortable loungewear',
    config: {
      aura: 'stardust_twinkle',
      base: 'spoonie_mascot',
      skinTone: '#D79462',
      eyes: 'cool_glasses',
      hair: 'soft_waves',
      hairColor: '#262626',
      outfit: 'flare_pajamas',
      outfitColor: '#38BDF8',
      accessory: 'hot_water_bottle',
    },
  },
];

const STORAGE_KEY = '@lumen:modular_avatar_config_v2';

interface AvatarState {
  config: IModularAvatarConfig;
  isLoaded: boolean;
  loadAvatar: () => Promise<void>;
  updateConfig: (patch: Partial<IModularAvatarConfig>) => Promise<void>;
  applyArchetype: (archetypeId: string) => Promise<void>;
  randomize: () => Promise<void>;
  resetToDefault: () => Promise<void>;
}

export const useAvatarStore = create<AvatarState>((set, get) => ({
  config: DEFAULT_AVATAR_CONFIG,
  isLoaded: false,

  loadAvatar: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({ config: { ...DEFAULT_AVATAR_CONFIG, ...parsed }, isLoaded: true });
        return;
      }
    } catch {}
    set({ isLoaded: true });
  },

  updateConfig: async (patch) => {
    const next = { ...get().config, ...patch };
    set({ config: next });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  },

  applyArchetype: async (archetypeId) => {
    const found = AVATAR_ARCHETYPES.find((a) => a.id === archetypeId);
    if (found) {
      set({ config: found.config });
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(found.config));
      } catch {}
    }
  },

  randomize: async () => {
    const auras: IModularAvatarConfig['aura'][] = [
      'cosmic_pulse',
      'healing_leaves',
      'golden_spoons',
      'ember_glow',
      'stardust_twinkle',
    ];
    const bases: IModularAvatarConfig['base'][] = ['spoonie_mascot', 'calm_human', 'celestial_feline'];
    const eyesList: IModularAvatarConfig['eyes'][] = [
      'calm',
      'sleepy',
      'sparkle',
      'winking',
      'cool_glasses',
      'zen',
    ];
    const hairs: IModularAvatarConfig['hair'][] = [
      'sprout',
      'cat_ears',
      'beanie',
      'cozy_bun',
      'soft_waves',
      'short_curl',
    ];
    const outfits: IModularAvatarConfig['outfit'][] = [
      'oversized_hoodie',
      'flare_pajamas',
      'spoonie_cape',
      'knit_sweater',
      'herbal_robe',
    ];
    const accessories: IModularAvatarConfig['accessory'][] = [
      'chamomile_tea',
      'golden_spoon',
      'glowing_sprite',
      'hot_water_bottle',
      'sprout_branch',
    ];

    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    const randomConfig: IModularAvatarConfig = {
      aura: pick(auras),
      base: pick(bases),
      skinTone: pick(AVATAR_SKIN_PALETTE),
      eyes: pick(eyesList),
      hair: pick(hairs),
      hairColor: pick(AVATAR_HAIR_PALETTE),
      outfit: pick(outfits),
      outfitColor: pick(AVATAR_OUTFIT_PALETTE),
      accessory: pick(accessories),
    };

    set({ config: randomConfig });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(randomConfig));
    } catch {}
  },

  resetToDefault: async () => {
    set({ config: DEFAULT_AVATAR_CONFIG });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_AVATAR_CONFIG));
    } catch {}
  },
}));

// Early rehydration to ensure the customized profile avatar is immediately loaded everywhere
useAvatarStore.getState().loadAvatar().catch(() => {});

