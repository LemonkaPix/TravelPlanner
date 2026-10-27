import { MaterialIcons } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, text } from '@/constants/theme';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
type Props = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  icon?: IconName;
};

export function FormField({ label, error, hint, icon, style, ...props }: Props) {
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const visibleError = touched ? error : undefined;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[
        styles.inputShell,
        focused && styles.focused,
        visibleError && styles.invalid,
      ]}>
        {icon ? <MaterialIcons name={icon} size={20} color={colors.primary} /> : null}
        <TextInput
          {...props}
          accessibilityLabel={label}
          accessibilityHint={visibleError ?? hint}
          placeholderTextColor={colors.outline}
          selectionColor={colors.primaryContainer}
          onFocus={() => setFocused(true)}
          onBlur={() => { setTouched(true); setFocused(false); }}
          style={[styles.input, style]}
        />
      </View>
      {visibleError ? <Text accessibilityLiveRegion="polite" style={text.error}>{visibleError}</Text>
        : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: {
    fontFamily: fonts.clock,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.4)',
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: '500',
  },
  focused: {
    borderColor: colors.primary,
  },
  invalid: {
    borderColor: colors.error,
    backgroundColor: colors.errorContainer,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.onSurfaceVariant,
  },
});
