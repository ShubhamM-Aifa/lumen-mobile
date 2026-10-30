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

  const water = data.waterCount ?? 0;
  const stoodUp = data.stoodUpCount ?? 0;
  const meds = data.medsCount ?? 0;
  const flare = data.flareCount ?? 0;

  // Donut ring dimensions
  const radius = 27;
  const circumference = 2 * Math.PI * radius; // ~169.65
  const ratio = Math.min(1, Math.max(0, completed / total));
  const strokeDashoffset = circumference * (1 - ratio);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#2C2C2E',
        borderRadius: 26,
        paddingHorizontal: 12,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
      accessibilityLabel="Lumen Today Widget"
    >
      {/* Left Column: Header + Donut Progress Ring + Tasks Left (Tapping opens app) */}
      <FlexWidget
        style={{
          width: 96,
          height: 'match_parent',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        clickAction="OPEN_APP"
        accessibilityLabel="Open Lumen Today"
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
              width: 19,
              height: 19,
              borderRadius: 6,
              backgroundColor: '#0A84FF',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 6,
            }}
          >
            <SvgWidget
              style={{ width: 11, height: 11 }}
              svg={`
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path d="M12 0L14.7 9.3L24 12L14.7 14.7L12 24L9.3 14.7L0 12L9.3 9.3L12 0Z"/>
                </svg>
              `}
            />
          </FlexWidget>

          <TextWidget
            text="Today"
            style={{
              fontSize: 14,
              fontWeight: 'bold',
              color: '#FFFFFF',
            }}
          />
        </FlexWidget>

        {/* Circular Donut Ring with Completed / Total in Center */}
        <OverlapWidget
          style={{
            width: 68,
            height: 68,
          }}
        >
          <SvgWidget
            style={{ width: 68, height: 68 }}
            svg={`
              <svg width="68" height="68" viewBox="0 0 68 68">
                <circle
                  cx="34"
                  cy="34"
                  r="${radius}"
                  stroke="#3A3A3C"
                  stroke-width="6"
                  fill="none"
                />
                <circle
                  cx="34"
                  cy="34"
                  r="${radius}"
                  stroke="#0A84FF"
                  stroke-width="6"
                  stroke-linecap="round"
                  stroke-dasharray="${circumference.toFixed(2)}"
                  stroke-dashoffset="${strokeDashoffset.toFixed(2)}"
                  transform="rotate(-90 34 34)"
                  fill="none"
                />
              </svg>
            `}
          />

          <FlexWidget
            style={{
              width: 68,
              height: 68,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TextWidget
              text={`${completed}/${total}`}
              style={{
                fontSize: 14,
                fontWeight: 'bold',
                color: '#FFFFFF',
              }}
            />
          </FlexWidget>
        </OverlapWidget>

        {/* Subtext: "X left" */}
        <TextWidget
          text={`${left} left`}
          style={{
            fontSize: 11,
            fontWeight: '600',
            color: '#8E8E93',
            textAlign: 'center',
          }}
        />
      </FlexWidget>

      {/* Right Column: 2x2 Grid of Styled Card Tiles */}
      <FlexWidget
        style={{
          flex: 1,
          height: 'match_parent',
          flexDirection: 'column',
          justifyContent: 'space-around',
          marginLeft: 6,
        }}
      >
        {/* Row 1: Water & Stood Up */}
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Water Tile */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: '#1C1C1E',
              borderRadius: 14,
              paddingVertical: 6,
              paddingHorizontal: 4,
              marginRight: 4,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            clickAction="LOG_WATER"
            accessibilityLabel={`Log water, currently ${water}`}
          >
            <FlexWidget
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                backgroundColor: '#0A84FF',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 3,
              }}
            >
              <SvgWidget
                style={{ width: 15, height: 15 }}
                svg={`
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#FFFFFF">
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                  </svg>
                `}
              />
            </FlexWidget>
            <TextWidget
              text={`Water · ${water}`}
              style={{
                fontSize: 10.5,
                fontWeight: '600',
                color: '#FFFFFF',
                textAlign: 'center',
              }}
            />
          </FlexWidget>

          {/* Stood Up Tile */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: '#1C1C1E',
              borderRadius: 14,
              paddingVertical: 6,
              paddingHorizontal: 4,
              marginLeft: 4,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            clickAction="LOG_STAND"
            accessibilityLabel={`Log stand up, currently ${stoodUp}`}
          >
            <FlexWidget
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                backgroundColor: '#30D158',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 3,
              }}
            >
              <SvgWidget
                style={{ width: 15, height: 15 }}
                svg={`
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#FFFFFF">
                    <circle cx="12" cy="4" r="2.5"/>
                    <path d="M9 22l1-7 2 2 2-2 1 7h2l-2-9-1.5-3.5a2 2 0 0 0-3 0L9 13l-2 9h2z"/>
                  </svg>
                `}
              />
            </FlexWidget>
            <TextWidget
              text={`Stood Up · ${stoodUp}`}
              style={{
                fontSize: 10.5,
                fontWeight: '600',
                color: '#FFFFFF',
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
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Meds Tile */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: '#1C1C1E',
              borderRadius: 14,
              paddingVertical: 6,
              paddingHorizontal: 4,
              marginRight: 4,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            clickAction="LOG_MEDS"
            accessibilityLabel={`Log medication, currently ${meds}`}
          >
            <FlexWidget
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                backgroundColor: '#BF5AF2',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 3,
              }}
            >
              <SvgWidget
                style={{ width: 15, height: 15 }}
                svg={`
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                    <path d="m8.5 8.5 7 7"/>
                  </svg>
                `}
              />
            </FlexWidget>
            <TextWidget
              text={`Meds · ${meds}`}
              style={{
                fontSize: 10.5,
                fontWeight: '600',
                color: '#FFFFFF',
                textAlign: 'center',
              }}
            />
          </FlexWidget>

          {/* Flare Tile */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: '#1C1C1E',
              borderRadius: 14,
              paddingVertical: 6,
              paddingHorizontal: 4,
              marginLeft: 4,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            clickAction="LOG_FLARE"
            accessibilityLabel={`Log flare symptom, currently ${flare}`}
          >
            <FlexWidget
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                backgroundColor: '#FF453A',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 3,
              }}
            >
              <SvgWidget
                style={{ width: 15, height: 15 }}
                svg={`
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#FFFFFF">
                    <path d="M12 2c-.5 2.5-3 5-3 8a6 6 0 0 0 11.5 2.5c.3-.8.5-1.7.5-2.5 0-3.5-3-6-3-6s-.5 2-2 3c-1-3-4-5-4-5z"/>
                  </svg>
                `}
              />
            </FlexWidget>
            <TextWidget
              text={`Flare · ${flare}`}
              style={{
                fontSize: 10.5,
                fontWeight: '600',
                color: '#FFFFFF',
                textAlign: 'center',
              }}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
