/**
 * Lumen's chart kit (react-native-svg): sparkline, line chart with gaps and a goal line, bar
 * chart, scatter plot and a day strip. Every chart has a spoken summary and can be shown as a
 * table instead; colour is never the only signal (dots, dashes, labels carry meaning too).
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { createThemedStyles, useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { downsample, formatValue, gapPath, isolatedIndexes, linear, niceTicks, valueDomain } from '../../utils/charts/chartScale';

function useWidth(initial = 300): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(initial);
  return [w, (e) => { const next = Math.round(e.nativeEvent.layout.width); if (next > 0 && next !== w) setW(next); }];
}

const shortDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

// ── Sparkline ────────────────────────────────────────────────────────────────

export function Sparkline({ values, color, height = 32 }: { values: Array<number | null>; color: string; height?: number }) {
  const [width, onLayout] = useWidth(120);
  const vals = downsample(values, 60);
  const dom = valueDomain(vals);
  if (!dom) return <View style={{ height }} onLayout={onLayout} />;
  const x = linear([0, Math.max(1, vals.length - 1)], [2, width - 2]);
  const y = linear(dom, [height - 3, 3]);
  return (
    <View style={{ height }} onLayout={onLayout} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={width} height={height}>
        <Path d={gapPath(vals, x, y)} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {isolatedIndexes(vals).map(i => <Circle key={i} cx={x(i)} cy={y(vals[i] as number)} r={2} fill={color} />)}
      </Svg>
    </View>
  );
}

// ── Show-as-table wrapper ────────────────────────────────────────────────────

export function ChartFrame({ summary, table, children }: { summary: string; table: Array<[string, string]>; children: React.ReactNode }) {
  const styles = useStyles();
  const [asTable, setAsTable] = useState(false);
  return (
    <View style={styles.frame}>
      <View accessible accessibilityRole="image" accessibilityLabel={summary}>
        {asTable ? (
          <View style={styles.table}>
            {table.map(([k, v], i) => (
              <View key={`${k}-${i}`} style={styles.tableRow}>
                <Text style={styles.tableKey}>{k}</Text>
                <Text style={styles.tableVal}>{v}</Text>
              </View>
            ))}
          </View>
        ) : children}
      </View>
      <TouchableOpacity onPress={() => setAsTable(t => !t)} accessibilityRole="button" accessibilityLabel={asTable ? 'Show as chart' : 'Show as table'} hitSlop={8} style={styles.toggle}>
        <Text style={styles.toggleText}>{asTable ? 'Show as chart' : 'Show as table'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Line chart ───────────────────────────────────────────────────────────────

export function LineChart({
  series, color, goal, decimals = 0, unit = '', height = 180, zeroBased = false,
}: {
  series: Array<{ day: string; v: number | null }>;
  color: string;
  goal?: number | null;
  decimals?: number;
  unit?: string;
  height?: number;
  zeroBased?: boolean;
}) {
  const { palette } = useTheme();
  const [width, onLayout] = useWidth();
  const values = series.map(p => p.v);
  const dom = valueDomain(values, [goal], zeroBased);
  const left = 38;
  const bottom = 20;
  const covered = values.filter(v => v !== null).length;
  const summary = dom
    ? `Line chart, ${series.length} days, ${covered} with a value, from ${formatValue(Math.min(...values.filter((v): v is number => v !== null)), decimals)} to ${formatValue(Math.max(...values.filter((v): v is number => v !== null)), decimals)} ${unit}${goal ? `, goal ${formatValue(goal, decimals)}` : ''}.`
    : 'No values in this period.';
  const table: Array<[string, string]> = series.filter(p => p.v !== null).slice(-60).reverse().map(p => [shortDay(p.day), `${formatValue(p.v, decimals)} ${unit}`.trim()]);

  return (
    <ChartFrame summary={summary} table={table.length ? table : [['No values', '']]}>
      <View style={{ height }} onLayout={onLayout}>
        {dom ? (() => {
          const ticks = niceTicks(dom[0], dom[1], 4);
          const x = linear([0, Math.max(1, series.length - 1)], [left, width - 6]);
          const y = linear(dom, [height - bottom, 8]);
          return (
            <Svg width={width} height={height}>
              {ticks.map(t => (
                <React.Fragment key={t}>
                  <Line x1={left} x2={width - 6} y1={y(t)} y2={y(t)} stroke={palette.border} strokeWidth={1} />
                  <SvgText x={left - 6} y={y(t) + 4} fontSize={10} fill={palette.textSecondary} textAnchor="end">{formatValue(t, decimals)}</SvgText>
                </React.Fragment>
              ))}
              {goal ? <Line x1={left} x2={width - 6} y1={y(goal)} y2={y(goal)} stroke={palette.success} strokeWidth={1.5} strokeDasharray="5,4" /> : null}
              <Path d={gapPath(values, x, y)} stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              {values.map((v, i) => (v === null ? null : <Circle key={i} cx={x(i)} cy={y(v)} r={series.length > 60 ? 1.6 : 2.6} fill={color} />))}
              <SvgText x={left} y={height - 4} fontSize={10} fill={palette.textSecondary}>{shortDay(series[0].day)}</SvgText>
              <SvgText x={width - 6} y={height - 4} fontSize={10} fill={palette.textSecondary} textAnchor="end">{shortDay(series[series.length - 1].day)}</SvgText>
            </Svg>
          );
        })() : null}
      </View>
    </ChartFrame>
  );
}

// ── Bar chart ────────────────────────────────────────────────────────────────

export function BarChart({
  values, labels, color, decimals = 0, unit = '', height = 140, highlight,
}: {
  values: Array<number | null>;
  labels: string[];
  color: string;
  decimals?: number;
  unit?: string;
  height?: number;
  highlight?: number;
}) {
  const { palette } = useTheme();
  const [width, onLayout] = useWidth();
  const dom = valueDomain(values, [], true);
  const bottom = 18;
  const top = 14;
  const summary = `Bar chart: ${labels.map((l, i) => `${l} ${formatValue(values[i], decimals)}`).join(', ')} ${unit}.`;
  const table: Array<[string, string]> = labels.map((l, i) => [l, `${formatValue(values[i], decimals)} ${unit}`.trim()]);
  return (
    <ChartFrame summary={summary} table={table}>
      <View style={{ height }} onLayout={onLayout}>
        {dom ? (
          <Svg width={width} height={height}>
            {values.map((v, i) => {
              const slot = width / values.length;
              const bw = Math.max(6, slot * 0.62);
              const h = v === null ? 0 : ((v - dom[0]) / (dom[1] - dom[0] || 1)) * (height - bottom - top);
              const xx = i * slot + (slot - bw) / 2;
              return (
                <React.Fragment key={i}>
                  <Rect x={xx} y={height - bottom - h} width={bw} height={Math.max(v === null ? 0 : 1, h)} rx={4} fill={i === highlight ? palette.primary : color} opacity={v === null ? 0.25 : 1} />
                  {v !== null && values.length <= 8 ? (
                    <SvgText x={xx + bw / 2} y={height - bottom - h - 3} fontSize={9} fill={palette.textSecondary} textAnchor="middle">{formatValue(v, decimals)}</SvgText>
                  ) : null}
                  <SvgText x={xx + bw / 2} y={height - 4} fontSize={10} fill={palette.textSecondary} textAnchor="middle">{labels[i]}</SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        ) : null}
      </View>
    </ChartFrame>
  );
}

// ── Scatter plot ─────────────────────────────────────────────────────────────

export function ScatterPlot({
  points, color, xLabel, yLabel, height = 220,
}: {
  points: Array<{ x: number; y: number; day?: string }>;
  color: string;
  xLabel: string;
  yLabel: string;
  height?: number;
}) {
  const { palette } = useTheme();
  const [width, onLayout] = useWidth();
  const dx = valueDomain(points.map(p => p.x));
  const dy = valueDomain(points.map(p => p.y));
  const left = 38;
  const bottom = 30;
  const summary = `Scatter plot of ${points.length} days: ${yLabel} against ${xLabel}.`;
  const table: Array<[string, string]> = points.slice(-60).map(p => [p.day ? shortDay(p.day) : '', `${xLabel} ${formatValue(p.x, 1)} · ${yLabel} ${formatValue(p.y, 1)}`]);
  return (
    <ChartFrame summary={summary} table={table.length ? table : [['No days with both values', '']]}>
      <View style={{ height }} onLayout={onLayout}>
        {dx && dy ? (() => {
          const x = linear(dx, [left, width - 8]);
          const y = linear(dy, [height - bottom, 8]);
          return (
            <Svg width={width} height={height}>
              {niceTicks(dy[0], dy[1], 4).map(t => (
                <React.Fragment key={`y${t}`}>
                  <Line x1={left} x2={width - 8} y1={y(t)} y2={y(t)} stroke={palette.border} />
                  <SvgText x={left - 6} y={y(t) + 4} fontSize={10} fill={palette.textSecondary} textAnchor="end">{formatValue(t, 1)}</SvgText>
                </React.Fragment>
              ))}
              {niceTicks(dx[0], dx[1], 4).map(t => (
                <SvgText key={`x${t}`} x={x(t)} y={height - bottom + 14} fontSize={10} fill={palette.textSecondary} textAnchor="middle">{formatValue(t, 1)}</SvgText>
              ))}
              {points.map((p, i) => <Circle key={i} cx={x(p.x)} cy={y(p.y)} r={3.5} fill={color} opacity={0.7} />)}
              <SvgText x={(left + width) / 2} y={height - 2} fontSize={11} fill={palette.textSecondary} textAnchor="middle">{xLabel}</SvgText>
            </Svg>
          );
        })() : null}
      </View>
    </ChartFrame>
  );
}

// ── Day strip (two rows of days: the thing you picked, and one item) ─────────

export function DayStrip({
  rows, days,
}: {
  days: string[];
  rows: Array<{ label: string; color: string; state: Array<'hit' | 'none' | 'unknown'> }>;
}) {
  const { palette } = useTheme();
  const styles = useStyles();
  const [width, onLayout] = useWidth();
  const n = days.length;
  const cell = Math.max(2, Math.min(10, (width - 4) / Math.max(1, n)));
  const summary = rows.map(r => `${r.label}: on ${r.state.filter(s => s === 'hit').length} of ${r.state.filter(s => s !== 'unknown').length} logged days`).join('. ');
  const table: Array<[string, string]> = days
    .map((d, i): [string, string] => [shortDay(d), rows.map(r => `${r.label} ${r.state[i] === 'hit' ? 'yes' : r.state[i] === 'none' ? 'no' : '–'}`).join(' · ')])
    .filter(([, v]) => v.includes('yes'))
    .reverse();
  return (
    <ChartFrame summary={summary} table={table.length ? table : [['No days to show', '']]}>
      <View onLayout={onLayout} style={{ gap: 6 }}>
        {rows.map(r => (
          <View key={r.label} style={{ gap: 2 }}>
            <Text style={styles.stripLabel}>{r.label}</Text>
            <Svg width={width} height={16}>
              {r.state.map((s, i) => s === 'unknown' ? null : (
                <Rect key={i} x={2 + i * cell} y={2} width={Math.max(1.5, cell - 1)} height={12} rx={1.5}
                  fill={s === 'hit' ? r.color : palette.border} opacity={s === 'hit' ? 1 : 0.6} />
              ))}
            </Svg>
          </View>
        ))}
        {n > 0 ? (
          <View style={styles.stripAxis}>
            <Text style={styles.stripAxisText}>{shortDay(days[0])}</Text>
            <Text style={styles.stripAxisText}>{shortDay(days[n - 1])}</Text>
          </View>
        ) : null}
      </View>
    </ChartFrame>
  );
}

const useStyles = createThemedStyles(palette => ({
  frame: { gap: 6 },
  toggle: { alignSelf: 'flex-end' as const, paddingVertical: 4 },
  toggleText: { ...typography.footnote, color: palette.primaryText, fontWeight: '600' as const },
  table: { gap: 4 },
  tableRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, gap: 12, minHeight: 24 },
  tableKey: { ...typography.footnote, color: palette.textSecondary },
  tableVal: { ...typography.footnote, color: palette.text, fontWeight: '600' as const, flexShrink: 1, textAlign: 'right' as const },
  stripLabel: { ...typography.footnote, color: palette.textSecondary },
  stripAxis: { flexDirection: 'row' as const, justifyContent: 'space-between' as const },
  stripAxisText: { ...typography.caption, color: palette.textSecondary },
}));
