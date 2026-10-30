import React from 'react';
import { FlexWidget, TextWidget, SvgWidget } from 'react-native-android-widget';
import type { LumenWidgetData } from './widgetSync';

interface Props {
  data: LumenWidgetData;
}

export function NextReminderWidget({ data }: Props) {
  const reminderTitle = data.nextReminderTitle || 'Drink water';
  const reminderTime = data.nextReminderTime || '2:00 PM';

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
      accessibilityLabel="Lumen Next Reminder Widget"
    >
      {/* Top Left: Red Bell Icon Tile */}
      <FlexWidget
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          backgroundColor: '#FF453A',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SvgWidget
          style={{ width: 20, height: 20 }}
          svg={`
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          `}
        />
      </FlexWidget>

      {/* Bottom Area: Label, Title, and Time */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <TextWidget
          text="NEXT REMINDER"
          style={{
            fontSize: 11,
            fontWeight: 'bold',
            color: '#8E8E93',
            letterSpacing: 0.8,
            marginBottom: 4,
          }}
        />

        <TextWidget
          text={reminderTitle}
          style={{
            fontSize: 18,
            fontWeight: 'bold',
            color: '#FFFFFF',
            marginBottom: 2,
          }}
        />

        <TextWidget
          text={reminderTime}
          style={{
            fontSize: 14,
            fontWeight: '500',
            color: '#8E8E93',
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
