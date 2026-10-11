/**
 * Sensitive Photo Vault Store
 * Manages:
 * 1. Vault lock/unlock session state
 * 2. 4-digit PIN verification via backend endpoint
 * 3. Biometric fast unlock via LocalAuthentication
 * 4. Automatic re-locking when app is backgrounded or inactive
 */
import { AppState, AppStateStatus } from 'react-native';
import { create } from 'zustand';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { useAuthStore } from './authStore';

const BIOMETRIC_PHOTO_VAULT_KEY = 'lumen:security:photo_vault_biometrics_v1';

interface PhotoVaultState {
  isUnlocked: boolean;
  isVerifying: boolean;
  isBiometricEnabled: boolean;

  unlock: () => void;
  lock: () => void;
  verifyPin: (pin: string) => Promise<boolean>;
  authenticateBiometrics: (prompt?: string) => Promise<boolean>;
  setPhotoPin: (pin: string) => Promise<void>;
  toggleBiometricUnlock: (enabled: boolean) => Promise<void>;
  initVault: () => Promise<void>;
}

export const usePhotoVaultStore = create<PhotoVaultState>((set, get) => ({
  isUnlocked: false,
  isVerifying: false,
  isBiometricEnabled: true,

  initVault: async () => {
    try {
      const bioPref = await AsyncStorage.getItem(BIOMETRIC_PHOTO_VAULT_KEY);
      set({ isBiometricEnabled: bioPref !== 'false' });
    } catch {}
  },

  unlock: () => {
    set({ isUnlocked: true });
  },

  lock: () => {
    set({ isUnlocked: false });
  },

  verifyPin: async (pin: string) => {
    set({ isVerifying: true });
    try {
      const res = await api.post<{ valid: boolean; isConfigured: boolean }>(
        '/auth/verify-photo-pin',
        { pin }
      );
      if (res?.valid) {
        set({ isUnlocked: true });
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[PhotoVaultStore] PIN verification error:', err);
      return false;
    } finally {
      set({ isVerifying: false });
    }
  },

  authenticateBiometrics: async (prompt = 'Unlock Sensitive Photos') => {
    // Crucial Security Rule: Only Primary User (authenticated via Google) is allowed
    // to use device biometrics to unlock sensitive photos.
    // Secondary users (password-authenticated) on their personal phone cannot bypass
    // the primary owner's PIN using their own device biometrics.
    const user = useAuthStore.getState().user;
    if (user?.authMethod !== 'google') {
      return false;
    }

    const { isBiometricEnabled } = get();
    if (!isBiometricEnabled) return false;

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
      const isEnrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
      if (!hasHardware || !isEnrolled) return false;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: prompt,
        cancelLabel: 'Use PIN',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: true,
      });

      if (result.success) {
        set({ isUnlocked: true });
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[PhotoVaultStore] Biometrics error:', e);
      return false;
    }
  },

  setPhotoPin: async (pin: string) => {
    await api.post('/auth/photo-pin', { pin });
    const user = useAuthStore.getState().user;
    if (user) {
      useAuthStore.getState().setUser({ ...user, hasPhotoPin: true });
    }
    set({ isUnlocked: true });
  },

  toggleBiometricUnlock: async (enabled: boolean) => {
    set({ isBiometricEnabled: enabled });
    await AsyncStorage.setItem(BIOMETRIC_PHOTO_VAULT_KEY, enabled ? 'true' : 'false').catch(() => {});
  },
}));

// Initialize biometric preference on load
usePhotoVaultStore.getState().initVault();

// Auto-lock vault when app leaves foreground
AppState.addEventListener('change', (nextState: AppStateStatus) => {
  if (nextState !== 'active') {
    usePhotoVaultStore.getState().lock();
  }
});
