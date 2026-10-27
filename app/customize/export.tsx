/**
 * Config export / import — backup and restore the user's full configuration as JSON.
 * This does NOT export log data; that is in Reports.
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Stack } from 'expo-router';
import { api } from '../../src/api/client';
import { useConfigStore } from '../../src/store/configStore';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';

export default function ExportScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { invalidate, fetchConfig } = useConfigStore();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const exportConfig = async () => {
    setExporting(true);
    try {
      const res: any = await api.get('/config/export');
      // res is already the unwrapped data payload from api.get
      const exportData = res?.data !== undefined ? res.data : res;
      const json = JSON.stringify(exportData, null, 2);
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `lumen-config-${timestamp}.json`;

      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Alert.alert('Export successful', 'Config exported and downloaded to your device.');
        return;
      }

      const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
      const path = `${cacheDir}${filename}`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Save your Lumen config' });
      } else {
        Alert.alert('Exported', `Saved to:\n${path}`);
      }
    } catch (err: any) {
      console.error('Export error:', err);
      Alert.alert('Export failed', err?.message || 'Could not export your config. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const importConfig = async () => {
    let result;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
    } catch (err: any) {
      console.error('Document picker error:', err);
      return;
    }
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    Alert.alert(
      'Import config?',
      'This will add or update categories, questions, options and quick actions from the file. Existing data that is not in the file stays unchanged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            setImporting(true);
            try {
              let json: string;
              if (Platform.OS === 'web') {
                if ((asset as any).file) {
                  json = await (asset as any).file.text();
                } else {
                  const resp = await fetch(asset.uri);
                  json = await resp.text();
                }
              } else {
                json = await FileSystem.readAsStringAsync(asset.uri, {
                  encoding: FileSystem.EncodingType.UTF8,
                });
              }
              const body = JSON.parse(json);
              await api.post('/config/import', body);
              invalidate();
              await fetchConfig();
              Alert.alert('Done', 'Config imported successfully.');
            } catch (err: any) {
              console.error('Import error:', err);
              Alert.alert('Import failed', err?.message || 'The file could not be read or contained invalid data.');
            } finally {
              setImporting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Config export / import' }} />

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardIcon}>📤</Text>
          <Text style={styles.cardTitle}>Export config</Text>
          <Text style={styles.cardDesc}>
            Save a JSON file with all your categories, questions, options, quick actions and custom units.
            Share it with a support group or back it up.
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={exportConfig}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel="Export config"
          >
            {exporting
              ? <ActivityIndicator color={palette.white} />
              : <Text style={styles.btnText}>Export to file</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardIcon}>📥</Text>
          <Text style={styles.cardTitle}>Import config</Text>
          <Text style={styles.cardDesc}>
            Load a Lumen config JSON file. Your existing config is kept; the file's items are merged in.
            Items already present (matched by templateKey or _id) are skipped.
          </Text>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={importConfig}
            disabled={importing}
            accessibilityRole="button"
            accessibilityLabel="Import config"
          >
            {importing
              ? <ActivityIndicator color={palette.primaryText} />
              : <Text style={[styles.btnText, styles.btnSecondaryText]}>Import from file</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            💡 To export your actual <Text style={styles.noteBold}>log data</Text> (your health history), go to the{' '}
            <Text style={styles.noteBold}>Reports</Text> screen and choose PDF or CSV.
          </Text>
        </View>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: 20, gap: 16 },
  card: { backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 20, gap: 10 },
  cardIcon: { fontSize: 32 },
  cardTitle: { ...typography.h4, color: palette.text },
  cardDesc: { ...typography.body, color: palette.textSecondary },
  btn: { backgroundColor: palette.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  btnText: { ...typography.button, color: '#FFFFFF' },
  btnSecondary: { backgroundColor: palette.background, borderWidth: 1.5, borderColor: palette.primary },
  btnSecondaryText: { color: palette.primaryText },
  note: { backgroundColor: palette.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: palette.border, padding: 16 },
  noteText: { ...typography.small, color: palette.textSecondary },
  noteBold: { fontWeight: '700', color: palette.text },
}));
