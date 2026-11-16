import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { api } from '../../api/client';
import { registerPushToken, unregisterPushToken } from '../pushRegistration';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));
const mockN = jest.requireMock('expo-notifications') as Record<'getPermissionsAsync' | 'requestPermissionsAsync' | 'getExpoPushTokenAsync', jest.Mock>;
jest.mock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'proj-123' } } } }));
jest.mock('../../api/client', () => ({ api: { post: jest.fn(async () => ({})), delete: jest.fn(async () => ({})) } }));

const TOKEN = 'ExponentPushToken[abc123]';

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  mockN.getPermissionsAsync.mockResolvedValue({ granted: true });
  mockN.getExpoPushTokenAsync.mockResolvedValue({ data: TOKEN });
});

describe('push registration', () => {
  it('gets the Expo token for this project and sends it to the server', async () => {
    expect(await registerPushToken()).toBe(TOKEN);
    expect(mockN.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-123' });
    expect(api.post).toHaveBeenCalledWith('/notification-policy/push-token', { token: TOKEN, platform: 'android' });
  });

  it('asks for permission once if needed, and gives up quietly when refused', async () => {
    mockN.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    mockN.requestPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await registerPushToken()).toBeNull();
    expect(mockN.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('does nothing on the web, and survives a build without push set up', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    expect(await registerPushToken()).toBeNull();
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    mockN.getExpoPushTokenAsync.mockRejectedValue(new Error('Default FirebaseApp is not initialized'));
    expect(await registerPushToken()).toBeNull();
  });

  it('removes this phone\'s token on logout', async () => {
    await registerPushToken();
    await unregisterPushToken();
    expect(api.delete).toHaveBeenCalledWith(`/notification-policy/push-token?token=${encodeURIComponent(TOKEN)}`);
    (api.delete as jest.Mock).mockClear();
    await unregisterPushToken();
    expect(api.delete).not.toHaveBeenCalled();
  });
});
