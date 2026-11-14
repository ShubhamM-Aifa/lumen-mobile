import React, { useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Sun, Trash2 } from 'lucide-react-native';
import { createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  children: React.ReactNode;
  inMyDay: boolean;
  disabled?: boolean;
  onToggleMyDay: () => void;
  onDelete: () => void;
}

/**
 * Swipe right to reveal "My Day", swipe left to reveal "Delete" (Microsoft To Do's gestures).
 * The revealed buttons are tapped, which behaves the same on every platform.
 */
export function SwipeableTaskRow({ children, inMyDay, disabled, onToggleMyDay, onDelete }: Props) {
  const styles = useStyles();
  const ref = useRef<SwipeableMethods>(null);

  if (disabled) return <>{children}</>;

  const run = (fn: () => void) => () => {
    ref.current?.close();
    fn();
  };

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={40}
      rightThreshold={40}
      containerStyle={styles.container}
      renderLeftActions={() => (
        <TouchableOpacity
          style={[styles.action, styles.myDay]}
          onPress={run(onToggleMyDay)}
          accessibilityRole="button"
          accessibilityLabel={inMyDay ? 'Remove from My Day' : 'Add to My Day'}
        >
          <Sun size={22} color="#FFFFFF" />
          <Text style={styles.actionText}>{inMyDay ? 'Remove' : 'My Day'}</Text>
        </TouchableOpacity>
      )}
      renderRightActions={() => (
        <TouchableOpacity style={[styles.action, styles.delete]} onPress={run(onDelete)} accessibilityRole="button" accessibilityLabel="Delete task">
          <Trash2 size={22} color="#FFFFFF" />
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      )}
    >
      <View>{children}</View>
    </ReanimatedSwipeable>
  );
}

const useStyles = createThemedStyles(() => ({
  container: { borderRadius: 16, overflow: 'hidden' },
  action: { width: 84, alignItems: 'center', justifyContent: 'center', gap: 3 },
  myDay: { backgroundColor: '#0066CC' },
  delete: { backgroundColor: '#D70015' },
  actionText: { ...typography.footnote, fontWeight: '600', color: '#FFFFFF' },
}));
