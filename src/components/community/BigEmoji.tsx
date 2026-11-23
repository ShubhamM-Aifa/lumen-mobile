/**
 * A chat message that is only 1–3 emoji: shown big, and animated when Google has an animation for it
 * (loaded by emoji code and cached). Falls back to the normal emoji while loading, offline, or when
 * "Animated emoji" is off.
 */
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { animatedUrl, bigEmojiSize, isAnimated } from '../../utils/emoji/emoji';
import { useEmojiPrefs } from '../../store/emojiPrefsStore';

const One: React.FC<{ emoji: string; size: number; animate: boolean }> = ({ emoji, size, animate }) => {
  const [failed, setFailed] = useState(false);
  if (animate && !failed && isAnimated(emoji)) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/* The normal emoji sits underneath until the animation has loaded. */}
        <Text style={{ position: 'absolute', fontSize: size * 0.8 }} accessibilityElementsHidden importantForAccessibility="no">{emoji}</Text>
        <Image
          source={{ uri: animatedUrl(emoji) }}
          style={{ width: size, height: size }}
          contentFit="contain"
          autoplay
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
          accessibilityLabel={emoji}
        />
      </View>
    );
  }
  return <Text style={{ fontSize: size * 0.8, lineHeight: size }} accessibilityLabel={emoji}>{emoji}</Text>;
};

export const BigEmoji: React.FC<{ emojis: string[] }> = ({ emojis }) => {
  const animated = useEmojiPrefs(s => s.animated);
  const load = useEmojiPrefs(s => s.load);
  useEffect(() => { load(); }, [load]);
  const size = bigEmojiSize(emojis.length);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }} accessible accessibilityLabel={emojis.join(' ')}>
      {emojis.map((e, i) => <One key={`${e}-${i}`} emoji={e} size={size} animate={animated} />)}
    </View>
  );
};
