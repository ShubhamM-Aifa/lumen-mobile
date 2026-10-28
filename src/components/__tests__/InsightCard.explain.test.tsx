import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { InsightCard } from '../insights/InsightCard';
import { useExplain } from '../../hooks/useExplain';
import type { InsightFinding } from '../../hooks/useInsights';

jest.mock('../../hooks/useExplain', () => ({ useExplain: jest.fn() }));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);
const button = (t: ReactTestRenderer, label: string) =>
  t.root.findAll(n => typeof n.props.accessibilityLabel === 'string' && (n.props.accessibilityLabel as string).startsWith(label) && typeof n.props.onPress === 'function')[0];

const finding: InsightFinding = {
  id: 'opt_dairy|opt_fatigue|1',
  exposureKey: 'opt_dairy',
  outcomeKey: 'opt_fatigue',
  exposure: { categoryName: 'Food & Drink', optionLabel: 'Dairy' },
  outcome: { categoryName: 'Symptom', optionLabel: 'Fatigue' },
  lagDays: 1,
  counts: { exposedWith: 9, exposedTotal: 14, otherWith: 6, otherTotal: 31 },
  tier: 'possible',
  noLongerSeen: false,
  weakDays: false,
};

describe('InsightCard — Explain (Phase 6)', () => {
  const mutate = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    (useExplain as jest.Mock).mockReturnValue({ mutate, isPending: false });
  });

  it('hides the Explain button when aiExplanationsEnabled is off', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<InsightCard finding={finding} />); });
    expect(button(tree, 'Explain this pattern')).toBeUndefined();
  });

  it('shows the Explain button and calls the API with the right keys when on', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<InsightCard finding={finding} aiExplanationsEnabled /> ); });
    const btn = button(tree, 'Explain this pattern');
    expect(btn).toBeDefined();
    await act(async () => { btn.props.onPress(); });
    expect(mutate).toHaveBeenCalledWith(
      { kind: 'finding', exposureKey: 'opt_dairy', outcomeKey: 'opt_fatigue', lagDays: 1 },
      expect.anything(),
    );
  });

  it('shows the returned text and tags it "AI-written" when the source is ai', async () => {
    (useExplain as jest.Mock).mockReturnValue({
      mutate: (input: unknown, opts: { onSuccess: (r: { text: string; source: string }) => void }) =>
        opts.onSuccess({ text: 'Fatigue showed up more often after dairy in your logs.', source: 'ai' }),
      isPending: false,
    });
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<InsightCard finding={finding} aiExplanationsEnabled />); });
    await act(async () => { button(tree, 'Explain this pattern').props.onPress(); });
    const t = texts(tree);
    expect(t).toContain('AI-written');
    expect(t).toContain('Fatigue showed up more often after dairy in your logs.');
  });

  it('tags the text "Plain-language summary" when the source is template', async () => {
    (useExplain as jest.Mock).mockReturnValue({
      mutate: (input: unknown, opts: { onSuccess: (r: { text: string; source: string }) => void }) =>
        opts.onSuccess({ text: 'Template fallback text.', source: 'template' }),
      isPending: false,
    });
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<InsightCard finding={finding} aiExplanationsEnabled />); });
    await act(async () => { button(tree, 'Explain this pattern').props.onPress(); });
    expect(texts(tree)).toContain('Plain-language summary');
  });
});
