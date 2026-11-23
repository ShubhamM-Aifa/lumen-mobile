/**
 * GIF search for chat (GIPHY, through Lumen's server): trending when the box is empty, search as you type.
 * Tapping a GIF sends it. If the server has no GIF key, this says so and the gallery still works.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { api } from '../../api/client';

export interface GifChoice {
  id: string;
  previewUrl: string;
  url: string;
  width: number;
  height: number;
  description: string;
}

interface Page { results: GifChoice[]; next: string | null }

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (gif: GifChoice) => void;
  /** Send a GIF file saved on the phone (keeps it animated). */
  onPickFromGallery?: () => void;
}

export const GifPickerSheet: React.FC<Props> = ({ visible, onClose, onPick, onPickFromGallery }) => {
  const { palette } = useTheme();
  const { width, height } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GifChoice[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const col = (width - 12 * 2 - 6) / 2;

  const load = useCallback(async (q: string, pos?: string | null) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const path = q.trim() ? `/community/gifs/search?q=${encodeURIComponent(q.trim())}` : '/community/gifs/trending?';
      const page = await api.get<Page>(`${path}${pos ? `&pos=${encodeURIComponent(pos)}` : ''}`);
      if (id !== requestId.current) return; // an older request answered late
      setItems(prev => (pos ? [...prev, ...page.results.filter(r => !prev.some(p => p.id === r.id))] : page.results));
      setNext(page.next);
    } catch (err: any) {
      if (id !== requestId.current) return;
      setError(err?.message || 'GIF search is not available right now.');
      if (!pos) setItems([]);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => load(query), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [visible, query, load]);

  useEffect(() => { if (!visible) { setQuery(''); setItems([]); setNext(null); } }, [visible]);

  // Two columns of GIFs, each laid out at its own height (so the grid looks staggered).
  const left: GifChoice[] = [];
  const right: GifChoice[] = [];
  let lh = 0; let rh = 0;
  for (const g of items) {
    const h = g.width > 0 ? (g.height / g.width) * col : col;
    if (lh <= rh) { left.push(g); lh += h; } else { right.push(g); rh += h; }
  }

  const renderGif = (g: GifChoice) => {
    const h = Math.max(60, g.width > 0 ? (g.height / g.width) * col : col);
    return (
      <TouchableOpacity
        key={g.id}
        onPress={() => onPick(g)}
        activeOpacity={0.8}
        style={{ width: col, height: h, marginBottom: 6, borderRadius: 10, overflow: 'hidden', backgroundColor: palette.surfaceAlt }}
        accessibilityRole="button"
        accessibilityLabel={g.description ? `Send GIF: ${g.description}` : 'Send this GIF'}
      >
        <Image source={{ uri: g.previewUrl }} style={{ width: col, height: h }} contentFit="cover" autoplay recyclingKey={g.id} />
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close GIF picker" />
      <View style={[styles.sheet, { backgroundColor: palette.surface, height: Math.min(560, height * 0.75) }]}>
        <View style={styles.header}>
          <View style={[styles.search, { backgroundColor: palette.surfaceAlt }]}>
            <Search size={16} color={palette.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search GIFs"
              placeholderTextColor={palette.textDisabled}
              style={[styles.input, { color: palette.text }]}
              accessibilityLabel="Search GIFs"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
                <X size={16} color={palette.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.done} accessibilityRole="button" accessibilityLabel="Close GIF picker">
            <Text style={{ color: palette.primaryText, fontWeight: '700' }}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.subRow}>
          <Text style={[styles.sub, { color: palette.textSecondary, flex: 1 }]}>{query.trim() ? `Results for “${query.trim()}”` : 'Trending'} · Powered by GIPHY</Text>
          {onPickFromGallery ? (
            <TouchableOpacity onPress={onPickFromGallery} accessibilityRole="button" accessibilityLabel="Send a GIF from my gallery" hitSlop={8}>
              <Text style={{ color: palette.primaryText, fontWeight: '700', fontSize: 13 }}>From my gallery</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {error ? (
          <View style={styles.center}>
            <Text style={{ color: palette.textSecondary, textAlign: 'center' }}>{error}</Text>
            <TouchableOpacity onPress={() => load(query)} style={[styles.retry, { backgroundColor: palette.primary }]} accessibilityRole="button" accessibilityLabel="Try again">
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={[0]}
            keyExtractor={() => 'grid'}
            keyboardShouldPersistTaps="handled"
            onEndReachedThreshold={0.6}
            onEndReached={() => { if (next && !loading) load(query, next); }}
            renderItem={() => (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <View>{left.map(renderGif)}</View>
                <View>{right.map(renderGif)}</View>
              </View>
            )}
            ListEmptyComponent={null}
            ListFooterComponent={
              loading ? <ActivityIndicator style={{ margin: 16 }} color={palette.primaryText} />
                : items.length === 0 ? <Text style={[styles.empty, { color: palette.textSecondary }]}>No GIFs found. Try another word.</Text> : null
            }
          />
        )}
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
  subRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  sub: { fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  retry: { minHeight: 44, borderRadius: 22, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', padding: 24, fontSize: 14 },
});
