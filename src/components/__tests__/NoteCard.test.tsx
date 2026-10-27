import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { NoteCard } from '../notes/NoteCard';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);
const byLabel = (t: ReactTestRenderer, label: string) =>
  t.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function').pop()!;

const note = {
  _id: 'n1',
  title: 'Rheumatology visit',
  icon: '🩺',
  isPinned: false,
  tags: ['clinic', 'labs', 'extra'],
  linkedSymptomIds: ['a', 'b'],
  linkedMedicationIds: ['m'],
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  blocks: [{ id: 'b1', type: 'paragraph', content: '' }, { id: 'b2', type: 'paragraph', content: 'Ask about the new dose.' }],
} as never;

async function render(n = note, props: Partial<React.ComponentProps<typeof NoteCard>> = {}) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<NoteCard note={n} onPress={jest.fn()} onTogglePin={jest.fn()} {...props} />);
  });
  return tree;
}

describe('NoteCard row', () => {
  it('shows the title, the first non-empty block as preview, links and at most two tags', async () => {
    const t = texts(await render());
    expect(t).toContain('Rheumatology visit');
    expect(t).toContain('Ask about the new dose.');
    expect(t).toContain('2');
    expect(t).toContain('1');
    expect(t).toContain('#clinic');
    expect(t).toContain('#labs');
    expect(t).not.toContain('#extra');
  });

  it('opens the note and pins it without opening', async () => {
    const onPress = jest.fn();
    const onTogglePin = jest.fn();
    const tree = await render(note, { onPress, onTogglePin });
    await act(async () => { byLabel(tree, 'Pin Rheumatology visit').props.onPress(); });
    expect(onTogglePin).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
    await act(async () => { byLabel(tree, 'Note: Rheumatology visit').props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('offers Unpin for a pinned note and falls back for an empty one', async () => {
    const pinned = { ...(note as object), isPinned: true, title: '', blocks: [] } as never;
    const tree = await render(pinned);
    expect(byLabel(tree, 'Unpin Untitled Note')).toBeDefined();
    expect(texts(tree)).toContain('Empty note...');
  });
});
