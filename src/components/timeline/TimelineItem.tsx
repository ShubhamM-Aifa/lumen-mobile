/**
 * TimelineItem — renders a single LogEntry in the day timeline.
 * Features:
 * - Expand / Collapse toggle for smooth scanning
 * - Direct visual anatomical Body Map preview with highlighted swelling/pain locations
 * - High-res Photo Gallery with privacy blur and fullscreen zoom
 * - Bristol stool type and severity scale visual formatting
 * - Dedicated Edit action and Delete action
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Trash2, Pencil, ChevronDown, ChevronUp, Clock, FileText, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ILogEntry, ICategory, IOption, IQuestion, IQuickAction, FieldValue, Answer } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { BodyMapPreview } from './BodyMapPreview';
import { LogPhotoGallery } from './LogPhotoGallery';
import { IconTile } from '../ios/InsetGroup';

interface Props {
  entry: ILogEntry;
  category?: ICategory;
  question?: IQuestion;
  options: IOption[];
  allQuestions?: IQuestion[];
  allOptions?: IOption[];
  quickAction?: IQuickAction;
  onPress?: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  defaultExpanded?: boolean;
  forceExpanded?: boolean | null;
}

const SOURCE_LABEL: Record<string, string> = {
  quick_action: 'Quick tap',
  questionnaire: 'Log',
  check_in: 'Check-in',
  reminder: 'Reminder',
  activity: 'Activity',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

function formatStoolType(val: unknown): string | null {
  const num = Number(val);
  if (isNaN(num) || num < 1 || num > 7) return null;
  const desc: Record<number, string> = {
    1: 'Type 1 (Hard lumps)',
    2: 'Type 2 (Lumpy sausage)',
    3: 'Type 3 (Sausage with cracks)',
    4: 'Type 4 (Smooth & soft)',
    5: 'Type 5 (Soft blobs)',
    6: 'Type 6 (Mushy / fluffy)',
    7: 'Type 7 (Liquid / watery)',
  };
  return desc[num] || `Type ${num}`;
}

type Tone = 'success' | 'warning' | 'error';

function formatSeverity(val: unknown): { label: string; tone?: Tone } {
  const num = Number(val);
  if (isNaN(num)) return { label: `${val}` };
  if (num <= 3) return { label: `${num}/10 Mild`, tone: 'success' };
  if (num <= 6) return { label: `${num}/10 Mod`, tone: 'warning' };
  return { label: `${num}/10 Severe`, tone: 'error' };
}

function getOptionValueSummary(ans: Answer): { label: string; tone?: Tone }[] {
  if (!ans.values || ans.values.length === 0) return [];
  const items: { label: string; tone?: Tone }[] = [];

  for (const v of ans.values) {
    if (v.dataType === 'location' || v.dataType === 'image') continue;
    if (v.dataType === 'range') {
      const sev = formatSeverity(v.value);
      items.push({ label: sev.label, tone: sev.tone });
    } else if (
      v.fieldKey.toLowerCase().includes('type') ||
      v.fieldKey.toLowerCase().includes('bristol') ||
      v.fieldKey.toLowerCase().includes('stool')
    ) {
      const stool = formatStoolType(v.value);
      if (stool) items.push({ label: stool });
    } else if (v.dataType === 'temperature') {
      items.push({ label: `${Number(v.value).toFixed(1)} °C` });
    } else if (v.dataType === 'duration') {
      const s = Number(v.value);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      items.push({ label: h > 0 ? `${h}h ${m}m` : `${m}m` });
    } else if (v.value !== undefined && v.value !== null && v.value !== '') {
      const valStr = String(v.value);
      const unitStr = v.unit ? ` ${v.unit}` : '';
      items.push({ label: `${valStr}${unitStr}` });
    }
  }

  return items;
}

export function TimelineItem({
  entry,
  category,
  question,
  options,
  allQuestions,
  allOptions,
  quickAction,
  onPress,
  onEdit,
  onDelete,
  defaultExpanded = false,
  forceExpanded,
}: Props) {
  const { palette } = useTheme();
  const styles = useStyles();

  const isQuickAction = entry.source === 'quick_action' || !!entry.quickActionId;
  const title = isQuickAction
    ? quickAction?.label ?? 'Quick Tap'
    : category?.name ?? 'Log';
  const icon = isQuickAction
    ? quickAction?.icon ?? '⚡'
    : category?.icon ?? null;
  const accentColor = isQuickAction
    ? quickAction?.color ?? palette.primary
    : category?.color ?? palette.primary;

  const quickValueText =
    quickAction?.defaultValue != null
      ? `+${quickAction.defaultValue}${quickAction.unit ? ' ' + quickAction.unit : ''}`
      : null;

  const lookupOptions = allOptions && allOptions.length > 0 ? allOptions : options;
  const lookupQuestions =
    allQuestions && allQuestions.length > 0 ? allQuestions : question ? [question] : [];

  // Group answers by question
  const questionGroups = React.useMemo(() => {
    if (!entry.answers || entry.answers.length === 0) return [];

    const groupsMap = new Map<
      string,
      { questionId?: string; questionTitle: string; answers: Answer[] }
    >();

    for (const ans of entry.answers) {
      const opt = lookupOptions.find((o) => o._id === ans.optionId);
      const qId = opt?.questionId || entry.questionId || 'default';
      const qObj =
        lookupQuestions.find((q) => q._id === qId) ||
        (qId === entry.questionId ? question : undefined);
      const qTitle = qObj?.title || '';

      if (!groupsMap.has(qId)) {
        groupsMap.set(qId, {
          questionId: qId !== 'default' ? qId : undefined,
          questionTitle: qTitle,
          answers: [],
        });
      }
      groupsMap.get(qId)!.answers.push(ans);
    }

    return Array.from(groupsMap.values());
  }, [entry.answers, entry.questionId, lookupOptions, lookupQuestions, question]);

  // Extract all media and location fields across all answers
  const allFieldValues: { answerLabel: string; field: FieldValue }[] = [];
  entry.answers?.forEach((ans) => {
    const opt = lookupOptions.find((o) => o._id === ans.optionId);
    const label = ans.optionLabelSnapshot ?? opt?.label ?? 'Item';
    ans.values?.forEach((f) => {
      allFieldValues.push({ answerLabel: label, field: f });
    });
  });

  const locationFields = allFieldValues.filter((f) => f.field.dataType === 'location');
  const imageFields = allFieldValues.filter((f) => f.field.dataType === 'image');
  const standardFields = allFieldValues.filter(
    (f) => f.field.dataType !== 'location' && f.field.dataType !== 'image'
  );

  const hasDetails =
    locationFields.length > 0 ||
    imageFields.length > 0 ||
    standardFields.length > 0 ||
    Boolean(entry.note) ||
    Boolean(entry.location);

  const locationLabel = entry.location
    ? entry.location.city && entry.location.region
      ? `${entry.location.city}, ${entry.location.region}`
      : entry.location.name || entry.location.city || entry.location.formattedAddress || 'Location Tagged'
    : null;

  // Expand / collapse state
  const [localExpanded, setLocalExpanded] = useState<boolean | null>(null);

  // Sync when parent changes forceExpanded
  useEffect(() => {
    if (forceExpanded !== undefined && forceExpanded !== null) {
      setLocalExpanded(forceExpanded);
    }
  }, [forceExpanded]);

  const isExpanded = localExpanded ?? defaultExpanded;

  const toggleExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalExpanded(!isExpanded);
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Log Entry',
      `Are you sure you want to remove this "${title}" log?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onDelete?.(entry._id);
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEdit?.(entry._id);
  };

  // Calculate counts for collapsed summary badges
  const totalAreasCount = locationFields.reduce((sum, f) => {
    const v = f.field.value;
    if (Array.isArray(v)) return sum + v.length;
    if (typeof v === 'string') return sum + v.split(',').length;
    return sum + 1;
  }, 0);

  const totalPhotosCount = imageFields.reduce((sum, f) => {
    const v = f.field.value;
    if (Array.isArray(v)) return sum + v.length;
    return sum + 1;
  }, 0);

  const toneColor = (tone?: Tone): string | undefined => {
    if (tone === 'success') return palette.successText;
    if (tone === 'warning') return palette.warningText;
    if (tone === 'error') return palette.errorText;
    return undefined;
  };

  // One-line-per-answer summary shown under the title, e.g. "Joint pain 6/10 Mod, Fatigue"
  const answerParts = isQuickAction
    ? []
    : (entry.answers ?? []).map((ans) => {
        const opt = lookupOptions.find((o) => o._id === ans.optionId);
        const label =
          ans.optionLabelSnapshot ??
          opt?.label ??
          (ans.optionId === '__other__' ? ans.otherText : 'Option');
        return { label: label ?? 'Option', values: getOptionValueSummary(ans) };
      });

  const extras = [
    locationFields.length > 0 ? `${totalAreasCount} area${totalAreasCount === 1 ? '' : 's'}` : null,
    imageFields.length > 0 ? `${totalPhotosCount} photo${totalPhotosCount === 1 ? '' : 's'}` : null,
    entry.note ? 'Note' : null,
    locationLabel,
    standardFields.length > 0 ? `${standardFields.length} metric${standardFields.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean) as string[];

  const sourceLabel = SOURCE_LABEL[entry.source] ?? entry.source;
  const timeText = formatTime(entry.occurredAt);
  const plainSummary = isQuickAction
    ? [quickValueText, sourceLabel].filter(Boolean).join(' · ')
    : answerParts.map((p) => [p.label, ...p.values.map((v) => v.label)].join(' ')).join(', ') || sourceLabel;

  return (
    <View>
      <TouchableOpacity
        style={styles.row}
        onPress={() => { toggleExpand(); onPress?.(); }}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={`${title}, ${plainSummary}, ${timeText}`}
        accessibilityHint={isExpanded ? 'Collapse details' : 'Show details, edit or delete'}
      >
        <IconTile emoji={icon ?? '📝'} color={accentColor} />
        <View style={styles.rowBody}>
          <View style={styles.rowMain}>
            <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={1.4}>{title}</Text>
            {isQuickAction ? (
              <Text style={styles.sub} maxFontSizeMultiplier={1.4}>
                {quickValueText ? <Text style={styles.subStrong}>{quickValueText} · </Text> : null}
                {sourceLabel}
              </Text>
            ) : answerParts.length > 0 ? (
              <Text style={styles.sub} numberOfLines={isExpanded ? undefined : 3} maxFontSizeMultiplier={1.4}>
                {answerParts.map((p, i) => (
                  <Text key={i}>
                    {i > 0 ? ', ' : ''}
                    <Text style={styles.subStrong}>{p.label}</Text>
                    {p.values.map((v, vi) => (
                      <Text key={vi} style={{ color: toneColor(v.tone) }}> {v.label}</Text>
                    ))}
                  </Text>
                ))}
              </Text>
            ) : (
              <Text style={styles.sub} maxFontSizeMultiplier={1.4}>{sourceLabel}</Text>
            )}
            {extras.length > 0 && !isExpanded ? (
              <Text style={styles.extras} numberOfLines={1} maxFontSizeMultiplier={1.4}>{extras.join(' · ')}</Text>
            ) : null}
          </View>
          <Text style={styles.time} maxFontSizeMultiplier={1.4}>{timeText}</Text>
          {isExpanded ? (
            <ChevronUp size={16} color={palette.textSecondary} />
          ) : (
            <ChevronDown size={16} color={palette.textSecondary} />
          )}
        </View>
      </TouchableOpacity>

      {isExpanded ? (
        <View style={styles.details}>
          {/* Anatomical body map previews for swelling / pain / symptoms */}
          {locationFields.map((loc, idx) => (
            <BodyMapPreview
              key={`loc-preview-${idx}`}
              selectedKeys={loc.field.value as string[] | string}
              fieldLabel={`${loc.answerLabel} • ${loc.field.fieldKey}`}
            />
          ))}

          {/* Photo gallery (privacy blur) */}
          {imageFields.map((img, idx) => (
            <LogPhotoGallery
              key={`img-gallery-${idx}`}
              uris={img.field.value as string[] | string}
              isSensitive={true}
              fieldLabel={`${img.answerLabel} • Photo`}
            />
          ))}

          {/* Standard text/numeric fields (e.g. duration, temperature) */}
          {standardFields.length > 0 && (
            <View style={styles.standardFieldsList}>
              {standardFields.map((f, idx) => {
                let displayVal = String(f.field.value);
                if (f.field.dataType === 'temperature') {
                  displayVal = `${Number(f.field.value).toFixed(1)} °C`;
                } else if (f.field.dataType === 'duration') {
                  const s = Number(f.field.value);
                  const h = Math.floor(s / 3600);
                  const m = Math.floor((s % 3600) / 60);
                  displayVal = h > 0 ? `${h}h ${m}m` : `${m}m`;
                } else if (f.field.unit) {
                  displayVal = `${displayVal} ${f.field.unit}`;
                }

                return (
                  <View key={`std-${idx}`} style={styles.fieldLine}>
                    <Text style={styles.fieldKey}>{f.answerLabel} • {f.field.fieldKey}</Text>
                    <Text style={styles.fieldVal}>{displayVal}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {entry.location ? (
            <View style={styles.infoBox}>
              <MapPin size={14} color={palette.primaryText} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>{entry.location.formattedAddress || locationLabel}</Text>
                <Text style={styles.infoSub}>
                  {entry.location.latitude.toFixed(4)}°, {entry.location.longitude.toFixed(4)}°
                  {entry.location.accuracy ? ` • ±${Math.round(entry.location.accuracy)}m` : ''}
                </Text>
              </View>
            </View>
          ) : null}

          {entry.note ? (
            <View style={styles.infoBox}>
              <FileText size={14} color={palette.textSecondary} style={{ marginTop: 2 }} />
              <Text style={styles.noteText}>{entry.note}</Text>
            </View>
          ) : null}

          {onEdit || onDelete ? (
            <View style={styles.actions}>
              {onEdit ? (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: palette.tint + '1F' }]}
                  onPress={handleEdit}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Edit log entry"
                >
                  <Pencil size={15} color={palette.primaryText} strokeWidth={2.2} />
                  <Text style={[styles.actionText, { color: palette.primaryText }]}>Edit</Text>
                </TouchableOpacity>
              ) : null}
              {onDelete ? (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: palette.error + '1F' }]}
                  onPress={handleDelete}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Delete log entry"
                >
                  <Trash2 size={15} color={palette.errorText} strokeWidth={2.2} />
                  <Text style={[styles.actionText, { color: palette.errorText }]}>Delete</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Row of an hour group. The hour card (see DayView) supplies the white rounded
 * surface and hairline separators, so a row draws no card of its own.
 */
const useStyles = createThemedStyles((palette) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, minHeight: 52 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingRight: 16, paddingVertical: 10 },
  rowMain: { flex: 1, gap: 2 },
  title: { ...typography.bodyLarge, color: palette.text },
  sub: { ...typography.footnote, color: palette.textSecondary, lineHeight: 19 },
  subStrong: { color: palette.text, fontWeight: '500' },
  extras: { ...typography.footnote, color: palette.textSecondary },
  time: { ...typography.subhead, color: palette.textSecondary, fontVariant: ['tabular-nums'] },

  details: { paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  standardFieldsList: { gap: 4 },
  fieldLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  fieldKey: { ...typography.footnote, color: palette.textSecondary, flexShrink: 1 },
  fieldVal: { ...typography.footnote, color: palette.text, fontWeight: '600' },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: palette.surfaceAlt,
  },
  infoTitle: { ...typography.footnote, color: palette.text, fontWeight: '600' },
  infoSub: { ...typography.footnote, color: palette.textSecondary, marginTop: 2 },
  noteText: { ...typography.footnote, color: palette.textSecondary, flex: 1, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 10 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
  },
  actionText: { ...typography.subheadBold },
}));
