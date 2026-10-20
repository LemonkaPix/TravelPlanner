import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, text } from '@/constants/theme';

type Props = TextInputProps & { label: string; error?: string; hint?: string };

export function FormField({ label, error, hint, style, ...props }: Props) {
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const visibleError = touched ? error : undefined;

  return (
    <View style={styles.field}>
      <Text style={text.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        accessibilityHint={visibleError ?? hint}
        placeholderTextColor={colors.muted}
        selectionColor={colors.blue}
        onFocus={() => setFocused(true)}
        onBlur={() => { setTouched(true); setFocused(false); }}
        style={[
          styles.input,
          focused && styles.focused,
          visibleError && styles.invalid,
          style,
        ]}
      />
      {visibleError ? <Text accessibilityLiveRegion="polite" style={text.error}>{visibleError}</Text>
        : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  input: {
    borderRadius: 12, borderWidth: 1, borderColor: colors.background,
    backgroundColor: colors.background, paddingHorizontal: 14, paddingVertical: 13,
    minHeight: 50, color: colors.ink, fontSize: 16,
  },
  focused: { borderColor: colors.blue },
  invalid: { borderColor: colors.error },
  hint: { fontSize: 12, lineHeight: 18, color: colors.muted },
});
