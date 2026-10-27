import React from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { FeelingCard } from '../home/FeelingCard';
import { api } from '../../api/client';

jest.mock('../../api/client', () => ({ api: { post: jest.fn() } }));
jest.mock('../../api/queryClient', () => ({ queryClient: { invalidateQueries: jest.fn() } }));
jest.mock('../../utils/uuid', () => ({ uuidv4: () => '11111111-1111-4111-8111-111111111111' }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

async function render(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<FeelingCard firstName="Sam" boundaryHour={4} />); });
  return tree;
}

const face = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll(n => n.props.accessibilityLabel === `Feeling ${label}` && typeof n.props.onPress === 'function')[0];

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAll(n => typeof n.props.children === 'string').map(n => n.props.children as string);

describe('FeelingCard', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    (api.post as jest.Mock).mockResolvedValue({});
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('greets the patient by first name and offers five options', async () => {
    const tree = await render();
    expect(texts(tree)).toContain('How are you feeling, Sam?');
    for (const l of ['great', 'good', 'okay', 'low', 'flare']) {
      expect(face(tree, l)).toBeDefined();
    }
  });

  it('logs a check_in entry without a category when a face is tapped', async () => {
    const tree = await render();
    await act(async () => { await face(tree, 'low').props.onPress(); });

    expect(api.post).toHaveBeenCalledTimes(1);
    const [path, body] = (api.post as jest.Mock).mock.calls[0];
    expect(path).toBe('/logs');
    expect(body.source).toBe('check_in');
    expect(body.categoryId).toBeUndefined();
    expect(body.clientId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(Number.isNaN(Date.parse(body.occurredAt))).toBe(false);
    expect(body.answers).toEqual([
      { optionId: 'feeling:low', optionLabelSnapshot: 'Feeling low', values: [] },
    ]);
  });

  it('shows the logged feeling and marks it selected', async () => {
    const tree = await render();
    await act(async () => { await face(tree, 'good').props.onPress(); });
    expect(texts(tree).some(t => t.startsWith('Feeling good ·'))).toBe(true);
    expect(face(tree, 'good').props.accessibilityState).toEqual({ selected: true });
    expect(face(tree, 'low').props.accessibilityState).toEqual({ selected: false });
  });

  it('rolls back and tells the patient when saving fails', async () => {
    (api.post as jest.Mock).mockRejectedValue(new Error('offline'));
    const tree = await render();
    await act(async () => { await face(tree, 'flare').props.onPress(); });
    expect(Alert.alert).toHaveBeenCalledWith('Could not save', 'offline');
    expect(face(tree, 'flare').props.accessibilityState).toEqual({ selected: false });
    expect(texts(tree)).toContain('One tap logs it. Add details later.');
  });

  it('restores today\'s feeling after the app restarts', async () => {
    const first = await render();
    await act(async () => { await face(first, 'great').props.onPress(); });
    const second = await render();
    expect(face(second, 'great').props.accessibilityState).toEqual({ selected: true });
  });
});
