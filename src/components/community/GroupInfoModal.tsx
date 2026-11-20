/**
 * A group chat's people: who is in it, add more, rename it, leave it, and (for the person who
 * started it) remove someone.
 */
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Image, Switch, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, UserPlus, LogOut, Camera, BellOff } from 'lucide-react-native';
import { uploadMedia } from '../../services/mediaUpload';
import { useTheme } from '../../theme/ThemeContext';
import { useCommunityStore } from '../../store/communityStore';
import { ModularAvatar } from '../avatar/ModularAvatar';
import { getDeterministicAvatarConfig } from '../../store/avatarStore';
import { MAX_GROUP_MEMBERS } from '../../utils/community/invites';
import type { ICommunityChannel } from '../../shared/types';

interface Props {
  visible: boolean;
  channel: ICommunityChannel | undefined;
  onClose: () => void;
  onAddPeople: () => void;
  /** After leaving, the screen goes back to the chat list. */
  onLeft: () => void;
}

export const GroupInfoModal: React.FC<Props> = ({ visible, channel, onClose, onAddPeople, onLeft }) => {
  const { palette } = useTheme();
  const { renameGroup, editGroup, muteGroup, leaveGroup, removeGroupMember } = useCommunityStore();
  const [name, setName] = useState(channel?.name ?? '');
  const [about, setAbout] = useState(channel?.about ?? '');
  const [busy, setBusy] = useState(false);
  const members = channel?.groupMembers ?? [];
  const iAmOwner = members.some(m => m.isMe && m.isOwner);

  useEffect(() => { if (visible) { setName(channel?.name ?? ''); setAbout(channel?.about ?? ''); } }, [visible, channel?.name, channel?.about]);

  if (!channel) return null;

  const run = async (fn: () => Promise<unknown>, failTitle: string) => {
    setBusy(true);
    try { await fn(); } catch (err: any) { Alert.alert(failTitle, err?.message || 'Please try again.'); } finally { setBusy(false); }
  };

  const saveName = () => {
    const n = name.trim();
    if (!n || n === channel.name) return;
    run(() => renameGroup(channel._id, n), 'Could not rename the group');
  };

  const aboutChanged = about.trim() !== (channel.about ?? '');
  const saveAbout = () => { if (aboutChanged) run(() => editGroup(channel._id, { about: about.trim() }), 'Could not save the description'); };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    run(async () => {
      const up = await uploadMedia(asset.uri, asset.mimeType || 'image/jpeg');
      await editGroup(channel._id, { photoMediaId: up.mediaId });
    }, 'Could not change the photo');
  };

  const photoMenu = () => {
    if (!channel.photoUrl) { pickPhoto(); return; }
    Alert.alert('Group photo', undefined, [
      { text: 'Choose a new photo', onPress: () => { pickPhoto(); } },
      { text: 'Remove photo', style: 'destructive', onPress: () => { run(() => editGroup(channel._id, { photoMediaId: null }), 'Could not remove the photo'); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const leave = () => Alert.alert(
    'Leave this group?',
    'You will stop getting its messages. Others can add you back.',
    [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave group', style: 'destructive', onPress: () => { run(async () => { await leaveGroup(channel._id); onClose(); onLeft(); }, 'Could not leave'); } },
    ],
  );

  const remove = (id: string, displayName: string) => Alert.alert(
    `Remove ${displayName}?`,
    'They will no longer see new messages in this group.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { run(() => removeGroupMember(channel._id, id), 'Could not remove them'); } },
    ],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">Group info</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} color={palette.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={[styles.photo, { backgroundColor: palette.surface }]}
            onPress={photoMenu}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={channel.photoUrl ? 'Change group photo' : 'Add a group photo'}
          >
            {busy ? <ActivityIndicator color={palette.primaryText} /> : channel.photoUrl ? (
              <Image source={{ uri: channel.photoUrl }} style={styles.photoImg} accessibilityLabel="Group photo" />
            ) : (
              <Camera size={30} color={palette.textSecondary} />
            )}
          </TouchableOpacity>
          <Text style={[styles.sub, { color: palette.textSecondary, textAlign: 'center' }]}>{channel.photoUrl ? 'Tap to change or remove' : 'Tap to add a photo'}</Text>

          <View style={[styles.card, { backgroundColor: palette.surface }]}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Group name</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { color: palette.text, backgroundColor: palette.surfaceAlt }]}
                value={name}
                onChangeText={setName}
                maxLength={50}
                onSubmitEditing={saveName}
                returnKeyType="done"
                accessibilityLabel="Group name"
              />
              <TouchableOpacity
                style={[styles.save, { backgroundColor: name.trim() && name.trim() !== channel.name ? palette.primary : palette.surfaceAlt }]}
                onPress={saveName}
                disabled={busy || !name.trim() || name.trim() === channel.name}
                accessibilityRole="button"
                accessibilityLabel="Save group name"
              >
                <Text style={{ color: name.trim() && name.trim() !== channel.name ? '#FFFFFF' : palette.textDisabled, fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface }]}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.about, { color: palette.text, backgroundColor: palette.surfaceAlt }]}
              value={about}
              onChangeText={setAbout}
              maxLength={300}
              multiline
              placeholder="What is this group for?"
              placeholderTextColor={palette.textDisabled}
              accessibilityLabel="Group description"
            />
            <View style={styles.row}>
              <Text style={[styles.sub, { color: palette.textSecondary, flex: 1 }]}>{about.length} / 300</Text>
              <TouchableOpacity
                style={[styles.save, { backgroundColor: aboutChanged ? palette.primary : palette.surfaceAlt }]}
                onPress={saveAbout}
                disabled={busy || !aboutChanged}
                accessibilityRole="button"
                accessibilityLabel="Save description"
              >
                <Text style={{ color: aboutChanged ? '#FFFFFF' : palette.textDisabled, fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface }]}>
            <View style={styles.row}>
              <BellOff size={18} color={palette.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: palette.text }]}>Mute notifications</Text>
                <Text style={[styles.sub, { color: palette.textSecondary }]}>Only for you. You still get the messages, just no alerts.</Text>
              </View>
              <Switch
                value={Boolean(channel.muted)}
                onValueChange={v => { run(() => muteGroup(channel._id, v), 'Could not change mute'); }}
                disabled={busy}
                accessibilityLabel="Mute notifications for this group"
              />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface }]}>
            <View style={styles.row}>
              <Text style={[styles.label, { color: palette.textSecondary, flex: 1 }]}>{members.length} of {MAX_GROUP_MEMBERS} people</Text>
              {members.length < MAX_GROUP_MEMBERS ? (
                <TouchableOpacity style={styles.add} onPress={() => { onClose(); setTimeout(onAddPeople, 350); }} accessibilityRole="button" accessibilityLabel="Add people to the group">
                  <UserPlus size={16} color={palette.primaryText} /><Text style={{ color: palette.primaryText, fontWeight: '700' }}>Add people</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {members.map(m => (
              <View key={m._id} style={styles.member}>
                <View style={[styles.avatar, { backgroundColor: palette.surfaceAlt, overflow: 'hidden' }]}>
                  <ModularAvatar size={32} animated={false} config={getDeterministicAvatarConfig(m._id)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, { color: palette.text }]} numberOfLines={1}>{m.displayName}{m.isMe ? ' (you)' : ''}</Text>
                  {m.isOwner ? <Text style={[styles.sub, { color: palette.textSecondary }]}>Started the group</Text> : null}
                </View>
                {iAmOwner && !m.isMe ? (
                  <TouchableOpacity onPress={() => remove(m._id, m.displayName)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${m.displayName}`}>
                    <Text style={{ color: palette.error, fontWeight: '600' }}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>

          <TouchableOpacity style={[styles.card, styles.leave, { backgroundColor: palette.surface }]} onPress={leave} disabled={busy} accessibilityRole="button" accessibilityLabel="Leave group">
            <LogOut size={18} color={palette.error} />
            <Text style={{ color: palette.error, fontWeight: '700', fontSize: 16 }}>Leave group</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontWeight: '800' },
  body: { padding: 16, gap: 14 },
  card: { borderRadius: 20, padding: 16, gap: 10 },
  label: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minHeight: 44, borderRadius: 14, paddingHorizontal: 12, fontSize: 15 },
  save: { minHeight: 44, borderRadius: 22, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  photo: { width: 96, height: 96, borderRadius: 48, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImg: { width: 96, height: 96 },
  about: { minHeight: 70, paddingTop: 10, textAlignVertical: 'top' },
  add: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  memberName: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 12 },
  leave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52 },
});
