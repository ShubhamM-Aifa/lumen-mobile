import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  Alert,
  Share,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  ArrowLeft,
  Star,
  Trash2,
  Share2,
  FolderInput,
  Link,
  X,
  Stethoscope,
  Pill,
  Image as ImageIcon,
} from 'lucide-react-native';
import { useNoteStore, ActiveNoteDetails } from '../../src/store/noteStore';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { safeGoBack } from '../../src/utils/navigation';
import { resolveMediaUrl } from '../../src/services/mediaService';
import { uploadMedia } from '../../src/services/mediaUpload';
import { BreadcrumbsBar } from '../../src/components/notes/BreadcrumbsBar';
import { BacklinksSection } from '../../src/components/notes/BacklinksSection';
import { IconPickerModal } from '../../src/components/notes/IconPickerModal';
import { CoverPickerModal } from '../../src/components/notes/CoverPickerModal';
import { PagePickerSheet } from '../../src/components/notes/PagePickerSheet';
import { HealthLinkPickerModal } from '../../src/components/notes/HealthLinkPickerModal';
import { NoteEditorWrapper } from '../../src/components/notes/editor/NoteEditorWrapper';
import { NoteAiButton } from '../../src/components/notes/NoteAiButton';
import type { NoteActionResult } from '../../src/hooks/useAiChat';
import { NoteEditorNativeToolbar } from '../../src/components/notes/editor/NoteEditorNativeToolbar';
import { DatabaseView } from '../../src/components/notes/database/DatabaseView';
import { DatabaseRowPropertiesDrawer } from '../../src/components/notes/database/DatabaseRowPropertiesDrawer';

function parseGradientColors(gradientStr?: string | null): [string, string] {
  if (!gradientStr) return ['#1E1B4B', '#312E81'];
  const matches = gradientStr.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/g);
  if (matches && matches.length >= 2) {
    return [matches[0], matches[1]];
  }
  return ['#1E1B4B', '#312E81'];
}

