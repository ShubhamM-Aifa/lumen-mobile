import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
  /** The author's content warning. Without one the content is shown straight away. */
  warning?: string;
  children: React.ReactNode;
}

/** Hides what follows behind the author's content warning until the reader taps "Show". */
export const ContentGate: React.FC<Props> = ({ warning, children }) => {
  const { palette } = useTheme();
  const [shown, setShown] = useState(false);

  if (!warning || shown) return <>{children}</>;

  return (
    <TouchableOpacity
      onPress={() => setShown(true)}
      style={[styles.gate, { backgroundColor: palette.background }]}
      accessibilityRole="button"
      accessibilityLabel={`Content warning: ${warning}. Double tap to show`}
    >
      <TriangleAlert size={16} color="#F59E0B" />
      <Text style={[styles.text, { color: palette.text }]}>Content warning: {warning}</Text>
      <Text style={[styles.show, { color: palette.primaryText || palette.primary }]}>Show</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  gate: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10, marginTop: 4 },
  text: { flex: 1, fontSize: 14 },
  show: { fontWeight: '700', fontSize: 13 },
});
