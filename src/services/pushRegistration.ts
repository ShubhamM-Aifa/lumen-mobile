/**
 * Lets the server push Lumen AI notifications to this phone: gets the Expo push token and sends it
 * to /notification-policy/push-token. Needs a development/production build with FCM set up
 * (google-services.json); in Expo Go, on web or without permission it quietly does nothing.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let N: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  N = require('expo-notifications');
} catch {}

const TOKEN_KEY = 'lumen:push:token_v1';

function projectId(): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = Constants as any;
  return c?.expoConfig?.extra?.eas?.projectId ?? c?.easConfig?.projectId;
}

/** Registers this phone for push. Returns the token, or null when push isn't possible here. */
export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !N?.getExpoPushTokenAsync) return null;
  try {
    let perm = await N.getPermissionsAsync();
    if (!perm?.granted && perm?.canAskAgain !== false) perm = await N.requestPermissionsAsync();
    if (!perm?.granted) return null;
    const id = projectId();
    if (!id) return null;
    const res = await N.getExpoPushTokenAsync({ projectId: id });
    const token: string | undefined = res?.data;
    if (!token) return null;
    await api.post('/notification-policy/push-token', { token, platform: Platform.OS });
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch (err) {
    console.warn('[push] could not register for push:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** On logout: stop pushes for this account on this phone. Must run while still signed in. */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await api.delete(`/notification-policy/push-token?token=${encodeURIComponent(token)}`).catch(() => {});
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Best effort: the server also drops tokens Expo reports as unregistered.
  }
}
