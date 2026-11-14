import React from 'react';
import { Alert } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import { LogPhotoGallery } from '../timeline/LogPhotoGallery';
import { useAiAccess, useAnalysePhoto } from '../../hooks/useAiChat';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('../common/PhotoPinModal', () => ({ PhotoPinModal: () => null }));
jest.mock('../../services/mediaService', () => ({
  ...jest.requireActual('../../services/mediaService'),
  useResolvedMediaUrls: () => ({ urls: ['https://example.test/p.jpg'], isLoading: false, error: null }),
}));
jest.mock('../../hooks/useAiChat', () => ({ useAiAccess: jest.fn(), useAnalysePhoto: jest.fn() }));

const MEDIA_ID = '6ae1a2c375f68eadca586175';
const mutate = jest.fn();
const analyseButton = (t: ReactTestRenderer) =>
  t.root.findAll(n => n.props.accessibilityLabel === 'Analyse with AI' && typeof n.props.onPress === 'function')[0];

async function openViewer(uris: string[]) {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<LogPhotoGallery uris={uris} fieldLabel="Rash" />); });
  const thumb = tree.root.findAll(n => n.props.accessibilityLabel === 'View photo 1' && typeof n.props.onPress === 'function')[0];
  await act(async () => { thumb.props.onPress(); });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  (useAnalysePhoto as jest.Mock).mockReturnValue({ mutate, isPending: false });
});

describe('LogPhotoGallery → Analyse with AI', () => {
  it('is hidden while Lumen AI is off', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: { fullAccess: false, photoAccess: false } });
    expect(analyseButton(await openViewer([MEDIA_ID]))).toBeUndefined();
  });

  it('is hidden for a photo that has not been uploaded yet', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: { fullAccess: true, photoAccess: true } });
    expect(analyseButton(await openViewer(['file:///local/p.jpg']))).toBeUndefined();
  });

  it('analyses the stored photo and opens the resulting chat', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: { fullAccess: true, photoAccess: true } });
    mutate.mockImplementation((_id, opts) => opts.onSuccess({ conversation: { id: 'c5' }, reply: 'ok', error: null }));
    const t = await openViewer([MEDIA_ID]);
    await act(async () => { analyseButton(t).props.onPress(); });
    expect(mutate).toHaveBeenCalledWith(MEDIA_ID, expect.anything());
    expect(router.push).toHaveBeenCalledWith('/ai/c5');
  });

  it('explains how to allow photos instead of sending one while photo access is off', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: { fullAccess: true, photoAccess: false } });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const t = await openViewer([MEDIA_ID]);
    await act(async () => { analyseButton(t).props.onPress(); });
    expect(mutate).not.toHaveBeenCalled();
    expect(alert.mock.calls[0][0]).toMatch(/Photos are off/);
    alert.mockRestore();
  });
});
