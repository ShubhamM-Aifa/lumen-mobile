/**
 * Message info (long-press your message): who has seen it, who has it delivered, who is still waiting.
 */
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { MessageInfo } from '../../utils/community/receipts';

interface Props {
  visible: boolean;
  info: MessageInfo | null;
  viewerReadOn: boolean;
  onClose: () => void;
}

const when = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return '';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const MessageInfoSheet: React.FC<Props> = ({ visible, info, viewerReadOn, onClose }) => {
  const { palette } = useTheme();
  const Section = ({ title, rows }: { title: string; rows: Array<{ userId: string; name: string; at?: string | null }> }) =>
    rows.length === 0 ? null : (
      <View style={{ marginTop: 14 }}>
        <Text style={[styles.heading, { color: palette.textSecondary }]} accessibilityRole="header">{title}</Text>
        {rows.map((r) => (
          <View key={r.userId} style={styles.row}>
            <Text style={[styles.name, { color: palette.text }]}>{r.name}</Text>
            <Text style={{ color: palette.textSecondary, fontSize: 12 }}>{when(r.at)}</Text>
          </View>
        ))}
      </View>
    );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close message info" />
      <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
        <View style={styles.top}>
          <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">Message info</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"><Text style={{ color: palette.primaryText, fontWeight: '700' }}>Done</Text></TouchableOpacity>
        </View>
        <ScrollView>
          {info ? (
            <>
              <Section title="Seen by" rows={info.seenBy} />
              <Section title="Delivered to" rows={info.deliveredTo} />
              {info.waiting.length ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={[styles.heading, { color: palette.textSecondary }]}>Not delivered yet</Text>
                  {info.waiting.map((r) => <Text key={r.userId} style={[styles.name, { color: palette.text, paddingVertical: 8 }]}>{r.name}</Text>)}
                </View>
              ) : null}
              {!viewerReadOn ? (
                <Text style={{ color: palette.textSecondary, fontSize: 12, marginTop: 16 }}>
                  You turned seen ticks off, so you can’t see who has read your messages (and they can’t see when you read theirs).
                </Text>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, maxHeight: '60%' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '800' },
  heading: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  name: { fontSize: 15, fontWeight: '600' },
});
