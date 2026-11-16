import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Plus,
  Search,
  Star,
  FileText,
  Sparkles,
  X,
  Trash2,
  Table,
  FolderPlus,
  ChevronRight,
} from 'lucide-react-native';
import { useNoteStore, PREBUILT_TEMPLATES } from '../../src/store/noteStore';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { LargeTitleHeader } from '../../src/components/ios/LargeTitleHeader';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { safeGoBack } from '../../src/utils/navigation';
import { PageTree } from '../../src/components/notes/PageTree';
import { PagePickerSheet } from '../../src/components/notes/PagePickerSheet';
import { useAiAccess, useDoctorVisitNote } from '../../src/hooks/useAiChat';

export default function NotesHubScreen() {
  const router = useRouter();
  // Lumen AI writes a doctor-visit prep note from the last 4 weeks of data.
  const aiAccess = useAiAccess();
  const doctorVisit = useDoctorVisitNote();
  const onDoctorVisit = () =>
    doctorVisit.mutate(4, {
      onSuccess: res => {
        if (res.noteId) {
          useNoteStore.getState().fetchTree().catch(() => { });
          router.push(`/notes/${res.noteId}`);
        } else {
          Alert.alert('Could not write the note', 'Lumen AI could not finish it just now. Please try again in a moment.');
        }
      },
      onError: err => Alert.alert('Could not write the note', err instanceof Error ? err.message : ''),
    });
  const { palette } = useTheme();
  const styles = useStyles();

  const {
    tree,
    notes,
    trash,
    searchResults,
    fetchTree,
    fetchNotes,
    fetchTrash,
    createNote,
    createFromTemplate,
    updateNote,
    deleteNote,
    duplicateNote,
    moveNote,
    toggleFavorite,
    searchNotes,
    isLoading,
  } = useNoteStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [movingNoteId, setMovingNoteId] = useState<string | null>(null);

  useEffect(() => {
    fetchTree();
    fetchNotes();
  fetchTrash();
}, [fetchTree, fetchNotes, fetchTrash]);

  // Full-text search trigger
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      searchNotes(searchQuery);
    }
  }, [searchQuery, searchNotes]);

  // Favorite pages (for top quick section)
  const favoritePages = useMemo(() => {
    return tree.filter((n) => n.isFavorite || n.isPinned);
  }, [tree]);

