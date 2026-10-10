/**
 * Sound Service for Lumen Reminders & Alarms.
 * Manages in-app sound playback and preview for custom alarm tones using modern expo-audio.
 * Uses resilient dynamic loading with graceful haptic fallback if native audio
 * binary is not present in the current runtime environment.
 */
import * as Haptics from 'expo-haptics';

export interface SoundOption {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: 'gentle' | 'energetic' | 'classic' | 'system';
}

export const SOUND_OPTIONS: SoundOption[] = [
  {
    id: 'default',
    label: 'Device Default',
    description: 'System standard alarm & notification tone',
    icon: '🔔',
    category: 'system',
  },
  {
    id: 'chime',
    label: 'Sparkle Chime',
    description: 'Bright harmonic chime (C5 & G5 melody)',
    icon: '✨',
    category: 'gentle',
  },
  {
    id: 'gentle_bell',
    label: 'Gentle Bell',
    description: 'Calming Tibetan singing bowl resonance (528Hz)',
    icon: '🎐',
    category: 'gentle',
  },
  {
    id: 'digital_alarm',
    label: 'Digital Beeps',
    description: 'Crisp rhythmic electronic pulse alarm',
    icon: '⏰',
    category: 'energetic',
  },
  {
    id: 'zen_gong',
    label: 'Zen Gong',
    description: 'Deep grounding resonant gong with rich undertones',
    icon: '🧘',
    category: 'gentle',
  },
  {
    id: 'radar',
    label: 'Radar Ping',
    description: 'Modern upward sonar chirp alert',
    icon: '📡',
    category: 'energetic',
  },
];

// Resilient native module loader for modern expo-audio
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ExpoAudio: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ExpoAudio = require('expo-audio');
} catch {
  // Graceful fallback for headless or restricted environments
  ExpoAudio = null;
}

import { NativeModules, Platform } from 'react-native';

const { AlarmScheduler } = NativeModules;

const SOUND_ASSETS: Record<string, any> = {
  default: require('../../assets/sounds/digital_alarm.wav'),
  chime: require('../../assets/sounds/chime.wav'),
  gentle_bell: require('../../assets/sounds/gentle_bell.wav'),
  digital_alarm: require('../../assets/sounds/digital_alarm.wav'),
  zen_gong: require('../../assets/sounds/zen_gong.wav'),
  radar: require('../../assets/sounds/radar.wav'),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentSound: any = null;
let currentPlayingId: string | null = null;

/**
 * Check whether native audio hardware playback is available in the current APK.
 */
export function isAudioAvailable(): boolean {
  return ExpoAudio != null && typeof ExpoAudio.createAudioPlayer === 'function';
}

/**
 * Configure audio mode to ensure sounds play reliably even in silent/DND mode.
 */
async function configureAudioMode(): Promise<void> {
  if (!ExpoAudio || typeof ExpoAudio.setAudioModeAsync !== 'function') return;
  try {
    await ExpoAudio.setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    });
  } catch (err) {
    console.warn('[SoundService] Failed to set audio mode:', err);
  }
}

/**
 * Stop and unload any currently playing preview or alarm sound.
 */
export async function stopSound(): Promise<void> {
  if (Platform.OS === 'android' && AlarmScheduler?.stopRingtone) {
    try {
      await AlarmScheduler.stopRingtone();
    } catch {}
  }
  if (currentSound) {
    try {
      if (typeof currentSound.pause === 'function') {
        currentSound.pause();
      }
      if (typeof currentSound.remove === 'function') {
        currentSound.remove();
      }
    } catch {
      // Ignore unload errors
    } finally {
      currentSound = null;
      currentPlayingId = null;
    }
  }
}

/**
 * Returns the currently playing sound ID (if any).
 */
export function getCurrentlyPlayingSoundId(): string | null {
  return currentPlayingId;
}

/**
 * Play a preview tone once (for sound picker selection).
 */
export async function previewSound(
  soundId: string,
  onFinish?: () => void
): Promise<void> {
  await stopSound();

  // If native audio is not compiled into the current binary or it's default
  if (!isAudioAvailable() || soundId === 'default' || !SOUND_ASSETS[soundId]) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onFinish?.();
    return;
  }

  await configureAudioMode();

  try {
    const asset = SOUND_ASSETS[soundId];
    const player = ExpoAudio.createAudioPlayer(asset);
    currentSound = player;
    currentPlayingId = soundId;

    if (player && typeof player.addListener === 'function') {
      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status?.didJustFinish) {
          stopSound().catch(() => {});
          onFinish?.();
        }
      });
    }

    player.volume = 1.0;
    player.play();
  } catch (err) {
    console.warn(`[SoundService] Failed to preview sound "${soundId}":`, err);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onFinish?.();
  }
}

/**
 * Start an alarm sound in continuous loop (used on the Alarm screen).
 */
export async function startAlarmSound(soundId: string = 'default'): Promise<void> {
  await stopSound();

  const asset = SOUND_ASSETS[soundId] || SOUND_ASSETS.default;
  if (!isAudioAvailable() || !asset) {
    return;
  }

  await configureAudioMode();

  try {
    const asset = SOUND_ASSETS[soundId];
    const player = ExpoAudio.createAudioPlayer(asset);
    currentSound = player;
    currentPlayingId = soundId;
    player.loop = true;
    player.volume = 1.0;
    player.play();
  } catch (err) {
    console.warn(`[SoundService] Failed to start alarm sound "${soundId}":`, err);
  }
}

/**
 * Helper to get metadata for a given sound ID.
 */
export function getSoundOption(soundId: string = 'default'): SoundOption {
  return SOUND_OPTIONS.find((s) => s.id === soundId) || SOUND_OPTIONS[0];
}
