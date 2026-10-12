import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../api/client';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

const WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || extra.googleWebClientId || '';
const ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || extra.googleAndroidClientId || '';

if (Platform.OS === 'android') {
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    offlineAccess: false,
    scopes: ['profile', 'email'],
  });
}

export function useGoogleAuth() {
  const { loginWithGoogle, isLoading } = useAuthStore();
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleReady = Platform.OS === 'android' && !!WEB_CLIENT_ID;

  const signInWithGoogle = async (
    onSuccess?: () => void,
    customHandler?: (idToken: string) => Promise<void>,
  ) => {
    if (Platform.OS !== 'android') {
      Alert.alert('Not supported', 'Native Google Sign-In is Android only.');
      return;
    }

    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        Alert.alert('Google Sign-In failed', 'No ID token received.');
        return;
      }

      if (customHandler) {
        await customHandler(idToken);
      } else {
        await loginWithGoogle(idToken);
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.replace('/(tabs)/today');
      }
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) return;
      if (err.code === statusCodes.IN_PROGRESS) return;
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Google Sign-In failed', 'Google Play Services not available.');
        return;
      }
      const msg = err instanceof ApiError ? err.message : (err?.message ?? 'Google Sign-In failed');
      Alert.alert('Google Sign-In failed', msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  return {
    signInWithGoogle,
    googleReady,
    isLoading: isLoading || googleLoading,
    googleLoading,
  };
}
