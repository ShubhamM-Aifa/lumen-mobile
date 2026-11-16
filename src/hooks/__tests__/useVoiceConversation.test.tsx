import React from 'react';
import { act, create } from 'react-test-renderer';
import { useVoiceConversation, DICTATION_ERROR_TEXT } from '../useVoiceConversation';
import { useDictation, type DictationOptions } from '../../services/voice/useDictation';
import { speakReply, stopSpeaking } from '../../services/voice/tts';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('../../services/voice/useDictation', () => ({ useDictation: jest.fn() }));
jest.mock('../../services/voice/tts', () => ({ speakReply: jest.fn(), stopSpeaking: jest.fn(async () => undefined) }));

let dictationOpts: DictationOptions;
const dictation = { listening: false, partial: '', level: 0, start: jest.fn(async () => true), stop: jest.fn(), cancel: jest.fn() };
let speakResolve: (() => void) | null = null;

type Hook = ReturnType<typeof useVoiceConversation>;
let hook: Hook;
const send = jest.fn();

function Harness() {
  hook = useVoiceConversation({ lang: 'en-IN', voice: 'Kore', natural: true, send });
  return null;
}

async function render() {
  await act(async () => { create(<Harness />); });
}
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

beforeEach(() => {
  jest.clearAllMocks();
  (useDictation as jest.Mock).mockImplementation((o: DictationOptions) => { dictationOpts = o; return dictation; });
  (speakReply as jest.Mock).mockImplementation(() => new Promise<void>(r => { speakResolve = r; }));
  send.mockResolvedValue({ ok: true, reply: 'You slept about 7 hours.' });
});

describe('useVoiceConversation', () => {
  it('listens, sends what was said, speaks the reply, then listens again', async () => {
    await render();
    await act(async () => { await hook.start(); });
    expect(hook.phase).toBe('listening');
    expect(dictation.start).toHaveBeenCalledTimes(1);

    await act(async () => { dictationOpts.onFinal('how did I sleep?'); });
    await flush();
    expect(send).toHaveBeenCalledWith('how did I sleep?');
    expect(hook.phase).toBe('speaking');
    expect(hook.reply).toBe('You slept about 7 hours.');
    expect(speakReply).toHaveBeenCalledWith('You slept about 7 hours.', { voice: 'Kore', natural: true, id: 'voice-mode' });

    await act(async () => { speakResolve?.(); });
    await flush();
    expect(hook.phase).toBe('listening');
    expect(dictation.start).toHaveBeenCalledTimes(2);
  });

  it('pauses after two silent turns and says so', async () => {
    await render();
    await act(async () => { await hook.start(); });
    await act(async () => { dictationOpts.onFinal(''); });
    await flush();
    expect(hook.phase).toBe('listening');
    await act(async () => { dictationOpts.onFinal(''); });
    await flush();
    expect(hook.phase).toBe('idle');
    expect(hook.notice).toBe(DICTATION_ERROR_TEXT['no-speech']);
    expect(send).not.toHaveBeenCalled();
  });

  it('tapping the orb interrupts the reply', async () => {
    await render();
    await act(async () => { await hook.start(); });
    await act(async () => { dictationOpts.onFinal('hi'); });
    await flush();
    expect(hook.phase).toBe('speaking');
    act(() => { hook.tapOrb(); });
    expect(stopSpeaking).toHaveBeenCalled();
  });

  it('tapping while listening finishes the utterance now', async () => {
    await render();
    await act(async () => { await hook.start(); });
    act(() => { hook.tapOrb(); });
    expect(dictation.stop).toHaveBeenCalled();
  });

  it('with the mic muted, stops after the reply instead of listening', async () => {
    await render();
    await act(async () => { await hook.start(); });
    act(() => { hook.setMuted(true); });
    await act(async () => { dictationOpts.onFinal('hi'); });
    await flush();
    await act(async () => { speakResolve?.(); });
    await flush();
    expect(hook.phase).toBe('idle');
    expect(dictation.start).toHaveBeenCalledTimes(1);
  });

  it('speaks the failure text when the AI could not answer', async () => {
    send.mockRejectedValue(new Error('Network request failed'));
    await render();
    await act(async () => { await hook.start(); });
    await act(async () => { dictationOpts.onFinal('hi'); });
    await flush();
    expect(speakReply).toHaveBeenCalledWith('Network request failed', expect.anything());
  });

  it('stops on a microphone permission error', async () => {
    await render();
    await act(async () => { await hook.start(); });
    act(() => { dictationOpts.onError?.('permission'); });
    expect(hook.phase).toBe('idle');
    expect(hook.notice).toBe(DICTATION_ERROR_TEXT.permission);
  });

  it('ending stops listening and speaking', async () => {
    await render();
    await act(async () => { await hook.start(); });
    act(() => { hook.end(); });
    expect(dictation.cancel).toHaveBeenCalled();
    expect(stopSpeaking).toHaveBeenCalled();
    expect(hook.phase).toBe('idle');
  });
});
