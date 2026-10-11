import React, { useState } from 'react';
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
} from 'react-native';
import { Eye, EyeOff, X, Image as ImageIcon, ZoomIn, AlertCircle, Lock, ShieldCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
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
  const { isUnlocked: isVaultUnlocked, lock: lockVault, unlock: unlockVault } = usePhotoVaultStore();
  const [showPinModal, setShowPinModal] = useState(false);

  const hasPhotoPin = Boolean(user?.hasPhotoPin);
  const isProtectedByPin = isSensitive && hasPhotoPin;

  // If protected by PIN, photo is only visible if vault is unlocked AND revealed is true
  const [revealed, setRevealed] = useState(!isSensitive);
  const isEffectivelyRevealed = isProtectedByPin ? (isVaultUnlocked && revealed) : revealed;

  const [activePhoto, setActivePhoto] = useState<string | null>(null);
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

  if (rawList.length === 0) return null;

  const handleToggleReveal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isProtectedByPin && !isVaultUnlocked) {
      setShowPinModal(true);
      return;
    }
    setRevealed((prev) => !prev);
  };

  const handleOpenViewer = (uri: string) => {
    if (isProtectedByPin && !isVaultUnlocked) {
      setShowPinModal(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActivePhoto(uri);
    setLightboxLoading(true);
    setLightboxError(false);
  };

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <ImageIcon size={13} color={palette.primary} />
          <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
            {fieldLabel} ({rawList.length})
          </Text>
          {isProtectedByPin && (
            <View style={[styles.pinProtectedBadge, { backgroundColor: isVaultUnlocked ? '#10B98118' : palette.primary + '18' }]}>
              <Lock size={10} color={isVaultUnlocked ? '#10B981' : palette.primary} />
              <Text style={[styles.pinProtectedText, { color: isVaultUnlocked ? '#10B981' : palette.primary }]}>
                {isVaultUnlocked ? 'Unlocked' : 'PIN Locked'}
              </Text>
            </View>
          )}
        </View>

        {isSensitive && (
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
                <Eye size={12} color={palette.primary} />
                <Text style={[styles.revealText, { color: palette.primary }]}>
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
                    backgroundColor: isDark ? '#1C1917' : '#F5F0EB',
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
                    handleOpenViewer(uri);
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
                        <ActivityIndicator size="small" color={palette.primary} />
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

      {/* Sensitive Photo PIN Modal */}
      <PhotoPinModal
        visible={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          unlockVault();
          setRevealed(true);
          setShowPinModal(false);
        }}
      />

      {/* Fullscreen Lightbox Modal */}
      <Modal
        visible={!!activePhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePhoto(null)}
      >
        <View style={styles.lightboxOverlay}>
          {/* Header controls */}
          <View style={styles.lightboxHeader}>
            <Text style={styles.lightboxTitle}>{fieldLabel}</Text>
            <TouchableOpacity
              style={styles.lightboxCloseBtn}
              onPress={() => setActivePhoto(null)}
              accessibilityRole="button"
              accessibilityLabel="Close photo viewer"
            >
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Lightbox content */}
          <View style={styles.lightboxImageContainer}>
            {lightboxLoading && (
              <View style={styles.lightboxLoader}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.lightboxLoadingText}>Loading full image...</Text>
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
              )
            )}
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
    fontSize: 11,
    fontWeight: '700',
  },
  pinProtectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    marginLeft: 6,
  },
  pinProtectedText: {
    fontSize: 10,
    fontWeight: '700',
  },
  thumbnailScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
  },
  thumbWrapper: {
    position: 'relative',
  },
  thumbCard: {
    width: 90,
    height: 90,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  blurredImage: {
    opacity: 0.6,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  errorSubtext: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'center',
  },
  privacyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  privacyText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  zoomBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: 4,
    borderRadius: 6,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxHeader: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  lightboxTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  lightboxCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
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
    color: 'rgba(255, 255, 255, 0.8)',
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
    height: SCREEN_HEIGHT * 0.75,
  },
});
