import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Play, Pause } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTheme } from '../../theme/ThemeContext';
import { nextRate } from '../../utils/community/voiceNote';

/** Only one voice note plays at a time: starting one pauses the one before. */
let nowPlaying: { pause: () => void } | null = null;

interface VoiceNotePlayerProps {
  audioUrl: string;
  durationSeconds?: number;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  audioUrl,
  durationSeconds = 0,
}) => {
  const { palette } = useTheme();
  const player = useAudioPlayer(audioUrl);
  const status = useAudioPlayerStatus(player);
  const [rate, setRate] = useState(1);
  const selfRef = useRef({ pause: () => { try { player.pause(); } catch { /* released */ } } });
  useEffect(() => () => { if (nowPlaying === selfRef.current) nowPlaying = null; }, []);

  const changeRate = () => {
    const r = nextRate(rate);
    setRate(r);
    try { player.setPlaybackRate(r); } catch { /* not supported on this platform */ }
  };

  const isPlaying = Boolean(status.playing);
  const currentTime = status.currentTime || 0;
  const totalDuration = durationSeconds || status.duration || 0;

  const togglePlayback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlaying) {
      player.pause();
    } else {
      if (currentTime >= totalDuration && totalDuration > 0) {
        player.seekTo(0);
      }
      if (nowPlaying && nowPlaying !== selfRef.current) nowPlaying.pause();
      nowPlaying = selfRef.current;
      try { player.setPlaybackRate(rate); } catch { /* ignore */ }
      player.play();
    }
  };

  const progressFraction = totalDuration > 0 ? Math.min(1, currentTime / totalDuration) : 0;

  // Format seconds to mm:ss
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Generate 20 static pseudo-waveform bars
  const waveformHeights = [
    6, 12, 18, 10, 22, 16, 26, 14, 20, 8,
    18, 24, 12, 16, 22, 10, 14, 20, 8, 14,
  ];

  return (
    <View style={[styles.container, { backgroundColor: `${palette.primary}15`, borderColor: `${palette.primary}30` }]}>
      <TouchableOpacity
        onPress={togglePlayback}
        style={[styles.playBtn, { backgroundColor: palette.primary }]}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause voice note' : 'Play voice note'}
      >
        {isPlaying ? (
          <Pause size={16} color="#FFFFFF" />
        ) : (
          <Play size={16} color="#FFFFFF" style={{ marginLeft: 2 }} />
        )}
      </TouchableOpacity>

      <View style={styles.body}>
        {/* Waveform Visualization */}
        <View style={styles.waveformRow}>
          {waveformHeights.map((h, index) => {
            const barFraction = index / waveformHeights.length;
            const isPlayed = barFraction <= progressFraction;
            return (
              <View
                key={`bar-${index}`}
                style={[
                  styles.waveformBar,
                  {
                    height: h,
                    backgroundColor: isPlayed
                      ? palette.primaryText || palette.primary
                      : `${palette.textDisabled}60`,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Time info */}
        <View style={styles.timeRow}>
          <Text style={[styles.timeText, { color: palette.textSecondary }]}>
            {isPlaying ? formatTime(currentTime) : formatTime(totalDuration)}
          </Text>
          <TouchableOpacity
            onPress={changeRate}
            style={[styles.rateChip, { backgroundColor: `${palette.primary}25` }]}
            accessibilityRole="button"
            accessibilityLabel={`Playback speed ${rate} times. Tap to change`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.rateText, { color: palette.primaryText || palette.primary }]}>{rate}×</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 4,
    maxWidth: 280,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  body: {
    flex: 1,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 28,
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  rateChip: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 8 },
  rateText: { fontSize: 11, fontWeight: '800' },
  voiceTag: {
    fontSize: 10,
  },
});

