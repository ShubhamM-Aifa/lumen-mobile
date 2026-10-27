import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AppleSwitch } from '../common/AppleSwitch';

describe('AppleSwitch Component', () => {
  it('renders switch with correct accessibility role and unchecked state', () => {
    const { getByRole } = render(
      <AppleSwitch value={false} accessibilityLabel="Biometric App Lock" />
    );

    const switchEl = getByRole('switch');
    expect(switchEl).toBeTruthy();
    expect(switchEl.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false })
    );
  });

  it('renders checked state when value is true', () => {
    const { getByRole } = render(
      <AppleSwitch value={true} accessibilityLabel="Biometric App Lock" />
    );

    const switchEl = getByRole('switch');
    expect(switchEl.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true })
    );
  });

  it('calls onValueChange with toggled boolean value on press', () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <AppleSwitch value={false} onValueChange={onValueChange} accessibilityLabel="Enable Alarms" />
    );

    const switchEl = getByRole('switch');
    fireEvent.press(switchEl);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('does not trigger onValueChange when disabled', () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <AppleSwitch value={false} disabled={true} onValueChange={onValueChange} />
    );

    const switchEl = getByRole('switch');
    fireEvent.press(switchEl);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(switchEl.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true })
    );
  });

  it('supports small sizing variant', () => {
    const { getByRole } = render(
      <AppleSwitch value={true} size="small" />
    );

    const switchEl = getByRole('switch');
    expect(switchEl.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 42, height: 25 }),
      ])
    );
  });
});
