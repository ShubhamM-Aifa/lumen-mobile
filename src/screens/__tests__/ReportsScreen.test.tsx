import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import ReportsScreen from '../../../app/reports';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiDownload } from '../../api/client';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///document/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../api/client', () => ({
  apiDownload: jest.fn().mockResolvedValue({ base64: 'fake-pdf-base64', contentType: 'application/pdf' }),
}));

jest.mock('../../hooks/useAiChat', () => ({
  useAiAccess: () => ({ data: { fullAccess: true } }),
}));

jest.mock('../../store/configStore', () => ({
  useConfigStore: () => ({ config: { categories: [{ _id: 'cat1', name: 'Symptoms', isActive: true }] } }),
}));

describe('ReportsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders successfully and exports PDF using expo-file-system/legacy', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ReportsScreen />);
    });

    expect(renderer.root).toBeTruthy();

    // Find the Export PDF button
    const exportBtn = renderer.root.findByProps({ accessibilityLabel: 'Export PDF report' });
    expect(exportBtn).toBeTruthy();

    await act(async () => {
      await exportBtn!.props.onPress();
    });

    expect(apiDownload).toHaveBeenCalledWith(
      '/reports',
      expect.objectContaining({ format: 'pdf' })
    );

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('file:///cache/lumen-report-'),
      'fake-pdf-base64',
      { encoding: 'base64' }
    );

    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('file:///cache/lumen-report-'),
      expect.objectContaining({ mimeType: 'application/pdf' })
    );
  });

  it('exports CSV successfully using expo-file-system/legacy', async () => {
    (apiDownload as jest.Mock).mockResolvedValueOnce({
      base64: 'fake-csv-base64',
      contentType: 'text/csv',
    });

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<ReportsScreen />);
    });

    // Select CSV format
    const formatBtns = renderer.root.findAll(
      node => node.props.accessibilityRole === 'radio'
    );
    const csvBtn = formatBtns.find(b => {
      const textNodes = b.findAll(n => typeof n.props.children === 'string');
      return textNodes.some(t => t.props.children === 'CSV');
    });
    expect(csvBtn).toBeTruthy();
    await act(async () => {
      csvBtn!.props.onPress();
    });

    const exportBtn = renderer.root.findByProps({ accessibilityLabel: 'Export CSV report' });
    await act(async () => {
      await exportBtn.props.onPress();
    });

    expect(apiDownload).toHaveBeenCalledWith(
      '/reports',
      expect.objectContaining({ format: 'csv' })
    );

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('.csv'),
      'fake-csv-base64',
      { encoding: 'base64' }
    );

    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('.csv'),
      expect.objectContaining({ mimeType: 'text/csv' })
    );
  });
});
