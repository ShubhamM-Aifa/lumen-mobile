import { toCodepoint, isAnimated, animatedUrl, emojiOnly, bigEmojiSize, withSkinTone, pushRecent } from '../emoji';

describe('emoji helpers', () => {
  it('turns an emoji into its codepoint name, without the variation selector', () => {
    expect(toCodepoint('😀')).toBe('1f600');
    expect(toCodepoint('❤️')).toBe('2764');
    expect(toCodepoint('👍🏽')).toBe('1f44d_1f3fd');
    expect(toCodepoint('👨‍👩‍👧')).toBe('1f468_200d_1f469_200d_1f467');
  });

  it('knows which emoji have an animation, and builds the link from the code only', () => {
    expect(isAnimated('😀')).toBe(true);
    expect(isAnimated('❤️')).toBe(true);
    expect(isAnimated('🥄')).toBe(false); // spoon has no animation: shown as a normal big emoji
    expect(animatedUrl('😀')).toBe('https://fonts.gstatic.com/s/e/notoemoji/latest/1f600/512.webp');
  });

  it('spots a message that is only 1 to 3 emoji', () => {
    expect(emojiOnly('😀')).toEqual(['😀']);
    expect(emojiOnly(' 😀 ❤️ ')).toEqual(['😀', '❤️']);
    expect(emojiOnly('😀😀😀')).toHaveLength(3);
    expect(emojiOnly('👨‍👩‍👧')).toHaveLength(1);
    expect(emojiOnly('👍🏽')).toHaveLength(1);
    expect(emojiOnly('🇮🇳')).toHaveLength(1);
    expect(emojiOnly('1️⃣')).toHaveLength(1);
  });

  it('does not treat words, numbers, or four-plus emoji as emoji-only', () => {
    expect(emojiOnly('😀😀😀😀')).toBeNull();
    expect(emojiOnly('hi 😀')).toBeNull();
    expect(emojiOnly('123')).toBeNull();
    expect(emojiOnly('#')).toBeNull();
    expect(emojiOnly('')).toBeNull();
    expect(emojiOnly(null)).toBeNull();
  });

  it('sizes big emoji by how many there are', () => {
    expect(bigEmojiSize(1)).toBeGreaterThan(bigEmojiSize(2));
    expect(bigEmojiSize(2)).toBeGreaterThan(bigEmojiSize(3));
  });

  it('applies a skin tone to the person, not the whole sequence', () => {
    expect(withSkinTone('👍', '\u{1F3FD}')).toBe('👍🏽');
    expect(withSkinTone('👍', '')).toBe('👍');
    expect(withSkinTone('👩‍⚕️', '\u{1F3FD}')).toBe('👩🏽‍⚕');
  });

  it('keeps recents newest first without repeats', () => {
    expect(pushRecent(['a', 'b'], 'b')).toEqual(['b', 'a']);
    expect(pushRecent(['a'], 'c', 2)).toEqual(['c', 'a']);
    expect(pushRecent(['a', 'b'], 'c', 2)).toEqual(['c', 'a']);
  });
});
