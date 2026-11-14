import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  visible: boolean;
  title: string;
  placeholder: string;
  initial?: string;
  maxLength?: number;
  onClose: () => void;
  onSave: (value: string) => void;
}

/** A single text field in a bottom sheet: group names, category names. */
export function NamePromptModal({ visible, title, placeholder, initial, maxLength = 100, onClose, onSave }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) setValue(initial ?? '');
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = value.trim().length > 0;
  const save = () => {
    if (canSave) onSave(value.trim());
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={save} disabled={!canSave} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Save" accessibilityState={{ disabled: !canSave }}>
              <Text style={[styles.done, !canSave && { opacity: 0.4 }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={palette.placeholder}
            maxLength={maxLength}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={save}
            accessibilityLabel={placeholder}
          />
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
  input: { ...typography.bodyLarge, color: palette.text, backgroundColor: palette.surfaceAlt, borderRadius: 16, minHeight: 52, paddingHorizontal: 16 },
}));
