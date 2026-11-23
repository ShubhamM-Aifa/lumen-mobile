/**
 * Photos (and GIFs) in a chat message: one photo at its own shape, or a grid of up to 4 tiles with "+N".
 * Tapping a tile opens the full-screen viewer at that photo.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ImageViewerModal } from '../media/ImageViewerModal';
import { GridPhoto, gridRows, singleSize } from '../../utils/community/photoGrid';

interface Props {
  photos: GridPhoto[];
  caption?: string;
  /** Text colour for the caption. */
  captionColor?: string;
}

const WIDTH = 260;
const GAP = 3;

export const PhotoGrid: React.FC<Props> = ({ photos, caption, captionColor }) => {
  const [open, setOpen] = useState<number | null>(null);
  if (photos.length === 0) return null;
  const { rows, hidden } = gridRows(photos.length);
  const single = photos.length === 1 ? singleSize(photos[0].width, photos[0].height, WIDTH) : null;
  const what = (p: GridPhoto) => (p.isGif ? 'GIF' : 'photo');

  const tile = (i: number, w: number, h: number, isLast: boolean) => {
    const p = photos[i];
    return (
      <TouchableOpacity
        key={i}
        activeOpacity={0.85}
        onPress={() => setOpen(i)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${what(p)} ${i + 1} of ${photos.length}${caption ? `: ${caption}` : ''}`}
        style={{ width: w, height: h, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(127,127,127,0.15)' }}
      >
        <Image source={{ uri: p.photoUrl }} style={{ width: w, height: h }} contentFit="cover" autoplay transition={120} recyclingKey={p.photoUrl} />
        {p.isGif ? <View style={styles.gifBadge}><Text style={styles.gifText}>GIF</Text></View> : null}
        {isLast && hidden > 0 ? (
          <View style={styles.more} accessibilityElementsHidden>
            <Text style={styles.moreText}>+{hidden}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ marginTop: 4, gap: 4 }}>
      {single ? tile(0, single.width, single.height, false) : (
        <View style={{ gap: GAP, width: WIDTH }}>
          {rows.map((row, r) => {
            const w = (WIDTH - GAP * (row.length - 1)) / row.length;
            const h = row.length === 1 ? 170 : 128;
            return (
              <View key={r} style={{ flexDirection: 'row', gap: GAP }}>
                {row.map((i) => tile(i, w, h, r === rows.length - 1 && i === row[row.length - 1]))}
              </View>
            );
          })}
        </View>
      )}
      {caption ? <Text style={{ color: captionColor, fontSize: 15, lineHeight: 20, maxWidth: WIDTH }}>{caption}</Text> : null}
      <ImageViewerModal
        visible={open !== null}
        images={photos.map((p, i) => ({ uri: p.photoUrl || '', isGif: p.isGif, label: `${what(p)} ${i + 1} of ${photos.length}` }))}
        startIndex={open ?? 0}
        onClose={() => setOpen(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  more: { ...StyleSheet.absoluteFill as object, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  moreText: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  gifBadge: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  gifText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
