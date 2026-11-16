import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer } from 'expo-audio';
import { api } from '../../../api/client';
import { chunkForSpeech, getSpeechState, planSpeechChunks, speakableText, speakReply, speechLanguage, stopSpeaking } from '../tts';

jest.mock('../../../api/client', () => ({ api: { post: jest.fn() } }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn(async () => undefined),
  EncodingType: { Base64: 'base64' },
}));

const post = api.post as jest.Mock;

/** Audio players that finish as soon as they start playing. */
function autoFinishingPlayers() {
  (createAudioPlayer as jest.Mock).mockImplementation(() => {
    let cb: ((s: { didJustFinish: boolean }) => void) | null = null;
    return {
      addListener: jest.fn((_e: string, f: typeof cb) => { cb = f; return { remove: jest.fn() }; }),
      play: jest.fn(() => setTimeout(() => cb?.({ didJustFinish: true }), 0)),
      pause: jest.fn(),
      remove: jest.fn(),
    };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (Speech.speak as jest.Mock).mockImplementation((_t: string, o: { onDone?: () => void }) => setTimeout(() => o.onDone?.(), 0));
});

describe('speakableText', () => {
  it('drops markdown and list markers and ends lines as sentences', () => {
    expect(speakableText('**Sleep:** about 7 hours\n- Better on Tuesday\n- Worse after dairy!\n\n1. Ask your doctor'))
      .toBe('Sleep: about 7 hours. Better on Tuesday. Worse after dairy! Ask your doctor.');
  });
});

describe('chunkForSpeech', () => {
  it('keeps whole sentences together up to the limit', () => {
    expect(chunkForSpeech('One. Two! Three?', 10)).toEqual(['One. Two!', 'Three?']);
  });

  it('cuts a very long sentence at a space', () => {
    const chunks = chunkForSpeech('word '.repeat(100).trim() + '.', 60);
    expect(chunks.every(c => c.length <= 60)).toBe(true);
    expect(chunks.join(' ').split(' ').filter(w => w.startsWith('word')).length).toBe(100);
  });

  it('splits Hindi at the danda', () => {
    expect(chunkForSpeech('आज नींद अच्छी रही। कल बेहतर होगी।', 20)).toEqual(['आज नींद अच्छी रही।', 'कल बेहतर होगी।']);
  });
});

describe('planSpeechChunks', () => {
  const sentence = 'Your sleep was a little better this week than the week before. ';
  it('uses one natural-voice request for a short reply', () => {
    expect(planSpeechChunks(sentence.repeat(5).trim(), true)).toHaveLength(1);
  });

  it('starts a long reply with a short chunk, then uses large ones', () => {
    const long = sentence.repeat(40).trim();
    const chunks = planSpeechChunks(long, true);
    expect(chunks[0].length).toBeLessThanOrEqual(300);
    expect(chunks.slice(1).every(c => c.length <= 1100)).toBe(true);
    expect(chunks.length).toBeLessThanOrEqual(4);
    expect(chunks.join(' ')).toBe(long);
  });

  it('keeps small chunks for the phone voice', () => {
    expect(planSpeechChunks(sentence.repeat(10).trim(), false).every(c => c.length <= 300)).toBe(true);
  });
});

describe('speechLanguage', () => {
  it('uses the Hindi voice only for Devanagari', () => {
    expect(speechLanguage('नमस्ते')).toBe('hi-IN');
    expect(speechLanguage('Aapki neend achhi rahi')).toBe('en-IN');
  });
});

describe('speakReply', () => {
  it('plays Gemini voice audio for each chunk, fetching in the chosen voice', async () => {
    autoFinishingPlayers();
    post.mockResolvedValue({ fallback: false, base64: 'UklGRg==', mimeType: 'audio/wav' });
    await speakReply('First sentence here. Second one.', { voice: 'Puck', natural: true, id: 'm1' });
    expect(post).toHaveBeenCalledWith('/ai/tts', { text: 'First sentence here. Second one.', voice: 'Puck' });
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/\/cache\/lumen-tts-.*\.wav$/), 'UklGRg==', { encoding: 'base64' });
    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
    expect(Speech.speak).not.toHaveBeenCalled();
    expect(getSpeechState()).toEqual({ status: 'idle', id: null });
  });

  it('falls back to the phone voice for the rest of the reply when Gemini TTS says so', async () => {
    post.mockResolvedValue({ fallback: true, reason: 'rate_limited' });
    const long = 'Sentence number one is here. '.repeat(20);
    await speakReply(long, { voice: 'Kore', natural: true });
    expect(post).toHaveBeenCalledTimes(1);
    expect((Speech.speak as jest.Mock).mock.calls.length).toBeGreaterThan(1);
    expect((Speech.speak as jest.Mock).mock.calls[0][1]).toMatchObject({ language: 'en-IN' });
  });

  it('never calls Gemini when the natural voice is off', async () => {
    await speakReply('नमस्ते, आज कैसा लग रहा है?', { voice: 'Kore', natural: false });
    expect(post).not.toHaveBeenCalled();
    expect((Speech.speak as jest.Mock).mock.calls[0][1]).toMatchObject({ language: 'hi-IN' });
  });

  it('stops mid-reply', async () => {
    (Speech.speak as jest.Mock).mockImplementation(() => undefined); // never finishes by itself
    (Speech.stop as jest.Mock).mockImplementation(async () => undefined);
    const done = speakReply('One. Two. Three.', { voice: 'Kore', natural: false, id: 'x' });
    await new Promise(r => setTimeout(r, 0));
    expect(getSpeechState()).toEqual({ status: 'speaking', id: 'x' });
    await stopSpeaking();
    expect(Speech.stop).toHaveBeenCalled();
    expect(getSpeechState().status).toBe('idle');
    // Resolves even though the engine never reported onStopped, and speaks nothing more.
    await done;
    expect(Speech.speak).toHaveBeenCalledTimes(1);
  });
});
