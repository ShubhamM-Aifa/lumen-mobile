import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { Mic, Trash2, Send } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { useTheme } from '../../theme/ThemeContext';
import { uploadMedia } from '../../services/mediaUpload';
import { voiceNoteMimeType } from '../../utils/community/voiceNote';

/** Puts the phone back into normal playback mode after recording (otherwise audio can stay on the earpiece). */
async function endRecordingMode() {
  try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch { /* not fatal */ }
}

interface VoiceNoteRecorderProps {
  onSend: (audioUrl: string, durationSeconds: number, audioMediaId?: string) => void;
  onCancel: () => void;
}

export const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({
  onSend,
  onCancel,
}) => {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [seconds, setSeconds] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    let mounted = true;

    async function start() {
      try {
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) {
          Alert.alert('Microphone Permission', 'Please allow microphone access to record voice notes.');
          onCancel();
          return;
        }

        if (!mounted) return;
        // Recording needs the audio session switched to record mode and the recorder prepared first.
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        if (mounted) {
          recorder.record();
          startedRef.current = true;
          timerRef.current = setInterval(() => {
            setSeconds((s) => s + 1);
          }, 1000);
        }
      } catch (err) {
        console.error('Failed to start recording:', err);
        Alert.alert('Could not start recording', 'Another app may be using the microphone. Please try again.');
        endRecordingMode();
        onCancel();
      }
    }

    start();

    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      // Leaving the screen mid-recording: stop the microphone.
      if (startedRef.current && !finishedRef.current) {
        try { recorder.stop().catch(() => {}); } catch { /* already released */ }
        endRecordingMode();
      }
    };
  }, []);

  const handleCancel = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (timerRef.current) clearInterval(timerRef.current);
    finishedRef.current = true;
    try {
      if (startedRef.current) await recorder.stop();
    } catch {}
    await endRecordingMode();
    onCancel();
  };

  const handleFinish = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (timerRef.current) clearInterval(timerRef.current);

    finishedRef.current = true;
    try {
      setIsUploading(true);
      let measuredMs = 0;
      try { measuredMs = recorder.getStatus().durationMillis || 0; } catch { /* use the timer */ }
      await recorder.stop();
      await endRecordingMode();

      const uri = recorder.uri;
      const durationSec = measuredMs > 0 ? measuredMs / 1000 : seconds;
      if (!uri || durationSec < 1) {
        Alert.alert('Too short', 'Hold on a little longer: voice notes need at least 1 second.');
        onCancel();
        return;
      }

      const duration = Math.max(1, Math.round(durationSec));
      const res = await uploadMedia(uri, Platform.OS === 'web' ? 'audio/webm' : voiceNoteMimeType(uri)); // browsers record WebM
      onSend(res.url, duration, res.mediaId);
    } catch (err: any) {
      console.error('Error uploading voice note:', err);
      // Fallback: if server media upload fails in dev or offline, use local uri
      // A phone-local file path would be unplayable for everyone else, so do not send it.
      Alert.alert('Upload Failed', 'Could not upload voice note. Please try again.');
      onCancel();
    } finally {
      setIsUploading(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const bottomPadding = Platform.OS === 'android'
    ? Math.max(insets.bottom, 24)
    : Math.max(insets.bottom, 12);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          paddingBottom: bottomPadding,
        },
      ]}
    >
      <TouchableOpacity
        onPress={handleCancel}
        style={[styles.cancelBtn, { backgroundColor: `${palette.error || '#EF4444'}20` }]}
        accessibilityRole="button"
        accessibilityLabel="Cancel recording"
      >
        <Trash2 size={18} color={palette.error || '#EF4444'} />
      </TouchableOpacity>

      <View style={styles.centerBox}>
        <View style={styles.pulsingDot} />
        <Text style={[styles.timerText, { color: palette.text }]}>
          {formatTimer(seconds)}
        </Text>
        <Text style={[styles.hintText, { color: palette.textSecondary }]}>
          Recording voice note...
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleFinish}
        disabled={isUploading}
        style={[styles.sendBtn, { backgroundColor: palette.primary }]}
        accessibilityRole="button"
        accessibilityLabel="Send voice note"
      >
        {isUploading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Send size={16} color="#FFFFFF" />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  timerText: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  hintText: {
    fontSize: 12,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
