import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockCalls: string[] = [];
const mockRecorder = {
  isRecording: false,
  uri: 'file:///rec_1.m4a',
  prepareToRecordAsync: jest.fn(async () => { mockCalls.push('prepare'); }),
  record: jest.fn(() => { mockCalls.push('record'); mockRecorder.isRecording = true; }),
  stop: jest.fn(async () => { mockCalls.push('stop'); mockRecorder.isRecording = false; }),
  getStatus: jest.fn(() => ({ durationMillis: 3200 })),
};

jest.mock('expo-audio', () => ({
  useAudioRecorder: () => mockRecorder,
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setAudioModeAsync: jest.fn(async (m: any) => { mockCalls.push(`mode:${m.allowsRecording ? 'record' : 'play'}`); }),
}));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 0, Medium: 1 } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ palette: { surface: '#fff', border: '#ddd', text: '#000', textSecondary: '#666', primary: '#00f', error: '#f00' } }),
}));
const mockUpload = jest.fn(async (_uri: string, _mime: string) => ({ mediaId: 'm1', url: 'https://x/y' }));
jest.mock('../../services/mediaUpload', () => ({ uploadMedia: (u: string, m: string) => mockUpload(u, m) }));

import { VoiceNoteRecorder } from '../community/VoiceNoteRecorder';

beforeEach(() => { mockCalls.length = 0; mockRecorder.isRecording = false; jest.clearAllMocks(); jest.spyOn(Alert, 'alert').mockImplementation(() => undefined); });

describe('VoiceNoteRecorder', () => {
  it('switches to record mode and prepares the recorder BEFORE it starts recording', async () => {
    render(<VoiceNoteRecorder onSend={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(mockRecorder.record).toHaveBeenCalled());
    expect(mockCalls.slice(0, 3)).toEqual(['mode:record', 'prepare', 'record']);
  });

  it('stops recording, goes back to playback mode, uploads as MP4 audio, and sends the real duration', async () => {
    const onSend = jest.fn();
    const { getByLabelText } = render(<VoiceNoteRecorder onSend={onSend} onCancel={jest.fn()} />);
    await waitFor(() => expect(mockRecorder.record).toHaveBeenCalled());
    fireEvent.press(getByLabelText('Send voice note'));
    await waitFor(() => expect(onSend).toHaveBeenCalled());
    expect(mockUpload).toHaveBeenCalledWith('file:///rec_1.m4a', 'audio/mp4');
    expect(onSend).toHaveBeenCalledWith('https://x/y', 3, 'm1');
    expect(mockCalls).toContain('stop');
    expect(mockCalls[mockCalls.length - 1]).toBe('mode:play');
  });

  it('does not send a recording shorter than a second', async () => {
    mockRecorder.getStatus.mockReturnValueOnce({ durationMillis: 300 });
    const onSend = jest.fn();
    const onCancel = jest.fn();
    const { getByLabelText } = render(<VoiceNoteRecorder onSend={onSend} onCancel={onCancel} />);
    await waitFor(() => expect(mockRecorder.record).toHaveBeenCalled());
    fireEvent.press(getByLabelText('Send voice note'));
    await waitFor(() => expect(onCancel).toHaveBeenCalled());
    expect(onSend).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('turns the microphone off if the screen closes mid-recording', async () => {
    const { unmount } = render(<VoiceNoteRecorder onSend={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(mockRecorder.record).toHaveBeenCalled());
    unmount();
    await waitFor(() => expect(mockRecorder.stop).toHaveBeenCalled());
  });
});
