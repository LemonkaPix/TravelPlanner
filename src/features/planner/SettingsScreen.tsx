import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from '@/components/SafeAreaView';

import { FormField } from '@/components/FormField';
import { colors, fonts, shadows, text } from '@/constants/theme';
import { validMinutes } from './plan';
import { PlanTransferPanel } from './PlanTransferPanel';
import { validatePoint, type PointDraft, type PointList, type SavedPoint } from './settings';
import { useStoredSettings } from './StoredSettingsProvider';
import { useStoredPlan } from './useStoredPlan';
import { AlarmSettingsSection } from './AlarmSettingsSection';
import { WidgetSettingsSection } from '../widget/WidgetSettingsSection';

const emptyPoint = (): PointDraft => ({ name: '', stop: null, walkMinutes: '5' });
const BUFFER_PRESETS = [
  { value: '3', label: '3 min', sub: '' },
  { value: '5', label: '5 min', sub: '' },
  { value: '10', label: '10 min', sub: '(Domyślny)' },
  { value: '15', label: '15 min', sub: '' },
] as const;

function PointsCatalogSection() {
  const { settings, saving, saveSettings } = useStoredSettings();
  const [activeList, setActiveList] = useState<PointList>('startPoints');
  const [originalList, setOriginalList] = useState<PointList>('startPoints');
  const [draft, setDraft] = useState(emptyPoint);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const errors = validatePoint(draft);
  const valid = Object.keys(errors).length === 0;

  const customPoints: { point: SavedPoint; list: PointList }[] = [
    ...settings.startPoints.map((point) => ({ point, list: 'startPoints' as const })),
    ...settings.endPoints.map((point) => ({ point, list: 'endPoints' as const })),
  ];

  function reset() {
    setDraft(emptyPoint());
    setEditingId(null);
    setFormVisible(false);
  }

  function openForm(list: PointList, point?: SavedPoint) {
    Keyboard.dismiss();
    setActiveList(list);
    setOriginalList(list);
    setEditingId(point?.id ?? null);
    setDraft(point ? { name: point.name, stop: point.stop, walkMinutes: point.walkMinutes } : emptyPoint());
    setNotice(null);
    setFormVisible(true);
  }

  function updateDraft(patch: Partial<PointDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setNotice(null);
  }

  async function savePoint() {
    if (!valid || !draft.stop || saving) return;
    Keyboard.dismiss();
    setNotice(null);
    const point: SavedPoint = {
      ...draft,
      name: draft.name.trim(),
      stop: draft.stop,
      id: editingId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    };

    const nextSettings = {
      ...settings,
      startPoints: [...settings.startPoints],
      endPoints: [...settings.endPoints],
    };

    if (editingId) {
      if (originalList === activeList) {
        nextSettings[activeList] = nextSettings[activeList].map((item) => (item.id === editingId ? point : item));
      } else {
        nextSettings[originalList] = nextSettings[originalList].filter((item) => item.id !== editingId);
        nextSettings[activeList] = [...nextSettings[activeList], point];
      }
    } else {
      nextSettings[activeList] = [...nextSettings[activeList], point];
    }

    if (await saveSettings(nextSettings)) {
      reset();
      setNotice(`Zapisano punkt „${point.name}”.`);
    } else {
      setNotice('Nie udało się zapisać punktu. Spróbuj ponownie.');
    }
  }

  async function removePoint(list: PointList, point: SavedPoint) {
    Keyboard.dismiss();
    setNotice(null);
    if (await saveSettings({ ...settings, [list]: settings[list].filter((item) => item.id !== point.id) })) {
      if (editingId === point.id) reset();
      setNotice(`Usunięto punkt „${point.name}”.`);
    } else {
      setNotice('Nie udało się usunąć punktu. Spróbuj ponownie.');
    }
  }

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderLeft}>
          <View style={styles.sectionTitleWrap}>
            <MaterialIcons name="pin-drop" size={20} color={colors.primary} />
            <Text accessibilityRole="header" style={styles.sectionHeading}>Zapisane punkty i przystanki</Text>
          </View>
          <Text style={styles.sectionSubtext}>
            Punkty początkowe ({settings.startPoints.length}) oraz docelowe ({settings.endPoints.length}) z czasem dojścia na przystanek.
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{customPoints.length} zapisane</Text>
        </View>
      </View>

      {customPoints.length > 0 ? (
        customPoints.map(({ point, list }) => {
          const isStart = list === 'startPoints';
          return (
            <View key={point.id} style={styles.pointCard}>
              <View style={styles.pointTopRow}>
                <View style={styles.pointAvatar}>
                  <MaterialIcons name={isStart ? 'home' : 'apartment'} size={22} color={isStart ? colors.primary : colors.tertiary} />
                </View>
                <View style={styles.pointMainCol}>
                  <View style={styles.pointHeaderLine}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edytuj punkt ${point.name}`}
                      disabled={saving}
                      onPress={() => openForm(list, point)}
                      style={styles.pointNameRow}
                    >
                      <Text numberOfLines={1} style={styles.pointName}>{point.name}</Text>
                      <View style={[styles.pointRoleTag, !isStart && styles.pointRoleTagSecondary]}>
                        <Text style={[styles.pointRoleTagText, !isStart && styles.pointRoleTagTextSecondary]}>
                          {isStart ? 'Start' : 'Cel'}
                        </Text>
                      </View>
                    </Pressable>
                    <View style={styles.actions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edytuj punkt ${point.name}`}
                        disabled={saving}
                        onPress={() => openForm(list, point)}
                        style={({ pressed }) => [styles.iconButton, pressed && styles.muted]}
                      >
                        <MaterialIcons name="edit" size={18} color={colors.onSurfaceVariant} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Usuń punkt ${point.name}`}
                        disabled={saving}
                        onPress={() => { void removePoint(list, point); }}
                        style={({ pressed }) => [styles.iconButton, pressed && styles.muted]}
                      >
                        <MaterialIcons name="delete" size={18} color={colors.error} />
                      </Pressable>
                    </View>
                  </View>
                  <Text numberOfLines={1} style={styles.pointAddress}>
                    Przystanek: {point.stop.label}
                  </Text>
                  <View style={styles.stopNestedBox}>
                    <View style={styles.stopNestedLeft}>
                      <MaterialIcons name="tram" size={18} color={colors.secondary} />
                      <View style={styles.stopNestedInfo}>
                        <Text numberOfLines={1} style={styles.stopNestedLabel}>{point.stop.label}</Text>
                        <Text style={styles.stopNestedType}>
                          Wpisany ręcznie
                        </Text>
                      </View>
                    </View>
                    <View style={styles.walkBadge}>
                      <MaterialIcons name="directions-walk" size={14} color={colors.secondary} />
                      <Text style={styles.walkBadgeText}>{point.walkMinutes} min</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          );
        })
      ) : (
        <View style={styles.emptyCatalogCard}>
          <MaterialIcons name="location-off" size={24} color={colors.secondary} />
          <View style={styles.emptyCatalogCopy}>
            <Text style={styles.emptyCatalogTitle}>Brak zapisanych punktów</Text>
            <Text style={styles.emptyCatalogText}>
              Dodaj co najmniej jeden punkt początkowy (np. Dom) oraz jeden punkt docelowy (np. Praca lub Uczelnia), aby wybierać je w edytorze dnia.
            </Text>
          </View>
        </View>
      )}

      {/* CTA Dodaj nowy punkt początkowy / docelowy */}
      <View style={styles.addButtonsRow}>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => openForm('startPoints')}
          style={({ pressed }) => [styles.addPointButton, (saving || pressed) && styles.muted]}
        >
          <MaterialIcons name="home" size={18} color={colors.primary} />
          <Text style={styles.addPointButtonText}>+ Punkt początkowy (Start)</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => openForm('endPoints')}
          style={({ pressed }) => [styles.addPointButton, (saving || pressed) && styles.muted]}
        >
          <MaterialIcons name="flag" size={18} color={colors.tertiary} />
          <Text style={styles.addPointButtonText}>+ Punkt docelowy (Cel)</Text>
        </Pressable>
      </View>

      {!formVisible && notice && <Text accessibilityLiveRegion="polite" style={styles.noticeText}>{notice}</Text>}

      {formVisible && (
        <Modal animationType="slide" onRequestClose={() => { if (!saving) { reset(); setNotice(null); } }}>
          <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
                <View style={styles.modalHeader}>
                  <Text style={text.labelSm}>KONFIGURACJA PUNKTU</Text>
                  <Text accessibilityRole="header" style={text.title}>{editingId ? 'Edytuj punkt' : 'Nowy punkt'}</Text>
                </View>
                <View style={styles.modalCard}>
                  <View style={styles.listSwitchRow}>
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: activeList === 'startPoints' }}
                      onPress={() => setActiveList('startPoints')}
                      style={[styles.listSwitchBtn, activeList === 'startPoints' && styles.listSwitchBtnActive]}
                    >
                      <Text style={[styles.listSwitchText, activeList === 'startPoints' && styles.listSwitchTextActive]}>
                        Punkt początkowy (Start)
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: activeList === 'endPoints' }}
                      onPress={() => setActiveList('endPoints')}
                      style={[styles.listSwitchBtn, activeList === 'endPoints' && styles.listSwitchBtnActive]}
                    >
                      <Text style={[styles.listSwitchText, activeList === 'endPoints' && styles.listSwitchTextActive]}>
                        Punkt docelowy (Cel)
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.form} pointerEvents={saving ? 'none' : 'auto'}>
                    <FormField
                      label="Nazwa punktu"
                      value={draft.name}
                      maxLength={120}
                      editable={!saving}
                      placeholder={activeList === 'startPoints' ? 'np. Dom' : 'np. Praca / Uczelnia'}
                      error={errors.name}
                      onChangeText={(name) => updateDraft({ name })}
                    />
                    <FormField label="Nazwa przystanku" value={draft.stop?.label ?? ''} maxLength={240} editable={!saving}
                      placeholder="np. Rondo Mogilskie, peron 2" error={errors.stop}
                      onChangeText={(label) => updateDraft({ stop: { label } })} />
                    <FormField
                      label="Czas dojścia (min)"
                      value={draft.walkMinutes}
                      maxLength={3}
                      editable={!saving}
                      keyboardType="number-pad"
                      hint="Od 0 do 180 minut."
                      error={errors.walkMinutes}
                      onChangeText={(walkMinutes) => updateDraft({ walkMinutes })}
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!valid || saving}
                    onPress={() => { void savePoint(); }}
                    style={({ pressed }) => [styles.primaryModalBtn, (!valid || saving || pressed) && styles.muted]}
                  >
                    <Text style={styles.primaryModalBtnText}>
                      {saving ? 'Zapisuję…' : editingId ? 'Zapisz zmiany' : 'Zapisz punkt'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={() => { Keyboard.dismiss(); reset(); setNotice(null); }}
                    style={({ pressed }) => [styles.secondaryModalBtn, (saving || pressed) && styles.muted]}
                  >
                    <Text style={styles.secondaryModalBtnText}>Anuluj</Text>
                  </Pressable>
                  {notice && <Text accessibilityLiveRegion="polite" style={text.error}>{notice}</Text>}
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}

function BufferSection() {
  const { settings, saving, saveSettings } = useStoredSettings();
  const [bufferMinutes, setBufferMinutes] = useState(settings.bufferMinutes || '10');
  const [notice, setNotice] = useState<string | null>(null);
  const valid = validMinutes(bufferMinutes);
  const unchanged = bufferMinutes === settings.bufferMinutes;

  useEffect(() => {
    setBufferMinutes(settings.bufferMinutes || '10');
  }, [settings.bufferMinutes]);

  async function persistBuffer(value: string) {
    setBufferMinutes(value);
    setNotice(null);
    if (!validMinutes(value) || saving) return;
    if (await saveSettings({ ...settings, bufferMinutes: value })) {
      setNotice(`Zapisano globalny bufor: ${value} min.`);
    } else {
      setNotice('Nie udało się zapisać buforu. Spróbuj ponownie.');
    }
  }

  return (
    <View style={styles.bufferCard}>
      <View style={styles.bufferHeader}>
        <View style={styles.bufferTitleRow}>
          <MaterialIcons name="timer" size={20} color={colors.secondary} />
          <Text accessibilityRole="header" style={styles.bufferTitle}>Globalny bufor bezpieczeństwa</Text>
        </View>
        <Text style={styles.bufferSubtext}>
          Dodatkowy czas doliczany przed planowaną godziną dotarcia do celu. Aktualnie zapisano: {settings.bufferMinutes} min.
        </Text>
      </View>

      {/* 2x2 Grid Segmented Control matching Stitch Screen 4 */}
      <View style={styles.presetGrid}>
        <View style={styles.presetGridRow}>
          {BUFFER_PRESETS.slice(0, 2).map((preset) => {
            const active = bufferMinutes.trim() === preset.value;
            return (
              <Pressable
                key={preset.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: saving }}
                disabled={saving}
                onPress={() => { void persistBuffer(preset.value); }}
                style={({ pressed }) => [styles.presetBtn, active && styles.presetBtnActive, pressed && styles.muted]}
              >
                {active && <MaterialIcons name="check-circle" size={16} color={colors.primaryFixed} />}
                <Text style={[styles.presetBtnLabel, active && styles.presetBtnLabelActive]}>{preset.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.presetGridRow}>
          {BUFFER_PRESETS.slice(2, 4).map((preset) => {
            const active = bufferMinutes.trim() === preset.value;
            return (
              <Pressable
                key={preset.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: saving }}
                disabled={saving}
                onPress={() => { void persistBuffer(preset.value); }}
                style={({ pressed }) => [styles.presetBtn, active && styles.presetBtnActive, pressed && styles.muted]}
              >
                {active && <MaterialIcons name="check-circle" size={16} color={colors.primaryFixed} />}
                <Text style={[styles.presetBtnLabel, active && styles.presetBtnLabelActive]}>
                  {preset.label}{preset.sub ? <Text style={styles.presetBtnSub}> {preset.sub}</Text> : null}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Custom Buffer Input (0-180 min) */}
      <View style={styles.customBufferRow}>
        <View style={styles.customBufferField}>
          <FormField
            label="Własny zapas czasu (0–180 min)"
            value={bufferMinutes}
            maxLength={3}
            editable={!saving}
            keyboardType="number-pad"
            error={valid ? undefined : 'Wpisz od 0 do 180 minut.'}
            onChangeText={(value) => { setBufferMinutes(value); setNotice(null); }}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={!valid || unchanged || saving}
          onPress={() => { Keyboard.dismiss(); void persistBuffer(bufferMinutes); }}
          style={({ pressed }) => [
            styles.saveCustomBufferBtn,
            (!valid || unchanged || saving || pressed) && styles.muted,
          ]}
        >
          <Text style={styles.saveCustomBufferText}>Zapisz</Text>
        </Pressable>
      </View>

      {notice && <Text accessibilityLiveRegion="polite" style={styles.noticeText}>{notice}</Text>}

      {/* Lightbulb Info Box */}
      <View style={styles.tipBanner}>
        <MaterialIcons name="lightbulb-outline" size={20} color={colors.secondary} />
        <Text style={styles.tipBannerText}>
          Zapas określa, ile minut przed terminem musisz dotrzeć do celu. Godzinę wyjścia obliczamy z wpisanego odjazdu i czasu dojścia.
        </Text>
      </View>
    </View>
  );
}

function DataSourcesSection() {
  return (
    <View style={styles.sectionBlock}>
      <Text accessibilityRole="header" style={styles.sectionHeading}>Dane na urządzeniu</Text>
      <View style={styles.dataCard}>
        <Text style={styles.dataTitle}>Połączenia dodawane ręcznie</Text>
        <Text style={styles.privacyText}>Własne przystanki, linie i godziny zapisujesz na urządzeniu. Plany są dostępne bez internetu. Możesz przenieść je przez eksport i import pliku JSON.</Text>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { loading, storageError } = useStoredSettings();
  const planStore = useStoredPlan();

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.loading}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Wczytywanie ustawień" />
        <Text style={text.body}>Wczytuję ustawienia…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Fixed Header matching Stitch Screen 4 */}
        <View style={styles.topAppBar}>
          <View style={styles.brandRow}>
            <View style={styles.brandLogo}>
              <MaterialIcons name="tram" size={22} color={colors.primary} />
            </View>
            <View style={styles.brandCopy}>
              <View style={styles.brandTitleRow}>
                <Text style={styles.brandTitle}>TravelPlanner</Text>
                <View style={styles.localBadge}>
                  <Text style={styles.localBadgeText}>MOJE TRASY</Text>
                </View>
              </View>
              <Text style={styles.brandSubtitle}>Ustawienia</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Wróć do widoku planu"
            onPress={() => router.navigate('/')}
            style={({ pressed }) => [styles.profileCircle, pressed && styles.muted]}
          >
            <MaterialIcons name="route" size={18} color={colors.primary} />
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {/* Welcome / Context Micro-Banner */}
          <View style={styles.heroBanner}>
            <View style={styles.heroBannerTextCol}>
              <View style={styles.heroEyebrowPill}>
                <MaterialIcons name="tune" size={14} color={colors.primary} />
                <Text style={styles.heroBannerEyebrow}>KONFIGURACJA PROFILU</Text>
              </View>
              <Text accessibilityRole="header" style={styles.heroBannerTitle}>Preferencje dojazdów</Text>
              <Text style={styles.heroBannerSubtitle}>
                Dostosuj punkty orientacyjne, czasy dojścia, zapas czasu i budziki.
              </Text>
            </View>
            <View style={styles.heroBannerIconBox}>
              <MaterialIcons name="tram" size={28} color={colors.primary} />
            </View>
          </View>

          {storageError && <Text accessibilityLiveRegion="polite" style={text.error}>{storageError}</Text>}

          {/* SEKCJA 1: Zapisane punkty i przystanki */}
          <PointsCatalogSection />

          {/* SEKCJA 2: Globalny bufor bezpieczeństwa */}
          <BufferSection />

          <AlarmSettingsSection />
          <WidgetSettingsSection />

          {/* SEKCJA 3: Kopie zapasowe i synchronizacja */}
          <PlanTransferPanel store={planStore} />

          {/* SEKCJA 4: Dane i źródła */}
          <DataSourcesSection />

          {/* Krakowski akcent stopki */}
          <View style={styles.footerWrap}>
            <View style={styles.footerBadge}>
              <MaterialIcons name="directions-transit" size={16} color={colors.secondary} />
              <Text style={styles.footerBadgeText}>Zarząd Transportu Publicznego w Krakowie</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.surface },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.surface },
  topAppBar: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(13, 19, 32, 0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(66, 71, 84, 0.4)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(77, 142, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(173, 198, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandCopy: {
    gap: 1,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.onSurface,
  },
  localBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.5)',
  },
  localBadgeText: {
    fontFamily: fonts.clock,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: colors.secondary,
  },
  brandSubtitle: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  profileCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(77, 142, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(173, 198, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 16,
    paddingBottom: 36,
    gap: 20,
  },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#162a4d',
    borderWidth: 1,
    borderColor: 'rgba(173, 198, 255, 0.3)',
    ...shadows.hero,
  },
  heroBannerTextCol: {
    flex: 1,
    gap: 5,
  },
  heroEyebrowPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(173, 198, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(173, 198, 255, 0.3)',
  },
  heroBannerEyebrow: {
    fontFamily: fonts.clock,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.7,
    color: colors.primary,
  },
  heroBannerTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.onSurface,
    letterSpacing: -0.2,
  },
  heroBannerSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.onSurfaceVariant,
  },
  heroBannerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(173, 198, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(173, 198, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 2,
  },
  sectionHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  sectionSubtext: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.onSurfaceVariant,
  },
  countBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.5)',
  },
  countBadgeText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondary,
  },
  emptyCatalogCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
  },
  emptyCatalogCopy: {
    flex: 1,
    gap: 4,
  },
  emptyCatalogTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
  },
  emptyCatalogText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.onSurfaceVariant,
  },
  pointCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
    ...shadows.card,
  },
  pointTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pointAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointMainCol: {
    flex: 1,
    gap: 4,
  },
  pointHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pointNameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointName: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    color: colors.onSurface,
  },
  pointRoleTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(77, 142, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(173, 198, 255, 0.35)',
  },
  pointRoleTagSecondary: {
    backgroundColor: 'rgba(2, 103, 184, 0.3)',
    borderColor: 'rgba(164, 201, 255, 0.35)',
  },
  pointRoleTagText: {
    fontFamily: fonts.clock,
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  pointRoleTagTextSecondary: {
    color: colors.secondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointAddress: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.onSurfaceVariant,
  },
  stopNestedBox: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stopNestedLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stopNestedInfo: {
    flex: 1,
    gap: 1,
  },
  stopNestedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurface,
  },
  stopNestedType: {
    fontFamily: fonts.clock,
    fontSize: 10,
    color: colors.onSurfaceVariant,
  },
  walkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
  },
  walkBadgeText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondary,
  },
  addButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  addPointButton: {
    flex: 1,
    minWidth: 200,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.outlineVariant,
    backgroundColor: 'rgba(22, 27, 41, 0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  addPointButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  bufferCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
    gap: 14,
    ...shadows.card,
  },
  bufferHeader: {
    gap: 4,
  },
  bufferTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bufferTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  bufferSubtext: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.onSurfaceVariant,
  },
  presetGrid: {
    gap: 8,
  },
  presetGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  presetBtnActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
    ...shadows.glowBlue,
  },
  presetBtnLabel: {
    fontFamily: fonts.clock,
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  presetBtnLabelActive: {
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  presetBtnSub: {
    fontSize: 10,
    opacity: 0.85,
  },
  customBufferRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  customBufferField: {
    flex: 1,
  },
  saveCustomBufferBtn: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCustomBufferText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.35)',
  },
  tipBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.onSurfaceVariant,
  },
  dataCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
    gap: 14,
    ...shadows.card,
  },
  dataTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dataInfoCol: {
    flex: 1,
    gap: 3,
  },
  dataTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  greenPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.tertiary,
  },
  dataTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  dataVersion: {
    fontFamily: fonts.clock,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  updateDbBtn: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: colors.secondaryContainer,
    borderWidth: 1,
    borderColor: 'rgba(164, 201, 255, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  updateDbBtnDone: {
    backgroundColor: colors.tertiaryContainer,
  },
  updateDbBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSecondaryContainer,
  },
  privacyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.35)',
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.onSurfaceVariant,
  },
  footerWrap: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 12,
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
  },
  footerBadgeText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  modalHeader: {
    gap: 4,
  },
  modalCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: 14,
    ...shadows.card,
  },
  listSwitchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  listSwitchBtn: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listSwitchBtnActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  listSwitchText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  listSwitchTextActive: {
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  form: {
    gap: 12,
  },
  primaryModalBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryModalBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryModalBtn: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryModalBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.secondary,
    fontWeight: '600',
  },
  muted: {
    opacity: 0.65,
  },
});
