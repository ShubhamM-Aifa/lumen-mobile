/**
 * SoundPicker Component
 * Allows users to choose and preview alarm sounds for reminders.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Volume2, Play, Square, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, createThemedStyles } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import {
  SOUND_OPTIONS,
  previewSound,
  stopSound,
  SoundOption,
} from '../services/soundService';

interface Props {
  value: string; // sound ID
  onChange: (soundId: string) => void;
}

export function SoundPicker({ value, onChange }: Props): React.ReactElement {
  const { palette } = useTheme();
  const styles = useStyles();
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Stop audio when unmounting
  useEffect(() => {
    return () => {
      stopSound().catch(() => {});
    };
  }, []);

  const handleSelect = (soundId: string) => {
    Haptics.selectionAsync();
    onChange(soundId);
  };

  const handleTogglePreview = async (soundId: string) => {
    if (playingId === soundId) {
      await stopSound();
      setPlayingId(null);
      return;
    }

    setPlayingId(soundId);
    await previewSound(soundId, () => {
      setPlayingId((curr) => (curr === soundId ? null : curr));
    });
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Volume2 size={18} color={palette.primaryText} />
          </View>
          <View>
            <Text style={styles.title}>Alarm Sound</Text>
            <Text style={styles.subtitle}>Select the sound tone for this reminder</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Options List */}
      <View style={styles.optionsList}>
        {SOUND_OPTIONS.map((opt) => {
          const isSelected = value === opt.id || (!value && opt.id === 'default');
          const isPlaying = playingId === opt.id;

          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.optionRow, isSelected && styles.optionRowActive]}
              onPress={() => handleSelect(opt.id)}
              activeOpacity={0.8}
            >
              {/* Radio indicator */}
              <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                {isSelected && <View style={styles.radioDot} />}
              </View>

              {/* Sound Icon & Text */}
              <View style={styles.optionContent}>
                <View style={styles.labelRow}>
                  <Text style={styles.soundEmoji}>{opt.icon}</Text>
                  <Text style={[styles.soundLabel, isSelected && styles.soundLabelActive]}>
                    {opt.label}
                  </Text>
                  {isSelected && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>Selected</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.soundDesc}>{opt.description}</Text>
              </View>

              {/* Play / Preview Button */}
              {opt.id !== 'default' && (
                <TouchableOpacity
                  style={[styles.previewBtn, isPlaying && styles.previewBtnPlaying]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleTogglePreview(opt.id);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={isPlaying ? `Stop ${opt.label}` : `Preview ${opt.label}`}
                >
                  {isPlaying ? (
                    <Square size={13} color="#FFFFFF" fill="#FFFFFF" />
                  ) : (
                    <Play size={13} color={palette.primaryText} fill={palette.primary} style={{ marginLeft: 1 }} />
                  )}
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: palette.primary + '16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.bodyBold,
    color: palette.text,
    fontSize: 15,
  },
  subtitle: {
    ...typography.caption,
    color: palette.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
  },
  optionsList: {
    paddingVertical: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border + '44',
  },
  optionRowActive: {
    backgroundColor: palette.primary + '0A',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioCircleActive: {
    borderColor: palette.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.primary,
  },
  optionContent: {
    flex: 1,
    gap: 3,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  soundEmoji: {
    fontSize: 16,
  },
  soundLabel: {
    ...typography.bodyBold,
    color: palette.text,
    fontSize: 14,
  },
  soundLabelActive: {
    color: palette.primaryText,
  },
  activeBadge: {
    backgroundColor: palette.primary + '18',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadgeText: {
    ...typography.caption,
    color: palette.primaryText,
    fontWeight: '700',
    fontSize: 10,
  },
  soundDesc: {
    ...typography.caption,
    color: palette.textSecondary,
    fontSize: 12,
  },
  previewBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  previewBtnPlaying: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
}));
