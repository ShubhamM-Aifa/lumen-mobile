import React from 'react';
import { Alert } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { LumenAiSettingsGroup } from '../settings/LumenAiSettingsGroup';
import { useAiAccess, useSetAiAccess } from '../../hooks/useAiChat';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../hooks/useAiChat', () => ({ useAiAccess: jest.fn(), useSetAiAccess: jest.fn() }));
const mockPinModal = jest.fn();
jest.mock('../common/PhotoPinModal', () => ({
  PhotoPinModal: (props: Record<string, unknown>) => { mockPinModal(props); return null; },
}));

const mutate = jest.fn();
const access = (over: object = {}) => ({
  fullAccess: false, photoAccess: false, freeTierAcknowledged: false, hasPhotoPin: false,
  configured: true, model: 'gemini-3.1-flash-lite', ...over,
});
const row = (t: ReactTestRenderer, label: string) => t.root.findAll(n => n.props.label === label && 'onToggle' in n.props)[0];

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<LumenAiSettingsGroup />); });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  (useSetAiAccess as jest.Mock).mockReturnValue({ mutate, isPending: false });
});

describe('LumenAiSettingsGroup', () => {
  it('shows the free-tier notice and turns full access on only after "I understand"', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: access() });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const tree = await render();
    await act(async () => { row(tree, 'Lumen AI full access').props.onToggle(true); });
    expect(mutate).not.toHaveBeenCalled();
    const [title, body, buttons] = alert.mock.calls[0] as [string, string, Array<{ text: string; onPress?: () => void }>];
    expect(title).toMatch(/Before you turn on/);
    expect(body).toMatch(/free tier/);
    expect(body).toMatch(/improve Google/);
    buttons.find(b => b.text === 'I understand, turn on')!.onPress!();
    expect(mutate).toHaveBeenCalledWith({ fullAccess: true, acknowledgeFreeTier: true }, expect.anything());
    alert.mockRestore();
  });

  it('turns full access off straight away', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: access({ fullAccess: true, freeTierAcknowledged: true }) });
    const tree = await render();
    await act(async () => { row(tree, 'Lumen AI full access').props.onToggle(false); });
    expect(mutate).toHaveBeenCalledWith({ fullAccess: false }, expect.anything());
  });

  it('keeps the photo switch disabled until full access is on', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: access() });
    const tree = await render();
    expect(row(tree, 'Include photos (incl. sensitive)').props.disabled).toBe(true);
  });

  it('asks for the photo PIN (no biometric shortcut) and sends it with the request', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: access({ fullAccess: true, freeTierAcknowledged: true, hasPhotoPin: true }) });
    const tree = await render();
    await act(async () => { row(tree, 'Include photos (incl. sensitive)').props.onToggle(true); });
    const props = mockPinModal.mock.calls.at(-1)[0] as { visible: boolean; pinOnly: boolean; onSuccess: (pin?: string) => void };
    expect(props).toMatchObject({ visible: true, pinOnly: true });
    await act(async () => { props.onSuccess('4321'); });
    expect(mutate).toHaveBeenCalledWith({ photoAccess: true, pin: '4321' }, expect.anything());
  });

  it('without a PIN set, confirms before allowing photos', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: access({ fullAccess: true, freeTierAcknowledged: true }) });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find(b => b.text === 'Allow')?.onPress?.());
    const tree = await render();
    await act(async () => { row(tree, 'Include photos (incl. sensitive)').props.onToggle(true); });
    expect(mutate).toHaveBeenCalledWith({ photoAccess: true }, expect.anything());
    alert.mockRestore();
  });

  it('cannot be switched on when the server has no Gemini key', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: access({ configured: false }) });
    const tree = await render();
    expect(row(tree, 'Lumen AI full access').props.disabled).toBe(true);
  });
});
