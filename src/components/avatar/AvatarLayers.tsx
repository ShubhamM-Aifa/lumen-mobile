import React from 'react';
import Svg, {
  G,
  Path,
  Circle,
  Ellipse,
  Rect,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { IModularAvatarConfig } from '../../store/avatarStore';

interface LayerProps {
  config: IModularAvatarConfig;
}

// ────────── AURA LAYERS (Behind Avatar) ──────────
export const AuraLayer: React.FC<LayerProps> = ({ config }) => {
  const { aura } = config;
  if (aura === 'none') return null;

  if (aura === 'golden_spoons') {
    return (
      <G>
        <Defs>
          <RadialGradient id="goldGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="55%" stopColor="#F59E0B" stopOpacity="0.35" />
            <Stop offset="85%" stopColor="#FBBF24" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="100" cy="100" r="92" fill="url(#goldGlow)" />
        <Circle cx="100" cy="100" r="88" stroke="#F59E0B" strokeWidth="2" strokeDasharray="6 4" opacity={0.6} />

        {/* Floating Mini Spoons */}
        <G transform="translate(24, 40) rotate(-25)">
          <Ellipse cx="0" cy="0" rx="5" ry="8" fill="#FBBF24" />
          <Rect x="-1.5" y="6" width="3" height="12" rx="1.5" fill="#F59E0B" />
        </G>
        <G transform="translate(176, 42) rotate(25)">
          <Ellipse cx="0" cy="0" rx="5" ry="8" fill="#FBBF24" />
          <Rect x="-1.5" y="6" width="3" height="12" rx="1.5" fill="#F59E0B" />
        </G>
        <G transform="translate(180, 140) rotate(50)">
          <Ellipse cx="0" cy="0" rx="4" ry="7" fill="#FBBF24" />
          <Rect x="-1" y="5" width="2.5" height="10" rx="1" fill="#F59E0B" />
        </G>
        <G transform="translate(20, 138) rotate(-50)">
          <Ellipse cx="0" cy="0" rx="4" ry="7" fill="#FBBF24" />
          <Rect x="-1" y="5" width="2.5" height="10" rx="1" fill="#F59E0B" />
        </G>
      </G>
    );
  }

  if (aura === 'healing_leaves') {
    return (
      <G>
        <Defs>
          <RadialGradient id="healingGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="60%" stopColor="#10B981" stopOpacity="0.32" />
            <Stop offset="90%" stopColor="#34D399" stopOpacity="0.1" />
            <Stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="100" cy="100" r="92" fill="url(#healingGlow)" />
        <Circle cx="100" cy="100" r="86" stroke="#10B981" strokeWidth="1.5" strokeDasharray="8 6" opacity={0.5} />

        {/* Orbiting Leaves */}
        <Path d="M 28 48 C 22 40, 24 30, 34 32 C 38 40, 36 50, 28 48 Z" fill="#34D399" opacity={0.85} />
        <Path d="M 172 48 C 178 40, 176 30, 166 32 C 162 40, 164 50, 172 48 Z" fill="#34D399" opacity={0.85} />
        <Path d="M 182 130 C 188 124, 186 114, 176 116 C 172 124, 174 132, 182 130 Z" fill="#10B981" opacity={0.8} />
        <Path d="M 18 128 C 12 122, 14 112, 24 114 C 28 122, 26 130, 18 128 Z" fill="#10B981" opacity={0.8} />
      </G>
    );
  }

  if (aura === 'cosmic_pulse') {
    return (
      <G>
        <Defs>
          <RadialGradient id="cosmicGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.4" />
            <Stop offset="80%" stopColor="#38BDF8" stopOpacity="0.2" />
            <Stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="100" cy="100" r="94" fill="url(#cosmicGlow)" />
        <Circle cx="100" cy="100" r="88" stroke="#A855F7" strokeWidth="2" opacity={0.6} />

        {/* Twinkling Cosmic Stars */}
        <Path d="M 30 40 L 32 32 L 40 30 L 32 28 L 30 20 L 28 28 L 20 30 L 28 32 Z" fill="#E0E7FF" opacity={0.9} />
        <Path d="M 170 42 L 172 35 L 179 33 L 172 31 L 170 24 L 168 31 L 161 33 L 168 35 Z" fill="#38BDF8" opacity={0.9} />
        <Path d="M 180 140 L 181 136 L 185 135 L 181 134 L 180 130 L 179 134 L 175 135 L 179 136 Z" fill="#F472B6" opacity={0.8} />
        <Path d="M 22 140 L 23 136 L 27 135 L 23 134 L 22 130 L 21 134 L 17 135 L 21 136 Z" fill="#C084FC" opacity={0.8} />
      </G>
    );
  }

  if (aura === 'ember_glow') {
    return (
      <G>
        <Defs>
          <RadialGradient id="emberGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="50%" stopColor="#F97316" stopOpacity="0.38" />
            <Stop offset="85%" stopColor="#EF4444" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#F97316" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="100" cy="100" r="92" fill="url(#emberGlow)" />
        <Circle cx="100" cy="100" r="87" stroke="#F97316" strokeWidth="2" opacity={0.5} />
        <Circle cx="35" cy="40" r="3" fill="#FDE047" opacity={0.8} />
        <Circle cx="165" cy="44" r="2.5" fill="#FDE047" opacity={0.85} />
        <Circle cx="178" cy="120" r="3.5" fill="#FB923C" opacity={0.7} />
        <Circle cx="25" cy="122" r="2" fill="#F97316" opacity={0.7} />
      </G>
    );
  }

  // stardust_twinkle
  return (
    <G>
      <Defs>
        <RadialGradient id="starGlow" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="55%" stopColor="#38BDF8" stopOpacity="0.3" />
          <Stop offset="90%" stopColor="#818CF8" stopOpacity="0.1" />
          <Stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="100" cy="100" r="92" fill="url(#starGlow)" />
      <Circle cx="32" cy="38" r="2" fill="#FFFFFF" />
      <Circle cx="168" cy="36" r="2" fill="#FFFFFF" />
      <Circle cx="182" cy="115" r="2.5" fill="#38BDF8" />
      <Circle cx="20" cy="115" r="2.5" fill="#38BDF8" />
    </G>
  );
};

// ────────── BASE & BODY LAYERS ──────────
export const BaseLayer: React.FC<LayerProps> = ({ config }) => {
  const { skinTone, base } = config;

  return (
    <G>
      {/* Neck & Shoulders Base */}
      <Path
        d="M 64 160 C 64 140, 80 135, 100 135 C 120 135, 136 140, 136 160 L 148 185 C 148 190, 52 190, 52 185 Z"
        fill={skinTone}
      />
      {/* Neck shadow under chin */}
      <Ellipse cx="100" cy="138" rx="20" ry="7" fill="rgba(0, 0, 0, 0.08)" />

      {/* Head Mascot Shape */}
      {base === 'celestial_feline' ? (
        <G>
          {/* Kitty ears base */}
          <Path d="M 60 70 L 48 38 L 76 52 Z" fill={skinTone} />
          <Path d="M 58 66 L 52 44 L 72 54 Z" fill="rgba(244, 114, 182, 0.35)" />
          <Path d="M 140 70 L 152 38 L 124 52 Z" fill={skinTone} />
          <Path d="M 142 66 L 148 44 L 128 54 Z" fill="rgba(244, 114, 182, 0.35)" />
          {/* Head */}
          <Ellipse cx="100" cy="95" rx="48" ry="44" fill={skinTone} />
          {/* Whisker dots */}
          <Circle cx="76" cy="106" r="1.5" fill="rgba(0, 0, 0, 0.2)" />
          <Circle cx="73" cy="110" r="1.5" fill="rgba(0, 0, 0, 0.2)" />
          <Circle cx="124" cy="106" r="1.5" fill="rgba(0, 0, 0, 0.2)" />
          <Circle cx="127" cy="110" r="1.5" fill="rgba(0, 0, 0, 0.2)" />
        </G>
      ) : (
        <G>
          {/* Mascot Head */}
          <Ellipse cx="100" cy="94" rx="46" ry="43" fill={skinTone} />
          {/* Subtle ears */}
          <Ellipse cx="54" cy="95" rx="6" ry="9" fill={skinTone} />
          <Ellipse cx="146" cy="95" rx="6" ry="9" fill={skinTone} />
        </G>
      )}

      {/* Soft Rosy Cheeks (Universal cute Spoonie aesthetic) */}
      <Ellipse cx="74" cy="104" rx="8" ry="4.5" fill="#FB7185" opacity={0.35} />
      <Ellipse cx="126" cy="104" rx="8" ry="4.5" fill="#FB7185" opacity={0.35} />
    </G>
  );
};

// ────────── EYES & EXPRESSION LAYERS ──────────
export const EyesLayer: React.FC<LayerProps> = ({ config }) => {
  const { eyes } = config;

  if (eyes === 'sleepy') {
    return (
      <G>
        {/* Soft closed/sleepy curved eyelids */}
        <Path d="M 72 94 Q 82 101 90 95" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" fill="none" />
        <Path d="M 110 95 Q 118 101 128 94" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* Tiny lower lashes */}
        <Path d="M 80 99 L 79 103" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />
        <Path d="M 120 99 L 121 103" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />
        {/* Peaceful mouth */}
        <Path d="M 96 111 Q 100 114 104 111" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </G>
    );
  }

  if (eyes === 'sparkle') {
    return (
      <G>
        {/* Big twinkling anime / Discord eyes */}
        <Ellipse cx="80" cy="92" rx="9" ry="11" fill="#1E293B" />
        <Ellipse cx="120" cy="92" rx="9" ry="11" fill="#1E293B" />
        {/* Star highlights */}
        <Circle cx="78" cy="88" r="4" fill="#FFFFFF" />
        <Circle cx="84" cy="96" r="2" fill="#FFFFFF" />
        <Circle cx="118" cy="88" r="4" fill="#FFFFFF" />
        <Circle cx="124" cy="96" r="2" fill="#FFFFFF" />
        {/* Cheerful open smile */}
        <Path d="M 94 109 Q 100 116 106 109" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" fill="#F43F5E" />
      </G>
    );
  }

  if (eyes === 'winking') {
    return (
      <G>
        {/* Left Eye Sparkle */}
        <Ellipse cx="80" cy="92" rx="9" ry="11" fill="#1E293B" />
        <Circle cx="78" cy="88" r="4" fill="#FFFFFF" />
        <Circle cx="84" cy="96" r="2" fill="#FFFFFF" />
        {/* Right Eye Wink */}
        <Path d="M 112 94 Q 120 86 128 94" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* Playful side grin */}
        <Path d="M 95 110 Q 102 115 107 108" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </G>
    );
  }

  if (eyes === 'cool_glasses') {
    return (
      <G>
        <Defs>
          <LinearGradient id="glassShine" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
            <Stop offset="50%" stopColor="#0F172A" stopOpacity="0.95" />
            <Stop offset="100%" stopColor="#1E293B" stopOpacity="0.95" />
          </LinearGradient>
        </Defs>
        {/* Bridge */}
        <Rect x="93" y="90" width="14" height="3" rx="1.5" fill="#334155" />
        {/* Lenses */}
        <Rect x="68" y="84" width="26" height="18" rx="6" fill="url(#glassShine)" stroke="#0F172A" strokeWidth="2" />
        <Rect x="106" y="84" width="26" height="18" rx="6" fill="url(#glassShine)" stroke="#0F172A" strokeWidth="2" />
        {/* Diagonal shine line */}
        <Path d="M 72 87 L 88 99" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="2" strokeLinecap="round" />
        <Path d="M 110 87 L 126 99" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="2" strokeLinecap="round" />
        {/* Smug confident smile */}
        <Path d="M 94 112 Q 100 115 106 110" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </G>
    );
  }

  if (eyes === 'zen') {
    return (
      <G>
        {/* Deep peace arcs */}
        <Path d="M 72 93 Q 80 87 88 93" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" fill="none" />
        <Path d="M 112 93 Q 120 87 128 93" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* Zen smile */}
        <Path d="M 95 110 Q 100 114 105 110" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </G>
    );
  }

  // calm (default)
  return (
    <G>
      <Ellipse cx="80" cy="93" rx="7.5" ry="9" fill="#1E293B" />
      <Ellipse cx="120" cy="93" rx="7.5" ry="9" fill="#1E293B" />
      <Circle cx="78" cy="90" r="3" fill="#FFFFFF" />
      <Circle cx="118" cy="90" r="3" fill="#FFFFFF" />
      {/* Gentle smile */}
      <Path d="M 96 111 Q 100 115 104 111" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </G>
  );
};

