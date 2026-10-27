import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Svg, { Ellipse, Rect, G } from 'react-native-svg';
import { Maximize2, X, MapPin, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Region {
  key: string;
  label: string;
  shape: 'ellipse' | 'rect';
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

const REGIONS: Region[] = [
  { key: 'head', label: 'Head', shape: 'ellipse', cx: 100, cy: 48, rx: 24, ry: 28 },
  { key: 'neck', label: 'Neck', shape: 'rect', x: 90, y: 78, w: 20, h: 20 },
  { key: 'l_shoulder', label: 'L. Shoulder', shape: 'ellipse', cx: 62, cy: 112, rx: 20, ry: 15 },
  { key: 'r_shoulder', label: 'R. Shoulder', shape: 'ellipse', cx: 138, cy: 112, rx: 20, ry: 15 },
  { key: 'chest', label: 'Chest', shape: 'ellipse', cx: 100, cy: 128, rx: 28, ry: 24 },
  { key: 'upper_abd', label: 'Upper Abdomen', shape: 'ellipse', cx: 100, cy: 166, rx: 24, ry: 18 },
  { key: 'lower_abd', label: 'Lower Abdomen', shape: 'ellipse', cx: 100, cy: 200, rx: 22, ry: 16 },
  { key: 'l_upper_arm', label: 'L. Upper Arm', shape: 'ellipse', cx: 50, cy: 148, rx: 14, ry: 26 },
  { key: 'r_upper_arm', label: 'R. Upper Arm', shape: 'ellipse', cx: 150, cy: 148, rx: 14, ry: 26 },
  { key: 'l_forearm', label: 'L. Forearm', shape: 'ellipse', cx: 44, cy: 194, rx: 12, ry: 22 },
  { key: 'r_forearm', label: 'R. Forearm', shape: 'ellipse', cx: 156, cy: 194, rx: 12, ry: 22 },
  { key: 'l_hand', label: 'L. Hand', shape: 'ellipse', cx: 38, cy: 228, rx: 12, ry: 13 },
  { key: 'r_hand', label: 'R. Hand', shape: 'ellipse', cx: 162, cy: 228, rx: 12, ry: 13 },
  { key: 'l_hip', label: 'L. Hip', shape: 'ellipse', cx: 84, cy: 230, rx: 20, ry: 22 },
  { key: 'r_hip', label: 'R. Hip', shape: 'ellipse', cx: 116, cy: 230, rx: 20, ry: 22 },
  { key: 'l_knee', label: 'L. Knee', shape: 'ellipse', cx: 82, cy: 284, rx: 15, ry: 14 },
  { key: 'r_knee', label: 'R. Knee', shape: 'ellipse', cx: 118, cy: 284, rx: 15, ry: 14 },
  { key: 'l_lower_leg', label: 'L. Lower Leg', shape: 'ellipse', cx: 80, cy: 318, rx: 12, ry: 24 },
  { key: 'r_lower_leg', label: 'R. Lower Leg', shape: 'ellipse', cx: 120, cy: 318, rx: 12, ry: 24 },
  { key: 'l_foot', label: 'L. Foot', shape: 'ellipse', cx: 78, cy: 350, rx: 14, ry: 9 },
  { key: 'r_foot', label: 'R. Foot', shape: 'ellipse', cx: 122, cy: 350, rx: 14, ry: 9 },
];

import { CHEST_REGIONS } from '../fields/ChestMap';
import { DAS28_JOINTS, FULL_BODY_3D_REGIONS } from '../fields/ThreeJsBodyViewer';

const REGION_MAP = new Map<string, string>([
  ...REGIONS.map((r) => [r.key, r.label] as [string, string]),
  ...CHEST_REGIONS.map((r) => [r.key, r.label] as [string, string]),
  ...DAS28_JOINTS.map((r) => [r.key, r.label] as [string, string]),
  ...FULL_BODY_3D_REGIONS.map((r) => [r.key, r.label] as [string, string]),
]);

interface Props {
  selectedKeys?: string[] | string;
  fieldLabel?: string;
  defaultExpanded?: boolean;
}

export function BodyMapPreview({
  selectedKeys,
  fieldLabel = 'Location',
  defaultExpanded = false,
}: Props) {
  const { palette, colorScheme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const keys: string[] = Array.isArray(selectedKeys)
    ? selectedKeys
    : typeof selectedKeys === 'string'
    ? selectedKeys.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  if (keys.length === 0) return null;

  const isDark = colorScheme === 'dark';
  const defaultFill = isDark ? '#2C2C2E' : '#E5E5EA';
  const defaultStroke = isDark ? '#38383A' : '#D1D1D6';
  const highlightFill = palette.primary;
  const highlightStroke = isDark ? '#FF453A' : '#FF3B30';

  const labels = keys.map((k) => REGION_MAP.get(k) || k);

  const toggleExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded((prev) => !prev);
  };

  const renderSilhouette = (width: number, height: number, strokeWidth: number = 1.2) => (
    <Svg width={width} height={height} viewBox="15 15 170 350">
      <G>
        {REGIONS.map((r) => {
          const isSelected = keys.includes(r.key);
          const fill = isSelected ? highlightFill : defaultFill;
          const stroke = isSelected ? highlightStroke : defaultStroke;
          const opacity = isSelected ? 1 : 0.45;

          if (r.shape === 'rect') {
            return (
              <Rect
                key={r.key}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                rx={4}
                fill={fill}
                stroke={stroke}
                strokeWidth={isSelected ? strokeWidth + 0.8 : strokeWidth}
                opacity={opacity}
              />
            );
          }
          return (
            <Ellipse
              key={r.key}
              cx={r.cx}
              cy={r.cy}
              rx={r.rx}
              ry={r.ry}
              fill={fill}
              stroke={stroke}
              strokeWidth={isSelected ? strokeWidth + 0.8 : strokeWidth}
              opacity={opacity}
            />
          );
        })}
      </G>
    </Svg>
  );

  return (
    <View style={styles.container}>
      {/* Header with expand / collapse and fullscreen actions */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.labelRow}
          onPress={toggleExpand}
          activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <MapPin size={13} color={palette.primaryText} />
          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            {fieldLabel} ({keys.length})
          </Text>
          {isExpanded ? (
            <ChevronUp size={14} color={palette.textSecondary} />
          ) : (
            <ChevronDown size={14} color={palette.textSecondary} />
          )}
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.toggleTextBtn}
            onPress={toggleExpand}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[styles.toggleText, { color: palette.textSecondary }]}>
              {isExpanded ? 'Collapse' : 'Expand'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.expandBtn}
            onPress={() => setModalVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Enlarge body map"
          >
            <Text style={[styles.expandText, { color: palette.primaryText }]}>View</Text>
            <Maximize2 size={11} color={palette.primaryText} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Collapsed Compact View */}
      {!isExpanded && (
        <TouchableOpacity
          style={[
            styles.compactBar,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.025)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
          onPress={toggleExpand}
          activeOpacity={0.8}
        >
          <View style={styles.compactTagsRow}>
            {labels.slice(0, 3).map((lbl, idx) => (
              <View
                key={`compact-${lbl}-${idx}`}
                style={[
                  styles.compactChip,
                  {
                    backgroundColor: isDark ? 'rgba(255, 69, 58, 0.14)' : 'rgba(255, 59, 48, 0.09)',
                    borderColor: isDark ? 'rgba(255, 69, 58, 0.3)' : 'rgba(255, 59, 48, 0.2)',
                  },
                ]}
              >
                <View style={[styles.tagDot, { backgroundColor: palette.primary }]} />
                <Text style={[styles.compactChipText, { color: palette.text }]}>{lbl}</Text>
              </View>
            ))}
            {labels.length > 3 && (
              <Text style={[styles.moreCountText, { color: palette.textSecondary }]}>
                +{labels.length - 3} more
              </Text>
            )}
          </View>
          <Text style={[styles.showMapPrompt, { color: palette.primaryText }]}>Show Map</Text>
        </TouchableOpacity>
      )}

      {/* Expanded Anatomical Silhouette Card */}
      {isExpanded && (
        <TouchableOpacity
          style={[
            styles.previewCard,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.025)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.85}
        >
          {/* Silhouette on the left */}
          <View style={styles.silhouetteWrap}>{renderSilhouette(64, 115, 1.2)}</View>

          {/* Region Tags on the right */}
          <View style={styles.tagsContainer}>
            <Text style={[styles.tagsHeading, { color: palette.text }]}>Affected Regions:</Text>
            <View style={styles.tagsRow}>
              {labels.map((lbl, idx) => (
                <View
                  key={`${lbl}-${idx}`}
                  style={[
                    styles.tag,
                    {
                      backgroundColor: isDark ? 'rgba(255, 69, 58, 0.16)' : 'rgba(255, 59, 48, 0.1)',
                      borderColor: isDark ? 'rgba(255, 69, 58, 0.35)' : 'rgba(255, 59, 48, 0.25)',
                    },
                  ]}
                >
                  <View style={[styles.tagDot, { backgroundColor: palette.primary }]} />
                  <Text style={[styles.tagText, { color: palette.text }]}>{lbl}</Text>
                </View>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Fullscreen Detailed Body Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.labelRow}>
                <MapPin size={18} color={palette.primaryText} />
                <Text style={[styles.modalTitle, { color: palette.text }]}>
                  {fieldLabel} — Body Map
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close body map"
              >
                <X size={20} color={palette.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSilhouetteWrap}>
              {renderSilhouette(170, 310, 1.8)}
            </View>

            <View style={styles.modalTagsWrap}>
              {labels.map((lbl, idx) => (
                <View
                  key={`modal-${lbl}-${idx}`}
                  style={[
                    styles.tag,
                    styles.modalTag,
                    {
                      backgroundColor: isDark ? 'rgba(255, 69, 58, 0.18)' : 'rgba(255, 59, 48, 0.12)',
                      borderColor: isDark ? 'rgba(255, 69, 58, 0.4)' : 'rgba(255, 59, 48, 0.3)',
                    },
                  ]}
                >
                  <View style={[styles.tagDot, { backgroundColor: palette.primary }]} />
                  <Text style={[styles.tagText, { color: palette.text }]}>{lbl}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  fieldLabel: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleTextBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '500',
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  expandText: {
    fontSize: 11,
    fontWeight: '700',
  },
  compactBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  compactTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    flex: 1,
  },
  compactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  compactChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  moreCountText: {
    fontSize: 11,
    fontWeight: '500',
  },
  showMapPrompt: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  silhouetteWrap: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagsContainer: {
    flex: 1,
  },
  tagsHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
    opacity: 0.8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  modalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  modalSilhouetteWrap: {
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    justifyContent: 'center',
  },
});
