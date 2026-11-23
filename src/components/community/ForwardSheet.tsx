/**
 * Forward a message to up to 5 of your direct chats or groups. Photos, GIFs and voice notes are shared
 * as they are; the copy says "Forwarded".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Check, Users } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useCommunityStore } from '../../store/communityStore';
import type { ICommunityChannel } from '../../shared/types';

export const MAX_FORWARD_TARGETS = 5;

/** Chats you can forward to: accepted one-to-one chats and groups. */
export function forwardTargets(dms: ICommunityChannel[], excludeId?: string): ICommunityChannel[] {
  return dms.filter((c) => c.type === 'dm' && c._id !== excludeId && (!c.dmStatus || c.dmStatus === 'accepted'));
}

interface Props {
  visible: boolean;
  messageId: string | null;
  /** The chat the message is in (offered last, since forwarding there is rarely useful). */
  fromChannelId?: string;
  onClose: () => void;
  onDone: () => void;
}

export const ForwardSheet: React.FC<Props> = ({ visible, messageId, fromChannelId, onClose, onDone }) => {
  const { palette } = useTheme();
  const { dmChannels, forwardMessage } = useCommunityStore();
  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const targets = useMemo(() => forwardTargets(dmChannels, fromChannelId), [dmChannels, fromChannelId]);

  useEffect(() => { if (visible) setPicked([]); }, [visible]);

  const toggle = (id: string) => setPicked((prev) => {
    if (prev.includes(id)) return prev.filter((x) => x !== id);
    if (prev.length >= MAX_FORWARD_TARGETS) { Alert.alert('Forward', `You can forward to up to ${MAX_FORWARD_TARGETS} chats at once.`); return prev; }
    return [...prev, id];
  });

  const send = async () => {
    if (!messageId || picked.length === 0 || sending) return;
    setSending(true);
    try {
      const results = await forwardMessage(messageId, picked);
      const failed = results.filter((r) => !r.ok);
      if (failed.length) Alert.alert('Some chats did not get it', failed.map((f) => f.message || 'Could not send').join('\n'));
      onDone();
    } catch (err: any) {
      Alert.alert('Not forwarded', err?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close forward" />
      <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
        <View style={styles.top}>
          <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">Forward to…</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel"><Text style={{ color: palette.textSecondary, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
        </View>
        <FlatList
          data={targets}
          keyExtractor={(c) => c._id}
          ListEmptyComponent={<Text style={{ color: palette.textSecondary, padding: 20, textAlign: 'center' }}>You have no chats to forward to yet.</Text>}
          renderItem={({ item }) => {
            const on = picked.includes(item._id);
            return (
              <TouchableOpacity
                onPress={() => toggle(item._id)}
                style={styles.row}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={item.isGroup ? `Group ${item.name}` : item.dmUser?.displayName || item.name}
              >
                <View style={[styles.dot, { backgroundColor: palette.surfaceAlt }]}>
                  {item.isGroup ? <Users size={16} color={palette.textSecondary} /> : <Text style={{ fontSize: 14 }}>🌟</Text>}
                </View>
                <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>{item.isGroup ? item.name : item.dmUser?.displayName || item.name}</Text>
                <View style={[styles.check, { borderColor: on ? palette.primary : palette.border, backgroundColor: on ? palette.primary : 'transparent' }]}>
                  {on ? <Check size={14} color="#FFFFFF" /> : null}
                </View>
              </TouchableOpacity>
            );
          }}
        />
        <TouchableOpacity
          onPress={send}
          disabled={picked.length === 0 || sending}
          style={[styles.send, { backgroundColor: picked.length ? palette.primary : palette.surfaceAlt }]}
          accessibilityRole="button"
          accessibilityLabel={`Forward to ${picked.length} chat${picked.length === 1 ? '' : 's'}`}
        >
          {sending ? <ActivityIndicator color="#FFFFFF" /> : (
            <Text style={{ color: picked.length ? '#FFFFFF' : palette.textDisabled, fontWeight: '800', fontSize: 16 }}>
              {picked.length ? `Forward (${picked.length})` : 'Pick a chat'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, maxHeight: '70%' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  send: { minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
});
