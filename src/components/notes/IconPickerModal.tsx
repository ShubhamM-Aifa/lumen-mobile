import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, Sparkles, Search } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { validateEmojiInput } from '../../utils/emoji';

interface IconPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  currentEmoji?: string;
}

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: 'Clinical & Health',
    emojis: ['🩺', '💊', '⚡', '🧠', '🫀', '🔬', '📋', '🌿', '💡', '🩹', '🩸', '🌡️', '🧘', '💧', '🍎', '🛌'],
  },
  {
    name: 'Work & Docs',
    emojis: ['📝', '📄', '📁', '📊', '📌', '🏷️', '✏️', '✒️', '📅', '🔍', '💼', '📦', '🔑', '🎯', '🚀', '⭐'],
  },
  {
    name: 'Emotions & Symbols',
    emojis: ['☀️', '🌙', '⭐', '✨', '🔥', '💧', '⚡', '🌈', '❤️', '💙', '💜', '🟢', '⚠️', '❗', '❓', '✅'],
  },
  {
    name: 'Activities & Nature',
    emojis: ['🚶', '🏃', '🚴', '🏊', '🌱', '🌸', '🌲', '🌻', '🐾', '🕊️', '☕', '🍵', '🥑', '💤', '🌤️', '🌧️'],
  },
];

const ALL_FLAT_EMOJIS = EMOJI_CATEGORIES.flatMap((c) => c.emojis);

export const IconPickerModal: React.FC<IconPickerModalProps> = ({
  visible,
  onClose,
  onSelectEmoji,
  currentEmoji,
}) => {
  const { palette } = useTheme();
  const styles = useStyles();
  const [customText, setCustomText] = useState('');

  const handleSelect = (emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectEmoji(emoji);
    onClose();
  };

  const handleCustomChange = (text: string) => {
    setCustomText(text);
    const { emoji } = validateEmojiInput(text);
    if (emoji) {
      handleSelect(emoji);
      setCustomText('');
    }
  };

  const handleRandom = () => {
    const random = ALL_FLAT_EMOJIS[Math.floor(Math.random() * ALL_FLAT_EMOJIS.length)];
    handleSelect(random);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            <View>
              <Text style={[styles.title, { color: palette.text }]}>Choose Icon</Text>
              <Text style={[styles.sub, { color: palette.textSecondary }]}>
                Select an emoji or type one from keyboard
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Controls Bar */}
          <View style={styles.controlsRow}>
            <View style={[styles.inputBox, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <Search size={16} color={palette.textSecondary} />
              <TextInput
                style={[styles.customInput, { color: palette.text }]}
                placeholder="Type emoji from keyboard..."
                placeholderTextColor={palette.placeholder}
                value={customText}
                onChangeText={handleCustomChange}
                maxLength={4}
              />
            </View>
            <TouchableOpacity
              style={[styles.randomBtn, { backgroundColor: palette.surfaceAlt }]}
              onPress={handleRandom}
              accessibilityRole="button"
              accessibilityLabel="Random icon"
            >
              <Sparkles size={16} color={palette.primaryText} />
              <Text style={[styles.randomText, { color: palette.primaryText }]}>Random</Text>
            </TouchableOpacity>
          </View>

          {/* Emoji Grid Categories */}
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {EMOJI_CATEGORIES.map((cat) => (
              <View key={cat.name} style={styles.categoryBlock}>
                <Text style={[styles.categoryTitle, { color: palette.textSecondary }]}>
                  {cat.name}
                </Text>
                <View style={styles.grid}>
                  {cat.emojis.map((emoji) => {
                    const isSelected = emoji === currentEmoji;
                    return (
                      <TouchableOpacity
                        key={emoji}
                        style={[
                          styles.emojiBtn,
                          isSelected && { backgroundColor: palette.primary + '20', borderColor: palette.primary, borderWidth: 1.5 },
                        ]}
                        onPress={() => handleSelect(emoji)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.emojiText}>{emoji}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const useStyles = createThemedStyles((palette) => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    ...typography.h3,
    fontSize: 18,
    fontWeight: '700',
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
  },
  customInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  randomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 10,
  },
  randomText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollArea: {
    paddingHorizontal: 16,
  },
  categoryBlock: {
    marginTop: 12,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
  },
  emojiText: {
    fontSize: 22,
  },
}));

