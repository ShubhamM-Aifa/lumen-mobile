/**
 * "My invite link": share a personal link (and optional @handle) so anyone with a Lumen account
 * can message you, even when you share no community. Switch it off or replace it at any time.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Share, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { X, Copy, Share2, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useCommunityStore, type DmInvite } from '../../store/communityStore';
import { AppleSwitch } from '../common/AppleSwitch';
import { inviteShareText, validHandle } from '../../utils/community/invites';

export const DmInviteModal: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const { palette } = useTheme();
  const { getMyInvite, setMyHandle, rotateMyInvite, setInviteEnabled } = useCommunityStore();
  const [invite, setInvite] = useState<DmInvite | null>(null);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const inv = await getMyInvite();
      setInvite(inv);
      setHandle(inv.handle ?? '');
    } catch (err: any) {
      setError(err?.message || 'Could not load your invite link.');
    }
  }, [getMyInvite]);

  useEffect(() => { if (visible) load(); else { setInvite(null); setError(null); } }, [visible, load]);

  const run = async (fn: () => Promise<DmInvite>, failTitle: string) => {
    setBusy(true);
    try {
      const inv = await fn();
      setInvite(inv);
      setHandle(inv.handle ?? '');
    } catch (err: any) {
      Alert.alert(failTitle, err?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveHandle = () => {
    const trimmed = handle.trim();
    if (!trimmed) return run(() => setMyHandle(null), 'Could not remove the @name');
    const v = validHandle(trimmed);
    if (!v.ok) { Alert.alert('That @name will not work', v.reason); return; }
    return run(() => setMyHandle(v.handle), 'Could not save the @name');
  };

  const share = async () => {
    if (!invite) return;
    try { await Share.share({ message: inviteShareText(invite.link, invite.handle) }); } catch { /* closed the sheet */ }
  };

  const copy = async () => {
    if (!invite) return;
    await Clipboard.setStringAsync(invite.link);
    Alert.alert('Copied', 'Your invite link is copied.');
  };

  const rotate = () => Alert.alert(
    'Make a new link?',
    'The old link stops working. People who already chat with you keep their chats.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Make a new link', style: 'destructive', onPress: () => { run(rotateMyInvite, 'Could not make a new link'); } }],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">My invite link</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} color={palette.text} />
          </TouchableOpacity>
        </View>

        {!invite ? (
          <View style={styles.center}>
            {error ? (
              <TouchableOpacity onPress={load} accessibilityRole="button"><Text style={{ color: palette.primaryText }}>{error} Tap to try again.</Text></TouchableOpacity>
            ) : <ActivityIndicator color={palette.primaryText} />}
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.help, { color: palette.textSecondary }]}>
              Anyone who opens your link can message you straight away. Share it only with people you want to hear from.
            </Text>

            <View style={[styles.card, { backgroundColor: palette.surface, opacity: invite.enabled ? 1 : 0.5 }]}>
              <Text style={[styles.link, { color: palette.text }]} selectable accessibilityLabel={`Your invite link: ${invite.link}`}>{invite.link}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: palette.primary }]} onPress={share} disabled={!invite.enabled} accessibilityRole="button" accessibilityLabel="Share my invite link">
                  <Share2 size={16} color="#FFFFFF" /><Text style={styles.btnText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: palette.surfaceAlt }]} onPress={copy} disabled={!invite.enabled} accessibilityRole="button" accessibilityLabel="Copy my invite link">
                  <Copy size={16} color={palette.text} /><Text style={[styles.btnText, { color: palette.text }]}>Copy</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface }]}>
              <Text style={[styles.label, { color: palette.text }]}>Your @name (optional)</Text>
              <Text style={[styles.help, { color: palette.textSecondary }]}>
                People can find you by typing it in New message. They can ask to chat, and you choose whether to accept.
              </Text>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { color: palette.text, backgroundColor: palette.surfaceAlt }]}
                  value={handle}
                  onChangeText={setHandle}
                  placeholder="e.g. sam_k"
                  placeholderTextColor={palette.textDisabled}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={21}
                  accessibilityLabel="Your @name"
                />
                <TouchableOpacity style={[styles.btn, { backgroundColor: palette.primary }]} onPress={saveHandle} disabled={busy} accessibilityRole="button" accessibilityLabel="Save my @name">
                  <Text style={styles.btnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface }]}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: palette.text }]}>Let people reach me</Text>
                  <Text style={[styles.help, { color: palette.textSecondary }]}>Turn off to stop both the link and the @name working. Your chats stay.</Text>
                </View>
                <AppleSwitch value={invite.enabled} onValueChange={(v: boolean) => { run(() => setInviteEnabled(v), 'Could not change this'); }} />
              </View>
              <TouchableOpacity style={styles.rotate} onPress={rotate} accessibilityRole="button" accessibilityLabel="Make a new invite link">
                <RefreshCw size={15} color={palette.primaryText} /><Text style={{ color: palette.primaryText, fontWeight: '600' }}>Make a new link</Text>
              </TouchableOpacity>
            </View>
            {busy ? <ActivityIndicator color={palette.primaryText} /> : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  body: { padding: 16, gap: 14 },
  card: { borderRadius: 20, padding: 16, gap: 10 },
  link: { fontSize: 15, fontWeight: '600' },
  label: { fontSize: 16, fontWeight: '700' },
  help: { fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 22, paddingHorizontal: 18 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  input: { flex: 1, minHeight: 44, borderRadius: 14, paddingHorizontal: 12, fontSize: 15 },
  rotate: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
});
