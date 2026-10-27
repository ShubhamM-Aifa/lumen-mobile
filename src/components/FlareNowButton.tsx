/**
 * QuickLogButton — one-tap shortcut to log prioritized questions (max 5) across all categories.
 * Configured in /customize/quick-log-questions.
 */
import React, { useEffect, useRef } from 'react';
import { Text, View, Animated } from 'react-native';
import { router } from 'expo-router';
import { Zap } from 'lucide-react-native';
import { useConfigStore } from '../store/configStore';
import { useQuickLogConfigStore } from '../store/quickLogConfigStore';
import { useTheme, createThemedStyles } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { PressableScale } from './common/PressableScale';

export function QuickLogButton() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { config } = useConfigStore();
  const { selectedQuestionIds, loadSelectedQuestions } = useQuickLogConfigStore();
  const zapPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (config?.questions) {
      loadSelectedQuestions(config.questions);
    }
  }, [config?.questions, loadSelectedQuestions]);

  useEffect(() => {
    // Subtle ambient energy pulse for quick log zap icon
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(zapPulse, {
          toValue: 1.12,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(zapPulse, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [zapPulse]);

  const count = selectedQuestionIds.length;

  const handlePress = () => {
    router.push('/quick-log');
  };

  return (
    <PressableScale
      style={styles.btn}
      onPress={handlePress}
      haptic="medium"
      activeScale={0.97}
      accessibilityRole="button"
      accessibilityLabel={`Quick Log — fast entry for ${count > 0 ? count : 5} priority questions`}
    >
      <View style={styles.inner}>
        <View style={styles.iconCircle}>
          <Animated.View style={{ transform: [{ scale: zapPulse }] }}>
            <Zap size={20} color={palette.primaryText} fill={palette.primary} />
          </Animated.View>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Quick Log</Text>
            {count > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{count} questions</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.sub}>Fast entry for your key metrics</Text>
        </View>
      </View>
    </PressableScale>
  );
}

export const FlareNowButton = QuickLogButton;

const useStyles = createThemedStyles(palette => ({
  btn: {
    backgroundColor: palette.primary + '14',
    borderWidth: 1.5,
    borderColor: palette.primary + '40',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    ...typography.bodyBold,
    fontSize: 16,
    color: palette.text,
  },
  badge: {
    backgroundColor: palette.primary + '22',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: palette.primaryText,
  },
  sub: {
    ...typography.small,
    color: palette.textSecondary,
    marginTop: 2,
  },
}));
