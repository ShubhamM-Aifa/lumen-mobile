/**
 * AppLockOverlay — Full-screen biometric lock screen for Lumen.
 * Protects clinical logs, symptoms, photos, and medication data when Biometric App Lock is enabled.
 */
import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Fingerprint, Lock, LogOut } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useSecurityStore } from '../../store/securityStore';
import { useAuthStore } from '../../store/authStore';
import { router } from 'expo-router';
import { LumenLogo } from '../common/LumenLogo';

export function AppLockOverlay() {
  const { palette } = useTheme();
  const { isLocked, isAuthenticating, biometricType, authError, authenticate } = useSecurityStore();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const logout = useAuthStore(s => s.logout);

  // Only display overlay if user is logged into an account and app lock is active
  if (!isAuthenticated || !isLocked) {
    return null;
  }

  const handleUnlockPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await authenticate('Unlock Lumen');
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleLogoutPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await logout();
    useSecurityStore.getState().unlockApp();
    router.replace('/(auth)/login');
  };

  const biometricLabel = (() => {
    if (Platform.OS === 'ios') {
      if (biometricType === 'FACE') return 'Unlock with Face ID';
      if (biometricType === 'FINGERPRINT') return 'Unlock with Touch ID';
      return 'Unlock with Biometrics';
    }
    // Android / other
    if (biometricType === 'FINGERPRINT') return 'Unlock with Fingerprint';
    if (biometricType === 'FACE') return 'Unlock with Face Recognition';
    return 'Unlock with Biometrics';
  })();

  const BiometricIcon = biometricType === 'FACE' && Platform.OS === 'ios' ? Lock : Fingerprint;

  return (
    <Modal
      visible={isLocked}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: palette.background }]}
        edges={['top', 'bottom']}
      >
        {/* Soft, seamless ambient gradient background without any sharp circles */}
        <LinearGradient
          colors={[palette.primary + '22', palette.primary + '06', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.65 }}
          pointerEvents="none"
        />

        {/* Top spacer to balance layout vertically */}
        <View style={styles.topSpacer} />

        {/* Main centered content */}
        <View style={styles.centerContent}>
          {/* Official Lumen Badge */}
          <LumenLogo variant="badge" size={84} style={styles.logoBadge} />

          <Text style={[styles.title, { color: palette.text }]}>Lumen is Locked</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Your health logs and sensitive medical data are protected.
          </Text>

          {authError ? (
            <View style={[styles.errorBox, { backgroundColor: palette.error + '14', borderColor: palette.error + '38' }]}>
              <Text style={[styles.errorText, { color: palette.errorText }]}>{authError}</Text>
            </View>
          ) : null}

          {/* Primary Unlock Action */}
          <TouchableOpacity
            style={[styles.unlockButton, { backgroundColor: palette.primary }]}
            onPress={handleUnlockPress}
            disabled={isAuthenticating}
            activeOpacity={0.85}
          >
            {isAuthenticating ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <BiometricIcon size={22} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.unlockButtonText}>{biometricLabel}</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={[styles.passcodeHint, { color: palette.textDisabled }]}>
            You can also use your device PIN or pattern
          </Text>
        </View>

        {/* Footer Emergency Action with safe margin */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.logoutBtn, { borderColor: palette.border, backgroundColor: palette.surface + '66' }]}
            onPress={handleLogoutPress}
            activeOpacity={0.7}
          >
            <LogOut size={16} color={palette.textSecondary} />
            <Text style={[styles.logoutText, { color: palette.textSecondary }]}>Log Out of Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  topSpacer: {
    height: 32,
  },
  centerContent: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  logoBadge: {
    marginBottom: 20,
  },
  title: {
    ...typography.h2,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  errorBox: {
    width: '100%',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: 'center',
  },
  errorText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  unlockButton: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  unlockButtonText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
    fontSize: 16,
  },
  passcodeHint: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 14,
    textAlign: 'center',
  },
  footer: {
    marginBottom: 20,
    alignSelf: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 9999,
    borderWidth: 1,
  },
  logoutText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
  },
});
