import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  X,
  Check,
  Dices,
  Sparkles,
  Flame,
  Shirt,
  Smile,
  Palette,
  Coffee,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import {
  useAvatarStore,
  IModularAvatarConfig,
  AVATAR_ARCHETYPES,
  AVATAR_SKIN_PALETTE,
  AVATAR_HAIR_PALETTE,
  AVATAR_OUTFIT_PALETTE,
} from '../../store/avatarStore';
import { ModularAvatar } from './ModularAvatar';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type TabType = 'archetypes' | 'aura' | 'eyes' | 'hair' | 'outfit' | 'accessory' | 'skin';

export const AvatarStudioModal: React.FC<Props> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { config, updateConfig, applyArchetype, randomize } = useAvatarStore();

  const [activeTab, setActiveTab] = useState<TabType>('archetypes');

  const handleSelectAura = (aura: IModularAvatarConfig['aura']) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateConfig({ aura });
  };

  const handleSelectEyes = (eyes: IModularAvatarConfig['eyes']) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateConfig({ eyes });
  };

  const handleSelectHair = (hair: IModularAvatarConfig['hair']) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateConfig({ hair });
  };

  const handleSelectOutfit = (outfit: IModularAvatarConfig['outfit']) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateConfig({ outfit });
  };

  const handleSelectAccessory = (accessory: IModularAvatarConfig['accessory']) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateConfig({ accessory });
  };

  const handleSelectSkinTone = (skinTone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateConfig({ skinTone });
  };

  const handleSelectHairColor = (hairColor: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateConfig({ hairColor });
  };

  const handleSelectOutfitColor = (outfitColor: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateConfig({ outfitColor });
  };

  const handleRandomize = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    randomize();
  };

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'archetypes', label: 'Presets', icon: Sparkles },
    { key: 'aura', label: 'Aura', icon: Flame },
    { key: 'eyes', label: 'Expression', icon: Smile },
    { key: 'hair', label: 'Hair & Ears', icon: Sparkles },
    { key: 'outfit', label: 'Outfit', icon: Shirt },
    { key: 'accessory', label: 'Props', icon: Coffee },
    { key: 'skin', label: 'Skin Tone', icon: Palette },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            { backgroundColor: palette.surface, paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            <View style={styles.headerTitleRow}>
              <Sparkles size={20} color={palette.primaryText} style={{ marginRight: 8 }} />
              <Text style={[styles.headerTitle, { color: palette.text }]}>Avatar Studio</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={handleRandomize}
                style={[styles.diceBtn, { backgroundColor: 'rgba(128, 128, 128, 0.12)' }]}
                accessibilityLabel="Randomize avatar"
              >
                <Dices size={18} color={palette.primaryText} />
                <Text style={[styles.diceBtnText, { color: palette.primaryText }]}>Roll</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
                <Check size={20} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Interactive Showcase Preview */}
          <View style={[styles.previewCard, { backgroundColor: 'rgba(128, 128, 128, 0.12)', borderColor: palette.border }]}>
            <ModularAvatar
              config={config}
              size={135}
              animated={true}
              interactive={true}
              showAura={true}
            />
            <Text style={[styles.previewHint, { color: palette.textSecondary }]}>
              Tap avatar to interact • Animated in Profile & Headers
            </Text>
          </View>

          {/* Navigation Category Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsContent}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const TabIcon = tab.icon;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.tabChip,
                    isActive && {
                      backgroundColor: `${palette.primary}25`,
                      borderColor: palette.primary,
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setActiveTab(tab.key);
                  }}
                >
                  <TabIcon
                    size={14}
                    color={isActive ? palette.primary : palette.textSecondary}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      { color: isActive ? palette.primary : palette.textSecondary },
                      isActive && { fontWeight: '700' },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Tab Options Content */}
          <ScrollView style={styles.optionsArea} showsVerticalScrollIndicator={false}>
            {/* 1. Presets / Archetypes Tab */}
            {activeTab === 'archetypes' && (
              <View style={styles.archetypesGrid}>
                {AVATAR_ARCHETYPES.map((archetype) => (
                  <TouchableOpacity
                    key={archetype.id}
                    style={[
                      styles.archetypeCard,
                      { backgroundColor: 'rgba(128, 128, 128, 0.12)', borderColor: palette.border },
                    ]}
                    onPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      applyArchetype(archetype.id);
                    }}
                  >
                    <Text style={{ fontSize: 26, marginBottom: 4 }}>{archetype.icon}</Text>
                    <Text style={[styles.archetypeTitle, { color: palette.text }]}>{archetype.name}</Text>
                    <Text style={[styles.archetypeSub, { color: palette.textSecondary }]} numberOfLines={2}>
                      {archetype.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* 2. Aura Tab */}
            {activeTab === 'aura' && (
              <View style={styles.itemsGrid}>
                {[
                  { id: 'golden_spoons', label: 'Golden Spoons 🥄', sub: 'Pacing & Energy Halo' },
                  { id: 'healing_leaves', label: 'Healing Leaves 🌿', sub: 'Orbiting Nature Flora' },
                  { id: 'cosmic_pulse', label: 'Cosmic Pulse ✨', sub: 'Violet & Cyan Nebula' },
                  { id: 'ember_glow', label: 'Ember Glow 🔥', sub: 'Warm Cozy Hearth' },
                  { id: 'stardust_twinkle', label: 'Stardust Twinkle 🌌', sub: 'Celestial Glow' },
                  { id: 'none', label: 'Clean / None ⚪', sub: 'Minimalist Silhouette' },
                ].map((item) => {
                  const isSelected = config.aura === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.optionCard,
                        isSelected && {
                          borderColor: palette.primary,
                          backgroundColor: `${palette.primary}18`,
                        },
                      ]}
                      onPress={() => handleSelectAura(item.id as any)}
                    >
                      <Text style={[styles.optionLabel, { color: palette.text }, isSelected && { color: palette.primaryText, fontWeight: '700' }]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.optionSub, { color: palette.textSecondary }]}>{item.sub}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 3. Eyes / Expression Tab */}
            {activeTab === 'eyes' && (
              <View style={styles.itemsGrid}>
                {[
                  { id: 'calm', label: 'Calm & Friendly 😊' },
                  { id: 'sleepy', label: 'Sleepy / Low Spoons 😴' },
                  { id: 'sparkle', label: 'Sparkle Twinkle 🤩' },
                  { id: 'winking', label: 'Playful Wink 😉' },
                  { id: 'cool_glasses', label: 'Cool Shades 😎' },
                  { id: 'zen', label: 'Deep Zen Peace 🧘' },
                ].map((item) => {
                  const isSelected = config.eyes === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.optionCard,
                        isSelected && {
                          borderColor: palette.primary,
                          backgroundColor: `${palette.primary}18`,
                        },
                      ]}
                      onPress={() => handleSelectEyes(item.id as any)}
                    >
                      <Text style={[styles.optionLabel, { color: palette.text }, isSelected && { color: palette.primaryText, fontWeight: '700' }]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 4. Hair & Ears Tab */}
            {activeTab === 'hair' && (
              <View>
                <Text style={[styles.subSectionTitle, { color: palette.textSecondary }]}>STYLE</Text>
                <View style={styles.itemsGrid}>
                  {[
                    { id: 'sprout', label: 'Little Sprout 🌱' },
                    { id: 'cat_ears', label: 'Cat Ears 🐱' },
                    { id: 'beanie', label: 'Knit Beanie 🧢' },
                    { id: 'cozy_bun', label: 'Messy Top Bun 👱' },
                    { id: 'soft_waves', label: 'Soft Waves 🌊' },
                    { id: 'short_curl', label: 'Short Curls 🌀' },
                    { id: 'none', label: 'Clean / None 🦲' },
                  ].map((item) => {
                    const isSelected = config.hair === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.optionCard,
                          isSelected && {
                            borderColor: palette.primary,
                            backgroundColor: `${palette.primary}18`,
                          },
                        ]}
                        onPress={() => handleSelectHair(item.id as any)}
                      >
                        <Text style={[styles.optionLabel, { color: palette.text }, isSelected && { color: palette.primaryText, fontWeight: '700' }]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {config.hair !== 'none' && config.hair !== 'sprout' && (
                  <>
                    <Text style={[styles.subSectionTitle, { color: palette.textSecondary, marginTop: 14 }]}>
                      HAIR COLOR
                    </Text>
                    <View style={styles.colorSwatchesRow}>
                      {AVATAR_HAIR_PALETTE.map((color) => {
                        const isSelected = config.hairColor === color;
                        return (
                          <TouchableOpacity
                            key={color}
                            style={[
                              styles.colorCircle,
                              { backgroundColor: color },
                              isSelected && styles.colorCircleSelected,
                            ]}
                            onPress={() => handleSelectHairColor(color)}
                          >
                            {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}
              </View>
            )}

            {/* 5. Outfit Tab */}
            {activeTab === 'outfit' && (
              <View>
                <Text style={[styles.subSectionTitle, { color: palette.textSecondary }]}>OUTFIT STYLE</Text>
                <View style={styles.itemsGrid}>
                  {[
                    { id: 'oversized_hoodie', label: 'Oversized Hoodie 🧥' },
                    { id: 'spoonie_cape', label: 'Heroic Spoon Cape 🦸' },
                    { id: 'flare_pajamas', label: 'Restful Pajamas 🌌' },
                    { id: 'knit_sweater', label: 'Ribbed Knit Sweater 🧶' },
                    { id: 'herbal_robe', label: 'Herbalist Kimono 👘' },
                    { id: 'none', label: 'Minimalist 👕' },
                  ].map((item) => {
                    const isSelected = config.outfit === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.optionCard,
                          isSelected && {
                            borderColor: palette.primary,
                            backgroundColor: `${palette.primary}18`,
                          },
                        ]}
                        onPress={() => handleSelectOutfit(item.id as any)}
                      >
                        <Text style={[styles.optionLabel, { color: palette.text }, isSelected && { color: palette.primaryText, fontWeight: '700' }]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {config.outfit !== 'none' && (
                  <>
                    <Text style={[styles.subSectionTitle, { color: palette.textSecondary, marginTop: 14 }]}>
                      OUTFIT COLOR
                    </Text>
                    <View style={styles.colorSwatchesRow}>
                      {AVATAR_OUTFIT_PALETTE.map((color) => {
                        const isSelected = config.outfitColor === color;
                        return (
                          <TouchableOpacity
                            key={color}
                            style={[
                              styles.colorCircle,
                              { backgroundColor: color },
                              isSelected && styles.colorCircleSelected,
                            ]}
                            onPress={() => handleSelectOutfitColor(color)}
                          >
                            {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}
              </View>
            )}

            {/* 6. Props & Accessories Tab */}
            {activeTab === 'accessory' && (
              <View style={styles.itemsGrid}>
                {[
                  { id: 'chamomile_tea', label: 'Chamomile Tea ☕', sub: 'Steaming ceramic mug' },
                  { id: 'golden_spoon', label: 'Golden Spoon 🥄', sub: 'Pacing superpower symbol' },
                  { id: 'glowing_sprite', label: 'Companion Sprite ✨', sub: 'Friendly fluttering orb' },
                  { id: 'hot_water_bottle', label: 'Heat Pack 🧸', sub: 'Comfort for flare pain' },
                  { id: 'sprout_branch', label: 'Lavender Sprig 🌿', sub: 'Fresh soothing aroma' },
                  { id: 'none', label: 'No Prop 🚫', sub: 'Bare hands' },
                ].map((item) => {
                  const isSelected = config.accessory === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.optionCard,
                        isSelected && {
                          borderColor: palette.primary,
                          backgroundColor: `${palette.primary}18`,
                        },
                      ]}
                      onPress={() => handleSelectAccessory(item.id as any)}
                    >
                      <Text style={[styles.optionLabel, { color: palette.text }, isSelected && { color: palette.primaryText, fontWeight: '700' }]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.optionSub, { color: palette.textSecondary }]}>{item.sub}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 7. Skin Tone Tab */}
            {activeTab === 'skin' && (
              <View>
                <Text style={[styles.subSectionTitle, { color: palette.textSecondary }]}>COMPLEXION</Text>
                <View style={styles.colorSwatchesRow}>
                  {AVATAR_SKIN_PALETTE.map((tone) => {
                    const isSelected = config.skinTone === tone;
                    return (
                      <TouchableOpacity
                        key={tone}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: tone },
                          isSelected && styles.colorCircleSelected,
                        ]}
                        onPress={() => handleSelectSkinTone(tone)}
                      >
                        {isSelected && <Check size={14} color="#000000" strokeWidth={3} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    minHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  diceBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  doneBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  previewHint: {
    fontSize: 11,
    marginTop: 8,
    fontWeight: '500',
  },
  tabsScroll: {
    maxHeight: 46,
    marginVertical: 10,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
  },
  optionsArea: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  archetypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 16,
  },
  archetypeCard: {
    width: '48%',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
  },
  archetypeTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  archetypeSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 16,
  },
  optionCard: {
    width: '48.5%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(128, 128, 128, 0.12)',
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  colorSwatchesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 6,
    paddingBottom: 16,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(128, 128, 128, 0.3)',
  },
  colorCircleSelected: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
});
