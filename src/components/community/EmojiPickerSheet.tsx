/**
 * Emoji picker for chat: categories, search, recently used, and a skin-tone choice.
 * Tapping inserts the emoji (the sheet stays open for more); in "react" mode it picks one and closes.
 * A message that is only 1–3 emoji is shown big and animated in the chat itself.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Search, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeContext';
import { pushRecent, withSkinTone, SKIN_TONES } from '../../utils/emoji/emoji';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const GROUPS: Array<{ name: string; slug: string; emojis: Array<{ emoji: string; name: string; slug: string; skin_tone_support: boolean }> }> = require('unicode-emoji-json/data-by-group.json');

const RECENT_KEY = 'lumen:emoji:recent_v1';
const TONE_KEY = 'lumen:emoji:tone_v1';
const COLUMNS = 8;

const TAB_ICONS: Record<string, string> = {
  smileys_emotion: '😀', people_body: '👋', animals_nature: '🐻', food_drink: '🍎', travel_places: '🚗',
  activities: '⚽', objects: '💡', symbols: '❤️', flags: '🏳️',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  /** 'react' picks one emoji and closes; 'insert' keeps the sheet open. */
  mode?: 'insert' | 'react';
}

export const EmojiPickerSheet: React.FC<Props> = ({ visible, onClose, onPick, mode = 'insert' }) => {
  const { palette } = useTheme();
  const { width, height } = useWindowDimensions();
  const [tab, setTab] = useState<string>('recent');
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [tone, setTone] = useState('');
  const cell = Math.floor((width - 24) / COLUMNS);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    AsyncStorage.getItem(RECENT_KEY).then(v => { try { if (v) setRecent(JSON.parse(v)); } catch { /* ignore */ } }).catch(() => {});
    AsyncStorage.getItem(TONE_KEY).then(v => { if (v !== null) setTone(v); }).catch(() => {});
  }, [visible]);

  const all = useMemo(() => GROUPS.flatMap(g => g.emojis), []);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return all.filter(e => e.name.includes(q) || e.slug.includes(q.replace(/\s+/g, '_'))).slice(0, 120).map(e => ({ emoji: e.emoji, name: e.name, tone: e.skin_tone_support }));
    if (tab === 'recent') return recent.map(e => ({ emoji: e, name: '', tone: false }));
    const g = GROUPS.find(x => x.slug === tab) ?? GROUPS[0];
    return g.emojis.map(e => ({ emoji: e.emoji, name: e.name, tone: e.skin_tone_support }));
  }, [query, tab, recent, all]);

  const choose = useCallback((emoji: string, supportsTone: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    const final = supportsTone ? withSkinTone(emoji, tone) : emoji;
    const next = pushRecent(recent, final);
    setRecent(next);
    AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
    onPick(final);
    if (mode === 'react') onClose();
  }, [recent, tone, onPick, onClose, mode]);

  const chooseTone = (t: string) => {
    setTone(t);
    AsyncStorage.setItem(TONE_KEY, t).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close emoji picker" />
      <View style={[styles.sheet, { backgroundColor: palette.surface, height: Math.min(440, height * 0.6) }]}>
        <View style={styles.header}>
          <View style={[styles.search, { backgroundColor: palette.surfaceAlt }]}>
            <Search size={16} color={palette.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search emoji"
              placeholderTextColor={palette.textDisabled}
              style={[styles.input, { color: palette.text }]}
              accessibilityLabel="Search emoji"
              autoCorrect={false}
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
                <X size={16} color={palette.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.done} accessibilityRole="button" accessibilityLabel="Close emoji picker">
            <Text style={{ color: palette.primaryText, fontWeight: '700' }}>Done</Text>
          </TouchableOpacity>
        </View>

        {!query ? (
          <View style={styles.tabs}>
            {[{ slug: 'recent', icon: '🕘', label: 'Recent' }, ...GROUPS.map(g => ({ slug: g.slug, icon: TAB_ICONS[g.slug] ?? '🙂', label: g.name }))].map(t => (
              <TouchableOpacity
                key={t.slug}
                onPress={() => setTab(t.slug)}
                style={[styles.tab, tab === t.slug && { backgroundColor: `${palette.primary}25` }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t.slug }}
                accessibilityLabel={t.label}
              >
                <Text style={{ fontSize: 20 }}>{t.icon}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={styles.tones} accessibilityRole="radiogroup">
          <Text style={[styles.toneLabel, { color: palette.textSecondary }]}>Skin tone</Text>
          {SKIN_TONES.map((t, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => chooseTone(t)}
              style={[styles.toneBtn, tone === t && { borderColor: palette.primary, borderWidth: 2 }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: tone === t }}
              accessibilityLabel={i === 0 ? 'Default skin tone' : `Skin tone ${i}`}
            >
              <Text style={{ fontSize: 16 }}>{withSkinTone('👍', t)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={items}
          keyExtractor={(it, i) => `${it.emoji}-${i}`}
          numColumns={COLUMNS}
          key={`cols-${COLUMNS}-${tab}-${query ? 's' : 'n'}`}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={64}
          windowSize={7}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: palette.textSecondary }]}>
              {query ? 'No emoji found.' : 'Emoji you use will show up here.'}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => choose(item.emoji, item.tone)}
              style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center' }}
              accessibilityRole="button"
              accessibilityLabel={item.name || item.emoji}
            >
              <Text style={{ fontSize: Math.floor(cell * 0.62) }}>{item.tone ? withSkinTone(item.emoji, tone) : item.emoji}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 12, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 40, borderRadius: 20 },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  done: { minHeight: 40, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  tab: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tones: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 6 },
  toneLabel: { fontSize: 12, marginRight: 4 },
  toneBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', padding: 24, fontSize: 14 },
});