// ────────── HAIR & HEADWEAR LAYERS ──────────
export const HairLayer: React.FC<LayerProps> = ({ config }) => {
  const { hair, hairColor } = config;
  if (hair === 'none') return null;

  if (hair === 'sprout') {
    return (
      <G>
        {/* Plant stem */}
        <Path d="M 100 56 Q 98 42 100 36" stroke="#22C55E" strokeWidth="4" strokeLinecap="round" fill="none" />
        {/* Left leaf */}
        <Path d="M 100 36 C 90 32, 86 20, 96 22 C 102 24, 102 32, 100 36 Z" fill="#4ADE80" stroke="#16A34A" strokeWidth="1" />
        {/* Right leaf */}
        <Path d="M 100 36 C 110 32, 114 20, 104 22 C 98 24, 98 32, 100 36 Z" fill="#22C55E" stroke="#15803D" strokeWidth="1" />
      </G>
    );
  }

  if (hair === 'cat_ears') {
    return (
      <G>
        <Path d="M 64 64 L 50 30 L 80 48 Z" fill={hairColor} stroke="rgba(0, 0, 0, 0.1)" strokeWidth="1.5" />
        <Path d="M 63 60 L 55 38 L 76 50 Z" fill="#F472B6" opacity={0.6} />
        <Path d="M 136 64 L 150 30 L 120 48 Z" fill={hairColor} stroke="rgba(0, 0, 0, 0.1)" strokeWidth="1.5" />
        <Path d="M 137 60 L 145 38 L 124 50 Z" fill="#F472B6" opacity={0.6} />
        {/* Center bangs tuft */}
        <Path d="M 88 56 Q 100 68 112 56 Q 100 60 88 56 Z" fill={hairColor} />
      </G>
    );
  }

  if (hair === 'beanie') {
    return (
      <G>
        {/* Slouchy knit beanie */}
        <Path
          d="M 52 74 C 50 40, 75 30, 100 30 C 125 30, 150 40, 148 74 C 148 78, 52 78, 52 74 Z"
          fill={hairColor}
        />
        {/* Beanie fold rim */}
        <Rect x="48" y="70" width="104" height="14" rx="7" fill={hairColor} stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
        {/* Beanie pom-pom */}
        <Circle cx="100" cy="26" r="9" fill={hairColor} opacity={0.9} />
      </G>
    );
  }

  if (hair === 'cozy_bun') {
    return (
      <G>
        {/* Messy top bun */}
        <Circle cx="100" cy="38" r="18" fill={hairColor} />
        {/* Cute hair scrunchie */}
        <Ellipse cx="100" cy="50" rx="16" ry="6" fill="#F472B6" />
        {/* Front bangs and wisps */}
        <Path
          d="M 54 84 C 54 58, 75 52, 100 52 C 125 52, 146 58, 146 84 C 140 70, 126 62, 100 62 C 74 62, 60 70, 54 84 Z"
          fill={hairColor}
        />
      </G>
    );
  }

  if (hair === 'soft_waves') {
    return (
      <G>
        {/* Top hair curve */}
        <Path
          d="M 50 90 C 48 55, 70 48, 100 48 C 130 48, 152 55, 150 90 C 142 66, 128 58, 100 58 C 72 58, 58 66, 50 90 Z"
          fill={hairColor}
        />
        {/* Left shoulder wave */}
        <Path
          d="M 52 86 C 44 110, 42 140, 56 160 C 50 142, 54 115, 58 96 Z"
          fill={hairColor}
        />
        {/* Right shoulder wave */}
        <Path
          d="M 148 86 C 156 110, 158 140, 144 160 C 150 142, 146 115, 142 96 Z"
          fill={hairColor}
        />
      </G>
    );
  }

  // short_curl
  return (
    <G>
      <Path
        d="M 50 78 C 48 52, 70 45, 100 45 C 130 45, 152 52, 150 78 C 144 64, 125 58, 100 58 C 75 58, 56 64, 50 78 Z"
        fill={hairColor}
      />
      {/* Texture curls */}
      <Circle cx="64" cy="54" r="8" fill={hairColor} />
      <Circle cx="82" cy="46" r="9" fill={hairColor} />
      <Circle cx="100" cy="44" r="9" fill={hairColor} />
      <Circle cx="118" cy="46" r="9" fill={hairColor} />
      <Circle cx="136" cy="54" r="8" fill={hairColor} />
    </G>
  );
};

