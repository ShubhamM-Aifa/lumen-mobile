import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, Check, Stethoscope, Pill } from 'lucide-react-native';
import { useConfigStore } from '../../store/configStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface HealthLinkPickerModalProps {
  visible: boolean;
  onClose: () => void;
  linkedSymptomIds: string[];
  linkedMedicationIds: string[];
  onToggleLink: (type: 'symptom' | 'medication', id: string) => void;
}

export const HealthLinkPickerModal: React.FC<HealthLinkPickerModalProps> = ({
  visible,
  onClose,
  linkedSymptomIds,
  linkedMedicationIds,
  onToggleLink,
}) => {
  const { palette } = useTheme();
  const { config } = useConfigStore();
  const [activeTab, setActiveTab] = useState<'symptoms' | 'medications'>('symptoms');

  // Extract symptoms from flat config categories, questions, and options
  const symptomCategoryIds = (config?.categories || [])
    .filter((c) => c.role === 'symptom')
    .map((c) => c._id);

  const symptomQuestionIds = (config?.questions || [])
    .filter((q) => symptomCategoryIds.includes(q.categoryId))
    .map((q) => q._id);

  let symptomList: Array<{ id: string; label: string; icon?: string }> = (
    config?.options || []
  )
    .filter((opt) => symptomQuestionIds.includes(opt.questionId))
    .map((opt) => ({
      id: opt._id,
      label: opt.label,
      icon: opt.icon || '🩺',
    }));

  if (symptomList.length === 0) {
    symptomList = [
      { id: 'sym_brain_fog', label: 'Brain Fog / Cognitive Slowness', icon: '🌫️' },
      { id: 'sym_dizziness', label: 'Orthostatic Dizziness', icon: '💫' },
      { id: 'sym_fatigue', label: 'Post-Exertional Fatigue (PEM)', icon: '⚡' },
      { id: 'sym_palpitations', label: 'Heart Palpitations / Tachycardia', icon: '🫀' },
      { id: 'sym_joint_pain', label: 'Joint & Muscle Pain', icon: '🦴' },
    ];
  }

  // Extract medications
  const medicationsList: Array<{ id: string; label: string }> = [
    { id: 'med_fludrocortisone', label: 'Fludrocortisone' },
    { id: 'med_propranolol', label: 'Propranolol' },
    { id: 'med_midodrine', label: 'Midodrine' },
    { id: 'med_ivabradine', label: 'Ivabradine' },
    { id: 'med_electrolytes', label: 'High-Sodium Electrolytes' },
    { id: 'med_ldn', label: 'Low Dose Naltrexone (LDN)' },
  ];

  const handleToggle = (type: 'symptom' | 'medication', id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleLink(type, id);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={styles.topBar}>
            <Text style={[styles.title, { color: palette.text }]}>Link Health Context</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Segment Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'symptoms' && {
                  backgroundColor: 'rgba(239, 68, 68, 0.18)',
                  borderColor: '#EF4444',
                },
              ]}
              onPress={() => setActiveTab('symptoms')}
            >
              <Stethoscope size={16} color={activeTab === 'symptoms' ? '#EF4444' : palette.textSecondary} />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'symptoms' ? '#EF4444' : palette.textSecondary },
                ]}
              >
                Symptoms ({linkedSymptomIds.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === 'medications' && {
                  backgroundColor: 'rgba(168, 85, 247, 0.18)',
                  borderColor: '#A855F7',
                },
              ]}
              onPress={() => setActiveTab('medications')}
            >
              <Pill size={16} color={activeTab === 'medications' ? '#A855F7' : palette.textSecondary} />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'medications' ? '#A855F7' : palette.textSecondary },
                ]}
              >
                Medications ({linkedMedicationIds.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* List Content */}
          <ScrollView style={styles.listArea} showsVerticalScrollIndicator={false}>
            {activeTab === 'symptoms' ? (
              symptomList.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={{ color: palette.textSecondary }}>No symptoms configured yet.</Text>
                </View>
              ) : (
                symptomList.map((sym) => {
                  const isLinked = linkedSymptomIds.includes(sym.id);
                  return (
                    <TouchableOpacity
                      key={sym.id}
                      style={[
                        styles.itemCard,
                        isLinked && { backgroundColor: 'rgba(239, 68, 68, 0.12)' },
                      ]}
                      onPress={() => handleToggle('symptom', sym.id)}
                    >
                      <Text style={styles.itemEmoji}>{sym.icon}</Text>
                      <Text style={[styles.itemLabel, { color: palette.text }]}>{sym.label}</Text>
                      <View
                        style={[
                          styles.checkbox,
                          isLinked && { backgroundColor: '#EF4444', borderColor: '#EF4444' },
                        ]}
                      >
                        {isLinked && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )
            ) : (
              medicationsList.map((med) => {
                const isLinked = linkedMedicationIds.includes(med.id);
                return (
                  <TouchableOpacity
                    key={med.id}
                    style={[
                      styles.itemCard,
                      isLinked && { backgroundColor: 'rgba(168, 85, 247, 0.12)' },
                    ]}
                    onPress={() => handleToggle('medication', med.id)}
                  >
                    <Text style={styles.itemEmoji}>💊</Text>
                    <Text style={[styles.itemLabel, { color: palette.text }]}>{med.label}</Text>
                    <View
                      style={[
                        styles.checkbox,
                        isLinked && { backgroundColor: '#A855F7', borderColor: '#A855F7' },
                      ]}
                    >
                      {isLinked && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: {
    ...typography.h3,
    fontSize: 18,
  },
  closeBtn: {
    padding: 4,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listArea: {
    paddingHorizontal: 20,
  },
  emptyBox: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  itemEmoji: {
    fontSize: 18,
    marginRight: 10,
  },
  itemLabel: {
    flex: 1,
    fontSize: 15,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
