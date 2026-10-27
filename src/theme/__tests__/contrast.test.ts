import { lightTokens, darkTokens, ThemeTokens } from '../tokens';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;
const NON_TEXT = 3;

describe.each([
  ['light', lightTokens],
  ['dark', darkTokens],
] as Array<[string, ThemeTokens]>)('%s theme contrast', (_name, t) => {
  const surfaces: Array<[string, string]> = [
    ['background', t.background],
    ['surface', t.surface],
    ['surfaceAlt', t.surfaceAlt],
  ];

  it.each(surfaces)('body and secondary text pass AA on %s', (_n, bg) => {
    expect(ratio(t.text, bg)).toBeGreaterThanOrEqual(AA);
    expect(ratio(t.textSecondary, bg)).toBeGreaterThanOrEqual(AA);
  });

  it.each(surfaces.slice(0, 2))('disabled and placeholder text pass AA on %s', (_n, bg) => {
    expect(ratio(t.textDisabled, bg)).toBeGreaterThanOrEqual(AA);
    expect(ratio(t.placeholder, bg)).toBeGreaterThanOrEqual(AA);
  });

  it.each(surfaces.slice(0, 2))('primary and status text variants pass AA on %s', (_n, bg) => {
    for (const key of ['primaryText', 'successText', 'warningText', 'errorText', 'infoText', 'secondaryText'] as const) {
      expect({ key, passes: ratio(t[key], bg) >= AA }).toEqual({ key, passes: true });
    }
  });

  it('white text on primary fills passes AA', () => {
    expect(ratio(t.white, t.primary)).toBeGreaterThanOrEqual(AA);
  });

  it('primary fills and the tint stand out from the page (3:1 non-text)', () => {
    expect(ratio(t.primary, t.background)).toBeGreaterThanOrEqual(NON_TEXT);
    expect(ratio(t.tint, t.background)).toBeGreaterThanOrEqual(NON_TEXT);
    expect(ratio(t.tint, t.surface)).toBeGreaterThanOrEqual(NON_TEXT);
  });
});
