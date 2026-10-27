import React, { useEffect, useRef, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  LogOut,
  Trash2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Info,
} from 'lucide-react-native';
import { useAlertStore, AlertButtonConfig, AlertIconType } from './alertStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function CustomAlertModal() {
  const { currentAlert, hideAlert } = useAlertStore();
  const { palette, colorScheme } = useTheme();

  const isDark = colorScheme === 'dark';
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentAlert) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.spring(animValue, {
        toValue: 1,
        damping: 18,
        stiffness: 220,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 160,
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
    // If exactly 2 buttons and the first isn't cancel but the second is,
    // reorder so Cancel is always on the left for standard UX
    if (
      currentAlert.buttons.length === 2 &&
      currentAlert.buttons[0].style !== 'cancel' &&
      currentAlert.buttons[1].style === 'cancel'
    ) {
      return [currentAlert.buttons[1], currentAlert.buttons[0]];
    }
    return currentAlert.buttons;
  }, [currentAlert]);

  if (!currentAlert) return null;

  const { title, message, icon } = currentAlert;

  const iconDetails = getIconConfig(icon || 'info', palette);

  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const modalScale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1],
  });

  const modalOpacity = animValue.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.7, 1],
  });

  return (
    <Modal
      transparent
      visible={!!currentAlert}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        {/* Dimmed backdrop with tap-to-dismiss */}
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>

        {/* Floating Centered Card */}
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#23201C' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              opacity: modalOpacity,
              transform: [{ scale: modalScale }],
            },
          ]}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          {/* Glowing Top Icon Badge */}
          <View
            style={[
              styles.iconBadge,
              {
                backgroundColor: iconDetails.bg,
                borderColor: iconDetails.border,
              },
            ]}
          >
            {iconDetails.element}
          </View>

          {/* Alert Title */}
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>

          {/* Alert Message */}
          {!!message && (
            <Text style={[styles.message, { color: palette.textSecondary }]}>
              {message}
            </Text>
          )}

          {/* Buttons Layout */}
          <View
            style={[
              styles.buttonsContainer,
              renderedButtons.length === 2 ? styles.buttonsRow : styles.buttonsColumn,
            ]}
          >
            {renderedButtons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';

              let btnBg = palette.primary;
              let textColor = '#FFFFFF';
              let btnBorder: string | undefined = undefined;

              if (isDestructive) {
                btnBg = '#EF4444';
                textColor = '#FFFFFF';
              } else if (isCancel) {
                btnBg = isDark ? '#2E2A24' : '#F4EEE6';
                btnBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                textColor = palette.text;
              }

              return (
                <TouchableOpacity
                  key={`alert-btn-${index}`}
                  style={[
                    styles.button,
                    renderedButtons.length === 2 && styles.buttonHalf,
                    {
                      backgroundColor: btnBg,
                      borderColor: btnBorder || 'transparent',
                      borderWidth: btnBorder ? 1 : 0,
                    },
                  ]}
                  onPress={() => handleButtonPress(btn)}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={btn.text || 'Button'}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: textColor },
                      isDestructive && styles.buttonTextDestructive,
                      isCancel && styles.buttonTextCancel,
                    ]}
                    numberOfLines={1}
                  >
                    {btn.text || 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function getIconConfig(type: AlertIconType, palette: any) {
  switch (type) {
    case 'logout':
      return {
        bg: 'rgba(255, 125, 77, 0.12)',
        border: 'rgba(255, 125, 77, 0.28)',
        element: <LogOut size={26} color="#FF7D4D" strokeWidth={2.2} />,
      };
    case 'delete':
      return {
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.28)',
        element: <Trash2 size={26} color="#EF4444" strokeWidth={2.2} />,
      };
    case 'warning':
      return {
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.28)',
        element: <AlertTriangle size={26} color="#F59E0B" strokeWidth={2.2} />,
      };
    case 'error':
      return {
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.28)',
        element: <AlertCircle size={26} color="#EF4444" strokeWidth={2.2} />,
      };
    case 'success':
      return {
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.28)',
        element: <CheckCircle2 size={26} color="#10B981" strokeWidth={2.2} />,
      };
    case 'help':
      return {
        bg: 'rgba(255, 107, 53, 0.12)',
        border: 'rgba(255, 107, 53, 0.28)',
        element: <HelpCircle size={26} color={palette.primaryText} strokeWidth={2.2} />,
      };
    case 'info':
    default:
      return {
        bg: 'rgba(59, 130, 246, 0.12)',
        border: 'rgba(59, 130, 246, 0.28)',
        element: <Info size={26} color="#3B82F6" strokeWidth={2.2} />,
      };
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 44, 380),
    borderRadius: 26,
    borderWidth: 1,
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 22,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.4,
        shadowRadius: 28,
      },
      android: {
        elevation: 20,
      },
      default: {},
    }),
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  message: {
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    letterSpacing: -0.15,
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  buttonsContainer: {
    width: '100%',
    marginTop: 4,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonsColumn: {
    flexDirection: 'column',
    gap: 10,
  },
  button: {
    height: 48,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonHalf: {
    flex: 1,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  buttonTextCancel: {
    fontWeight: '600',
  },
  buttonTextDestructive: {
    fontWeight: '700',
  },
});
