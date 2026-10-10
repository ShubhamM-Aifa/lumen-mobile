import { renderHook } from '@testing-library/react-native';
import { useTodayCategoryLogs } from '../useTodayCategoryLogs';
import { useAuthStore } from '../../store/authStore';
import { useQuery } from '@tanstack/react-query';

jest.mock('../../store/authStore');
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: jest.fn(),
  };
});
jest.mock('../../api/client');

describe('useTodayCategoryLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: {
        preferences: { dayBoundaryHour: 4 },
      },
    });
  });

  it('correctly maps logs to categories and computes status', () => {
    const mockLogs = [
      {
        _id: 'log-1',
        categoryId: 'cat-symptoms',
        occurredAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30m ago
      },
      {
        _id: 'log-2',
        categoryId: 'cat-symptoms',
        occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
      },
    ];

    (useQuery as jest.Mock).mockReturnValue({
      data: mockLogs,
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => useTodayCategoryLogs());

    const symptomStatus = result.current.getCategoryStatus('cat-symptoms');
    expect(symptomStatus.isLoggedToday).toBe(true);
    expect(symptomStatus.count).toBe(2);
    expect(symptomStatus.latestLog?._id).toBe('log-1');
    expect(symptomStatus.latestTimeStr).toBe('30m ago');

    const foodStatus = result.current.getCategoryStatus('cat-food');
    expect(foodStatus.isLoggedToday).toBe(false);
    expect(foodStatus.count).toBe(0);
    expect(foodStatus.latestLog).toBeUndefined();
  });

  it('correctly maps question-level history and formats answer summaries', () => {
    const mockOptions = [
      { _id: 'opt-headache', questionId: 'q-symptom', label: 'Headache', order: 1, isActive: true },
      { _id: 'opt-pain', questionId: 'q-pain-level', label: 'Pain Level', order: 1, isActive: true },
    ];

    const mockLogs = [
      {
        _id: 'log-1',
        categoryId: 'cat-symptoms',
        occurredAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        answers: [
          { optionId: 'opt-headache', optionLabelSnapshot: 'Headache' },
          { optionId: 'opt-pain', values: [{ value: 7, unit: '/10' }] },
        ],
      },
      {
        _id: 'log-2',
        categoryId: 'cat-symptoms',
        occurredAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        answers: [
          { optionId: 'opt-pain', values: [{ value: 4, unit: '/10' }] },
        ],
      },
    ];

    (useQuery as jest.Mock).mockReturnValue({
      data: mockLogs,
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => useTodayCategoryLogs());

    const painHistory = result.current.getQuestionTodayHistory('q-pain-level', [mockOptions[1]], 'cat-symptoms');
    expect(painHistory.length).toBe(2);
    expect(painHistory[0].logId).toBe('log-1');
    expect(painHistory[0].summaryText).toBe('Pain Level (7 /10)');
    expect(painHistory[1].logId).toBe('log-2');
    expect(painHistory[1].summaryText).toBe('Pain Level (4 /10)');

    const headacheHistory = result.current.getQuestionTodayHistory('q-symptom', [mockOptions[0]], 'cat-symptoms');
    expect(headacheHistory.length).toBe(1);
    expect(headacheHistory[0].summaryText).toBe('Headache');

    const unmatchedHistory = result.current.getQuestionTodayHistory('q-unmatched', [], 'cat-symptoms');
    expect(unmatchedHistory.length).toBe(0);
  });
});
