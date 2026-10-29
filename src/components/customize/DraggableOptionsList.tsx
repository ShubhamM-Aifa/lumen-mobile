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
import { router } from 'expo-router';
import { GripVertical, ChevronRight, ArrowUp, ArrowDown, Archive } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { IOption } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { IconTile } from '../ios/InsetGroup';

interface Props {
  options: IOption[];
  questionId: string;
  archiveMode?: boolean;
  reorderMode?: boolean;
  onReorder: (newOptions: IOption[]) => Promise<void>;
  onArchive: (option: IOption) => void;
  onMoveUp?: (option: IOption) => void;
  onMoveDown?: (option: IOption) => void;
  reordering?: boolean;
  onDragStateChange?: (isDragging: boolean) => void;
}

export function DraggableOptionsList({
  options,
  questionId,
  archiveMode,
  reorderMode,
  onReorder,
  onArchive,
  onMoveUp,
  onMoveDown,
  reordering,
  onDragStateChange,
}: Props) {
  const isArchiveMode = archiveMode ?? reorderMode ?? false;
  const { palette } = useTheme();
  const styles = useStyles();

  const [items, setItems] = useState<IOption[]>(options);
  const itemsRef = useRef<IOption[]>(options);
  itemsRef.current = items;

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const draggingIndexRef = useRef<number | null>(null);
  draggingIndexRef.current = draggingIndex;

  const targetIndexRef = useRef<number | null>(null);
  const isHoldingRef = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowHeightRef = useRef(62);

  const panY = useRef(new Animated.Value(0)).current;
  const scaleAnims = useRef<{ [key: string]: Animated.Value }>({}).current;
  const itemOffsets = useRef<{ [key: string]: Animated.Value }>({}).current;

  options.forEach((opt) => {
    if (!scaleAnims[opt._id]) {
      scaleAnims[opt._id] = new Animated.Value(1);
    }
    if (!itemOffsets[opt._id]) {
      itemOffsets[opt._id] = new Animated.Value(0);
    }
  });

  useEffect(() => {
    if (draggingIndexRef.current === null) {
      setItems(options);
    }
  }, [options]);

  const resetAllPositions = () => {
    panY.setValue(0);
    itemsRef.current.forEach((opt) => {
      if (itemOffsets[opt._id]) itemOffsets[opt._id].setValue(0);
      if (scaleAnims[opt._id]) scaleAnims[opt._id].setValue(1);
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

      if (itemOffsets[item._id]) {
        Animated.spring(itemOffsets[item._id], {
          toValue: targetOffset,
          friction: 8,
          tension: 250,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      }
    });
  };

  const createPanResponder = (index: number, opt: IOption) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (draggingIndexRef.current === index) return true;
        return isHoldingRef.current && Math.abs(gestureState.dy) > 3;
      },
      onPanResponderGrant: () => {
        isHoldingRef.current = false;
        targetIndexRef.current = index;

        const holdDelay = reorderMode ? 60 : 200;
        holdTimer.current = setTimeout(() => {
          isHoldingRef.current = true;
          draggingIndexRef.current = index;
          setDraggingIndex(index);
          onDragStateChange?.(true);

          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

          if (scaleAnims[opt._id]) {
            Animated.spring(scaleAnims[opt._id], {
              toValue: 1.03,
              friction: 6,
              tension: 220,
              useNativeDriver: Platform.OS !== 'web',
            }).start();
          }
        }, holdDelay);
      },
      onPanResponderMove: (_, gestureState) => {
        if (!isHoldingRef.current) {
          if (Math.abs(gestureState.dy) > 8 || Math.abs(gestureState.dx) > 8) {
            if (holdTimer.current) {
              clearTimeout(holdTimer.current);
              holdTimer.current = null;
            }
          }
          return;
        }

        panY.setValue(gestureState.dy);

        const rowH = rowHeightRef.current || 62;
        const offsetIdx = Math.round(gestureState.dy / rowH);
        const newTargetIdx = Math.max(0, Math.min(itemsRef.current.length - 1, index + offsetIdx));

        if (newTargetIdx !== targetIndexRef.current) {
          targetIndexRef.current = newTargetIdx;
          Haptics.selectionAsync().catch(() => {});
          updateOtherItemPositions(index, newTargetIdx, rowH);
        }
      },
      onPanResponderRelease: () => {
        if (holdTimer.current) {
          clearTimeout(holdTimer.current);
          holdTimer.current = null;
        }

        if (!isHoldingRef.current) {
          router.push(`/customize/option/${opt._id}?questionId=${questionId}`);
          return;
        }

        isHoldingRef.current = false;
        onDragStateChange?.(false);

        const fromIdx = index;
        const toIdx = targetIndexRef.current ?? index;
        const rowH = rowHeightRef.current || 62;
        const finalDropOffset = (toIdx - fromIdx) * rowH;

        Animated.parallel([
          Animated.spring(panY, {
            toValue: finalDropOffset,
            friction: 7,
            tension: 220,
            useNativeDriver: Platform.OS !== 'web',
          }),
          ...(scaleAnims[opt._id]
            ? [
                Animated.spring(scaleAnims[opt._id], {
                  toValue: 1,
                  friction: 6,
                  tension: 220,
                  useNativeDriver: Platform.OS !== 'web',
                }),
              ]
            : []),
        ]).start(async () => {
          if (fromIdx !== toIdx) {
            const next = [...itemsRef.current];
            const [moved] = next.splice(fromIdx, 1);
            next.splice(toIdx, 0, moved);
            itemsRef.current = next;
            setItems(next);
            resetAllPositions();
            setDraggingIndex(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await onReorder(next);
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

  return (
    <View style={styles.container}>
      {items.map((opt, index) => {
        const fieldsCount = opt.fields?.length ?? 0;
        const subText = fieldsCount > 0 ? `${fieldsCount} custom field${fieldsCount !== 1 ? 's' : ''}` : undefined;

        const isCurrentlyDragged = draggingIndex === index;
        const panResponder = createPanResponder(index, opt);

        const translateY = isCurrentlyDragged ? panY : (itemOffsets[opt._id] ?? new Animated.Value(0));
        const scale = scaleAnims[opt._id] ?? new Animated.Value(1);

        const isLast = index === items.length - 1;

        return (
          <Animated.View
            key={opt._id}
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
            <Pressable
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
              onPress={() => {
                if (!isHoldingRef.current && !isArchiveMode) {
                  router.push(`/customize/option/${opt._id}?questionId=${questionId}`);
                }
              }}
            >
              <View style={styles.dragGrip}>
                <GripVertical size={16} color={palette.textSecondary} />
              </View>
              <IconTile emoji={opt.icon || undefined} color={opt.color || palette.primary} />
              <View style={styles.infoArea}>
                <Text style={[styles.optName, { color: palette.text }]} numberOfLines={1}>
                  {opt.label}
                </Text>
                {subText ? (
                  <Text style={[styles.optSub, { color: palette.textSecondary }]}>
                    {subText}
                  </Text>
                ) : null}
              </View>
            </Pressable>

            {/* Trailing Controls */}
            {isArchiveMode ? (
              <View style={styles.archiveActions}>
                <TouchableOpacity
                  style={styles.archiveBtn}
                  onPress={() => onArchive(opt)}
                  accessibilityRole="button"
                  accessibilityLabel={`Archive ${opt.label}`}
                >
                  <Archive size={16} color={palette.warning || '#FF9500'} />
                  <Text style={[styles.archiveBtnText, { color: palette.warning || '#FF9500' }]}>Archive</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.normalActions}>
                <TouchableOpacity
                  style={styles.chevronBtn}
                  onPress={() => router.push(`/customize/option/${opt._id}?questionId=${questionId}`)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${opt.label}`}
                >
                  <ChevronRight size={18} color={palette.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
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
    backgroundColor: palette.surface,
    borderRadius: 16,
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
  optName: {
    ...typography.bodyLarge,
    fontWeight: '600',
  },
  optSub: {
    ...typography.caption1,
  },
  normalActions: {
    paddingRight: 16,
    paddingLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveActions: {
    paddingRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: (palette.warning || '#FF9500') + '18',
  },
  archiveBtnText: {
    ...typography.subhead,
    fontWeight: '600',
  },
  chevronBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
