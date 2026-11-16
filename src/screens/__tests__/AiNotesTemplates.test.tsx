import React from 'react';
import { Alert } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { router, useLocalSearchParams } from 'expo-router';
import TemplateDraftScreen, { countChanges, measureText } from '../../../app/ai/template/[id]';
import NewAiTemplateScreen from '../../../app/ai/template/new';
import { NoteAiButton } from '../../components/notes/NoteAiButton';
import {
  useAiAccess, useApplyTemplateDraft, useGenerateTemplateDraft, useNoteAiAction, useTemplateDraft, useUndoTemplateDraft,
  type TemplateDraft,
} from '../../hooks/useAiChat';
import { flushNotesOutbox, getNotesPendingCount } from '../../services/notes/outbox';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() }, useLocalSearchParams: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../components/ios/ScreenTopBar', () => ({ ScreenTopBar: () => null }));
jest.mock('../../store/configStore', () => {
  const state = { fetchConfig: jest.fn(async () => undefined), invalidate: jest.fn() };
  const useConfigStore = (sel: (s: typeof state) => unknown) => sel(state);
  useConfigStore.getState = () => state;
  return { useConfigStore };
});
jest.mock('../../services/notes/outbox', () => ({ flushNotesOutbox: jest.fn(async () => undefined), getNotesPendingCount: jest.fn(() => 0) }));
jest.mock('../../hooks/useAiChat', () => ({
  useAiAccess: jest.fn(), useTemplateDraft: jest.fn(), useApplyTemplateDraft: jest.fn(), useUndoTemplateDraft: jest.fn(),
  useGenerateTemplateDraft: jest.fn(), useNoteAiAction: jest.fn(),
}));

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);
const byLabel = (t: ReactTestRenderer, label: string) => t.root.findAll(n => n.props.accessibilityLabel === label && n.props.onPress)[0];

const opt = (id: string, label: string, over = {}) => ({ id, label, measure: 'severity', fields: [{ key: 'severity', label: 'Severity', dataType: 'range' }], include: true, ...over });
const draft = (over: Partial<TemplateDraft> = {}): TemplateDraft => ({
  id: 'd1', title: 'RA tracking', summary: 'For your joints.', status: 'draft',
  categories: [{
    id: 'c1', name: 'Joints', icon: '🦴', color: '#f00', role: 'symptom', fromLibrary: false, include: true,
    questions: [{ id: 'c1q1', title: 'Which joints hurt?', frequency: 'anytime', selectionType: 'multiple', include: true,
      options: [opt('o1', 'Knee'), opt('o2', 'Wrist'), opt('o3', 'Headache', { existingId: 'x' })] }],
  }],
  addOptions: [], quickActions: [{ id: 'qa1', label: 'Stretch', icon: '🧘', mode: 'timer', fromLibrary: true, include: true }],
  archive: [{ id: 'r1', kind: 'category', targetId: 't', label: 'Old stuff', reason: 'Unused for 3 months', include: false }],
  counts: { categories: 1, options: 2, quickActions: 1, archive: 1 }, applied: { created: 0, archived: 0, at: null },
  ...over,
});

const applyMutate = jest.fn();
const undoMutate = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'd1' });
  (useAiAccess as jest.Mock).mockReturnValue({ data: { fullAccess: true, configured: true } });
  (useTemplateDraft as jest.Mock).mockReturnValue({ data: draft(), isLoading: false });
  (useApplyTemplateDraft as jest.Mock).mockReturnValue({ mutate: applyMutate, isPending: false });
  (useUndoTemplateDraft as jest.Mock).mockReturnValue({ mutate: undoMutate, isPending: false });
});

describe('template draft helpers', () => {
  it('counts what Add would do with the member\'s ticks', () => {
    expect(countChanges(draft(), {})).toBe(5); // category + question + 2 options + quick action (archive is off)
    expect(countChanges(draft(), { o2: { include: false }, r1: { include: true } })).toBe(5);
    expect(countChanges(draft(), { c1: { include: false } })).toBe(1);
  });

  it('describes fields in plain words', () => {
    expect(measureText({ measure: 'severity', fields: [] })).toBe('0–10 slider');
    expect(measureText({ measure: 'number', fields: [{ key: 'a', label: 'a', dataType: 'number', unit: 'mg' }] })).toBe('Number (mg)');
  });
});

