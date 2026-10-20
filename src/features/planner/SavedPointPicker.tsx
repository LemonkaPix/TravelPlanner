import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, text } from '@/constants/theme';
import type { SavedPoint } from './settings';

export function SavedPointPicker({ label, points, selectedId, onSelect }: {
  label: string; points: SavedPoint[]; selectedId: string | null; onSelect: (point: SavedPoint) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const selected = points.find((point) => point.id === selectedId);
  const disabled = points.length === 0;
  return (
    <View style={styles.group}>
      <Text style={text.label}>{label}</Text>
      <Pressable accessibilityRole="combobox" accessibilityLabel={`${label}: ${selected?.name ?? 'Wybierz punkt'}`}
        accessibilityState={{ expanded: expanded && !disabled, disabled }} disabled={disabled}
        onPress={() => setExpanded((value) => !value)} onAccessibilityEscape={() => setExpanded(false)}
        style={({ pressed }) => [styles.trigger, expanded && !disabled && styles.open, (pressed || disabled) && styles.muted]}>
        <View style={styles.triggerText}>
          <Text style={selected ? styles.pointName : text.body}>{selected?.name ?? 'Wybierz punkt'}</Text>
          {selected && <Text numberOfLines={1} style={styles.detail}>{selected.stop.label} · {selected.walkMinutes} min pieszo</Text>}
        </View>
        <Text accessible={false} style={styles.chevron}>{expanded && !disabled ? '⌃' : '⌄'}</Text>
      </Pressable>
      {disabled && <Text style={text.body}>Brak zapisanych punktów. Dodaj je w zakładce „Ustawienia”.</Text>}
      {expanded && !disabled && <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.menu}>
        {points.map((point) => (
          <Pressable key={point.id} accessibilityRole="radio" accessibilityLabel={`${point.name}, ${point.stop.label}, dojście ${point.walkMinutes} minut`}
            accessibilityState={{ checked: selectedId === point.id }} onPress={() => { onSelect(point); setExpanded(false); }}
            style={({ pressed }) => [styles.option, selectedId === point.id && styles.selected, pressed && styles.muted]}>
            <View style={styles.triggerText}>
              <Text style={styles.pointName}>{point.name}</Text>
              <Text style={styles.detail}>{point.stop.label} · {point.stop.code ?? 'bez kodu'} · {point.walkMinutes} min pieszo</Text>
            </View>
            {selectedId === point.id && <Text accessible={false} style={styles.check}>✓</Text>}
          </Pressable>
        ))}
      </ScrollView>}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  trigger: { minHeight: 56, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.background, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', gap: 12 },
  triggerText: { flex: 1, gap: 4 },
  open: { borderColor: colors.blue },
  pointName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  detail: { fontSize: 12, lineHeight: 18, color: colors.muted },
  chevron: { color: colors.blue, fontSize: 24 },
  menu: { maxHeight: 250, borderWidth: 1, borderColor: colors.background, borderRadius: 12, backgroundColor: colors.white },
  option: { minHeight: 56, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  selected: { backgroundColor: colors.background },
  check: { color: colors.blue, fontSize: 18 },
  muted: { opacity: 0.55 },
});