// ────────── OUTFIT / CLOTHING LAYERS ──────────
export const OutfitLayer: React.FC<LayerProps> = ({ config }) => {
  const { outfit, outfitColor } = config;
  if (outfit === 'none') return null;

  if (outfit === 'oversized_hoodie') {
    return (
      <G>
        {/* Hoodie Body */}
        <Path
          d="M 50 152 C 50 140, 72 135, 100 135 C 128 135, 150 140, 150 152 L 158 190 L 42 190 Z"
          fill={outfitColor}
        />
        {/* Hoodie Collar / Neck line */}
        <Path
          d="M 78 138 C 88 152, 112 152, 122 138 C 114 148, 86 148, 78 138 Z"
          fill="rgba(0, 0, 0, 0.15)"
        />
        {/* Hanging drawstrings */}
        <Path d="M 88 145 L 87 166" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        <Path d="M 112 145 L 113 166" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      </G>
    );
  }

  if (outfit === 'spoonie_cape') {
    return (
      <G>
        {/* Flowing hero cape */}
        <Path
          d="M 46 150 C 44 138, 70 135, 100 135 C 130 135, 156 138, 154 150 L 166 190 L 34 190 Z"
          fill={outfitColor}
        />
        {/* Gold Brooch / Spoon Crest */}
        <Circle cx="100" cy="148" r="8" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5" />
        <Ellipse cx="100" cy="147" rx="3" ry="4" fill="#D97706" />
      </G>
    );
  }

  if (outfit === 'flare_pajamas') {
    return (
      <G>
        {/* Soft Pajama Shirt */}
        <Path
          d="M 52 152 C 52 140, 75 136, 100 136 C 125 136, 148 140, 148 152 L 156 190 L 44 190 Z"
          fill={outfitColor}
        />
        {/* Pajama Collar fold */}
        <Path d="M 84 136 L 100 155 L 116 136" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Tiny Star Prints */}
        <Circle cx="72" cy="165" r="2" fill="rgba(255, 255, 255, 0.7)" />
        <Circle cx="128" cy="168" r="2" fill="rgba(255, 255, 255, 0.7)" />
        <Circle cx="98" cy="178" r="2.5" fill="rgba(255, 255, 255, 0.7)" />
      </G>
    );
  }

  if (outfit === 'knit_sweater') {
    return (
      <G>
        {/* Chunky Turtleneck / Sweater */}
        <Path
          d="M 50 154 C 50 142, 72 138, 100 138 C 128 138, 150 142, 150 154 L 158 190 L 42 190 Z"
          fill={outfitColor}
        />
        {/* Roll-neck collar */}
        <Rect x="74" y="132" width="52" height="15" rx="7.5" fill={outfitColor} stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
        {/* Knit rib lines */}
        <Path d="M 86 134 L 86 145 M 95 134 L 95 145 M 105 134 L 105 145 M 114 134 L 114 145" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      </G>
    );
  }

  // herbal_robe
  return (
    <G>
      <Path
        d="M 50 152 C 50 140, 72 136, 100 136 C 128 136, 150 140, 150 152 L 158 190 L 42 190 Z"
        fill={outfitColor}
      />
      {/* Kimono wrap lapels */}
      <Path d="M 80 136 L 110 175" stroke="#FFFFFF" strokeWidth="2.5" />
      <Path d="M 120 136 L 90 175" stroke="#FFFFFF" strokeWidth="2.5" />
    </G>
  );
};

