import React from 'react';
import { FlexWidget, TextWidget, SvgWidget } from 'react-native-android-widget';
import type { LumenWidgetData } from './widgetSync';

interface Props {
  data: LumenWidgetData;
}

export function WaterGoalWidget({ data }: Props) {
  const count = data.waterCount ?? 1;
  const goal = Math.max(1, data.waterGoal ?? 8);

  const fillFlex = Math.max(1, count);
  const emptyFlex = Math.max(0, goal - count);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#FFFFFF',
        borderRadius: 26,
        padding: 16,
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}
      clickAction="OPEN_APP"
      accessibilityLabel="Lumen Water Widget"
    >
      {/* Top Left: Blue Water Drop Icon Tile */}
      <FlexWidget
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          backgroundColor: '#007AFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SvgWidget
          style={{ width: 20, height: 20 }}
          svg={`
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
            </svg>
          `}
        />
      </FlexWidget>

      {/* Bottom Area: Label, Goal Count, and Progress Bar */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <TextWidget
          text="WATER"
          style={{
            fontSize: 11,
            fontWeight: 'bold',
            color: '#8E8E93',
            letterSpacing: 0.8,
            marginBottom: 4,
          }}
        />

        <TextWidget
          text={`${count} of ${goal}`}
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: '#000000',
            marginBottom: 10,
          }}
        />

        {/* Progress Bar Track + Fill */}
        <FlexWidget
          style={{
            width: 'match_parent',
            height: 5,
            backgroundColor: '#E5E5EA',
            borderRadius: 3,
            flexDirection: 'row',
            overflow: 'hidden',
          }}
        >
          <FlexWidget
            style={{
              flex: fillFlex,
              height: 'match_parent',
              backgroundColor: '#007AFF',
              borderRadius: 3,
            }}
          />
          {emptyFlex > 0 && (
            <FlexWidget
              style={{
                flex: emptyFlex,
                height: 'match_parent',
              }}
            />
          )}
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

