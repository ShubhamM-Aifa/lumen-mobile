import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { safeGoBack } from '../src/utils/navigation';
import { ArrowLeft, Minus, Plus, Clock, MessageCircleQuestion, Flame, BatteryMedium } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../src/theme/ThemeContext';
import { typography } from '../src/theme/typography';
import { LargeTitleHeader } from '../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../src/components/ios/GlassCircleButton';
import { InsetGroup, GroupedRow } from '../src/components/ios/InsetGroup';
import { useIntelligenceStore, PolicyPatch } from '../src/store/intelligenceStore';
import { parseHHMM } from '../src/services/intelligence/budgetEngine';

const CAPABILITIES: Array<{
  key: 'adaptiveTiming' | 'triggerWatch' | 'flareRisk' | 'pacing';
  label: string;
  description: string;
  icon: typeof Clock;
  tile: string;
}> = [
  {
    key: 'adaptiveTiming',
    label: 'Smarter reminder times',
    description: 'Suggests moving reminders to when you usually respond',
    icon: Clock,
    tile: '#007AFF',
  },
  {
    key: 'triggerWatch',
    label: 'Check-ins after a possible trigger',
    description: 'Asks how you feel after you log something linked to symptoms before',
    icon: MessageCircleQuestion,
    tile: '#FF9500',
  },
  {
    key: 'flareRisk',
    label: 'Gentle heads-ups',
    description: 'Points out when recent days look like days you later logged a flare',
    icon: Flame,
    tile: '#FF3B30',
  },
  {
    key: 'pacing',
    label: 'Pacing nudges',
    description: 'Lets you know when an activity runs well past your usual',
    icon: BatteryMedium,
    tile: '#34C759',
  },
];

