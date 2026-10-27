/**
 * OptionSelector — renders the options for a question.
 * Handles single/multi-select, per-option field expansion,
 * comment inputs and the "Other" free-text option.
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { IOption, Answer, FieldValue } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { DynamicField } from './fields/DynamicField';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  options: IOption[];
  selectionType: 'single' | 'multiple';
  allowOther: boolean;
  answers: Answer[];
  onChange: (answers: Answer[]) => void;
  tempPrefUnit?: 'C' | 'F';
}

function findAnswer(answers: Answer[], optionId: string): Answer | undefined {
  return answers.find(a => a.optionId === optionId);
}

function upsertAnswer(answers: Answer[], next: Answer): Answer[] {
  const idx = answers.findIndex(a => a.optionId === next.optionId);
  if (idx === -1) return [...answers, next];
  const copy = [...answers];
  copy[idx] = next;
  return copy;
}

function removeAnswer(answers: Answer[], optionId: string): Answer[] {
  return answers.filter(a => a.optionId !== optionId);
}

export function OptionSelector({
  options,
  selectionType,
  allowOther,
  answers,
  onChange,
  tempPrefUnit = 'C',
}: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const [otherText, setOtherText] = useState(
    answers.find(a => a.optionId === '__other__')?.otherText ?? ''
  );

  const isSelected = (optionId: string) =>
    answers.some(a => a.optionId === optionId);

  const toggle = (option: IOption) => {
    if (LayoutAnimation?.configureNext && LayoutAnimation?.Presets?.easeInEaseOut) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    const alreadySelected = isSelected(option._id);

    if (alreadySelected) {
      onChange(removeAnswer(answers, option._id));
    } else {
      if (selectionType === 'single') {
        // Deselect all others (including __other__), select this one
        const existing = findAnswer(answers, option._id);
        onChange([existing ?? {
          optionId: option._id,
          optionLabelSnapshot: option.label,
          values: [],
        }]);
      } else {
        onChange(upsertAnswer(answers, {
          optionId: option._id,
          optionLabelSnapshot: option.label,
          values: [],
        }));
      }
    }
  };

  const updateFieldValue = (
    optionId: string,
    optionLabel: string,
    fieldKey: string,
    partial: Pick<FieldValue, 'value' | 'unit'>,
    dataType: string,
  ) => {
    const existing = findAnswer(answers, optionId) ?? {
      optionId,
      optionLabelSnapshot: optionLabel,
      values: [],
    };
    const prevValues = existing.values.filter(fv => fv.fieldKey !== fieldKey);
    const updated: Answer = {
      ...existing,
      values: [...prevValues, { fieldKey, dataType: dataType as never, ...partial }],
    };
    onChange(upsertAnswer(answers, updated));
  };

  const updateComment = (optionId: string, optionLabel: string, comment: string) => {
    const existing = findAnswer(answers, optionId) ?? {
      optionId,
      optionLabelSnapshot: optionLabel,
      values: [],
    };
    onChange(upsertAnswer(answers, { ...existing, comment }));
  };

  const handleOther = (text: string) => {
    setOtherText(text);
    if (text.trim()) {
      const existing = findAnswer(answers, '__other__') ?? {
        optionId: '__other__',
        optionLabelSnapshot: 'Other',
        values: [],
      };
      onChange(upsertAnswer(answers, { ...existing, otherText: text }));
    } else {
      onChange(removeAnswer(answers, '__other__'));
    }
  };

  return (
    <View style={styles.wrapper}>
      {options.map((option, index) => {
        const selected = isSelected(option._id);
        const answer = findAnswer(answers, option._id);
        const accentColor = option.color ?? palette.tint;
        const isLastRow = index === options.length - 1 && !allowOther;
        const hasFields = option.fields && option.fields.length > 0;

        return (
          <View key={option._id} style={!isLastRow ? styles.separated : undefined}>
            {/* Option row */}
            <TouchableOpacity
              style={styles.option}
              onPress={() => toggle(option)}
              accessibilityRole="checkbox"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected }}
            >
              <View style={[styles.checkbox, selected && { backgroundColor: accentColor, borderColor: accentColor }]}>
                {selected && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.optionLeft}>
                {option.icon ? (
                  <Text style={styles.optionIcon}>{option.icon}</Text>
                ) : (
                  <View style={[styles.optionColorDot, { backgroundColor: accentColor }]} />
                )}
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]} maxFontSizeMultiplier={1.4}>
                  {option.label}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Expanded fields when selected */}
            {selected && (hasFields || option.allowComment) && (
              <View style={styles.expandedArea}>
                {/* Field definitions */}
                {hasFields && option.fields.map((field) => {
                  const fv = answer?.values.find(fv => fv.fieldKey === field.key);
                  return (
                    <DynamicField
                      key={field.key}
                      field={field}
                      fieldValue={fv}
                      onChange={(partial) =>
                        updateFieldValue(option._id, option.label, field.key, partial, field.dataType)
                      }
                      tempPrefUnit={tempPrefUnit}
                    />
                  );
                })}

                {/* Comment input */}
                {option.allowComment && (
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Add a comment…"
                    placeholderTextColor={palette.placeholder}
                    value={answer?.comment ?? ''}
                    onChangeText={(t) => updateComment(option._id, option.label, t)}
                    multiline
                    maxLength={500}
                    accessibilityLabel={`Comment for ${option.label}`}
                  />
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Other free-text */}
      {allowOther && (
        <View style={styles.otherWrapper}>
          <TextInput
            style={styles.otherInput}
            placeholder="Other (type your own)…"
            placeholderTextColor={palette.placeholder}
            value={otherText}
            onChangeText={handleOther}
            returnKeyType="done"
            accessibilityLabel="Other option"
          />
        </View>
      )}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  wrapper: {},
  separated: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
    minHeight: 52,
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  optionIcon: { fontSize: 20 },
  optionColorDot: { width: 10, height: 10, borderRadius: 5 },
  optionLabel: { ...typography.bodyLarge, color: palette.text, flex: 1 },
  optionLabelSelected: { fontWeight: '600' },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: palette.textSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  checkmark: { fontSize: 14, color: '#FFFFFF', fontWeight: '700', lineHeight: 16 },
  expandedArea: {
    paddingLeft: 36,
    paddingBottom: 14,
    gap: 14,
  },
  commentInput: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    ...typography.body, color: palette.text,
    minHeight: 60, textAlignVertical: 'top',
  },
  otherWrapper: {
    marginTop: 8,
    backgroundColor: palette.surfaceAlt,
    borderRadius: 14, overflow: 'hidden',
  },
  otherInput: {
    paddingHorizontal: 16, paddingVertical: 14,
    ...typography.bodyLarge, color: palette.text,
    minHeight: 48,
  },
}));
