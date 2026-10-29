/**
 * Question Editor Screen — Apple InsetGroup style
 * Route: /customize/question/new?categoryId=X
 *        /customize/question/:id?categoryId=X
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { IQuestion, QuestionFrequency, SelectionType } from '@lumen/shared';
import { useConfigStore } from '../../../src/store/configStore';
import { api } from '../../../src/api/client';
import { useTheme, createThemedStyles } from '../../../src/theme/ThemeContext';
import { typography } from '../../../src/theme/typography';
import { ScreenTopBar, HeaderTextButton } from '../../../src/components/ios/ScreenTopBar';
import { InsetGroup, GroupedRow } from '../../../src/components/ios/InsetGroup';
import { IosSegmented } from '../../../src/components/ios/IosSegmented';
import { IconPicker } from '../../../src/components/customize/IconPicker';
import { safeGoBack } from '../../../src/utils/navigation';

const FREQ_OPTIONS: Array<{ value: QuestionFrequency; label: string }> = [
  { value: 'anytime', label: 'Any time' },
  { value: 'once_per_day', label: 'Once per day' },
  { value: 'morning', label: 'Morning only' },
  { value: 'evening', label: 'Evening only' },
];

export default function QuestionEditorScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { id, categoryId } = useLocalSearchParams<{ id: string; categoryId: string }>();
  const isNew = id === 'new';
  const { config, invalidate, fetchConfig } = useConfigStore();

  const existing: IQuestion | undefined = isNew
    ? undefined
    : config?.questions.find((q) => q._id === id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [helpText, setHelpText] = useState(existing?.helpText ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '');
  const [selType, setSelType] = useState<SelectionType>(existing?.selectionType ?? 'single');
  const [allowOther, setAllowOther] = useState(existing?.allowOther ?? false);
  const [required, setRequired] = useState(existing?.required ?? false);
  const [frequency, setFrequency] = useState<QuestionFrequency>(existing?.frequency ?? 'anytime');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setHelpText(existing.helpText ?? '');
      setIcon(existing.icon ?? '');
      setSelType(existing.selectionType);
      setAllowOther(existing.allowOther);
      setRequired(existing.required);
      setFrequency(existing.frequency);
    }
  }, [existing?._id]);

  const catId = categoryId ?? existing?.categoryId ?? '';
  const optionsCount = isNew
    ? 0
    : (config?.options ?? []).filter((o) => o.questionId === id && o.isActive).length;

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a question title.');
      return;
    }
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const body = {
        categoryId: catId,
        title: title.trim(),
        helpText: helpText.trim() || undefined,
        icon: icon || undefined,
        selectionType: selType,
        allowOther,
        required,
        frequency,
      };

      if (isNew) {
        await api.post('/questions', body);
      } else {
        await api.patch(`/questions/${id}`, body);
      }
      invalidate();
      await fetchConfig();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      safeGoBack(`/customize/questions/${catId}`);
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Unable to save question.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = () => {
    if (!existing) return;
    Alert.alert(`Archive "${existing.title}"?`, 'Existing logs are preserved. You can restore it later at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await api.post(`/questions/${existing._id}/archive`, {});
          invalidate();
          await fetchConfig();
          safeGoBack(`/customize/questions/${catId}`);
        },
      },
    ]);
  };

  const handlePermanentDelete = () => {
    if (!existing) return;
    Alert.alert(
      `Delete "${existing.title}"?`,
      'This action cannot be undone. Questions with logged tracking history cannot be permanently deleted and should be kept archived instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              const res: any = await api.delete(`/questions/${existing._id}`);
              invalidate();
              await fetchConfig();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Deleted', res?.message || `Question "${existing.title}" deleted.`);
              safeGoBack(`/customize/questions/${catId}`);
            } catch (err: any) {
              const msg = err?.message || 'Could not delete question.';
              Alert.alert(
                'Cannot Delete Question',
                msg,
                existing.isActive
                  ? [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Archive Instead',
                        onPress: handleArchive,
                      },
                    ]
                  : [{ text: 'OK' }],
              );
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenTopBar
        title={isNew ? 'New Question' : 'Edit Question'}
        backLabel="Cancel"
        onBack={() => safeGoBack(`/customize/questions/${catId}`)}
        fallbackRoute={`/customize/questions/${catId}`}
        right={
          <HeaderTextButton
            label="Save"
            prominent
            onPress={handleSave}
            loading={saving}
            disabled={saving}
          />
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Question Title & Help Text InsetGroup */}
          <InsetGroup>
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Question Title</Text>
              <TextInput
                style={[styles.fieldInput, { color: palette.text }]}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. What symptoms are you experiencing?"
                placeholderTextColor={palette.placeholder}
                autoFocus={isNew}
              />
            </View>

            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Help Text</Text>
              <TextInput
                style={[styles.fieldInput, { color: palette.text }]}
                value={helpText}
                onChangeText={setHelpText}
                placeholder="e.g. Select all that apply right now"
                placeholderTextColor={palette.placeholder}
              />
            </View>

            <View style={styles.iconRow}>
              <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Icon (optional)</Text>
              <IconPicker value={icon} onChange={setIcon} />
            </View>
          </InsetGroup>

          {/* Selection Type Segmented InsetGroup */}
          <InsetGroup title="Selection type">
            <View style={styles.segWrap}>
              <IosSegmented
                options={[
                  { key: 'single', label: 'Single select' },
                  { key: 'multiple', label: 'Multi select' },
                ]}
                value={selType}
                onChange={(val) => {
                  Haptics.selectionAsync();
                  setSelType(val);
                }}
              />
            </View>
          </InsetGroup>

          {/* Frequency InsetGroup */}
          <InsetGroup title="Frequency">
            {FREQ_OPTIONS.map((f) => {
              const isSelected = frequency === f.value;
              return (
                <GroupedRow
                  key={f.value}
                  label={f.label}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setFrequency(f.value);
                  }}
                  trailing={isSelected ? <Check size={18} color={palette.primary} strokeWidth={2.5} /> : null}
                />
              );
            })}
          </InsetGroup>

          {/* Rules & Flags InsetGroup */}
          <InsetGroup title="Rules">
            <GroupedRow
              label="Required"
              sub="Users must answer this before submitting log"
              toggle
              toggled={required}
              onToggle={setRequired}
            />
            <GroupedRow
              label="Allow 'Other' answer"
              sub="Shows a free-text box for unlisted options"
              toggle
              toggled={allowOther}
              onToggle={setAllowOther}
            />
          </InsetGroup>

          {/* Link to Options List */}
          {!isNew && (
            <InsetGroup title="Options">
              <GroupedRow
                label="Options"
                value={`${optionsCount} choices`}
                chevron
                onPress={() => router.push(`/customize/options/${id}`)}
              />
            </InsetGroup>
          )}

          {/* Archive & Delete Actions */}
          {!isNew && (
            <InsetGroup footer="Archiving hides this question from daily logging while preserving existing data. Permanent delete completely removes the question and its choices.">
              <GroupedRow
                label="Archive this question"
                sub="Keep past logs, but hide from tracking"
                destructive
                onPress={handleArchive}
              />
              <GroupedRow
                label="Delete this question"
                sub="Permanently remove question and choices"
                destructive
                onPress={handlePermanentDelete}
              />
            </InsetGroup>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((palette) => ({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    paddingTop: 12,
    paddingBottom: 40,
    gap: 16,
  },
  fieldRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  fieldLabel: {
    ...typography.caption1,
    fontWeight: '500',
  },
  fieldInput: {
    ...typography.bodyLarge,
    fontSize: 17,
    padding: 0,
  },
  iconRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  segWrap: {
    paddingVertical: 10,
  },
}));
