import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { Footprints, Timer, ShieldCheck } from 'lucide-react-native';
import { InsetGroup, GroupedRow } from '../ios/InsetGroup';
import { useAutoWalkStore, AutoWalkStatus } from '../../store/autoWalkStore';

const GREEN = '#34C759';
const GRAY = '#8E8E93';

const FOOTER =
  'Lumen reads the steps your phone already counts, so you never have to press Start. ' +
  'No GPS and no extra battery. Walks it finds are marked “Auto-detected”, and you can remove any of them. ' +
  'Use Start Walking when you want an exact route.';

function statusLine(status: AutoWalkStatus, todaySteps: number | null, lastSyncAt: number | null): string {
  switch (status) {
    case 'unavailable':
      return Platform.OS === 'android' ? 'Needs Health Connect on this phone' : 'Step history isn’t available here';
    case 'no_access':
      return 'Step access is off in phone settings';
    case 'error':
      return 'Couldn’t check just now, will try again';
    case 'off':
      return 'Finds your walks without a Start button';
    default:
      if (todaySteps !== null) return `${todaySteps.toLocaleString()} steps today`;
      return lastSyncAt ? 'On' : 'Checking your steps…';
  }
}

/** Opens the place where the member can give step access back. */
function openStepAccessSettings(): void {
  if (Platform.OS === 'android') {
    try {
      const HC = require('react-native-health-connect') as typeof import('react-native-health-connect');
      HC.openHealthConnectSettings();
      return;
    } catch {
      // fall through to the app's own settings page
    }
  }
  Linking.openSettings().catch(() => {});
}

/** Settings group for "Track walks automatically". */
export function AutoWalkSettingsGroup() {
  const enabled = useAutoWalkStore(s => s.enabled);
  const status = useAutoWalkStore(s => s.status);
  const todaySteps = useAutoWalkStore(s => s.todaySteps);
  const lastSyncAt = useAutoWalkStore(s => s.lastSyncAt);
  const minWalkMinutes = useAutoWalkStore(s => s.minWalkMinutes);
  const [busy, setBusy] = useState(false);

  useEffect(() => { useAutoWalkStore.getState().hydrate().catch(() => {}); }, []);

  const onToggle = async (on: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const nowOn = await useAutoWalkStore.getState().setEnabled(on);
      if (on && !nowOn) {
        const why = useAutoWalkStore.getState().status;
        if (why === 'unavailable') {
          Alert.alert(
            'Step history not available',
            Platform.OS === 'android'
              ? 'Automatic walks use Health Connect, which is built into Android 14 and newer. On older phones, install Health Connect from the Play Store, then try again.'
              : 'This device doesn’t share step history with apps.',
          );
        } else if (why === 'no_access') {
          Alert.alert(
            'Step access needed',
            'Lumen needs to read your step count to find your walks. You can allow it in your phone’s settings.',
            [{ text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: openStepAccessSettings }],
          );
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <InsetGroup title="Activity" footer={FOOTER}>
      <GroupedRow
        icon={Footprints}
        tile={GREEN}
        label="Track Walks Automatically"
        sub={statusLine(status, todaySteps, lastSyncAt)}
        toggle
        toggled={enabled}
        onToggle={onToggle}
        disabled={busy}
      />
      {enabled ? (
        <GroupedRow
          icon={Timer}
          tile={GRAY}
          label="Shortest Walk"
          value={`${minWalkMinutes} min`}
          sub="Tap for 5 min on low-energy days"
          onPress={() => useAutoWalkStore.getState().setMinWalkMinutes(minWalkMinutes === 5 ? 10 : 5)}
          accessibilityLabel={`Shortest walk, ${minWalkMinutes} minutes. Double tap to change.`}
        />
      ) : null}
      {status === 'no_access' ? (
        <GroupedRow icon={ShieldCheck} tile={GRAY} label="Allow Step Access" chevron onPress={openStepAccessSettings} />
      ) : null}
    </InsetGroup>
  );
}
