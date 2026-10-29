import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { OptionSelector } from '../OptionSelector';
import type { Answer } from '@lumen/shared';

const options = [
  { _id: 'a', label: 'Fatigue', icon: '😴', color: '#FF9500', fields: [], allowComment: false, isActive: true, order: 0 },
  { _id: 'b', label: 'Joint pain', color: '#FF3B30', fields: [], allowComment: true, isActive: true, order: 1 },
] as never[];

async function render(props: Partial<React.ComponentProps<typeof OptionSelector>> = {}) {
  const onChange = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <OptionSelector options={options} selectionType="multiple" allowOther={false} answers={[]} onChange={onChange} {...props} />,
    );
  });
  return { tree, onChange };
}

const row = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

describe('OptionSelector', () => {
  it('exposes each option as a checkbox with its checked state', async () => {
    const answers: Answer[] = [{ optionId: 'a', optionLabelSnapshot: 'Fatigue', values: [] }];
    const { tree } = await render({ answers });
    expect(row(tree, 'Fatigue').props.accessibilityRole).toBe('checkbox');
    expect(row(tree, 'Fatigue').props.accessibilityState).toEqual({ checked: true });
    expect(row(tree, 'Joint pain').props.accessibilityState).toEqual({ checked: false });
  });

  it('adds to the selection in multiple mode and removes on a second tap', async () => {
    const existing: Answer[] = [{ optionId: 'a', optionLabelSnapshot: 'Fatigue', values: [] }];
    const { tree, onChange } = await render({ answers: existing });
    await act(async () => { row(tree, 'Joint pain').props.onPress(); });
    expect(onChange).toHaveBeenLastCalledWith([
      existing[0],
      { optionId: 'b', optionLabelSnapshot: 'Joint pain', values: [] },
    ]);
    await act(async () => { row(tree, 'Fatigue').props.onPress(); });
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('replaces the selection in single mode', async () => {
    const existing: Answer[] = [{ optionId: 'a', optionLabelSnapshot: 'Fatigue', values: [] }];
    const { tree, onChange } = await render({ answers: existing, selectionType: 'single' });
    await act(async () => { row(tree, 'Joint pain').props.onPress(); });
    expect(onChange).toHaveBeenLastCalledWith([{ optionId: 'b', optionLabelSnapshot: 'Joint pain', values: [] }]);
  });

  it('shows the comment box only for a selected option that allows comments', async () => {
    const answers: Answer[] = [{ optionId: 'b', optionLabelSnapshot: 'Joint pain', values: [] }];
    const { tree } = await render({ answers });
    const comment = tree.root.findAll(n => n.props.accessibilityLabel === 'Comment for Joint pain');
    expect(comment.length).toBeGreaterThan(0);
    const none = await render({ answers: [] });
    expect(none.tree.root.findAll(n => n.props.accessibilityLabel === 'Comment for Joint pain')).toHaveLength(0);
  });

  it('records free text under the Other option', async () => {
    const { tree, onChange } = await render({ allowOther: true });
    const input = tree.root.findAll(n => n.props.accessibilityLabel === 'Other option' && typeof n.props.onChangeText === 'function')[0];
    await act(async () => { input.props.onChangeText('Tingling'); });
    expect(onChange).toHaveBeenLastCalledWith([
      { optionId: '__other__', optionLabelSnapshot: 'Other', values: [], otherText: 'Tingling' },
    ]);
  });

  it('renders time picker for options with captureTime user_picks when selected', async () => {
    const optionsWithTime = [
      { _id: 'time_opt', label: 'Exercise', captureTime: 'user_picks', fields: [], allowComment: false, isActive: true, order: 0 },
    ] as never[];
    const answers: Answer[] = [{ optionId: 'time_opt', optionLabelSnapshot: 'Exercise', values: [{ fieldKey: 'time', dataType: 'time', value: '14:30' }] }];
    const { tree } = await render({ options: optionsWithTime, answers });
    const timeElements = tree.root.findAll(n =>
      (typeof n.props.children === 'string' && n.props.children.includes('Time')) ||
      (typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.includes('Time'))
    );
    expect(timeElements.length).toBeGreaterThan(0);
  });

  it('displays user-picks time field for options with captureTime when selected', async () => {
    const optionsWithTime = [
      { _id: 'auto_time_opt', label: 'Fatigue', captureTime: 'user_picks', fields: [], allowComment: false, isActive: true, order: 0 },
    ] as never[];
    const answers: Answer[] = [{ optionId: 'auto_time_opt', optionLabelSnapshot: 'Fatigue', values: [{ fieldKey: 'time', dataType: 'time', value: '10:15' }] }];
    const { tree } = await render({ options: optionsWithTime, answers });
    const timeElements = tree.root.findAll(n =>
      (typeof n.props.children === 'string' && n.props.children.includes('Time it happened')) ||
      (typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.includes('Time'))
    );
    expect(timeElements.length).toBeGreaterThan(0);
  });
});
