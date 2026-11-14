import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ITask } from '../../shared/types';

/** Vertical gap between rows. Row heights are measured including this gap. */
export const ROW_GAP = 8;

interface Props {
  tasks: ITask[];
  /** Drag only works in the custom sort order. */
  enabled: boolean;
  renderRow: (task: ITask, state: { dragging: boolean }) => React.ReactNode;
  onReorder: (orderedIds: string[]) => void;
  /** Lets the parent freeze its ScrollView while a row is being dragged. */
  onDragActive?: (active: boolean) => void;
}

/**
 * Press and hold a row, then drag it up or down.
 *
 * The rows are NOT re-ordered while the finger is down (moving the touched view mid-gesture cancels the
 * gesture). Instead the dragged row follows the finger, the rows it passes slide out of the way, and the
 * new order is committed once, when the finger lifts.
 */
export function ReorderableTaskList({ tasks, enabled, renderRow, onReorder, onDragActive }: Props) {
  const [order, setOrder] = useState<string[]>(() => tasks.map((t) => t._id));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const draggingRef = useRef<string | null>(null);
  const targetRef = useRef<number | null>(null);
  const orderRef = useRef(order);
  const tops = useRef<number[]>([]);
  const heights = useRef<Record<string, number>>({});
  const translateY = useSharedValue(0);

  // Follow the source of truth whenever nothing is being dragged.
  useEffect(() => {
    if (draggingRef.current) return;
    const ids = tasks.map((t) => t._id);
    orderRef.current = ids;
    setOrder(ids);
  }, [tasks]);

  const byId = useMemo(() => new Map(tasks.map((t) => [t._id, t])), [tasks]);

  const begin = useCallback((id: string) => {
    const current = orderRef.current;
    let y = 0;
    tops.current = current.map((rowId) => {
      const top = y;
      y += heights.current[rowId] ?? 64;
      return top;
    });
    draggingRef.current = id;
    targetRef.current = current.indexOf(id);
    translateY.value = 0;
    setDraggingId(id);
    setTargetIndex(targetRef.current);
    onDragActive?.(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [translateY, onDragActive]);

  const move = useCallback((id: string, raw: number) => {
    if (draggingRef.current !== id) return;
    const current = orderRef.current;
    const from = current.indexOf(id);
    if (from < 0) return;
    const hd = heights.current[id] ?? 64;
    const center = tops.current[from] + hd / 2 + raw;
    // The new slot = how many of the other rows have their centre above the dragged row's centre.
    let next = 0;
    current.forEach((rowId, i) => {
      if (i === from) return;
      const c = tops.current[i] + (heights.current[rowId] ?? 64) / 2;
      if (c < center) next++;
    });
    if (next !== targetRef.current) {
      targetRef.current = next;
      setTargetIndex(next);
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  const finish = useCallback((id: string) => {
    if (draggingRef.current !== id) return;
    const current = orderRef.current;
    const from = current.indexOf(id);
    const to = targetRef.current ?? from;
    draggingRef.current = null;
    targetRef.current = null;
    translateY.value = 0;
    setDraggingId(null);
    setTargetIndex(null);
    onDragActive?.(false);
    if (from >= 0 && to !== from) {
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, id);
      orderRef.current = next;
      setOrder(next);
      onReorder(next);
    }
  }, [translateY, onDragActive, onReorder]);

  const from = draggingId ? order.indexOf(draggingId) : -1;
  const hd = draggingId ? heights.current[draggingId] ?? 64 : 0;
  const shiftFor = (index: number): number => {
    if (from < 0 || targetIndex === null) return 0;
    if (targetIndex > from && index > from && index <= targetIndex) return -hd;
    if (targetIndex < from && index >= targetIndex && index < from) return hd;
    return 0;
  };

  return (
    <View>
      {order.map((id, index) => {
        const task = byId.get(id);
        if (!task) return null;
        return (
          <DraggableItem
            key={id}
            id={id}
            enabled={enabled}
            dragging={draggingId === id}
            shift={draggingId === id ? 0 : shiftFor(index)}
            translateY={translateY}
            onMeasure={(h) => { heights.current[id] = h; }}
            onBegin={begin}
            onMove={move}
            onFinish={finish}
          >
            {renderRow(task, { dragging: draggingId === id })}
          </DraggableItem>
        );
      })}
    </View>
  );
}

interface ItemProps {
  id: string;
  enabled: boolean;
  dragging: boolean;
  /** How far this (non-dragged) row slides to make room. */
  shift: number;
  translateY: SharedValue<number>;
  onMeasure: (height: number) => void;
  onBegin: (id: string) => void;
  onMove: (id: string, raw: number) => void;
  onFinish: (id: string) => void;
  children: React.ReactNode;
}

function DraggableItem({ id, enabled, dragging, shift, translateY, onMeasure, onBegin, onMove, onFinish, children }: ItemProps) {
  const offset = useSharedValue(0);

  useEffect(() => {
    // Settling back to 0 after a drop must not animate: the real order changes in the same frame.
    offset.value = shift === 0 && !dragging ? withTiming(0, { duration: 120 }) : withTiming(shift, { duration: 160 });
  }, [shift, dragging, offset]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activateAfterLongPress(300)
        .onStart(() => {
          runOnJS(onBegin)(id);
        })
        .onUpdate((e) => {
          translateY.value = e.translationY;
          runOnJS(onMove)(id, e.translationY);
        })
        .onFinalize(() => {
          runOnJS(onFinish)(id);
        }),
    [enabled, id, onBegin, onMove, onFinish, translateY]
  );

  const animated = useAnimatedStyle(() => ({
    transform: dragging ? [{ translateY: translateY.value }, { scale: 1.02 }] : [{ translateY: offset.value }],
    zIndex: dragging ? 20 : 0,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[{ marginBottom: ROW_GAP }, animated]}
        onLayout={(e: LayoutChangeEvent) => onMeasure(e.nativeEvent.layout.height + ROW_GAP)}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