const handleCreateNewPage = async (parentId?: string) => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const newNote = await createNote({
    parentNoteId: parentId,
    kind: 'page',
    title: 'Untitled',
    icon: '📄',
  });
  router.push(`/notes/${newNote._id}`);
};

  const handleCreateNewDatabase = async (parentId?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newNote = await createNote({
        parentNoteId: parentId,
        kind: 'database',
        title: 'Untitled Database',
        icon: '📊',
      });
      router.push(`/notes/${newNote._id}`);
    };

    const handleCreateFromTemplate = async (key: string) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const newNote = await createFromTemplate(key);
      router.push(`/notes/${newNote._id}`);
    };

      const handleOpenPage = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/notes/${id}`);
      };

      const handleRenamePage = (id: string, currentTitle: string) => {
        Alert.prompt
          ? Alert.prompt(
            'Rename Page',
            'Enter a new title:',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Save',
                onPress: (newTitle?: string) => {
                  if (newTitle && newTitle.trim()) {
                    updateNote(id, { title: newTitle.trim() });
                  }
                },
              },
            ],
            'plain-text',
            currentTitle
          )
          : Alert.alert('Rename', `Edit title inside page.`);
      };

      const handleDeletePage = (id: string, title: string) => {
        Alert.alert(
          'Move to Trash',
          `Are you sure you want to move "${title || 'Untitled'}" and its sub-pages to Trash?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Trash',
              style: 'destructive',
              onPress: () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                deleteNote(id);
              },
            },
          ]
        );
      };

      const handleDuplicatePage = async (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await duplicateNote(id);
      };

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
              subtitle={tree.length === 0 ? 'No documents yet' : `${tree.length} ${tree.length === 1 ? 'doc' : 'docs'}`}
              leading={
                <GlassCircleButton accessibilityLabel="Go back" onPress={() => safeGoBack('/(tabs)/today')}>
                  <ArrowLeft size={22} color={palette.text} strokeWidth={2.2} />
                </GlassCircleButton>
              }
              actions={
            <>
                  {/* Trash shortcut */}
                  <GlassCircleButton
                    accessibilityLabel="Trash"
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push('/notes/trash');
                    }}
                  >
                    <Trash2 size={20} color={trash.length > 0 ? palette.errorText : palette.text} strokeWidth={2} />
                  </GlassCircleButton>

                  {/* Search Toggle */}
                  <GlassCircleButton
                    accessibilityLabel="Search notes"
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsSearching(!isSearching);
                    }}
                  >
                    <Search size={20} color={isSearching ? palette.tint : palette.text} strokeWidth={2.2} />
                  </GlassCircleButton>

                    {/* New Page / Database Menu */}
                    <GlassCircleButton
                      accessibilityLabel="New doc"
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Alert.alert('Create New', 'Choose document kind:', [
                          { text: 'New Page 📄', onPress: () => handleCreateNewPage() },
                          { text: 'New Database 📊', onPress: () => handleCreateNewDatabase() },
                          { text: 'Cancel', style: 'cancel' },
                        ]);
                      }}
                    >
                      <Plus size={22} color={palette.text} strokeWidth={2.2} />
                    </GlassCircleButton>
                  </>
          }
        />

                  {/* Search Bar */}
                  {isSearching && (
                      <View style={[styles.searchBar, { backgroundColor: palette.surface }]}>
                        <Search size={16} color={palette.textSecondary} />
                        <TextInput
                          style={[styles.searchInput, { color: palette.text }]}
                          placeholder="Search across all pages and content..."
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

                      {/* Search Results Display */}
                      {isSearching && searchQuery.trim().length > 0 && (
                        <View style={styles.searchResultsSection}>
                          <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
                            Search Results ({searchResults.length})
                          </Text>
                          {searchResults.length === 0 ? (
                            <Text style={[styles.noResultsText, { color: palette.textSecondary }]}>
                              No matches found for "{searchQuery}".
                            </Text>
                          ) : (
                            <View style={[styles.searchCard, { backgroundColor: palette.surface }]}>
                              {searchResults.map((hit) => (
                                <TouchableOpacity
                                  key={hit._id}
                                  style={[styles.hitRow, { borderBottomColor: palette.border }]}
                                  onPress={() => handleOpenPage(hit._id)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.hitEmoji}>{hit.icon || '📄'}</Text>
                                  <View style={styles.hitTextWrap}>
                                    <Text style={[styles.hitTitle, { color: palette.text }]} numberOfLines={1}>
                                      {hit.title || 'Untitled'}
                                    </Text>
                                    {hit.snippet && (
                                      <Text style={[styles.hitSnippet, { color: palette.textSecondary }]} numberOfLines={2}>
                                        {hit.snippet}
                                      </Text>
                                    )}
                                  </View>
                                  <ChevronRight size={14} color={palette.textSecondary} />
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>
                      )}

                      {/* Prebuilt Clinical Templates */}
                      <View style={styles.templatesSection}>
                        <View style={styles.sectionHeader}>
                          <Sparkles size={14} color={palette.warning} />
                          <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
                            Clinical Templates
                          </Text>
                        </View>

                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.templatesScroll}
                          >
                            {aiAccess.data?.fullAccess ? (
                              <TouchableOpacity
                                style={[styles.templateCard, { backgroundColor: palette.surface }]}
                                onPress={onDoctorVisit}
                                disabled={doctorVisit.isPending}
                                activeOpacity={0.75}
                                accessibilityRole="button"
                                accessibilityLabel="Doctor visit prep written by Lumen AI"
                              >
                                <View style={[styles.templateIconWell, { backgroundColor: palette.surfaceAlt }]}>
                                  {doctorVisit.isPending ? <ActivityIndicator color={palette.primaryText} /> : <Text style={styles.templateEmoji}>🩺</Text>}
                                </View>
                                <Text style={[styles.templateTitle, { color: palette.text }]} numberOfLines={2}>
                                  {doctorVisit.isPending ? 'Lumen AI is writing…' : 'Doctor visit prep'}
                                </Text>
                                <Text style={[styles.templateDesc, { color: palette.textSecondary }]} numberOfLines={2}>
                                  Lumen AI fills it from your last 4 weeks
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                            {PREBUILT_TEMPLATES.map((tmpl) => (
                              <TouchableOpacity
                                key={tmpl.key}
                                style={[styles.templateCard, { backgroundColor: palette.surface }]}
                                onPress={() => handleCreateFromTemplate(tmpl.key)}
                                activeOpacity={0.75}
                                accessibilityRole="button"
                                accessibilityLabel={`New note from template: ${tmpl.title}`}
                              >
                                  <View style={[styles.templateIconWell, { backgroundColor: palette.surfaceAlt }]}>
                                    <Text style={styles.templateEmoji}>{tmpl.icon}</Text>
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

                      {/* Favorites Section */}
                      {favoritePages.length > 0 && (
                        <View style={styles.favoritesSection}>
                          <View style={styles.sectionHeader}>
                            <Star size={14} color={palette.warning} fill={palette.warning} />
                            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>Favorites</Text>
                          </View>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.favoritesScroll}
                          >
                            {favoritePages.map((fav) => (
                              <TouchableOpacity
                                key={fav._id}
                                style={[styles.favCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
                                onPress={() => handleOpenPage(fav._id)}
                                activeOpacity={0.75}
                              >
                                <Text style={styles.favEmoji}>{fav.icon || '📄'}</Text>
                                <Text style={[styles.favTitle, { color: palette.text }]} numberOfLines={1}>
                                  {fav.title || 'Untitled'}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}

                          {/* Notion Workspace Tree */}
                          <View style={styles.workspaceSection}>
                            <View style={styles.workspaceHeader}>
                              <View style={styles.sectionHeader}>
                                <FileText size={14} color={palette.textSecondary} />
                                <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>Workspace</Text>
                              </View>

                              <View style={styles.quickAddBtns}>
                                <TouchableOpacity
                                  style={[styles.addBtnPill, { backgroundColor: palette.surfaceAlt }]}
                                  onPress={() => handleCreateNewPage()}
                                >
                                  <Plus size={12} color={palette.primary} />
                                  <Text style={[styles.addBtnText, { color: palette.text }]}>Page</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={[styles.addBtnPill, { backgroundColor: palette.surfaceAlt }]}
                                  onPress={() => handleCreateNewDatabase()}
                                >
                                  <Table size={12} color={palette.primary} />
                                  <Text style={[styles.addBtnText, { color: palette.text }]}>Database</Text>
                                </TouchableOpacity>
                              </View>
                            </View>

                            {tree.length === 0 ? (
                              <View style={styles.emptyBox}>
                                <Text style={styles.emptyEmoji}>📝</Text>
                                <Text style={[styles.emptyTitle, { color: palette.text }]}>No documents yet</Text>
                                <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
                                  Create pages, sub-pages, and structured databases with Notion-style nesting.
                                </Text>
                                <TouchableOpacity
                                  style={[styles.emptyCreateBtn, { backgroundColor: palette.primary }]}
                                  onPress={() => handleCreateNewPage()}
                                >
                                  <Plus size={16} color="#FFFFFF" />
                                  <Text style={styles.emptyCreateBtnText}>Create first page</Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View style={[styles.treeCard, { backgroundColor: palette.surface }]}>
                                <PageTree
                                  tree={tree}
                                  onOpenPage={handleOpenPage}
                                  onCreateSubPage={(pid) => handleCreateNewPage(pid)}
                                  onCreateSubDatabase={(pid) => handleCreateNewDatabase(pid)}
                                  onRenamePage={handleRenamePage}
                                  onToggleFavorite={(id) => toggleFavorite(id)}
                                  onMovePage={(id) => setMovingNoteId(id)}
                                  onDuplicatePage={handleDuplicatePage}
                                  onDeletePage={handleDeletePage}
                                />
                              </View>
                            )}
                          </View>

                          <View style={{ height: 60 }} />
                        </ScrollView>

      {/* Page Move Sheet */}
                      {movingNoteId && (
                        <PagePickerSheet
                          visible={Boolean(movingNoteId)}
                          onClose={() => setMovingNoteId(null)}
                          noteIdToMove={movingNoteId}
                          onSelectParent={(newParentId) => {
                            if (movingNoteId) {
                              moveNote(movingNoteId, newParentId);
                            }
                          }}
                        />
                      )}
                    </SafeAreaView>
                  );
}

const useStyles = createThemedStyles((palette) => ({
                    container: {flex: 1, backgroundColor: palette.background },
                  scrollArea: {flex: 1 },
                  scrollContent: {gap: 16, paddingTop: 6, paddingBottom: 48 },
                  searchBar: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  marginHorizontal: 16,
                  paddingHorizontal: 14,
                  minHeight: 44,
                  borderRadius: 22,
                  gap: 8,
  },
                  searchInput: {flex: 1, ...typography.bodyLarge, padding: 0 },
                  searchResultsSection: {
                    paddingHorizontal: 16,
                  gap: 8,
  },
                  noResultsText: {
                    fontSize: 13,
                  fontStyle: 'italic',
                  paddingVertical: 10,
  },
                  searchCard: {
                    borderRadius: 16,
                  overflow: 'hidden',
  },
                  hitRow: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderBottomWidth: StyleSheet.hairlineWidth,
  },
                  hitEmoji: {
                    fontSize: 18,
  },
                  hitTextWrap: {
                    flex: 1,
  },
                  hitTitle: {
                    fontSize: 14,
                  fontWeight: '600',
  },
                  hitSnippet: {
                    fontSize: 12,
                  marginTop: 2,
                  lineHeight: 16,
  },
                  templatesSection: {gap: 8 },
                  sectionHeader: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20 },
                  sectionTitle: {...typography.sectionLabel},
                  templatesScroll: {paddingHorizontal: 16, gap: 12 },
                  templateCard: {
                    width: 176,
                  borderRadius: 22,
                  padding: 14,
  },
                  templateIconWell: {
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
  },
                  templateEmoji: {fontSize: 20 },
                  templateTitle: {...typography.headline, marginBottom: 4, fontSize: 14 },
                  templateDesc: {...typography.footnote, fontSize: 11, lineHeight: 15 },
                  favoritesSection: {gap: 8 },
                  favoritesScroll: {paddingHorizontal: 16, gap: 8 },
                  favCard: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  maxWidth: 160,
  },
                  favEmoji: {fontSize: 15 },
                  favTitle: {fontSize: 13, fontWeight: '600', flexShrink: 1 },
                  workspaceSection: {gap: 8 },
                  workspaceHeader: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingRight: 16,
  },
                  quickAddBtns: {
                    flexDirection: 'row',
                  gap: 6,
  },
                  addBtnPill: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
  },
                  addBtnText: {
                    fontSize: 11,
                  fontWeight: '600',
  },
                  treeCard: {
                    marginHorizontal: 16,
                  borderRadius: 20,
                  overflow: 'hidden',
                  paddingVertical: 6,
  },
                  emptyBox: {paddingVertical: 48, alignItems: 'center', paddingHorizontal: 32, gap: 6 },
                  emptyEmoji: {fontSize: 40 },
                  emptyTitle: {...typography.title2, marginTop: 6 },
                  emptySub: {...typography.subhead, textAlign: 'center' },
                  emptyCreateBtn: {
                    flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 14,
                  paddingHorizontal: 22,
                  minHeight: 46,
                  borderRadius: 23,
  },
                  emptyCreateBtnText: {...typography.headline, color: '#FFFFFF' },
}));
