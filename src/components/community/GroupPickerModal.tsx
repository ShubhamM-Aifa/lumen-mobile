/**
 * Pick people for a group chat: either to start a new group (give it a name, choose at least 2
 * people) or to add to an existing one. Only people you already chat with can be picked.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useCommunityStore } from '../../store/communityStore';
import { ModularAvatar } from '../avatar/ModularAvatar';
import { getDeterministicAvatarConfig } from '../../store/avatarStore';
import { groupCandidates, MAX_GROUP_MEMBERS, MIN_GROUP_MEMBERS } from '../../utils/community/invites';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Add to this group instead of starting a new one. */
  addToGroupId?: string;
  /** People already in the group (not shown). */
  existingIds?: string[];
  /** Called with the chat's slug or id when a new group was made. */
  onCreated?: (channelSlugOrId: string) => void;
}

export const GroupPickerModal: React.FC<Props> = ({ visible, onClose, addToGroupId, existingIds = [], onCreated }) => {
  const { palette } = useTheme();
  const { dmChannels, fetchDms, createGroup, addGroupMembers } = useCommunityStore();
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const adding = !!addToGroupId;
  const room = MAX_GROUP_MEMBERS - (adding ? existingIds.length : 1);

  useEffect(() => { if (visible) { fetchDms().catch(() => {}); } else { setPicked([]); setName(''); } }, [visible, fetchDms]);

  const people = useMemo(() => groupCandidates(dmChannels).filter(p => !existingIds.includes(p.userId)), [dmChannels, existingIds]);
  const needed = adding ? 1 : MIN_GROUP_MEMBERS - 1;
  const canSave = picked.length >= needed && picked.length <= room && !saving;

  const toggle = (id: string) => setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= room ? prev : [...prev, id]));

  const save = async () => {
    setSaving(true);
    try {
      if (adding) {
        await addGroupMembers(addToGroupId!, picked);
        onClose();
      } else {
        const g = await createGroup(picked, name);
        onClose();
        onCreated?.(g.slug || g._id);
      }
    } catch (err: any) {
      Alert.alert(adding ? 'Could not add them' : 'Could not start the group', err?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">{adding ? 'Add people' : 'New group'}</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} color={palette.text} />
          </TouchableOpacity>
        </View>

        {!adding ? (
          <TextInput
            style={[styles.nameInput, { color: palette.text, backgroundColor: palette.surface }]}
            value={name}
            onChangeText={setName}
            placeholder="Group name (optional)"
            placeholderTextColor={palette.textDisabled}
            maxLength={50}
            accessibilityLabel="Group name"
          />
        ) : null}

        <Text style={[styles.help, { color: palette.textSecondary }]}>
          {adding
            ? 'Pick people you already chat with.'
            : `Pick at least 2 people you already chat with (up to ${MAX_GROUP_MEMBERS - 1}). To add someone new, message them first and wait for them to accept.`}
        </Text>

        <FlatList
          data={people}
          keyExtractor={p => p.userId}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={[styles.help, { color: palette.textSecondary, textAlign: 'center', marginTop: 24 }]}>No one to add yet. Start a chat with someone and wait until they accept.</Text>}
          renderItem={({ item }) => {
            const on = picked.includes(item.userId);
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => toggle(item.userId)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={item.displayName}
              >
                <View style={[styles.avatar, { backgroundColor: palette.surface, overflow: 'hidden' }]}>
                  <ModularAvatar size={32} animated={false} config={getDeterministicAvatarConfig(item.userId)} />
                </View>
                <Text style={[styles.personName, { color: palette.text }]} numberOfLines={1}>{item.displayName}</Text>
                <View style={[styles.check, { borderColor: on ? palette.primary : palette.border, backgroundColor: on ? palette.primary : 'transparent' }]}>
                  {on ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                </View>
              </TouchableOpacity>
            );
          }}
        />

        <View style={[styles.footer, { backgroundColor: palette.background, borderTopColor: palette.border }]}>
          <Text style={[styles.help, { color: palette.textSecondary, flex: 1 }]}>{picked.length} picked{room < 9 ? ` · room for ${room}` : ''}</Text>
          <TouchableOpacity
            style={[styles.save, { backgroundColor: canSave ? palette.primary : palette.surfaceAlt }]}
            onPress={save}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
            accessibilityLabel={adding ? 'Add to group' : 'Create group'}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[styles.saveText, { color: canSave ? '#FFFFFF' : palette.textDisabled }]}>{adding ? 'Add' : 'Create group'}</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontWeight: '800' },
  nameInput: { margin: 16, marginBottom: 6, minHeight: 46, borderRadius: 23, paddingHorizontal: 16, fontSize: 15 },
  help: { fontSize: 13, lineHeight: 18, paddingHorizontal: 16, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  personName: { flex: 1, fontSize: 16, fontWeight: '600' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 24, borderTopWidth: StyleSheet.hairlineWidth },
  save: { minHeight: 48, borderRadius: 24, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 15, fontWeight: '700' },
});
