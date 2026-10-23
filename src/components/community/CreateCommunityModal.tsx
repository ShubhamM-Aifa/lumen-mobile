import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, Sparkles, ShieldCheck, Lock, Globe } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useCommunityStore } from '../../store/communityStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated?: (serverId: string) => void;
}

const EMOJI_OPTIONS = ['🌟', '🦓', '🫀', '⚡', '🌿', '🦋', '🌸', '🧬', '💊', '🥄', '🛡️', '✨'];
const COLOR_OPTIONS = ['#38BDF8', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#F43F5E'];
const CONDITION_TAG_OPTIONS = [
  'POTS',
  'EDS',
  'ME/CFS',
  'Long-COVID',
  'Fibromyalgia',
  'MCAS',
  'Pacing',
  'Dysautonomia',
  'Rare Disease',
  'Caregiver',
];

export const CreateCommunityModal: React.FC<Props> = ({ visible, onClose, onCreated }) => {
  const { palette } = useTheme();
  const { createServer } = useCommunityStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🌟');
  const [selectedColor, setSelectedColor] = useState('#38BDF8');
  const [selectedTags, setSelectedTags] = useState<string[]>(['POTS']);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleTag = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedTags.includes(tag)) {
      if (selectedTags.length > 1) {
        setSelectedTags(selectedTags.filter((t) => t !== tag));
      }
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      const server = await createServer({
        name: name.trim(),
        description: description.trim(),
        icon: selectedEmoji,
        color: selectedColor,
        conditionTags: selectedTags,
        isPrivate,
      });

      setName('');
      setDescription('');
      onClose();
      if (onCreated && server?._id) {
        onCreated(server._id);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.container, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            <View style={styles.headerLeft}>
              <Sparkles size={18} color={selectedColor} style={{ marginRight: 6 }} />
              <Text style={[styles.headerTitle, { color: palette.text }]}>Create Community Server</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ padding: 16 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Server Identity Preview */}
            <View style={styles.previewBox}>
              <View style={[styles.previewIcon, { backgroundColor: `${selectedColor}25`, borderColor: selectedColor }]}>
                <Text style={{ fontSize: 32 }}>{selectedEmoji}</Text>
              </View>
              <Text style={[styles.previewTitle, { color: palette.text }]}>
                {name.trim() || 'Your Community Name'}
              </Text>
              <Text style={[styles.previewSub, { color: palette.textSecondary }]}>
                {isPrivate ? '🔒 Private (Invite-Only)' : '🌐 Public Community'}
              </Text>
            </View>

            {/* Name Input */}
            <Text style={[styles.label, { color: palette.textSecondary }]}>COMMUNITY NAME</Text>
            <TextInput
              style={[
                styles.input,
                { color: palette.text, backgroundColor: palette.background, borderColor: palette.border },
              ]}
              placeholder="e.g. EDS & Hypermobility Lounge"
              placeholderTextColor={palette.textDisabled}
              value={name}
              onChangeText={setName}
            />

            {/* Description Input */}
            <Text style={[styles.label, { color: palette.textSecondary, marginTop: 12 }]}>
              TOPIC & ABOUT
            </Text>
            <TextInput
              style={[
                styles.textArea,
                { color: palette.text, backgroundColor: palette.background, borderColor: palette.border },
              ]}
              placeholder="Briefly describe what this space is about..."
              placeholderTextColor={palette.textDisabled}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            {/* Emoji Selection */}
            <Text style={[styles.label, { color: palette.textSecondary, marginTop: 14 }]}>
              CHOOSE ICON
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroll}>
              {EMOJI_OPTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => setSelectedEmoji(emoji)}
                  style={[
                    styles.emojiBtn,
                    {
                      backgroundColor: selectedEmoji === emoji ? `${selectedColor}30` : palette.background,
                      borderColor: selectedEmoji === emoji ? selectedColor : palette.border,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 20 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Color Accent */}
            <Text style={[styles.label, { color: palette.textSecondary, marginTop: 14 }]}>
              THEME ACCENT COLOR
            </Text>
            <View style={styles.colorsRow}>
              {COLOR_OPTIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setSelectedColor(c)}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c },
                    selectedColor === c && styles.colorCircleSelected,
                  ]}
                />
              ))}
            </View>

            {/* Condition Tags */}
            <Text style={[styles.label, { color: palette.textSecondary, marginTop: 14 }]}>
              CONDITION TAGS
            </Text>
            <View style={styles.tagsContainer}>
              {CONDITION_TAG_OPTIONS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={[
                      styles.tagPill,
                      {
                        backgroundColor: active ? selectedColor : palette.background,
                        borderColor: active ? selectedColor : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        { color: active ? '#FFFFFF' : palette.textSecondary },
                      ]}
                    >
                      #{tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Privacy Setting */}
            <View style={[styles.privacyBox, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <View style={styles.privacyLeft}>
                {isPrivate ? (
                  <Lock size={18} color="#F59E0B" />
                ) : (
                  <Globe size={18} color="#10B981" />
                )}
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={[styles.privacyTitle, { color: palette.text }]}>
                    {isPrivate ? 'Private Invite-Only' : 'Public Discovery'}
                  </Text>
                  <Text style={[styles.privacyDesc, { color: palette.textSecondary }]}>
                    {isPrivate
                      ? 'Only users with a 6-character invite code can enter.'
                      : 'Anyone in Lumen can find and join this community.'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: palette.border, true: selectedColor }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Create Button */}
            <TouchableOpacity
              onPress={handleCreate}
              disabled={!name.trim() || loading}
              style={[
                styles.createBtn,
                {
                  backgroundColor: name.trim() ? selectedColor : palette.border,
                },
              ]}
            >
              <Text style={styles.createBtnText}>
                {loading ? 'Creating Server...' : 'Create Community Server'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  previewBox: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
  },
  previewIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  previewSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  textArea: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 70,
  },
  rowScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  colorsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 4,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  privacyBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 18,
  },
  privacyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  privacyTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  privacyDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  createBtn: {
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 30,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
