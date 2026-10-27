import { Platform, StyleSheet } from 'react-native';

export const colors = {
  // Stitch "Nocturne Transit" (Dark Mode) Material 3 tokens
  background: '#0d1320',
  surface: '#0d1320',
  surfaceDim: '#0d1320',
  surfaceBright: '#333948',
  surfaceContainerLowest: '#080e1b',
  surfaceContainerLow: '#161b29',
  surfaceContainer: '#1a1f2d',
  surfaceContainerHigh: '#242a38',
  surfaceContainerHighest: '#2f3543',
  surfaceVariant: '#2f3543',
  onBackground: '#dde2f5',
  onSurface: '#f8fafc',
  onSurfaceVariant: '#94a3b8',
  inverseSurface: '#dde2f5',
  inverseOnSurface: '#2a303f',
  outline: '#8c909f',
  outlineVariant: '#424754',
  primary: '#adc6ff',
  onPrimary: '#002e6a',
  primaryContainer: '#4d8eff',
  onPrimaryContainer: '#00285d',
  primaryFixed: '#d8e2ff',
  primaryFixedDim: '#adc6ff',
  onPrimaryFixed: '#001a42',
  secondary: '#a4c9ff',
  onSecondary: '#00315d',
  secondaryContainer: '#0267b8',
  onSecondaryContainer: '#d6e5ff',
  secondaryFixed: '#d4e3ff',
  onSecondaryFixed: '#001c39',
  tertiary: '#4edea3',
  onTertiary: '#003824',
  tertiaryContainer: '#00a572',
  onTertiaryContainer: '#00311f',
  tertiaryFixed: '#6ffbbe',
  tertiaryFixedDim: '#4edea3',
  onTertiaryFixed: '#002113',
  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',
  emerald: '#4edea3',
  emeraldContainer: 'rgba(78, 222, 163, 0.15)',

  // Backward-compatible aliases
  ink: '#f8fafc',
  blue: '#4d8eff',
  white: '#ffffff',
  muted: '#94a3b8',
} as const;

export const fonts = {
  display: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  clock: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
};

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
    },
    android: { elevation: 4 },
    default: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
    },
  }),
  hero: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.45,
      shadowRadius: 20,
    },
    android: { elevation: 6 },
    default: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.45,
      shadowRadius: 20,
    },
  }),
  glowBlue: Platform.select({
    ios: {
      shadowColor: '#4d8eff',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
    },
    android: { elevation: 6 },
    default: {
      shadowColor: '#4d8eff',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
    },
  }),
};

export const text = StyleSheet.create({
  displayLg: { fontFamily: fonts.display, fontSize: 34, lineHeight: 42, fontWeight: '800', letterSpacing: -0.6, color: colors.onSurface },
  headlineLg: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4, color: colors.onSurface },
  headlineMd: { fontFamily: fonts.display, fontSize: 20, lineHeight: 28, fontWeight: '700', letterSpacing: -0.2, color: colors.onSurface },
  headlineSm: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, fontWeight: '700', color: colors.onSurface },
  bodyLg: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24, fontWeight: '400', color: colors.onSurface },
  bodyMd: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, fontWeight: '400', color: colors.onSurfaceVariant },
  bodySm: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16, fontWeight: '400', color: colors.onSurfaceVariant },
  labelLg: { fontFamily: fonts.clock, fontSize: 13, lineHeight: 16, fontWeight: '600', letterSpacing: 0.3, color: colors.onSurface, fontVariant: ['tabular-nums'] },
  labelMd: { fontFamily: fonts.clock, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.4, color: colors.onSurface, fontVariant: ['tabular-nums'] },
  labelSm: { fontFamily: fonts.clock, fontSize: 10, lineHeight: 14, fontWeight: '600', letterSpacing: 0.5, color: colors.onSurfaceVariant, fontVariant: ['tabular-nums'] },

  // Standard semantic aliases used across screens
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3, color: colors.onSurface },
  heading: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, fontWeight: '700', color: colors.onSurface },
  body: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.onSurfaceVariant },
  label: { fontFamily: fonts.clock, fontSize: 11, lineHeight: 15, fontWeight: '600', letterSpacing: 0.4, color: colors.onSurface },
  error: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.error },
});
