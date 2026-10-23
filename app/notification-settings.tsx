import React, { useEffect } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Minus, Plus } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../src/theme/ThemeContext';
import { typography } from '../src/theme/typography';
import { useIntelligenceStore, PolicyPatch } from '../src/store/intelligenceStore';
import { parseHHMM } from '../src/services/intelligence/budgetEngine';

const CAPABILITIES: Array<{
  key: 'adaptiveTiming' | 'triggerWatch' | 'flareRisk' | 'pacing';
  label: string;
  description: string;
}> = [
  {
    key: 'adaptiveTiming',
    label: 'Smarter reminder times',
    description: 'Suggests moving reminders to the times you usually respond. Medication times are never changed for you.',
  },
  {
    key: 'triggerWatch',
    label: 'Check-ins after a possible trigger',
    description: 'After you log something you have linked to symptoms before, asks how you feel at the time your own history suggests.',
  },
  {
    key: 'flareRisk',
    label: 'Gentle heads-ups',
    description: 'Points out when recent sleep and symptoms look like days you later logged a flare. An observation, never a prediction.',
  },
  {
    key: 'pacing',
    label: 'Pacing nudges',
    description: 'Lets you know when an activity runs well past your usual, so you can choose to pause.',
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
  const trackColor = { false: palette.border, true: palette.primary };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.title} accessibilityRole="header">Notifications & Intelligence</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>
          Lumen only points out patterns in your own logs. It never says what caused a symptom and never suggests changing treatment.
          Reminders you set yourself are not affected by anything on this page.
        </Text>
        {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Smart notifications</Text>
              <Text style={styles.desc}>Turn all of the options below on or off at once.</Text>
            </View>
            <Switch
              value={policy.masterEnabled}
              onValueChange={v => patch({ masterEnabled: v })}
              trackColor={trackColor}
              accessibilityLabel="Smart notifications"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>What Lumen can tell you</Text>
        <View style={[styles.card, off && styles.dimmed]}>
          {CAPABILITIES.map((c, i) => (
            <View key={c.key} style={[styles.row, i > 0 && styles.divider]}>
              <View style={styles.rowText}>
                <Text style={styles.label}>{c.label}</Text>
                <Text style={styles.desc}>{c.description}</Text>
              </View>
              <Switch
                value={policy.capabilities[c.key]}
                disabled={off}
                onValueChange={v => patch({ capabilities: { [c.key]: v } })}
                trackColor={trackColor}
                accessibilityLabel={c.label}
              />
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>How often</Text>
        <View style={[styles.card, off && styles.dimmed]}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Most per day</Text>
              <Text style={styles.desc}>Extra observations wait for you in the "For you today" card.</Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepBtn}
                disabled={off || policy.dailyBudget <= 1}
                onPress={() => patch({ dailyBudget: policy.dailyBudget - 1 })}
                accessibilityRole="button"
                accessibilityLabel="Fewer notifications per day"
              >
                <Minus size={18} color={palette.text} />
              </TouchableOpacity>
              <Text style={styles.stepValue} accessibilityLabel={`${policy.dailyBudget} per day`}>{policy.dailyBudget}</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                disabled={off || policy.dailyBudget >= 5}
                onPress={() => patch({ dailyBudget: policy.dailyBudget + 1 })}
                accessibilityRole="button"
                accessibilityLabel="More notifications per day"
              >
                <Plus size={18} color={palette.text} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quiet hours</Text>
        <View style={[styles.card, off && styles.dimmed]}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Hold notifications overnight</Text>
              <Text style={styles.desc}>Held items arrive when quiet hours end. Medication reminders still ring.</Text>
            </View>
            <Switch
              value={policy.quietHours.enabled}
              disabled={off}
              onValueChange={v => patch({ quietHours: { enabled: v } })}
              trackColor={trackColor}
              accessibilityLabel="Quiet hours"
            />
          </View>
          {policy.quietHours.enabled && (
            <>
              {(['start', 'end'] as const).map(which => (
                <View key={which} style={[styles.row, styles.divider]}>
                  <Text style={styles.label}>{which === 'start' ? 'Starts at' : 'Ends at'}</Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      disabled={off}
                      onPress={() => patch({ quietHours: { [which]: shiftTime(policy.quietHours[which], -30) } })}
                      accessibilityRole="button"
                      accessibilityLabel={`Move quiet hours ${which} 30 minutes earlier`}
                    >
                      <Minus size={18} color={palette.text} />
                    </TouchableOpacity>
                    <Text style={styles.timeValue}>{formatTime(policy.quietHours[which])}</Text>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      disabled={off}
                      onPress={() => patch({ quietHours: { [which]: shiftTime(policy.quietHours[which], 30) } })}
                      accessibilityRole="button"
                      accessibilityLabel={`Move quiet hours ${which} 30 minutes later`}
                    >
                      <Plus size={18} color={palette.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>Flare mode</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Flare mode</Text>
              <Text style={styles.desc}>
                Keeps everything quiet except medication reminders while you are having a hard time.
              </Text>
            </View>
            <Switch
              value={policy.flareMode.active}
              onValueChange={v => setFlareMode(v)}
              trackColor={trackColor}
              accessibilityLabel="Flare mode"
            />
          </View>
          <View style={[styles.row, styles.divider]}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Turn on automatically</Text>
              <Text style={styles.desc}>
                When your logged symptoms stay above your own usual range for two days in a row. Needs about two weeks of logs.
              </Text>
            </View>
            <Switch
              value={policy.flareMode.auto}
              onValueChange={v => patch({ flareAutoDetect: v })}
              trackColor={trackColor}
              accessibilityLabel="Turn on flare mode automatically"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  safe: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h3, color: palette.text, flex: 1 },
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },
  intro: { ...typography.small, color: palette.textSecondary, lineHeight: 20 },
  error: { ...typography.small, color: palette.error },
  sectionTitle: { ...typography.h4, color: palette.text, marginTop: 12 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  dimmed: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, minHeight: 56 },
  divider: { borderTopWidth: 1, borderTopColor: palette.border },
  rowText: { flex: 1, gap: 2 },
  label: { ...typography.bodyBold, color: palette.text },
  desc: { ...typography.small, color: palette.textSecondary, lineHeight: 18 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  stepValue: { ...typography.h3, color: palette.text, minWidth: 28, textAlign: 'center' },
  timeValue: { ...typography.bodyBold, color: palette.text, minWidth: 84, textAlign: 'center' },
}));
