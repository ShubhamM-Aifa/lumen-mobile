import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { DEFAULT_LIST_COLOR, LIST_COLORS, LIST_EMOJIS } from './listTheme';

export interface ListEditorValue {
  name: string;
  icon: string;
  color: string;
}

interface Props {
  visible: boolean;
  /** "New list" or "Rename list". */
  title: string;
  initial?: Partial<ListEditorValue>;
  onClose: () => void;
  onSave: (value: ListEditorValue) => void;
}

/** One small sheet for creating a list and for changing a list's name, emoji and colour theme. */
export function ListEditorModal({ visible, title, initial, onClose, onSave }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📋');
  const [color, setColor] = useState(DEFAULT_LIST_COLOR);

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setIcon(initial?.icon ?? '📋');
      setColor(initial?.color ?? DEFAULT_LIST_COLOR);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = name.trim().length > 0;
  const save = () => {
    if (canSave) onSave({ name: name.trim(), icon, color });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={save} disabled={!canSave} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Save list" accessibilityState={{ disabled: !canSave }}>
              <Text style={[styles.done, !canSave && { opacity: 0.4 }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.preview}>
            <View style={[styles.previewTile, { backgroundColor: color }]}>
              <Text style={styles.previewEmoji}>{icon}</Text>
            </View>
          </View>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="List title"
            placeholderTextColor={palette.placeholder}
            maxLength={100}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={save}
            accessibilityLabel="List title"
          />

          <View style={styles.swatches}>
            {LIST_COLORS.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[styles.swatch, { backgroundColor: c.light }]}
                onPress={() => setColor(c.light)}
                accessibilityRole="button"
                accessibilityLabel={`Colour ${c.key}`}
                accessibilityState={{ selected: color.toLowerCase() === c.light.toLowerCase() }}
              >
                {color.toLowerCase() === c.light.toLowerCase() ? <Check size={18} color="#FFFFFF" strokeWidth={3} /> : null}
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojis} keyboardShouldPersistTaps="handled">
            {LIST_EMOJIS.map((e) => (
              <TouchableOpacity
                key={e}
                style={[styles.emoji, icon === e && { backgroundColor: palette.primary + '26', borderColor: palette.primary }]}
                onPress={() => setIcon(e)}
                accessibilityRole="button"
                accessibilityLabel={`Icon ${e}`}
                accessibilityState={{ selected: icon === e }}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = createThemedStyles(palette => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingBottom: 16, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  headerBtn: { minWidth: 64, minHeight: 44, justifyContent: 'center' },
  title: { ...typography.headline, color: palette.text },
  cancel: { ...typography.bodyLarge, color: palette.primaryText },
  done: { ...typography.headline, color: palette.primaryText, textAlign: 'right' },
  preview: { alignItems: 'center' },
  previewTile: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  previewEmoji: { fontSize: 34 },
  input: { ...typography.title2, color: palette.text, textAlign: 'center', backgroundColor: palette.surfaceAlt, borderRadius: 16, minHeight: 52, paddingHorizontal: 16 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emojis: { gap: 8, paddingVertical: 4 },
  emoji: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent', backgroundColor: palette.surfaceAlt },
  emojiText: { fontSize: 22 },
}));
