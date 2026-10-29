import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { LumenWidgetData } from './widgetSync';

interface Props {
  data: LumenWidgetData;
}

export function TodayGlanceWidget({ data }: Props) {
  const water = `${data.waterCount ?? 0}/${data.waterGoal ?? 8}`;
  const distance = `${data.distanceKm ?? '0.0'} km`;
  const steps = `${(data.stepsToday ?? 0).toLocaleString()} steps`;
  const active = `${data.activeMinutes ?? 0}m`;
  const activeSub = `Goal ${data.activeGoal ?? 30}m`;

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
      accessibilityLabel="Lumen Today at a Glance Widget"
    >
      {/* Top Header */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {/* Orange indicator dot */}
          <FlexWidget
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#FF6B35',
              marginRight: 6,
            }}
          />
          <TextWidget
            text="LUMEN"
            style={{
              fontSize: 12,
              fontWeight: 'bold',
              color: '#FF6B35',
              letterSpacing: 1,
            }}
          />
        </FlexWidget>

        <TextWidget
          text={data.lastUpdated ? `Updated ${data.lastUpdated}` : 'Today at a glance'}
          style={{
            fontSize: 10,
            color: '#8A909A',
          }}
        />
      </FlexWidget>

      {/* Metrics Row */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* Water Card */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: '#1C1F27',
            borderRadius: 14,
            padding: 8,
            marginRight: 4,
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text="💧 Water"
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: '#60A5FA',
              marginBottom: 2,
            }}
          />
          <TextWidget
            text={water}
            style={{
              fontSize: 15,
              fontWeight: 'bold',
              color: '#FFFFFF',
              marginBottom: 1,
            }}
          />
          <TextWidget
            text="glasses"
            style={{
              fontSize: 9,
              color: '#94A3B8',
            }}
          />
        </FlexWidget>

        {/* Walking Card */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: '#1C1F27',
            borderRadius: 14,
            padding: 8,
            marginHorizontal: 2,
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text="👟 Walking"
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: '#34D399',
              marginBottom: 2,
            }}
          />
          <TextWidget
            text={distance}
            style={{
              fontSize: 15,
              fontWeight: 'bold',
              color: '#FFFFFF',
              marginBottom: 1,
            }}
          />
          <TextWidget
            text={steps}
            style={{
              fontSize: 9,
              color: '#94A3B8',
            }}
          />
        </FlexWidget>

        {/* Active Time Card */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: '#1C1F27',
            borderRadius: 14,
            padding: 8,
            marginLeft: 4,
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text="⏱️ Active"
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: '#FBBF24',
              marginBottom: 2,
            }}
          />
          <TextWidget
            text={active}
            style={{
              fontSize: 15,
              fontWeight: 'bold',
              color: '#FFFFFF',
              marginBottom: 1,
            }}
          />
          <TextWidget
            text={activeSub}
            style={{
              fontSize: 9,
              color: '#94A3B8',
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

