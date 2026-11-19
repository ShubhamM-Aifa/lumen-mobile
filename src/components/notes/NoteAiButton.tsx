/**
 * The ✨ button on a note: Lumen AI summarises it, pulls out a checklist, continues writing, or
 * makes a Hinglish / English copy (as a sub-page). The server applies the change; before that the
 * note's pending edits are sent, and afterwards the app takes the server's copy, so nothing typed
 * is lost. Hidden unless Lumen AI full access is on.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, Alert, Pressable } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useAiAccess, useNoteAiAction, type NoteAiAction, type NoteActionResult } from '../../hooks/useAiChat';
import { flushNotesOutbox, getNotesPendingCount } from '../../services/notes/outbox';
import { useAskLumenAi } from '../../hooks/useAskLumenAi';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

export const NOTE_AI_ACTIONS: { action: NoteAiAction; label: string; sub: string }[] = [
  { action: 'summarize', label: 'Summarise', sub: 'Adds a short summary at the end' },
  { action: 'checklist', label: 'Make a checklist', sub: 'Pulls the to-dos out as tick boxes' },
  { action: 'continue', label: 'Continue writing', sub: 'Adds the next section in your style' },
  { action: 'hinglish', label: 'Hinglish copy', sub: 'A copy in Hinglish, as a sub-page' },
  { action: 'english', label: 'English copy', sub: 'A copy in simple English, as a sub-page' },
];

/** The editor sends changes 600 ms after typing stops; give it time before the note is sent. */
const EDITOR_SETTLE_MS = 800;

export function NoteAiButton({ noteId, noteTitle, onResult, iconColor }: {
  noteId: string;
  /** Chip title when the note is attached to a chat ("Ask Lumen AI in chat"). */
  noteTitle?: string;
  /** Called with the server's result: the updated note, or the id of a new copy. */
  onResult: (res: NoteActionResult) => void;
  iconColor?: string;
}) {
  const { palette } = useTheme();
  const styles = useStyles();
  const access = useAiAccess();
  const action = useNoteAiAction();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState<NoteAiAction | null>(null);
  const { ask } = useAskLumenAi();

  if (!access.data?.fullAccess) return null;

  /** A new chat with this note attached; its latest edits are sent first so the AI reads them. */
  const askInChat = async () => {
    setOpen(false);
    await new Promise(r => setTimeout(r, EDITOR_SETTLE_MS));
    await flushNotesOutbox().catch(() => {});
    ask({ kind: 'note', id: noteId, title: noteTitle?.trim() || 'Note' });
  };

  const run = async (a: NoteAiAction) => {
    setRunning(a);
    try {
      await new Promise(r => setTimeout(r, EDITOR_SETTLE_MS));
      await flushNotesOutbox().catch(() => {});
      if (getNotesPendingCount() > 0) {
        Alert.alert('Still saving', 'Your latest changes haven’t reached the server yet. Please try again when you’re online.');
        return;
      }
      const res = await action.mutateAsync({ noteId, action: a });
      if (res.error || !res.noteId) {
        Alert.alert('Lumen AI couldn’t do that', res.error === 'empty' ? 'The note is empty.' : 'Please try again in a moment.');
        return;
      }
      setOpen(false);
      onResult(res);
    } catch (err) {
      Alert.alert('Lumen AI couldn’t do that', err instanceof Error ? err.message : '');
    } finally {
      setRunning(null);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Lumen AI actions for this note"
      >
        <Sparkles size={20} color={iconColor ?? '#AF52DE'} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => !running && setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => !running && setOpen(false)} accessibilityLabel="Close">
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.title} maxFontSizeMultiplier={1.3}>Lumen AI</Text>
            <TouchableOpacity
              style={[styles.row, running && styles.off]}
              onPress={() => { askInChat().catch(() => {}); }}
              disabled={!!running}
              accessibilityRole="button"
              accessibilityLabel="Ask Lumen AI in chat"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.label} maxFontSizeMultiplier={1.3}>Ask Lumen AI in chat</Text>
                <Text style={styles.sub} maxFontSizeMultiplier={1.2}>Opens a chat with this note attached</Text>
              </View>
            </TouchableOpacity>
            {NOTE_AI_ACTIONS.map(a => (
              <TouchableOpacity
                key={a.action}
                style={[styles.row, running && running !== a.action && styles.off]}
                onPress={() => run(a.action)}
                disabled={!!running}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.label} maxFontSizeMultiplier={1.3}>{a.label}</Text>
                  <Text style={styles.sub} maxFontSizeMultiplier={1.2}>{a.sub}</Text>
                </View>
                {running === a.action ? <ActivityIndicator color={palette.primaryText} /> : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancel} onPress={() => setOpen(false)} disabled={!!running} accessibilityRole="button">
              <Text style={styles.cancelText}>{running ? 'Working…' : 'Cancel'}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const useStyles = createThemedStyles(palette => ({
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: '#0006', justifyContent: 'flex-end' },
  sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 32, gap: 4 },
  title: { ...typography.headline, color: palette.text, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: palette.border },
  off: { opacity: 0.4 },
  label: { ...typography.body, color: palette.text },
  sub: { ...typography.footnote, color: palette.textSecondary },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  cancelText: { ...typography.bodyBold, color: palette.primaryText },
}));
