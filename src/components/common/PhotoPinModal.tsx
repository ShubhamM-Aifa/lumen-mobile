import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Shield, Delete, Fingerprint, Lock, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { usePhotoVaultStore } from '../../store/photoVaultStore';
import { useSecurityStore } from '../../store/securityStore';
import { useAuthStore } from '../../store/authStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  subtitle?: string;
}

export function PhotoPinModal({ visible, onClose, onSuccess, title, subtitle }: Props) {
  const { palette } = useTheme();
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const { user } = useAuthStore();
  const isPrimaryUser = user?.authMethod === 'google';

  const { verifyPin, authenticateBiometrics, isBiometricEnabled } = usePhotoVaultStore();
  const { biometricType, hasHardware, isEnrolled } = useSecurityStore();

  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Auto-prompt biometrics ONLY for Primary User when modal appears if configured
  useEffect(() => {
    if (visible) {
      setPin('');
      setErrorMessage(null);
      if (isPrimaryUser && isBiometricEnabled && hasHardware && isEnrolled) {
        authenticateBiometrics(subtitle || 'Unlock Sensitive Photos').then((ok) => {
          if (ok) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onSuccess();
          }
        });
      }
    }
  }, [visible, isPrimaryUser, isBiometricEnabled, hasHardware, isEnrolled, subtitle]);

  const triggerShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleDigitPress = async (digit: string) => {
    if (pin.length >= 4 || isVerifying) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMessage(null);

    if (nextPin.length === 4) {
      setIsVerifying(true);
      const isValid = await verifyPin(nextPin);
      setIsVerifying(false);

      if (isValid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPin('');
        onSuccess();
      } else {
        triggerShake();
        setErrorMessage('Incorrect PIN. Please try again.');
        setPin('');
      }
    }
  };

  const handleDeletePress = () => {
    if (pin.length === 0 || isVerifying) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleBiometricPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ok = await authenticateBiometrics();
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close PIN dialog"
          >
            <X size={20} color={palette.textSecondary} />
          </TouchableOpacity>

          {/* Icon and title */}
          <View style={[styles.iconOrb, { backgroundColor: palette.primary + '18' }]}>
            <Lock size={26} color={palette.primary} strokeWidth={2.4} />
          </View>

          <Text style={[styles.title, { color: palette.text }]}>{title || 'Photo Vault Locked'}</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            {subtitle || (isPrimaryUser
              ? 'Enter your 4-digit PIN to view protected health photos'
              : "Enter the Primary Owner's 4-digit PIN to view protected health photos")}
          </Text>

          {/* PIN Indicators */}
          <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pin.length > idx;
              return (
                <View
                  key={`pin-dot-${idx}`}
                  style={[
                    styles.dot,
                    {
                      borderColor: errorMessage ? '#EF4444' : palette.border,
                      backgroundColor: isFilled
                        ? errorMessage
                          ? '#EF4444'
                          : palette.primary
                        : 'transparent',
                    },
                  ]}
                />
              );
            })}
          </Animated.View>

          {/* Error Message */}
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : isVerifying ? (
            <View style={styles.verifyingRow}>
              <ActivityIndicator size="small" color={palette.primary} />
              <Text style={[styles.verifyingText, { color: palette.textSecondary }]}>Verifying…</Text>
            </View>
          ) : (
            <View style={{ height: 20 }} />
          )}

          {/* Numeric Keypad */}
          <View style={styles.keypad}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
            ].map((row, rowIdx) => (
              <View key={`key-row-${rowIdx}`} style={styles.keyRow}>
                {row.map((digit) => (
                  <TouchableOpacity
                    key={`key-${digit}`}
                    style={[styles.keyBtn, { backgroundColor: palette.surfaceAlt }]}
                    onPress={() => handleDigitPress(digit)}
                    activeOpacity={0.65}
                  >
                    <Text style={[styles.keyDigit, { color: palette.text }]}>{digit}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Bottom Row: Biometrics (Only for Primary User), 0, Backspace */}
            <View style={styles.keyRow}>
              {isPrimaryUser && hasHardware && isEnrolled ? (
                <TouchableOpacity
                  style={[styles.keyBtn, styles.actionKeyBtn]}
                  onPress={handleBiometricPress}
                  activeOpacity={0.65}
                  accessibilityRole="button"
                  accessibilityLabel="Unlock with biometrics"
                >
                  <Fingerprint size={24} color={palette.primary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.keyBtnEmpty} />
              )}

              <TouchableOpacity
                style={[styles.keyBtn, { backgroundColor: palette.surfaceAlt }]}
                onPress={() => handleDigitPress('0')}
                activeOpacity={0.65}
              >
                <Text style={[styles.keyDigit, { color: palette.text }]}>0</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.keyBtn, styles.actionKeyBtn]}
                onPress={handleDeletePress}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel="Delete last digit"
              >
                <Delete size={22} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    borderRadius: 16,
    zIndex: 10,
  },
  iconOrb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    marginTop: 4,
  },
  title: {
    ...typography.h3,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    ...typography.caption,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  errorText: {
    ...typography.caption,
    color: '#EF4444',
    fontWeight: '600',
    height: 20,
    textAlign: 'center',
  },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 20,
  },
  verifyingText: {
    ...typography.caption,
    fontSize: 12,
  },
  keypad: {
    width: '100%',
    gap: 12,
    marginTop: 10,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  keyBtn: {
    width: 68,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionKeyBtn: {
    backgroundColor: 'transparent',
  },
  keyBtnEmpty: {
    width: 68,
    height: 56,
  },
  keyDigit: {
    fontSize: 22,
    fontWeight: '700',
  },
});
