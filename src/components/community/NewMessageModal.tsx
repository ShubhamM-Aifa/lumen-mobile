import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Search, Users, Link2 } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useCommunityStore, CommunityPerson } from '../../store/communityStore';
import { ModularAvatar } from '../avatar/ModularAvatar';
import { getDeterministicAvatarConfig } from '../../store/avatarStore';
import { parsePeopleQuery } from '../../utils/community/invites';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called with the DM channel that was opened or created. */
  onOpened: (channelSlugOrId: string) => void;
  /** Open the group maker / my invite link (the parent shows them, so two modals never stack). */
  onNewGroup?: () => void;
  onMyInvite?: () => void;
}

/** Start a direct message by searching for a member, without going through a channel. */
export const NewMessageModal: React.FC<Props> = ({ visible, onClose, onOpened, onNewGroup, onMyInvite }) => {
  const { palette } = useTheme();
  const { searchPeople, createOrGetDm, lookupHandle, previewInvite, openInvite } = useCommunityStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommunityPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  /** Set when the box holds an invite link or code: who it belongs to. */
  const [inviteOwner, setInviteOwner] = useState<{ code: string; displayName: string } | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!visible) setInviteOwner(null);
  }, [visible]);

  useEffect(() => {
    const parsed = parsePeopleQuery(query);
    setInviteOwner(null);
    setNotFound(false);
    if (parsed.kind === 'empty') {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let stale = false;
    const t = setTimeout(async () => {
      try {
        if (parsed.kind === 'invite') {
          const who = await previewInvite(parsed.code).catch(() => null);
          if (stale) return;
          setResults([]);
          if (who) setInviteOwner({ code: parsed.code, displayName: who.displayName }); else setNotFound(true);
        } else if (parsed.kind === 'handle') {
          const person = await lookupHandle(parsed.handle);
          if (stale) return;
          setResults(person ? [person] : []);
          setNotFound(!person);
        } else {
          const found = await searchPeople(parsed.text);
          if (stale) return;
          setResults(found);
        }
      } finally {
        if (!stale) setSearching(false);
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [query, searchPeople, lookupHandle, previewInvite]);

  const openFromInvite = async () => {
    if (!inviteOwner || opening) return;
    setOpening(inviteOwner.code);
    try {
      const dm = await openInvite(inviteOwner.code);
      onClose();
      onOpened(dm.slug || dm._id);
    } catch (err: any) {
      Alert.alert('Could not open the chat', err?.message || 'Please try again.');
    } finally {
      setOpening(null);
    }
  };

  const open = async (person: CommunityPerson) => {
    if (opening) return;
    setOpening(person.userId);
    try {
      const dm = await createOrGetDm(person.userId);
      onClose();
      onOpened(dm.slug || dm._id);
    } catch (err: any) {
      Alert.alert('Could not start the message', err?.message || 'Please try again.');
    } finally {
      setOpening(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>New message</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} color={palette.text} />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBox, { backgroundColor: palette.surface }]}>
          <Search size={16} color={palette.textSecondary} />
          <TextInput
            style={[styles.input, { color: palette.text }]}
            placeholder="Name, @name, or paste an invite link"
            placeholderTextColor={palette.textDisabled}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search by name, @name or invite link"
          />
          {searching && <ActivityIndicator size="small" color={palette.primaryText} />}
        </View>

        <View style={styles.shortcuts}>
          {onNewGroup ? (
            <TouchableOpacity style={[styles.shortcut, { backgroundColor: palette.surface }]} onPress={onNewGroup} accessibilityRole="button" accessibilityLabel="New group">
              <Users size={16} color={palette.primaryText} /><Text style={[styles.shortcutText, { color: palette.text }]}>New group</Text>
            </TouchableOpacity>
          ) : null}
          {onMyInvite ? (
            <TouchableOpacity style={[styles.shortcut, { backgroundColor: palette.surface }]} onPress={onMyInvite} accessibilityRole="button" accessibilityLabel="My invite link">
              <Link2 size={16} color={palette.primaryText} /><Text style={[styles.shortcutText, { color: palette.text }]}>My invite link</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {inviteOwner ? (
          <TouchableOpacity style={[styles.inviteRow, { backgroundColor: palette.surface }]} onPress={openFromInvite} disabled={!!opening} accessibilityRole="button" accessibilityLabel={`Message ${inviteOwner.displayName}`}>
            <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>Message {inviteOwner.displayName}</Text>
            {opening ? <ActivityIndicator size="small" color={palette.primaryText} /> : <Text style={{ color: palette.primaryText, fontWeight: '700' }}>Open</Text>}
          </TouchableOpacity>
        ) : null}

        <FlatList
          data={results}
          keyExtractor={(p) => p.userId}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <Text style={[styles.hint, { color: palette.textSecondary }]}>
              {parsePeopleQuery(query).kind === 'empty'
                ? 'Type at least 2 letters, an @name, or paste an invite link. You can message people from the communities you can see.'
                : searching || inviteOwner
                  ? ''
                  : notFound
                    ? 'That link or @name does not work (it may be switched off or replaced).'
                    : 'No one found with that name.'}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => open(item)}
              disabled={!!opening}
              accessibilityRole="button"
              accessibilityLabel={`Message ${item.displayName}`}
            >
              <View style={[styles.avatar, { backgroundColor: palette.surface, overflow: 'hidden' }]}>
                <ModularAvatar
                  size={32}
                  animated={false}
                  config={getDeterministicAvatarConfig(item.userId || item.displayName)}
                />
              </View>
              <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
                {item.displayName}{item.handle ? `  @${item.handle}` : ''}
              </Text>
              {opening === item.userId && <ActivityIndicator size="small" color={palette.primaryText} />}
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontWeight: '800' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, paddingHorizontal: 14, minHeight: 46, borderRadius: 23 },
  input: { flex: 1, minHeight: 44, fontSize: 15 },
  shortcuts: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 6 },
  shortcut: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 22 },
  shortcutText: { fontSize: 14, fontWeight: '700' },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 6, paddingHorizontal: 16, minHeight: 52, borderRadius: 18 },
  hint: { textAlign: 'center', marginTop: 24, fontSize: 14, lineHeight: 20, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
});
