import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Star,
  Trash2,
  Share2,
  Plus,
  Heading1,
  Heading2,
  CheckSquare,
  Lightbulb,
  ChevronRightSquare,
  List,
  Quote,
  Minus,
  Link,
  X,
  Stethoscope,
  Pill,
} from 'lucide-react-native';
import { useNoteStore } from '../../src/store/noteStore';
import { useTheme } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { BlockRenderer } from '../../src/components/notes/BlockRenderer';
import { SlashMenuModal } from '../../src/components/notes/SlashMenuModal';
import { HealthLinkPickerModal } from '../../src/components/notes/HealthLinkPickerModal';
import { INote, INoteBlock, NoteBlockType } from '../../src/shared/types';

const COVER_GRADIENTS = [
  ['#1E1B4B', '#312E81'], // Indigo Night
  ['#0F172A', '#0369A1'], // Deep Clinical Cyan
  ['#450A0A', '#DC2626'], // Flare Crimson
  ['#064E3B', '#059669'], // Healing Emerald
  ['#3B0764', '#7C3AED'], // Royal Purple
  ['#18181B', '#27272A'], // Obsidian Dark
];

const QUICK_EMOJIS = ['📝', '🩺', '⚡', '💊', '🧠', '🫀', '🔬', '📋', '🌿', '💡'];

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();

  const {
    notes,
    fetchNoteById,
    updateNote,
    deleteNote,
    togglePin,
    addBlock,
    updateBlock,
    deleteBlock,
    toggleHealthLink,
  } = useNoteStore();

  const note = notes.find((n) => n._id === id);

  const [title, setTitle] = useState(note?.title || 'Untitled Note');
  const [coverIndex, setCoverIndex] = useState(0);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [healthLinkModalOpen, setHealthLinkModalOpen] = useState(false);
  const [activeBlockIdForInsert, setActiveBlockIdForInsert] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (id) {
      fetchNoteById(id);
    }
  }, [id, fetchNoteById]);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
    }
  }, [note?.title]);

  if (!note) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
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
    updateNote(note._id, { title: text.trim() || 'Untitled Note' });
  };

  const handleCycleCover = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextIdx = (coverIndex + 1) % COVER_GRADIENTS.length;
    setCoverIndex(nextIdx);
  };

  const handleCycleEmoji = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentIdx = QUICK_EMOJIS.indexOf(note.icon || '📝');
    const nextEmoji = QUICK_EMOJIS[(currentIdx + 1) % QUICK_EMOJIS.length];
    updateNote(note._id, { icon: nextEmoji });
  };

  const handleDelete = () => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteNote(note._id);
          router.back();
        },
      },
    ]);
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const plainContent = note.blocks.map((b) => b.content).join('\n\n');
    const shareText = `${note.icon || '📝'} ${note.title}\n\n${plainContent}\n\n— Exported from Lumen Health`;
    try {
      await Share.share({ message: shareText });
    } catch {}
  };

  const handleInsertBlockFromToolbar = (type: NoteBlockType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addBlock(note._id, type, activeBlockIdForInsert);
  };

  const activeGradient = COVER_GRADIENTS[coverIndex];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Navbar */}
        <View style={[styles.topBar, { borderBottomColor: 'rgba(255, 255, 255, 0.08)' }]}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color={palette.text} />
          </TouchableOpacity>

          <View style={styles.topBarRight}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                togglePin(note._id);
              }}
              accessibilityRole="button"
              accessibilityLabel="Pin note"
            >
              <Star
                size={20}
                color={note.isPinned ? '#F59E0B' : palette.textSecondary}
                fill={note.isPinned ? '#F59E0B' : 'transparent'}
              />
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
              <Trash2 size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Scrollable Document Area */}
        <ScrollView style={styles.documentArea} showsVerticalScrollIndicator={false}>
          {/* Notion Banner Cover */}
          <TouchableOpacity
            style={styles.coverBanner}
            onPress={handleCycleCover}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={activeGradient as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.changeCoverBadge}>
              <Text style={styles.changeCoverText}>Change Cover</Text>
            </View>
          </TouchableOpacity>

          {/* Document Header Body */}
          <View style={styles.headerBody}>
            {/* Overlapping Emoji Icon */}
            <TouchableOpacity
              style={[styles.emojiWell, { backgroundColor: palette.surface }]}
              onPress={handleCycleEmoji}
              activeOpacity={0.7}
            >
              <Text style={styles.emojiText}>{note.icon || '📝'}</Text>
            </TouchableOpacity>

            {/* Document Title Input */}
            <TextInput
              style={[styles.titleInput, { color: palette.text }]}
              placeholder="Untitled"
              placeholderTextColor={palette.textDisabled}
              value={title}
              onChangeText={handleTitleChange}
              multiline
            />

            {/* Health Context Linkages Row */}
            <View style={styles.healthLinkRow}>
              <TouchableOpacity
                style={[styles.addLinkBtn, { borderColor: 'rgba(255, 255, 255, 0.15)' }]}
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
                  style={[styles.activeLinkChip, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}
                  onPress={() => toggleHealthLink(note._id, 'symptom', symId)}
                >
                  <Stethoscope size={11} color="#EF4444" />
                  <Text style={[styles.activeLinkText, { color: '#EF4444' }]}>{symId}</Text>
                  <X size={11} color="#EF4444" />
                </TouchableOpacity>
              ))}

              {(note.linkedMedicationIds || []).map((medId) => (
                <TouchableOpacity
                  key={medId}
                  style={[styles.activeLinkChip, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}
                  onPress={() => toggleHealthLink(note._id, 'medication', medId)}
                >
                  <Pill size={11} color="#A855F7" />
                  <Text style={[styles.activeLinkText, { color: '#A855F7' }]}>{medId}</Text>
                  <X size={11} color="#A855F7" />
                </TouchableOpacity>
              ))}
            </View>

            {/* Blocks Stream */}
            <View style={styles.blocksList}>
              {note.blocks.map((block, idx) => (
                <BlockRenderer
                  key={block.id}
                  block={block}
                  index={idx}
                  onUpdate={(updates) => updateBlock(note._id, block.id, updates)}
                  onDelete={() => deleteBlock(note._id, block.id)}
                  onEnterPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    addBlock(note._id, 'paragraph', block.id);
                  }}
                  onSlashTrigger={() => {
                    setActiveBlockIdForInsert(block.id);
                    setSlashMenuOpen(true);
                  }}
                />
              ))}

              {/* Inline + Add Block Button */}
              <TouchableOpacity
                style={styles.addBlockInline}
                onPress={() => {
                  setActiveBlockIdForInsert(undefined);
                  setSlashMenuOpen(true);
                }}
              >
                <Plus size={16} color={palette.textSecondary} />
                <Text style={[styles.addBlockInlineText, { color: palette.textSecondary }]}>
                  Add block or type '/'
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Sticky Mobile Formatting Toolbar (Above Keyboard) */}
        <View style={[styles.stickyToolbar, { backgroundColor: palette.surface, borderTopColor: 'rgba(255, 255, 255, 0.08)' }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarScroll}>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => setSlashMenuOpen(true)}
            >
              <Text style={[styles.slashBtnText, { color: palette.primary }]}>/</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => handleInsertBlockFromToolbar('heading_1')}
            >
              <Heading1 size={17} color={palette.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => handleInsertBlockFromToolbar('heading_2')}
            >
              <Heading2 size={17} color={palette.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => handleInsertBlockFromToolbar('todo')}
            >
              <CheckSquare size={17} color={palette.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => handleInsertBlockFromToolbar('callout')}
            >
              <Lightbulb size={17} color="#FBBF24" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => handleInsertBlockFromToolbar('toggle')}
            >
              <ChevronRightSquare size={17} color="#F472B6" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => handleInsertBlockFromToolbar('bullet_list')}
            >
              <List size={17} color={palette.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => handleInsertBlockFromToolbar('quote')}
            >
              <Quote size={17} color={palette.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => handleInsertBlockFromToolbar('divider')}
            >
              <Minus size={17} color={palette.textSecondary} />
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Slash Command Picker Modal */}
        <SlashMenuModal
          visible={slashMenuOpen}
          onClose={() => setSlashMenuOpen(false)}
          onSelectBlock={(type) => {
            addBlock(note._id, type, activeBlockIdForInsert);
          }}
        />

        {/* Health Link Picker Modal */}
        <HealthLinkPickerModal
          visible={healthLinkModalOpen}
          onClose={() => setHealthLinkModalOpen(false)}
          linkedSymptomIds={note.linkedSymptomIds || []}
          linkedMedicationIds={note.linkedMedicationIds || []}
          onToggleLink={(type, targetId) => toggleHealthLink(note._id, type, targetId)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentArea: {
    flex: 1,
  },
  coverBanner: {
    height: 120,
    width: '100%',
    position: 'relative',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 12,
  },
  changeCoverBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  changeCoverText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  headerBody: {
    paddingHorizontal: 20,
    position: 'relative',
  },
  emojiWell: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  emojiText: {
    fontSize: 26,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
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
  blocksList: {
    marginTop: 4,
  },
  addBlockInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  addBlockInlineText: {
    fontSize: 14,
  },
  stickyToolbar: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolbarScroll: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slashBtnText: {
    fontSize: 18,
    fontWeight: '800',
  },
});
