import { MaterialIcons } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import type { SavedPoint } from './settings';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

export function SavedPointPicker({
  label,
  points,
  selectedId,
  currentName,
  currentStopLabel,
  currentWalkMinutes,
  icon = 'place',
  iconColor = colors.secondary,
  onSelect,
  onOpenSettings,
}: {
  label: string;
  points: SavedPoint[];
  selectedId: string | null;
  currentName?: string;
  currentStopLabel?: string;
  currentWalkMinutes?: string;
  icon?: IconName;
  iconColor?: string;
  onSelect: (point: SavedPoint) => void;
  onOpenSettings?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const selected = points.find((point) => point.id === selectedId);
  const emptyCatalog = points.length === 0;
  const hasSnapshot = !selected && Boolean(currentName?.trim() && currentStopLabel?.trim());
  const walkMin = selected ? selected.walkMinutes : currentWalkMinutes;

  const displayTitle = selected
    ? `${selected.name} (${selected.stop.label})`
    : hasSnapshot
      ? `${currentName} (${currentStopLabel}) — wpisany w planie`
      : emptyCatalog
        ? 'Brak zapisanych punktów — dodaj w Ustawieniach'
        : `Wybierz zapisany punkt (${points.length})`;

  return (
    <View style={styles.group}>
      <View style={styles.headerRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {selected || hasSnapshot ? (
          <View style={styles.walkBadge}>
            <MaterialIcons name="directions-walk" size={13} color={colors.secondary} />
            <Text style={styles.walkBadgeText}>+{walkMin ?? '0'} min dojścia</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        accessibilityRole={emptyCatalog ? 'button' : 'combobox'}
        accessibilityLabel={`${label}: ${selected?.name ?? displayTitle}`}
        accessibilityState={{ expanded: expanded && !emptyCatalog, disabled: emptyCatalog && !onOpenSettings }}
        disabled={emptyCatalog && !onOpenSettings}
        onPress={() => {
          if (emptyCatalog) {
            onOpenSettings?.();
          } else {
            setExpanded((value) => !value);
          }
        }}
        onAccessibilityEscape={() => setExpanded(false)}
        style={({ pressed }) => [
          styles.trigger,
          expanded && !emptyCatalog && styles.triggerOpen,
          pressed && styles.muted,
        ]}
      >
        <MaterialIcons name={icon} size={20} color={iconColor} />
        <View style={styles.triggerText}>
          <Text
            numberOfLines={1}
            style={[
              styles.pointName,
              !selected && styles.pointPlaceholder,
            ]}
          >
            {displayTitle}
          </Text>
        </View>
        <MaterialIcons
          name={emptyCatalog ? 'arrow-forward' : expanded ? 'expand-less' : 'unfold-more'}
          size={18}
          color={emptyCatalog ? colors.primary : colors.outline}
        />
      </Pressable>

      {expanded && !emptyCatalog && (
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.menu}>
          {points.map((point) => {
            const isSelected = selectedId === point.id;
            return (
              <Pressable
                key={point.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                onPress={() => {
                  onSelect(point);
                  setExpanded(false);
                }}
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  pressed && styles.muted,
                ]}
              >
                <View style={styles.triggerText}>
                  <Text style={styles.pointName}>{point.name}</Text>
                  <Text style={styles.detail}>
                    {point.stop.label} · {point.walkMinutes} min pieszo
                  </Text>
                </View>
                <View style={styles.optionRight}>
                  <View style={styles.optionWalkPill}>
                    <Text style={styles.optionWalkText}>+{point.walkMinutes} min</Text>
                  </View>
                  {isSelected && <MaterialIcons name="check" size={16} color={colors.primary} />}
                </View>
              </Pressable>
            );
          })}
          {onOpenSettings && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setExpanded(false);
                onOpenSettings();
              }}
              style={({ pressed }) => [styles.manageOption, pressed && styles.muted]}
            >
              <MaterialIcons name="add-location-alt" size={16} color={colors.primary} />
              <Text style={styles.manageOptionText}>Dodaj lub edytuj punkty w Ustawieniach</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 4 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fieldLabel: {
    fontFamily: fonts.clock,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    letterSpacing: 0.4,
    color: colors.onSurfaceVariant,
  },
  walkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.35)',
  },
  walkBadgeText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '500',
    color: colors.secondary,
  },
  trigger: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.35)',
    backgroundColor: colors.surfaceContainer,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  triggerOpen: {
    borderColor: colors.primary,
  },
  triggerWarning: {
    borderColor: colors.error,
  },
  triggerText: {
    flex: 1,
    gap: 2,
  },
  pointName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  pointPlaceholder: {
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
  pointWarning: {
    color: colors.error,
  },
  detail: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.onSurfaceVariant,
  },
  menu: {
    maxHeight: 240,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
    borderRadius: 10,
    backgroundColor: colors.surfaceContainerLow,
  },
  option: {
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(66, 71, 84, 0.25)',
  },
  optionSelected: {
    backgroundColor: colors.surfaceContainer,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionWalkPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerHigh,
  },
  optionWalkText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondary,
  },
  manageOption: {
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceContainerLowest,
  },
  manageOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  muted: {
    opacity: 0.7,
  },
});
