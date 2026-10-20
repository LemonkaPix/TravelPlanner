import { Platform, StyleSheet } from 'react-native';

export const colors = {
  background: '#F1F5FA',
  ink: '#142D4E',
  blue: '#245CB3',
  white: '#FFFFFF',
  muted: '#53657C',
  error: '#A63632',
};

export const fonts = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  clock: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
};

export const text = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.ink },
  heading: { fontSize: 20, fontWeight: '600', color: colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink },
  error: { fontSize: 13, lineHeight: 20, color: colors.error },
});
