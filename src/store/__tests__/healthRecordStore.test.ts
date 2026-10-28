import { useHealthRecordStore, LAB_PANEL_PRESETS } from '../healthRecordStore';
import { IHealthRecord } from '../../shared/types';

jest.mock('../../api/client', () => ({
  api: {
    get: jest.fn().mockImplementation((url: string) => {
      if (url === '/records') {
        return Promise.resolve([
          {
            _id: 'rec_1',
            title: 'Complete Blood Count (CBC)',
            type: 'blood_test',
            date: '2026-10-28T00:00:00.000Z',
            doctorName: 'Dr. Sarah Chen',
            clinicOrLab: 'Quest Diagnostics',
            biomarkers: [
              { name: 'Hemoglobin', value: '13.5', unit: 'g/dL', flag: 'normal' },
              { name: 'C-Reactive Protein (CRP)', value: '14.2', unit: 'mg/L', flag: 'high' },
            ],
          },
          {
            _id: 'rec_2',
            title: 'Rheumatology Prescription',
            type: 'doctor_prescription',
            date: '2026-10-25T00:00:00.000Z',
            doctorName: 'Dr. Michael Vance',
            medications: [
              { name: 'Methotrexate', dosage: '15 mg', frequency: 'Once weekly', isActive: true },
            ],
          },
        ]);
      }
      return Promise.resolve({
        _id: 'rec_1',
        title: 'Complete Blood Count (CBC)',
        type: 'blood_test',
        date: '2026-10-28T00:00:00.000Z',
        biomarkers: [],
      });
    }),
    post: jest.fn().mockImplementation((url: string, body: any) =>
      Promise.resolve({ _id: 'server_rec_999', ...body }),
    ),
    patch: jest.fn().mockImplementation((url: string, body: any) =>
      Promise.resolve({ _id: url.split('/').pop(), ...body }),
    ),
    delete: jest.fn().mockResolvedValue({ success: true }),
  },
}));

describe('HealthRecordStore Clinical Functionality', () => {
  beforeEach(() => {
    useHealthRecordStore.setState({
      records: [],
      activeRecord: null,
      selectedFilter: 'all',
      searchQuery: '',
      isLoading: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  it('fetches clinical records and populates state', async () => {
    await useHealthRecordStore.getState().fetchRecords();

    const records = useHealthRecordStore.getState().records;
    expect(records.length).toBe(2);
    expect(records[0].title).toBe('Complete Blood Count (CBC)');
    expect(records[0].type).toBe('blood_test');
    expect(records[1].title).toBe('Rheumatology Prescription');
    expect(records[1].type).toBe('doctor_prescription');
  });

  it('creates a new blood test record with biomarkers', async () => {
    const newRecord = await useHealthRecordStore.getState().createRecord({
      title: 'Autoimmune & Inflammation Panel',
      type: 'blood_test',
      doctorName: 'Dr. Emily Watson',
      clinicOrLab: 'Labcorp',
      biomarkers: [
        { name: 'CRP', value: '18.4', unit: 'mg/L', flag: 'high' },
        { name: 'ESR', value: '35', unit: 'mm/hr', flag: 'high' },
      ],
    });

    expect(newRecord.title).toBe('Autoimmune & Inflammation Panel');
    expect(newRecord.type).toBe('blood_test');
    expect(newRecord.biomarkers?.length).toBe(2);
    expect(useHealthRecordStore.getState().records.length).toBe(1);
  });

  it('creates a new prescription record with medications', async () => {
    const rxRecord = await useHealthRecordStore.getState().createRecord({
      title: 'Prednisone Tapering Rx',
      type: 'doctor_prescription',
      doctorName: 'Dr. Michael Vance',
      medications: [
        {
          name: 'Prednisone',
          dosage: '10 mg',
          frequency: 'Daily for 1 week, then 5 mg',
          instructions: 'Take in morning with food',
          isActive: true,
        },
      ],
    });

    expect(rxRecord.title).toBe('Prednisone Tapering Rx');
    expect(rxRecord.medications?.[0].name).toBe('Prednisone');
    expect(rxRecord.medications?.[0].isActive).toBe(true);
  });

  it('updates an existing record optimistically', async () => {
    await useHealthRecordStore.getState().fetchRecords();
    const updated = await useHealthRecordStore.getState().updateRecord('rec_1', {
      title: 'Updated CBC & Ferritin Report',
      doctorName: 'Dr. Sarah Chen, MD, PhD',
    });

    expect(updated.title).toBe('Updated CBC & Ferritin Report');
    const stateRecord = useHealthRecordStore.getState().records.find((r) => r._id === 'rec_1');
    expect(stateRecord?.title).toBe('Updated CBC & Ferritin Report');
    expect(stateRecord?.doctorName).toBe('Dr. Sarah Chen, MD, PhD');
  });

  it('deletes a record and updates records list', async () => {
    await useHealthRecordStore.getState().fetchRecords();
    expect(useHealthRecordStore.getState().records.length).toBe(2);

    await useHealthRecordStore.getState().deleteRecord('rec_1');
    const remaining = useHealthRecordStore.getState().records;
    expect(remaining.length).toBe(1);
    expect(remaining[0]._id).toBe('rec_2');
  });

  it('supports filter and search state transitions', () => {
    useHealthRecordStore.getState().setFilter('blood_test');
    expect(useHealthRecordStore.getState().selectedFilter).toBe('blood_test');

    useHealthRecordStore.getState().setSearchQuery('ferritin');
    expect(useHealthRecordStore.getState().searchQuery).toBe('ferritin');
  });

  it('contains clinically vetted lab panel presets', () => {
    expect(LAB_PANEL_PRESETS.length).toBeGreaterThanOrEqual(5);

    const cbc = LAB_PANEL_PRESETS.find((p) => p.name.includes('CBC'));
    expect(cbc).toBeDefined();
    expect(cbc?.defaultBiomarkers.some((b) => b.name.includes('Hemoglobin'))).toBe(true);

    const inflammatory = LAB_PANEL_PRESETS.find((p) => p.name.includes('CRP'));
    expect(inflammatory).toBeDefined();
    expect(inflammatory?.defaultBiomarkers.some((b) => b.name.includes('CRP'))).toBe(true);
  });
});
