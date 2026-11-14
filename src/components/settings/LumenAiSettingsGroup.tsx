/**
 * Settings → "Lumen AI": full access to all of the member's own data, and separately photos.
 * Turning full access on shows the Gemini free-tier notice first; turning photos on needs the
 * photo PIN when one is set (the server checks it — see server/src/routes/ai.ts POST /access).
 */
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { BrainCircuit, ImageIcon, MessageCircle } from 'lucide-react-native';
import { InsetGroup, GroupedRow } from '../ios/InsetGroup';
import { PhotoPinModal } from '../common/PhotoPinModal';
import { useAiAccess, useSetAiAccess, type AiAccessChange } from '../../hooks/useAiChat';

const PURPLE = '#AF52DE';
const INDIGO = '#5856D6';
const GRAY = '#8E8E93';

export const FREE_TIER_NOTICE =
  'Lumen AI sends your logs, notes, medicines, records and (if you allow) photos — including sensitive ones — to Google Gemini to analyse them.\n\n' +
  'Your key is on Gemini’s free tier. Under Google’s terms, free-tier content may be used to improve Google’s models and may be read by human reviewers.\n\n' +
  'You can turn this off at any time. Chats and weekly reviews stay in your Lumen account.';

export function LumenAiSettingsGroup() {
  const access = useAiAccess();
  const setAccess = useSetAiAccess();
  const [pinVisible, setPinVisible] = useState(false);
  const a = access.data;

  const apply = (change: AiAccessChange) =>
    setAccess.mutate(change, {
      onError: err => Alert.alert('Lumen AI', err instanceof Error ? err.message : 'Could not change this setting.'),
    });

  const onToggleFull = (on: boolean) => {
    if (!on) {
      apply({ fullAccess: false });
      return;
    }
    Alert.alert('Before you turn on Lumen AI', FREE_TIER_NOTICE, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'I understand, turn on', onPress: () => apply({ fullAccess: true, acknowledgeFreeTier: true }) },
    ]);
  };

  const onTogglePhotos = (on: boolean) => {
    if (!on) {
      apply({ photoAccess: false });
      return;
    }
    if (a?.hasPhotoPin) {
      setPinVisible(true);
      return;
    }
    Alert.alert(
      'Let Lumen AI see photos?',
      'This includes sensitive photos such as stool, urine or skin. They are sent to Google Gemini when Lumen AI looks at them.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Allow', onPress: () => apply({ photoAccess: true }) }],
    );
  };

  const footer = !a
    ? undefined
    : !a.configured
      ? 'The server has no Gemini API key, so Lumen AI cannot run yet.'
      : a.fullAccess
        ? `On. Lumen AI can read all your own data${a.photoAccess ? ', including photos' : ' except photos'}. Uses Gemini free tier (${a.model}): Google may use this data to improve its models.`
        : 'Off. When on, Lumen AI can read everything you log — notes, medicines, records and optionally photos — to answer questions and write a weekly review.';

  return (
    <>
      <InsetGroup title="Lumen AI" footer={footer}>
        <GroupedRow
          icon={BrainCircuit}
          tile={PURPLE}
          label="Lumen AI full access"
          toggle
          toggled={!!a?.fullAccess}
          onToggle={onToggleFull}
          disabled={!a || !a.configured || setAccess.isPending}
        />
        <GroupedRow
          icon={ImageIcon}
          tile={INDIGO}
          label="Include photos (incl. sensitive)"
          toggle
          toggled={!!a?.photoAccess}
          onToggle={onTogglePhotos}
          disabled={!a?.fullAccess || setAccess.isPending}
        />
        <GroupedRow
          icon={MessageCircle}
          tile={GRAY}
          label="Open Lumen AI"
          chevron
          onPress={() => router.push('/ai')}
          disabled={!a?.fullAccess}
        />
      </InsetGroup>
      <PhotoPinModal
        visible={pinVisible}
        pinOnly
        title="Allow photos for Lumen AI"
        subtitle="Enter your 4-digit photo PIN to let Lumen AI look at your photos"
        onClose={() => setPinVisible(false)}
        onSuccess={pin => {
          setPinVisible(false);
          if (pin) apply({ photoAccess: true, pin });
        }}
      />
    </>
  );
}
