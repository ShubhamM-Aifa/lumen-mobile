import React from 'react';
import { Linking } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { SafetyAlertHost } from '../safety/SafetyAlertHost';
import { useSafetyStore } from '../../store/safetyStore';
import type { SafetyFlag } from '../../api/client';

const flag = (id: string, level: SafetyFlag['level']): SafetyFlag => ({ id, level, title: `Title ${id}`, message: `Message ${id}` });

const flat = (c: unknown): string | null => {
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (Array.isArray(c) && c.length > 0 && c.every(x => typeof x === 'string' || typeof x === 'number')) return c.join('');
  return null;
};
const texts = (t: ReactTestRenderer) => Array.from(new Set(t.root.findAll(n => flat(n.props.children) !== null).map(n => flat(n.props.children) as string)));
const button = (t: ReactTestRenderer, label: string) =>
  t.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

async function render(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<SafetyAlertHost />); });
  return tree;
}

describe('SafetyAlertHost', () => {
  beforeEach(() => {
    useSafetyStore.setState({ flags: [] });
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('renders nothing when there is no notice', async () => {
    const tree = await render();
    expect(tree.toJSON()).toBeNull();
  });

  it('shows the notice with the fixed disclaimer, and an everyday one has no call button', async () => {
    useSafetyStore.setState({ flags: [flag('fever', 'today')] });
    const tree = await render();
    const x = texts(tree);
    expect(x).toContain('Title fever');
    expect(x).toContain('Message fever');
    expect(x.some(t => t.includes('cannot tell you what is wrong'))).toBe(true);
    expect(button(tree, 'Call 112')).toBeUndefined();
  });

  it('an urgent notice offers to open the dialer, and does not dial by itself', async () => {
    useSafetyStore.setState({ flags: [flag('vision_loss', 'now')] });
    const tree = await render();
    expect(Linking.openURL).not.toHaveBeenCalled();
    await act(async () => { button(tree, 'Call 112').props.onPress(); });
    expect(Linking.openURL).toHaveBeenCalledWith('tel:112');
  });

  it('moves to the next notice when one is read', async () => {
    useSafetyStore.setState({ flags: [flag('a', 'now'), flag('b', 'today')] });
    const tree = await render();
    expect(texts(tree)).toContain('Title a');
    await act(async () => { button(tree, 'I have read this').props.onPress(); });
    expect(texts(tree)).toContain('Title b');
    await act(async () => { button(tree, 'I have read this').props.onPress(); });
    expect(tree.toJSON()).toBeNull();
  });
});
