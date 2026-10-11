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
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Trash2, Pencil, ChevronDown, ChevronUp, Clock, FileText, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ILogEntry, ICategory, IOption, IQuestion, IQuickAction, FieldValue } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { BodyMapPreview } from './BodyMapPreview';
import { LogPhotoGallery } from './LogPhotoGallery';

interface Props {
  entry: ILogEntry;
  category?: ICategory;
  question?: IQuestion;
  options: IOption[];
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

function formatSeverity(val: unknown): { label: string; color: string } {
  const num = Number(val);
  if (isNaN(num)) return { label: `${val}`, color: '#888' };
  if (num <= 3) return { label: `${num}/10 Mild`, color: '#10B981' };
  if (num <= 6) return { label: `${num}/10 Mod`, color: '#F59E0B' };
  return { label: `${num}/10 Severe`, color: '#EF4444' };
}

export function TimelineItem({
  entry,
  category,
  question,
  options,
  quickAction,
  onPress,
  onEdit,
  onDelete,
  defaultExpanded = false,
  forceExpanded,
}: Props) {
  const { palette, colorScheme } = useTheme();
  const styles = useStyles();
  const isDark = colorScheme === 'dark';

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

  // Extract all media and location fields across all answers
  const allFieldValues: { answerLabel: string; field: FieldValue }[] = [];
  entry.answers?.forEach((ans) => {
    const opt = options.find((o) => o._id === ans.optionId);
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

  return (
    <View style={styles.card}>
      {/* Category accent colour strip */}
      <View style={[styles.strip, { backgroundColor: accentColor }]} />

      <View style={styles.body}>
        {/* Top Header Row */}
        <TouchableOpacity
          style={styles.topRow}
          onPress={hasDetails ? toggleExpand : onPress}
          activeOpacity={hasDetails ? 0.75 : 1}
        >
          <View style={styles.titleRow}>
            {icon ? <Text style={styles.catIcon}>{icon}</Text> : null}
            <Text style={styles.catName} numberOfLines={1}>
              {title}
            </Text>
            {question && (
              <Text style={styles.qTitle} numberOfLines={1}>
                {question.title}
              </Text>
            )}
          </View>

          <View style={styles.metaRow}>
            <View style={styles.timeBadgeRow}>
              <Text style={styles.time}>{formatTime(entry.occurredAt)}</Text>
              <Text
                style={[
                  styles.sourceBadge,
                  {
                    borderColor: accentColor + '44',
                    color: accentColor,
                    backgroundColor: accentColor + '12',
                  },
                ]}
              >
                {SOURCE_LABEL[entry.source] ?? entry.source}
              </Text>
              {locationLabel && (
                <View style={styles.locationPill}>
                  <MapPin size={9} color={palette.textSecondary} />
                  <Text style={styles.locationPillText} numberOfLines={1}>
                    {locationLabel}
                  </Text>
                </View>
              )}
            </View>

            {/* Expand / Collapse Chevron Button */}
            {hasDetails && (
              <TouchableOpacity
                style={styles.chevronBtn}
                onPress={toggleExpand}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={isExpanded ? 'Collapse entry' : 'Expand entry'}
              >
                {isExpanded ? (
                  <ChevronUp size={16} color={palette.textSecondary} />
                ) : (
                  <ChevronDown size={16} color={palette.textSecondary} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        {/* Quick action value pill */}
        {isQuickAction && quickValueText && (
          <View style={styles.chips}>
            <View
              style={[
                styles.chip,
                { borderColor: accentColor + '55', backgroundColor: accentColor + '14' },
              ]}
            >
              <Text style={[styles.chipText, { color: accentColor, fontWeight: '700' }]}>
                {quickValueText}
              </Text>
            </View>
          </View>
        )}

        {/* Option Chips with Key Value Highlights */}
        {entry.answers && entry.answers.length > 0 && (
          <View style={styles.chips}>
            {entry.answers.map((ans, i) => {
              const opt = options.find((o) => o._id === ans.optionId);
              const label =
                ans.optionLabelSnapshot ??
                opt?.label ??
                (ans.optionId === '__other__' ? ans.otherText : 'Option');

              const rangeVal = ans.values?.find((v) => v.dataType === 'range');
              const stoolVal = ans.values?.find(
                (v) =>
                  v.fieldKey.toLowerCase().includes('type') ||
                  v.fieldKey.toLowerCase().includes('bristol') ||
                  v.fieldKey.toLowerCase().includes('stool')
              );

              return (
                <View
                  key={`ans-chip-${i}`}
                  style={[
                    styles.chip,
                    {
                      borderColor: accentColor + '44',
                      backgroundColor: accentColor + '10',
                    },
                  ]}
                >
                  {opt?.icon && <Text style={styles.chipIcon}>{opt.icon}</Text>}
                  <Text style={[styles.chipText, { color: palette.text }]}>{label}</Text>

                  {/* Highlighted severity */}
                  {rangeVal && (
                    <View
                      style={[
                        styles.severityPill,
                        { backgroundColor: formatSeverity(rangeVal.value).color + '22' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.severityText,
                          { color: formatSeverity(rangeVal.value).color },
                        ]}
                      >
                        {formatSeverity(rangeVal.value).label}
                      </Text>
                    </View>
                  )}

                  {/* Highlighted Stool Type */}
                  {stoolVal && formatStoolType(stoolVal.value) && (
                    <View style={styles.stoolPill}>
                      <Text style={[styles.stoolText, { color: palette.primary }]}>
                        {formatStoolType(stoolVal.value)}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Collapsed State Summary Row (Shows indicators of hidden details) */}
        {!isExpanded && hasDetails && (
          <TouchableOpacity
            style={[
              styles.collapsedSummaryRow,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
              },
            ]}
            onPress={toggleExpand}
            activeOpacity={0.8}
          >
            <View style={styles.miniBadgesWrap}>
              {locationFields.length > 0 && (
                <View style={styles.miniBadge}>
                  <Text style={styles.miniBadgeText}>🧍 {totalAreasCount} areas</Text>
                </View>
              )}
              {imageFields.length > 0 && (
                <View style={styles.miniBadge}>
                  <Text style={styles.miniBadgeText}>
                    📷 {totalPhotosCount} photo{totalPhotosCount > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
              {entry.note ? (
                <View style={styles.miniBadge}>
                  <Text style={styles.miniBadgeText}>📝 Note</Text>
                </View>
              ) : null}
              {locationLabel ? (
                <View style={styles.miniBadge}>
                  <Text style={styles.miniBadgeText}>📍 {locationLabel}</Text>
                </View>
              ) : null}
              {standardFields.length > 0 && (
                <View style={styles.miniBadge}>
                  <Text style={styles.miniBadgeText}>⚙️ {standardFields.length} metrics</Text>
                </View>
              )}
            </View>

            <View style={styles.expandPromptWrap}>
              <Text style={[styles.expandPromptText, { color: palette.primary }]}>
                Show details
              </Text>
              <ChevronDown size={12} color={palette.primary} />
            </View>
          </TouchableOpacity>
        )}

        {/* Expanded Detailed Sections */}
        {isExpanded && (
          <>
            {/* Rich Anatomical Body Map Previews for Swelling / Pain / Symptoms */}
            {locationFields.map((loc, idx) => (
              <BodyMapPreview
                key={`loc-preview-${idx}`}
                selectedKeys={loc.field.value as string[] | string}
                fieldLabel={`${loc.answerLabel} • ${loc.field.fieldKey}`}
              />
            ))}

            {/* Rich Photo Gallery for Stool, Skin, or Attached Images */}
            {imageFields.map((img, idx) => (
              <LogPhotoGallery
                key={`img-gallery-${idx}`}
                uris={img.field.value as string[] | string}
                isSensitive={true}
                fieldLabel={`${img.answerLabel} • Photo`}
              />
            ))}

            {/* Standard text/numeric fields (e.g. Duration, Temperature) */}
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
                      <Text style={[styles.fieldKey, { color: palette.textSecondary }]}>
                        {f.field.fieldKey}:
                      </Text>
                      <Text style={[styles.fieldVal, { color: palette.text }]}>{displayVal}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Captured Location block */}
            {entry.location ? (
              <View
                style={[
                  styles.expandedLocationBox,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.025)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
                  },
                ]}
              >
                <MapPin size={14} color={palette.primary} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={[styles.expandedLocationTitle, { color: palette.text }]}>
                    {entry.location.formattedAddress || locationLabel}
                  </Text>
                  <Text style={[styles.expandedLocationSub, { color: palette.textSecondary }]}>
                    {entry.location.latitude.toFixed(4)}°, {entry.location.longitude.toFixed(4)}°
                    {entry.location.accuracy ? ` • ±${Math.round(entry.location.accuracy)}m` : ''}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Notes callout block */}
            {entry.note ? (
              <View
                style={[
                  styles.noteBox,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.025)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
                  },
                ]}
              >
                <FileText size={13} color={palette.textSecondary} style={{ marginTop: 2 }} />
                <Text style={[styles.noteText, { color: palette.textSecondary }]}>
                  {entry.note}
                </Text>
              </View>
            ) : null}
          </>
        )}

        {/* Bottom Actions Bar (Edit & Delete) */}
        <View style={styles.bottomBar}>
          {hasDetails ? (
            <TouchableOpacity
              style={styles.collapseToggleBtn}
              onPress={toggleExpand}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={[styles.collapseToggleText, { color: palette.textSecondary }]}>
                {isExpanded ? 'Collapse details' : 'Expand details'}
              </Text>
              {isExpanded ? (
                <ChevronUp size={12} color={palette.textSecondary} />
              ) : (
                <ChevronDown size={12} color={palette.textSecondary} />
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <View style={styles.actionsGroup}>
            {/* Edit Button */}
            {onEdit && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: isDark ? 'rgba(255, 125, 77, 0.12)' : 'rgba(255, 107, 53, 0.08)',
                    borderColor: isDark ? 'rgba(255, 125, 77, 0.25)' : 'rgba(255, 107, 53, 0.2)',
                  },
                ]}
                onPress={handleEdit}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Edit log entry"
              >
                <Pencil size={13} color={palette.primary} strokeWidth={2.2} />
                <Text style={[styles.actionBtnText, { color: palette.primary }]}>Edit</Text>
              </TouchableOpacity>
            )}

            {/* Delete Button */}
            {onDelete && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.deleteButton,
                  {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.06)',
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.18)',
                  },
                ]}
                onPress={handleDelete}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Delete log entry"
              >
                <Trash2 size={13} color="#EF4444" strokeWidth={2} />
                <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  card: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  strip: {
    width: 6,
  },
  body: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingRight: 8,
  },
  catIcon: {
    fontSize: 18,
  },
  catName: {
    ...typography.bodyBold,
    fontSize: 16,
    color: palette.text,
    fontWeight: '700',
  },
  qTitle: {
    ...typography.small,
    color: palette.textSecondary,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeBadgeRow: {
    alignItems: 'flex-end',
    gap: 3,
  },
  time: {
    ...typography.caption,
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  sourceBadge: {
    ...typography.caption,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    fontSize: 10,
    fontWeight: '700',
  },
  chevronBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipIcon: {
    fontSize: 13,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  severityPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 3,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  stoolPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 3,
  },
  stoolText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Collapsed summary preview
  collapsedSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 2,
  },
  miniBadgesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  miniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  miniBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  expandPromptWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 6,
  },
  expandPromptText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Expanded fields
  standardFieldsList: {
    gap: 3,
    marginTop: 4,
    paddingLeft: 4,
  },
  fieldLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  fieldKey: {
    fontSize: 12,
    fontWeight: '500',
  },
  fieldVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  noteBox: {
    flexDirection: 'row',
    gap: 6,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 2,
  },
  noteText: {
    ...typography.small,
    fontSize: 12.5,
    fontStyle: 'italic',
    flex: 1,
    lineHeight: 18,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
  },
  collapseToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  collapseToggleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  deleteButton: {},
  actionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  locationPillText: {
    fontSize: 10,
    color: palette.textSecondary,
    fontWeight: '500',
    maxWidth: 95,
  },
  expandedLocationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  expandedLocationTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  expandedLocationSub: {
    fontSize: 11,
    marginTop: 2,
  },
}));
