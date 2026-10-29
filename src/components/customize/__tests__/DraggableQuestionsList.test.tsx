import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DraggableQuestionsList } from '../DraggableQuestionsList';
import { IQuestion } from '@lumen/shared';

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

const mockQuestions: IQuestion[] = [
  {
    _id: 'q1',
    categoryId: 'cat1',
    title: 'Fatigue Severity',
    selectionType: 'single',
    frequency: 'anytime',
    required: false,
    allowOther: false,
    order: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    _id: 'q2',
    categoryId: 'cat1',
    title: 'Brain Fog Symptoms',
    selectionType: 'multiple',
    frequency: 'morning',
    required: false,
    allowOther: true,
    order: 1,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('DraggableQuestionsList', () => {
  const onReorder = jest.fn();
  const onArchive = jest.fn();
  const getOptionCount = jest.fn((id: string) => (id === 'q1' ? 4 : 2));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders questions in normal mode with options count and edit button without delete on active items', () => {
    const { getByText, getByLabelText, queryByLabelText } = render(
      <DraggableQuestionsList
        questions={mockQuestions}
        categoryId="cat1"
        archiveMode={false}
        getOptionCount={getOptionCount}
        onReorder={onReorder}
        onArchive={onArchive}
      />
    );

    expect(getByText('Fatigue Severity')).toBeTruthy();
    expect(getByText('Brain Fog Symptoms')).toBeTruthy();
    expect(getByText(/4 options/)).toBeTruthy();
    expect(getByText(/Multi select · Morning only · 2 options · Other allowed/)).toBeTruthy();

    // No delete button on active questions
    expect(queryByLabelText('Delete Fatigue Severity')).toBeNull();

    // Edit button navigates
    const { router } = require('expo-router');
    const editBtn = getByLabelText('Edit Fatigue Severity');
    fireEvent.press(editBtn);
    expect(router.push).toHaveBeenCalledWith('/customize/question/q1?categoryId=cat1');
  });

  it('renders archive action only when archiveMode is true without reorder arrows or delete', () => {
    const { getByLabelText, queryByLabelText } = render(
      <DraggableQuestionsList
        questions={mockQuestions}
        categoryId="cat1"
        archiveMode={true}
        getOptionCount={getOptionCount}
        onReorder={onReorder}
        onArchive={onArchive}
      />
    );

    const archiveBtn = getByLabelText('Archive Fatigue Severity');
    fireEvent.press(archiveBtn);
    expect(onArchive).toHaveBeenCalledWith(mockQuestions[0]);

    // No move arrows or delete buttons
    expect(queryByLabelText('Move down')).toBeNull();
    expect(queryByLabelText('Move up')).toBeNull();
    expect(queryByLabelText('Delete question')).toBeNull();
  });

  it('navigates to question editor on quick tap in normal mode', () => {
    const { router } = require('expo-router');
    const { getByText } = render(
      <DraggableQuestionsList
        questions={mockQuestions}
        categoryId="cat1"
        archiveMode={false}
        getOptionCount={getOptionCount}
        onReorder={onReorder}
        onArchive={onArchive}
      />
    );

    fireEvent.press(getByText('Brain Fog Symptoms'));
    expect(router.push).toHaveBeenCalledWith('/customize/question/q2?categoryId=cat1');
  });
});
