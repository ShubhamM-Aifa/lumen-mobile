import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  PanResponder,
  TouchableOpacity,
  Pressable,
  Platform,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { GripVertical, Edit3, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { FieldDefinition } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  fields: FieldDefinition[];
  onReorder: (newFields: FieldDefinition[]) => void;
  onEditField: (index: number) => void;
  onRemoveField: (index: number) => void;
  onDragStateChange?: (isDragging: boolean) => void;
}

export function DraggableValueFieldsList({
  fields,
  onReorder,
  onEditField,
  onRemoveField,
  onDragStateChange,
}: Props) {
  const { palette } = useTheme();
  const styles = useStyles();

  const [items, setItems] = useState<FieldDefinition[]>(fields);
  const itemsRef = useRef<FieldDefinition[]>(fields);
  itemsRef.current = items;

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const draggingIndexRef = useRef<number | null>(null);
  draggingIndexRef.current = draggingIndex;

  const targetIndexRef = useRef<number | null>(null);
  const isHoldingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowHeightRef = useRef(56);

  const panY = useRef(new Animated.Value(0)).current;
  const scaleAnims = useRef<{ [key: string]: Animated.Value }>({}).current;
  const itemOffsets = useRef<{ [key: string]: Animated.Value }>({}).current;

  items.forEach((f, idx) => {
    const k = f.key || String(idx);
    if (!scaleAnims[k]) {
      scaleAnims[k] = new Animated.Value(1);
    }
    if (!itemOffsets[k]) {
      itemOffsets[k] = new Animated.Value(0);
    }
  });

  useEffect(() => {
    if (draggingIndexRef.current === null) {
      setItems(fields);
    }
  }, [fields]);

  const resetAllPositions = () => {
    panY.setValue(0);
    itemsRef.current.forEach((f, idx) => {
      const k = f.key || String(idx);
      if (itemOffsets[k]) itemOffsets[k].setValue(0);
      if (scaleAnims[k]) scaleAnims[k].setValue(1);
    });
  };

  const updateOtherItemPositions = (dragIdx: number, targetIdx: number, rowH: number) => {
    itemsRef.current.forEach((item, i) => {
      if (i === dragIdx) return;
      let targetOffset = 0;
      if (dragIdx < targetIdx) {
        if (i > dragIdx && i <= targetIdx) {
          targetOffset = -rowH;
        }
      } else if (dragIdx > targetIdx) {
        if (i >= targetIdx && i < dragIdx) {
          targetOffset = rowH;
        }
      }

      const animKey = item.key || String(i);
      if (itemOffsets[animKey]) {
        Animated.spring(itemOffsets[animKey], {
          toValue: targetOffset,
          useNativeDriver: false,
          friction: 7,
          tension: 80,
        }).start();
      }
    });
  };

  const createPanResponder = (index: number, field: FieldDefinition) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (itemsRef.current.length <= 1) return false;
        if (draggingIndexRef.current === index) return true;
        return isHoldingRef.current && Math.abs(gestureState.dy) > 3;
      },
      onPanResponderTerminationRequest: () => !isHoldingRef.current,
      onPanResponderGrant: () => {
        isHoldingRef.current = false;
        hasMovedRef.current = false;
        targetIndexRef.current = index;

        holdTimer.current = setTimeout(() => {
          isHoldingRef.current = true;
          draggingIndexRef.current = index;
          setDraggingIndex(index);
          onDragStateChange?.(true);

          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

          const animKey = field.key || String(index);
          if (scaleAnims[animKey]) {
            Animated.spring(scaleAnims[animKey], {
              toValue: 1.03,
              useNativeDriver: false,
              friction: 6,
              tension: 100,
            }).start();
          }
        }, 180);
      },
      onPanResponderMove: (_, gestureState) => {
        if (!isHoldingRef.current) {
          if (Math.abs(gestureState.dy) > 10 || Math.abs(gestureState.dx) > 10) {
            hasMovedRef.current = true;
            if (holdTimer.current) {
              clearTimeout(holdTimer.current);
              holdTimer.current = null;
            }
          }
          return;
        }

        panY.setValue(gestureState.dy);

        const rowHeight = rowHeightRef.current || 56;
        const dragOffset = gestureState.dy;
        const rawTarget = index + Math.round(dragOffset / rowHeight);
        const clampedTarget = Math.max(0, Math.min(itemsRef.current.length - 1, rawTarget));

        if (clampedTarget !== targetIndexRef.current) {
          targetIndexRef.current = clampedTarget;
          Haptics.selectionAsync().catch(() => {});
          updateOtherItemPositions(index, clampedTarget, rowHeight);
        }
      },
      onPanResponderRelease: () => {
        if (holdTimer.current) {
          clearTimeout(holdTimer.current);
          holdTimer.current = null;
        }

        if (!isHoldingRef.current) {
          if (!hasMovedRef.current) {
            onEditField(index);
          }
          return;
        }

        isHoldingRef.current = false;
        onDragStateChange?.(false);

        const fromIdx = index;
        const toIdx = targetIndexRef.current ?? index;
        const rowH = rowHeightRef.current || 56;
        const finalDropOffset = (toIdx - fromIdx) * rowH;

        const animKey = field.key || String(index);
        Animated.parallel([
          Animated.spring(panY, {
            toValue: finalDropOffset,
            friction: 7,
            tension: 220,
            useNativeDriver: false,
          }),
          ...(scaleAnims[animKey]
            ? [
                Animated.spring(scaleAnims[animKey], {
                  toValue: 1,
                  friction: 6,
                  tension: 220,
                  useNativeDriver: false,
                }),
              ]
            : []),
        ]).start(() => {
          if (fromIdx !== toIdx) {
            const reordered = [...itemsRef.current];
            const [moved] = reordered.splice(fromIdx, 1);
            reordered.splice(toIdx, 0, moved);
            itemsRef.current = reordered;
            setItems(reordered);
            resetAllPositions();
            setDraggingIndex(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            onReorder(reordered);
          } else {
            resetAllPositions();
            setDraggingIndex(null);
          }
        });
      },
      onPanResponderTerminate: () => {
        if (holdTimer.current) {
          clearTimeout(holdTimer.current);
          holdTimer.current = null;
        }
        isHoldingRef.current = false;
        onDragStateChange?.(false);
        resetAllPositions();
        setDraggingIndex(null);
      },
    });
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {items.map((f, index) => {
        const animKey = f.key || String(index);
        const isCurrentlyDragged = draggingIndex === index;
        const panResponder = createPanResponder(index, f);

        const translateY = isCurrentlyDragged ? panY : (itemOffsets[animKey] ?? new Animated.Value(0));
        const scale = scaleAnims[animKey] ?? new Animated.Value(1);
        const isLast = index === items.length - 1;

        const subText = `${f.dataType}${f.unit ? ` (${f.unit})` : ''} · Key: ${f.key}`;

        return (
          <Animated.View
            key={f.key || index}
            onLayout={(e: LayoutChangeEvent) => {
              const h = e.nativeEvent.layout.height;
              if (h > 40) rowHeightRef.current = h;
            }}
            style={[
              styles.itemRowWrapper,
              !isLast && styles.separator,
              isCurrentlyDragged && styles.draggingItem,
              {
                transform: [{ translateY }, { scale }],
                zIndex: isCurrentlyDragged ? 999 : 1,
              },
            ]}
          >
            {/* Draggable Main Area */}
            <View
              style={[
                styles.dragArea,
                Platform.OS === 'web'
                  ? ({
                      cursor: isCurrentlyDragged ? 'grabbing' : 'grab',
                      userSelect: 'none',
                    } as any)
                  : null,
              ]}
              {...panResponder.panHandlers}
              {...({
                onPress: () => {
                  if (!isHoldingRef.current && !hasMovedRef.current) {
                    onEditField(index);
                  }
                },
              } as any)}
            >
              <View style={styles.dragGrip}>
                <GripVertical size={16} color={palette.textSecondary} />
              </View>
              <View style={styles.infoArea}>
                <Text style={[styles.fieldLabel, { color: palette.text }]} numberOfLines={1}>
                  {f.label}
                </Text>
                <Text style={[styles.fieldSub, { color: palette.textSecondary }]} numberOfLines={1}>
                  {subText}
                </Text>
              </View>
            </View>

            {/* Trailing Controls */}
            <View style={styles.trailingActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onEditField(index)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${f.label}`}
              >
                <Edit3 size={16} color={palette.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onRemoveField(index)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${f.label}`}
              >
                <Trash2 size={16} color={palette.error} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  container: {
    backgroundColor: palette.surface,
  },
  itemRowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    minHeight: 56,
  },
  separator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  draggingItem: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.primary,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.16)',
      } as any,
    }),
  },
  dragArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingVertical: 10,
    gap: 12,
  },
  dragGrip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 2,
  },
  infoArea: {
    flex: 1,
    gap: 2,
  },
  fieldLabel: {
    ...typography.bodyLarge,
    fontWeight: '600',
  },
  fieldSub: {
    ...typography.caption1,
  },
  trailingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingRight: 16,
    paddingLeft: 4,
  },
  actionBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
