import { useState } from 'react';
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/FormField';
import { colors, text } from '@/constants/theme';
import { KRAKOW_CITY } from '../transit/contract';
import { transitConfigured } from '../transit/krakowApi';
import { StopPicker } from '../transit/TransitFields';
import { validMinutes } from './plan';
import { validatePoint, type PointDraft, type PointList, type SavedPoint } from './settings';
import { useStoredSettings } from './StoredSettingsProvider';

function ActionButton({ label, onPress, disabled, secondary = false }: {
  label: string; onPress: () => void; disabled: boolean; secondary?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
      onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, (disabled || pressed) && styles.muted]}>
      <Text style={secondary ? text.label : styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const emptyPoint = (): PointDraft => ({ name: '', stop: null, walkMinutes: '5' });

function PointAction({ action, name, disabled, onPress }: {
  action: 'edit' | 'delete'; name: string; disabled: boolean; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${action === 'edit' ? 'Edytuj' : 'Usuń'} punkt: ${name}`}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.iconButton, (disabled || pressed) && styles.muted]}>
      {action === 'edit' ? <Text accessible={false} style={styles.editIcon}>✎</Text> : (
        <View accessible={false} style={styles.trashIcon}>
          <View style={styles.trashHandle} />
          <View style={styles.trashLid} />
          <View style={styles.trashBin} />
        </View>
      )}
    </Pressable>
  );
}

function PointSection({ list, title, walkLabel }: { list: PointList; title: string; walkLabel: string }) {
  const { settings, saving, saveSettings } = useStoredSettings();
  const [draft, setDraft] = useState(emptyPoint);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const errors = validatePoint(draft);
  const valid = Object.keys(errors).length === 0;

  function reset() {
    setDraft(emptyPoint());
    setEditingId(null);
    setFormVisible(false);
  }

  function openForm(point?: SavedPoint) {
    Keyboard.dismiss();
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
      ...draft, name: draft.name.trim(), stop: draft.stop,
      id: editingId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    };
    const points = editingId ? settings[list].map((item) => item.id === editingId ? point : item) : [...settings[list], point];
    if (await saveSettings({ ...settings, [list]: points })) {
      reset();
      setNotice(`Zapisano punkt „${point.name}”.`);
    } else setNotice('Nie udało się zapisać punktu. Spróbuj ponownie.');
  }

  async function removePoint(point: SavedPoint) {
    Keyboard.dismiss();
    setNotice(null);
    if (await saveSettings({ ...settings, [list]: settings[list].filter((item) => item.id !== point.id) })) {
      if (editingId === point.id) reset();
      setNotice(`Usunięto punkt „${point.name}”.`);
    } else setNotice('Nie udało się usunąć punktu. Spróbuj ponownie.');
  }

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={text.heading}>{title}</Text>
      {settings[list].length === 0 && <Text style={text.body}>Nie masz jeszcze zapisanych punktów. Dodaj pierwszy poniżej.</Text>}
      {settings[list].map((point) => (
        <View key={point.id} style={styles.point}>
          <View style={styles.pointInfo}>
            <Text style={styles.pointName}>{point.name}</Text>
            <Text numberOfLines={2} style={styles.pointDetail}>{point.stop.label} · {point.stop.code ?? 'bez kodu'} · {point.walkMinutes} min pieszo</Text>
          </View>
          <View style={styles.actions}>
            <PointAction action="edit" name={point.name} disabled={saving} onPress={() => openForm(point)} />
            <PointAction action="delete" name={point.name} disabled={saving} onPress={() => { void removePoint(point); }} />
          </View>
        </View>
      ))}
      <ActionButton label="＋ Dodaj punkt" secondary disabled={saving} onPress={() => openForm()} />
      {!formVisible && notice && <Text accessibilityLiveRegion="polite" style={text.body}>{notice}</Text>}
      {formVisible && <Modal animationType="slide" onRequestClose={() => { if (!saving) { reset(); setNotice(null); } }}>
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
              <View style={styles.header}>
                <Text style={text.label}>{title}</Text>
                <Text accessibilityRole="header" style={text.title}>{editingId ? 'Edytuj punkt' : 'Nowy punkt'}</Text>
              </View>
              <View style={styles.card}>
                <View style={styles.form} pointerEvents={saving ? 'none' : 'auto'}>
                  <FormField label="Nazwa punktu" value={draft.name} maxLength={120} editable={!saving}
                    placeholder={list === 'startPoints' ? 'np. Dom' : 'np. Uczelnia'} error={errors.name}
                    onChangeText={(name) => updateDraft({ name })} />
                  <StopPicker label="Przystanek ZTP" cityId={KRAKOW_CITY.id} value={draft.stop} error={errors.stop}
                    onChange={(stop) => updateDraft({ stop })} />
                  <FormField label={walkLabel} value={draft.walkMinutes} maxLength={3} editable={!saving}
                    keyboardType="number-pad" hint="Od 0 do 180 minut." error={errors.walkMinutes}
                    onChangeText={(walkMinutes) => updateDraft({ walkMinutes })} />
                </View>
                <ActionButton label={saving ? 'Zapisuję…' : editingId ? 'Zapisz zmiany' : 'Zapisz punkt'} disabled={!valid || saving}
                  onPress={() => { void savePoint(); }} />
                <ActionButton label="Anuluj" secondary disabled={saving} onPress={() => { Keyboard.dismiss(); reset(); setNotice(null); }} />
                {!valid && <Text style={text.body}>Podaj nazwę, wybierz przystanek i wpisz od 0 do 180 minut dojścia.</Text>}
                {notice && <Text accessibilityLiveRegion="polite" style={text.error}>{notice}</Text>}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>}
    </View>
  );
}

function BufferSection() {
  const { settings, saving, saveSettings } = useStoredSettings();
  const [bufferMinutes, setBufferMinutes] = useState(settings.bufferMinutes);
  const [notice, setNotice] = useState<string | null>(null);
  const valid = validMinutes(bufferMinutes);

  async function saveBuffer() {
    Keyboard.dismiss();
    setNotice(null);
    if (await saveSettings({ ...settings, bufferMinutes })) setNotice('Zapisano wspólny zapas. Możesz użyć go w planerze.');
    else setNotice('Nie udało się zapisać zapasu. Spróbuj ponownie.');
  }

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={text.heading}>Wspólny zapas</Text>
      <Text style={text.body}>Dodatkowy czas przed planowanym terminem. Wybór zapisanego punktu w planerze uzupełnia także zapas.</Text>
      <FormField label="Zapas (min)" value={bufferMinutes} maxLength={3} keyboardType="number-pad" editable={!saving}
        hint="Od 0 do 180 minut." error={valid ? undefined : 'Wpisz od 0 do 180 minut.'}
        onChangeText={(value) => { setBufferMinutes(value); setNotice(null); }} />
      <ActionButton label="Zapisz zapas" disabled={!valid || saving} onPress={() => { void saveBuffer(); }} />
      {notice && <Text accessibilityLiveRegion="polite" style={text.body}>{notice}</Text>}
    </View>
  );
}

export default function SettingsScreen() {
  const { loading, saving, storageError } = useStoredSettings();
  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.loading}>
        <ActivityIndicator color={colors.blue} accessibilityLabel="Wczytywanie ustawień" />
        <Text style={text.body}>Wczytuję ustawienia…</Text>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={text.title}>Twoje stałe punkty.</Text>
            <Text style={text.body}>Twoje miejsca i dojścia do przystanków ZTP.</Text>
          </View>
          {storageError && <Text accessibilityLiveRegion="polite" style={text.error}>{storageError}</Text>}
          {saving && <Text accessibilityLiveRegion="polite" style={text.body}>Zapisuję ustawienia…</Text>}
          {!transitConfigured && <Text style={text.error}>Wyszukiwanie przystanków nie jest jeszcze dostępne. Usługa wymaga konfiguracji.</Text>}
          <PointSection list="startPoints" title="Punkty początkowe" walkLabel="Dojście do przystanku (min)" />
          <PointSection list="endPoints" title="Punkty końcowe" walkLabel="Dojście od przystanku do celu (min)" />
          <BufferSection />
          <Text style={text.body}>Każdy punkt i zapas zapisujesz osobno na tym urządzeniu.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 20, paddingBottom: 36, gap: 24 },
  header: { gap: 14, paddingTop: 12 },
  card: { padding: 22, backgroundColor: colors.white, borderRadius: 22, gap: 20 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.background },
  pointInfo: { flex: 1, gap: 5 },
  pointName: { fontSize: 16, fontWeight: '600', color: colors.ink },
  pointDetail: { fontSize: 12, lineHeight: 18, color: colors.muted },
  form: { gap: 16 },
  actions: { flexDirection: 'row', gap: 6 },
  iconButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  editIcon: { fontSize: 26, color: colors.blue },
  trashIcon: { width: 20, height: 22, alignItems: 'center', justifyContent: 'center' },
  trashHandle: { width: 8, height: 3, borderWidth: 1.5, borderBottomWidth: 0, borderColor: colors.error, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  trashLid: { width: 18, height: 2, backgroundColor: colors.error, borderRadius: 1 },
  trashBin: { width: 13, height: 14, borderWidth: 1.5, borderTopWidth: 0, borderColor: colors.error, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  button: { borderRadius: 14, backgroundColor: colors.blue, minHeight: 50, padding: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { backgroundColor: colors.background },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  muted: { opacity: 0.55 },
});
