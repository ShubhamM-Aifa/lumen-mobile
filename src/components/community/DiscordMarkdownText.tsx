import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';

interface DiscordMarkdownTextProps {
  content: string;
  isEdited?: boolean;
  editedAt?: string;
  onPressMention?: (username: string) => void;
  style?: any;
}

interface InlineToken {
  type: 'text' | 'bold' | 'italic' | 'strike' | 'underline' | 'code' | 'spoiler' | 'mention';
  value: string;
}

export const DiscordMarkdownText: React.FC<DiscordMarkdownTextProps> = ({
  content,
  isEdited,
  onPressMention,
  style,
}) => {
  const { palette } = useTheme();

  // Parse lines to handle quotes and code blocks
  const lines = content.split('\n');

  return (
    <View style={styles.container}>
      {lines.map((line, lineIndex) => {
        const isQuote = line.trim().startsWith('>');
        const cleanLine = isQuote ? line.replace(/^\s*>\s*/, '') : line;

        const renderedLine = (
          <ParsedInlineLine
            key={`line-${lineIndex}`}
            text={cleanLine}
            palette={palette}
            onPressMention={onPressMention}
            isLastLine={lineIndex === lines.length - 1}
            isEdited={isEdited}
            baseStyle={style}
          />
        );

        if (isQuote) {
          return (
            <View key={`quote-${lineIndex}`} style={[styles.quoteContainer, { borderLeftColor: palette.primary }]}>
              {renderedLine}
            </View>
          );
        }

        return renderedLine;
      })}
    </View>
  );
};

interface ParsedInlineLineProps {
  text: string;
  palette: any;
  onPressMention?: (username: string) => void;
  isLastLine: boolean;
  isEdited?: boolean;
  baseStyle?: any;
}

const ParsedInlineLine: React.FC<ParsedInlineLineProps> = ({
  text,
  palette,
  onPressMention,
  isLastLine,
  isEdited,
  baseStyle,
}) => {
  const tokens = parseMarkdownTokens(text);

  return (
    <Text style={[styles.baseText, { color: palette.text }, baseStyle]}>
      {tokens.map((token, idx) => {
        if (token.type === 'spoiler') {
          return <SpoilerPill key={`token-${idx}`} text={token.value} palette={palette} />;
        }

        if (token.type === 'mention') {
          return (
            <Text
              key={`token-${idx}`}
              onPress={() => onPressMention?.(token.value.replace(/^@/, ''))}
              style={[
                styles.mentionPill,
                {
                  color: palette.primaryText || palette.primary,
                  backgroundColor: `${palette.primary}25`,
                },
              ]}
            >
              {token.value}
            </Text>
          );
        }

        if (token.type === 'code') {
          return (
            <Text
              key={`token-${idx}`}
              style={[
                styles.codeInline,
                {
                  color: palette.primaryText || '#38BDF8',
                  backgroundColor: palette.surface,
                },
              ]}
            >
              {token.value}
            </Text>
          );
        }

        if (token.type === 'bold') {
          return (
            <Text key={`token-${idx}`} style={styles.boldText}>
              {token.value}
            </Text>
          );
        }

        if (token.type === 'italic') {
          return (
            <Text key={`token-${idx}`} style={styles.italicText}>
              {token.value}
            </Text>
          );
        }

        if (token.type === 'strike') {
          return (
            <Text key={`token-${idx}`} style={styles.strikeText}>
              {token.value}
            </Text>
          );
        }

        if (token.type === 'underline') {
          return (
            <Text key={`token-${idx}`} style={styles.underlineText}>
              {token.value}
            </Text>
          );
        }

        return (
          <Text key={`token-${idx}`}>
            {token.value}
          </Text>
        );
      })}

      {isLastLine && isEdited && (
        <Text style={[styles.editedIndicator, { color: palette.textDisabled }]}>
          {' '}(edited)
        </Text>
      )}
    </Text>
  );
};

