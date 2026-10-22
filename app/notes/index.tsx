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
import { useTheme } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { NoteCard } from '../../src/components/notes/NoteCard';
import { INote } from '../../src/shared/types';

export default function NotesHubScreen() {
  const { palette } = useTheme();
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={[styles.topBar, { borderBottomColor: 'rgba(255, 255, 255, 0.08)' }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color={palette.text} />
        </TouchableOpacity>

        <View style={styles.topBarTitleArea}>
          <Text style={[styles.screenTitle, { color: palette.text }]}>Notes & Docs</Text>
        </View>

        <View style={styles.topBarActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsSearching(!isSearching);
            }}
            accessibilityRole="button"
            accessibilityLabel="Search notes"
          >
            <Search size={20} color={isSearching ? palette.primary : palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: palette.primary }]}
            onPress={handleCreateNew}
            accessibilityRole="button"
            accessibilityLabel="New note"
          >
            <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Collapsible Search Bar */}
      {isSearching && (
        <View style={[styles.searchBar, { backgroundColor: palette.surface }]}>
          <Search size={16} color={palette.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: palette.text }]}
            placeholder="Search notes, clinical checklists, tags..."
            placeholderTextColor={palette.textDisabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={palette.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* Prebuilt Clinical Health Templates Section */}
        <View style={styles.templatesSection}>
          <View style={styles.sectionHeader}>
            <Sparkles size={16} color="#FBBF24" />
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Clinical Templates</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templatesScroll}>
            {PREBUILT_TEMPLATES.map((tmpl) => (
              <TouchableOpacity
                key={tmpl.key}
                style={[styles.templateCard, { backgroundColor: palette.surface }]}
                onPress={() => handleCreateFromTemplate(tmpl.key)}
                activeOpacity={0.75}
              >
                <View style={styles.templateIconWell}>
                  <Text style={{ fontSize: 20 }}>{tmpl.icon}</Text>
                </View>
                <Text style={[styles.templateTitle, { color: palette.text }]} numberOfLines={2}>
                  {tmpl.title}
                </Text>
                <Text style={[styles.templateDesc, { color: palette.textSecondary }]} numberOfLines={2}>
                  {tmpl.description}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tag Filters Row */}
        <View style={styles.tagFiltersSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagFiltersScroll}>
            <TouchableOpacity
              style={[
                styles.tagFilterChip,
                selectedTag === null && {
                  backgroundColor: 'rgba(56, 189, 248, 0.2)',
                  borderColor: '#38BDF8',
                },
              ]}
              onPress={() => setSelectedTag(null)}
            >
              <Text
                style={[
                  styles.tagFilterText,
                  selectedTag === null && { color: '#38BDF8', fontWeight: '700' },
                ]}
              >
                All Notes ({notes.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tagFilterChip,
                selectedTag === 'pinned' && {
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  borderColor: '#F59E0B',
                },
              ]}
              onPress={() => setSelectedTag(selectedTag === 'pinned' ? null : 'pinned')}
            >
              <Star size={13} color="#F59E0B" fill={selectedTag === 'pinned' ? '#F59E0B' : 'transparent'} />
              <Text
                style={[
                  styles.tagFilterText,
                  selectedTag === 'pinned' && { color: '#F59E0B', fontWeight: '700' },
                ]}
              >
                Pinned
              </Text>
            </TouchableOpacity>

            {allTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tagFilterChip,
                  selectedTag === tag && {
                    backgroundColor: 'rgba(129, 140, 248, 0.2)',
                    borderColor: '#818CF8',
                  },
                ]}
                onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                <Text
                  style={[
                    styles.tagFilterText,
                    selectedTag === tag && { color: '#818CF8', fontWeight: '700' },
                  ]}
                >
                  #{tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Notes Grid */}
        <View style={styles.notesContainer}>
          {isLoading && notes.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={palette.primary} />
            </View>
          ) : filteredNotes.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 36 }}>📝</Text>
              <Text style={[styles.emptyTitle, { color: palette.text }]}>No notes found</Text>
              <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
                Capture appointment debriefs, flare protocols, and research takeaways with Notion blocks.
              </Text>
              <TouchableOpacity
                style={[styles.emptyCreateBtn, { backgroundColor: palette.primary }]}
                onPress={handleCreateNew}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.emptyCreateBtnText}>Create first note</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Pinned Section */}
              {pinnedNotes.length > 0 && selectedTag !== 'pinned' && (
                <View style={styles.notesSection}>
                  <View style={styles.sectionHeader}>
                    <Star size={14} color="#F59E0B" fill="#F59E0B" />
                    <Text style={[styles.sectionTitle, { color: palette.text }]}>PINNED</Text>
                  </View>
                  {pinnedNotes.map((note) => (
                    <NoteCard
                      key={note._id}
                      note={note}
                      onPress={() => handleOpenNote(note._id)}
                      onTogglePin={() => togglePin(note._id)}
                    />
                  ))}
                </View>
              )}

              {/* All / Regular Section */}
              <View style={styles.notesSection}>
                {pinnedNotes.length > 0 && selectedTag !== 'pinned' && (
                  <View style={styles.sectionHeader}>
                    <FileText size={14} color={palette.textSecondary} />
                    <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>NOTES</Text>
                  </View>
                )}
                {(selectedTag === 'pinned' ? pinnedNotes : regularNotes).map((note) => (
                  <NoteCard
                    key={note._id}
                    note={note}
                    onPress={() => handleOpenNote(note._id)}
                    onTogglePin={() => togglePin(note._id)}
                  />
                ))}
              </View>
            </>
          )}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarTitleArea: {
    flex: 1,
    alignItems: 'center',
  },
  screenTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  scrollArea: {
    flex: 1,
  },
  templatesSection: {
    paddingVertical: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  templatesScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  templateCard: {
    width: 170,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  templateIconWell: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  templateDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  tagFiltersSection: {
    paddingBottom: 10,
  },
  tagFiltersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tagFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  tagFilterText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  notesContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  notesSection: {
    marginBottom: 16,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyBox: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyCreateBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
