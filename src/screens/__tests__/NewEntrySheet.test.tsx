import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import LogCategoryPicker from '../../../app/log/index';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: {
    push: (...a: unknown[]) => mockPush(...a),
    back: () => mockBack(),
    canGoBack: () => true,
    replace: jest.fn(),
  },
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

const categories = [
  { _id: 'c-ctx', name: 'Weather', icon: '🌦', color: '#5AC8FA', role: 'context', order: 0, isActive: true },
  { _id: 'c-sym', name: 'Symptoms', icon: '🩺', color: '#FF3B30', role: 'symptom', order: 0, isActive: true },
  { _id: 'c-off', name: 'Hidden', icon: '👻', color: '#000000', role: 'symptom', order: 1, isActive: false },
];

jest.mock('../../store/configStore', () => ({
  useConfigStore: () => ({ config: { categories }, isLoading: false, fetchConfig: jest.fn() }),
}));

jest.mock('../../hooks/useCategoryProgress', () => ({
  useCategoryProgress: () => ({
    overallPercentage: 50,
    completedCategoriesCount: 1,
    totalCategoriesCount: 2,
    getCategoryProgress: (id: string) => ({
      categoryId: id,
      totalQuestions: 4,
      answeredQuestions: id === 'c-sym' ? 4 : 1,
      progress: id === 'c-sym' ? 1 : 0.25,
      percentage: id === 'c-sym' ? 100 : 25,
      isComplete: id === 'c-sym',
      isLoggedToday: true,
      count: 1,
    }),
  }),
}));

async function render(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<LogCategoryPicker />); });
  return tree;
}

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string);

const button = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

describe('New Entry sheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows overall progress and role-grouped active categories only', async () => {
    const tree = await render();
    const t = texts(tree);
    expect(t).toContain('New Entry');
    expect(t).toContain('50%');
    expect(t).toContain('1 of 2 categories done');
    expect(t).toContain('Symptoms');
    expect(t).toContain('Weather');
    expect(t).not.toContain('Hidden');
    // Symptoms group is listed before the Context group
    expect(t.indexOf('Weather')).toBeGreaterThan(t.indexOf('Symptoms'));
  });

  it('marks finished categories as Done and others with their answered count', async () => {
    const tree = await render();
    const t = texts(tree);
    expect(t).toContain('Done');
    expect(t).toContain('4 of 4 answered');
    expect(t).toContain('1 of 4 answered');
  });

  it('opens a category, the shortcuts, and closes the sheet', async () => {
    const tree = await render();
    await act(async () => { button(tree, 'Log Weather, 1 of 4 answered').props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/log/c-ctx', params: undefined });

    await act(async () => { button(tree, 'Quick Log, A few fast questions').props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith('/quick-log');
    await act(async () => { button(tree, 'Check-in, Morning & evening').props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith('/check-in');

    await act(async () => { button(tree, 'Close').props.onPress(); });
    expect(mockBack).toHaveBeenCalled();
  });
});
