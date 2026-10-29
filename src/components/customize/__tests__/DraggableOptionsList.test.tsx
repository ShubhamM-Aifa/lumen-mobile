import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DraggableOptionsList } from '../DraggableOptionsList';
import { IOption } from '@lumen/shared';

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

const mockOptions: IOption[] = [
  {
    _id: 'opt1',
    userId: 'u1',
    questionId: 'q1',
    label: 'Mild',
    color: '#34C759',
    icon: 'smile',
    allowComment: false,
    captureTime: 'none',
    fields: [{ key: 'f1', label: 'Field 1', dataType: 'number' }],
    order: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    _id: 'opt2',
    userId: 'u1',
    questionId: 'q1',
    label: 'Severe',
    color: '#FF3B30',
    icon: 'frown',
    allowComment: false,
    captureTime: 'none',
    fields: [],
    order: 1,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('DraggableOptionsList', () => {
  const onReorder = jest.fn();
  const onArchive = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders options in normal mode with custom fields count and actions', () => {
    const { getByText, getByLabelText } = render(
      <DraggableOptionsList
        options={mockOptions}
        questionId="q1"
        archiveMode={false}
        onReorder={onReorder}
        onArchive={onArchive}
      />
    );

    expect(getByText('Mild')).toBeTruthy();
    expect(getByText('Severe')).toBeTruthy();
    expect(getByText('1 custom field')).toBeTruthy();

    const editBtn = getByLabelText('Edit Mild');
    fireEvent.press(editBtn);
    const { router } = require('expo-router');
    expect(router.push).toHaveBeenCalledWith('/customize/option/opt1?questionId=q1');
  });

  it('renders archive action only when archiveMode is true without reorder arrows', () => {
    const { getByLabelText, queryByLabelText } = render(
      <DraggableOptionsList
        options={mockOptions}
        questionId="q1"
        archiveMode={true}
        onReorder={onReorder}
        onArchive={onArchive}
      />
    );

    const archiveBtn = getByLabelText('Archive Mild');
    fireEvent.press(archiveBtn);
    expect(onArchive).toHaveBeenCalledWith(mockOptions[0]);

    // No reorder arrows
    expect(queryByLabelText('Move down')).toBeNull();
    expect(queryByLabelText('Move up')).toBeNull();
  });

  it('navigates to option editor on quick tap', () => {
    const { router } = require('expo-router');
    const { getByText } = render(
      <DraggableOptionsList
        options={mockOptions}
        questionId="q1"
        archiveMode={false}
        onReorder={onReorder}
        onArchive={onArchive}
      />
    );

    fireEvent.press(getByText('Severe'));
    expect(router.push).toHaveBeenCalledWith('/customize/option/opt2?questionId=q1');
  });
});
