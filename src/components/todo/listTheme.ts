import { Sun, Star, Calendar, ListTodo, CheckCircle2, Home } from 'lucide-react-native';
import type { IconComponent } from '../ios/InsetGroup';

/**
 * List colours. `light` is the swatch/fill. `text` and `dark` are the variants to use when the colour
 * is drawn as TEXT (large titles) on the light / dark page, chosen to stay readable on each.
 */
export interface ListColor {
  key: string;
  light: string;
  text: string;
  dark: string;
}

export const LIST_COLORS: ListColor[] = [
  { key: 'blue', light: '#007AFF', text: '#0066CC', dark: '#0A84FF' },
  { key: 'red', light: '#FF3B30', text: '#D70015', dark: '#FF453A' },
  { key: 'orange', light: '#FF9500', text: '#B25000', dark: '#FF9F0A' },
  { key: 'green', light: '#34C759', text: '#248A3D', dark: '#30D158' },
  { key: 'teal', light: '#30B0C7', text: '#1F7F94', dark: '#40C8E0' },
  { key: 'indigo', light: '#5856D6', text: '#4B4AC4', dark: '#7D7AFF' },
  { key: 'purple', light: '#AF52DE', text: '#8944AB', dark: '#BF5AF2' },
  { key: 'pink', light: '#FF2D55', text: '#D30F45', dark: '#FF375F' },
  { key: 'brown', light: '#A2845E', text: '#7F6545', dark: '#AC8E68' },
];

export const DEFAULT_LIST_COLOR = LIST_COLORS[0].light;

export const LIST_EMOJIS = ['📋', '🏠', '💼', '🩺', '💊', '🧘', '🛒', '🎯', '📚', '✈️', '🍎', '💡', '🏃', '❤️', '🌿', '🧠'];

/** Colour to use for a list's name drawn as text. Unknown (older) list colours fall back to blue. */
export function listTextColor(color: string | undefined, isDark: boolean): string {
  const match = LIST_COLORS.find((c) => c.light.toLowerCase() === (color ?? '').toLowerCase());
  const use = match ?? LIST_COLORS[0];
  return isDark ? use.dark : use.text;
}

export interface SmartListMeta {
  id: 'my-day' | 'important' | 'planned' | 'all' | 'completed' | 'tasks';
  title: string;
  icon: IconComponent;
  color: string;
}

export const SMART_LISTS: SmartListMeta[] = [
  { id: 'my-day', title: 'My Day', icon: Sun, color: '#007AFF' },
  { id: 'important', title: 'Important', icon: Star, color: '#FF3B30' },
  { id: 'planned', title: 'Planned', icon: Calendar, color: '#34C759' },
  { id: 'all', title: 'All', icon: ListTodo, color: '#5856D6' },
  { id: 'completed', title: 'Completed', icon: CheckCircle2, color: '#8E8E93' },
  { id: 'tasks', title: 'Tasks', icon: Home, color: '#007AFF' },
];

export function getSmartList(id: string): SmartListMeta | undefined {
  return SMART_LISTS.find((s) => s.id === id);
}

/** Text colour for a smart list's large title. */
export function smartListTextColor(id: string, isDark: boolean): string {
  const meta = getSmartList(id);
  if (!meta) return listTextColor(undefined, isDark);
  if (id === 'completed') return isDark ? '#98989D' : '#6C6C70';
  return listTextColor(meta.color, isDark);
}
