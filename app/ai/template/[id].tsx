/**
 * Review a log template Lumen AI proposed, then add it. Nothing from the draft is added to the
 * member's tracking until they press Add; afterwards it can be undone (what was added is hidden,
 * logged entries stay). Items already tracked are shown but can't be added again.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { ScreenTopBar } from '../../../src/components/ios/ScreenTopBar';
import {
  useApplyTemplateDraft, useTemplateDraft, useUndoTemplateDraft,
  type DraftItemEdits, type DraftOption, type TemplateDraft,
} from '../../../src/hooks/useAiChat';
import { useConfigStore } from '../../../src/store/configStore';
import { useTheme, createThemedStyles } from '../../../src/theme/ThemeContext';
import { typography } from '../../../src/theme/typography';

const MEASURE_TEXT: Record<string, string> = {
  severity: '0–10 slider', yes_no: 'Yes / no', duration: 'Minutes', temperature: '°C / °F', text: 'Notes',
  none: 'Just tap to log', enum: 'Pick from a list', time: 'Time', datetime: 'Date & time', image: 'Photo', location: 'Place', string: 'Notes',
};
export function measureText(o: Pick<DraftOption, 'measure' | 'fields'>): string {
  if (o.measure === 'number') return o.fields[0]?.unit ? `Number (${o.fields[0].unit})` : 'Number';
  return MEASURE_TEXT[o.measure] ?? o.measure;
}

/** How many things "Add" would create or archive with the member's edits. */
export function countChanges(d: TemplateDraft, edits: DraftItemEdits): number {
  const on = (item: { id: string; include: boolean }) => edits[item.id]?.include ?? item.include;
  let n = 0;
  for (const c of d.categories) {
    if (!on(c)) continue;
    if (!c.existingId) n++;
    for (const q of c.questions) {
      if (!on(q)) continue;
      if (!q.existingId) n++;
      n += q.options.filter(o => on(o) && !o.existingId).length;
    }
  }
  n += d.addOptions.flatMap(a => a.options).filter(o => on(o) && !o.existingId).length;
  n += d.quickActions.filter(q => on(q) && !q.existingId).length;
  n += d.archive.filter(r => on(r)).length;
  return n;
}