// ────────── ACCESSORY / HANDHELD LAYERS ──────────
export const AccessoryLayer: React.FC<LayerProps> = ({ config }) => {
  const { accessory } = config;
  if (accessory === 'none') return null;

  if (accessory === 'chamomile_tea') {
    return (
      <G transform="translate(112, 140)">
        {/* Ceramic Mug */}
        <Rect x="0" y="8" width="22" height="24" rx="5" fill="#FEF3C7" stroke="#D97706" strokeWidth="1.5" />
        {/* Handle */}
        <Path d="M 22 13 C 27 13, 27 25, 22 25" stroke="#D97706" strokeWidth="2" fill="none" />
        {/* Steam curls */}
        <Path d="M 6 4 Q 8 0 6 -4" stroke="#FDE68A" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.75} />
        <Path d="M 14 5 Q 16 1 14 -3" stroke="#FDE68A" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.75} />
        {/* Tea bag tag hanging */}
        <Path d="M 10 10 L 7 18" stroke="#D97706" strokeWidth="1" />
        <Rect x="4" y="18" width="6" height="5" rx="1" fill="#F59E0B" />
      </G>
    );
  }

  if (accessory === 'golden_spoon') {
    return (
      <G transform="translate(126, 126) rotate(-20)">
        <Ellipse cx="0" cy="0" rx="9" ry="14" fill="#FBBF24" stroke="#D97706" strokeWidth="2" />
        <Rect x="-2.5" y="12" width="5" height="34" rx="2.5" fill="#F59E0B" stroke="#D97706" strokeWidth="1.5" />
        {/* Spoon bowl shine reflection */}
        <Ellipse cx="-3" cy="-3" rx="3" ry="6" fill="#FEF3C7" opacity={0.7} />
      </G>
    );
  }

  if (accessory === 'glowing_sprite') {
    return (
      <G transform="translate(148, 92)">
        {/* Glowing Orb */}
        <Circle cx="0" cy="0" r="10" fill="#E0E7FF" opacity={0.9} />
        <Circle cx="0" cy="0" r="14" stroke="#818CF8" strokeWidth="2" opacity={0.6} />
        {/* Cute sprite eyes */}
        <Circle cx="-3" cy="-1" r="1.5" fill="#312E81" />
        <Circle cx="3" cy="-1" r="1.5" fill="#312E81" />
        <Circle cx="-3" cy="-2" r="0.6" fill="#FFFFFF" />
        <Circle cx="3" cy="-2" r="0.6" fill="#FFFFFF" />
        {/* Little flutter wings */}
        <Ellipse cx="-10" cy="-6" rx="6" ry="3" fill="#C7D2FE" opacity={0.7} />
        <Ellipse cx="10" cy="-6" rx="6" ry="3" fill="#C7D2FE" opacity={0.7} />
      </G>
    );
  }

  if (accessory === 'hot_water_bottle') {
    return (
      <G transform="translate(112, 144)">
        {/* Ribbed warm rubber bottle */}
        <Rect x="0" y="6" width="24" height="28" rx="6" fill="#F43F5E" stroke="#BE123C" strokeWidth="1.5" />
        {/* Stopper nozzle */}
        <Rect x="7" y="0" width="10" height="7" rx="2" fill="#BE123C" />
        {/* Embossed cozy heart */}
        <Path d="M 12 16 C 9 12, 5 15, 8 19 L 12 23 L 16 19 C 19 15, 15 12, 12 16 Z" fill="#FFE4E6" />
      </G>
    );
  }

  // sprout_branch
  return (
    <G transform="translate(122, 134) rotate(-15)">
      <Path d="M 0 35 Q 10 15 12 0" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <Path d="M 10 18 C 18 16, 20 8, 12 10 Z" fill="#4ADE80" stroke="#15803D" strokeWidth="1" />
      <Path d="M 6 26 C -2 24, -4 16, 4 18 Z" fill="#22C55E" stroke="#15803D" strokeWidth="1" />
      <Path d="M 12 0 C 18 -6, 12 -12, 8 -6 Z" fill="#86EFAC" stroke="#15803D" strokeWidth="1" />
    </G>
  );
};
