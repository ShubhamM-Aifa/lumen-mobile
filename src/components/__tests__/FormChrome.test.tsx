import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { ScreenTopBar, HeaderTextButton } from '../ios/ScreenTopBar';
import { FloatingCta } from '../ios/FloatingCta';
import { NoteField } from '../ios/NoteField';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

async function render(el: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(el); });
  return tree;
}

// Innermost match: wrapper components can carry the same props as the control they render.
const byLabel = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function').pop()!;

describe('ScreenTopBar', () => {
  it('shows the title and calls onBack from the back button', async () => {
    const onBack = jest.fn();
    const tree = await render(<ScreenTopBar title="Quick Log" onBack={onBack} />);
    expect(tree.root.findAll(n => n.props.children === 'Quick Log').length).toBeGreaterThan(0);
    await act(async () => { byLabel(tree, 'Back').props.onPress(); });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('uses a custom back label for sheets and renders the right slot', async () => {
    const tree = await render(
      <ScreenTopBar backIcon="close" backLabel="Close" sheet onBack={jest.fn()} right={<HeaderTextButton label="Skip" onPress={jest.fn()} />} />,
    );
    expect(byLabel(tree, 'Close')).toBeDefined();
    expect(byLabel(tree, 'Skip')).toBeDefined();
  });
});

describe('HeaderTextButton', () => {
  it('presses, and ignores presses while loading', async () => {
    const onPress = jest.fn();
    const idle = await render(<HeaderTextButton label="Save" accessibilityLabel="Save changes" prominent onPress={onPress} />);
    await act(async () => { byLabel(idle, 'Save changes').props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);

    const busy = await render(<HeaderTextButton label="Save" accessibilityLabel="Save changes" prominent loading onPress={onPress} />);
    expect(byLabel(busy, 'Save changes').props.accessibilityState).toEqual({ disabled: true, busy: true });
  });
});

describe('FloatingCta', () => {
  it('fires onPress and is disabled and busy while loading', async () => {
    const onPress = jest.fn();
    const tree = await render(<FloatingCta label="Save check-in" onPress={onPress} />);
    await act(async () => { byLabel(tree, 'Save check-in').props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);

    const loading = await render(<FloatingCta label="Save check-in" onPress={onPress} loading />);
    expect(byLabel(loading, 'Save check-in').props.accessibilityState).toEqual({ disabled: true, busy: true });
  });
});

describe('NoteField', () => {
  it('reports typed text and exposes an accessible input', async () => {
    const onChangeText = jest.fn();
    const tree = await render(<NoteField title="Notes" value="" onChangeText={onChangeText} placeholder="Add a note" />);
    const input = tree.root.findAll(n => n.props.accessibilityLabel === 'Notes' && typeof n.props.onChangeText === 'function')[0];
    await act(async () => { input.props.onChangeText('Felt stiff'); });
    expect(onChangeText).toHaveBeenCalledWith('Felt stiff');
    expect(input.props.placeholder).toBe('Add a note');
  });
});
