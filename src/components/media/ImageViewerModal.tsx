/**
 * Full-screen photo viewer (chat photos and GIFs): swipe between photos, pinch or double-tap to zoom,
 * drag to move a zoomed photo, swipe down to close, and save/share the photo.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, useWindowDimensions, Platform, Alert, ActivityIndicator,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Share2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

export interface ViewerImage {
  uri: string;
  /** Read out by screen readers. */
  label?: string;
  isGif?: boolean;
}

interface Props {
  visible: boolean;
  images: ViewerImage[];
  startIndex?: number;
  onClose: () => void;
}

const MAX_SCALE = 5;

const ZoomablePage: React.FC<{
  image: ViewerImage;
  width: number;
  height: number;
  onZoomChange: (zoomed: boolean) => void;
  onDismiss: () => void;
}> = ({ image, width, height, onZoomChange, onDismiss }) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const dragY = useSharedValue(0);

  const reset = () => {
    'worklet';
    scale.value = withSpring(1);
    savedScale.value = 1;
    tx.value = withSpring(0);
    ty.value = withSpring(0);
    savedTx.value = 0;
    savedTy.value = 0;
    runOnJS(onZoomChange)(false);
  };

  const clampPan = () => {
    'worklet';
    const maxX = (width * (scale.value - 1)) / 2;
    const maxY = (height * (scale.value - 1)) / 2;
    tx.value = withSpring(Math.min(maxX, Math.max(-maxX, tx.value)));
    ty.value = withSpring(Math.min(maxY, Math.max(-maxY, ty.value)));
    savedTx.value = Math.min(maxX, Math.max(-maxX, tx.value));
    savedTy.value = Math.min(maxY, Math.max(-maxY, ty.value));
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(0.8, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1.05) { reset(); return; }
      savedScale.value = scale.value;
      runOnJS(onZoomChange)(true);
      clampPan();
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (savedScale.value > 1.2) { reset(); return; }
      const target = 2.5;
      scale.value = withSpring(target);
      savedScale.value = target;
      // Zoom towards the tapped point.
      const x = (width / 2 - e.x) * (target - 1);
      const y = (height / 2 - e.y) * (target - 1);
      tx.value = withSpring(x);
      ty.value = withSpring(y);
      savedTx.value = x;
      savedTy.value = y;
      runOnJS(onZoomChange)(true);
    });

  // When zoomed: move the photo. When not zoomed: only vertical drags (swipe down closes),
  // so sideways swipes still go to the list and change photo.
  const pan = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        tx.value = savedTx.value + e.translationX;
        ty.value = savedTy.value + e.translationY;
      } else {
        dragY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (savedScale.value > 1) { clampPan(); return; }
      if (Math.abs(e.translationY) > 120 || Math.abs(e.velocityY) > 900) {
        dragY.value = withTiming(e.translationY > 0 ? height : -height, { duration: 160 });
        runOnJS(onDismiss)();
      } else {
        dragY.value = withSpring(0);
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value + dragY.value },
      { scale: scale.value },
    ],
    opacity: 1 - Math.min(0.6, Math.abs(dragY.value) / (height * 1.2)),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}>
        <Image
          source={{ uri: image.uri }}
          style={{ width, height }}
          contentFit="contain"
          autoplay
          accessibilityLabel={image.label || (image.isGif ? 'GIF' : 'Photo')}
        />
      </Animated.View>
    </GestureDetector>
  );
};

export const ImageViewerModal: React.FC<Props> = ({ visible, images, startIndex = 0, onClose }) => {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const listRef = useRef<FlatList<ViewerImage>>(null);

  useEffect(() => {
    if (visible) { setIndex(startIndex); setZoomed(false); }
  }, [visible, startIndex]);

  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    if (i !== index) { setIndex(i); setZoomed(false); }
  }, [index, width]);

  const current = images[index];

  const share = async () => {
    if (!current || sharing) return;
    setSharing(true);
    try {
      if (Platform.OS === 'web') {
        window.open(current.uri, '_blank');
        return;
      }
      const ext = current.isGif || /\.gif(\?|$)/i.test(current.uri) ? 'gif' : 'jpg';
      const target = `${FileSystem.cacheDirectory || ''}lumen_chat_${Date.now()}.${ext}`;
      const local = current.uri.startsWith('http') ? (await FileSystem.downloadAsync(current.uri, target)).uri : current.uri;
      if (await Sharing.isAvailableAsync().catch(() => false)) {
        await Sharing.shareAsync(local, { mimeType: ext === 'gif' ? 'image/gif' : 'image/jpeg', dialogTitle: 'Save or share photo' });
      } else {
        Alert.alert('Saved', 'The photo was saved to the app’s files.');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('Could not share the photo', err?.message || 'Please try again.');
    } finally {
      setSharing(false);
    }
  };

  if (!visible || images.length === 0) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed && images.length > 1}
          initialScrollIndex={Math.min(startIndex, images.length - 1)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={onScrollEnd}
          onScroll={onScrollEnd}
          scrollEventThrottle={32}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, i) => `${i}-${item.uri}`}
          renderItem={({ item }) => (
            <ZoomablePage image={item} width={width} height={height} onZoomChange={setZoomed} onDismiss={onClose} />
          )}
        />
        <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
          <TouchableOpacity style={styles.iconBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close photo" hitSlop={10}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {images.length > 1 ? (
            <Text style={styles.counter} accessibilityLiveRegion="polite">{index + 1} of {images.length}</Text>
          ) : <View />}
          <TouchableOpacity style={styles.iconBtn} onPress={share} accessibilityRole="button" accessibilityLabel="Save or share photo" hitSlop={10}>
            {sharing ? <ActivityIndicator color="#FFFFFF" /> : <Share2 size={22} color="#FFFFFF" />}
          </TouchableOpacity>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  counter: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
});
