import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Plus,
  Search,
  Star,
  FileText,
  Sparkles,
  X,
  Stethoscope,
  Pill,
  Flame,
} from 'lucide-react-native';
import { useNoteStore, PREBUILT_TEMPLATES } from '../../src/store/noteStore';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { NoteCard } from '../../src/components/notes/NoteCard';
import { LargeTitleHeader } from '../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { FilterChip } from '../../src/components/ios/FilterChip';
import { INote } from '../../src/shared/types';

export default function NotesHubScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const {
    notes,
    fetchNotes,
    createNote,
    createFromTemplate,
    togglePin,
    isLoading,
  } = useNoteStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => (n.tags || []).forEach((t) => set.add(t)));
    return Array.from(set);
  }, [notes]);

  // Filter notes
  const filteredNotes = useMemo(() => {
    let result = notes;

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.blocks.some((b) => b.content.toLowerCase().includes(q)) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (selectedTag === 'pinned') {
      result = result.filter((n) => n.isPinned);
    } else if (selectedTag) {
      result = result.filter((n) => n.tags.includes(selectedTag));
    }

    return result;
  }, [notes, searchQuery, selectedTag]);

  const pinnedNotes = filteredNotes.filter((n) => n.isPinned);
  const regularNotes = filteredNotes.filter((n) => !n.isPinned);

  const handleCreateNew = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newNote = await createNote();
    router.push({
      pathname: '/notes/[id]',
      params: { id: newNote._id },
    });
  };

  const handleCreateFromTemplate = async (key: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newNote = await createFromTemplate(key);
    router.push({
      pathname: '/notes/[id]',
      params: { id: newNote._id },
    });
  };

  const handleOpenNote = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/notes/[id]',
      params: { id },
    });
  };

  const renderRows = (list: INote[]) =>
    list.map((note, i) => (
      <View key={note._id} style={i < list.length - 1 ? styles.separated : undefined}>
        <NoteCard
          note={note}
          onPress={() => handleOpenNote(note._id)}
          onTogglePin={() => togglePin(note._id)}
        />
      </View>
    ));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LargeTitleHeader
          title="Notes & Docs"
          subtitle={notes.length === 0 ? 'Nothing written yet' : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}
          leading={
            <GlassCircleButton accessibilityLabel="Go back" onPress={() => router.back()}>
              <ArrowLeft size={22} color={palette.text} strokeWidth={2.2} />
            </GlassCircleButton>
          }
          actions={
            <>
              <GlassCircleButton
                accessibilityLabel="Search notes"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsSearching(!isSearching);
                }}
              >
                <Search size={20} color={isSearching ? palette.tint : palette.text} strokeWidth={2.2} />
              </GlassCircleButton>
              <GlassCircleButton accessibilityLabel="New note" onPress={handleCreateNew}>
                <Plus size={22} color={palette.text} strokeWidth={2.2} />
              </GlassCircleButton>
            </>
          }
        />

        {isSearching && (
          <View style={styles.searchBar}>
            <Search size={16} color={palette.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search notes, clinical checklists, tags..."
              placeholderTextColor={palette.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              accessibilityLabel="Search notes"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={16} color={palette.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Prebuilt clinical templates */}
        <View style={styles.templatesSection}>
          <View style={styles.sectionHeader}>
            <Sparkles size={14} color={palette.warning} />
            <Text style={styles.sectionTitle} accessibilityRole="header">Clinical Templates</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templatesScroll}>
            {PREBUILT_TEMPLATES.map((tmpl) => (
              <TouchableOpacity
                key={tmpl.key}
                style={styles.templateCard}
                onPress={() => handleCreateFromTemplate(tmpl.key)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`New note from template: ${tmpl.title}`}
              >
                <View style={styles.templateIconWell}>
                  <Text style={styles.templateEmoji}>{tmpl.icon}</Text>
                </View>
                <Text style={styles.templateTitle} numberOfLines={2} maxFontSizeMultiplier={1.3}>{tmpl.title}</Text>
                <Text style={styles.templateDesc} numberOfLines={2} maxFontSizeMultiplier={1.3}>{tmpl.description}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tag filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagFiltersScroll}>
          <FilterChip label={`All Notes (${notes.length})`} selected={selectedTag === null} onPress={() => setSelectedTag(null)} />
          <FilterChip
            label="Pinned"
            selected={selectedTag === 'pinned'}
            onPress={() => setSelectedTag(selectedTag === 'pinned' ? null : 'pinned')}
            icon={<Star size={14} color={selectedTag === 'pinned' ? palette.background : palette.warning} fill={selectedTag === 'pinned' ? palette.background : 'transparent'} />}
          />
          {allTags.map((tag) => (
            <FilterChip
              key={tag}
              label={`#${tag}`}
              selected={selectedTag === tag}
              onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
            />
          ))}
        </ScrollView>

        {/* Notes */}
        {isLoading && notes.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={palette.tint} />
          </View>
        ) : filteredNotes.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyTitle}>No notes found</Text>
            <Text style={styles.emptySub}>
              Capture appointment debriefs, flare protocols, and research takeaways with Notion blocks.
            </Text>
            <TouchableOpacity style={styles.emptyCreateBtn} onPress={handleCreateNew} accessibilityRole="button" accessibilityLabel="Create first note">
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.emptyCreateBtnText}>Create first note</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {pinnedNotes.length > 0 && selectedTag !== 'pinned' && (
              <View style={styles.notesSection}>
                <View style={styles.sectionHeader}>
                  <Star size={14} color={palette.warning} fill={palette.warning} />
                  <Text style={styles.sectionTitle} accessibilityRole="header">Pinned</Text>
                </View>
                <View style={styles.card}>{renderRows(pinnedNotes)}</View>
              </View>
            )}

            {(selectedTag === 'pinned' ? pinnedNotes : regularNotes).length > 0 && (
              <View style={styles.notesSection}>
                {pinnedNotes.length > 0 && selectedTag !== 'pinned' && (
                  <View style={styles.sectionHeader}>
                    <FileText size={14} color={palette.textSecondary} />
                    <Text style={styles.sectionTitle} accessibilityRole="header">Notes</Text>
                  </View>
                )}
                <View style={styles.card}>{renderRows(selectedTag === 'pinned' ? pinnedNotes : regularNotes)}</View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(palette => ({
  container: { flex: 1, backgroundColor: palette.background },
  scrollArea: { flex: 1 },
  scrollContent: { gap: 16, paddingTop: 6, paddingBottom: 48 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 22,
    gap: 8,
    backgroundColor: palette.surface,
  },
  searchInput: { flex: 1, ...typography.bodyLarge, color: palette.text, padding: 0 },
  templatesSection: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20 },
  sectionTitle: { ...typography.sectionLabel, color: palette.textSecondary },
  templatesScroll: { paddingHorizontal: 16, gap: 12 },
  templateCard: {
    width: 176,
    borderRadius: 26,
    padding: 16,
    backgroundColor: palette.surface,
  },
  templateIconWell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  templateEmoji: { fontSize: 22 },
  templateTitle: { ...typography.headline, color: palette.text, marginBottom: 4 },
  templateDesc: { ...typography.footnote, color: palette.textSecondary },
  tagFiltersScroll: { paddingHorizontal: 16, gap: 8 },
  card: { marginHorizontal: 16, backgroundColor: palette.surface, borderRadius: 26, overflow: 'hidden' },
  separated: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  notesSection: { gap: 7 },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  emptyBox: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: 32, gap: 6 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { ...typography.title2, color: palette.text, marginTop: 6 },
  emptySub: { ...typography.subhead, color: palette.textSecondary, textAlign: 'center' },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 22,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: palette.primary,
  },
  emptyCreateBtnText: { ...typography.headline, color: '#FFFFFF' },
}));
