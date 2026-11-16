/**
 * PdfViewerModal — Full-screen in-app PDF viewer & document manager
 * Provides cross-platform PDF viewing:
 * - iOS: Native WKWebView PDF rendering with pinch-to-zoom
 * - Android: In-app viewer (Google Docs Viewer / PDF.js) + one-tap native PDF reader app launch via IntentLauncher
 * - Web: In-app iframe / viewer
 * - Built-in Share / Export & System Viewer integration
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { X, Share2, ExternalLink, FileText, AlertCircle, RefreshCw } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  visible: boolean;
  fileUri: string | null;
  fileName?: string;
  onClose: () => void;
}

export function PdfViewerModal({ visible, fileUri, fileName, onClose }: Props) {
  const { palette, colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const styles = useStyles();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [base64Html, setBase64Html] = useState<string | null>(null);
  const [isOpeningExternal, setIsOpeningExternal] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const displayName = fileName || 'Health_Document.pdf';

  // Prepare and cache file for viewing/sharing/intents
  const prepareFile = useCallback(async (uri: string) => {
    setLoading(true);
    setError(null);
    setLocalPath(null);
    setBase64Html(null);

    try {
      let resolvedLocal = uri;
      const sanitizedName = displayName.replace(/[^a-zA-Z0-9._-]/g, '_');

      // 1. If remote HTTP URL, download to cache directory
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        const target = `${FileSystem.cacheDirectory || ''}lumen_${Date.now()}_${sanitizedName}`;
        const downloadRes = await FileSystem.downloadAsync(uri, target);
        resolvedLocal = downloadRes.uri;
      } else if (uri.startsWith('content://')) {
        // 2. If Android content:// URI, copy to cache directory for stable access
        const target = `${FileSystem.cacheDirectory || ''}lumen_${Date.now()}_${sanitizedName}`;
        await FileSystem.copyAsync({ from: uri, to: target });
        resolvedLocal = target;
      }

      setLocalPath(resolvedLocal);

      // 3. For Android in-app WebView, prepare PDF.js HTML with base64 data
      if (Platform.OS === 'android') {
        try {
          const base64 = await FileSystem.readAsStringAsync(resolvedLocal, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
              <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
              <style>
                * { box-sizing: border-box; }
                html, body {
                  margin: 0; padding: 0; background: ${isDark ? '#121212' : '#f5f5f7'};
                  width: 100%; min-height: 100%;
                  display: flex; flex-direction: column; align-items: center;
                  font-family: -apple-system, Roboto, sans-serif;
                }
                #viewer-container {
                  width: 100%; display: flex; flex-direction: column; align-items: center;
                  padding: 12px 8px 60px 8px;
                }
                .pdf-page-canvas {
                  width: 100% !important; max-width: 800px; height: auto !important;
                  margin-bottom: 14px; background: #ffffff;
                  border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.25);
                }
                #status {
                  color: ${isDark ? '#888' : '#666'}; padding: 30px; font-size: 14px; text-align: center;
                }
              </style>
            </head>
            <body>
              <div id="status">Rendering document pages...</div>
              <div id="viewer-container"></div>
              <script>
                const pdfData = "${base64}";
                if (window.pdfjsLib) {
                  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                  const raw = window.atob(pdfData);
                  const rawLength = raw.length;
                  const array = new Uint8Array(new ArrayBuffer(rawLength));
                  for (let i = 0; i < rawLength; i++) {
                    array[i] = raw.charCodeAt(i);
                  }
                  pdfjsLib.getDocument({ data: array }).promise.then(function(pdf) {
                    const statusEl = document.getElementById('status');
                    if (statusEl) statusEl.style.display = 'none';
                    const container = document.getElementById('viewer-container');
                    for (let num = 1; num <= pdf.numPages; num++) {
                      pdf.getPage(num).then(function(page) {
                        const viewport = page.getViewport({ scale: 2.0 });
                        const canvas = document.createElement('canvas');
                        canvas.className = 'pdf-page-canvas';
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        const ctx = canvas.getContext('2d');
                        page.render({ canvasContext: ctx, viewport: viewport });
                        container.appendChild(canvas);
                      });
                    }
                  }).catch(function(err) {
                    const statusEl = document.getElementById('status');
                    if (statusEl) statusEl.innerText = 'Tap "Open in PDF App" below to view this document.';
                  });
                } else {
                  const statusEl = document.getElementById('status');
                  if (statusEl) statusEl.innerText = 'Tap "Open in PDF App" below to view this document.';
                }
              </script>
            </body>
            </html>
          `;
          setBase64Html(html);
        } catch (e) {
          // If base64 read fails (e.g. huge file), we still have external viewer
        }
      }
    } catch (err: any) {
      console.warn('[PdfViewerModal] Failed to prepare PDF:', err);
      setError(err?.message || 'Could not load PDF document.');
    } finally {
      setLoading(false);
    }
  }, [displayName, isDark]);

  useEffect(() => {
    if (visible && fileUri) {
      prepareFile(fileUri);
    }
  }, [visible, fileUri, prepareFile]);

  // Open with device's native PDF reader (Google PDF Viewer, Samsung Notes, Adobe, etc.)
  const handleOpenExternal = async () => {
    if (!fileUri && !localPath) return;
    setIsOpeningExternal(true);
    Haptics.selectionAsync();

    try {
      const targetPath = localPath || fileUri!;

      if (Platform.OS === 'android') {
        let contentUri = targetPath;
        if (targetPath.startsWith('file://')) {
          contentUri = await FileSystem.getContentUriAsync(targetPath);
        } else if (targetPath.startsWith('http')) {
          // If remote, open with WebBrowser / Google Docs Viewer
          await WebBrowser.openBrowserAsync(targetPath);
          setIsOpeningExternal(false);
          return;
        }

        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: 'application/pdf',
        });
      } else if (Platform.OS === 'ios') {
        const canShare = await Sharing.isAvailableAsync().catch(() => false);
        if (canShare && targetPath) {
          await Sharing.shareAsync(targetPath, {
            mimeType: 'application/pdf',
            UTI: 'com.adobe.pdf',
            dialogTitle: displayName,
          });
        }
      } else {
        // Web
        if (fileUri) {
          window.open(fileUri, '_blank');
        }
      }
    } catch (err: any) {
      console.warn('[PdfViewerModal] Open external failed:', err);
      // Fallback to sharing
      if (localPath) {
        await Sharing.shareAsync(localPath, {
          mimeType: 'application/pdf',
          dialogTitle: displayName,
        }).catch(() => {});
      } else {
        Alert.alert('Unable to open viewer', 'Please try sharing or exporting the file instead.');
      }
    } finally {
      setIsOpeningExternal(false);
    }
  };

  // Share / Export PDF file
  const handleShare = async () => {
    if (!localPath && !fileUri) return;
    setIsSharing(true);
    Haptics.selectionAsync();

    try {
      const target = localPath || fileUri!;
      const canShare = await Sharing.isAvailableAsync().catch(() => false);
      if (canShare) {
        await Sharing.shareAsync(target, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${displayName}`,
        });
      } else {
        Alert.alert('Sharing Unavailable', 'File sharing is not supported on this device.');
      }
    } catch (err: any) {
      Alert.alert('Share Failed', err?.message || 'Could not share the document.');
    } finally {
      setIsSharing(false);
    }
  };

  if (!visible || !fileUri) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
        {/* Navigation / Control Header */}
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close PDF viewer"
          >
            <X size={22} color={palette.text} />
          </TouchableOpacity>

          <View style={styles.titleWrap}>
            <FileText size={16} color={palette.tint} style={{ marginRight: 6 }} />
            <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
              {displayName}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={handleOpenExternal}
              disabled={isOpeningExternal}
              accessibilityRole="button"
              accessibilityLabel="Open in external PDF reader"
            >
              <ExternalLink size={20} color={palette.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={handleShare}
              disabled={isSharing}
              accessibilityRole="button"
              accessibilityLabel="Share PDF document"
            >
              <Share2 size={20} color={palette.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Viewer Body */}
        <View style={styles.body}>
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={palette.tint} />
              <Text style={[styles.stateText, { color: palette.textSecondary }]}>
                Preparing document…
              </Text>
            </View>
          ) : error ? (
            <View style={styles.centerState}>
              <AlertCircle size={40} color={palette.error} />
              <Text style={[styles.errorTitle, { color: palette.text }]}>Document Preview Failed</Text>
              <Text style={[styles.stateText, { color: palette.textSecondary }]}>{error}</Text>
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: palette.tint }]}
                onPress={handleOpenExternal}
              >
                <ExternalLink size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryActionBtnText}>Open in Device PDF Reader</Text>
              </TouchableOpacity>
            </View>
          ) : Platform.OS === 'ios' ? (
            // iOS WKWebView natively renders PDF files with high fidelity & zoom
            <WebView
              source={{ uri: localPath || fileUri }}
              style={styles.webview}
              originWhitelist={['*']}
              allowFileAccess
              allowFileAccessFromFileURLs
              allowingReadAccessToURL="*"
              scalesPageToFit
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={palette.tint} />
                </View>
              )}
            />
          ) : Platform.OS === 'android' ? (
            // Android: Render via PDF.js if available, or Google Docs viewer for remote, with native external fallback
            <View style={{ flex: 1 }}>
              {base64Html ? (
                <WebView
                  source={{ html: base64Html }}
                  style={styles.webview}
                  originWhitelist={['*']}
                  javaScriptEnabled
                  domStorageEnabled
                  scalesPageToFit
                  startInLoadingState
                  renderLoading={() => (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="large" color={palette.tint} />
                    </View>
                  )}
                />
              ) : fileUri.startsWith('http') ? (
                <WebView
                  source={{ uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUri)}` }}
                  style={styles.webview}
                  scalesPageToFit
                  startInLoadingState
                  renderLoading={() => (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="large" color={palette.tint} />
                    </View>
                  )}
                />
              ) : (
                <View style={styles.centerState}>
                  <FileText size={56} color={palette.tint} />
                  <Text style={[styles.fileNamePrompt, { color: palette.text }]}>{displayName}</Text>
                  <Text style={[styles.stateText, { color: palette.textSecondary, textAlign: 'center', paddingHorizontal: 32 }]}>
                    This document is ready to view with your device's PDF reader (Google Drive, Adobe, or Samsung Notes).
                  </Text>
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { backgroundColor: palette.tint }]}
                    onPress={handleOpenExternal}
                    activeOpacity={0.85}
                  >
                    <ExternalLink size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryActionBtnText}>Open in PDF App</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            // Web iframe
            <iframe
              src={fileUri}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={displayName}
            />
          )}
        </View>

        {/* Quick Launch Bottom Bar (especially helpful on Android or for fast external reading) */}
        {Platform.OS === 'android' && (
          <View style={[styles.bottomBar, { backgroundColor: palette.surface, borderTopColor: palette.border }]}>
            <TouchableOpacity
              style={[styles.bottomBtn, { backgroundColor: palette.tint }]}
              onPress={handleOpenExternal}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Open in device PDF reader"
            >
              <ExternalLink size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.bottomBtnText}>Open in System PDF Viewer</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = createThemedStyles((palette) => ({
  container: {
    flex: 1,
  },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  title: {
    ...typography.subhead,
    fontWeight: '600',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  stateText: {
    ...typography.body,
    marginTop: 8,
  },
  errorTitle: {
    ...typography.headline,
    fontWeight: '700',
    marginTop: 12,
  },
  fileNamePrompt: {
    ...typography.headline,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionBtnText: {
    ...typography.subheadBold,
    color: '#FFFFFF',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  bottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
  },
  bottomBtnText: {
    ...typography.subheadBold,
    color: '#FFFFFF',
  },
}));
