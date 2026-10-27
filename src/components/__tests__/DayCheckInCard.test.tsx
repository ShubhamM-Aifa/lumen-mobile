import React from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { DayCheckInCard, NO_SYMPTOMS_OPTION_ID, PATIENT_GLOBAL_OPTION_ID } from '../home/DayCheckInCard';
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
  await act(async () => { tree = create(<DayCheckInCard boundaryHour={4} />); });
  return tree;
}

const pressable = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAll(n => typeof n.props.children === 'string').map(n => n.props.children as string);

describe('DayCheckInCard', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    (api.post as jest.Mock).mockResolvedValue({});
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('offers "No symptoms today" and a 0 to 10 score', async () => {
    const tree = await render();
    expect(pressable(tree, 'No symptoms today')).toBeDefined();
    for (let n = 0; n <= 10; n++) expect(pressable(tree, `Overall today ${n} of 10`)).toBeDefined();
    expect(pressable(tree, 'Overall today 11 of 10')).toBeUndefined();
  });

  it('logs "no symptoms" as a check-in without a category', async () => {
    const tree = await render();
    await act(async () => { await pressable(tree, 'No symptoms today').props.onPress(); });
    const [path, body] = (api.post as jest.Mock).mock.calls[0];
    expect(path).toBe('/logs');
    expect(body).toMatchObject({ source: 'check_in' });
    expect(body.categoryId).toBeUndefined();
    expect(body.answers).toEqual([{ optionId: NO_SYMPTOMS_OPTION_ID, optionLabelSnapshot: 'No symptoms today', values: [] }]);
    expect(texts(tree)).toContain('Marked: no symptoms today');
  });

  it('logs the overall score as a range value', async () => {
    const tree = await render();
    await act(async () => { await pressable(tree, 'Overall today 7 of 10').props.onPress(); });
    const [, body] = (api.post as jest.Mock).mock.calls[0];
    expect(body.answers).toEqual([{
      optionId: PATIENT_GLOBAL_OPTION_ID,
      optionLabelSnapshot: 'Overall today',
      values: [{ fieldKey: 'score', dataType: 'range', value: 7 }],
    }]);
    expect(pressable(tree, 'Overall today 7 of 10').props.accessibilityState).toEqual({ selected: true });
    expect(texts(tree)).toContain('Overall 7 of 10');
  });

  it('does not log the same answer twice', async () => {
    const tree = await render();
    await act(async () => { await pressable(tree, 'No symptoms today').props.onPress(); });
    await act(async () => { await pressable(tree, 'No symptoms today').props.onPress(); });
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('rolls back and says so when saving fails', async () => {
    (api.post as jest.Mock).mockRejectedValue(new Error('offline'));
    const tree = await render();
    await act(async () => { await pressable(tree, 'Overall today 4 of 10').props.onPress(); });
    expect(Alert.alert).toHaveBeenCalledWith('Could not save', 'offline');
    expect(pressable(tree, 'Overall today 4 of 10').props.accessibilityState).toEqual({ selected: false });
  });

  it('remembers today\'s answers after the app restarts', async () => {
    const first = await render();
    await act(async () => { await pressable(first, 'Overall today 2 of 10').props.onPress(); });
    const second = await render();
    expect(pressable(second, 'Overall today 2 of 10').props.accessibilityState).toEqual({ selected: true });
  });
});
