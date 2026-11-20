/**
 * Opened from someone's invite link (lumen://community/invite/<code>): shows who it belongs to
 * and lets you start the chat. Nothing is sent until you tap Message.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeContext';
import { useCommunityStore } from '../../../src/store/communityStore';
import { ModularAvatar } from '../../../src/components/avatar/ModularAvatar';
import { getDeterministicAvatarConfig } from '../../../src/store/avatarStore';
import { extractInviteCode } from '../../../src/utils/community/invites';
import { ScreenTopBar } from '../../../src/components/ios/ScreenTopBar';

export default function InviteScreen() {
  const { palette } = useTheme();
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = extractInviteCode(Array.isArray(raw) ? raw[0] : raw);
  const { previewInvite, openInvite, fetchDms } = useCommunityStore();
  const [who, setWho] = useState<{ displayName: string; handle: string | null } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!code) { setState('invalid'); return undefined; }
    previewInvite(code)
      .then(w => { if (alive) { setWho(w); setState('ready'); } })
      .catch(() => { if (alive) setState('invalid'); });
    return () => { alive = false; };
  }, [code, previewInvite]);

  const open = async () => {
    if (!code || opening) return;
    setOpening(true);
    setError(null);
    try {
      const dm = await openInvite(code);
      fetchDms().catch(() => {});
      router.replace({ pathname: '/community/[channelId]', params: { channelId: dm.slug || dm._id } });
    } catch (err: any) {
      setError(err?.message || 'Could not open the chat. Please try again.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]} edges={['top']}>
      <ScreenTopBar title="Invite" fallbackRoute="/(tabs)/community" />
      <View style={styles.body}>
        {state === 'loading' ? <ActivityIndicator color={palette.primaryText} /> : null}

        {state === 'invalid' ? (
          <>
            <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">This link doesn’t work</Text>
            <Text style={[styles.help, { color: palette.textSecondary }]}>
              It may have been switched off or replaced, or it was copied wrongly. Ask them for a new one.
            </Text>
          </>
        ) : null}

        {state === 'ready' && who ? (
          <>
            <View style={[styles.avatar, { backgroundColor: palette.surface, overflow: 'hidden' }]}>
              <ModularAvatar size={72} animated={false} config={getDeterministicAvatarConfig(who.displayName)} />
            </View>
            <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">{who.displayName}</Text>
            {who.handle ? <Text style={[styles.help, { color: palette.textSecondary }]}>@{who.handle}</Text> : null}
            <Text style={[styles.help, { color: palette.textSecondary }]}>
              {who.displayName} shared this link so you can message them. Your chat is private between the two of you.
            </Text>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: palette.primary }]}
              onPress={open}
              disabled={opening}
              accessibilityRole="button"
              accessibilityLabel={`Message ${who.displayName}`}
            >
              {opening ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnText}>Message {who.displayName}</Text>}
            </TouchableOpacity>
            {error ? <Text style={{ color: palette.error, textAlign: 'center' }}>{error}</Text> : null}
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  help: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  btn: { minHeight: 50, borderRadius: 25, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
