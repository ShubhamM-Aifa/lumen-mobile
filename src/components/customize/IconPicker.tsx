/**
 * IconPicker — modal emoji selector allowing:
 * 1. Direct keyboard entry of any Unicode emoji from mobile keyboard
 * 2. Strict validation & restriction (rejects letters, numbers, non-emojis with real-time feedback)
 * 3. Curated categorical presets for quick 1-tap picks
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Sparkles,
  Smile,
  AlertCircle,
  Check,
  X,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { validateEmojiInput, isSingleEmoji } from '../../utils/emoji';

interface IconSection {
  id: string;
  label: string;
  icons: string[];
}

const ICON_SECTIONS: IconSection[] = [
  {
    id: 'symptoms',
    label: 'Symptoms & Body',
    icons: [
      '🤒', '🤧', '😣', '🥱', '😔', '😰', '😤', '🤢', '🩸', '🌡️',
      '🫁', '🫀', '🦴', '💪', '👁️', '🧠', '👂', '🦷', '🤲', '🤕',
      '🤮', '🥵', '🥶', '😵‍💫', '🥴', '😮‍💨', '🤐',
    ],
  },
  {
    id: 'activities',
    label: 'Activities',
    icons: [
      '🚶', '🏃', '🧘', '🚴', '🏊', '🤸', '🧗', '⛹️', '🕺', '🏋️',
      '🛁', '🚿', '🪥', '☀️', '🌿', '🏕️', '😴', '🛋️', '🧹', '📖',
      '🎯', '🎨', '🎵', '💤',
    ],
  },
  {
    id: 'food',
    label: 'Food & Drink',
    icons: [
      '🍽️', '🥗', '🥦', '🍎', '🥚', '🥩', '🐟', '🧅', '🌶️', '🍞',
      '🥛', '☕', '🍵', '💧', '🥤', '🍷', '🍺', '🍫', '🥑', '🍊',
      '🍌', '🥕', '🍲', '🧃',
    ],
  },
  {
    id: 'health',
    label: 'Health & Meds',
    icons: [
      '💊', '💉', '🩺', '🩻', '🧬', '🔬', '📊', '🧪', '⚕️', '🏥',
      '🩹', '🧴', '🧻', '⏱️', '🗓️', '📝', '📋', '✅', '🔔', '🧊',
      '♨️', '⚖️', '🚨',
    ],
  },
  {
    id: 'mood',
    label: 'Mood & Mind',
    icons: [
      '😊', '😄', '😐', '😢', '😡', '😱', '🥰', '😴', '💭', '🧠',
      '🎭', '🌈', '⚡', '🔥', '❄️', '🌊', '🌸', '🌾', '💫', '☀️',
      '🌧️', '🕊️',
    ],
  },
  {
    id: 'environment',
    label: 'Environment',
    icons: [
      '☀️', '🌤️', '⛅', '🌧️', '❄️', '🌨️', '🌡️', '💨', '🌿', '🏙️',
      '🌲', '🌊', '🌺', '🌻', '🍂', '🌾', '🦠', '🌫️', '⚡', '🌪️',
      '🌑', '🌙',
    ],
  },
];

const ALL_ICONS = Array.from(new Set(ICON_SECTIONS.flatMap(s => s.icons)));

interface Props {
  value: string;
  onChange: (icon: string) => void;
  label?: string;
}

export function IconPicker({ value, onChange, label = 'Icon' }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();

  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isFocused, setIsFocused] = useState(false);

  // Synchronize customInput when modal opens
  const handleOpen = () => {
    setCustomInput(value || '');
    setWarning(null);
    setActiveCategory('all');
    setOpen(true);
  };

  // Select an emoji directly (from preset grid or validated input)
  const handleSelectEmoji = (emoji: string) => {
    if (!emoji) return;
    setWarning(null);
    setCustomInput(emoji);
    onChange(emoji);
    Haptics.selectionAsync();
  };

  // Validate keyboard input in real-time
  const handleKeyboardInputChange = (text: string) => {
    if (!text) {
      setCustomInput('');
      setWarning(null);
      return;
    }

    const { emoji, hasNonEmoji } = validateEmojiInput(text);

    // If user entered letters, digits, punctuation without any emoji
    if (hasNonEmoji && !emoji) {
      setWarning('Only emojis are allowed. Tap the 😊 key on your keyboard.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    // If a valid emoji was entered or pasted
    if (emoji) {
      handleSelectEmoji(emoji);

      if (hasNonEmoji) {
        setWarning('Extracted emoji only. Regular letters and symbols were ignored.');
        setTimeout(() => setWarning(null), 3000);
      }
    }
  };

  // Filtered preset icons based on selected tab
  const displayedIcons = useMemo(() => {
    if (activeCategory === 'all') return ALL_ICONS;
    const sec = ICON_SECTIONS.find(s => s.id === activeCategory);
    return sec ? sec.icons : ALL_ICONS;
  }, [activeCategory]);

  const displayEmoji = value || '✨';

  return (
    <>
      {/* Form Row */}
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity
          style={styles.preview}
          onPress={handleOpen}
          accessibilityLabel={`Select icon, current: ${value || 'none'}. Tap to change.`}
          accessibilityRole="button"
        >
          <View style={styles.previewBadge}>
            <Text style={styles.previewIcon}>{displayEmoji}</Text>
          </View>
          <View style={styles.previewTextGroup}>
            <Text style={styles.previewHint}>Tap to change</Text>
            <ChevronRight size={15} color={palette.textSecondary} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Modal Sheet */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.backdrop}
        >
          <Pressable style={styles.backdropTouch} onPress={() => setOpen(false)} />
          
          <View style={styles.sheet}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Choose an Icon</Text>
                <Text style={styles.sheetSubtitle}>Pick a preset or type any emoji from your keyboard</Text>
              </View>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                accessibilityLabel="Close icon picker"
                style={styles.doneBtn}
              >
                <Text style={styles.done}>Done</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={displayedIcons}
              keyExtractor={(item, index) => `${item}-${index}`}
              numColumns={7}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <View style={styles.headerComponent}>
                  {/* Keyboard Emoji Input Card */}
                  <View style={styles.customCard}>
                    <View style={styles.customHeaderRow}>
                      <Sparkles size={14} color={palette.primaryText} />
                      <Text style={styles.customSectionTitle}>ENTER EMOJI FROM KEYBOARD</Text>
                    </View>

                    <View style={styles.inputRow}>
                      {/* Active Emoji Display */}
                      <View style={styles.activeEmojiTile}>
                        <Text style={styles.activeEmojiText}>{displayEmoji}</Text>
                      </View>

                      {/* Text Input for Mobile Emoji Keyboard */}
                      <View
                        style={[
                          styles.inputContainer,
                          isFocused && styles.inputContainerFocused,
                          Boolean(warning) && styles.inputContainerError,
                        ]}
                      >
                        <Smile size={18} color={palette.textSecondary} style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.textInput}
                          placeholder="Type or paste any emoji…"
                          placeholderTextColor={palette.placeholder}
                          value={customInput}
                          onChangeText={handleKeyboardInputChange}
                          onFocus={() => setIsFocused(true)}
                          onBlur={() => setIsFocused(false)}
                          autoCorrect={false}
                          autoCapitalize="none"
                          returnKeyType="done"
                          accessibilityLabel="Enter custom emoji from keyboard"
                        />
                        {Boolean(customInput) && (
                          <TouchableOpacity
                            onPress={() => {
                              setCustomInput('');
                              setWarning(null);
                            }}
                            accessibilityLabel="Clear emoji input"
                            style={styles.clearBtn}
                          >
                            <X size={15} color={palette.textSecondary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Warning Notice if user types non-emoji */}
                    {Boolean(warning) && (
                      <View style={styles.warningBox}>
                        <AlertCircle size={14} color="#EF4444" />
                        <Text style={styles.warningText}>{warning}</Text>
                      </View>
                    )}

                    <Text style={styles.helperTip}>
                      💡 Tip: Open your phone keyboard&apos;s emoji panel (😊) to select any icon. Non-emoji text is restricted.
                    </Text>
                  </View>

                  {/* Section Divider */}
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR CHOOSE FROM PRESETS</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  {/* Category Filter Chips */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryChipsRow}
                  >
                    <TouchableOpacity
                      style={[
                        styles.categoryChip,
                        activeCategory === 'all' && styles.categoryChipActive,
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setActiveCategory('all');
                      }}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          activeCategory === 'all' && styles.categoryChipTextActive,
                        ]}
                      >
                        All
                      </Text>
                    </TouchableOpacity>

                    {ICON_SECTIONS.map(sec => {
                      const isCatActive = activeCategory === sec.id;
                      return (
                        <TouchableOpacity
                          key={sec.id}
                          style={[
                            styles.categoryChip,
                            isCatActive && styles.categoryChipActive,
                          ]}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setActiveCategory(sec.id);
                          }}
                        >
                          <Text
                            style={[
                              styles.categoryChipText,
                              isCatActive && styles.categoryChipTextActive,
                            ]}
                          >
                            {sec.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = item === value;
                return (
                  <TouchableOpacity
                    style={[styles.gridCell, isSelected && styles.gridCellActive]}
                    onPress={() => handleSelectEmoji(item)}
                    accessibilityLabel={`Select emoji ${item}`}
                    accessibilityRole="button"
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cellIcon}>{item}</Text>
                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <Check size={10} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListFooterComponent={
                <View style={styles.footerContainer}>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={() => setOpen(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Apply selected icon"
                  >
                    <Check size={18} color="#FFFFFF" />
                    <Text style={styles.confirmButtonText}>Use {displayEmoji}</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const useStyles = createThemedStyles((palette) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    color: palette.text,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: palette.primary + '14',
    borderWidth: 1,
    borderColor: palette.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewIcon: {
    fontSize: 24,
  },
  previewTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewHint: {
    ...typography.small,
    color: palette.textSecondary,
    fontWeight: '500',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  sheetTitle: {
    ...typography.h3,
    color: palette.text,
    fontSize: 18,
  },
  sheetSubtitle: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
  doneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: palette.primary + '14',
  },
  done: {
    ...typography.bodyBold,
    color: palette.primaryText,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerComponent: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  customCard: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    marginBottom: 14,
  },
  customHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  customSectionTitle: {
    ...typography.label,
    color: palette.primaryText,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeEmojiTile: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: palette.surface,
    borderWidth: 2,
    borderColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  activeEmojiText: {
    fontSize: 26,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    backgroundColor: palette.surface,
    borderRadius: 22,
    paddingHorizontal: 12,
  },
  inputContainerFocused: {
    borderColor: palette.primary,
  },
  inputContainerError: {
    borderColor: '#EF4444',
  },
  textInput: {
    flex: 1,
    ...typography.body,
    color: palette.text,
    paddingVertical: 0,
    fontSize: 15,
  },
  clearBtn: {
    padding: 4,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
  },
  warningText: {
    ...typography.caption,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },
  helperTip: {
    ...typography.caption,
    color: palette.textSecondary,
    fontSize: 11,
    marginTop: 8,
    lineHeight: 15,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
  },
  dividerText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.6,
  },
  categoryChipsRow: {
    gap: 8,
    paddingBottom: 10,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  categoryChipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  categoryChipText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  gridCell: {
    flex: 1 / 7,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    margin: 3,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
    position: 'relative',
  },
  gridCellActive: {
    backgroundColor: palette.primary + '22',
    borderColor: palette.primary,
  },
  cellIcon: {
    fontSize: 22,
  },
  checkBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerContainer: {
    marginTop: 18,
    marginBottom: 6,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  confirmButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
}));
