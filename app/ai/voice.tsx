/**
 * Lumen AI voice mode: talk and listen, hands-free. `id` is the conversation to continue, or
 * "new". Everything said here is saved in that chat, so it can be read afterwards.
 * Listening is on-device; replies are spoken with Gemini's natural voice (or the phone's voice).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, Easing } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mic, MicOff, MessageCircle, PhoneOff } from 'lucide-react-native';
import { ScreenTopBar } from '../../src/components/ios/ScreenTopBar';
import { AiSetupNotice } from '../../src/components/ai/AiSetupNotice';
import { useAiAccess, useSendAiMessage } from '../../src/hooks/useAiChat';
import { useVoiceConversation, type VoicePhase } from '../../src/hooks/useVoiceConversation';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';

const STATUS: Record<VoicePhase, string> = {
  idle: 'Tap to talk',
  listening: 'Listening…',
  thinking: 'Looking through your data…',
  speaking: 'Speaking · tap to interrupt',
};

const ORB_SIZE = 180;

export default function AiVoiceScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { palette } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const access = useAiAccess();
  const send = useSendAiMessage();
  const [conversationId, setConversationId] = useState<string | undefined>(id && id !== 'new' ? id : undefined);
  const convRef = useRef(conversationId);
  convRef.current = conversationId;

  const v = access.data?.voice;
  const voice = useVoiceConversation({
    lang: v?.sttLang ?? 'en-IN',
    voice: v?.ttsVoice ?? 'Kore',
    natural: v?.natural ?? true,
    send: async text => {
      const res = await send.mutateAsync({ conversationId: convRef.current, message: text, voice: true });
      if (res.conversation) setConversationId(res.conversation.id);
      return { ok: !!res.conversation, reply: res.reply };
    },
  });

  // Start listening as soon as Lumen AI is known to be on.
  const started = useRef(false);
  useEffect(() => {
    if (!started.current && access.data?.fullAccess) {
      started.current = true;
      voice.start().catch(() => undefined);
    }
  }, [access.data?.fullAccess, voice]);

  // The orb: follows the voice while listening, breathes while thinking or speaking.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (voice.phase !== 'thinking' && voice.phase !== 'speaking') { pulse.stopAnimation(); pulse.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: voice.phase === 'thinking' ? 700 : 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: voice.phase === 'thinking' ? 700 : 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [voice.phase, pulse]);
  const listenScale = 1 + (voice.phase === 'listening' ? voice.level * 0.25 : 0);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [listenScale, listenScale + (voice.phase === 'speaking' ? 0.06 : 0.1)] });

  const leave = () => {
    voice.end();
    if (conversationId) router.replace(`/ai/${conversationId}`);
    else if (router.canGoBack()) router.back();
    else router.replace('/ai');
  };

  if (access.data && !access.data.fullAccess) {
    return (
      <View style={styles.screen}>
        <ScreenTopBar title="Voice" fallbackRoute="/ai" />
        <AiSetupNotice configured={access.data.configured} />
      </View>
    );
  }

  const orbColor = voice.phase === 'listening' ? palette.primary : voice.phase === 'speaking' ? '#AF52DE' : voice.phase === 'thinking' ? '#5856D6' : palette.textSecondary;

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom + 16 }]}>
      <ScreenTopBar title="Voice" onBack={leave} fallbackRoute="/ai" />
      <Text style={styles.model} maxFontSizeMultiplier={1.2}>
        {access.data?.modelLabel ?? ''}{v ? ` · ${v.natural ? `${v.ttsVoice} voice` : 'phone voice'}` : ''}
      </Text>

      <View style={styles.stage}>
        <TouchableOpacity
          onPress={voice.tapOrb}
          disabled={voice.phase === 'thinking'}
          accessibilityRole="button"
          accessibilityLabel={STATUS[voice.phase]}
          activeOpacity={0.85}
        >
          <View style={styles.orbBox}>
            {/* Halo and core are siblings: a parent's opacity would also dim the core. */}
            <Animated.View style={[styles.orbHalo, { backgroundColor: orbColor, transform: [{ scale }] }]} />
            <View style={[styles.orbCore, { backgroundColor: orbColor }]} />
          </View>
        </TouchableOpacity>
        <Text style={styles.status} maxFontSizeMultiplier={1.3} accessibilityLiveRegion="polite">
          {voice.phase === 'idle' && voice.notice ? voice.notice : STATUS[voice.phase]}
        </Text>
      </View>

      <ScrollView style={styles.transcript} contentContainerStyle={styles.transcriptBody}>
        {voice.heard ? (
          <Text style={styles.heard} maxFontSizeMultiplier={1.3}>“{voice.heard}”</Text>
        ) : null}
        {voice.reply && voice.phase !== 'listening' ? (
          <Text style={styles.reply} maxFontSizeMultiplier={1.3}>{voice.reply.replace(/\*\*/g, '')}</Text>
        ) : null}
      </ScrollView>

      <View style={styles.controls}>
        <ControlButton
          label={voice.muted ? 'Mic paused after replies' : 'Keep listening after replies'}
          onPress={() => voice.setMuted(!voice.muted)}
          active={voice.muted}
        >
          {voice.muted ? <MicOff size={24} color={palette.text} /> : <Mic size={24} color={palette.text} />}
        </ControlButton>
        <ControlButton label="End voice chat" onPress={leave} danger>
          <PhoneOff size={26} color="#fff" />
        </ControlButton>
        <ControlButton
          label="Open the chat"
          onPress={() => { voice.end(); router.replace(conversationId ? `/ai/${conversationId}` : '/ai/new'); }}
        >
          <MessageCircle size={24} color={palette.text} />
        </ControlButton>
      </View>
    </View>
  );
}

function ControlButton({ children, label, onPress, danger, active }: {
  children: React.ReactNode; label: string; onPress: () => void; danger?: boolean; active?: boolean;
}) {
  const styles = useStyles();
  return (
    <TouchableOpacity
      style={[styles.control, danger && styles.controlDanger, active && styles.controlActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {children}
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  model: { ...typography.footnote, color: palette.textSecondary, textAlign: 'center', paddingHorizontal: 16 },
  stage: { alignItems: 'center', justifyContent: 'center', paddingTop: 36, paddingBottom: 20, gap: 24 },
  orbBox: { width: ORB_SIZE, height: ORB_SIZE, alignItems: 'center', justifyContent: 'center' },
  orbHalo: { position: 'absolute', width: ORB_SIZE, height: ORB_SIZE, borderRadius: ORB_SIZE / 2, opacity: 0.3 },
  orbCore: { width: ORB_SIZE * 0.62, height: ORB_SIZE * 0.62, borderRadius: ORB_SIZE * 0.31 },
  status: { ...typography.headline, color: palette.text, textAlign: 'center', paddingHorizontal: 24 },
  transcript: { flex: 1 },
  transcriptBody: { paddingHorizontal: 20, gap: 14, paddingBottom: 12 },
  heard: { ...typography.body, color: palette.textSecondary, fontStyle: 'italic', lineHeight: 22 },
  reply: { ...typography.body, color: palette.text, lineHeight: 23 },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28, paddingTop: 12 },
  control: { width: 60, height: 60, borderRadius: 30, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  controlActive: { backgroundColor: palette.border },
  controlDanger: { width: 72, height: 72, borderRadius: 36, backgroundColor: palette.error },
}));
