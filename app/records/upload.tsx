import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  FileBadge,
  FileText,
  Camera,
  Image as ImageIcon,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Pill,
  TestTube2,
  Building2,
  User,
  Calendar,
  Lock,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { ScreenTopBar, HeaderTextButton } from '../../src/components/ios/ScreenTopBar';
import { InsetGroup } from '../../src/components/ios/InsetGroup';
import { IosSegmented } from '../../src/components/ios/IosSegmented';
import { AppleSwitch } from '../../src/components/common/AppleSwitch';
import {
  useHealthRecordStore,
  LAB_PANEL_PRESETS,
  LabPanelPreset,
} from '../../src/store/healthRecordStore';
import {
  HealthRecordType,
  IBiomarker,
  IPrescribedMedication,
  IHealthRecord,
} from '../../src/shared/types';
import { uploadMedia } from '../../src/services/mediaUpload';
import { api } from '../../src/api/client';
import { safeGoBack } from '../../src/utils/navigation';

interface AttachedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

export default function RecordUploadScreen() {
  const styles = useStyles();
  const { palette, colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  const { createRecord } = useHealthRecordStore();

  // Form State
  const [recordType, setRecordType] = useState<HealthRecordType>('blood_test');
  const [title, setTitle] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [clinicOrLab, setClinicOrLab] = useState('');
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSensitive, setIsSensitive] = useState(false);
  const [syncToMedTracker, setSyncToMedTracker] = useState(true);

  // Attachments
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  // Clinical Details
  const [biomarkers, setBiomarkers] = useState<IBiomarker[]>([]);
  const [medications, setMedications] = useState<IPrescribedMedication[]>([]);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Type Segmented Options
  const typeOptions: Array<{ key: HealthRecordType; label: string }> = [
    { key: 'blood_test', label: 'Blood 🔬' },
    { key: 'doctor_prescription', label: 'Rx 💊' },
    { key: 'imaging', label: 'Imaging 🩻' },
    { key: 'doctor_note', label: 'Note 📋' },
  ];

  // Document Picker (PDF / Docs)
  const pickDocument = async () => {
    try {
      Haptics.selectionAsync();
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const newFile: AttachedFile = {
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || 'application/pdf',
          size: asset.size,
        };
        setAttachedFiles((prev) => [...prev, newFile]);

        // Auto-suggest title if empty
        if (!title.trim()) {
          const cleanName = asset.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          setTitle(cleanName);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', 'Unable to pick document: ' + err.message);
    }
  };

  // Camera Picker
  const pickCamera = async () => {
    try {
      Haptics.selectionAsync();
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is needed to photograph medical reports.');
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        quality: 0.9,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const newFile: AttachedFile = {
          uri: asset.uri,
          name: `Scan_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        };
        setAttachedFiles((prev) => [...prev, newFile]);

        if (!title.trim()) {
          setTitle(
            recordType === 'blood_test'
              ? 'Blood Test Report'
              : recordType === 'doctor_prescription'
              ? 'Doctor Prescription'
              : 'Clinical Scan',
          );
        }
      }
    } catch (err: any) {
      Alert.alert('Error', 'Camera capture failed: ' + err.message);
    }
  };

  // Photo Library Picker
  const pickGallery = async () => {
    try {
      Haptics.selectionAsync();
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsMultipleSelection: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const newFiles: AttachedFile[] = res.assets.map((asset, i) => ({
          uri: asset.uri,
          name: asset.fileName || `Photo_${Date.now()}_${i}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        }));
        setAttachedFiles((prev) => [...prev, ...newFiles]);

        if (!title.trim()) {
          setTitle(
            recordType === 'blood_test'
              ? 'Blood Test Results'
              : recordType === 'doctor_prescription'
              ? 'Prescription Photo'
              : 'Medical Document',
          );
        }
      }
    } catch (err: any) {
      Alert.alert('Error', 'Photo selection failed: ' + err.message);
    }
  };

  const removeFile = (index: number) => {
    Haptics.selectionAsync();
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Apply Biomarker Preset Panel
  const applyPresetPanel = (preset: LabPanelPreset) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newItems: IBiomarker[] = preset.defaultBiomarkers.map((b) => ({
      name: b.name,
      value: '',
      unit: b.unit,
      referenceRange: b.referenceRange,
      flag: 'normal',
    }));

    // Avoid duplicates
    const existingNames = new Set(biomarkers.map((b) => b.name.toLowerCase()));
    const filteredNew = newItems.filter((b) => !existingNames.has(b.name.toLowerCase()));

    setBiomarkers((prev) => [...prev, ...filteredNew]);

    if (!title.trim()) {
      setTitle(preset.name);
    }
  };

  const addCustomBiomarker = () => {
    Haptics.selectionAsync();
    setBiomarkers((prev) => [
      ...prev,
      { name: '', value: '', unit: '', referenceRange: '', flag: 'normal' },
    ]);
  };

  const updateBiomarker = (index: number, updates: Partial<IBiomarker>) => {
    setBiomarkers((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item)),
    );
  };

  const removeBiomarker = (index: number) => {
    Haptics.selectionAsync();
    setBiomarkers((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Prescription Med Actions
  const addPrescriptionMed = () => {
    Haptics.selectionAsync();
    setMedications((prev) => [
      ...prev,
      { name: '', dosage: '', frequency: '', instructions: '', isActive: true },
    ]);
  };

  const updateMedication = (index: number, updates: Partial<IPrescribedMedication>) => {
    setMedications((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item)),
    );
  };

  const removeMedication = (index: number) => {
    Haptics.selectionAsync();
    setMedications((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Save Record
  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title for this health record.');
      return;
    }

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const mediaIds: string[] = [];
      const fileUrls: string[] = [];
      const localFileUris: string[] = [];
      const fileNames: string[] = [];

      // 1. Upload attached files
      for (const file of attachedFiles) {
        localFileUris.push(file.uri);
        fileNames.push(file.name);
        try {
          const uploadRes = await uploadMedia(file.uri, file.mimeType, isSensitive);
          if (uploadRes.mediaId) {
            mediaIds.push(uploadRes.mediaId);
          }
          if (uploadRes.url) {
            fileUrls.push(uploadRes.url);
          }
        } catch {
          // If server upload fails (e.g. offline), localFileUris ensures offline accessibility!
        }
      }

      // 2. Clean biomarkers (strip empty rows)
      const validBiomarkers = biomarkers.filter((b) => b.name.trim().length > 0);

      // 3. Clean medications
      const validMedications = medications.filter((m) => m.name.trim().length > 0);

      // 4. Save record
      const payload: Partial<IHealthRecord> = {
        title: title.trim(),
        type: recordType,
        date: new Date(recordDate).toISOString(),
        doctorName: doctorName.trim() || undefined,
        clinicOrLab: clinicOrLab.trim() || undefined,
        mediaIds,
        fileUrls,
        localFileUris,
        fileNames,
        notes: notes.trim() || undefined,
        isSensitive,
        biomarkers: validBiomarkers,
        medications: validMedications,
      };

      await createRecord(payload);

      // 5. If prescription and syncToMedTracker is checked, create in medications collection
      if (recordType === 'doctor_prescription' && syncToMedTracker && validMedications.length > 0) {
        for (const med of validMedications) {
          try {
            await api.post('/medications', {
              name: med.name.trim(),
              dose: med.dosage?.trim() || undefined,
              schedule: med.frequency?.trim() || undefined,
              active: med.isActive !== false,
              startedOn: recordDate,
            });
          } catch {
            // Non-blocking medication sync
          }
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      safeGoBack('/records');
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Unable to save record. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Bar */}
      <ScreenTopBar
        title="Upload Health Record"
        backIcon="close"
        onBack={() => safeGoBack('/records')}
        fallbackRoute="/records"
        right={
          <HeaderTextButton
            label="Save"
            prominent
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving}
          />
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Record Type Selector */}
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
              RECORD CATEGORY
            </Text>
            <IosSegmented
              options={typeOptions}
              value={recordType}
              onChange={(val) => {
                Haptics.selectionAsync();
                setRecordType(val);
              }}
            />
          </View>

          {/* Document Ingestion Sources */}
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
              DOCUMENT OR PRESCRIPTION FILE
            </Text>

            <View style={styles.uploadRow}>
              {/* PDF Document */}
              <TouchableOpacity
                style={[styles.uploadTile, { backgroundColor: palette.surface, borderColor: palette.border }]}
                onPress={pickDocument}
                activeOpacity={0.8}
              >
                <View style={[styles.uploadTileIcon, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)' }]}>
                  <FileBadge size={22} color="#EF4444" />
                </View>
                <Text style={[styles.uploadTileText, { color: palette.text }]}>Upload PDF</Text>
                <Text style={[styles.uploadTileSub, { color: palette.textSecondary }]}>
                  Lab & Rx files
                </Text>
              </TouchableOpacity>

              {/* Camera Scanner */}
              <TouchableOpacity
                style={[styles.uploadTile, { backgroundColor: palette.surface, borderColor: palette.border }]}
                onPress={pickCamera}
                activeOpacity={0.8}
              >
                <View style={[styles.uploadTileIcon, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.2)' : 'rgba(2, 132, 199, 0.1)' }]}>
                  <Camera size={22} color="#0284C7" />
                </View>
                <Text style={[styles.uploadTileText, { color: palette.text }]}>Scan Camera</Text>
                <Text style={[styles.uploadTileSub, { color: palette.textSecondary }]}>
                  Snap paper doc
                </Text>
              </TouchableOpacity>

              {/* Photo Gallery */}
              <TouchableOpacity
                style={[styles.uploadTile, { backgroundColor: palette.surface, borderColor: palette.border }]}
                onPress={pickGallery}
                activeOpacity={0.8}
              >
                <View style={[styles.uploadTileIcon, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)' }]}>
                  <ImageIcon size={22} color="#10B981" />
                </View>
                <Text style={[styles.uploadTileText, { color: palette.text }]}>Photo Library</Text>
                <Text style={[styles.uploadTileSub, { color: palette.textSecondary }]}>
                  Saved images
                </Text>
              </TouchableOpacity>
            </View>

            {/* Attached Files List */}
            {attachedFiles.length > 0 && (
              <View style={styles.filesList}>
                {attachedFiles.map((file, idx) => (
                  <View
                    key={idx}
                    style={[styles.fileItemCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
                  >
                    {file.mimeType.includes('pdf') ? (
                      <View style={styles.pdfBadgeIcon}>
                        <Text style={styles.pdfBadgeText}>PDF</Text>
                      </View>
                    ) : (
                      <Image source={{ uri: file.uri }} style={styles.imageThumb} />
                    )}

                    <View style={styles.fileMeta}>
                      <Text style={[styles.fileName, { color: palette.text }]} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text style={[styles.fileSize, { color: palette.textSecondary }]}>
                        {file.mimeType}
                        {file.size ? ` • ${(file.size / 1024).toFixed(0)} KB` : ''}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => removeFile(idx)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.fileDeleteBtn}
                    >
                      <X size={16} color={palette.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Clinical Details Form */}
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
              REPORT & PRESCRIBER DETAILS
            </Text>

            <View style={[styles.formCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              {/* Title */}
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Title</Text>
                <TextInput
                  style={[styles.fieldInput, { color: palette.text }]}
                  placeholder="e.g. Comprehensive Metabolic Panel, Methotrexate Rx"
                  placeholderTextColor={palette.placeholder}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              <View style={[styles.fieldDivider, { backgroundColor: palette.border }]} />

              {/* Date */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldLabelWrap}>
                  <Calendar size={15} color={palette.textSecondary} />
                  <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Date (YYYY-MM-DD)</Text>
                </View>
                <TextInput
                  style={[styles.fieldInput, { color: palette.text }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={palette.placeholder}
                  value={recordDate}
                  onChangeText={setRecordDate}
                />
              </View>

              <View style={[styles.fieldDivider, { backgroundColor: palette.border }]} />

              {/* Doctor Name */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldLabelWrap}>
                  <User size={15} color={palette.textSecondary} />
                  <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Doctor / Provider</Text>
                </View>
                <TextInput
                  style={[styles.fieldInput, { color: palette.text }]}
                  placeholder="e.g. Dr. Sarah Chen, MD"
                  placeholderTextColor={palette.placeholder}
                  value={doctorName}
                  onChangeText={setDoctorName}
                />
              </View>

              <View style={[styles.fieldDivider, { backgroundColor: palette.border }]} />

              {/* Clinic or Lab */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldLabelWrap}>
                  <Building2 size={15} color={palette.textSecondary} />
                  <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Clinic / Lab</Text>
                </View>
                <TextInput
                  style={[styles.fieldInput, { color: palette.text }]}
                  placeholder="e.g. Quest Diagnostics, Mayo Clinic"
                  placeholderTextColor={palette.placeholder}
                  value={clinicOrLab}
                  onChangeText={setClinicOrLab}
                />
              </View>
            </View>
          </View>

          {/* Blood Test Biomarkers Section */}
          {recordType === 'blood_test' && (
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
                  LAB BIOMARKERS & RESULTS
                </Text>
                <TouchableOpacity
                  style={[styles.addInlineBtn, { backgroundColor: palette.tint }]}
                  onPress={addCustomBiomarker}
                >
                  <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.addInlineBtnText}>Add Biomarker</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Fill Presets Chips */}
              <Text style={[styles.presetHelperText, { color: palette.placeholder }]}>
                Quick-fill standard test panels:
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetScroll}
              >
                {LAB_PANEL_PRESETS.map((preset, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.presetChip,
                      { backgroundColor: palette.surface, borderColor: palette.border },
                    ]}
                    onPress={() => applyPresetPanel(preset)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.presetIcon}>{preset.icon}</Text>
                    <Text style={[styles.presetName, { color: palette.text }]}>{preset.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Biomarkers Table Editor */}
              {biomarkers.length > 0 && (
                <View style={styles.biomarkerTable}>
                  {biomarkers.map((bm, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.biomarkerCard,
                        { backgroundColor: palette.surface, borderColor: palette.border },
                      ]}
                    >
                      <View style={styles.bmHeader}>
                        <TextInput
                          style={[styles.bmNameInput, { color: palette.text }]}
                          placeholder="Biomarker name (e.g. CRP, Hemoglobin)"
                          placeholderTextColor={palette.placeholder}
                          value={bm.name}
                          onChangeText={(txt) => updateBiomarker(idx, { name: txt })}
                        />
                        <TouchableOpacity
                          onPress={() => removeBiomarker(idx)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={16} color={palette.error} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.bmInputsRow}>
                        {/* Value */}
                        <View style={styles.bmInputCol}>
                          <Text style={[styles.bmInputSub, { color: palette.textSecondary }]}>Value</Text>
                          <TextInput
                            style={[
                              styles.bmValInput,
                              {
                                color:
                                  bm.flag === 'high' || bm.flag === 'critical'
                                    ? palette.error
                                    : bm.flag === 'low'
                                    ? palette.tint
                                    : palette.text,
                                borderColor: palette.border,
                              },
                            ]}
                            placeholder="e.g. 14.2"
                            placeholderTextColor={palette.placeholder}
                            value={bm.value}
                            onChangeText={(txt) => updateBiomarker(idx, { value: txt })}
                          />
                        </View>

                        {/* Unit */}
                        <View style={styles.bmInputCol}>
                          <Text style={[styles.bmInputSub, { color: palette.textSecondary }]}>Unit</Text>
                          <TextInput
                            style={[styles.bmValInput, { color: palette.text, borderColor: palette.border }]}
                            placeholder="mg/L"
                            placeholderTextColor={palette.placeholder}
                            value={bm.unit || ''}
                            onChangeText={(txt) => updateBiomarker(idx, { unit: txt })}
                          />
                        </View>

                        {/* Normal Range */}
                        <View style={[styles.bmInputCol, { flex: 1.4 }]}>
                          <Text style={[styles.bmInputSub, { color: palette.textSecondary }]}>Reference Range</Text>
                          <TextInput
                            style={[styles.bmValInput, { color: palette.text, borderColor: palette.border }]}
                            placeholder="< 3.0"
                            placeholderTextColor={palette.placeholder}
                            value={bm.referenceRange || ''}
                            onChangeText={(txt) => updateBiomarker(idx, { referenceRange: txt })}
                          />
                        </View>
                      </View>

                      {/* Flag selector pills */}
                      <View style={styles.flagSelectorRow}>
                        <Text style={[styles.bmInputSub, { color: palette.textSecondary, marginRight: 6 }]}>
                          Flag:
                        </Text>
                        {(['normal', 'high', 'low', 'critical'] as const).map((flagOpt) => {
                          const isSel = (bm.flag || 'normal') === flagOpt;
                          const flagColor =
                            flagOpt === 'normal'
                              ? palette.success
                              : flagOpt === 'high'
                              ? palette.error
                              : flagOpt === 'low'
                              ? palette.tint
                              : '#9333EA';

                          return (
                            <TouchableOpacity
                              key={flagOpt}
                              style={[
                                styles.flagChip,
                                {
                                  backgroundColor: isSel
                                    ? flagColor
                                    : isDark
                                    ? 'rgba(255,255,255,0.06)'
                                    : 'rgba(0,0,0,0.04)',
                                  borderColor: isSel ? flagColor : palette.border,
                                },
                              ]}
                              onPress={() => {
                                Haptics.selectionAsync();
                                updateBiomarker(idx, { flag: flagOpt });
                              }}
                            >
                              <Text
                                style={[
                                  styles.flagChipText,
                                  { color: isSel ? '#FFFFFF' : palette.textSecondary },
                                ]}
                              >
                                {flagOpt.toUpperCase()}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Doctor Prescription Medications Section */}
          {recordType === 'doctor_prescription' && (
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
                  PRESCRIBED MEDICATIONS
                </Text>
                <TouchableOpacity
                  style={[styles.addInlineBtn, { backgroundColor: palette.tint }]}
                  onPress={addPrescriptionMed}
                >
                  <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.addInlineBtnText}>Add Medication</Text>
                </TouchableOpacity>
              </View>

              {/* Medication Cards Editor */}
              {medications.map((med, idx) => (
                <View
                  key={idx}
                  style={[styles.medCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
                >
                  <View style={styles.bmHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Pill size={16} color={palette.success} />
                      <TextInput
                        style={[styles.bmNameInput, { color: palette.text }]}
                        placeholder="Medication name (e.g. Prednisone, Methotrexate)"
                        placeholderTextColor={palette.placeholder}
                        value={med.name}
                        onChangeText={(txt) => updateMedication(idx, { name: txt })}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => removeMedication(idx)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={16} color={palette.error} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.bmInputsRow}>
                    <View style={styles.bmInputCol}>
                      <Text style={[styles.bmInputSub, { color: palette.textSecondary }]}>Dosage</Text>
                      <TextInput
                        style={[styles.bmValInput, { color: palette.text, borderColor: palette.border }]}
                        placeholder="e.g. 15 mg"
                        placeholderTextColor={palette.placeholder}
                        value={med.dosage || ''}
                        onChangeText={(txt) => updateMedication(idx, { dosage: txt })}
                      />
                    </View>

                    <View style={[styles.bmInputCol, { flex: 1.5 }]}>
                      <Text style={[styles.bmInputSub, { color: palette.textSecondary }]}>Frequency</Text>
                      <TextInput
                        style={[styles.bmValInput, { color: palette.text, borderColor: palette.border }]}
                        placeholder="e.g. Once weekly, Daily with meals"
                        placeholderTextColor={palette.placeholder}
                        value={med.frequency || ''}
                        onChangeText={(txt) => updateMedication(idx, { frequency: txt })}
                      />
                    </View>
                  </View>

                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.bmInputSub, { color: palette.textSecondary }]}>Instructions / Refills</Text>
                    <TextInput
                      style={[styles.bmValInput, { color: palette.text, borderColor: palette.border }]}
                      placeholder="e.g. Take with water. Take folic acid the following morning."
                      placeholderTextColor={palette.placeholder}
                      value={med.instructions || ''}
                      onChangeText={(txt) => updateMedication(idx, { instructions: txt })}
                    />
                  </View>
                </View>
              ))}

              {/* Sync to Lumen Medication Tracker switch */}
              <View style={[styles.switchRowCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.switchTitle, { color: palette.text }]}>
                    Add to Lumen Daily Meds
                  </Text>
                  <Text style={[styles.switchSub, { color: palette.textSecondary }]}>
                    Automatically schedules these medications into your daily tracker and reminders.
                  </Text>
                </View>
                <AppleSwitch
                  value={syncToMedTracker}
                  onValueChange={setSyncToMedTracker}
                  activeColor={palette.success}
                />
              </View>
            </View>
          )}

          {/* Clinical Notes & Instructions */}
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
              CLINICAL OBSERVATIONS & NOTES
            </Text>
            <View style={[styles.formCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <TextInput
                style={[styles.notesInput, { color: palette.text }]}
                placeholder="Add doctor recommendations, follow-up tests, questions for next appointment, or patient observations..."
                placeholderTextColor={palette.placeholder}
                multiline
                numberOfLines={4}
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Sensitive & Privacy Toggle */}
          <View style={[styles.switchRowCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={[styles.lockIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)' }]}>
                <Lock size={16} color="#EF4444" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.switchTitle, { color: palette.text }]}>Confidential / Sensitive</Text>
                <Text style={[styles.switchSub, { color: palette.textSecondary }]}>
                  Require Photo PIN / Biometrics to view this record.
                </Text>
              </View>
            </View>
            <AppleSwitch
              value={isSensitive}
              onValueChange={setIsSensitive}
              activeColor="#EF4444"
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((palette) => ({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 20,
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
    paddingHorizontal: 4,
  },
  addInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  addInlineBtnText: {
    ...typography.caption1,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  uploadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  uploadTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  uploadTileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTileText: {
    ...typography.subhead,
    fontWeight: '600',
    textAlign: 'center',
  },
  uploadTileSub: {
    ...typography.caption2,
    textAlign: 'center',
  },
  filesList: {
    marginTop: 8,
    gap: 8,
  },
  fileItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  pdfBadgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  imageThumb: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  fileMeta: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    ...typography.subhead,
    fontWeight: '600',
  },
  fileSize: {
    ...typography.caption2,
  },
  fileDeleteBtn: {
    padding: 6,
  },
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  fieldRow: {
    paddingVertical: 8,
    gap: 4,
  },
  fieldLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldLabel: {
    ...typography.caption1,
    fontWeight: '500',
  },
  fieldInput: {
    ...typography.body,
    paddingVertical: 4,
  },
  fieldDivider: {
    height: 1,
  },
  presetHelperText: {
    ...typography.caption1,
    paddingHorizontal: 4,
  },
  presetScroll: {
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetIcon: {
    fontSize: 14,
  },
  presetName: {
    ...typography.caption1,
    fontWeight: '600',
  },
  biomarkerTable: {
    gap: 10,
    marginTop: 6,
  },
  biomarkerCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  bmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bmNameInput: {
    flex: 1,
    ...typography.headline,
    fontWeight: '600',
    fontSize: 16,
    padding: 0,
  },
  bmInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bmInputCol: {
    flex: 1,
    gap: 4,
  },
  bmInputSub: {
    ...typography.caption2,
    fontWeight: '500',
  },
  bmValInput: {
    ...typography.subhead,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  flagSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  flagChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  flagChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  medCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    marginBottom: 8,
  },
  switchRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  lockIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchTitle: {
    ...typography.subhead,
    fontWeight: '600',
  },
  switchSub: {
    ...typography.caption1,
    lineHeight: 16,
  },
  notesInput: {
    ...typography.body,
    minHeight: 88,
    paddingVertical: 8,
  },
}));
