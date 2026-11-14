import { Alert, Platform } from 'react-native';

/**
 * Asks before a destructive action. React Native's Alert.alert does nothing on web, so the web build
 * (used for browser testing) falls back to window.confirm.
 */
export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void): void {
  if (Platform.OS === 'web') {
    const g = globalThis as { confirm?: (m: string) => boolean };
    if (typeof g.confirm !== 'function' || g.confirm(`${title}\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
