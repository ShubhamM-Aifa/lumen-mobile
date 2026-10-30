import React from 'react';
import { FlexWidget, TextWidget, SvgWidget } from 'react-native-android-widget';
import type { LumenWidgetData } from './widgetSync';

interface Props {
  data: LumenWidgetData;
}

export function QuickTapWidget({ data }: Props) {
  const waterCount = data.waterCount ?? 0;
  const waterGoal = data.waterGoal ?? 8;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#2C2C2E',
        borderRadius: 26,
        padding: 16,
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}
      clickAction="OPEN_APP"
      accessibilityLabel="Lumen Quick Log Widget"
    >
      {/* Top Header Row */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <FlexWidget
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: '#0A84FF',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <SvgWidget
              style={{ width: 20, height: 20 }}
              svg={`
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/>
                </svg>
              `}
            />
          </FlexWidget>

          <FlexWidget
            style={{
              flexDirection: 'column',
            }}
          >
            <TextWidget
              text="QUICK LOG"
              style={{
                fontSize: 11,
                fontWeight: 'bold',
                color: '#8E8E93',
                letterSpacing: 0.8,
              }}
            />
            <TextWidget
              text="One-tap log"
              style={{
                fontSize: 14,
                fontWeight: 'bold',
                color: '#FFFFFF',
              }}
            />
          </FlexWidget>
        </FlexWidget>

        <TextWidget
          text={`${waterCount}/${waterGoal} 💧`}
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: '#0A84FF',
          }}
        />
      </FlexWidget>

      {/* Action Buttons Column */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* +1 Glass of Water Button */}
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: '#0A84FF',
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}
          clickAction="LOG_WATER"
          accessibilityLabel="Log 1 glass of water"
        >
          <TextWidget
            text="💧 +1 Glass of Water"
            style={{
              fontSize: 13,
              fontWeight: 'bold',
              color: '#FFFFFF',
            }}
          />
        </FlexWidget>

        {/* Open Quick Log In App */}
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: '#3A3A3C',
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="OPEN_APP"
          accessibilityLabel="Open Quick Log"
        >
          <TextWidget
            text="✨ Open Quick Log"
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: '#FFFFFF',
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
