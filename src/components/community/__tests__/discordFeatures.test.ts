describe('Discord Parity Mobile Features', () => {
  describe('Discord Markdown & Spoilers Token Parsing', () => {
    // Replicate parsing logic to unit test token recognition
    const parseTokens = (input: string) => {
      const tokens: { type: string; value: string }[] = [];
      const combinedRegex = /(\|\|.+?\|\||`[^`]+`|\*\*.+?\*\*|~~.+?~~|__.+?__|\*.+?\*|@[a-zA-Z0-9_\u00C0-\u017F-]+)/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = combinedRegex.exec(input)) !== null) {
        if (match.index > lastIndex) {
          tokens.push({ type: 'text', value: input.substring(lastIndex, match.index) });
        }
        const str = match[0];
        if (str.startsWith('||') && str.endsWith('||')) {
          tokens.push({ type: 'spoiler', value: str.slice(2, -2) });
        } else if (str.startsWith('`') && str.endsWith('`')) {
          tokens.push({ type: 'code', value: str.slice(1, -1) });
        } else if (str.startsWith('**') && str.endsWith('**')) {
          tokens.push({ type: 'bold', value: str.slice(2, -2) });
        } else if (str.startsWith('~~') && str.endsWith('~~')) {
          tokens.push({ type: 'strike', value: str.slice(2, -2) });
        } else if (str.startsWith('__') && str.endsWith('__')) {
          tokens.push({ type: 'underline', value: str.slice(2, -2) });
        } else if (str.startsWith('*') && str.endsWith('*')) {
          tokens.push({ type: 'italic', value: str.slice(1, -1) });
        } else if (str.startsWith('@')) {
          tokens.push({ type: 'mention', value: str });
        }
        lastIndex = combinedRegex.lastIndex;
      }
      if (lastIndex < input.length) {
        tokens.push({ type: 'text', value: input.substring(lastIndex) });
      }
      return tokens;
    };

    it('correctly parses spoilers ||text|| into spoiler tokens', () => {
      const tokens = parseTokens('Warning: ||severe brain fog flare|| ahead');
      expect(tokens).toEqual([
        { type: 'text', value: 'Warning: ' },
        { type: 'spoiler', value: 'severe brain fog flare' },
        { type: 'text', value: ' ahead' },
      ]);
    });

    it('correctly parses bold, italic, code, and strikethrough tokens', () => {
      const tokens = parseTokens('Take **1g sodium** and *rest* with `20-30 mmHg` compression, not ~~caffeine~~');
      expect(tokens).toEqual([
        { type: 'text', value: 'Take ' },
        { type: 'bold', value: '1g sodium' },
        { type: 'text', value: ' and ' },
        { type: 'italic', value: 'rest' },
        { type: 'text', value: ' with ' },
        { type: 'code', value: '20-30 mmHg' },
        { type: 'text', value: ' compression, not ' },
        { type: 'strike', value: 'caffeine' },
      ]);
    });

    it('correctly parses @mentions into mention tokens', () => {
      const tokens = parseTokens('Hey @Sarah_Dysautonomia can you check this?');
      expect(tokens).toEqual([
        { type: 'text', value: 'Hey ' },
        { type: 'mention', value: '@Sarah_Dysautonomia' },
        { type: 'text', value: ' can you check this?' },
      ]);
    });
  });

  describe('Voice Notes formatting', () => {
    it('formats duration in seconds to mm:ss format', () => {
      const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };

      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(9)).toBe('0:09');
      expect(formatTime(65)).toBe('1:05');
      expect(formatTime(142)).toBe('2:22');
    });
  });

  describe('In-Channel Filter Chips Matching', () => {
    const testMessages = [
      { _id: '1', content: 'Normal message', senderId: 'u1', senderDisplayName: 'Alice' },
      { _id: '2', content: 'Here is a note', embedType: 'note', senderId: 'u2', senderDisplayName: 'Bob' },
      { _id: '3', content: 'Pacing checklist', embedType: 'todo_list', senderId: 'u1', senderDisplayName: 'Alice' },
      { _id: '4', content: '', audioUrl: 'voice.m4a', senderId: 'u3', senderDisplayName: 'Charlie' },
    ];

    it('filters messages with voice notes', () => {
      const voiceMsgs = testMessages.filter((m) => Boolean(m.audioUrl));
      expect(voiceMsgs).toHaveLength(1);
      expect(voiceMsgs[0]._id).toBe('4');
    });

    it('filters messages with notes', () => {
      const noteMsgs = testMessages.filter((m) => m.embedType === 'note');
      expect(noteMsgs).toHaveLength(1);
      expect(noteMsgs[0]._id).toBe('2');
    });

    it('filters messages with routines / to-dos', () => {
      const todoMsgs = testMessages.filter((m) => m.embedType === 'todo_list');
      expect(todoMsgs).toHaveLength(1);
      expect(todoMsgs[0]._id).toBe('3');
    });
  });
});

