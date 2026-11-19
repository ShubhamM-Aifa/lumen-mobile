import React from 'react';
import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';
import { router } from 'expo-router';
import { useAskLumenAi } from '../useAskLumenAi';
import { useAiAccess } from '../useAiChat';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../useAiChat', () => ({ useAiAccess: jest.fn() }));

let api: ReturnType<typeof useAskLumenAi>;
function Probe() { api = useAskLumenAi(); return null; }
const ref = { kind: 'task' as const, id: 't1', title: 'Book blood test' };

beforeEach(() => jest.clearAllMocks());

describe('useAskLumenAi', () => {
  it('opens a new chat with the item attached', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: { fullAccess: true } });
    await act(async () => { create(<Probe />); });
    api.ask(ref);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/ai/[id]', params: { id: 'new', attach: JSON.stringify(ref) } });
  });

  it('explains how to turn Lumen AI on when it is off', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: { fullAccess: false } });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await act(async () => { create(<Probe />); });
    api.ask(ref);
    expect(router.push).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Lumen AI is off', expect.any(String), expect.any(Array));
  });
});
