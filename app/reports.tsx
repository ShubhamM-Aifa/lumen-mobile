/**
 * Reports screen — export a PDF summary or raw CSV for a date range.
 * Calls POST /reports, downloads the file, then shares it via the native sheet.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import AppDateTimePicker from '../src/components/common/AppDateTimePicker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useConfigStore } from '../src/store/configStore';
import { apiDownload } from '../src/api/client';
import { useTheme, createThemedStyles } from '../src/theme/ThemeContext';
import { typography } from '../src/theme/typography';

type Format = 'pdf' | 'csv';

function toDateStr(d: Date) { return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

export default function ReportsScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { config } = useConfigStore();

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d;
  });
  const [toDate, setToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [format, setFormat] = useState<Format>('pdf');
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const categories = (config?.categories ?? []).filter(c => c.isActive);

  const toggleCat = (id: string) => {
    setSelectedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onFromChange = (d: Date) => {
    setFromDate(d);
    if (d > toDate) setToDate(d);
  };
  const onToChange = (d: Date) => {
    setToDate(d);
  };

  const exportReport = async () => {
    setExporting(true);
    try {
      const fromStart = new Date(fromDate);
      fromStart.setHours(0, 0, 0, 0);
      const toEnd = new Date(toDate);
      toEnd.setHours(23, 59, 59, 999);

      const catIds = selectedCats.size > 0 ? [...selectedCats] : undefined;
      const { base64 } = await apiDownload('/reports', {
        from: fromStart.toISOString(),
        to: toEnd.toISOString(),
        format,
        categoryIds: catIds,
      });

      const mimeType = format === 'pdf' ? 'application/pdf' : 'text/csv';
      const filename = `lumen-report-${isoDate(fromDate)}-to-${isoDate(toDate)}.${format}`;

      if (Platform.OS === 'web') {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Alert.alert('Report exported', `Downloaded ${filename}`);
        return;
      }

      const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
      const path = `${cacheDir}${filename}`;

      await FileSystem.writeAsStringAsync(path, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, { mimeType, dialogTitle: `Lumen ${format.toUpperCase()} report` });
      } else {
        Alert.alert('Exported', `Saved to: ${path}`);
      }
    } catch (err: unknown) {
      console.error('[reports] Export failed:', err);
      const msg = err instanceof Error ? err.message : 'Could not generate the report. Please try again.';
      Alert.alert('Export failed', msg);
    } finally { setExporting(false); }
  };

  const dayCount = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Export report', headerBackTitle: 'Insights' }} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Date range */}
        <Text style={styles.sectionLabel}>Date range</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowFromPicker(true)} accessibilityRole="button" accessibilityLabel="From date">
            <Text style={styles.dateBtnLabel}>From</Text>
            <Text style={styles.dateBtnValue}>{toDateStr(fromDate)}</Text>
          </TouchableOpacity>
          <Text style={styles.dateSep}>→</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowToPicker(true)} accessibilityRole="button" accessibilityLabel="To date">
            <Text style={styles.dateBtnLabel}>To</Text>
            <Text style={styles.dateBtnValue}>{toDateStr(toDate)}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.dateMeta}>{dayCount} day{dayCount !== 1 ? 's' : ''} selected</Text>

        <AppDateTimePicker
          visible={showFromPicker}
          onClose={() => setShowFromPicker(false)}
          value={fromDate}
          mode="date"
          onChange={onFromChange}
          maximumDate={toDate}
        />
        <AppDateTimePicker
          visible={showToPicker}
          onClose={() => setShowToPicker(false)}
          value={toDate}
          mode="date"
          onChange={onToChange}
          minimumDate={fromDate}
          maximumDate={new Date()}
        />

        {/* Format */}
        <Text style={styles.sectionLabel}>Format</Text>
        <View style={styles.formatRow}>
          {(['pdf', 'csv'] as Format[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.formatCard, format === f && styles.formatCardActive]}
              onPress={() => setFormat(f)}
              accessibilityRole="radio"
              accessibilityState={{ selected: format === f }}
            >
              <Text style={styles.formatIcon}>{f === 'pdf' ? '📄' : '📋'}</Text>
              <Text style={[styles.formatLabel, format === f && styles.formatLabelActive]}>
                {f.toUpperCase()}
              </Text>
              <Text style={styles.formatDesc}>
                {f === 'pdf'
                  ? 'Summary + charts + symptom log'
                  : 'Raw data, one row per log entry'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category filter */}
        <Text style={styles.sectionLabel}>Categories (optional — leave blank for all)</Text>
        <View style={styles.catGrid}>
          {categories.map(cat => {
            const sel = selectedCats.has(cat._id);
            return (
              <TouchableOpacity
                key={cat._id}
                style={[styles.catChip, sel && { borderColor: cat.color, backgroundColor: cat.color + '14' }]}
                onPress={() => toggleCat(cat._id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: sel }}
              >
                {cat.icon && <Text style={styles.catIcon}>{cat.icon}</Text>}
                <Text style={[styles.catLabel, sel && { color: cat.color }]}>{cat.name}</Text>
                {sel && <Text style={[styles.catCheck, { color: cat.color }]}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Privacy note */}
        <View style={styles.privacyNote}>
          <Text style={styles.privacyText}>
            🔒 Photos are <Text style={styles.bold}>not included</Text> in exports unless you opt in.
            {format === 'pdf' ? ' The PDF is safe to share with your healthcare team.' : ''}
          </Text>
        </View>

        {/* Export button */}
        <TouchableOpacity
          style={[styles.exportBtn, exporting && styles.dim]}
          onPress={exportReport}
          disabled={exporting}
          accessibilityRole="button"
          accessibilityLabel={`Export ${format.toUpperCase()} report`}
        >
          {exporting
            ? <ActivityIndicator color={palette.white} />
            : <Text style={styles.exportBtnText}>
                Export {format.toUpperCase()} · {dayCount} day{dayCount !== 1 ? 's' : ''}
              </Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 20, gap: 8 },
  sectionLabel: { ...typography.label, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 6 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateBtn: { flex: 1, backgroundColor: palette.surface, borderRadius: 22, minHeight: 52, padding: 14, justifyContent: 'center' },
  dateBtnLabel: { ...typography.caption, color: palette.textDisabled, marginBottom: 3 },
  dateBtnValue: { ...typography.bodyBold, color: palette.text },
  dateSep: { ...typography.h4, color: palette.textDisabled },
  dateMeta: { ...typography.small, color: palette.textDisabled },
  formatRow: { flexDirection: 'row', gap: 12 },
  formatCard: { flex: 1, backgroundColor: palette.surface, borderRadius: 26, borderWidth: 1.5, borderColor: palette.border, padding: 14, gap: 4, alignItems: 'center' },
  formatCardActive: { borderColor: palette.primary, backgroundColor: palette.primary + '0C' },
  formatIcon: { fontSize: 26 },
  formatLabel: { ...typography.bodyBold, color: palette.textSecondary },
  formatLabelActive: { color: palette.primaryText },
  formatDesc: { ...typography.caption, color: palette.textDisabled, textAlign: 'center' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1.5, borderColor: palette.border, paddingHorizontal: 12, paddingVertical: 7 },
  catIcon: { fontSize: 14 },
  catLabel: { ...typography.small, color: palette.textSecondary, fontWeight: '600' },
  catCheck: { fontWeight: '800', fontSize: 12 },
  privacyNote: { backgroundColor: palette.surfaceAlt, borderRadius: 22, padding: 16 },
  privacyText: { ...typography.small, color: palette.textSecondary },
  bold: { fontWeight: '700', color: palette.text },
  exportBtn: { backgroundColor: palette.primary, borderRadius: 27, minHeight: 54, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  exportBtnText: { ...typography.button, color: '#FFFFFF' },
  dim: { opacity: 0.5 },
}));
