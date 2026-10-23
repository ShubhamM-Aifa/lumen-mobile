import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import Svg from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAvatarStore, IModularAvatarConfig } from '../../store/avatarStore';
import {
  AuraLayer,
  BaseLayer,
  EyesLayer,
  HairLayer,
  OutfitLayer,
  AccessoryLayer,
} from './AvatarLayers';

interface ModularAvatarProps {
  config?: IModularAvatarConfig;
  size?: number;
  animated?: boolean;
  interactive?: boolean;
  showAura?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export const ModularAvatar: React.FC<ModularAvatarProps> = ({
  config: propConfig,
  size = 64,
  animated = false,
  interactive = false,
  showAura = true,
  style,
  onPress,
}) => {
  const storeConfig = useAvatarStore((s) => s.config);
  const activeConfig = propConfig || storeConfig;

  // Animation values
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const auraOpacity = useSharedValue(0.85);

  useEffect(() => {
    if (animated) {
      // Gentle breathing idle bob
      translateY.value = withRepeat(
        withSequence(
          withTiming(-2.5, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      );

      // Soft aura pulse
      auraOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.7, { duration: 1600, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      );
    } else {
      translateY.value = 0;
      scale.value = 1;
      auraOpacity.value = 1;
    }
  }, [animated, translateY, scale, auraOpacity]);

  const animatedAvatarStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const animatedAuraStyle = useAnimatedStyle(() => {
    return {
      opacity: auraOpacity.value,
    };
  });

  const handlePress = () => {
    if (interactive) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Playful bounce on tap
      scale.value = withSequence(
        withSpring(1.18, { damping: 5, stiffness: 220 }),
        withSpring(1, { damping: 9, stiffness: 180 })
      );
    }
    if (onPress) {
      onPress();
    }
  };

  const content = (
    <View style={[{ width: size, height: size }, styles.avatarContainer, style]}>
      {/* Background Aura (if enabled) */}
      {showAura && activeConfig.aura !== 'none' && (
        <Animated.View style={[StyleSheet.absoluteFill, animated ? animatedAuraStyle : undefined]}>
          <Svg viewBox="0 0 200 200" width={size} height={size}>
            <AuraLayer config={activeConfig} />
          </Svg>
        </Animated.View>
      )}

      {/* Main Avatar Body (Breathing Animated or Static) */}
      <Animated.View style={[{ width: size, height: size }, animated ? animatedAvatarStyle : undefined]}>
        <Svg viewBox="0 0 200 200" width={size} height={size}>
          <BaseLayer config={activeConfig} />
          <OutfitLayer config={activeConfig} />
          <EyesLayer config={activeConfig} />
          <HairLayer config={activeConfig} />
          <AccessoryLayer config={activeConfig} />
        </Svg>
      </Animated.View>
    </View>
  );

  if (interactive || onPress) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Interactive user avatar"
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
});