export default function TemplateDraftScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const draft = useTemplateDraft(id);
  const apply = useApplyTemplateDraft();
  const undo = useUndoTemplateDraft();
  const fetchConfig = useConfigStore(s => s.fetchConfig);
  const [edits, setEdits] = useState<DraftItemEdits>({});
  const [editing, setEditing] = useState<string | null>(null);

  const d = draft.data;
  const isDraft = d?.status === 'draft';
  const changes = useMemo(() => (d ? countChanges(d, edits) : 0), [d, edits]);

  const on = (item: { id: string; include: boolean }) => edits[item.id]?.include ?? item.include;
  const toggle = (item: { id: string; include: boolean }) =>
    setEdits(e => ({ ...e, [item.id]: { ...e[item.id], include: !on(item) } }));
  const label = (itemId: string, current: string) => edits[itemId]?.label ?? current;
  const rename = (itemId: string, value: string) => setEdits(e => ({ ...e, [itemId]: { ...e[itemId], label: value } }));

  /** The log screens read the config store: reload it so the new items show up. */
  const refreshConfig = () => {
    useConfigStore.getState().invalidate();
    fetchConfig().catch(() => {});
  };

  const onAdd = () => {
    if (!d) return;
    apply.mutate({ id: d.id, items: edits }, {
      onSuccess: res => {
        refreshConfig();
        Alert.alert('Added to your tracking', `${res.applied.created} item(s) added${res.applied.archived ? `, ${res.applied.archived} hidden` : ''}.`, [
          { text: 'Undo', style: 'destructive', onPress: onUndo },
          { text: 'Open Customize', onPress: () => router.push('/customize/categories') },
          { text: 'Done', style: 'cancel' },
        ]);
      },
      onError: err => Alert.alert('Could not add', err instanceof Error ? err.message : ''),
    });
  };

  const onUndo = () => {
    if (!d) return;
    undo.mutate(d.id, {
      onSuccess: () => { refreshConfig(); Alert.alert('Undone', 'What was added is hidden again. Anything you logged with it is kept.'); },
      onError: err => Alert.alert('Could not undo', err instanceof Error ? err.message : ''),
    });
  };

  const Box = ({ item, disabled, label: a11y }: { item: { id: string; include: boolean }; disabled?: boolean; label: string }) => {
    const checked = on(item);
    return (
      <TouchableOpacity
        style={[styles.box, checked && !disabled && { backgroundColor: palette.primary, borderColor: palette.primary }, disabled && styles.boxOff]}
        onPress={() => toggle(item)}
        disabled={disabled || !isDraft}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: checked && !disabled, disabled: disabled || !isDraft }}
        accessibilityLabel={a11y}
      >
        {checked && !disabled ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
      </TouchableOpacity>
    );
  };

  const Name = ({ itemId, value, style, max }: { itemId: string; value: string; style: object; max: number }) =>
    editing === itemId ? (
      <TextInput
        style={[style, styles.renameInput]}
        value={label(itemId, value)}
        onChangeText={t => rename(itemId, t)}
        onBlur={() => setEditing(null)}
        autoFocus
        maxLength={max}
        accessibilityLabel={`Rename ${value}`}
      />
    ) : (
      <Text
        style={style}
        onPress={isDraft ? () => setEditing(itemId) : undefined}
        accessibilityHint={isDraft ? 'Tap to rename' : undefined}
        maxFontSizeMultiplier={1.3}
      >
        {label(itemId, value)}
      </Text>
    );

  const Badge = ({ text, tone }: { text: string; tone: 'lib' | 'new' | 'have' }) => (
    <Text style={[styles.badge, tone === 'lib' ? styles.badgeLib : tone === 'new' ? styles.badgeNew : styles.badgeHave]} maxFontSizeMultiplier={1.2}>{text}</Text>
  );

  const OptionRow = ({ o }: { o: DraftOption }) => (
    <View style={styles.optionRow}>
      <Box item={o} disabled={!!o.existingId} label={o.label} />
      <View style={{ flex: 1 }}>
        <Name itemId={o.id} value={o.label} style={styles.optionLabel} max={100} />
        <Text style={styles.meta} maxFontSizeMultiplier={1.2}>{o.existingId ? 'Already tracked' : measureText(o)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScreenTopBar title="Review template" fallbackRoute="/customize/templates" />
      {draft.isLoading ? <ActivityIndicator style={{ marginTop: 40 }} /> : null}
      {draft.isError ? <Text style={styles.empty}>This suggestion could not be loaded.</Text> : null}
      {d ? (
        <>
          <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 120 + insets.bottom }]} keyboardShouldPersistTaps="handled">
            <Text style={styles.title} maxFontSizeMultiplier={1.3}>{d.title}</Text>
            {d.summary ? <Text style={styles.summary} maxFontSizeMultiplier={1.3}>{d.summary}</Text> : null}
            {d.status === 'applied' ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText} maxFontSizeMultiplier={1.3}>Added to your tracking ({d.applied.created} added{d.applied.archived ? `, ${d.applied.archived} hidden` : ''}).</Text>
                <TouchableOpacity onPress={onUndo} disabled={undo.isPending} accessibilityRole="button" style={styles.bannerBtn}>
                  <Text style={styles.bannerAction}>{undo.isPending ? 'Undoing…' : 'Undo'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {d.status === 'undone' ? <Text style={styles.summary}>This suggestion was undone.</Text> : null}
            {isDraft ? <Text style={styles.hint} maxFontSizeMultiplier={1.3}>Untick anything you don’t want. Tap a name to rename it.</Text> : null}

            {d.categories.map(c => (
              <View key={c.id} style={styles.card}>
                <View style={styles.catHead}>
                  <Box item={c} label={c.name} />
                  <Text style={styles.catIcon}>{c.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Name itemId={c.id} value={c.name} style={styles.catName} max={60} />
                    <View style={styles.badges}>
                      {c.fromLibrary ? <Badge text="Lumen library" tone="lib" /> : <Badge text="New" tone="new" />}
                      {c.existingId ? <Badge text="You have this — adding to it" tone="have" /> : null}
                    </View>
                  </View>
                </View>
                {on(c) ? c.questions.map(q => (
                  <View key={q.id} style={styles.question}>
                    <View style={styles.qHead}>
                      <Box item={q} label={q.title} />
                      <View style={{ flex: 1 }}>
                        <Name itemId={q.id} value={q.title} style={styles.qTitle} max={200} />
                        <Text style={styles.meta} maxFontSizeMultiplier={1.2}>
                          {q.existingId ? 'Already tracked · new options only' : q.frequency === 'anytime' ? 'Any time' : q.frequency.replace(/_/g, ' ')}
                        </Text>
                      </View>
                    </View>
                    {on(q) ? q.options.map(o => <OptionRow key={o.id} o={o} />) : null}
                  </View>
                )) : null}
              </View>
            ))}

            {d.addOptions.length ? (
              <View style={styles.card}>
                <Text style={styles.section} maxFontSizeMultiplier={1.3}>New options for what you already track</Text>
                {d.addOptions.map(a => (
                  <View key={a.id} style={styles.question}>
                    <Text style={styles.qTitle} maxFontSizeMultiplier={1.3}>{a.questionTitle}</Text>
                    {a.options.map(o => <OptionRow key={o.id} o={o} />)}
                  </View>
                ))}
              </View>
            ) : null}

            {d.quickActions.length ? (
              <View style={styles.card}>
                <Text style={styles.section} maxFontSizeMultiplier={1.3}>Quick actions on Today</Text>
                {d.quickActions.map(q => (
                  <View key={q.id} style={styles.optionRow}>
                    <Box item={q} disabled={!!q.existingId} label={q.label} />
                    <Text style={styles.catIcon}>{q.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Name itemId={q.id} value={q.label} style={styles.optionLabel} max={40} />
                      <Text style={styles.meta} maxFontSizeMultiplier={1.2}>{q.existingId ? 'Already on Today' : q.fromLibrary ? 'Lumen library' : q.mode}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {d.archive.length ? (
              <View style={styles.card}>
                <Text style={styles.section} maxFontSizeMultiplier={1.3}>Hide things you don’t use</Text>
                <Text style={styles.meta} maxFontSizeMultiplier={1.2}>Off unless you tick them. Your logged entries are kept.</Text>
                {d.archive.map(r => (
                  <View key={r.id} style={styles.optionRow}>
                    <Box item={r} label={`Hide ${r.label}`} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionLabel} maxFontSizeMultiplier={1.3}>{r.label}</Text>
                      {r.reason ? <Text style={styles.meta} maxFontSizeMultiplier={1.2}>{r.reason}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          {isDraft ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
              <TouchableOpacity
                style={[styles.addBtn, (changes === 0 || apply.isPending) && styles.addBtnOff]}
                onPress={onAdd}
                disabled={changes === 0 || apply.isPending}
                accessibilityRole="button"
                accessibilityLabel={`Add ${changes} item${changes === 1 ? '' : 's'}`}
              >
                {apply.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.addText}>{changes === 0 ? 'Nothing selected' : `Add ${changes} item${changes === 1 ? '' : 's'}`}</Text>}
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(palette => ({
  screen: { flex: 1, backgroundColor: palette.background },
  body: { padding: 16, gap: 12 },
  empty: { ...typography.body, color: palette.textSecondary, padding: 24, textAlign: 'center' },
  title: { ...typography.title2, color: palette.text },
  summary: { ...typography.body, color: palette.textSecondary, lineHeight: 22 },
  hint: { ...typography.footnote, color: palette.textSecondary },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.surface, borderRadius: 16, padding: 12 },
  bannerText: { ...typography.footnote, color: palette.text, flex: 1 },
  bannerBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  bannerAction: { ...typography.bodyBold, color: palette.errorText },
  card: { backgroundColor: palette.surface, borderRadius: 20, padding: 14, gap: 10 },
  catHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catIcon: { fontSize: 22 },
  catName: { ...typography.headline, color: palette.text },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  badge: { ...typography.caption, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  badgeLib: { backgroundColor: palette.primary + '22', color: palette.primaryText },
  badgeNew: { backgroundColor: '#AF52DE22', color: '#AF52DE' },
  badgeHave: { backgroundColor: palette.border, color: palette.textSecondary },
  section: { ...typography.headline, color: palette.text },
  question: { gap: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: palette.border, marginLeft: 10 },
  qHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qTitle: { ...typography.bodyBold, color: palette.text },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingLeft: 4 },
  optionLabel: { ...typography.body, color: palette.text },
  meta: { ...typography.caption, color: palette.textSecondary },
  renameInput: { borderBottomWidth: 1, borderBottomColor: palette.primary, paddingVertical: 2 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: palette.textSecondary, alignItems: 'center', justifyContent: 'center' },
  boxOff: { opacity: 0.35 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: palette.background, borderTopWidth: 0.5, borderTopColor: palette.border },
  addBtn: { minHeight: 52, borderRadius: 26, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnOff: { opacity: 0.4 },
  addText: { ...typography.bodyBold, color: '#fff' },
}));