function shiftTime(value: string, deltaMinutes: number): string {
  const total = (parseHHMM(value) + deltaMinutes + 24 * 60) % (24 * 60);
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function formatTime(value: string): string {
  const [h, m] = value.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export default function NotificationSettingsScreen() {
  const styles = useStyles();
  const { palette } = useTheme();
  const policy = useIntelligenceStore(s => s.policy);
  const error = useIntelligenceStore(s => s.error);
  const fetchPolicy = useIntelligenceStore(s => s.fetchPolicy);
  const updatePolicy = useIntelligenceStore(s => s.updatePolicy);
  const setFlareMode = useIntelligenceStore(s => s.setFlareMode);

  useEffect(() => { fetchPolicy(); }, [fetchPolicy]);

  const patch = (p: PolicyPatch) => { updatePolicy(p); };
  const off = !policy.masterEnabled;
  const quietOff = off || !policy.quietHours.enabled;

  const stepper = (opts: {
    value: string;
    onMinus: () => void;
    onPlus: () => void;
    minusDisabled?: boolean;
    plusDisabled?: boolean;
    minusLabel: string;
    plusLabel: string;
    valueLabel?: string;
  }) => (
    <View style={styles.stepper}>
      <TouchableOpacity
        style={[styles.stepBtn, opts.minusDisabled && styles.stepBtnOff]}
        disabled={opts.minusDisabled}
        onPress={opts.onMinus}
        accessibilityRole="button"
        accessibilityLabel={opts.minusLabel}
      >
        <Minus size={18} color={palette.text} />
      </TouchableOpacity>
      <Text style={styles.stepValue} accessibilityLabel={opts.valueLabel ?? opts.value} maxFontSizeMultiplier={1.3}>{opts.value}</Text>
      <TouchableOpacity
        style={[styles.stepBtn, opts.plusDisabled && styles.stepBtnOff]}
        disabled={opts.plusDisabled}
        onPress={opts.onPlus}
        accessibilityRole="button"
        accessibilityLabel={opts.plusLabel}
      >
        <Plus size={18} color={palette.text} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LargeTitleHeader
          title="Notifications & Intelligence"
          leading={
            <GlassCircleButton accessibilityLabel="Go back" onPress={() => safeGoBack('/notifications')}>
              <ArrowLeft size={22} color={palette.text} strokeWidth={2.2} />
            </GlassCircleButton>
          }
        />
        <Text style={styles.intro}>
          Lumen only points out patterns in your own logs. It never says what caused a symptom and never suggests changing treatment.
          Reminders you set yourself are not affected by anything on this page.
        </Text>
        {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}

        <InsetGroup footer="Turn all of the options below on or off at once.">
          <GroupedRow
            label="Smart notifications"
            toggle
            toggled={policy.masterEnabled}
            onToggle={v => patch({ masterEnabled: v })}
          />
        </InsetGroup>

        <View style={off && styles.dimmed}>
          <InsetGroup title="What Lumen can tell you" footer="Medication times are never changed for you.">
            {CAPABILITIES.map(c => (
              <GroupedRow
                key={c.key}
                icon={c.icon}
                tile={c.tile}
                label={c.label}
                sub={c.description}
                toggle
                disabled={off}
                toggled={policy.capabilities[c.key]}
                onToggle={v => patch({ capabilities: { [c.key]: v } })}
              />
            ))}
          </InsetGroup>
        </View>

        <View style={off && styles.dimmed}>
          <InsetGroup title="How often" footer={'Extra observations wait for you in the \u201cFor you today\u201d card.'}>
            <GroupedRow
              label="Most per day"
              trailing={stepper({
                value: String(policy.dailyBudget),
                valueLabel: `${policy.dailyBudget} per day`,
                minusDisabled: off || policy.dailyBudget <= 1,
                plusDisabled: off || policy.dailyBudget >= 5,
                onMinus: () => patch({ dailyBudget: policy.dailyBudget - 1 }),
                onPlus: () => patch({ dailyBudget: policy.dailyBudget + 1 }),
                minusLabel: 'Fewer notifications per day',
                plusLabel: 'More notifications per day',
              })}
            />
          </InsetGroup>
        </View>

        <View style={off && styles.dimmed}>
          <InsetGroup title="Quiet hours" footer="Held items arrive when quiet hours end. Medication reminders still ring.">
            <GroupedRow
              label="Hold notifications overnight"
              toggle
              disabled={off}
              toggled={policy.quietHours.enabled}
              onToggle={v => patch({ quietHours: { enabled: v } })}
              accessibilityLabel="Quiet hours"
            />
            {(['start', 'end'] as const).map(which => (
              <View key={which} style={quietOff && styles.dimmed}>
                <GroupedRow
                  label={which === 'start' ? 'From' : 'To'}
                  trailing={stepper({
                    value: formatTime(policy.quietHours[which]),
                    minusDisabled: quietOff,
                    plusDisabled: quietOff,
                    onMinus: () => patch({ quietHours: { [which]: shiftTime(policy.quietHours[which], -30) } }),
                    onPlus: () => patch({ quietHours: { [which]: shiftTime(policy.quietHours[which], 30) } }),
                    minusLabel: `Move quiet hours ${which} 30 minutes earlier`,
                    plusLabel: `Move quiet hours ${which} 30 minutes later`,
                  })}
                />
              </View>
            ))}
          </InsetGroup>
        </View>

        <InsetGroup title="Flare mode" footer="Flare mode keeps everything quiet except medication reminders. Turning it on automatically needs about two weeks of logs.">
          <GroupedRow
            label="Flare mode"
            sub="Switches Today to a simpler layout"
            toggle
            toggled={policy.flareMode.active}
            onToggle={v => setFlareMode(v)}
          />
          <GroupedRow
            label="Turn on automatically"
            sub="When your logged symptoms stay above your usual range for two days"
            toggle
            toggled={policy.flareMode.auto}
            onToggle={v => patch({ flareAutoDetect: v })}
            accessibilityLabel="Turn on flare mode automatically"
          />
        </InsetGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  safe: { flex: 1, backgroundColor: palette.background },
  scroll: { paddingTop: 6, paddingBottom: 48, gap: 22 },
  intro: { ...typography.footnote, color: palette.textSecondary, paddingHorizontal: 20, marginTop: -8 },
  error: { ...typography.footnote, color: palette.errorText, paddingHorizontal: 20 },
  dimmed: { opacity: 0.5 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  stepBtnOff: { opacity: 0.4 },
  stepValue: { ...typography.headline, color: palette.text, minWidth: 28, textAlign: 'center' },
}));
