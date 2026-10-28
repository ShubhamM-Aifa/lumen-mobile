import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Plus,
  Search,
  X,
  FileBadge,
  FileText,
  TestTube2,
  Pill,
  Camera,
  Calendar,
  Building2,
  User,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { ScreenTopBar } from '../../src/components/ios/ScreenTopBar';
import { GlassCircleButton } from '../../src/components/ios/GlassCircleButton';
import { IosSegmented } from '../../src/components/ios/IosSegmented';
import { useHealthRecordStore } from '../../src/store/healthRecordStore';
import { IHealthRecord, HealthRecordType } from '../../src/shared/types';
import { safeGoBack } from '../../src/utils/navigation';

export default function RecordsScreen() {
  const styles = useStyles();
  const { palette, colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  const {
    records,
    isLoading,
    fetchRecords,
    selectedFilter,
    setFilter,
    searchQuery,
    setSearchQuery,
  } = useHealthRecordStore();

  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRecords();
    setRefreshing(false);
  };

  const handleCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/records/upload');
  };

  // Filtered & Searched Records
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      // Type match
      if (selectedFilter !== 'all' && rec.type !== selectedFilter) {
        return false;
      }

      // Query match
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const titleMatch = rec.title.toLowerCase().includes(q);
      const doctorMatch = rec.doctorName?.toLowerCase().includes(q);
      const labMatch = rec.clinicOrLab?.toLowerCase().includes(q);
      const notesMatch = rec.notes?.toLowerCase().includes(q);
      const biomarkerMatch = rec.biomarkers?.some((b) => b.name.toLowerCase().includes(q));
      const medMatch = rec.medications?.some((m) => m.name.toLowerCase().includes(q));
      const tagMatch = rec.tags?.some((t) => t.toLowerCase().includes(q));

      return (
        titleMatch ||
        doctorMatch ||
        labMatch ||
        notesMatch ||
        biomarkerMatch ||
        medMatch ||
        tagMatch
      );
    });
  }, [records, selectedFilter, searchQuery]);

  // Clinical Summary Calculations
  const summaryStats = useMemo(() => {
    let abnormalCount = 0;
    let activeMedsCount = 0;
    let labCount = 0;
    let rxCount = 0;

    for (const r of records) {
      if (r.type === 'blood_test') {
        labCount++;
        if (r.biomarkers) {
          for (const b of r.biomarkers) {
            if (b.flag && b.flag !== 'normal') {
              abnormalCount++;
            }
          }
        }
      } else if (r.type === 'doctor_prescription') {
        rxCount++;
        if (r.medications) {
          for (const m of r.medications) {
            if (m.isActive !== false) {
              activeMedsCount++;
            }
          }
        }
      }
    }

    return { abnormalCount, activeMedsCount, labCount, rxCount };
  }, [records]);

  const filterOptions: Array<{ key: HealthRecordType | 'all'; label: string }> = [
    { key: 'all', label: `All (${records.length})` },
    { key: 'blood_test', label: 'Blood 🔬' },
    { key: 'doctor_prescription', label: 'Rx 💊' },
    { key: 'imaging', label: 'Imaging 🩻' },
  ];

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
          label: 'Prescription',
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

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Bar */}
      <ScreenTopBar
        title="Health Records & Rx"
        onBack={() => safeGoBack('/(tabs)/customize')}
        right={
          <View style={styles.topRightActions}>
            <GlassCircleButton
              accessibilityLabel="Search records"
              onPress={() => {
                Haptics.selectionAsync();
                setShowSearch((prev) => !prev);
              }}
            >
              <Search size={18} color={palette.text} />
            </GlassCircleButton>
            <TouchableOpacity
              style={[styles.uploadCtaBtn, { backgroundColor: palette.tint }]}
              onPress={handleCreate}
              activeOpacity={0.85}
              accessibilityLabel="Upload report or prescription"
            >
              <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.uploadCtaText}>Upload</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.tint}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar (Collapsible) */}
        {showSearch && (
          <View style={styles.searchContainer}>
            <View style={[styles.searchBox, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Search size={16} color={palette.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: palette.text }]}
                placeholder="Search by test, doctor, lab, biomarker, med..."
                placeholderTextColor={palette.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color={palette.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Clinical Summary Banner */}
        <View style={[styles.summaryCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: palette.text }]}>{records.length}</Text>
            <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>Total Records</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: palette.border }]} />
          <View style={styles.summaryItem}>
            <Text
              style={[
                styles.summaryVal,
                { color: summaryStats.abnormalCount > 0 ? palette.error : palette.text },
              ]}
            >
              {summaryStats.abnormalCount}
            </Text>
            <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>Flagged Labs</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: palette.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: palette.success }]}>
              {summaryStats.activeMedsCount}
            </Text>
            <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>Active Rx Meds</Text>
          </View>
        </View>

        {/* Segmented Filter */}
        <View style={styles.segmentedWrap}>
          <IosSegmented
            options={filterOptions}
            value={selectedFilter}
            onChange={(val) => {
              Haptics.selectionAsync();
              setFilter(val);
            }}
          />
        </View>

        {/* Loading Spinner */}
        {isLoading && records.length === 0 && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={palette.tint} />
            <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
              Syncing clinical records...
            </Text>
          </View>
        )}

        {/* Empty State */}
        {!isLoading && filteredRecords.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.2)' : 'rgba(2, 132, 199, 0.1)' }]}>
              <FileBadge size={36} color="#0284C7" />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              {searchQuery ? 'No matching records' : 'No records yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
              {searchQuery
                ? 'Try searching for another biomarker, test name, or doctor.'
                : 'Safely store, organize, and extract insights from your blood tests, lab panels, and doctor prescriptions.'}
            </Text>
            {!searchQuery && (
              <View style={styles.emptyActions}>
                <TouchableOpacity
                  style={[styles.emptyCta, { backgroundColor: palette.tint }]}
                  onPress={handleCreate}
                >
                  <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.emptyCtaText}>Upload First Document</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Records List */}
        {filteredRecords.map((rec) => {
          const meta = getTypeMeta(rec.type);
          const Icon = meta.icon;
          const hasFiles = (rec.fileUrls && rec.fileUrls.length > 0) || (rec.localFileUris && rec.localFileUris.length > 0);
          const outOfRangeBiomarkers = rec.biomarkers?.filter((b) => b.flag && b.flag !== 'normal') || [];

          return (
            <TouchableOpacity
              key={rec._id}
              style={[styles.recordCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/records/${rec._id}`);
              }}
              activeOpacity={0.82}
            >
              {/* Header row: Type badge & Date */}
              <View style={styles.cardHeaderRow}>
                <View style={[styles.typeBadge, { backgroundColor: meta.bgColor }]}>
                  <Icon size={13} color={meta.color} />
                  <Text style={[styles.typeBadgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>

                <View style={styles.dateWrap}>
                  <Calendar size={12} color={palette.textSecondary} />
                  <Text style={[styles.dateText, { color: palette.textSecondary }]}>
                    {formatDate(rec.date)}
                  </Text>
                </View>
              </View>

              {/* Title */}
              <Text style={[styles.recordTitle, { color: palette.text }]} numberOfLines={2}>
                {rec.title}
              </Text>

              {/* Doctor & Lab details */}
              {(rec.doctorName || rec.clinicOrLab) && (
                <View style={styles.providerRow}>
                  {rec.doctorName && (
                    <View style={styles.providerItem}>
                      <User size={13} color={palette.textSecondary} />
                      <Text style={[styles.providerText, { color: palette.textSecondary }]} numberOfLines={1}>
                        {rec.doctorName}
                      </Text>
                    </View>
                  )}
                  {rec.doctorName && rec.clinicOrLab && (
                    <Text style={{ color: palette.placeholder, marginHorizontal: 4 }}>•</Text>
                  )}
                  {rec.clinicOrLab && (
                    <View style={styles.providerItem}>
                      <Building2 size={13} color={palette.textSecondary} />
                      <Text style={[styles.providerText, { color: palette.textSecondary }]} numberOfLines={1}>
                        {rec.clinicOrLab}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Biomarker High/Low Highlights (for Blood Tests) */}
              {rec.type === 'blood_test' && rec.biomarkers && rec.biomarkers.length > 0 && (
                <View style={styles.biomarkerPreviewWrap}>
                  {outOfRangeBiomarkers.length > 0 ? (
                    <View style={styles.pillRow}>
                      {outOfRangeBiomarkers.slice(0, 3).map((bm, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.flaggedPill,
                            {
                              backgroundColor:
                                bm.flag === 'high' || bm.flag === 'critical'
                                  ? isDark
                                    ? 'rgba(239, 68, 68, 0.2)'
                                    : 'rgba(239, 68, 68, 0.1)'
                                  : isDark
                                  ? 'rgba(59, 130, 246, 0.2)'
                                  : 'rgba(59, 130, 246, 0.1)',
                            },
                          ]}
                        >
                          <AlertCircle
                            size={11}
                            color={bm.flag === 'high' || bm.flag === 'critical' ? palette.error : palette.tint}
                          />
                          <Text
                            style={[
                              styles.flaggedPillText,
                              {
                                color:
                                  bm.flag === 'high' || bm.flag === 'critical'
                                    ? palette.error
                                    : palette.tint,
                              },
                            ]}
                          >
                            {bm.name.split(' ')[0]}: {bm.value} {bm.unit || ''} ({((bm.flag || 'high')).toUpperCase()})
                          </Text>
                        </View>
                      ))}
                      {outOfRangeBiomarkers.length > 3 && (
                        <Text style={[styles.morePillsText, { color: palette.placeholder }]}>
                          +{outOfRangeBiomarkers.length - 3} more flagged
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View style={styles.normalPill}>
                      <CheckCircle2 size={12} color={palette.success} />
                      <Text style={[styles.normalPillText, { color: palette.success }]}>
                        {rec.biomarkers.length} biomarker{rec.biomarkers.length > 1 ? 's' : ''} logged (Normal)
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Prescription Med Highlights */}
              {rec.type === 'doctor_prescription' && rec.medications && rec.medications.length > 0 && (
                <View style={styles.medPreviewWrap}>
                  <View style={styles.pillRow}>
                    {rec.medications.slice(0, 2).map((m, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.medPill,
                          {
                            backgroundColor: isDark
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(16, 185, 129, 0.1)',
                          },
                        ]}
                      >
                        <Pill size={11} color={palette.success} />
                        <Text style={[styles.medPillText, { color: palette.success }]} numberOfLines={1}>
                          {m.name} {m.dosage ? `(${m.dosage})` : ''}
                        </Text>
                      </View>
                    ))}
                    {rec.medications.length > 2 && (
                      <Text style={[styles.morePillsText, { color: palette.placeholder }]}>
                        +{rec.medications.length - 2} more
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Bottom footer: Attachments & Chevron */}
              <View style={[styles.cardFooter, { borderTopColor: palette.border }]}>
                <View style={styles.footerLeft}>
                  {hasFiles ? (
                    <View style={styles.fileIndicator}>
                      <FileBadge size={13} color={palette.tint} />
                      <Text style={[styles.fileIndicatorText, { color: palette.tint }]}>
                        Attachment available
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.noFileText, { color: palette.placeholder }]}>
                      Clinical notes only
                    </Text>
                  )}
                </View>

                <View style={styles.footerRight}>
                  <Text style={[styles.viewDetailsText, { color: palette.textSecondary }]}>
                    Review
                  </Text>
                  <ChevronRight size={14} color={palette.textSecondary} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
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
  uploadCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  uploadCtaText: {
    ...typography.subhead,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  searchContainer: {
    marginTop: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    padding: 0,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  summaryItem: {
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  summaryVal: {
    ...typography.title2,
    fontWeight: '700',
  },
  summaryLabel: {
    ...typography.caption1,
    fontWeight: '500',
  },
  summaryDivider: {
    width: 1,
    height: 28,
  },
  segmentedWrap: {
    marginVertical: 4,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    ...typography.subhead,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 10,
    gap: 10,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    ...typography.headline,
    fontWeight: '700',
  },
  emptySubtitle: {
    ...typography.subhead,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  emptyActions: {
    marginTop: 10,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
  },
  emptyCtaText: {
    ...typography.subhead,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  recordCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeaderRow: {
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
  dateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    ...typography.caption1,
  },
  recordTitle: {
    ...typography.headline,
    fontWeight: '600',
    fontSize: 17,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  providerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  providerText: {
    ...typography.caption1,
  },
  biomarkerPreviewWrap: {
    marginTop: 2,
  },
  medPreviewWrap: {
    marginTop: 2,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  flaggedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  flaggedPillText: {
    ...typography.caption2,
    fontWeight: '600',
  },
  normalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  normalPillText: {
    ...typography.caption1,
    fontWeight: '500',
  },
  medPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  medPillText: {
    ...typography.caption2,
    fontWeight: '600',
  },
  morePillsText: {
    ...typography.caption2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 2,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  fileIndicatorText: {
    ...typography.caption1,
    fontWeight: '500',
  },
  noFileText: {
    ...typography.caption1,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailsText: {
    ...typography.caption1,
  },
}));
