import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';

export default function CustomizeLayout() {
  const { palette } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.tint,
        headerTitleStyle: { ...typography.headline, color: palette.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="categories" options={{ headerShown: false }} />
      <Stack.Screen name="category/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="questions/[categoryId]" options={{ headerShown: false }} />
      <Stack.Screen name="question/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="options/[questionId]" options={{ headerShown: false }} />
      <Stack.Screen name="option/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="medications" options={{ headerShown: false }} />
    </Stack>
  );
}

