import { DefaultTheme } from '@react-navigation/native';

export const palette = {
  canvas: '#F6F8F3',
  surface: '#FFFFFF',
  panel: '#EDF3EF',
  ink: '#17211C',
  muted: '#68746D',
  line: '#D6DED8',
  teal: '#157A6E',
  tealDark: '#0E5F55',
  coral: '#D86A56',
  amber: '#C8922C',
  blue: '#376B8C',
  mist: '#E7EEF2',
  success: '#2F7D58',
  danger: '#B94C43',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 36,
} as const;

export const typography = {
  hero: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800' as const,
    letterSpacing: 0,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800' as const,
    letterSpacing: 0,
  },
  section: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700' as const,
    letterSpacing: 0,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700' as const,
    letterSpacing: 0,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  smallStrong: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700' as const,
    letterSpacing: 0,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700' as const,
    letterSpacing: 0,
  },
};

export const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.teal,
    background: palette.canvas,
    card: palette.surface,
    text: palette.ink,
    border: palette.line,
    notification: palette.coral,
  },
};

export const paperTheme = {
  roundness: 5,
  colors: {
    primary: palette.teal,
    secondary: palette.coral,
    tertiary: palette.amber,
    background: palette.canvas,
    surface: palette.surface,
    outline: palette.line,
  },
};
