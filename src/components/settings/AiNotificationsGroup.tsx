/**
 * Notification settings → "Lumen AI notifications": a morning briefing, a midday nudge and an
 * evening check-in written by Lumen AI from all of the member's data, plus a reply when they log
 * something serious. Pushed by the server; they count toward the same daily limit and respect
 * quiet hours and flare mode. Only works while Lumen AI full access is on.
 */
import React from 'react';
import { View, Alert } from 'react-native';
import { router } from 'expo-router';
import { Sun, Sparkles, MoonStar, ShieldAlert, Send } from 'lucide-react-native';
import { InsetGroup, GroupedRow } from '../ios/InsetGroup';
import { useAiAccess, useSendTestAiNotification } from '../../hooks/useAiChat';
import type { PolicyPatch, ServerPolicy } from '../../store/intelligenceStore';

type TimeKey = keyof ServerPolicy['aiTimes'];

const KINDS: Array<{
  key: 'aiBriefing' | 'aiNudge' | 'aiCheckIn' | 'aiLogReply';
  time?: TimeKey;
  label: string;
  sub: string;
  icon: typeof Sun;
  tile: string;
}> = [
  { key: 'aiBriefing', time: 'briefing', label: 'Morning briefing', sub: 'How yesterday went and one thing to focus on today', icon: Sun, tile: '#FF9500' },
  { key: 'aiNudge', time: 'nudge', label: 'Midday nudge', sub: 'Only when something you logged today matters (it often stays quiet)', icon: Sparkles, tile: '#AF52DE' },
  { key: 'aiCheckIn', time: 'checkIn', label: 'Evening check-in', sub: 'One personal question about your day', icon: MoonStar, tile: '#5856D6' },
  { key: 'aiLogReply', label: 'Reply to serious logs', sub: 'When you log a fever, very bad pain or another warning sign', icon: ShieldAlert, tile: '#FF3B30' },
];

const NOT_PUSHED: Record<string, string> = {
  no_token: 'Lumen AI wrote it, but this phone is not registered for push yet. Open the app once after installing the new build (with Firebase set up), then try again.',
  failed: 'Lumen AI wrote it, but the push service did not accept it. Please try again later.',
  skip: 'Lumen AI had nothing to say right now.',
  bad_format: 'Lumen AI’s answer could not be used. Please try again.',
  rate_limited: 'The AI is busy (free-tier limit). Try again in a little while.',
  busy: 'The AI is overloaded right now. Try again in a minute.',
  off: 'Turn on Lumen AI full access first.',
};

export interface AiNotificationsGroupProps {
  policy: ServerPolicy;
  /** The master "Smart notifications" switch is off. */
  off: boolean;
  patch: (p: PolicyPatch) => void;
  /** The screen's ±30 minute stepper. */
  renderTimeStepper: (opts: { value: string; onMinus: () => void; onPlus: () => void; disabled: boolean; label: string }) => React.ReactNode;
  shiftTime: (value: string, deltaMinutes: number) => string;
  formatTime: (value: string) => string;
}

export function AiNotificationsGroup({ policy, off, patch, renderTimeStepper, shiftTime, formatTime }: AiNotificationsGroupProps) {
  const access = useAiAccess();
  const test = useSendTestAiNotification();
  const aiOn = !!access.data?.fullAccess;
  const disabled = off || !aiOn;

  const footer = !aiOn
    ? 'Turn on Lumen AI full access (Settings → Lumen AI) to get these.'
    : `Written by ${access.data?.modelLabel ?? 'Lumen AI'} from all your data and sent by push through Expo and Google. They count toward your ${policy.dailyBudget} per day; anything over waits in “For you today”.${
      access.data?.provider === 'claude' ? ' Each one is a paid Claude call (about ₹1–15).' : ''}`;

  const sendTest = () =>
    test.mutate(undefined, {
      onSuccess: res => {
        if (res.notification?.pushed) {
          Alert.alert('Test sent', `“${res.notification.title}” should arrive in a few seconds, even with the app closed.`);
        } else {
          Alert.alert('Not sent', NOT_PUSHED[res.error ?? ''] ?? 'Please try again later.');
        }
      },
      onError: err => Alert.alert('Not sent', err instanceof Error ? err.message : 'Please try again later.'),
    });

  return (
    <View style={disabled ? { opacity: 0.5 } : undefined}>
      <InsetGroup title="Lumen AI notifications" footer={footer}>
        {!aiOn ? (
          <GroupedRow icon={Sparkles} tile="#AF52DE" label="Turn on Lumen AI" chevron onPress={() => router.push('/settings')} />
        ) : null}
        {KINDS.map(k => {
          const on = policy.capabilities[k.key] !== false;
          return (
            <React.Fragment key={k.key}>
              <GroupedRow
                icon={k.icon}
                tile={k.tile}
                label={k.label}
                sub={k.sub}
                toggle
                disabled={disabled}
                toggled={on}
                onToggle={v => patch({ capabilities: { [k.key]: v } })}
              />
              {k.time && on ? (
                <GroupedRow
                  label="Time"
                  trailing={renderTimeStepper({
                    value: formatTime(policy.aiTimes[k.time]),
                    disabled,
                    label: k.label,
                    onMinus: () => patch({ aiTimes: { [k.time as TimeKey]: shiftTime(policy.aiTimes[k.time as TimeKey], -30) } }),
                    onPlus: () => patch({ aiTimes: { [k.time as TimeKey]: shiftTime(policy.aiTimes[k.time as TimeKey], 30) } }),
                  })}
                />
              ) : null}
            </React.Fragment>
          );
        })}
        <GroupedRow
          icon={Send}
          tile="#007AFF"
          label={test.isPending ? 'Writing a test…' : 'Send a test notification'}
          sub="Lumen AI writes a briefing now and pushes it (3 a day)"
          onPress={sendTest}
          disabled={disabled || test.isPending}
        />
      </InsetGroup>
    </View>
  );
}
