import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import {
  Droplets,
  Droplet,
  PersonStanding,
  Sparkles,
  Pill,
  Flame,
  Footprints,
  Coffee,
  Utensils,
  Apple,
  Sun,
  ShowerHead,
  Bath,
  Bed,
  Moon,
  Activity,
  Wine,
  Eye,
  Wind,
  Heart,
  Zap,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

export interface QuickActionIconProps {
  icon: string;
  templateKey?: string;
  label?: string;
  color?: string;
  size?: number;
  strokeWidth?: number;
}

/**
 * Dedicated vector icon for soap bar & lather bubbles.
 * Clean, recognizable, and distinct from the Sparkles icon used in the Insights tab!
 */
export function SoapBarIcon({
  size = 22,
  color,
  fillTint,
  strokeWidth = 2.2,
}: {
  size?: number;
  color: string;
  fillTint?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Soap bar body */}
      <Rect
        x="3"
        y="9"
        width="18"
        height="11"
        rx="4"
        stroke={color}
        strokeWidth={strokeWidth}
        fill={fillTint || 'none'}
      />
      {/* Subtle lather contour */}
      <Path
        d="M7.5 14.5c2.8-1.5 6.2-1.5 9 0"
        stroke={color}
        strokeWidth={Math.max(1.4, strokeWidth - 0.6)}
        strokeLinecap="round"
      />
      {/* Floating lather bubbles */}
      <Circle
        cx="7.5"
        cy="4.5"
        r="2"
        stroke={color}
        strokeWidth={Math.max(1.5, strokeWidth - 0.5)}
        fill={fillTint || 'none'}
      />
      <Circle
        cx="14"
        cy="3.5"
        r="2.5"
        stroke={color}
        strokeWidth={Math.max(1.5, strokeWidth - 0.5)}
        fill={fillTint || 'none'}
      />
      <Circle
        cx="18.5"
        cy="5.5"
        r="1.3"
        stroke={color}
        strokeWidth={Math.max(1.3, strokeWidth - 0.7)}
      />
    </Svg>
  );
}

// Saturated high-contrast color mapping for light mode
const LIGHT_CONTRAST_COLORS: Record<string, string> = {
  '#29B6F6': '#0284C7', // Water
  '#4FC3F7': '#0284C7',
  '#80DEEA': '#0891B2',
  '#80CBC4': '#0D9488', // Face wash / Mint
  '#B2DFDB': '#0D9488',
  '#4DB6AC': '#0F766E',
  '#66BB6A': '#16A34A', // Stood up / Green
  '#81C784': '#15803D',
  '#A5D6A7': '#15803D',
  '#CE93D8': '#9333EA', // Meds / Purple
  '#9FA8DA': '#4F46E5',
  '#EF5350': '#DC2626', // Flare / Red
  '#EF9A9A': '#E11D48', // Snack / Pink
  '#FFD54F': '#D97706', // Sun / Amber
  '#FFF9C4': '#CA8A04', // Urination / Yellow
  '#A1887F': '#78350F', // Coffee / Brown
  '#8D6E63': '#78350F', // Bowel / Brown
  '#B0BEC5': '#475569', // Slate / Gray
  '#CFD8DC': '#475569',
};

export function getSaturatedColor(color: string | undefined, isDark: boolean): string {
  if (!color) return '#3B82F6';
  if (isDark) return color;
  const upper = color.toUpperCase();
  return LIGHT_CONTRAST_COLORS[upper] || color;
}

