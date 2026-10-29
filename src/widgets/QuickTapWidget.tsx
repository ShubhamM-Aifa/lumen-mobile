import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
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
        backgroundColor: '#12141A',
        borderRadius: 22,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
      clickAction="OPEN_APP"
      accessibilityLabel="Lumen Quick Tap Widget"
    >
      {/* Header */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
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
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#0284C7',
              marginRight: 6,
            }}
          />
          <TextWidget
            text="LUMEN LOG"
            style={{
              fontSize: 11,
              fontWeight: 'bold',
              color: '#0284C7',
              letterSpacing: 1,
            }}
          />
        </FlexWidget>

        <TextWidget
          text={`${waterCount}/${waterGoal} 💧`}
          style={{
            fontSize: 11,
            fontWeight: '600',
            color: '#60A5FA',
          }}
        />
      </FlexWidget>

      {/* Action Buttons Column */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {/* Log Water Button */}
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: '#0284C7',
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
              fontSize: 12,
              fontWeight: 'bold',
              color: '#FFFFFF',
            }}
          />
        </FlexWidget>

        {/* Start Walk Button */}
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: '#1E293B',
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'lumen://walking' }}
          accessibilityLabel="Open walking tracker"
        >
          <TextWidget
            text="🚶 Start Walk"
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: '#34D399',
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

