import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import {
  FileBadge,
  FileText,
  Share2,
  Trash2,
  Calendar,
  Building2,
  User,
  AlertCircle,
  CheckCircle2,
  Lock,
  Pill,
  TestTube2,
  Camera,
  ExternalLink,
  ChevronLeft,
  X,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { ScreenTopBar } from '../../src/components/ios/ScreenTopBar';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { useHealthRecordStore } from '../../src/store/healthRecordStore';
import { IHealthRecord, HealthRecordType, IBiomarker, IPrescribedMedication } from '../../src/shared/types';
import { safeGoBack } from '../../src/utils/navigation';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function RecordDetailScreen() {
  const styles = useStyles();
  const { palette, colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  const { id } = useLocalSearchParams<{ id: string }>();
  const { fetchRecordById, activeRecord, deleteRecord } = useHealthRecordStore();

  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (id) {
      setIsLoading(true);
      fetchRecordById(id).finally(() => setIsLoading(false));
    }
  }, [id, fetchRecordById]);

  const record: IHealthRecord | null = activeRecord && activeRecord._id === id ? activeRecord : null;

  const handleDelete = () => {
    Alert.alert(
      'Delete Health Record',
      'Are you sure you want to delete this clinical record? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteRecord(id!);
            safeGoBack('/records');
          },
        },
      ],
    );
  };

  const handleShare = async () => {
    if (!record) return;
    setIsSharing(true);
    Haptics.selectionAsync();

    try {
      // 1. If an actual file exists, share the file
      const fileUri =
        (record.localFileUris && record.localFileUris[0]) ||
        (record.fileUrls && record.fileUrls[0]);

      if (fileUri) {
        let localPath = fileUri;
        // If remote URL, download temporarily to cache
        if (fileUri.startsWith('http')) {
          const ext = fileUri.includes('.pdf') ? '.pdf' : '.jpg';
          const target = `${FileSystem.cacheDirectory || ''}Report_${Date.now()}${ext}`;
          const res = await FileSystem.downloadAsync(fileUri, target);
          localPath = res.uri;
        }

        const canShare = await Sharing.isAvailableAsync().catch(() => false);
        if (canShare) {
          await Sharing.shareAsync(localPath, {
            mimeType: fileUri.includes('.pdf') ? 'application/pdf' : 'image/jpeg',
            dialogTitle: `Share ${record.title}`,
          });
        } else {
          Alert.alert('Sharing Unavailable', 'File sharing is not supported on this platform.');
        }
      } else {
        // 2. Share textual clinical summary
        const biomarkerSummary = record.biomarkers?.map(
          (b) => `• ${b.name}: ${b.value} ${b.unit || ''} (${b.flag?.toUpperCase() || 'NORMAL'})`,
        ).join('\n') || '';

        const medSummary = record.medications?.map(
          (m) => `• ${m.name} - ${m.dosage || ''} ${m.frequency || ''}`,
        ).join('\n') || '';

        const textContent =
          `[Lumen Health Record: ${record.title}]\n` +
          `Date: ${new Date(record.date).toLocaleDateString()}\n` +
          (record.doctorName ? `Doctor: ${record.doctorName}\n` : '') +
          (record.clinicOrLab ? `Clinic/Lab: ${record.clinicOrLab}\n` : '') +
          (biomarkerSummary ? `\nBiomarkers:\n${biomarkerSummary}\n` : '') +
          (medSummary ? `\nPrescribed Medications:\n${medSummary}\n` : '') +
          (record.notes ? `\nNotes:\n${record.notes}\n` : '');

        // Write temp text file to share
        const tempPath = `${FileSystem.cacheDirectory || ''}clinical_record_${Date.now()}.txt`;
        await FileSystem.writeAsStringAsync(tempPath, textContent);
        await Sharing.shareAsync(tempPath, {
          mimeType: 'text/plain',
          dialogTitle: `Share ${record.title}`,
        });
      }
    } catch (err: any) {
      Alert.alert('Share Failed', err.message || 'Unable to share document.');
    } finally {
      setIsSharing(false);
    }
  };

  if (isLoading && !record) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenTopBar title="Loading Record" onBack={() => safeGoBack('/records')} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.tint} />
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
            Loading clinical document...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!record) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenTopBar title="Record Not Found" onBack={() => safeGoBack('/records')} />
        <View style={styles.notFoundWrap}>
          <Text style={[styles.notFoundTitle, { color: palette.text }]}>Record Not Found</Text>
          <Text style={[styles.notFoundSub, { color: palette.textSecondary }]}>
            This clinical report may have been deleted.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const getTypeMeta = (type: HealthRecordType) => {
    switch (type) {
      case 'blood_test':
        return {
          label: 'Blood & Lab Report',
          color: '#0284C7',
          bgColor: isDark ? 'rgba(2, 132, 199, 0.2)' : 'rgba(2, 132, 199, 0.1)',
          icon: TestTube2,
        };
      case 'doctor_prescription':
        return {
          label: 'Doctor Prescription',
          color: '#10B981',
          bgColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
          icon: Pill,
        };
      case 'imaging':
        return {
          label: 'Imaging & Scan',
          color: '#8B5CF6',
          bgColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)',
          icon: Camera,
        };
      case 'doctor_note':
        return {
          label: 'Doctor Note',
          color: '#F59E0B',
          bgColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)',
          icon: FileText,
        };
    }
  };

  const meta = getTypeMeta(record.type);
  const TypeIcon = meta.icon;

  const files = [
    ...(record.fileUrls || []),
    ...(record.localFileUris || []),
  ];
  const uniqueFiles = Array.from(new Set(files));

  const outOfRangeBiomarkers = record.biomarkers?.filter((b) => b.flag && b.flag !== 'normal') || [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Bar with Share & Delete */}
      <ScreenTopBar
        title={record.title}
        onBack={() => safeGoBack('/records')}
        fallbackRoute="/records"
        right={
          <View style={styles.topRightActions}>
            <GlassCircleButton accessibilityLabel="Share record" onPress={handleShare}>
              {isSharing ? (
                <ActivityIndicator size="small" color={palette.tint} />
              ) : (
                <Share2 size={18} color={palette.text} />
              )}
            </GlassCircleButton>
            <GlassCircleButton accessibilityLabel="Delete record" onPress={handleDelete}>
              <Trash2 size={18} color={palette.error} />
            </GlassCircleButton>
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.typeBadge, { backgroundColor: meta.bgColor }]}>
              <TypeIcon size={14} color={meta.color} />
              <Text style={[styles.typeBadgeText, { color: meta.color }]}>{meta.label}</Text>
            </View>

            {record.isSensitive && (
              <View style={[styles.confidentialBadge, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)' }]}>
                <Lock size={12} color="#EF4444" />
                <Text style={styles.confidentialText}>Confidential</Text>
              </View>
            )}
          </View>

          <Text style={[styles.heroTitle, { color: palette.text }]}>{record.title}</Text>

          <View style={styles.metadataList}>
            <View style={styles.metaRow}>
              <Calendar size={14} color={palette.textSecondary} />
              <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>Date:</Text>
              <Text style={[styles.metaVal, { color: palette.text }]}>
                {new Date(record.date).toLocaleDateString(undefined, {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>

            {record.doctorName && (
              <View style={styles.metaRow}>
                <User size={14} color={palette.textSecondary} />
                <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>Provider:</Text>
                <Text style={[styles.metaVal, { color: palette.text }]}>{record.doctorName}</Text>
              </View>
            )}

            {record.clinicOrLab && (
              <View style={styles.metaRow}>
                <Building2 size={14} color={palette.textSecondary} />
                <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>Facility:</Text>
                <Text style={[styles.metaVal, { color: palette.text }]}>{record.clinicOrLab}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Document / Prescription Attachments */}
        {uniqueFiles.length > 0 && (
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
              ATTACHED DOCUMENTS & SCANS
            </Text>

            <View style={styles.attachmentsWrap}>
              {uniqueFiles.map((uri, idx) => {
                const isPdf = uri.toLowerCase().includes('.pdf');
                const fileName =
                  record.fileNames && record.fileNames[idx]
                    ? record.fileNames[idx]
                    : isPdf
                    ? `Document_${idx + 1}.pdf`
                    : `Medical_Scan_${idx + 1}.jpg`;

                return isPdf ? (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.pdfCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
                    onPress={handleShare}
                    activeOpacity={0.8}
                  >
                    <View style={styles.pdfIconBadge}>
                      <Text style={styles.pdfIconText}>PDF</Text>
                    </View>
                    <View style={styles.pdfMeta}>
                      <Text style={[styles.pdfTitle, { color: palette.text }]} numberOfLines={1}>
                        {fileName}
                      </Text>
                      <Text style={[styles.pdfSub, { color: palette.tint }]}>
                        Tap to View / Export Document
                      </Text>
                    </View>
                    <ExternalLink size={18} color={palette.tint} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.photoCard, { borderColor: palette.border }]}
                    onPress={() => setSelectedPhoto(uri)}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                    <View style={styles.photoOverlay}>
                      <Text style={styles.photoOverlayText}>Tap to inspect</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Biomarkers Clinical Table (Blood Tests) */}
        {record.type === 'blood_test' && record.biomarkers && record.biomarkers.length > 0 && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
                BIOMARKER ANALYSIS ({record.biomarkers.length})
              </Text>
            </View>

            {/* Abnormal callout */}
            {outOfRangeBiomarkers.length > 0 && (
              <View style={[styles.alertBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)' }]}>
                <AlertCircle size={18} color={palette.error} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.alertBannerTitle, { color: palette.error }]}>
                    {outOfRangeBiomarkers.length} Out-of-Range Biomarker{outOfRangeBiomarkers.length > 1 ? 's' : ''}
                  </Text>
                  <Text style={[styles.alertBannerSub, { color: palette.textSecondary }]}>
                    Values outside expected laboratory reference thresholds. Review with your ordering physician.
                  </Text>
                </View>
              </View>
            )}

            {/* Biomarker Table */}
            <View style={[styles.tableCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              {/* Header */}
              <View style={[styles.tableHeaderRow, { borderBottomColor: palette.border }]}>
                <Text style={[styles.thCell, { flex: 2, color: palette.textSecondary }]}>TEST / MARKER</Text>
                <Text style={[styles.thCell, { flex: 1.2, color: palette.textSecondary }]}>RESULT</Text>
                <Text style={[styles.thCell, { flex: 1.2, color: palette.textSecondary }]}>REF RANGE</Text>
                <Text style={[styles.thCell, { flex: 1, textAlign: 'right', color: palette.textSecondary }]}>FLAG</Text>
              </View>

              {/* Rows */}
              {record.biomarkers.map((bm, idx) => {
                const isOutOfRange = bm.flag && bm.flag !== 'normal';
                const flagColor =
                  bm.flag === 'high' || bm.flag === 'critical'
                    ? palette.error
                    : bm.flag === 'low'
                    ? palette.tint
                    : palette.success;

                return (
                  <View
                    key={idx}
                    style={[
                      styles.tableRow,
                      idx < (record.biomarkers?.length || 0) - 1 && { borderBottomColor: palette.border, borderBottomWidth: 1 },
                      isOutOfRange && {
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.06)' : 'rgba(239, 68, 68, 0.03)',
                      },
                    ]}
                  >
                    <View style={{ flex: 2 }}>
                      <Text style={[styles.bmCellName, { color: palette.text }]}>{bm.name}</Text>
                    </View>

                    <View style={{ flex: 1.2 }}>
                      <Text
                        style={[
                          styles.bmCellVal,
                          { color: isOutOfRange ? flagColor : palette.text },
                        ]}
                      >
                        {bm.value} <Text style={{ fontSize: 11, color: palette.textSecondary }}>{bm.unit || ''}</Text>
                      </Text>
                    </View>

                    <View style={{ flex: 1.2 }}>
                      <Text style={[styles.bmCellRef, { color: palette.textSecondary }]}>
                        {bm.referenceRange || '—'}
                      </Text>
                    </View>

                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <View style={[styles.statusBadge, { backgroundColor: flagColor + '20' }]}>
                        <Text style={[styles.statusBadgeText, { color: flagColor }]}>
                          {(bm.flag || 'NORMAL').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Prescribed Medications Section */}
        {record.type === 'doctor_prescription' && record.medications && record.medications.length > 0 && (
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
              PRESCRIBED MEDICATIONS ({record.medications.length})
            </Text>

            <View style={{ gap: 10 }}>
              {record.medications.map((med, idx) => (
                <View
                  key={idx}
                  style={[styles.rxMedCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
                >
                  <View style={styles.rxMedTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View style={[styles.rxIconWrap, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)' }]}>
                        <Pill size={16} color="#10B981" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rxMedName, { color: palette.text }]}>{med.name}</Text>
                        {med.dosage && (
                          <Text style={[styles.rxMedDose, { color: palette.textSecondary }]}>
                            {med.dosage}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={[styles.activeStatusPill, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)' }]}>
                      <CheckCircle2 size={12} color="#10B981" />
                      <Text style={[styles.activeStatusText, { color: '#10B981' }]}>Active</Text>
                    </View>
                  </View>

                  {med.frequency && (
                    <View style={styles.rxDetailRow}>
                      <Clock size={13} color={palette.textSecondary} />
                      <Text style={[styles.rxDetailText, { color: palette.textSecondary }]}>
                        Schedule: {med.frequency}
                      </Text>
                    </View>
                  )}

                  {med.instructions && (
                    <View style={styles.rxInstructionsBox}>
                      <Text style={[styles.rxInstructionsText, { color: palette.textSecondary }]}>
                        {med.instructions}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Clinical Observations & Doctor Notes */}
        {record.notes && (
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
              CLINICAL OBSERVATIONS & NOTES
            </Text>

            <View style={[styles.notesCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.notesText, { color: palette.text }]}>{record.notes}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Full Screen Photo Viewer Modal */}
      {selectedPhoto && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
          <View style={styles.photoModalWrap}>
            <SafeAreaView style={styles.photoModalHeader}>
              <GlassCircleButton accessibilityLabel="Close photo viewer" onPress={() => setSelectedPhoto(null)}>
                <X size={20} color="#FFFFFF" />
              </GlassCircleButton>
            </SafeAreaView>
            <View style={styles.photoModalBody}>
              <Image
                source={{ uri: selectedPhoto }}
                style={styles.photoModalImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((palette) => ({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 18,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    ...typography.subhead,
  },
  notFoundWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 8,
  },
  notFoundTitle: {
    ...typography.headline,
  },
  notFoundSub: {
    ...typography.subhead,
    textAlign: 'center',
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginTop: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: {
    ...typography.caption1,
    fontWeight: '600',
  },
  confidentialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidentialText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
  heroTitle: {
    ...typography.title2,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  metadataList: {
    gap: 6,
    paddingTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    ...typography.caption1,
    fontWeight: '500',
  },
  metaVal: {
    ...typography.caption1,
    fontWeight: '600',
  },
  sectionWrap: {
    gap: 8,
  },
  sectionTitle: {
    ...typography.caption1,
    fontWeight: '600',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attachmentsWrap: {
    gap: 10,
  },
  pdfCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  pdfIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfIconText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  pdfMeta: {
    flex: 1,
    gap: 3,
  },
  pdfTitle: {
    ...typography.subhead,
    fontWeight: '600',
  },
  pdfSub: {
    ...typography.caption1,
    fontWeight: '500',
  },
  photoCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  photoThumb: {
    width: '100%',
    height: 240,
    backgroundColor: '#000000',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  photoOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  alertBannerTitle: {
    ...typography.subhead,
    fontWeight: '700',
  },
  alertBannerSub: {
    ...typography.caption1,
    lineHeight: 16,
  },
  tableCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  thCell: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  bmCellName: {
    ...typography.subhead,
    fontWeight: '600',
  },
  bmCellVal: {
    ...typography.subhead,
    fontWeight: '700',
  },
  bmCellRef: {
    ...typography.caption1,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  rxMedCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  rxMedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rxIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rxMedName: {
    ...typography.headline,
    fontWeight: '600',
  },
  rxMedDose: {
    ...typography.caption1,
    fontWeight: '500',
  },
  activeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  activeStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rxDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rxDetailText: {
    ...typography.caption1,
  },
  rxInstructionsBox: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  rxInstructionsText: {
    ...typography.caption1,
    fontStyle: 'italic',
  },
  notesCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  notesText: {
    ...typography.body,
    lineHeight: 22,
  },
  photoModalWrap: {
    flex: 1,
    backgroundColor: '#000000',
  },
  photoModalHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: 'flex-start',
    zIndex: 10,
  },
  photoModalBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoModalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
}));
