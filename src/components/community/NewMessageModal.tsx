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
import { X, Search } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useCommunityStore, CommunityPerson } from '../../store/communityStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called with the DM channel that was opened or created. */
  onOpened: (channelSlugOrId: string) => void;
}

/** Start a direct message by searching for a member, without going through a channel. */
export const NewMessageModal: React.FC<Props> = ({ visible, onClose, onOpened }) => {
  const { palette } = useTheme();
  const { searchPeople, createOrGetDm } = useCommunityStore();
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

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let stale = false;
    const t = setTimeout(async () => {
      const found = await searchPeople(q);
      if (!stale) {
        setResults(found);
        setSearching(false);
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [query, searchPeople]);

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
            placeholder="Search for a member by name"
            placeholderTextColor={palette.textDisabled}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search for a member"
          />
          {searching && <ActivityIndicator size="small" color={palette.primaryText} />}
        </View>

        <FlatList
          data={results}
          keyExtractor={(p) => p.userId}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <Text style={[styles.hint, { color: palette.textSecondary }]}>
              {query.trim().length < 2
                ? 'Type at least 2 letters. You can message people from the communities you can see.'
                : searching
                  ? ''
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
              <View style={[styles.avatar, { backgroundColor: palette.surface }]}>
                <Text style={{ fontSize: 18 }}>🌟</Text>
              </View>
              <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
                {item.displayName}
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
  hint: { textAlign: 'center', marginTop: 24, fontSize: 14, lineHeight: 20, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
});