// Interactive spoiler component: blurred / masked until tapped
const SpoilerPill: React.FC<{ text: string; palette: any }> = ({ text, palette }) => {
  const [revealed, setRevealed] = useState(false);

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRevealed((prev) => !prev);
  };

  if (!revealed) {
    return (
      <TouchableOpacity
        onPress={handleToggle}
        activeOpacity={0.8}
        style={[styles.spoilerMasked, { backgroundColor: palette.surface }]}
        accessibilityRole="button"
        accessibilityLabel="Spoiler, tap to reveal"
      >
        <EyeOff size={11} color={palette.textSecondary} style={{ marginRight: 3 }} />
        <Text style={[styles.spoilerHint, { color: palette.textSecondary }]}>
          Spoiler (tap to reveal)
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleToggle}
      activeOpacity={0.8}
      style={[styles.spoilerRevealed, { backgroundColor: `${palette.primary}18` }]}
      accessibilityRole="button"
      accessibilityLabel="Spoiler revealed, tap to hide"
    >
      <Eye size={11} color={palette.primaryText || palette.primary} style={{ marginRight: 3 }} />
      <Text style={[styles.spoilerTextRevealed, { color: palette.text }]}>
        {text}
      </Text>
    </TouchableOpacity>
  );
};

// Regex-based tokenizer for Discord Markdown
function parseMarkdownTokens(input: string): InlineToken[] {
  if (!input) return [];

  const tokens: InlineToken[] = [];
  // Order of precedence: spoilers ||...||, code `...`, bold **...**, strike ~~...~~, underline __...__, italic *...*, mention @...
  const combinedRegex = /(\|\|.+?\|\||`[^`]+`|\*\*.+?\*\*|~~.+?~~|__.+?__|\*.+?\*|@[a-zA-Z0-9_\u00C0-\u017F-]+)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        value: input.substring(lastIndex, match.index),
      });
    }

    const matchedStr = match[0];

    if (matchedStr.startsWith('||') && matchedStr.endsWith('||')) {
      tokens.push({
        type: 'spoiler',
        value: matchedStr.slice(2, -2),
      });
    } else if (matchedStr.startsWith('`') && matchedStr.endsWith('`')) {
      tokens.push({
        type: 'code',
        value: matchedStr.slice(1, -1),
      });
    } else if (matchedStr.startsWith('**') && matchedStr.endsWith('**')) {
      tokens.push({
        type: 'bold',
        value: matchedStr.slice(2, -2),
      });
    } else if (matchedStr.startsWith('~~') && matchedStr.endsWith('~~')) {
      tokens.push({
        type: 'strike',
        value: matchedStr.slice(2, -2),
      });
    } else if (matchedStr.startsWith('__') && matchedStr.endsWith('__')) {
      tokens.push({
        type: 'underline',
        value: matchedStr.slice(2, -2),
      });
    } else if (matchedStr.startsWith('*') && matchedStr.endsWith('*')) {
      tokens.push({
        type: 'italic',
        value: matchedStr.slice(1, -1),
      });
    } else if (matchedStr.startsWith('@')) {
      tokens.push({
        type: 'mention',
        value: matchedStr,
      });
    } else {
      tokens.push({
        type: 'text',
        value: matchedStr,
      });
    }

    lastIndex = combinedRegex.lastIndex;
  }

  if (lastIndex < input.length) {
    tokens.push({
      type: 'text',
      value: input.substring(lastIndex),
    });
  }

  return tokens;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
  baseText: {
    fontSize: 15,
    lineHeight: 22,
  },
  boldText: {
    fontWeight: '700',
  },
  italicText: {
    fontStyle: 'italic',
  },
  strikeText: {
    textDecorationLine: 'line-through',
  },
  underlineText: {
    textDecorationLine: 'underline',
  },
  quoteContainer: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginVertical: 2,
  },
  codeInline: {
    fontFamily: 'monospace',
    fontSize: 13,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  mentionPill: {
    fontWeight: '600',
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  spoilerMasked: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  spoilerHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  spoilerRevealed: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  spoilerTextRevealed: {
    fontSize: 14,
  },
  editedIndicator: {
    fontSize: 11,
    fontStyle: 'italic',
  },
});
