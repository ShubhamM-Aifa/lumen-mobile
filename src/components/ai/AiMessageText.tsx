/**
 * Renders Lumen AI's replies: paragraphs, "- " bullet lines and **bold**. Gemini is asked for
 * exactly this subset (no tables), so a full markdown renderer is not needed.
 */
import React from 'react';
import { Text, View, type TextStyle } from 'react-native';

interface Props {
  text: string;
  style: TextStyle;
  boldStyle?: TextStyle;
}

function inline(line: string, boldStyle: TextStyle | undefined, keyPrefix: string): React.ReactNode[] {
  return line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <Text key={`${keyPrefix}-${i}`} style={[{ fontWeight: '700' }, boldStyle]}>{part.slice(2, -2)}</Text>
      : part.replace(/^#{1,6}\s*/, ''));
}

export function AiMessageText({ text, style, boldStyle }: Props) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <View style={{ gap: 8 }}>
      {blocks.map((block, b) => {
        const lines = block.split('\n');
        return (
          <View key={b} style={{ gap: 3 }}>
            {lines.map((line, l) => {
              const bullet = /^\s*[-*•]\s+/.test(line);
              const content = line.replace(/^\s*[-*•]\s+/, '');
              return bullet ? (
                <View key={l} style={{ flexDirection: 'row', gap: 6, paddingRight: 4 }}>
                  <Text style={style}>•</Text>
                  <Text style={[style, { flex: 1 }]}>{inline(content, boldStyle, `${b}-${l}`)}</Text>
                </View>
              ) : (
                <Text key={l} style={style}>{inline(line, boldStyle, `${b}-${l}`)}</Text>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
