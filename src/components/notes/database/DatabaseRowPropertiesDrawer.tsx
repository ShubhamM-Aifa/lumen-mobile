import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  AlertButton,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Check,
  Tag,
  Hash,
  Calendar,
  Link,
  AlignLeft,
  List,
  ChevronDown,
} from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../../theme/ThemeContext';
import {
  IDatabaseProperty,
  IDatabasePropertyOption,
} from '../../../shared/types';

interface DatabaseRowPropertiesDrawerProps {
  properties: IDatabaseProperty[];
  rowProps: Record<string, any>;
  onUpdateProp: (propId: string, value: any) => void;
}

export const DatabaseRowPropertiesDrawer: React.FC<DatabaseRowPropertiesDrawerProps> = ({
  properties,
  rowProps,
  onUpdateProp,
}) => {
  const { palette } = useTheme();
  const styles = useStyles();

  const [activeSelectProp, setActiveSelectProp] = useState<IDatabaseProperty | null>(null);

  if (!properties || properties.length === 0) return null;

  const handleSelectOption = (prop: IDatabaseProperty) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const buttons: AlertButton[] = [
      ...(prop.options || []).map((opt) => ({
        text: opt.name,
        onPress: () => onUpdateProp(prop.id, opt.id),
      })),
      {
        text: 'Clear Value',
        style: 'destructive' as const,
        onPress: () => onUpdateProp(prop.id, null),
      },
      { text: 'Cancel', style: 'cancel' as const },
    ];
    Alert.alert(`Select ${prop.name}`, 'Choose an option:', buttons);
  };

  return (
    <View style={[styles.container, { borderBottomColor: palette.border }]}>
      {properties.map((prop) => {
        const val = rowProps?.[prop.id];

        return (
          <View key={prop.id} style={styles.propRow}>
            {/* Property Label */}
            <View style={styles.propLabelCol}>
              <Text style={[styles.propLabel, { color: palette.textSecondary }]}>
                {prop.name}
              </Text>
            </View>

            {/* Property Value Cell */}
            <View style={styles.propValueCol}>
              {prop.type === 'checkbox' ? (
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    val && { backgroundColor: palette.primary, borderColor: palette.primary },
                  ]}
                  onPress={() => onUpdateProp(prop.id, !val)}
                >
                  {val && <Check size={12} color="#FFFFFF" />}
                </TouchableOpacity>
              ) : prop.type === 'select' ? (
                (() => {
                  const opt = (prop.options || []).find((o) => o.id === val || o.name === val);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.selectPill,
                        opt
                          ? { backgroundColor: (opt.color || palette.primary) + '25' }
                          : { backgroundColor: palette.surfaceAlt },
                      ]}
                      onPress={() => handleSelectOption(prop)}
                    >
                      <Text
                        style={[
                          styles.selectPillText,
                          { color: opt?.color || palette.textSecondary },
                        ]}
                      >
                        {opt ? opt.name : 'Empty'}
                      </Text>
                      <ChevronDown size={12} color={opt?.color || palette.textSecondary} />
                    </TouchableOpacity>
                  );
                })()
              ) : (
                <TextInput
                  style={[styles.input, { color: palette.text }]}
                  value={val !== undefined && val !== null ? String(val) : ''}
                  placeholder="Empty"
                  placeholderTextColor={palette.placeholder}
                  keyboardType={prop.type === 'number' ? 'numeric' : 'default'}
                  onChangeText={(txt) => {
                    const parsed = prop.type === 'number' ? (txt ? Number(txt) : null) : txt;
                    onUpdateProp(prop.id, parsed);
                  }}
                />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const useStyles = createThemedStyles((palette) => ({
  container: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  propRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  propLabelCol: {
    width: 110,
  },
  propLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  propValueCol: {
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  selectPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    fontSize: 13,
    padding: 0,
    height: 28,
  },
}));
