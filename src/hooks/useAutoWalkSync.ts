/**
 * Checks the phone's step history for new walks whenever Lumen is opened or comes back to the
 * front, once signed in. Does nothing unless "Track walks automatically" is on.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAutoWalkStore } from '../store/autoWalkStore';
import { registerAutoWalkTask } from '../services/activity/backgroundSync';

export function useAutoWalkSync(isAuthenticated: boolean): void {
  useEffect(() => {
    if (!isAuthenticated) return;
    const store = useAutoWalkStore.getState();
    store.hydrate().then(() => {
      if (!useAutoWalkStore.getState().enabled) return;
      // The phone can drop a registration (app update, reinstall); putting it back is harmless
      registerAutoWalkTask().catch(() => {});
      useAutoWalkStore.getState().sync().catch(() => {});
    }).catch(() => {});

    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') useAutoWalkStore.getState().sync().catch(() => {});
    });
    return () => sub.remove();
  }, [isAuthenticated]);
}
