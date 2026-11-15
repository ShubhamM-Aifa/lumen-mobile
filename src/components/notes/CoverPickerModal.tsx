import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { X, Image as ImageIcon, Trash2 } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { uploadMedia } from '../../services/mediaUpload';

interface CoverPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCover: (cover: { coverGradient?: string; coverMediaId?: string | null }) => void;
  currentGradient?: string;
  currentMediaId?: string | null;
}

export const COVER_PRESETS: { name: string; colors: [string, string] }[] = [
  { name: 'Indigo Night', colors: ['#1E1B4B', '#312E81'] },
  { name: 'Clinical Cyan', colors: ['#0F172A', '#0369A1'] },
  { name: 'Flare Crimson', colors: ['#450A0A', '#DC2626'] },
  { name: 'Healing Emerald', colors: ['#064E3B', '#059669'] },
  { name: 'Royal Purple', colors: ['#3B0764', '#7C3AED'] },
  { name: 'Obsidian Dark', colors: ['#18181B', '#27272A'] },
  { name: 'Sunset Warmth', colors: ['#7C2D12', '#EA580C'] },
  { name: 'Rose Quartz', colors: ['#831843', '#DB2777'] },
  { name: 'Ocean Mist', colors: ['#134E4A', '#0D9488'] },
  { name: 'Midnight Blue', colors: ['#020617', '#1E40AF'] },
];

export const CoverPickerModal: React.FC<CoverPickerModalProps> = ({
  visible,
  onClose,
  onSelectCover,
  currentGradient,
  currentMediaId,
}) => {
  const { palette } = useTheme();
  const styles = useStyles();
  const [isUploading, setIsUploading] = useState(false);

  const handleSelectGradient = (colors: [string, string]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const gradientCss = `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
    onSelectCover({ coverGradient: gradientCss, coverMediaId: null });
    onClose();
  };

  const handlePickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploading(true);
        const asset = result.assets[0];
        const mimeType = asset.mimeType || 'image/jpeg';
        const res = await uploadMedia(asset.uri, mimeType);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSelectCover({ coverMediaId: res.mediaId });
        setIsUploading(false);
        onClose();
      }
    } catch (err) {
      console.warn('[CoverPicker] Photo upload error:', err);
      setIsUploading(false);
    }
  };

  const handleRemoveCover = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectCover({ coverGradient: '', coverMediaId: null });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            <View>
              <Text style={[styles.title, { color: palette.text }]}>Change Cover</Text>
              <Text style={[styles.sub, { color: palette.textSecondary }]}>
                Choose a gradient preset or upload a custom image
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Action Row */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: palette.surfaceAlt }]}
              onPress={handlePickPhoto}
              disabled={isUploading}
              accessibilityRole="button"
              accessibilityLabel="Upload image"
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={palette.primary} />
              ) : (
                <>
                  <ImageIcon size={18} color={palette.primary} />
                  <Text style={[styles.actionBtnText, { color: palette.text }]}>Upload Photo</Text>
                </>
              )}
            </TouchableOpacity>

            {(currentGradient || currentMediaId) && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: palette.error + '15' }]}
                onPress={handleRemoveCover}
                accessibilityRole="button"
                accessibilityLabel="Remove cover"
              >
                <Trash2 size={16} color={palette.errorText} />
                <Text style={[styles.actionBtnText, { color: palette.errorText }]}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Presets List */}
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>Gradients</Text>
            <View style={styles.presetsGrid}>
              {COVER_PRESETS.map((preset) => {
                const gradientStr = `linear-gradient(135deg, ${preset.colors[0]} 0%, ${preset.colors[1]} 100%)`;
                const isSelected = currentGradient === gradientStr;
                return (
                  <TouchableOpacity
                    key={preset.name}
                    style={[
                      styles.presetItem,
                      isSelected && { borderColor: palette.primary, borderWidth: 2 },
                    ]}
                    onPress={() => handleSelectGradient(preset.colors)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={preset.colors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.presetName}>{preset.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 10,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollArea: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginVertical: 10,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetItem: {
    width: '48%',
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 8,
  },
  presetName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
}));

