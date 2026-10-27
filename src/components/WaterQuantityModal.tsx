import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTheme, createThemedStyles } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { useQuickLogStore } from '../store/quickLogStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  quickActionId?: string;
  onLogged?: (quantityMl: number) => void;
}

const PRESETS = [
  { label: '250 ml', value: 250 },
  { label: '500 ml', value: 500 },
  { label: '750 ml', value: 750 },
  { label: '1 L', value: 1000 },
];

export function WaterQuantityModal({ visible, onClose, quickActionId, onLogged }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const [customValue, setCustomValue] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const { tap } = useQuickLogStore();

  const handleSelect = async (ml: number) => {
    if (quickActionId) {
      await tap(quickActionId);
    }
    onLogged?.(ml);
    onClose();
    setCustomValue('');
    setIsCustom(false);
  };

  const handleCustomSubmit = () => {
    const val = parseInt(customValue, 10);
    if (!isNaN(val) && val > 0) {
      handleSelect(val);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.emoji}>💧</Text>
                <Text style={styles.title}>Log Water Intake</Text>
                <Text style={styles.subtitle}>Select quantity to record</Text>
              </View>

              {!isCustom ? (
                <View style={styles.grid}>
                  {PRESETS.map(preset => (
                    <TouchableOpacity
                      key={preset.value}
                      style={styles.presetBtn}
                      onPress={() => handleSelect(preset.value)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.presetText}>{preset.label}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.presetBtn, styles.customBtn]}
                    onPress={() => setIsCustom(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.presetText, styles.customBtnText]}>Custom</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.customContainer}>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="e.g. 350"
                      placeholderTextColor={palette.placeholder}
                      value={customValue}
                      onChangeText={setCustomValue}
                      autoFocus
                    />
                    <Text style={styles.unitText}>ml</Text>
                  </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => setIsCustom(false)}
                    >
                      <Text style={styles.cancelBtnText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.submitBtn}
                      onPress={handleCustomSubmit}
                    >
                      <Text style={styles.submitBtnText}>Log Entry</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const useStyles = createThemedStyles(palette => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  title: {
    ...typography.h2,
    color: palette.text,
  },
  subtitle: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: 2,
  },
  grid: {
    gap: 10,
  },
  presetBtn: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  presetText: {
    ...typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  customBtn: {
    borderColor: palette.secondary,
    backgroundColor: palette.surface,
  },
  customBtnText: {
    color: palette.secondaryText,
  },
  customContainer: {
    gap: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: palette.secondary,
    paddingBottom: 8,
  },
  input: {
    ...typography.h1,
    color: palette.text,
    textAlign: 'center',
    minWidth: 100,
  },
  unitText: {
    ...typography.h3,
    color: palette.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: palette.surfaceAlt,
  },
  cancelBtnText: {
    ...typography.body,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: palette.secondary,
  },
  submitBtnText: {
    ...typography.body,
    fontWeight: '700',
    color: '#09090E',
  },
}));
