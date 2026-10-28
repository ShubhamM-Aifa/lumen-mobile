import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { QuickActionButton } from '../QuickActionButton';
import { useQuickLogStore } from '../../store/quickLogStore';
import { useAuthStore } from '../../store/authStore';
import { IQuickAction } from '@lumen/shared';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

const mockActionNoGoal: IQuickAction = {
  _id: 'qa-1',
  userId: 'u-1',
  label: 'Quick Walk',
  icon: '🚶',
  color: '#34C759',
  mode: 'counter',
  order: 1,
  isVisible: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockActionWithGoal: IQuickAction = {
  _id: 'qa-2',
  userId: 'u-1',
  label: 'Drink Water',
  icon: '💧',
  color: '#007AFF',
  mode: 'counter',
  dailyGoal: 5,
  order: 2,
  isVisible: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockActionWithDefaultValueGoal: IQuickAction = {
  _id: 'qa-3',
  userId: 'u-1',
  label: 'Hydration',
  icon: '💧',
  color: '#007AFF',
  mode: 'counter',
  defaultValue: 250,
  dailyGoal: 2000, // 2000 / 250 = 8 taps
  order: 3,
  isVisible: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('QuickActionButton', () => {
  const mockTap = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: {
        _id: 'u-1',
        name: 'Test User',
        email: 'test@example.com',
        preferences: { dayBoundaryHour: 4 },
      } as never,
    });
    useQuickLogStore.setState({
      todayTaps: {},
      tap: mockTap,
    });
  });

  it('renders default button without goal as standard Quick Tap', () => {
    const { getByText, getByRole } = render(<QuickActionButton action={mockActionNoGoal} />);

    expect(getByText('Quick Walk')).toBeTruthy();
    expect(getByText('Tap to log')).toBeTruthy();

    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Quick Walk, not logged yet today');

    fireEvent.press(button);
    expect(mockTap).toHaveBeenCalledWith('qa-1', undefined, 4);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('renders button with goal showing 0/target when not logged yet', () => {
    const { getByText, getByRole } = render(<QuickActionButton action={mockActionWithGoal} />);

    expect(getByText('Drink Water')).toBeTruthy();
    expect(getByText('0/5 · Tap to log')).toBeTruthy();

    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Drink Water, goal 0 of 5, 0 percent complete');
  });

  it('calculates target correctly when dailyGoal is divided by defaultValue', () => {
    const { getByText, getByRole } = render(<QuickActionButton action={mockActionWithDefaultValueGoal} />);

    expect(getByText('Hydration')).toBeTruthy();
    expect(getByText('0/8 · Tap to log')).toBeTruthy();

    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Hydration, goal 0 of 8, 0 percent complete');
  });

  it('renders progress and current count when partially logged', () => {
    useQuickLogStore.setState({
      todayTaps: {
        'qa-2': {
          id: 'tap-1',
          quickActionId: 'qa-2',
          occurredAt: new Date().toISOString(),
          count: 2,
          lastAt: new Date().toISOString(),
          synced: true,
        },
      },
      tap: mockTap,
    });

    const { getByText, getByRole } = render(<QuickActionButton action={mockActionWithGoal} />);

    expect(getByText(/2\/5/)).toBeTruthy();
    expect(getByText('2')).toBeTruthy(); // count inside the activity ring

    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Drink Water, goal 2 of 5, 40 percent complete');
  });

  it('renders completed state with Goal met and checkmark when goal is reached', () => {
    useQuickLogStore.setState({
      todayTaps: {
        'qa-2': {
          id: 'tap-1',
          quickActionId: 'qa-2',
          occurredAt: new Date().toISOString(),
          count: 5,
          lastAt: new Date().toISOString(),
          synced: true,
        },
      },
      tap: mockTap,
    });

    const { getByText, getByRole } = render(<QuickActionButton action={mockActionWithGoal} />);

    expect(getByText('5/5 · Goal met')).toBeTruthy();

    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toContain('goal reached');
  });

  it('triggers celebration haptics when a tap reaches or completes the goal', async () => {
    // Current count is 4, target is 5
    useQuickLogStore.setState({
      todayTaps: {
        'qa-2': {
          id: 'tap-1',
          quickActionId: 'qa-2',
          occurredAt: new Date().toISOString(),
          count: 4,
          lastAt: new Date().toISOString(),
          synced: true,
        },
      },
      tap: mockTap,
    });

    const { getByRole } = render(<QuickActionButton action={mockActionWithGoal} />);
    const button = getByRole('button');

    await act(async () => {
      fireEvent.press(button);
    });

    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(mockTap).toHaveBeenCalledWith('qa-2', undefined, 4);
  });

  it('respects onPressOverride when provided', async () => {
    const override = jest.fn();
    const { getByRole } = render(<QuickActionButton action={mockActionWithGoal} onPressOverride={override} />);
    const button = getByRole('button');

    await act(async () => {
      fireEvent.press(button);
    });

    expect(override).toHaveBeenCalled();
    expect(mockTap).not.toHaveBeenCalled();
  });
});
