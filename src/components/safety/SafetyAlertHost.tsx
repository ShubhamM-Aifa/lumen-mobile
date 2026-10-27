import React from 'react';
import { Modal, View, Text, TouchableOpacity, Linking } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useSafetyStore } from '../../store/safetyStore';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

/** India's single emergency number. Opens the dialer; it never calls by itself. */
const EMERGENCY_NUMBER = '112';

/**
 * Shows the first waiting "contact your doctor" notice. Plain words, one clear button; the
 * urgent kind also offers to open the phone dialer.
 */
export function SafetyAlertHost() {
  const { palette } = useTheme();
  const styles = useStyles();
  const flag = useSafetyStore(s => s.flags[0]);
  const dismiss = useSafetyStore(s => s.dismiss);
  if (!flag) return null;

  const urgent = flag.level === 'now';
  const tone = urgent ? palette.error : palette.warning;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss} accessibilityViewIsModal>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityRole="alert">
          <View style={[styles.icon, { backgroundColor: tone + '22' }]}>
            <AlertTriangle size={26} color={tone} strokeWidth={2.4} />
          </View>
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>{flag.title}</Text>
          <Text style={styles.message} maxFontSizeMultiplier={1.3}>{flag.message}</Text>
          <Text style={styles.footer} maxFontSizeMultiplier={1.3}>
            Lumen is a tracking tool and cannot tell you what is wrong. This notice comes from a fixed rule, not from your doctor.
          </Text>

          {urgent && (
            <TouchableOpacity
              style={[styles.primary, { backgroundColor: tone }]}
              onPress={() => { Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(() => {}); }}
              accessibilityRole="button"
              accessibilityLabel={`Call ${EMERGENCY_NUMBER}`}
            >
              <Text style={styles.primaryText} maxFontSizeMultiplier={1.3}>Call {EMERGENCY_NUMBER}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={urgent ? styles.secondary : [styles.primary, { backgroundColor: palette.primary }]}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="I have read this"
          >
            <Text style={urgent ? styles.secondaryText : styles.primaryText} maxFontSizeMultiplier={1.3}>I have read this</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = createThemedStyles(palette => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: palette.surface, borderRadius: 28, padding: 22, gap: 12 },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title2, color: palette.text },
  message: { ...typography.body, color: palette.text, lineHeight: 24 },
  footer: { ...typography.footnote, color: palette.textSecondary, lineHeight: 19 },
  primary: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { ...typography.bodyBold, color: '#FFFFFF' },
  secondary: { minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { ...typography.body, color: palette.primaryText },
}));
