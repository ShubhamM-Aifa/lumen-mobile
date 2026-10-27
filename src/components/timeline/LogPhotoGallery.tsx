import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Animated,
  PanResponder,
  Platform,
  Alert,
} from 'react-native';
import {
  Eye,
  EyeOff,
  X,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Lock,
  Download,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useResolvedMediaUrls } from '../../services/mediaService';
import { usePhotoVaultStore } from '../../store/photoVaultStore';
import { useAuthStore } from '../../store/authStore';
import { PhotoPinModal } from '../common/PhotoPinModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  uris?: string[] | string;
  isSensitive?: boolean;
  fieldLabel?: string;
}

export function LogPhotoGallery({
  uris,
  isSensitive = false,
  fieldLabel = 'Photo',
}: Props) {
  const { palette, colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  const user = useAuthStore((s) => s.user);
  const { isUnlocked: isVaultUnlocked, unlock: unlockVault } = usePhotoVaultStore();

  const [showPinModal, setShowPinModal] = useState(false);
  const [showDownloadPinModal, setShowDownloadPinModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const hasPhotoPin = Boolean(user?.hasPhotoPin);

  // Consider photo sensitive if explicitly marked, user has photo PIN, or label is sensitive (e.g. stool)
  const isPhotoSensitive = Boolean(
    isSensitive ||
    hasPhotoPin ||
    fieldLabel.toLowerCase().includes('stool') ||
    fieldLabel.toLowerCase().includes('sensitive')
  );

  const isProtectedByPin = isPhotoSensitive && hasPhotoPin;

  // If protected by PIN, thumbnail starts as hidden unless vault is already unlocked
  const [revealed, setRevealed] = useState(!isPhotoSensitive);
  const isEffectivelyRevealed = isProtectedByPin ? (isVaultUnlocked && revealed) : revealed;

  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [lightboxLoading, setLightboxLoading] = useState(false);
  const [lightboxError, setLightboxError] = useState(false);

  const [loadingThumbs, setLoadingThumbs] = useState<Record<number, boolean>>({});
  const [failedThumbs, setFailedThumbs] = useState<Record<number, boolean>>({});

  const { urls: resolvedUrls, isLoading: isResolving } = useResolvedMediaUrls(uris);

  const rawList: string[] = Array.isArray(uris)
    ? uris.filter(Boolean).map(String)
    : typeof uris === 'string' && uris.trim().length > 0
    ? [uris.trim()]
    : [];

  const photoList = resolvedUrls.length > 0 ? resolvedUrls : rawList;

  // ==========================================
  // Zoom & Pan Animations
  // ==========================================
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const panXAnim = useRef(new Animated.Value(0)).current;
  const panYAnim = useRef(new Animated.Value(0)).current;

  const currentScale = useRef(1);
  const currentPanX = useRef(0);
  const currentPanY = useRef(0);
  const [scaleDisplay, setScaleDisplay] = useState(1);

  const lastTapRef = useRef<number>(0);
  const initialDistanceRef = useRef<number>(0);
  const initialScaleRef = useRef<number>(1);
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const resetZoom = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 7 }),
      Animated.spring(panXAnim, { toValue: 0, useNativeDriver: true, friction: 7 }),
      Animated.spring(panYAnim, { toValue: 0, useNativeDriver: true, friction: 7 }),
    ]).start();
    currentScale.current = 1;
    currentPanX.current = 0;
    currentPanY.current = 0;
    setScaleDisplay(1);
  };

  const setZoomLevel = (newScale: number) => {
    const clamped = Math.min(Math.max(newScale, 1), 5);
    Animated.spring(scaleAnim, { toValue: clamped, useNativeDriver: true, friction: 7 }).start();
    if (clamped === 1) {
      Animated.parallel([
        Animated.spring(panXAnim, { toValue: 0, useNativeDriver: true, friction: 7 }),
        Animated.spring(panYAnim, { toValue: 0, useNativeDriver: true, friction: 7 }),
      ]).start();
      currentPanX.current = 0;
      currentPanY.current = 0;
    }
    currentScale.current = clamped;
    setScaleDisplay(Number(clamped.toFixed(1)));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          // Pinch start
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          initialDistanceRef.current = Math.hypot(dx, dy);
          initialScaleRef.current = currentScale.current;
        } else if (touches.length === 1) {
          // Pan start or double-tap detection
          initialPanRef.current = {
            x: currentPanX.current,
            y: currentPanY.current,
          };
          const now = Date.now();
          if (now - lastTapRef.current < 320) {
            // Double tap detected: toggle 1x <-> 2.5x
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (currentScale.current > 1.2) {
              resetZoom();
            } else {
              setZoomLevel(2.5);
            }
            lastTapRef.current = 0;
          } else {
            lastTapRef.current = now;
          }
        }
      },

      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          // Pinch in progress
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const dist = Math.hypot(dx, dy);
          if (initialDistanceRef.current > 0) {
            const factor = dist / initialDistanceRef.current;
            const newScale = Math.min(Math.max(initialScaleRef.current * factor, 1), 5);
            scaleAnim.setValue(newScale);
            currentScale.current = newScale;
            setScaleDisplay(Number(newScale.toFixed(1)));
          }
        } else if (touches.length === 1 && currentScale.current > 1) {
          // Pan in progress while zoomed in
          const maxPanX = (SCREEN_WIDTH * (currentScale.current - 1)) / 2 + 50;
          const maxPanY = (SCREEN_HEIGHT * 0.7 * (currentScale.current - 1)) / 2 + 50;

          const newX = Math.min(Math.max(initialPanRef.current.x + gestureState.dx, -maxPanX), maxPanX);
          const newY = Math.min(Math.max(initialPanRef.current.y + gestureState.dy, -maxPanY), maxPanY);

          panXAnim.setValue(newX);
          panYAnim.setValue(newY);
          currentPanX.current = newX;
          currentPanY.current = newY;
        }
      },

      onPanResponderRelease: () => {
        // Snap back if scale was pinched below 1
        if (currentScale.current < 1) {
          resetZoom();
        } else {
          // Snap pan back within boundary bounds
          const maxPanX = (SCREEN_WIDTH * (currentScale.current - 1)) / 2;
          const maxPanY = (SCREEN_HEIGHT * 0.7 * (currentScale.current - 1)) / 2;
          let clampedX = currentPanX.current;
          let clampedY = currentPanY.current;

          if (Math.abs(clampedX) > maxPanX) {
            clampedX = clampedX > 0 ? maxPanX : -maxPanX;
            Animated.spring(panXAnim, { toValue: clampedX, useNativeDriver: true }).start();
            currentPanX.current = clampedX;
          }
          if (Math.abs(clampedY) > maxPanY) {
            clampedY = clampedY > 0 ? maxPanY : -maxPanY;
            Animated.spring(panYAnim, { toValue: clampedY, useNativeDriver: true }).start();
            currentPanY.current = clampedY;
          }
        }
      },
    })
  ).current;

  if (rawList.length === 0) return null;

  const handleToggleReveal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isProtectedByPin && !isVaultUnlocked) {
      setShowPinModal(true);
      return;
    }
    setRevealed((prev) => !prev);
  };

  const handleOpenViewer = (uri: string, index = 0) => {
    if (isProtectedByPin && !isVaultUnlocked) {
      setShowPinModal(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActivePhoto(uri);
    setActivePhotoIndex(index);
    resetZoom();
    setLightboxLoading(true);
    setLightboxError(false);
  };

  const handleCloseViewer = () => {
    resetZoom();
    setActivePhoto(null);
  };

  // ==========================================
  // Download Action with Sensitive Auth
  // ==========================================
  const handleDownloadPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Note requirement: from download sensitive photos AGAIN ask for PIN or finger auth
    // even if the user already unlocked the photo to view it
    if (isPhotoSensitive) {
      setShowDownloadPinModal(true);
      return;
    }

    await executeDownload();
  };

  const executeDownload = async () => {
    if (!activePhoto) return;
    setIsDownloading(true);
    try {
      const cleanLabel = fieldLabel.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'photo';

      if (Platform.OS === 'web') {
        const res = await fetch(activePhoto);
        const blob = await res.blob();
        const blobUrl = (window.URL || (window as any).webkitURL).createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `lumen_${cleanLabel}_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        (window.URL || (window as any).webkitURL).revokeObjectURL(blobUrl);
        Alert.alert('Download Complete', 'Photo saved to your downloads.');
      } else {
        let localUri = activePhoto;

        if (activePhoto.startsWith('http://') || activePhoto.startsWith('https://')) {
          const filename = `lumen_${cleanLabel}_${Date.now()}.jpg`;
          const targetPath = `${FileSystem.cacheDirectory || FileSystem.documentDirectory || ''}${filename}`;
          const downloadRes = await FileSystem.downloadAsync(activePhoto, targetPath);
          localUri = downloadRes.uri;
        }

        const isAvailable = await Sharing.isAvailableAsync().catch(() => false);
        if (isAvailable) {
          await Sharing.shareAsync(localUri, {
            mimeType: 'image/jpeg',
            dialogTitle: `Save ${fieldLabel}`,
            UTI: 'public.jpeg',
          });
        } else {
          Alert.alert('Saved', 'Photo saved to device cache.');
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      console.error('[LogPhotoGallery] Download error:', err);
      Alert.alert('Download Failed', err?.message || 'Failed to download photo. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <ImageIcon size={13} color={palette.primaryText} />
          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            {fieldLabel} ({rawList.length})
          </Text>
          {isProtectedByPin && (
            <View style={[styles.pinProtectedBadge, { backgroundColor: isVaultUnlocked ? '#10B98118' : palette.primary + '18' }]}>
              <Lock size={10} color={isVaultUnlocked ? palette.successText : palette.primaryText} />
              <Text style={[styles.pinProtectedText, { color: isVaultUnlocked ? palette.successText : palette.primaryText }]}>
                {isVaultUnlocked ? 'Unlocked' : 'PIN Locked'}
              </Text>
            </View>
          )}
        </View>

        {isPhotoSensitive && (
          <TouchableOpacity
            style={[
              styles.revealToggleBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(0, 0, 0, 0.05)',
              },
            ]}
            onPress={handleToggleReveal}
            accessibilityRole="button"
            accessibilityLabel={isEffectivelyRevealed ? 'Hide sensitive photo' : 'Reveal photo'}
          >
            {isEffectivelyRevealed ? (
              <>
                <EyeOff size={12} color={palette.textSecondary} />
                <Text style={[styles.revealText, { color: palette.textSecondary }]}>
                  Hide
                </Text>
              </>
            ) : (
              <>
                <Eye size={12} color={palette.primaryText} />
                <Text style={[styles.revealText, { color: palette.primaryText }]}>
                  {isProtectedByPin && !isVaultUnlocked ? 'Unlock PIN' : 'Reveal'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Thumbnail Strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbnailScroll}
      >
        {photoList.map((uri, index) => {
          const isLoadingThis = isResolving || loadingThumbs[index];
          const hasError = failedThumbs[index];

          return (
            <View key={`thumb-${index}`} style={styles.thumbWrapper}>
              <TouchableOpacity
                style={[
                  styles.thumbCard,
                  {
                    borderColor: isDark
                      ? 'rgba(255, 255, 255, 0.12)'
                      : 'rgba(0, 0, 0, 0.08)',
                    backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
                  },
                ]}
                onPress={() => {
                  if (!isEffectivelyRevealed) {
                    if (isProtectedByPin && !isVaultUnlocked) {
                      setShowPinModal(true);
                    } else {
                      setRevealed(true);
                    }
                  } else if (!hasError && uri) {
                    handleOpenViewer(uri, index);
                  }
                }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`View photo ${index + 1}`}
              >
                {/* Fallback for broken/inaccessible URL */}
                {hasError ? (
                  <View style={styles.errorContainer}>
                    <AlertCircle size={22} color={palette.severityHigh ?? '#EF5350'} />
                    <Text style={[styles.errorSubtext, { color: palette.textDisabled }]}>
                      Unavailable
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* The Image */}
                    {!!uri && (
                      <Image
                        source={{ uri }}
                        style={[styles.thumbnail, !isEffectivelyRevealed && styles.blurredImage]}
                        blurRadius={!isEffectivelyRevealed ? 24 : 0}
                        resizeMode="cover"
                        onLoadStart={() => {
                          setLoadingThumbs((prev) => ({ ...prev, [index]: true }));
                        }}
                        onLoadEnd={() => {
                          setLoadingThumbs((prev) => ({ ...prev, [index]: false }));
                        }}
                        onError={() => {
                          setLoadingThumbs((prev) => ({ ...prev, [index]: false }));
                          setFailedThumbs((prev) => ({ ...prev, [index]: true }));
                        }}
                      />
                    )}

                    {/* Loading Indicator Spinner */}
                    {isLoadingThis && (
                      <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="small" color={palette.primaryText} />
                      </View>
                    )}

                    {/* Privacy overlay if hidden */}
                    {!isEffectivelyRevealed && !isLoadingThis && (
                      <View style={styles.privacyOverlay}>
                        {isProtectedByPin && !isVaultUnlocked ? (
                          <>
                            <Lock size={20} color="#FFFFFF" strokeWidth={2.2} />
                            <Text style={styles.privacyText}>Enter PIN to view</Text>
                          </>
                        ) : (
                          <>
                            <Eye size={20} color="#FFFFFF" strokeWidth={2.2} />
                            <Text style={styles.privacyText}>Tap to reveal</Text>
                          </>
                        )}
                      </View>
                    )}

                    {/* Zoom badge when revealed */}
                    {isEffectivelyRevealed && !isLoadingThis && (
                      <View style={styles.zoomBadge}>
                        <ZoomIn size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* Sensitive Photo PIN Modal for viewing/revealing */}
      <PhotoPinModal
        visible={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          unlockVault();
          setRevealed(true);
          setShowPinModal(false);
        }}
      />

      {/* Sensitive Photo Download PIN / Fingerprint Re-authentication Modal */}
      <PhotoPinModal
        visible={showDownloadPinModal}
        title="Authorize Download"
        subtitle="Confirm PIN or fingerprint to download sensitive photo"
        onClose={() => setShowDownloadPinModal(false)}
        onSuccess={() => {
          setShowDownloadPinModal(false);
          executeDownload();
        }}
      />

      {/* Fullscreen Lightbox Modal with Pinch-to-Zoom, Pan, and Download */}
      <Modal
        visible={!!activePhoto}
        transparent
        animationType="fade"
        onRequestClose={handleCloseViewer}
      >
        <View style={styles.lightboxOverlay}>
          {/* Header controls */}
          <View style={styles.lightboxHeader}>
            <View style={styles.lightboxTitleGroup}>
              <Text style={styles.lightboxTitle} numberOfLines={1}>
                {fieldLabel}{photoList.length > 1 ? ` (${activePhotoIndex + 1}/${photoList.length})` : ''}
              </Text>
              {isPhotoSensitive && (
                <View style={styles.sensitiveHeaderBadge}>
                  <Lock size={10} color="#FBBF24" />
                  <Text style={styles.sensitiveHeaderBadgeText}>Protected</Text>
                </View>
              )}
            </View>

            <View style={styles.lightboxHeaderActions}>
              <TouchableOpacity
                style={styles.lightboxActionBtn}
                onPress={handleDownloadPress}
                disabled={isDownloading}
                accessibilityRole="button"
                accessibilityLabel="Download photo"
              >
                {isDownloading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Download size={20} color="#FFFFFF" strokeWidth={2.2} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.lightboxActionBtn}
                onPress={handleCloseViewer}
                accessibilityRole="button"
                accessibilityLabel="Close photo viewer"
              >
                <X size={22} color="#FFFFFF" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Previous / Next arrows for multi-photo navigation */}
          {photoList.length > 1 && (
            <>
              <TouchableOpacity
                style={[styles.navArrowBtn, styles.navArrowLeft]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const prevIndex = (activePhotoIndex - 1 + photoList.length) % photoList.length;
                  setActivePhotoIndex(prevIndex);
                  setActivePhoto(photoList[prevIndex]);
                  resetZoom();
                }}
                accessibilityRole="button"
                accessibilityLabel="Previous photo"
              >
                <ChevronLeft size={28} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navArrowBtn, styles.navArrowRight]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const nextIndex = (activePhotoIndex + 1) % photoList.length;
                  setActivePhotoIndex(nextIndex);
                  setActivePhoto(photoList[nextIndex]);
                  resetZoom();
                }}
                accessibilityRole="button"
                accessibilityLabel="Next photo"
              >
                <ChevronRight size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </>
          )}

          {/* Zoomable Image Content */}
          <View style={styles.lightboxViewport}>
            {lightboxLoading && (
              <View style={styles.lightboxLoader}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.lightboxLoadingText}>Loading image...</Text>
              </View>
            )}

            {lightboxError ? (
              <View style={styles.lightboxErrorContainer}>
                <AlertCircle size={44} color="#EF4444" />
                <Text style={styles.lightboxErrorText}>Unable to load photo</Text>
                <TouchableOpacity
                  style={styles.lightboxRetryBtn}
                  onPress={() => {
                    setLightboxLoading(true);
                    setLightboxError(false);
                  }}
                >
                  <Text style={styles.lightboxRetryText}>Tap to retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              !!activePhoto && (
                <Animated.View
                  {...panResponder.panHandlers}
                  style={[
                    styles.lightboxImageContainer,
                    {
                      transform: [
                        { translateX: panXAnim },
                        { translateY: panYAnim },
                        { scale: scaleAnim },
                      ],
                    },
                  ]}
                >
                  <Image
                    source={{ uri: activePhoto }}
                    style={styles.lightboxImage}
                    resizeMode="contain"
                    onLoadStart={() => setLightboxLoading(true)}
                    onLoadEnd={() => setLightboxLoading(false)}
                    onError={() => {
                      setLightboxLoading(false);
                      setLightboxError(true);
                    }}
                  />
                </Animated.View>
              )
            )}
          </View>

          {/* Floating Zoom Controls Toolbar */}
          <View style={styles.lightboxToolbarContainer}>
            <View style={styles.lightboxToolbar}>
              <TouchableOpacity
                style={[styles.zoomControlBtn, scaleDisplay <= 1 && styles.zoomControlBtnDisabled]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setZoomLevel(Math.max(1, currentScale.current - 0.5));
                }}
                disabled={scaleDisplay <= 1}
                accessibilityRole="button"
                accessibilityLabel="Zoom out"
              >
                <ZoomOut size={18} color={scaleDisplay <= 1 ? 'rgba(255, 255, 255, 0.3)' : '#FFFFFF'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.zoomResetPill}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  resetZoom();
                }}
                accessibilityRole="button"
                accessibilityLabel="Reset zoom to 100%"
              >
                <Text style={styles.zoomResetText}>{scaleDisplay.toFixed(1)}x</Text>
                {scaleDisplay > 1 && (
                  <RotateCcw size={11} color="rgba(255, 255, 255, 0.8)" style={{ marginLeft: 3 }} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.zoomControlBtn, scaleDisplay >= 5 && styles.zoomControlBtnDisabled]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setZoomLevel(Math.min(5, currentScale.current + 0.5));
                }}
                disabled={scaleDisplay >= 5}
                accessibilityRole="button"
                accessibilityLabel="Zoom in"
              >
                <ZoomIn size={18} color={scaleDisplay >= 5 ? 'rgba(255, 255, 255, 0.3)' : '#FFFFFF'} />
              </TouchableOpacity>
            </View>

            <Text style={styles.zoomGestureHint}>
              Pinch or double-tap to zoom • Drag to pan
            </Text>
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
  revealToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  revealText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },
  pinProtectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 3,
  },
  pinProtectedText: {
    ...typography.caption,
    fontSize: 9.5,
    fontWeight: '700',
  },
  thumbnailScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  thumbWrapper: {
    position: 'relative',
  },
  thumbCard: {
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  blurredImage: {
    opacity: 0.85,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  privacyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    padding: 6,
  },
  privacyText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  zoomBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 10,
    padding: 3,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  errorSubtext: {
    ...typography.caption,
    fontSize: 9.5,
    fontWeight: '600',
  },

  // Fullscreen Lightbox Styles
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 38,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  lightboxTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 10,
  },
  lightboxTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  sensitiveHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  sensitiveHeaderBadgeText: {
    color: '#FBBF24',
    fontSize: 10.5,
    fontWeight: '700',
  },
  lightboxHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lightboxActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navArrowBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  navArrowLeft: {
    left: 14,
  },
  navArrowRight: {
    right: 14,
  },
  lightboxViewport: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.76,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  lightboxImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.76,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxLoader: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    zIndex: 5,
  },
  lightboxLoadingText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '500',
  },
  lightboxErrorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lightboxErrorText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 10,
  },
  lightboxRetryBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  lightboxRetryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  lightboxImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.76,
  },
  lightboxToolbarContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 24,
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  lightboxToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(25, 25, 25, 0.82)',
    borderRadius: 26,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  zoomControlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomControlBtnDisabled: {
    opacity: 0.35,
  },
  zoomResetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  zoomResetText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  zoomGestureHint: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 11,
    fontWeight: '500',
  },
});
