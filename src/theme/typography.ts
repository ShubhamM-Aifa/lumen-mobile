import { TextStyle } from 'react-native';

export const typography: Record<string, TextStyle> = {
  h1:       { fontSize: 28, fontWeight: '700', lineHeight: 36 },
  h2:       { fontSize: 22, fontWeight: '700', lineHeight: 30 },
  h3:       { fontSize: 18, fontWeight: '600', lineHeight: 26 },
  h4:       { fontSize: 16, fontWeight: '600', lineHeight: 24 },
  body:     { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  small:    { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  smallBold:{ fontSize: 13, fontWeight: '600', lineHeight: 18 },
  caption:  { fontSize: 11, fontWeight: '400', lineHeight: 16 },
  label:    { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  button:   { fontSize: 15, fontWeight: '600', lineHeight: 22 },

  // iOS-style scale (large titles, grouped lists). Used by the redesigned screens.
  largeTitle:   { fontSize: 34, fontWeight: '700', lineHeight: 41, letterSpacing: -0.7 },
  title2:       { fontSize: 22, fontWeight: '700', lineHeight: 28, letterSpacing: -0.2 },
  headline:     { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  bodyLarge:    { fontSize: 17, fontWeight: '400', lineHeight: 22 },
  subhead:      { fontSize: 15, fontWeight: '400', lineHeight: 20 },
  subheadBold:  { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  footnote:     { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  sectionLabel: { fontSize: 13, fontWeight: '400', lineHeight: 18, letterSpacing: 0.3, textTransform: 'uppercase' },
  tabLabel:     { fontSize: 10, fontWeight: '600', lineHeight: 12 },
};
