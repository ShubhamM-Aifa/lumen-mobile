import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, Pressable, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useAttachables, type Attachable, type AttachableKind } from '../../hooks/useAiChat';
import { REF_KIND_META, type ChatRef } from '../../utils/ai/refs';

/** "task_or_list" shows Tasks and Lists tabs. */
export type PickerKind = AttachableKind | 'task_or_list';

interface Props {
  kind: PickerKind | null;
  onClose: () => void;
  onPick: (ref: ChatRef) => void;
}

const TITLES: Record<PickerKind, string> = {
  note: 'Attach a note', task_or_list: 'Attach a task or list', task: 'Attach a task', list: 'Attach a list',
  medication: 'Attach a medicine', record: 'Attach a health record', flare: 'Attach a flare', experiment: 'Attach an experiment',
  pattern: 'Attach an insight pattern', weekly_report: 'Attach a weekly review',
};

const EMPTY: Record<AttachableKind, string> = {
  note: 'No notes yet.', task: 'No tasks yet.', list: 'No lists yet.', medication: 'No medicines added yet.',
  record: 'No health records yet.', flare: 'No flares recorded.', experiment: 'No experiments yet.',
  pattern: 'No patterns found yet. Lumen needs a few weeks of logs.', weekly_report: 'No weekly reviews yet.',
};

/** Searchable list of the member's own items of one kind; tapping one attaches it. */
export function AttachPickerModal({ kind, onClose, onPick }: Props) {
  const styles = useStyles();
  const { palette } = useTheme();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'task' | 'list'>('task');
  useEffect(() => { if (kind) { setQ(''); setTab('task'); } }, [kind]);

  const effective: AttachableKind | null = kind === 'task_or_list' ? tab : kind;
  const items = useAttachables(effective, q);
  const searchable = effective !== 'flare' && effective !== 'weekly_report';

  const pick = (a: Attachable) => {
    if (!effective) return;
    onPick({ kind: effective, id: a.id, title: a.title });
  };

  return (
    <Modal visible={!!kind} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>{kind ? TITLES[kind] : ''}</Text>
            <View style={styles.headerBtn} />
          </View>

          {kind === 'task_or_list' ? (
            <View style={styles.tabs} accessibilityRole="tablist">
              {(['task', 'list'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tab, tab === t && styles.tabOn]}
                  onPress={() => setTab(t)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === t }}
                >
                  <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t === 'task' ? 'Tasks' : 'Lists'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {searchable ? (
            <View style={styles.search}>
              <Search size={18} color={palette.textSecondary} />
              <TextInput
                style={styles.searchInput}
                value={q}
                onChangeText={setQ}
                placeholder="Search"
                placeholderTextColor={palette.placeholder}
                accessibilityLabel="Search"
                returnKeyType="search"
              />
            </View>
          ) : null}

          {items.isLoading ? <ActivityIndicator style={styles.loading} /> : null}
          {items.isError ? <Text style={styles.empty}>Could not load. Check your connection and try again.</Text> : null}
          <FlatList
            data={items.data ?? []}
            keyExtractor={a => a.id}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ListEmptyComponent={items.data && effective ? <Text style={styles.empty}>{q.trim() ? 'Nothing matches.' : EMPTY[effective]}</Text> : null}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[styles.row, index > 0 && styles.rowSeparator]}
                onPress={() => pick(item)}
                accessibilityRole="button"
                accessibilityLabel={`Attach ${item.title}`}
              >
                <Text style={styles.rowEmoji}>{effective ? REF_KIND_META[effective].emoji : ''}</Text>
                <View style={styles.rowTexts}>
                  <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
                  {item.subtitle ? <Text style={styles.rowSub} numberOfLines={1}>{item.subtitle}</Text> : null}
                </View>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = createThemedStyles(palette => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, height: '78%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  headerBtn: { minWidth: 64, minHeight: 44, justifyContent: 'center' },
  title: { ...typography.headline, color: palette.text, flexShrink: 1, textAlign: 'center' },
  cancel: { ...typography.bodyLarge, color: palette.primaryText },
  tabs: { flexDirection: 'row', backgroundColor: palette.surfaceAlt, borderRadius: 12, padding: 3, marginBottom: 10 },
  tab: { flex: 1, minHeight: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: palette.surface },
  tabText: { ...typography.subhead, color: palette.textSecondary },
  tabTextOn: { color: palette.text, fontWeight: '600' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.surfaceAlt, borderRadius: 14, paddingHorizontal: 12, minHeight: 44, marginBottom: 6 },
  searchInput: { flex: 1, ...typography.body, color: palette.text, minHeight: 44 },
  loading: { marginTop: 24 },
  list: { flex: 1 },
  empty: { ...typography.body, color: palette.textSecondary, textAlign: 'center', marginTop: 24, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, paddingHorizontal: 4 },
  rowSeparator: { borderTopWidth: 0.5, borderTopColor: palette.border },
  rowEmoji: { fontSize: 22 },
  rowTexts: { flex: 1 },
  rowTitle: { ...typography.body, color: palette.text },
  rowSub: { ...typography.footnote, color: palette.textSecondary, marginTop: 1 },
}));
