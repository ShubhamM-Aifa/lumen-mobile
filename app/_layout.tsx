import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/api/queryClient';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { useNotificationSync } from '../src/hooks/useNotificationSync';
import { flushQueue } from '../src/services/mediaUpload';
import { useConfigStore } from '../src/store/configStore';
import { useAuthStore } from '../src/store/authStore';
import { installGlobalAlert, CustomAlertModal } from '../src/components/alert';
import { InitialPermissionsModal } from '../src/components/permissions/InitialPermissionsModal';
import { permissionService } from '../src/services/permissionService';
import { useAppLock } from '../src/hooks/useAppLock';
import { AppLockOverlay } from '../src/components/security/AppLockOverlay';

// Install custom alert interceptor globally for all Alert.alert() calls
try {
  installGlobalAlert();
} catch (e) {
  console.warn('[RootLayout] installGlobalAlert error:', e);
}

// Handle OAuth redirect completion on web as early as possible
if (Platform.OS === 'web') {
  try {
    WebBrowser.maybeCompleteAuthSession({ skipRedirectCheck: true });
  } catch (e) {
    console.warn('[RootLayout] maybeCompleteAuthSession error:', e);
  }
}

function AppBootstrap() {
  useNotificationSync();
  useAppLock();
  const { palette, colorScheme } = useTheme();
  const { fetchConfig } = useConfigStore();
  const initAuth = useAuthStore(s => s.initAuth);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const [showInitialPrimer, setShowInitialPrimer] = useState(false);

  useEffect(() => {
    initAuth().catch(err => console.warn('[AppBootstrap] initAuth error:', err));
    permissionService.hasSeenInitialPrimer().then((hasSeen) => {
      if (!hasSeen) {
        setShowInitialPrimer(true);
      }
    }).catch(err => console.warn('[AppBootstrap] hasSeenInitialPrimer error:', err));
  }, [initAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchConfig().catch(err => console.warn('[AppBootstrap] fetchConfig error:', err));
      flushQueue().catch(err => console.warn('[AppBootstrap] flushQueue error:', err));
    }
  }, [isAuthenticated, fetchConfig]);

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
        }}
      />
      <CustomAlertModal />
      <AppLockOverlay />
      <InitialPermissionsModal
        visible={showInitialPrimer}
        onComplete={() => setShowInitialPrimer(false)}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AppBootstrap />
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
