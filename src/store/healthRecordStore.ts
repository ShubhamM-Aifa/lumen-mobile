import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IHealthRecord, HealthRecordType, IBiomarker, IPrescribedMedication } from '../shared/types';
import { api } from '../api/client';

const HEALTH_RECORDS_CACHE_KEY = 'lumen:health_records:cache_v1';

export interface LabPanelPreset {
  name: string;
  category: string;
  icon: string;
  description: string;
  defaultBiomarkers: Array<{
    name: string;
    unit: string;
    referenceRange: string;
  }>;
}

export const LAB_PANEL_PRESETS: LabPanelPreset[] = [
  {
    name: 'Inflammatory Markers (CRP & ESR)',
    category: 'Autoimmune & Inflammation',
    icon: '🔥',
    description: 'Systemic inflammation markers used in chronic illness, flares, and autoimmune tracking.',
    defaultBiomarkers: [
      { name: 'C-Reactive Protein (CRP)', unit: 'mg/L', referenceRange: '< 3.0' },
      { name: 'High-Sensitivity CRP (hs-CRP)', unit: 'mg/L', referenceRange: '< 1.0' },
      { name: 'Erythrocyte Sedimentation Rate (ESR)', unit: 'mm/hr', referenceRange: '0 - 20' },
    ],
  },
  {
    name: 'Complete Blood Count (CBC)',
    category: 'General Hematology',
    icon: '🩸',
    description: 'White blood cells, red blood cells, hemoglobin, and platelets.',
    defaultBiomarkers: [
      { name: 'White Blood Cell Count (WBC)', unit: 'x10^3/uL', referenceRange: '4.5 - 11.0' },
      { name: 'Red Blood Cell Count (RBC)', unit: 'x10^6/uL', referenceRange: '4.2 - 5.8' },
      { name: 'Hemoglobin (Hgb)', unit: 'g/dL', referenceRange: '12.0 - 16.5' },
      { name: 'Hematocrit (Hct)', unit: '%', referenceRange: '36.0 - 48.0' },
      { name: 'Platelets', unit: 'x10^3/uL', referenceRange: '150 - 450' },
    ],
  },
  {
    name: 'Autoimmune Panel (ANA & RF)',
    category: 'Rheumatology',
    icon: '🛡️',
    description: 'Antinuclear antibodies and rheumatoid factor for connective tissue evaluation.',
    defaultBiomarkers: [
      { name: 'ANA (Antinuclear Antibodies)', unit: 'Titer', referenceRange: 'Negative (< 1:40)' },
      { name: 'Rheumatoid Factor (RF)', unit: 'IU/mL', referenceRange: '< 14' },
      { name: 'Complement C3', unit: 'mg/dL', referenceRange: '90 - 180' },
      { name: 'Complement C4', unit: 'mg/dL', referenceRange: '10 - 40' },
    ],
  },
  {
    name: 'Comprehensive Metabolic Panel (CMP)',
    category: 'Organ Function',
    icon: '🧪',
    description: 'Kidney and liver function, glucose, and electrolyte balance.',
    defaultBiomarkers: [
      { name: 'Fasting Glucose', unit: 'mg/dL', referenceRange: '70 - 99' },
      { name: 'Creatinine', unit: 'mg/dL', referenceRange: '0.6 - 1.2' },
      { name: 'BUN (Blood Urea Nitrogen)', unit: 'mg/dL', referenceRange: '7 - 20' },
      { name: 'eGFR', unit: 'mL/min/1.73m2', referenceRange: '> 60' },
      { name: 'ALT (Alanine Aminotransferase)', unit: 'U/L', referenceRange: '7 - 56' },
      { name: 'AST (Aspartate Aminotransferase)', unit: 'U/L', referenceRange: '10 - 40' },
      { name: 'Sodium', unit: 'mEq/L', referenceRange: '135 - 145' },
      { name: 'Potassium', unit: 'mEq/L', referenceRange: '3.5 - 5.0' },
    ],
  },
  {
    name: 'Thyroid Function (TSH & Free T4)',
    category: 'Endocrinology',
    icon: '🦋',
    description: 'Thyroid stimulation and hormone levels for energy and metabolism.',
    defaultBiomarkers: [
      { name: 'TSH (Thyroid Stimulating Hormone)', unit: 'mIU/L', referenceRange: '0.45 - 4.50' },
      { name: 'Free T4 (Thyroxine)', unit: 'ng/dL', referenceRange: '0.8 - 1.8' },
      { name: 'Free T3 (Triiodothyronine)', unit: 'pg/mL', referenceRange: '2.3 - 4.2' },
    ],
  },
  {
    name: 'Iron & Micronutrient Panel',
    category: 'Nutrition & Energy',
    icon: '⚡',
    description: 'Ferritin stores, Vitamin D, and B12 essential for fatigue investigations.',
    defaultBiomarkers: [
      { name: 'Ferritin', unit: 'ng/mL', referenceRange: '30 - 300' },
      { name: 'Iron Saturation', unit: '%', referenceRange: '20 - 50' },
      { name: 'Vitamin D, 25-Hydroxy', unit: 'ng/mL', referenceRange: '30 - 100' },
      { name: 'Vitamin B12', unit: 'pg/mL', referenceRange: '200 - 900' },
      { name: 'Magnesium', unit: 'mg/dL', referenceRange: '1.7 - 2.2' },
    ],
  },
];