export function QuickActionIcon({
  icon,
  templateKey,
  label,
  color,
  size = 22,
  strokeWidth = 2.3,
}: QuickActionIconProps) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const iconColor = getSaturatedColor(color, isDark);
  const fillTint = `${iconColor}24`;

  const cleanIcon = (icon || '').trim();
  const cleanKey = (templateKey || '').toLowerCase();
  const cleanLabel = (label || '').toLowerCase();

  // 1. Water
  if (
    cleanKey === 'qa_water' ||
    cleanIcon === '💧' ||
    cleanIcon === '🌊' ||
    cleanLabel.includes('water') ||
    cleanLabel.includes('hydrate')
  ) {
    return <Droplets size={size} color={iconColor} strokeWidth={strokeWidth} fill={fillTint} />;
  }

  // 2. Stood up / Stand
  if (
    cleanKey === 'qa_stood_up' ||
    cleanIcon === '🧍' ||
    cleanIcon === '🧍‍♂️' ||
    cleanIcon === '🧍‍♀️' ||
    cleanLabel.includes('stood') ||
    cleanLabel.includes('stand')
  ) {
    return <PersonStanding size={size + 2} color={iconColor} strokeWidth={strokeWidth + 0.1} />;
  }

  // 3. Face wash / Clean / Wash (uses SoapBarIcon — distinct from Sparkles in Insights tab!)
  if (
    cleanKey === 'qa_face_wash' ||
    cleanKey === 'qa_hand_wash' ||
    cleanIcon === '🧼' ||
    cleanIcon === '🙌' ||
    cleanLabel.includes('face wash') ||
    cleanLabel.includes('wash')
  ) {
    return <SoapBarIcon size={size} color={iconColor} strokeWidth={strokeWidth} fillTint={fillTint} />;
  }

  // 4. Meds taken / Medication / Pill
  if (
    cleanKey === 'qa_medication' ||
    cleanIcon === '💊' ||
    cleanLabel.includes('med') ||
    cleanLabel.includes('pill')
  ) {
    return <Pill size={size} color={iconColor} strokeWidth={strokeWidth} fill={fillTint} />;
  }

  // 5. Flare now! / Flame
  if (
    cleanKey === 'qa_flare' ||
    cleanIcon === '🔥' ||
    cleanLabel.includes('flare')
  ) {
    return <Flame size={size + 1} color={iconColor} strokeWidth={strokeWidth} fill={fillTint} />;
  }

  // 6. Walk
  if (
    cleanKey === 'qa_walk' ||
    cleanIcon === '🚶' ||
    cleanIcon === '🚶‍♂️' ||
    cleanIcon === '🚶‍♀️' ||
    cleanLabel.includes('walk')
  ) {
    return <Footprints size={size} color={iconColor} strokeWidth={strokeWidth} />;
  }

  // 7. Coffee / Tea
  if (
    cleanKey === 'qa_coffee' ||
    cleanIcon === '☕' ||
    cleanLabel.includes('coffee') ||
    cleanLabel.includes('tea')
  ) {
    return <Coffee size={size} color={iconColor} strokeWidth={strokeWidth} />;
  }

  // 8. Meal / Food
  if (
    cleanKey === 'qa_meal' ||
    cleanIcon === '🍽️' ||
    cleanIcon === '🍽' ||
    cleanLabel.includes('meal') ||
    cleanLabel.includes('food')
  ) {
    return <Utensils size={size} color={iconColor} strokeWidth={strokeWidth} />;
  }

  // 9. Snack
  if (
    cleanKey === 'qa_snack' ||
    cleanIcon === '🍎' ||
    cleanLabel.includes('snack')
  ) {
    return <Apple size={size} color={iconColor} strokeWidth={strokeWidth} fill={fillTint} />;
  }

  // 10. Shower
  if (
    cleanKey === 'qa_shower' ||
    cleanIcon === '🚿' ||
    cleanLabel.includes('shower')
  ) {
    return <ShowerHead size={size} color={iconColor} strokeWidth={strokeWidth} />;
  }

  // 11. Bath
  if (cleanIcon === '🛁' || cleanLabel.includes('bath')) {
    return <Bath size={size} color={iconColor} strokeWidth={strokeWidth} />;
  }

  // 12. Sun exposure
  if (
    cleanKey === 'qa_sun' ||
    cleanIcon === '☀️' ||
    cleanLabel.includes('sun')
  ) {
    return <Sun size={size} color={iconColor} strokeWidth={strokeWidth} fill={fillTint} />;
  }

  // 13. Nap / Sleep
  if (
    cleanKey === 'qa_nap' ||
    cleanIcon === '😴' ||
    cleanIcon === '💤' ||
    cleanLabel.includes('nap') ||
    cleanLabel.includes('sleep')
  ) {
    return <Moon size={size} color={iconColor} strokeWidth={strokeWidth} fill={fillTint} />;
  }

  // 14. Rest / Lie down
  if (
    cleanKey === 'qa_rest' ||
    cleanIcon === '🛋️' ||
    cleanLabel.includes('rest') ||
    cleanLabel.includes('lie down')
  ) {
    return <Bed size={size} color={iconColor} strokeWidth={strokeWidth} />;
  }

  // 15. Stretch / Yoga / Physical Activity
  if (
    cleanKey === 'qa_stretch' ||
    cleanIcon === '🧘' ||
    cleanIcon === '🧘‍♂️' ||
    cleanIcon === '🧘‍♀️' ||
    cleanLabel.includes('stretch') ||
    cleanLabel.includes('yoga')
  ) {
    return <Activity size={size} color={iconColor} strokeWidth={strokeWidth} />;
  }

  // 16. Alcohol / Wine
  if (
    cleanKey === 'qa_alcohol' ||
    cleanIcon === '🍷' ||
    cleanIcon === '🍺' ||
    cleanLabel.includes('alcohol') ||
    cleanLabel.includes('wine')
  ) {
    return <Wine size={size} color={iconColor} strokeWidth={strokeWidth} />;
  }

  // 17. Meditation
  if (
    cleanKey === 'qa_meditation' ||
    cleanIcon === '😮‍💨' ||
    cleanLabel.includes('meditat')
  ) {
    return <Wind size={size} color={iconColor} strokeWidth={strokeWidth} />;
  }

  // 18. Screen break
  if (
    cleanKey === 'qa_screen_break' ||
    cleanIcon === '📱' ||
    cleanLabel.includes('screen')
  ) {
    return <Eye size={size} color={iconColor} strokeWidth={strokeWidth} />;
  }

  // 19. Heart / Health
  if (cleanIcon === '❤️' || cleanIcon === '🫀' || cleanLabel.includes('heart')) {
    return <Heart size={size} color={iconColor} strokeWidth={strokeWidth} fill={fillTint} />;
  }

  // 20. Energy / Zap
  if (cleanIcon === '⚡') {
    return <Zap size={size} color={iconColor} strokeWidth={strokeWidth} fill={fillTint} />;
  }

  // 21. Urination / Drops
  if (cleanKey === 'qa_urination' || cleanIcon === '🚽') {
    return <Droplet size={size} color={iconColor} strokeWidth={strokeWidth} fill={fillTint} />;
  }

  // Fallback to text emoji with proper centering and typography
  return (
    <Text style={[styles.fallbackEmoji, { fontSize: size }]} numberOfLines={1}>
      {cleanIcon || '⚡'}
    </Text>
  );
}

const styles = StyleSheet.create({
  fallbackEmoji: {
    textAlign: 'center',
    includeFontPadding: false,
  },
});
