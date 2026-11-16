import React from 'react';
import { Alert } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import AiModelScreen from '../../../app/ai/model';
import { useAiAccess, useAiModels, useAiUsage, useUpdateAiSettings } from '../../hooks/useAiChat';

jest.mock('../../components/ios/ScreenTopBar', () => ({ ScreenTopBar: () => null }));
jest.mock('../../hooks/useAiChat', () => ({
  ...jest.requireActual('../../hooks/useAiChat'),
  useAiAccess: jest.fn(), useAiModels: jest.fn(), useAiUsage: jest.fn(), useUpdateAiSettings: jest.fn(),
}));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);
const row = (t: ReactTestRenderer, label: string) =>
  t.root.findAll(n => n.props.accessibilityRole === 'radio' && typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith(label) && n.props.onPress)[0];

const mutate = jest.fn();
const access = { fullAccess: true, configured: true, claudeAcknowledged: false, model: 'gemini-3.1-flash-lite', modelLabel: 'Gemini 3.1 Flash-Lite', chosenModelUnavailable: false };
const models = (claudeAvailable: boolean) => ({
  data: {
    models: [
      { id: 'gemini-3.1-flash-lite', provider: 'gemini', label: 'Gemini 3.1 Flash-Lite', note: 'Free · fast', inputPerM: 0, outputPerM: 0, available: true },
      { id: 'gemini-3.5-flash-lite', provider: 'gemini', label: 'Gemini 3.5 Flash-Lite', note: 'Free · newer', inputPerM: 0, outputPerM: 0, available: true },
      { id: 'claude-opus-5-5', provider: 'claude', label: 'Claude Opus 5.5', note: 'Paid', inputPerM: 4, outputPerM: 20, available: claudeAvailable },
    ],
    voices: [],
  },
});

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<AiModelScreen />); });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  (useAiAccess as jest.Mock).mockReturnValue({ data: access });
  (useAiModels as jest.Mock).mockReturnValue(models(false));
  (useAiUsage as jest.Mock).mockReturnValue({ data: { month: '2026-11', models: [], totalUsd: 0 } });
  (useUpdateAiSettings as jest.Mock).mockReturnValue({ mutate, isPending: false });
});

describe('AI model picker', () => {
  it('lists both providers and explains how to set up Claude when it has no key', async () => {
    const t = await render();
    const all = texts(t).join('\n');
    expect(all).toContain('Google Gemini');
    expect(all).toContain('Anthropic Claude');
    expect(all).toContain('ANTHROPIC_API_KEY');
    expect(row(t, 'Claude Opus 5.5').props.disabled).toBe(true);
    expect(row(t, 'Gemini 3.1 Flash-Lite').props.accessibilityState.selected).toBe(true);
  });

  it('switches Gemini models straight away', async () => {
    const t = await render();
    await act(async () => { row(t, 'Gemini 3.5 Flash-Lite').props.onPress(); });
    expect(mutate).toHaveBeenCalledWith({ model: 'gemini-3.5-flash-lite' }, expect.anything());
  });

  it('shows the Claude cost and data notice before the first switch to Claude', async () => {
    (useAiModels as jest.Mock).mockReturnValue(models(true));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const t = await render();
    await act(async () => { row(t, 'Claude Opus 5.5').props.onPress(); });
    expect(mutate).not.toHaveBeenCalled();
    const [title, body, buttons] = alert.mock.calls[0] as [string, string, { text: string; onPress?: () => void }[]];
    expect(title).toBe('Switch to Claude?');
    expect(body).toContain('paid per use');
    buttons.find(b => b.text.startsWith('I understand'))!.onPress!();
    expect(mutate).toHaveBeenCalledWith({ model: 'claude-opus-5-5', acknowledgeClaude: true }, expect.anything());
  });

  it('skips the notice once Claude was accepted', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: { ...access, claudeAcknowledged: true } });
    (useAiModels as jest.Mock).mockReturnValue(models(true));
    const t = await render();
    await act(async () => { row(t, 'Claude Opus 5.5').props.onPress(); });
    expect(mutate).toHaveBeenCalledWith({ model: 'claude-opus-5-5' }, expect.anything());
  });

  it('shows this month’s estimated Claude cost', async () => {
    (useAiUsage as jest.Mock).mockReturnValue({ data: { month: '2026-11', totalUsd: 0.5, models: [
      { model: 'claude-opus-5-5', label: 'Claude Opus 5.5', provider: 'claude', replies: 4, inputTokens: 1, outputTokens: 1, estimatedUsd: 0.5 },
    ] } });
    const t = await render();
    expect(texts(t).join('\n')).toContain('4 replies · ≈ $0.50 (₹44)');
  });
});
