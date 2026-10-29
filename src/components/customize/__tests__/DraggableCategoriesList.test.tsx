import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { DraggableCategoriesList } from '../DraggableCategoriesList';
import { ICategory } from '@lumen/shared';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: 'medium', Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

const mockCategories: ICategory[] = [
  {
    _id: 'cat1',
    name: 'Physical Symptoms',
    role: 'symptom',
    color: '#FF3B30',
    icon: 'activity',
    order: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    _id: 'cat2',
    name: 'Daily Habits',
    role: 'habit',
    color: '#34C759',
    icon: 'sun',
    order: 1,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('DraggableCategoriesList', () => {
  const onReorder = jest.fn();
  const onArchive = jest.fn();
  const getQuestionCount = jest.fn((id: string) => (id === 'cat1' ? 5 : 3));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders categories in normal mode with question count and actions', () => {
    const { getByText, getByLabelText } = render(
      <DraggableCategoriesList
        categories={mockCategories}
        archiveMode={false}
        getQuestionCount={getQuestionCount}
        onReorder={onReorder}
        onArchive={onArchive}
      />
    );

    expect(getByText('Physical Symptoms')).toBeTruthy();
    expect(getByText('Daily Habits')).toBeTruthy();
    expect(getByText(/Symptoms · 5 questions/)).toBeTruthy();
    expect(getByText(/Habits · 3 questions/)).toBeTruthy();

    const manageBtn = getByLabelText('Settings for Physical Symptoms');
    fireEvent.press(manageBtn);
    const { router } = require('expo-router');
    expect(router.push).toHaveBeenCalledWith('/customize/category/cat1');
  });

  it('renders archive action only when archiveMode is true without reorder arrows', () => {
    const { getByLabelText, queryByLabelText } = render(
      <DraggableCategoriesList
        categories={mockCategories}
        archiveMode={true}
        getQuestionCount={getQuestionCount}
        onReorder={onReorder}
        onArchive={onArchive}
      />
    );

    const archiveBtn = getByLabelText('Archive Physical Symptoms');
    fireEvent.press(archiveBtn);
    expect(onArchive).toHaveBeenCalledWith(mockCategories[0]);

    // No reorder arrows
    expect(queryByLabelText('Move down')).toBeNull();
    expect(queryByLabelText('Move up')).toBeNull();
  });

  it('navigates to category questions on chevron press', () => {
    const { router } = require('expo-router');
    const { getByLabelText } = render(
      <DraggableCategoriesList
        categories={mockCategories}
        archiveMode={false}
        getQuestionCount={getQuestionCount}
        onReorder={onReorder}
        onArchive={onArchive}
      />
    );

    const chevronBtn = getByLabelText('Open Physical Symptoms questions');
    fireEvent.press(chevronBtn);
    expect(router.push).toHaveBeenCalledWith('/customize/questions/cat1');
  });

  it('navigates to category questions on quick tap', () => {
    const { router } = require('expo-router');
    const { getByText } = render(
      <DraggableCategoriesList
        categories={mockCategories}
        archiveMode={false}
        getQuestionCount={getQuestionCount}
        onReorder={onReorder}
        onArchive={onArchive}
      />
    );

    fireEvent.press(getByText('Physical Symptoms'));
    expect(router.push).toHaveBeenCalledWith('/customize/questions/cat1');
  });

  it('activates hold to drag, disables scroll, and reorders on release', async () => {
    jest.useFakeTimers();
    const onDragStateChange = jest.fn();
    const { getByText } = render(
      <DraggableCategoriesList
        categories={mockCategories}
        archiveMode={false}
        getQuestionCount={getQuestionCount}
        onReorder={onReorder}
        onArchive={onArchive}
        onDragStateChange={onDragStateChange}
      />
    );

    // Find the draggable area for first item
    const itemText = getByText('Physical Symptoms');
    let dragArea: any = itemText;
    while (dragArea && !dragArea.props.onResponderGrant) {
      dragArea = dragArea.parent;
    }
    expect(dragArea).toBeTruthy();

    const startEvent: any = {
      nativeEvent: { touches: [{ pageX: 0, pageY: 0 }] },
      touchHistory: {
        touchBank: [
          {
            touchActive: true,
            currentPageX: 0,
            currentPageY: 0,
            previousPageX: 0,
            previousPageY: 0,
            currentTimeStamp: 1,
            startPageX: 0,
            startPageY: 0,
            startTimeStamp: 1,
          },
        ],
        numberActiveTouches: 1,
        indexOfSingleActiveTouch: 0,
        mostRecentTimeStamp: 1,
      },
    };

    // Touch down (start pan responder)
    act(() => {
      dragArea.props.onResponderGrant(startEvent);
    });

    // Advance past hold threshold (180ms)
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(onDragStateChange).toHaveBeenCalledWith(true);

    const moveEvent: any = {
      nativeEvent: { touches: [{ pageX: 0, pageY: 70 }] },
      touchHistory: {
        touchBank: [
          {
            touchActive: true,
            currentPageX: 0,
            currentPageY: 70,
            previousPageX: 0,
            previousPageY: 0,
            currentTimeStamp: 2,
            startPageX: 0,
            startPageY: 0,
            startTimeStamp: 1,
          },
        ],
        numberActiveTouches: 1,
        indexOfSingleActiveTouch: 0,
        mostRecentTimeStamp: 2,
      },
    };

    // Move downwards by 70px (row height is ~62px, so target is index 1)
    act(() => {
      dragArea.props.onResponderMove(moveEvent);
    });

    // Release finger
    act(() => {
      dragArea.props.onResponderRelease(moveEvent);
    });

    // Run animations
    act(() => {
      jest.runAllTimers();
    });

    expect(onDragStateChange).toHaveBeenCalledWith(false);
    expect(onReorder).toHaveBeenCalledWith([mockCategories[1], mockCategories[0]]);

    jest.useRealTimers();
  });
});
