import React from 'react';
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '../../src/components/ios/FloatingTabBar';
import { useTheme } from '../../src/theme/ThemeContext';

export default function TabLayout() {
  const { palette } = useTheme();

  return (
    <Tabs
      tabBar={props => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.background },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="timeline" options={{ title: 'Timeline' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="customize" options={{ title: 'Customize' }} />
      {/* The "+" button lives in the floating bar; this route only redirects to /log. */}
      <Tabs.Screen name="action" options={{ href: null }} />
    </Tabs>
  );
}