describe('template review screen', () => {
  it('shows the draft with what is already tracked, and adds with the member\'s edits', async () => {
    let t!: ReactTestRenderer;
    await act(async () => { t = create(<TemplateDraftScreen />); });
    const all = texts(t);
    expect(all).toEqual(expect.arrayContaining(['RA tracking', 'Joints', 'Which joints hurt?', 'Knee', 'Already tracked', 'Old stuff', 'Unused for 3 months']));
    expect(t.root.findAll(n => n.props.accessibilityRole === 'checkbox' && n.props.accessibilityLabel === 'Headache')[0].props.disabled).toBe(true);

    await act(async () => { t.root.findAll(n => n.props.accessibilityRole === 'checkbox' && n.props.accessibilityLabel === 'Wrist')[0].props.onPress(); });
    expect(byLabel(t, 'Add 4 items')).toBeTruthy();
    await act(async () => { byLabel(t, 'Add 4 items').props.onPress(); });
    expect(applyMutate).toHaveBeenCalledWith({ id: 'd1', items: { o2: { include: false } } }, expect.anything());
  });

  it('offers Undo once applied', async () => {
    (useTemplateDraft as jest.Mock).mockReturnValue({ data: draft({ status: 'applied', applied: { created: 4, archived: 0, at: 'x' } }), isLoading: false });
    let t!: ReactTestRenderer;
    await act(async () => { t = create(<TemplateDraftScreen />); });
    expect(texts(t).join(' ')).toContain('Added to your tracking (4 added)');
    const undoBtn = t.root.findAll(n => n.props.onPress && n.findAll(c => flat(c.props.children) === 'Undo').length > 0)[0];
    await act(async () => { undoBtn.props.onPress(); });
    expect(undoMutate).toHaveBeenCalledWith('d1', expect.anything());
  });
});

describe('Create with Lumen AI', () => {
  it('builds from a disease and opens the review', async () => {
    const mutate = jest.fn((_v, o) => o.onSuccess({ draftId: 'd7', reply: 'ok', error: null }));
    (useGenerateTemplateDraft as jest.Mock).mockReturnValue({ mutate, isPending: false });
    let t!: ReactTestRenderer;
    await act(async () => { t = create(<NewAiTemplateScreen />); });
    await act(async () => { t.root.findAll(n => n.props.accessibilityLabel === 'Disease or symptoms')[0].props.onChangeText('Rheumatoid arthritis'); });
    const build = t.root.findAll(n => n.props.onPress && n.findAll(c => flat(c.props.children) === 'Build my template').length > 0)[0];
    await act(async () => { build.props.onPress(); });
    expect(mutate).toHaveBeenCalledWith({ mode: 'create', request: 'Rheumatoid arthritis' }, expect.anything());
    expect(router.replace).toHaveBeenCalledWith('/ai/template/d7');
  });

  it('explains when nothing new was proposed', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    (useGenerateTemplateDraft as jest.Mock).mockReturnValue({ mutate: jest.fn((_v, o) => o.onSuccess({ draftId: null, reply: '', error: 'no_draft' })), isPending: false });
    let t!: ReactTestRenderer;
    await act(async () => { t = create(<NewAiTemplateScreen />); });
    const improve = t.root.findAll(n => n.props.onPress && n.findAll(c => flat(c.props.children) === 'Suggest improvements').length > 0)[0];
    await act(async () => { improve.props.onPress(); });
    expect(alert).toHaveBeenCalledWith('No template yet', expect.stringContaining('already track'));
  });
});

describe('NoteAiButton', () => {
  it('is hidden without Lumen AI', async () => {
    (useAiAccess as jest.Mock).mockReturnValue({ data: { fullAccess: false } });
    (useNoteAiAction as jest.Mock).mockReturnValue({ mutateAsync: jest.fn() });
    let t!: ReactTestRenderer;
    await act(async () => { t = create(<NoteAiButton noteId="n1" onResult={jest.fn()} />); });
    expect(t.toJSON()).toBeNull();
  });

  it('sends pending edits first, runs the action and hands back the result', async () => {
    jest.useFakeTimers();
    const mutateAsync = jest.fn(async () => ({ noteId: 'n1', created: false, note: { _id: 'n1' }, error: null }));
    (useNoteAiAction as jest.Mock).mockReturnValue({ mutateAsync });
    const onResult = jest.fn();
    let t!: ReactTestRenderer;
    await act(async () => { t = create(<NoteAiButton noteId="n1" onResult={onResult} />); });
    await act(async () => { byLabel(t, 'Lumen AI actions for this note').props.onPress(); });
    let done!: Promise<void>;
    await act(async () => { done = byLabel(t, 'Summarise').props.onPress(); });
    await act(async () => { jest.advanceTimersByTime(900); await done; });
    expect(flushNotesOutbox).toHaveBeenCalled();
    expect(mutateAsync).toHaveBeenCalledWith({ noteId: 'n1', action: 'summarize' });
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ noteId: 'n1', created: false }));
    jest.useRealTimers();
  });

  it('refuses while edits are still unsent', async () => {
    jest.useFakeTimers();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    (getNotesPendingCount as jest.Mock).mockReturnValue(2);
    const mutateAsync = jest.fn();
    (useNoteAiAction as jest.Mock).mockReturnValue({ mutateAsync });
    let t!: ReactTestRenderer;
    await act(async () => { t = create(<NoteAiButton noteId="n1" onResult={jest.fn()} />); });
    await act(async () => { byLabel(t, 'Lumen AI actions for this note').props.onPress(); });
    let done!: Promise<void>;
    await act(async () => { done = byLabel(t, 'Hinglish copy').props.onPress(); });
    await act(async () => { jest.advanceTimersByTime(900); await done; });
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Still saving', expect.any(String));
    jest.useRealTimers();
  });
});