export interface HealthRecordState {
  records: IHealthRecord[];
  activeRecord: IHealthRecord | null;
  selectedFilter: HealthRecordType | 'all';
  searchQuery: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchRecords: () => Promise<void>;
  fetchRecordById: (id: string) => Promise<IHealthRecord | null>;
  createRecord: (record: Partial<IHealthRecord>) => Promise<IHealthRecord>;
  updateRecord: (id: string, updates: Partial<IHealthRecord>) => Promise<IHealthRecord>;
  deleteRecord: (id: string) => Promise<void>;
  setFilter: (filter: HealthRecordType | 'all') => void;
  setSearchQuery: (query: string) => void;
  setActiveRecord: (record: IHealthRecord | null) => void;
}

export const useHealthRecordStore = create<HealthRecordState>((set, get) => ({
  records: [],
  activeRecord: null,
  selectedFilter: 'all',
  searchQuery: '',
  isLoading: false,
  error: null,

  fetchRecords: async () => {
    set({ isLoading: true, error: null });

    // 1. Fast cache hydrate from local storage
    try {
      const cached = await AsyncStorage.getItem(HEALTH_RECORDS_CACHE_KEY);
      if (cached) {
        set({ records: JSON.parse(cached) });
      }
    } catch {}

    // 2. Sync from backend API
    try {
      const res = await api.get<any>('/records');
      const data = Array.isArray(res) ? res : res?.data;
      if (Array.isArray(data)) {
        set({ records: data });
        await AsyncStorage.setItem(HEALTH_RECORDS_CACHE_KEY, JSON.stringify(data));
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to sync records from server' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchRecordById: async (id: string) => {
    const local = get().records.find((r) => r._id === id);
    if (local) {
      set({ activeRecord: local });
    }

    try {
      const res = await api.get<any>(`/records/${id}`);
      const data = res?.data || res;
      if (data && data._id) {
        set({ activeRecord: data });
        // Update local array item
        set((state) => ({
          records: state.records.map((r) => (r._id === id ? data : r)),
        }));
        return data;
      }
    } catch {}

    return local || null;
  },

  createRecord: async (recordData: Partial<IHealthRecord>) => {
    set({ isLoading: true, error: null });
    try {
      // Optimistic temporary ID
      const tempId = `temp_${Date.now()}`;
      const optimisticRecord: IHealthRecord = {
        _id: tempId,
        userId: 'current_user',
        title: recordData.title || 'Untitled Record',
        type: recordData.type || 'blood_test',
        date: recordData.date || new Date().toISOString(),
        doctorName: recordData.doctorName,
        clinicOrLab: recordData.clinicOrLab,
        mediaIds: recordData.mediaIds || [],
        fileUrls: recordData.fileUrls || [],
        localFileUris: recordData.localFileUris || [],
        fileNames: recordData.fileNames || [],
        notes: recordData.notes,
        isSensitive: recordData.isSensitive || false,
        biomarkers: recordData.biomarkers || [],
        medications: recordData.medications || [],
        tags: recordData.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set((state) => ({
        records: [optimisticRecord, ...state.records],
      }));

      // Send to server
      const res = await api.post<any>('/records', recordData);
      const serverRecord: IHealthRecord = res?.data || res;

      if (serverRecord && serverRecord._id) {
        const mergedRecord = {
          ...serverRecord,
          localFileUris: recordData.localFileUris || serverRecord.localFileUris,
        };

        set((state) => {
          const updated = state.records.map((r) => (r._id === tempId ? mergedRecord : r));
          AsyncStorage.setItem(HEALTH_RECORDS_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
          return { records: updated };
        });

        return mergedRecord;
      }

      return optimisticRecord;
    } catch (err: any) {
      set({ error: err.message || 'Failed to save health record' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateRecord: async (id: string, updates: Partial<IHealthRecord>) => {
    // Optimistic update
    set((state) => {
      const updated = state.records.map((r) =>
        r._id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r,
      );
      AsyncStorage.setItem(HEALTH_RECORDS_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
      return { records: updated };
    });

    try {
      const res = await api.patch<any>(`/records/${id}`, updates);
      const serverRecord = res?.data || res;
      if (serverRecord && serverRecord._id) {
        set((state) => ({
          records: state.records.map((r) => (r._id === id ? serverRecord : r)),
          activeRecord: state.activeRecord?._id === id ? serverRecord : state.activeRecord,
        }));
        return serverRecord;
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to update record on server' });
    }

    return get().records.find((r) => r._id === id)!;
  },

  deleteRecord: async (id: string) => {
    // Optimistic remove
    set((state) => {
      const filtered = state.records.filter((r) => r._id !== id);
      AsyncStorage.setItem(HEALTH_RECORDS_CACHE_KEY, JSON.stringify(filtered)).catch(() => {});
      return {
        records: filtered,
        activeRecord: state.activeRecord?._id === id ? null : state.activeRecord,
      };
    });

    try {
      await api.delete(`/records/${id}`);
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete record on server' });
    }
  },

  setFilter: (filter: HealthRecordType | 'all') => {
    set({ selectedFilter: filter });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setActiveRecord: (record: IHealthRecord | null) => {
    set({ activeRecord: record });
  },
}));
