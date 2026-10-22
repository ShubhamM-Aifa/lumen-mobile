import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, Hash, Bookmark, Plus } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useCommunityStore } from '../../store/communityStore';
import { ChannelType } from '../../shared/types';

interface Props {
  visible: boolean;
  serverId: string;
  onClose: () => void;
  onCreated?: () => void;
}

const CATEGORIES = [
  'COMMUNITY',
  'CONDITION HUBS',
  'STORIES & FORUMS',
  'RESOURCE EXCHANGE',
  'CARE & COMFORT',
];

export const CreateChannelModal: React.FC<Props> = ({
  visible,
  serverId,
  onClose,
  onCreated,
}) => {
  const { palette } = useTheme();
  const { createChannel } = useCommunityStore();

  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('COMMUNITY');
  const [type, setType] = useState<ChannelType>('text');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      await createChannel(serverId, {
        name: name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        topic: topic.trim(),
        category,
        type,
        icon: type === 'forum' ? '🏷️' : '💬',
        color: palette.primary,
        order: 0,
      });

      setName('');
      setTopic('');
      onClose();
      if (onCreated) onCreated();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            <View style={styles.headerLeft}>
              <Plus size={18} color={palette.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.headerTitle, { color: palette.text }]}>Create Channel</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            {/* Channel Type Selector */}
            <Text style={[styles.label, { color: palette.textSecondary }]}>CHANNEL TYPE</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                onPress={() => setType('text')}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: type === 'text' ? `${palette.primary}20` : palette.background,
                    borderColor: type === 'text' ? palette.primary : palette.border,
                  },
                ]}
              >
                <Hash size={20} color={type === 'text' ? palette.primary : palette.textSecondary} />
                <View style={{ marginLeft: 8 }}>
                  <Text style={[styles.typeTitle, { color: palette.text }]}>Text Channel</Text>
                  <Text style={[styles.typeDesc, { color: palette.textDisabled }]}>
                    Real-time chat, notes, & embeds
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setType('forum')}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: type === 'forum' ? `${palette.primary}20` : palette.background,
                    borderColor: type === 'forum' ? palette.primary : palette.border,
                    marginTop: 8,
                  },
                ]}
              >
                <Bookmark size={20} color={type === 'forum' ? palette.primary : palette.textSecondary} />
                <View style={{ marginLeft: 8 }}>
                  <Text style={[styles.typeTitle, { color: palette.text }]}>Forum Channel</Text>
                  <Text style={[styles.typeDesc, { color: palette.textDisabled }]}>
                    Long stories, protocols & threads
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Channel Name */}
            <Text style={[styles.label, { color: palette.textSecondary, marginTop: 14 }]}>
              CHANNEL NAME
            </Text>
            <View
              style={[
                styles.nameInputBox,
                { backgroundColor: palette.background, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.hashPrefix, { color: palette.textDisabled }]}>#</Text>
              <TextInput
                style={[styles.nameInput, { color: palette.text }]}
                placeholder="new-channel"
                placeholderTextColor={palette.textDisabled}
                autoCapitalize="none"
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Category Picker */}
            <Text style={[styles.label, { color: palette.textSecondary, marginTop: 14 }]}>
              CATEGORY
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[
                    styles.catPill,
                    {
                      backgroundColor: category === cat ? palette.primary : palette.background,
                      borderColor: category === cat ? palette.primary : palette.border,
                    },
                  ]}
                >
                  <Text style={{ color: category === cat ? '#FFFFFF' : palette.textSecondary, fontSize: 12, fontWeight: '700' }}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Topic Input */}
            <Text style={[styles.label, { color: palette.textSecondary, marginTop: 14 }]}>
              CHANNEL TOPIC (OPTIONAL)
            </Text>
            <TextInput
              style={[
                styles.topicInput,
                { color: palette.text, backgroundColor: palette.background, borderColor: palette.border },
              ]}
              placeholder="What should members talk about here?"
              placeholderTextColor={palette.textDisabled}
              value={topic}
              onChangeText={setTopic}
            />

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleCreate}
              disabled={!name.trim() || loading}
              style={[
                styles.createBtn,
                { backgroundColor: name.trim() ? palette.primary : palette.border },
              ]}
            >
              <Text style={styles.createBtnText}>
                {loading ? 'Creating...' : 'Create Channel'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
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
    height: '75%',
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
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  typeRow: {
    marginBottom: 6,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  typeDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  nameInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  hashPrefix: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 4,
  },
  nameInput: {
    flex: 1,
    fontSize: 14,
  },
  catScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 8,
  },
  topicInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  createBtn: {
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
