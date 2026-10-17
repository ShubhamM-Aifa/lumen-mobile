import { renderHook } from '@testing-library/react-native';
import { useCategoryProgress } from '../useCategoryProgress';
import { useConfigStore } from '../../store/configStore';
import { useTodayCategoryLogs } from '../useTodayCategoryLogs';

jest.mock('../../store/configStore');
jest.mock('../useTodayCategoryLogs');

describe('useCategoryProgress', () => {
  const mockConfig = {
    categories: [
      { _id: 'cat-symptoms', name: 'Symptoms', isActive: true, order: 1 },
      { _id: 'cat-food', name: 'Food & Drink', isActive: true, order: 2 },
    ],
    questions: [
      { _id: 'q-symptom-1', categoryId: 'cat-symptoms', title: 'Symptoms', isActive: true },
      { _id: 'q-symptom-2', categoryId: 'cat-symptoms', title: 'Severity', isActive: true },
      { _id: 'q-food-1', categoryId: 'cat-food', title: 'Meal', isActive: true },
    ],
    options: [
      { _id: 'opt-headache', questionId: 'q-symptom-1', label: 'Headache', isActive: true },
      { _id: 'opt-nausea', questionId: 'q-symptom-1', label: 'Nausea', isActive: true },
      { _id: 'opt-mild', questionId: 'q-symptom-2', label: 'Mild', isActive: true },
      { _id: 'opt-salad', questionId: 'q-food-1', label: 'Salad', isActive: true },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useConfigStore as unknown as jest.Mock).mockReturnValue({
      config: mockConfig,
      isLoading: false,
    });
  });

  it('calculates 0% progress when no logs exist for today', () => {
    (useTodayCategoryLogs as jest.Mock).mockReturnValue({
      todayLogs: [],
      getCategoryStatus: jest.fn().mockReturnValue({ isLoggedToday: false, count: 0 }),
      refetch: jest.fn(),
      isLoading: false,
    });

    const { result } = renderHook(() => useCategoryProgress());

    expect(result.current.overallProgress).toBe(0);
    expect(result.current.overallPercentage).toBe(0);
    expect(result.current.completedCategoriesCount).toBe(0);
    expect(result.current.totalCategoriesCount).toBe(2);

    const symptomsProg = result.current.getCategoryProgress('cat-symptoms');
    expect(symptomsProg.totalQuestions).toBe(2);
    expect(symptomsProg.answeredQuestions).toBe(0);
    expect(symptomsProg.percentage).toBe(0);
    expect(symptomsProg.isComplete).toBe(false);
  });

  it('calculates partial progress when some questions are answered', () => {
    // Only q-symptom-1 answered (1 of 2 questions in Symptoms = 50%), Food not answered (0%)
    const mockTodayLogs = [
      {
        _id: 'log-1',
        categoryId: 'cat-symptoms',
        answers: [{ optionId: 'opt-headache' }],
      },
    ];

    (useTodayCategoryLogs as jest.Mock).mockReturnValue({
      todayLogs: mockTodayLogs,
      getCategoryStatus: (catId: string) => ({
        isLoggedToday: catId === 'cat-symptoms',
        count: catId === 'cat-symptoms' ? 1 : 0,
      }),
      refetch: jest.fn(),
      isLoading: false,
    });

    const { result } = renderHook(() => useCategoryProgress());

    const symptomsProg = result.current.getCategoryProgress('cat-symptoms');
    expect(symptomsProg.totalQuestions).toBe(2);
    expect(symptomsProg.answeredQuestions).toBe(1);
    expect(symptomsProg.progress).toBe(0.5);
    expect(symptomsProg.percentage).toBe(50);
    expect(symptomsProg.isComplete).toBe(false);

    const foodProg = result.current.getCategoryProgress('cat-food');
    expect(foodProg.totalQuestions).toBe(1);
    expect(foodProg.answeredQuestions).toBe(0);
    expect(foodProg.progress).toBe(0);
    expect(foodProg.percentage).toBe(0);

    // Overall: (50% + 0%) / 2 = 25%
    expect(result.current.overallProgress).toBe(0.25);
    expect(result.current.overallPercentage).toBe(25);
    expect(result.current.completedCategoriesCount).toBe(0);
  });

  it('calculates 100% completion when all questions in all categories are answered', () => {
    const mockTodayLogs = [
      {
        _id: 'log-1',
        categoryId: 'cat-symptoms',
        answers: [{ optionId: 'opt-headache' }, { optionId: 'opt-mild' }],
      },
      {
        _id: 'log-2',
        categoryId: 'cat-food',
        answers: [{ optionId: 'opt-salad' }],
      },
    ];

    (useTodayCategoryLogs as jest.Mock).mockReturnValue({
      todayLogs: mockTodayLogs,
      getCategoryStatus: () => ({ isLoggedToday: true, count: 1 }),
      refetch: jest.fn(),
      isLoading: false,
    });

    const { result } = renderHook(() => useCategoryProgress());

    expect(result.current.overallProgress).toBe(1);
    expect(result.current.overallPercentage).toBe(100);
    expect(result.current.completedCategoriesCount).toBe(2);

    const symptomsProg = result.current.getCategoryProgress('cat-symptoms');
    expect(symptomsProg.isComplete).toBe(true);
    expect(symptomsProg.percentage).toBe(100);

    const foodProg = result.current.getCategoryProgress('cat-food');
    expect(foodProg.isComplete).toBe(true);
    expect(foodProg.percentage).toBe(100);
  });
});
