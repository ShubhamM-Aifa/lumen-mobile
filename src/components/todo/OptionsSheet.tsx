import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import type { IconComponent } from '../ios/InsetGroup';

export interface SheetOption {
  key: string;
  label: string;
  /** Right-hand hint such as "Thu" or "9:00 AM". */
  hint?: string;
  icon?: IconComponent;
  iconColor?: string;
  selected?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  /** Runs after the sheet has closed. */
  onPress: () => void;
  /** Wait for the close animation first: needed when this opens another modal. */
  opensModal?: boolean;
  /** Leave the sheet open after choosing (multi-select). */
  keepOpen?: boolean;
}

export interface SheetSection {
  title?: string;
  options: SheetOption[];
}

interface Props {
  visible: boolean;
  /** Called when the sheet is dismissed (backdrop, back button), and after a choice unless `onChosen` is given. */
  onClose: () => void;
  /** Called instead of `onClose` after an option is chosen: lets a flow keep going into another sheet. */
  onChosen?: () => void;
  title?: string;
  subtitle?: string;
  options?: SheetOption[];
  sections?: SheetSection[];
  children?: React.ReactNode;
}

/** Bottom menu used for every To Do choice: due date, reminder, repeat, sort, move, list actions... */
export function OptionsSheet({ visible, onClose, onChosen, title, subtitle, options, sections, children }: Props) {
  const styles = useStyles();
  const { palette } = useTheme();
  const groups: SheetSection[] = sections ?? (options ? [{ options }] : []);

  const choose = (o: SheetOption) => {
    if (o.disabled) return;
    if (o.keepOpen) {
      o.onPress();
      return;
    }
    (onChosen ?? onClose)();
    if (o.opensModal) setTimeout(o.onPress, Platform.OS === 'ios' ? 350 : 150);
    else o.onPress();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" accessibilityRole="button" />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.grabber} />
          {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" style={styles.scroll}>
            {groups.map((g, gi) => (
              <View key={gi} style={gi > 0 ? styles.groupGap : undefined}>
                {g.title ? <Text style={styles.sectionLabel}>{g.title}</Text> : null}
                {g.options.map((o, i) => {
                  const Icon = o.icon;
                  const color = o.destructive ? palette.errorText : palette.text;
                  return (
                    <TouchableOpacity
                      key={o.key}
                      style={[styles.row, i < g.options.length - 1 && styles.rowSeparator, o.disabled && { opacity: 0.4 }]}
                      onPress={() => choose(o)}
                      activeOpacity={0.6}
                      accessibilityRole="button"
                      accessibilityLabel={o.label}
                      accessibilityState={{ selected: !!o.selected, disabled: !!o.disabled }}
                    >
                      {Icon ? <Icon size={22} color={o.destructive ? palette.errorText : o.iconColor ?? palette.textSecondary} strokeWidth={1.9} /> : null}
                      <Text style={[styles.label, { color }]} numberOfLines={1}>{o.label}</Text>
                      {o.hint ? <Text style={styles.hint}>{o.hint}</Text> : null}
                      {o.selected ? <Check size={20} color={palette.primaryText} strokeWidth={2.6} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const useStyles = createThemedStyles(palette => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const), backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingBottom: 8,
    maxHeight: '82%',
  },
  scroll: { flexGrow: 0 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: palette.border, marginTop: 8, marginBottom: 10 },
  title: { ...typography.headline, color: palette.text, textAlign: 'center' },
  subtitle: { ...typography.footnote, color: palette.textSecondary, textAlign: 'center', marginTop: 2, marginBottom: 6 },
  sectionLabel: { ...typography.sectionLabel, color: palette.textSecondary, marginTop: 10, marginBottom: 4, paddingHorizontal: 4 },
  groupGap: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingHorizontal: 4 },
  rowSeparator: { borderBottomWidth: 0.5, borderBottomColor: palette.border },
  label: { ...typography.bodyLarge, flex: 1 },
  hint: { ...typography.subhead, color: palette.textSecondary },
}));
