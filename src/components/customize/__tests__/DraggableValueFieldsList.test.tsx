import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DraggableValueFieldsList } from '../DraggableValueFieldsList';
import { FieldDefinition } from '@lumen/shared';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: 'medium', Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

const mockFields: FieldDefinition[] = [
  {
    key: 'amount',
    label: 'Amount',
    dataType: 'number',
    unit: 'Glass',
  },
  {
    key: 'type',
    label: 'Type',
    dataType: 'enum',
  },
];

describe('DraggableValueFieldsList', () => {
  const onReorder = jest.fn();
  const onEditField = jest.fn();
  const onRemoveField = jest.fn();
  const onDragStateChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders value fields with label, dataType, unit, key, and action buttons', () => {
    const { getByText, getByLabelText } = render(
      <DraggableValueFieldsList
        fields={mockFields}
        onReorder={onReorder}
        onEditField={onEditField}
        onRemoveField={onRemoveField}
        onDragStateChange={onDragStateChange}
      />
    );

    expect(getByText('Amount')).toBeTruthy();
    expect(getByText('number (Glass) · Key: amount')).toBeTruthy();
    expect(getByText('Type')).toBeTruthy();
    expect(getByText('enum · Key: type')).toBeTruthy();

    const editAmount = getByLabelText('Edit Amount');
    fireEvent.press(editAmount);
    expect(onEditField).toHaveBeenCalledWith(0);

    const deleteType = getByLabelText('Delete Type');
    fireEvent.press(deleteType);
    expect(onRemoveField).toHaveBeenCalledWith(1);
  });

  it('triggers onEditField on quick tap on the field row', () => {
    const { getByText } = render(
      <DraggableValueFieldsList
        fields={mockFields}
        onReorder={onReorder}
        onEditField={onEditField}
        onRemoveField={onRemoveField}
        onDragStateChange={onDragStateChange}
      />
    );

    fireEvent.press(getByText('Type'));
    expect(onEditField).toHaveBeenCalledWith(1);
  });

  it('renders nothing when fields array is empty', () => {
    const { toJSON } = render(
      <DraggableValueFieldsList
        fields={[]}
        onReorder={onReorder}
        onEditField={onEditField}
        onRemoveField={onRemoveField}
      />
    );

    expect(toJSON()).toBeNull();
  });
});
