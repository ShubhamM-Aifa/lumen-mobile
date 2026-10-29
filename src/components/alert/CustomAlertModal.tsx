import React, { useEffect, useRef, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAlertStore, AlertButtonConfig } from './alertStore';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Authentic Apple iOS `UIAlertController` dialog.
 * 
 * Implements Apple HIG specification:
 * - 270pt width with continuous 14pt rounded corners
 * - Translucent frosted acrylic surface with backdrop blur
 * - Standard 0.5pt hairline dividers
 * - Flat translucent tap targets with subtle press highlight (no pill buttons)
 * - Precise typography: 17pt headline title, 13pt body message
 * - iOS system blue (#0A84FF / #007AFF) and destructive red (#FF453A / #FF3B30)
 * - No Android/Bootstrap-style top icon badges
 */
export function CustomAlertModal() {
  const { currentAlert, hideAlert } = useAlertStore();
  const { colorScheme } = useTheme();

  const isDark = colorScheme === 'dark';
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentAlert) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.spring(animValue, {
        toValue: 1,
        damping: 24,
        stiffness: 260,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }).start();
    }
  }, [currentAlert, animValue]);

  const handleDismiss = () => {
    if (currentAlert?.options?.cancelable === false) return;

    // If there is a cancel button in the alert, trigger its onPress
    const cancelBtn = currentAlert?.buttons?.find((b) => b.style === 'cancel');
    if (cancelBtn?.onPress) {
      cancelBtn.onPress();
    } else if (currentAlert?.options?.onDismiss) {
      currentAlert.options.onDismiss();
    }

    hideAlert();
  };

  const handleButtonPress = (btn: AlertButtonConfig) => {
    if (btn.style === 'destructive') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (btn.style === 'cancel') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    hideAlert();
    if (btn.onPress) {
      btn.onPress();
    }
  };

  const renderedButtons: AlertButtonConfig[] = useMemo(() => {
    if (!currentAlert) return [];
    if (!currentAlert.buttons || currentAlert.buttons.length === 0) {
      return [{ text: 'OK', style: 'default' }];
    }
    // In iOS 2-button alerts, Cancel is always on the left, primary/destructive on the right
    if (
      currentAlert.buttons.length === 2 &&
      currentAlert.buttons[0].style !== 'cancel' &&
      currentAlert.buttons[1].style === 'cancel'
    ) {
      return [currentAlert.buttons[1], currentAlert.buttons[0]];
    }
    // In 3+ button alerts, Cancel is conventionally at the bottom
    if (currentAlert.buttons.length > 2) {
      const cancelIdx = currentAlert.buttons.findIndex((b) => b.style === 'cancel');
      if (cancelIdx >= 0 && cancelIdx < currentAlert.buttons.length - 1) {
        const copy = [...currentAlert.buttons];
        const [cancelBtn] = copy.splice(cancelIdx, 1);
        copy.push(cancelBtn);
        return copy;
      }
    }
    return currentAlert.buttons;
  }, [currentAlert]);

  if (!currentAlert) return null;

  const { title, message } = currentAlert;

  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const modalScale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1.08, 1],
  });

  const modalOpacity = animValue.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.7, 1],
  });

  // iOS Color Palette Tokens
  const cardBg = isDark ? 'rgba(37, 37, 38, 0.94)' : 'rgba(242, 242, 244, 0.94)';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)';
  const dividerColor = isDark ? 'rgba(84, 84, 88, 0.65)' : 'rgba(60, 60, 67, 0.29)';
  const titleColor = isDark ? '#FFFFFF' : '#000000';
  const messageColor = isDark ? 'rgba(235, 235, 245, 0.8)' : 'rgba(60, 60, 67, 0.75)';
  const systemBlue = isDark ? '#0A84FF' : '#007AFF';
  const destructiveRed = isDark ? '#FF453A' : '#FF3B30';
  const pressedBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';

  const isTwoButtons = renderedButtons.length === 2;
  const isOneButton = renderedButtons.length === 1;

  return (
    <Modal
      transparent
      visible={!!currentAlert}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        {/* iOS Dimmed Backdrop (tap-to-dismiss when cancelable) */}
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>

        {/* Authentic iOS UIAlertController Card */}
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              borderColor: cardBorder,
              opacity: modalOpacity,
              transform: [{ scale: modalScale }],
            },
          ]}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          {/* Content Area: Title & Body Message */}
          <View style={styles.contentArea}>
            <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
            {!!message && (
              <Text style={[styles.message, { color: messageColor }]}>
                {message}
              </Text>
            )}
          </View>

          {/* Top Hairline Separator above buttons */}
          <View style={[styles.horizontalDivider, { backgroundColor: dividerColor }]} />

          {/* Action Buttons */}
          {isTwoButtons ? (
            /* Standard 2-button horizontal layout: [Cancel] | [Confirm/Destructive] */
            <View style={styles.twoButtonsRow}>
              {renderedButtons.map((btn, index) => {
                const isCancel = btn.style === 'cancel';
                const isDestructive = btn.style === 'destructive';
                const textColor = isDestructive ? destructiveRed : systemBlue;
                const isBold = isCancel || (!isDestructive && index === 1);

                return (
                  <React.Fragment key={`alert-btn-${index}`}>
                    {index === 1 && (
                      <View style={[styles.verticalDivider, { backgroundColor: dividerColor }]} />
                    )}
                    <Pressable
                      style={({ pressed }) => [
                        styles.halfButton,
                        pressed && { backgroundColor: pressedBg },
                      ]}
                      onPress={() => handleButtonPress(btn)}
                      accessibilityRole="button"
                      accessibilityLabel={btn.text || 'Action'}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          { color: textColor, fontWeight: isBold ? '600' : '400' },
                        ]}
                        numberOfLines={1}
                      >
                        {btn.text || 'OK'}
                      </Text>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>
          ) : isOneButton ? (
            /* Single full-width button (e.g. [OK]) */
            <Pressable
              style={({ pressed }) => [
                styles.fullButton,
                pressed && { backgroundColor: pressedBg },
              ]}
              onPress={() => handleButtonPress(renderedButtons[0])}
              accessibilityRole="button"
              accessibilityLabel={renderedButtons[0]?.text || 'OK'}
            >
              <Text style={[styles.buttonText, { color: systemBlue, fontWeight: '600' }]}>
                {renderedButtons[0]?.text || 'OK'}
              </Text>
            </Pressable>
          ) : (
            /* 3+ buttons stacked vertically */
            <View style={styles.multiButtonsColumn}>
              {renderedButtons.map((btn, index) => {
                const isCancel = btn.style === 'cancel';
                const isDestructive = btn.style === 'destructive';
                const textColor = isDestructive ? destructiveRed : systemBlue;

                return (
                  <React.Fragment key={`alert-btn-${index}`}>
                    {index > 0 && (
                      <View style={[styles.horizontalDivider, { backgroundColor: dividerColor }]} />
                    )}
                    <Pressable
                      style={({ pressed }) => [
                        styles.fullButton,
                        pressed && { backgroundColor: pressedBg },
                      ]}
                      onPress={() => handleButtonPress(btn)}
                      accessibilityRole="button"
                      accessibilityLabel={btn.text || 'Action'}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          { color: textColor, fontWeight: isCancel ? '600' : '400' },
                        ]}
                        numberOfLines={1}
                      >
                        {btn.text || 'Action'}
                      </Text>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  card: {
    width: 270,
    maxWidth: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.35,
        shadowRadius: 28,
      },
      android: {
        elevation: 20,
      },
      web: {
        backdropFilter: 'blur(30px) saturate(190%)',
        WebkitBackdropFilter: 'blur(30px) saturate(190%)',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.45)',
      } as any,
      default: {},
    }),
  },
  contentArea: {
    paddingTop: 20,
    paddingBottom: 19,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  message: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  horizontalDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  verticalDivider: {
    width: StyleSheet.hairlineWidth,
    height: 44,
  },
  twoButtonsRow: {
    flexDirection: 'row',
    height: 44,
    width: '100%',
  },
  halfButton: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  fullButton: {
    width: '100%',
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  multiButtonsColumn: {
    width: '100%',
  },
  buttonText: {
    fontSize: 17,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
});
