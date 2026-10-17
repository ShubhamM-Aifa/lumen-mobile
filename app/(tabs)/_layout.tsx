import React, { useRef, useEffect } from 'react';
import {
  View,
  Animated,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Tabs, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Home,
  CalendarDays,
  Sparkles,
  SlidersHorizontal,
  Plus,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/theme/ThemeContext';
import { useCategoryProgress } from '../../src/hooks/useCategoryProgress';

export default function TabLayout() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();

  // Dynamically account for Android 3-button navigation bar (~48dp), gesture pill (~16-24dp), and iOS Home Indicator (~34dp)
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 8);
  const baseContentHeight = 56;
  const tabHeight = baseContentHeight + bottomInset;
  const tabPaddingBottom = bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textDisabled,
        tabBarBackground: () => <CurvedTabBarBackground tabHeight={tabHeight} />,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: tabHeight,
          paddingBottom: tabPaddingBottom,
          paddingTop: 6,
          overflow: 'visible',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabBarIcon IconComponent={Home} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: 'Timeline',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabBarIcon IconComponent={CalendarDays} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="action"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarButton: () => (
            <CenterAddButton onPress={() => router.push('/log')} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/log');
          },
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabBarIcon IconComponent={Sparkles} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="customize"
        options={{
          title: 'Customize',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabBarIcon IconComponent={SlidersHorizontal} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

/**
 * Animated Tab Bar Icon
 * Delivers playful spring scale bounce on selection + active dot indicator
 */
function AnimatedTabBarIcon({
  IconComponent,
  color,
  focused,
}: {
  IconComponent: React.ComponentType<{ size: number; color: any; strokeWidth: number }>;
  color: any;
  focused: boolean;
}) {
  const { palette } = useTheme();
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.95)).current;
  const dotScaleAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (focused) {
      Animated.parallel([
        Animated.sequence([
          Animated.spring(scaleAnim, {
            toValue: 1.2,
            friction: 4,
            tension: 220,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 5,
            tension: 110,
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(dotScaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 140,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(dotScaleAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [focused, scaleAnim, dotScaleAnim]);

  return (
    <View style={styles.tabIconWrap}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <IconComponent size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
      </Animated.View>
      <Animated.View
        style={[
          styles.tabActiveDot,
          {
            backgroundColor: palette.primary,
            transform: [{ scale: dotScaleAnim }],
            opacity: dotScaleAnim,
          },
        ]}
      />
    </View>
  );
}

function CurvedTabBarBackground({ tabHeight }: { tabHeight?: number }) {
  const { width } = useWindowDimensions();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();

  const barHeight = tabHeight ?? (60 + insets.bottom);
  const notchHalfWidth = 62;
  const notchDepth = 40;
  const cx = width / 2;

  const leftX = cx - notchHalfWidth;
  const rightX = cx + notchHalfWidth;

  // Organic smooth Bezier cradle that elegantly cradles the elevated central FAB
  const fillPath = `
    M 0 0
    L ${leftX} 0
    C ${cx - 42} 0, ${cx - 36} ${notchDepth}, ${cx} ${notchDepth}
    C ${cx + 36} ${notchDepth}, ${cx + 42} 0, ${rightX} 0
    L ${width} 0
    L ${width} ${barHeight}
    L 0 ${barHeight}
    Z
  `;

  // Continuous 1px subtle border accentuating the curved notch
  const strokePath = `
    M 0 0.5
    L ${leftX} 0.5
    C ${cx - 42} 0.5, ${cx - 36} ${notchDepth + 0.5}, ${cx} ${notchDepth + 0.5}
    C ${cx + 36} ${notchDepth + 0.5}, ${cx + 42} 0.5, ${rightX} 0.5
    L ${width} 0.5
  `;

  return (
    <View style={[StyleSheet.absoluteFill, { height: barHeight }]} pointerEvents="none">
      <Svg width={width} height={barHeight} style={StyleSheet.absoluteFill}>
        <Path d={fillPath} fill={palette.surface} />
        <Path
          d={strokePath}
          fill="none"
          stroke={palette.border}
          strokeWidth={1}
        />
      </Svg>
    </View>
  );
}

/**
 * Center Add Button
 * Floating central hub with:
 * 1. Ambient breathing pulse halo
 * 2. Physical spring compression on touch
 * 3. 45° rotation micro-animation
 */
function CenterAddButton({ onPress }: { onPress: () => void }) {
  const { palette } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const { overallProgress, overallPercentage } = useCategoryProgress();

  const isComplete = overallProgress >= 1;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.90,
        friction: 6,
        tension: 200,
        useNativeDriver: true,
      }),
      Animated.spring(rotateAnim, {
        toValue: 1,
        friction: 6,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 110,
        useNativeDriver: true,
      }),
      Animated.spring(rotateAnim, {
        toValue: 0,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const ringSize = 64;
  const center = ringSize / 2; // 32
  const strokeWidth = 3.2;
  const radius = 28.5; // Inner stroke edge is 26.9, button outer edge is 25 -> clean 1.9px floating gap
  const circumference = 2 * Math.PI * radius; // ~179.07
  const strokeDashoffset = circumference * (1 - Math.min(1, overallProgress));

  return (
    <View style={styles.centerButtonContainer} pointerEvents="box-none">
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <View style={styles.centerButtonWrap}>
          {/* Dynamic Orbital Progress Ring */}
          <Svg width={ringSize} height={ringSize} style={styles.progressRingSvg} pointerEvents="none">
            <Defs>
              <SvgLinearGradient id="centerProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FFA07A" />
                <Stop offset="100%" stopColor="#FF4500" />
              </SvgLinearGradient>
              <SvgLinearGradient id="completeProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#34D399" />
                <Stop offset="100%" stopColor="#059669" />
              </SvgLinearGradient>
            </Defs>

            {/* Background Track */}
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={palette.primary + '18'}
              strokeWidth={2.5}
              fill="transparent"
            />

            {/* Active Progress Fill */}
            {overallProgress > 0 && (
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke={isComplete ? 'url(#completeProgressGrad)' : 'url(#centerProgressGrad)'}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                transform={`rotate(-90 ${center} ${center})`}
              />
            )}
          </Svg>

          {/* Elevated Central Action Button with Jewel Gradient & Specular Rim */}
          <Pressable
            style={[
              styles.centerButton,
              {
                shadowColor: isComplete ? '#10B981' : '#FF5722',
              },
            ]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Log a new metric. Daily progress: ${overallPercentage}%`}
          >
            <LinearGradient
              colors={isComplete ? ['#34D399', '#059669'] : ['#FF7A45', '#F04E23']}
              start={{ x: 0.1, y: 0.1 }}
              end={{ x: 0.9, y: 0.9 }}
              style={styles.gradientSurface}
            >
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Plus size={25} color="#FFFFFF" strokeWidth={2.8} />
              </Animated.View>
            </LinearGradient>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
  },
  tabActiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  centerButtonContainer: {
    position: 'absolute',
    top: -24,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  centerButtonWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  centerButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 8,
  },
  gradientSurface: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.32)',
  },
});