export default function NoteEditorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();
  const styles = useStyles();

  const {
    notes,
    activeNote,
    fetchNoteById,
    updateNote,
    deleteNote,
    moveNote,
    toggleFavorite,
    togglePin,
    toggleHealthLink,
  } = useNoteStore();

  const note = (activeNote && activeNote._id === id ? activeNote : notes.find((n) => n._id === id)) as ActiveNoteDetails | undefined;

  const [title, setTitle] = useState(note?.title ?? '');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [pagePickerOpen, setPagePickerOpen] = useState(false);
  // Bumped after Lumen AI changes the note on the server, so the editor reloads its content.
  const [editorRevision, setEditorRevision] = useState(0);

  const onAiResult = useCallback((res: NoteActionResult) => {
    if (res.created && res.noteId) {
      useNoteStore.getState().fetchTree().catch(() => { });
      router.push(`/notes/${res.noteId}`);
      return;
    }
    if (res.note) {
      useNoteStore.getState().replaceFromServer(res.note as never);
      setEditorRevision((r) => r + 1);
    }
  }, [router]);
  const [healthLinkModalOpen, setHealthLinkModalOpen] = useState(false);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);

  // Editor Action Command bridge
  const [editorActionCommand, setEditorActionCommand] = useState<{
    id: number;
    type: string;
    payload?: any;
  } | null>(null);

  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchNoteById(id);
    }
  }, [id, fetchNoteById]);

  useEffect(() => {
    if (note && note._id !== loadedIdRef.current) {
      loadedIdRef.current = note._id;
      setTitle(note.title ?? '');
    }
  }, [note?._id, note?.title]);

  // Resolve cover photo URL if coverMediaId exists
  useEffect(() => {
    let active = true;
    if (note?.coverMediaId) {
      resolveMediaUrl(note.coverMediaId).then((url) => {
        if (active && url) setCoverPhotoUrl(url);
      });
    } else {
      setCoverPhotoUrl(null);
    }
    return () => {
      active = false;
    };
  }, [note?.coverMediaId]);

  // Find parent note if note is a database row
  const parentNote = useMemo(() => {
    if (!note?.parentNoteId) return null;
    return notes.find((n) => n._id === note.parentNoteId);
  }, [notes, note?.parentNoteId]);

  if (!note) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => safeGoBack('/notes')}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color={palette.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.notFoundCenter}>
          <Text style={{ color: palette.textSecondary }}>Loading note...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleTitleChange = (text: string) => {
    setTitle(text);
    updateNote(note._id, { title: text });
  };

  const handleDelete = () => {
    Alert.alert('Move to Trash', 'Are you sure you want to move this page to Trash?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Trash',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteNote(note._id);
          safeGoBack('/notes');
        },
      },
    ]);
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const content = note.plainText || '';
    const titleText = note.title?.trim() || 'Untitled Note';
    const shareText = `${note.icon || '📝'} ${titleText}\n\n${content}\n\n— Exported from Lumen Health`;
    try {
      await Share.share({ message: shareText });
    } catch {}
  };

  const handleToolbarCommand = (type: string, payload?: any) => {
    setEditorActionCommand({ id: Date.now(), type, payload });
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const mimeType = asset.mimeType || 'image/jpeg';
        const uploadRes = await uploadMedia(asset.uri, mimeType);
        handleToolbarCommand('insertImage', {
          url: uploadRes.url || asset.uri,
          name: asset.fileName || 'image.jpg',
        });
      }
    } catch (err) {
      console.warn('[NoteEditor] Image pick error:', err);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const mimeType = file.mimeType || 'application/octet-stream';
        const uploadRes = await uploadMedia(file.uri, mimeType);
        handleToolbarCommand('insertFile', {
          mediaId: uploadRes.mediaId,
          name: file.name || 'document',
          size: file.size || 0,
          mimeType,
        });
      }
    } catch (err) {
      console.warn('[NoteEditor] Document pick error:', err);
    }
  };

  const gradientColors = parseGradientColors(note.coverGradient);
  const isFav = Boolean(note.isFavorite || note.isPinned);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top']}>
      {/* Top Navbar */}
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => safeGoBack('/notes')}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color={palette.text} />
        </TouchableOpacity>

        <View style={styles.topBarRight}>
          <NoteAiButton noteId={note._id} noteTitle={note.title} onResult={onAiResult} />
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleFavorite(note._id);
            }}
            accessibilityRole="button"
            accessibilityLabel="Favorite note"
          >
            <Star
              size={20}
              color={isFav ? palette.warning : palette.textSecondary}
              fill={isFav ? palette.warning : 'transparent'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setPagePickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Move note"
          >
            <FolderInput size={20} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share note"
          >
            <Share2 size={20} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete note"
          >
            <Trash2 size={20} color={palette.errorText} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Breadcrumbs Bar */}
      <BreadcrumbsBar
        breadcrumbs={note.breadcrumbs}
        currentTitle={title}
        onNavigate={(parentId) => router.push(`/notes/${parentId}`)}
        onHomePress={() => safeGoBack('/notes')}
      />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Scrollable Page Body */}
        <ScrollView
          style={styles.scrollArea}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          {/* Cover Banner */}
          <TouchableOpacity
            style={styles.coverBanner}
            onPress={() => setCoverPickerOpen(true)}
            activeOpacity={0.85}
          >
            {coverPhotoUrl ? (
              <Image source={{ uri: coverPhotoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <View style={styles.changeCoverBadge}>
              <ImageIcon size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.changeCoverText}>Change Cover</Text>
            </View>
          </TouchableOpacity>

          {/* Header Content */}
          <View style={styles.headerBody}>
            {/* Overlapping Emoji Icon */}
            <TouchableOpacity
              style={[styles.emojiWell, { backgroundColor: palette.surface }]}
              onPress={() => setIconPickerOpen(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Change icon"
            >
              <Text style={styles.emojiText}>{note.icon || '📝'}</Text>
            </TouchableOpacity>

            {/* Title Input */}
            <TextInput
              style={[styles.titleInput, { color: palette.text }]}
              placeholder="Untitled Note"
              placeholderTextColor={palette.placeholder}
              value={title}
              onChangeText={handleTitleChange}
              multiline
            />

            {/* Health Linkages Row */}
            <View style={styles.healthLinkRow}>
              <TouchableOpacity
                style={[styles.addLinkBtn, { borderColor: palette.border }]}
                onPress={() => setHealthLinkModalOpen(true)}
              >
                <Link size={12} color={palette.textSecondary} />
                <Text style={[styles.addLinkText, { color: palette.textSecondary }]}>
                  Link Health Context
                </Text>
              </TouchableOpacity>

              {(note.linkedSymptomIds || []).map((symId) => (
                <TouchableOpacity
                  key={symId}
                  style={[styles.activeLinkChip, { backgroundColor: palette.error + '26' }]}
                  onPress={() => toggleHealthLink(note._id, 'symptom', symId)}
                >
                  <Stethoscope size={12} color={palette.errorText} />
                  <Text style={[styles.activeLinkText, { color: palette.errorText }]}>{symId}</Text>
                  <X size={12} color={palette.errorText} />
                </TouchableOpacity>
              ))}

              {(note.linkedMedicationIds || []).map((medId) => (
                <TouchableOpacity
                  key={medId}
                  style={[styles.activeLinkChip, { backgroundColor: palette.catMeds + '26' }]}
                  onPress={() => toggleHealthLink(note._id, 'medication', medId)}
                >
                  <Pill size={12} color={palette.text} />
                  <Text style={[styles.activeLinkText, { color: palette.text }]}>{medId}</Text>
                  <X size={12} color={palette.text} />
                </TouchableOpacity>
              ))}
            </View>

            {/* If page is a row inside a parent database, render its row properties */}
            {parentNote && parentNote.kind === 'database' && parentNote.database?.properties && (
              <DatabaseRowPropertiesDrawer
                properties={parentNote.database.properties}
                rowProps={note.rowProps || {}}
                onUpdateProp={(propId, val) => {
                  const nextRowProps = { ...(note.rowProps || {}), [propId]: val };
                  updateNote(note._id, { rowProps: nextRowProps });
                }}
              />
            )}

            {/* If this note itself is a Database, render DatabaseView */}
            {note.kind === 'database' && (
              <DatabaseView
                noteId={note._id}
                databaseConfig={note.database}
                onUpdateConfig={(nextCfg) => updateNote(note._id, { database: nextCfg })}
              />
            )}

            {/* TipTap ProseMirror Rich Document Editor */}
            <View style={styles.editorContainer}>
              <NoteEditorWrapper
                key={`${note._id}:${editorRevision}`}
                noteId={note._id}
                doc={note.doc || null}
                placeholder="Press '/' for commands or start writing..."
                onChange={(nextDoc) => updateNote(note._id, { doc: nextDoc })}
                actionCommand={editorActionCommand}
                hideToolbar={true}
              />
            </View>

            {/* Backlinks / Linked From Section */}
            <BacklinksSection
              backlinks={note.backlinks}
              onOpenPage={(targetId) => router.push(`/notes/${targetId}`)}
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Sticky Mobile Formatting Toolbar (Docked at bottom above navigation bar & keyboard) */}
        <NoteEditorNativeToolbar
          onSlashPress={() => handleToolbarCommand('openSlashMenu')}
          onBoldPress={() => handleToolbarCommand('toggleBold')}
          onItalicPress={() => handleToolbarCommand('toggleItalic')}
          onTodoPress={() => handleToolbarCommand('toggleTaskList')}
          onBulletPress={() => handleToolbarCommand('toggleBulletList')}
          onCalloutPress={() => handleToolbarCommand('toggleCallout')}
          onUndoPress={() => handleToolbarCommand('undo')}
          onRedoPress={() => handleToolbarCommand('redo')}
          onImagePress={handlePickImage}
          onFilePress={handlePickFile}
        />
      </KeyboardAvoidingView>

      {/* Pickers & Modals */}
      <IconPickerModal
        visible={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        currentEmoji={note.icon}
        onSelectEmoji={(emoji) => updateNote(note._id, { icon: emoji })}
      />

      <CoverPickerModal
        visible={coverPickerOpen}
        onClose={() => setCoverPickerOpen(false)}
        currentGradient={note.coverGradient}
        currentMediaId={note.coverMediaId || undefined}
        onSelectCover={({ coverGradient, coverMediaId }) => {
          updateNote(note._id, {
            coverGradient: coverGradient !== undefined ? coverGradient : note.coverGradient,
            coverMediaId: coverMediaId !== undefined ? (coverMediaId || undefined) : note.coverMediaId,
          });
        }}
      />

      <PagePickerSheet
        visible={pagePickerOpen}
        onClose={() => setPagePickerOpen(false)}
        noteIdToMove={note._id}
        currentParentId={note.parentNoteId}
        onSelectParent={(newParentId) => moveNote(note._id, newParentId)}
      />

      <HealthLinkPickerModal
        visible={healthLinkModalOpen}
        onClose={() => setHealthLinkModalOpen(false)}
        linkedSymptomIds={note.linkedSymptomIds || []}
        linkedMedicationIds={note.linkedMedicationIds || []}
        onToggleLink={(type, targetId) => toggleHealthLink(note._id, type, targetId)}
      />
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((palette) => ({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  coverBanner: {
    height: 140,
    width: '100%',
    position: 'relative',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 12,
  },
  changeCoverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  changeCoverText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  headerBody: {
    paddingHorizontal: 16,
    position: 'relative',
  },
  emojiWell: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emojiText: {
    fontSize: 28,
  },
  titleInput: {
    ...typography.h1,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: 10,
    padding: 0,
  },
  healthLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  addLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
  },
  addLinkText: {
    fontSize: 12,
    fontWeight: '500',
  },
  activeLinkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  activeLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editorContainer: {
    minHeight: 250,
    marginTop: 8,
  },
}));
