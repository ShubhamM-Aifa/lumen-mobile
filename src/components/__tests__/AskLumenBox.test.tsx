import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { AskLumenBox } from '../insights/AskLumenBox';
import { useAskLumen } from '../../hooks/useExplain';

jest.mock('../../hooks/useExplain', () => ({ useAskLumen: jest.fn() }));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);

describe('AskLumenBox', () => {
  const mutate = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    (useAskLumen as jest.Mock).mockReturnValue({ mutate, isPending: false });
  });

  it('does not send an empty question', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<AskLumenBox />); });
    const sendBtn = tree.root.findAll(n => n.props.accessibilityLabel === 'Send question')[0];
    await act(async () => { sendBtn.props.onPress(); });
    expect(mutate).not.toHaveBeenCalled();
  });

  it('sends the typed question and shows the answer', async () => {
    (useAskLumen as jest.Mock).mockReturnValue({
      mutate: (q: string, opts: { onSuccess: (r: { text: string; source: string }) => void }) =>
        opts.onSuccess({ text: 'Your sleep has been improving.', source: 'ai' }),
      isPending: false,
    });
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<AskLumenBox />); });
    const input = tree.root.findByType(TextInput);
    await act(async () => { input.props.onChangeText('Is my sleep getting better?'); });
    const sendBtn = tree.root.findAll(n => n.props.accessibilityLabel === 'Send question')[0];
    await act(async () => { sendBtn.props.onPress(); });
    expect(texts(tree)).toContain('Your sleep has been improving.');
  });
});
