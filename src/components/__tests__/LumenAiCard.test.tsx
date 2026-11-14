import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import { LumenAiCard } from '../insights/LumenAiCard';
import { useAiAccess, useAiWeeklyReports } from '../../hooks/useAiChat';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../hooks/useAiChat', () => ({
  ...jest.requireActual('../../hooks/useAiChat'),
  useAiAccess: jest.fn(),
  useAiWeeklyReports: jest.fn(),
}));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);
const press = async (t: ReactTestRenderer, text: string) => {
  const node = t.root.findAll(n => typeof n.props.onPress === 'function' && n.findAll(c => flat(c.props.children) === text).length > 0)[0];
  await act(async () => { node.props.onPress(); });
};
async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<LumenAiCard />); });
  return tree;
}

beforeEach(() => jest.clearAllMocks());

describe('LumenAiCard', () => {
  it('points to Settings while Lumen AI is off', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: { fullAccess: false, configured: true } });
    (useAiWeeklyReports as jest.Mock).mockReturnValue({ data: undefined });
    const t = await render();
    await press(t, 'Set up Lumen AI');
    expect(router.push).toHaveBeenCalledWith('/settings');
    expect(useAiWeeklyReports).toHaveBeenCalledWith(false);
  });

  it('opens a new chat and previews the latest weekly review when on', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: { fullAccess: true, configured: true } });
    (useAiWeeklyReports as jest.Mock).mockReturnValue({
      data: [{ id: 'r1', weekStart: '2026-11-02', weekEnd: '2026-11-08', text: '**Calmer** week\n\noverall.', createdAt: '' }],
    });
    const t = await render();
    expect(texts(t)).toContain('Latest AI review · 2 Nov – 8 Nov');
    expect(texts(t)).toContain('Calmer week overall.');
    await press(t, 'Ask Lumen AI');
    expect(router.push).toHaveBeenCalledWith('/ai/new');
  });
});
