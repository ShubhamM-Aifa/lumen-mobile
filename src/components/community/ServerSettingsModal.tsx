import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Crown, LogOut, Trash2, Share2, Shield } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import { useCommunityStore, CommunityMember, CommunityReportItem } from '../../store/communityStore';
import { ICommunityServer } from '../../shared/types';

const STATUS_CHOICES = ['🥄 Low spoons', '🌿 Pacing', '🛌 Resting', '✨ Good day', '🤒 In a flare'];

interface Props {
  visible: boolean;
  server: ICommunityServer | null;
  onClose: () => void;
}

export const ServerSettingsModal: React.FC<Props> = ({ visible, server, onClose }) => {
  const { palette } = useTheme();
  const { user } = useAuthStore();
  const { updateServer, deleteServer, leaveServer, fetchServerMembers, setModerator, blocks, fetchBlocks, unblock, fetchReports, resolveReport, fetchMySettings, updateMySettings } = useCommunityStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<CommunityReportItem[]>([]);
  const [myStatus, setMyStatus] = useState('');
  const [pushOn, setPushOn] = useState(true);
  const [quietOn, setQuietOn] = useState(false);

  const isOwner = Boolean(server && user?._id && server.ownerId === user._id);
  const isStaff = isOwner || Boolean(server && user?._id && server.modIds?.includes(user._id));

  useEffect(() => {
    if (!visible || !server) return;
    setName(server.name);
    setDescription(server.description || '');
    setMembers([]);
    fetchServerMembers(server._id).then(setMembers);
    fetchBlocks();
    fetchMySettings().then((s) => { setMyStatus(s.status); setPushOn(s.push); setQuietOn(s.quiet); });
    setReports([]);
    if (isStaff) fetchReports(server._id).then(setReports);
  }, [visible, server?._id]);

  if (!server) return null;

  const run = async (fn: () => Promise<void>, failTitle: string) => {
    setBusy(true);
    try {
      await fn();
    } catch (err: any) {
      Alert.alert(failTitle, err?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const changed = name.trim() !== server.name || description.trim() !== (server.description || '');

  const handleSave = () =>
    run(async () => {
      await updateServer(server._id, { name: name.trim(), description: description.trim() });
      onClose();
    }, 'Could not save');

  const handleLeave = () =>
    Alert.alert('Leave this community?', `You will stop seeing ${server.name}. You can rejoin with its invite code.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => run(async () => { await leaveServer(server._id); onClose(); }, 'Could not leave') },
    ]);

  const handleDelete = () =>
    Alert.alert(
      'Delete this community?',
      `This permanently deletes ${server.name}, all its channels and every message in it. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => run(async () => { await deleteServer(server._id); onClose(); }, 'Could not delete') },
      ],
    );

  const toggleModerator = (m: CommunityMember) => {
    const making = !m.isMod;
    Alert.alert(
      making ? `Make ${m.displayName} a moderator?` : `Remove ${m.displayName} as moderator?`,
      making
        ? 'Moderators can delete messages, pin messages and time members out. They cannot change settings or delete the community.'
        : 'They will go back to being a regular member.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: making ? 'Make moderator' : 'Remove',
          onPress: () => run(async () => {
            await setModerator(server._id, m.userId, making);
            setMembers((prev) => prev.map((x) => (x.userId === m.userId ? { ...x, isMod: making } : x)));
          }, 'Could not update'),
        },
      ],
    );
  };

  const chooseStatus = (status: string) => {
    const next = myStatus === status ? '' : status;
    setMyStatus(next);
    updateMySettings({ status: next }).catch((err: any) => Alert.alert('Could not save', err?.message || 'Please try again.'));
  };

  const togglePush = (value: boolean) => {
    setPushOn(value);
    updateMySettings({ push: value }).catch((err: any) => {
      setPushOn(!value);
      Alert.alert('Could not save', err?.message || 'Please try again.');
    });
  };

  const toggleQuiet = (value: boolean) => {
    setQuietOn(value);
    updateMySettings({ quiet: value }).catch((err: any) => {
      setQuietOn(!value);
      Alert.alert('Could not save', err?.message || 'Please try again.');
    });
  };

  const closeReport = (r: CommunityReportItem, action: 'dismiss' | 'delete') =>
    run(async () => {
      await resolveReport(r.id, action);
      setReports((prev) => prev.filter((x) => x.id !== r.id));
    }, 'Could not update report');

  const shareInvite = () => {
    if (!server.inviteCode) return;
    Share.share({ message: `Join ${server.name} on Lumen with invite code ${server.inviteCode}` }).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {server.icon} Community settings
          </Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close settings" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} color={palette.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: palette.textSecondary, marginTop: 0 }]}>MY ENERGY TODAY</Text>
          <View style={styles.chipRow}>
            {STATUS_CHOICES.map((s) => {
              const selected = myStatus === s;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => chooseStatus(s)}
                  style={[styles.chip, { backgroundColor: selected ? palette.primary : palette.surface }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Status: ${s}`}
                >
                  <Text style={{ color: selected ? '#FFFFFF' : palette.text, fontSize: 13, fontWeight: '600' }}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={{ color: palette.textDisabled, fontSize: 12, marginTop: 6 }}>Shown on your community profile card.</Text>

          <View style={[styles.switchRow, { backgroundColor: palette.surface }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: palette.text, fontWeight: '700', fontSize: 15 }}>Community notifications</Text>
              <Text style={{ color: palette.textSecondary, fontSize: 12, marginTop: 2 }}>Direct messages, replies and mentions</Text>
            </View>
            <Switch value={pushOn} onValueChange={togglePush} accessibilityLabel="Community notifications" />
          </View>
          <View style={[styles.switchRow, { backgroundColor: palette.surface, marginTop: 8, opacity: pushOn ? 1 : 0.5 }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: palette.text, fontWeight: '700', fontSize: 15 }}>Quiet hours</Text>
              <Text style={{ color: palette.textSecondary, fontSize: 12, marginTop: 2 }}>No community notifications from 10 pm to 8 am</Text>
            </View>
            <Switch value={quietOn} onValueChange={toggleQuiet} disabled={!pushOn} accessibilityLabel="Quiet hours" />
          </View>

          {isOwner ? (
            <>
              <Text style={[styles.label, { color: palette.textSecondary }]}>NAME</Text>
              <TextInput
                style={[styles.input, { color: palette.text, backgroundColor: palette.surface }]}
                value={name}
                onChangeText={setName}
                maxLength={100}
                accessibilityLabel="Community name"
              />
              <Text style={[styles.label, { color: palette.textSecondary }]}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.multiline, { color: palette.text, backgroundColor: palette.surface }]}
                value={description}
                onChangeText={setDescription}
                maxLength={500}
                multiline
                accessibilityLabel="Community description"
              />
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: changed && name.trim().length >= 3 ? palette.primary : palette.border }]}
                disabled={!changed || name.trim().length < 3 || busy}
                onPress={handleSave}
                accessibilityRole="button"
                accessibilityLabel="Save changes"
              >
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Save changes</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[styles.desc, { color: palette.textSecondary }]}>{server.description || 'No description.'}</Text>
          )}

          {Boolean(server.inviteCode) && !server.isOfficial && (
            <TouchableOpacity
              style={[styles.inviteRow, { backgroundColor: palette.surface }]}
              onPress={shareInvite}
              accessibilityRole="button"
              accessibilityLabel="Share invite code"
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: palette.textSecondary, marginTop: 0 }]}>INVITE CODE</Text>
                <Text style={[styles.code, { color: palette.text }]}>{server.inviteCode}</Text>
              </View>
              <Share2 size={18} color={palette.primaryText || palette.primary} />
            </TouchableOpacity>
          )}

          <Text style={[styles.label, { color: palette.textSecondary }]}>MEMBERS{members.length ? ` · ${members.length}` : ''}</Text>
          {members.length === 0 ? (
            <ActivityIndicator size="small" color={palette.primaryText} style={{ marginVertical: 12 }} />
          ) : (
            members.map((m) => (
              <TouchableOpacity
                key={m.userId}
                style={styles.memberRow}
                disabled={!isOwner || m.isOwner}
                onPress={() => toggleModerator(m)}
                accessibilityRole={isOwner && !m.isOwner ? 'button' : 'text'}
                accessibilityLabel={`${m.displayName}${m.isOwner ? ', owner' : m.isMod ? ', moderator' : ''}`}
                accessibilityHint={isOwner && !m.isOwner ? (m.isMod ? 'Remove moderator role' : 'Make moderator') : undefined}
              >
                <Text style={[styles.memberName, { color: palette.text }]} numberOfLines={1}>
                  {m.displayName}
                </Text>
                {m.isOwner && <Crown size={14} color="#F59E0B" accessibilityLabel="Owner" />}
                {m.isMod && <Shield size={14} color="#22C55E" accessibilityLabel="Moderator" />}
                {isOwner && !m.isOwner && !m.isMod && (
                  <Text style={{ color: palette.textDisabled, fontSize: 12 }}>Tap to make moderator</Text>
                )}
              </TouchableOpacity>
            ))
          )}

          {isStaff && (
            <>
              <Text style={[styles.label, { color: palette.textSecondary }]}>REPORTS{reports.length ? ` · ${reports.length}` : ''}</Text>
              {reports.length === 0 ? (
                <Text style={{ color: palette.textSecondary, fontSize: 14 }}>No open reports.</Text>
              ) : (
                reports.map((r) => (
                  <View key={r.id} style={[styles.reportCard, { backgroundColor: palette.surface }]}>
                    <Text style={{ color: palette.text, fontWeight: '700', fontSize: 13 }}>
                      {r.reason.replace('_', ' ')} · {r.senderLabel}
                    </Text>
                    {Boolean(r.snippet) && <Text style={{ color: palette.textSecondary, marginTop: 4 }} numberOfLines={3}>{r.snippet}</Text>}
                    {Boolean(r.note) && <Text style={{ color: palette.textSecondary, marginTop: 4, fontStyle: 'italic' }}>"{r.note}"</Text>}
                    <View style={styles.reportActions}>
                      <TouchableOpacity onPress={() => closeReport(r, 'dismiss')} disabled={busy} accessibilityRole="button" accessibilityLabel="Dismiss report">
                        <Text style={{ color: palette.primaryText || palette.primary, fontWeight: '700' }}>Dismiss</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => closeReport(r, 'delete')} disabled={busy} accessibilityRole="button" accessibilityLabel="Delete reported message">
                        <Text style={{ color: '#EF4444', fontWeight: '700' }}>Delete message</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {blocks.length > 0 && (
            <>
              <Text style={[styles.label, { color: palette.textSecondary }]}>BLOCKED MEMBERS · {blocks.length}</Text>
              {blocks.map((b) => (
                <View key={b.id} style={styles.memberRow}>
                  <Text style={[styles.memberName, { color: palette.text }]} numberOfLines={1}>{b.label}</Text>
                  <TouchableOpacity
                    onPress={() => run(() => unblock(b.id), 'Could not unblock')}
                    accessibilityRole="button"
                    accessibilityLabel={`Unblock ${b.label}`}
                  >
                    <Text style={{ color: palette.primaryText || palette.primary, fontWeight: '700' }}>Unblock</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {!server.isOfficial && (
            <TouchableOpacity
              style={[styles.dangerBtn, { borderColor: '#EF4444' }]}
              onPress={isOwner ? handleDelete : handleLeave}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={isOwner ? 'Delete community' : 'Leave community'}
            >
              {isOwner ? <Trash2 size={16} color="#EF4444" /> : <LogOut size={16} color="#EF4444" />}
              <Text style={styles.dangerText}>{isOwner ? 'Delete community' : 'Leave community'}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontWeight: '800', flex: 1, marginRight: 12 },
  body: { padding: 16, paddingBottom: 48 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginTop: 18, marginBottom: 6 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  desc: { fontSize: 14, lineHeight: 20 },
  primaryBtn: { marginTop: 16, borderRadius: 12, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginTop: 20 },
  code: { fontSize: 20, fontWeight: '800', letterSpacing: 2 },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  memberName: { fontSize: 15, flex: 1, marginRight: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginTop: 20 },
  reportCard: { borderRadius: 12, padding: 12, marginBottom: 8 },
  reportActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 32, borderWidth: 1, borderRadius: 12, minHeight: 46 },
  dangerText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
});
