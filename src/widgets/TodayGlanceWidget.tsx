import React from 'react';
import { FlexWidget, TextWidget, OverlapWidget, SvgWidget } from 'react-native-android-widget';
import type { LumenWidgetData } from './widgetSync';

interface Props {
  data: LumenWidgetData;
}

export function TodayGlanceWidget({ data }: Props) {
  const completed = data.completedTasks ?? 12;
  const total = Math.max(1, data.totalTasks ?? 19);
  const left = data.tasksLeft ?? Math.max(0, total - completed);

  const water = data.waterCount ?? 1;
  const stoodUp = data.stoodUpCount ?? 2;
  const meds = data.medsCount ?? 0;
  const flare = data.flareCount ?? 0;

  // Circle dimensions
  const radius = 33;
  const circumference = 2 * Math.PI * radius; // ~207.35
  const ratio = Math.min(1, Math.max(0, completed / total));
  const strokeDashoffset = circumference * (1 - ratio);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#FFFFFF',
        borderRadius: 26,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
      clickAction="OPEN_APP"
      accessibilityLabel="Lumen Today Widget"
    >
      {/* Left Column: Header + Donut Progress Ring + Tasks Left */}
      <FlexWidget
        style={{
          width: 120,
          height: 'match_parent',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Header: Sparkle Badge + "Today" */}
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          <FlexWidget
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              backgroundColor: '#007AFF',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 6,
            }}
          >
            <SvgWidget
              style={{ width: 13, height: 13 }}
              svg={`
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path d="M12 0L14.7 9.3L24 12L14.7 14.7L12 24L9.3 14.7L0 12L9.3 9.3L12 0Z"/>
                </svg>
              `}
            />
          </FlexWidget>

          <TextWidget
            text="Today"
            style={{
              fontSize: 16,
              fontWeight: 'bold',
              color: '#000000',
            }}
          />
        </FlexWidget>

        {/* Circular Donut Ring with Completed / Total in Center */}
        <OverlapWidget
          style={{
            width: 84,
            height: 84,
          }}
        >
          <SvgWidget
            style={{ width: 84, height: 84 }}
            svg={`
              <svg width="84" height="84" viewBox="0 0 84 84">
                <circle
                  cx="42"
                  cy="42"
                  r="${radius}"
                  stroke="#E5E5EA"
                  stroke-width="7"
                  fill="none"
                />
                <circle
                  cx="42"
                  cy="42"
                  r="${radius}"
                  stroke="#007AFF"
                  stroke-width="7"
                  stroke-linecap="round"
                  stroke-dasharray="${circumference.toFixed(2)}"
                  stroke-dashoffset="${strokeDashoffset.toFixed(2)}"
                  transform="rotate(-90 42 42)"
                  fill="none"
                />
              </svg>
            `}
          />

          <FlexWidget
            style={{
              width: 84,
              height: 84,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TextWidget
              text={`${completed}/${total}`}
              style={{
                fontSize: 16,
                fontWeight: 'bold',
                color: '#000000',
              }}
            />
          </FlexWidget>
        </OverlapWidget>

        {/* Subtext: "X left" */}
        <TextWidget
          text={`${left} left`}
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: '#8E8E93',
            textAlign: 'center',
          }}
        />
      </FlexWidget>

      {/* Right Column: 2x2 Grid of Actions & Metrics */}
      <FlexWidget
        style={{
          flex: 1,
          height: 'match_parent',
          flexDirection: 'column',
          justifyContent: 'space-around',
          paddingLeft: 12,
        }}
      >
        {/* Row 1: Water & Stood Up */}
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'center',
          }}
        >
          {/* Water */}
          <FlexWidget
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 78,
            }}
          >
            <FlexWidget
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                backgroundColor: '#007AFF',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 4,
              }}
            >
              <SvgWidget
                style={{ width: 18, height: 18 }}
                svg={`
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF">
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                  </svg>
                `}
              />
            </FlexWidget>
            <TextWidget
              text={`Water · ${water}`}
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: '#000000',
                textAlign: 'center',
              }}
            />
          </FlexWidget>

          {/* Stood Up */}
          <FlexWidget
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 78,
            }}
          >
            <FlexWidget
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                backgroundColor: '#34C759',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 4,
              }}
            >
              <SvgWidget
                style={{ width: 18, height: 18 }}
                svg={`
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF">
                    <circle cx="12" cy="4" r="2.5"/>
                    <path d="M9 22l1-7 2 2 2-2 1 7h2l-2-9-1.5-3.5a2 2 0 0 0-3 0L9 13l-2 9h2z"/>
                  </svg>
                `}
              />
            </FlexWidget>
            <TextWidget
              text={`Stood Up · ${stoodUp}`}
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: '#000000',
                textAlign: 'center',
              }}
            />
          </FlexWidget>
        </FlexWidget>

        {/* Row 2: Meds & Flare */}
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'center',
          }}
        >
          {/* Meds */}
          <FlexWidget
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 78,
            }}
          >
            <FlexWidget
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                backgroundColor: '#AF52DE',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 4,
              }}
            >
              <SvgWidget
                style={{ width: 18, height: 18 }}
                svg={`
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                    <path d="m8.5 8.5 7 7"/>
                  </svg>
                `}
              />
            </FlexWidget>
            <TextWidget
              text={`Meds · ${meds}`}
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: '#000000',
                textAlign: 'center',
              }}
            />
          </FlexWidget>

          {/* Flare */}
          <FlexWidget
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 78,
            }}
          >
            <FlexWidget
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                backgroundColor: '#FF3B30',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 4,
              }}
            >
              <SvgWidget
                style={{ width: 18, height: 18 }}
                svg={`
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF">
                    <path d="M12 2c-.5 2.5-3 5-3 8a6 6 0 0 0 11.5 2.5c.3-.8.5-1.7.5-2.5 0-3.5-3-6-3-6s-.5 2-2 3c-1-3-4-5-4-5z"/>
                  </svg>
                `}
              />
            </FlexWidget>
            <TextWidget
              text={`Flare · ${flare}`}
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: '#000000',
                textAlign: 'center',
              }}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
