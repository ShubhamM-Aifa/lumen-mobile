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
    />
  );
}

