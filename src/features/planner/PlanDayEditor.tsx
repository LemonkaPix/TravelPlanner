import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, AppState, Keyboard, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from '@/components/SafeAreaView';

import { FormField } from '@/components/FormField';
import { colors, fonts, shadows, text } from '@/constants/theme';
import { calculatePlan, formatDate, formatTime, validatePlan, type PlanErrors, type PlanInput } from './plan';
import { ManualConnectionFields } from './ManualConnectionFields';
import type { StoredPlan } from './useStoredPlan';
import { SavedPointPicker } from './SavedPointPicker';
import type { SavedPoint } from './settings';
import { useStoredSettings } from './StoredSettingsProvider';
import { calendarDate, calendarDateKey, validDayDetails } from './calendar';
import { RecurrenceFields } from './RecurrenceFields';

function extractLineCode(label: string): string {
  const token = label.trim().split(/\s+/)[0];
  return token || label;
}

function stepWallTime(current: string, deltaMinutes: number): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(current.trim());
  const baseMinutes = match ? Number(match[1]) * 60 + Number(match[2]) : 9 * 60;
  const next = ((baseMinutes + deltaMinutes) % 1440 + 1440) % 1440;
  const hh = String(Math.floor(next / 60)).padStart(2, '0');
  const mm = String(next % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function shiftCalendarDate(dateStr: string, deltaDays: number): string {
  const d = calendarDate(dateStr);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2099) return dateStr;
  return calendarDateKey(d);
}

function DashedWalkTrack({ label, minutes, sublabel }: { label: string; minutes: string | number; sublabel?: string }) {
  return (
    <View style={styles.trackRow}>
      <View style={styles.trackCol}>
        <View style={styles.dashedLine}>
          <View style={styles.dashDot} />
          <View style={styles.dashDot} />
          <View style={styles.dashDot} />
        </View>
      </View>
      <View style={styles.walkPillWrap}>
        <View style={styles.walkMetaPill}>
          <View style={styles.walkMetaLeft}>
            <MaterialIcons name="directions-walk" size={18} color={colors.secondary} />
            <Text numberOfLines={2} style={styles.walkMetaLabel}>{label}</Text>
          </View>
          <View style={styles.walkMetaRight}>
            <Text style={styles.walkMetaDuration}>{minutes} min</Text>
            {sublabel ? (
              <>
                <Text style={styles.walkMetaDot}>•</Text>
                <Text style={styles.walkMetaDist}>{sublabel}</Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function DepartureCard({ plan, now }: { plan: PlanInput; now: number }) {
  const result = calculatePlan(plan);
  const connection = result.ok ? result.connection : null;

  if (!result.ok || !connection) {
    const message = 'message' in result && result.message
      ? result.message
      : 'Uzupełnij punkty trasy i ręczne połączenie, aby zobaczyć oś czasu od drzwi do celu.';
    return (
      <View style={styles.emptyTimelineCard}>
        <MaterialIcons name="timeline" size={22} color={colors.secondary} />
        <View style={styles.emptyTimelineCopy}>
          <Text style={styles.emptyTimelineTitle}>Szczegóły trasy i oś czasu</Text>
          <Text style={styles.emptyTimelineText}>{message}</Text>
        </View>
      </View>
    );
  }

  const originTitle = plan.origin.trim();
  const destTitle = plan.destination.trim();
  const leaveStr = formatTime(result.departure);
  const leaveDateStr = formatDate(result.departure);
  const crossMidnight = leaveDateStr !== plan.date;
  const arriveStr = formatTime(result.destinationArrival);
  const targetStr = formatTime(result.arrival);
  const spareMinutes = Math.max(0, Math.round((result.arrival.getTime() - result.destinationArrival.getTime()) / 60_000));
  const totalDurationMin = Math.max(1, Math.round((result.destinationArrival.getTime() - result.departure.getTime()) / 60_000));
  const walkToMin = Number(plan.walkToMinutes) || 0;
  const walkFromMin = Number(plan.walkFromMinutes) || 0;
  const transferWalkMin = connection.legs
    .filter((leg) => leg.walking)
    .reduce((acc, leg) => acc + Math.max(1, Math.round((new Date(leg.arrival).getTime() - new Date(leg.departure).getTime()) / 60_000)), 0);
  const totalWalkMin = walkToMin + walkFromMin + transferWalkMin;
  const rides = connection.legs.filter((leg) => !leg.walking);
  const transfersCount = Math.max(0, rides.length - 1);
  const departurePassed = result.departure.getTime() < now;

  return (
    <View style={styles.detailsGroup}>
      {/* Top Trip Overview Card (Stitch Screen 3 Hero Banner) */}
      <View style={styles.overviewCard}>
        <View style={styles.overviewDecor} pointerEvents="none" />
        <View style={styles.overviewHeader}>
          <View style={styles.overviewTitleCol}>
            <Text style={styles.overviewEyebrow}>PODSUMOWANIE WYBRANEGO KURSU</Text>
            <Text numberOfLines={2} style={styles.overviewTitle}>
              {originTitle} → {destTitle}
            </Text>
          </View>
          <View style={styles.manualBadge}>
            <MaterialIcons name="verified" size={15} color={colors.primary} />
            <Text style={styles.manualBadgeText}>Ręcznie</Text>
          </View>
        </View>

        <View style={styles.instructionBanner}>
          <View style={styles.instructionTopRow}>
            <MaterialIcons name="alarm" size={20} color={colors.secondary} />
            <Text style={styles.instructionMain}>
              Wyjdź: <Text style={styles.instructionTime}>{leaveStr}</Text>
              {crossMidnight ? ` (${leaveDateStr})` : ''}
              {' '}• Dotarcie: <Text style={styles.instructionTime}>{arriveStr}</Text>
            </Text>
          </View>
          <View style={styles.instructionBottomRow}>
            <Text style={styles.targetLabel}>Planowany termin: {targetStr} ({plan.date})</Text>
            <View style={[styles.safeBufferPill, departurePassed && styles.safeBufferPillPast]}>
              <View style={[styles.safeBufferDot, departurePassed && { backgroundColor: colors.error }]} />
              <Text style={[styles.safeBufferText, departurePassed && { color: colors.error }]}>
                {departurePassed ? 'Czas wyjścia już minął' : `+${spareMinutes} min bufor bezpieczeństwa`}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsBar}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Czas łączny</Text>
            <Text style={styles.statValue}>{totalDurationMin} min</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Pieszo</Text>
            <Text style={styles.statValue}>{totalWalkMin} min</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Przesiadki</Text>
            <Text style={[styles.statValue, styles.statValueAccent]}>
              {transfersCount === 0 ? '0 (bezpośr.)' : `${transfersCount}`}
            </Text>
          </View>
        </View>
      </View>

      {/* Interactive Vertical Stepper / Timeline */}
      <View style={styles.stepperCard}>
        <View style={styles.stepperHeader}>
          <Text accessibilityRole="header" style={styles.stepperTitle}>Krok po kroku od drzwi</Text>
          <View style={styles.strictPill}>
            <Text style={styles.strictPillText}>Własne godziny</Text>
          </View>
        </View>

        {/* STEP 1: Departure from Origin */}
        <View style={styles.stepRow}>
          <View style={styles.nodeCircleSecondary}>
            <MaterialIcons name="home" size={20} color={colors.onSecondaryContainer} />
          </View>
          <View style={styles.stepContent}>
            <View style={styles.stepHeaderRow}>
              <Text style={styles.stepTime}>
                {leaveStr}{crossMidnight ? ` (${leaveDateStr})` : ''}
              </Text>
              <View style={styles.stepTag}>
                <Text style={styles.stepTagText}>Punkt wyjścia</Text>
              </View>
            </View>
            <Text style={styles.stepTitle}>Wyjście: {originTitle}</Text>
            <Text style={styles.stepSub}>
              Kieruj się na przystanek {plan.fromStop?.label ?? 'początkowy'}
            </Text>
          </View>
        </View>

        {/* Walking leg 1 */}
        <DashedWalkTrack
          label={`Dojście na przystanek ${plan.fromStop?.label ?? ''}`}
          minutes={walkToMin}
        />

        {/* STEP 2: Transit & Transfer Legs */}
        {connection.legs.map((leg, idx) => {
          const legDep = new Date(leg.departure);
          const legArr = new Date(leg.arrival);
          const legDuration = Math.max(1, Math.round((legArr.getTime() - legDep.getTime()) / 60_000));

          if (leg.walking) {
            return (
              <DashedWalkTrack
                key={`walk-${idx}`}
                label={`${leg.label}: ${leg.from} → ${leg.to}`}
                minutes={legDuration}
                sublabel="wpisane przejście"
              />
            );
          }

          return (
            <View key={`ride-${idx}`}>
              <View style={styles.stepRow}>
                <View style={styles.nodeCircleTransit}>
                  <MaterialIcons name="tram" size={20} color={colors.onPrimaryContainer} />
                </View>
                <View style={styles.stepContent}>
                  <View style={styles.stepHeaderRow}>
                    <Text style={styles.stepTime}>{formatTime(legDep)}</Text>
                    <View style={styles.platformBadge}>
                      <Text style={styles.platformBadgeText}>Odjazd</Text>
                    </View>
                  </View>
                  <Text style={styles.stepTitle}>Przystanek {leg.from}</Text>
                  <Text style={styles.stepSub}>Wsiądź do pojazdu linii {leg.label}</Text>

                  <View style={styles.transitDetailBox}>
                    <View style={styles.transitBoxRow}>
                      <View style={styles.linePillLarge}>
                        <Text style={styles.linePillLargeText}>{extractLineCode(leg.label)}</Text>
                      </View>
                      <View style={styles.transitBoxCopy}>
                        <Text style={styles.transitLineName}>Linia {leg.label}</Text>
                        <Text style={styles.transitDirection}>do przystanku: {leg.to}</Text>
                      </View>
                    </View>
                    <View style={styles.transitMetaRow}>
                      <Text style={styles.transitDurationText}>{legDuration} min jazdy</Text>
                      <Text style={styles.transitDateText}>wysiadka o {formatTime(legArr)}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.trackRow}>
                <View style={styles.trackCol}>
                  <View style={styles.solidLine} />
                </View>
                <View style={styles.solidSpacer} />
              </View>
            </View>
          );
        })}

        {/* STEP 3: Alighting at Final Stop */}
        <View style={styles.stepRow}>
          <View style={styles.nodeCircleSecondary}>
            <MaterialIcons name="transfer-within-a-station" size={20} color={colors.onSecondaryContainer} />
          </View>
          <View style={styles.stepContent}>
            <View style={styles.stepHeaderRow}>
              <Text style={styles.stepTime}>{formatTime(result.stopArrival)}</Text>
              <View style={styles.stepTag}>
                <Text style={styles.stepTagText}>Przystanek końcowy</Text>
              </View>
            </View>
            <Text style={styles.stepTitle}>
              {plan.toStop?.label ?? 'Przystanek docelowy'}
            </Text>
            <Text style={styles.stepSub}>Koniec przejazdu komunikacją miejską</Text>
          </View>
        </View>

        {/* Walking leg 2 */}
        <DashedWalkTrack
          label={`Dojście z przystanku do: ${destTitle}`}
          minutes={walkFromMin}
        />

        {/* STEP 4: Destination Reached */}
        <View style={styles.stepRow}>
          <View style={styles.nodeCircleFinal}>
            <MaterialIcons name="flag" size={20} color={colors.onPrimary} />
          </View>
          <View style={styles.stepContentFinal}>
            <View style={styles.stepHeaderRow}>
              <Text style={styles.stepTime}>{arriveStr}</Text>
              <View style={styles.destTag}>
                <Text style={styles.destTagText}>Cel trasy</Text>
              </View>
            </View>
            <Text style={styles.stepTitle}>{destTitle}</Text>
            <Text style={styles.stepSub}>Planowana godzina obecności: {targetStr}</Text>

            <View style={styles.comfortBanner}>
              <View style={styles.comfortIconCircle}>
                <MaterialIcons name="sentiment-satisfied" size={18} color={colors.tertiary} />
              </View>
              <View style={styles.comfortCopy}>
                <Text style={styles.comfortTitle}>
                  {spareMinutes} min zapasu przed {targetStr}
                </Text>
                <Text style={styles.comfortSub}>
                  Uwzględniono {plan.bufferMinutes} min wymaganego buforu bezpieczeństwa.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export function PlanDayEditor({ store, onClose }: { store: StoredPlan; onClose: () => void }) {
  const router = useRouter();
  const {
    day, plan, selectedDate, selectDate, sourceDate, isSeries, hasEntry,
    updatePlan, updateDay, loading, saving, saved, save, remove, storageError, migrationNotice,
  } = store;
  const { settings, loading: settingsLoading, storageError: settingsError } = useStoredSettings();
  const [now, setNow] = useState(() => Date.now());
  const today = formatDate(new Date(now));
  const result = validatePlan(plan);
  const startPoint = settings.startPoints.find((point) =>
    point.name === plan.origin && point.walkMinutes === plan.walkToMinutes && JSON.stringify(point.stop) === JSON.stringify(plan.fromStop));
  const endPoint = settings.endPoints.find((point) =>
    point.name === plan.destination && point.walkMinutes === plan.walkFromMinutes && JSON.stringify(point.stop) === JSON.stringify(plan.toStop));
  const calculation = calculatePlan(plan);
  const selected = calculation.ok ? calculation.connection : null;
  const errors: PlanErrors = result.ok ? {} : result.errors;
  const canSave = calculation.ok && validDayDetails(day);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, []);

  function applyPoint(point: SavedPoint, start: boolean) {
    updatePlan(start ? 'origin' : 'destination', point.name);
    updatePlan(start ? 'fromStop' : 'toStop', point.stop);
    updatePlan(start ? 'walkToMinutes' : 'walkFromMinutes', point.walkMinutes);
    updatePlan('bufferMinutes', settings.bufferMinutes);
  }

  function openSettingsScreen() {
    Keyboard.dismiss();
    onClose();
    router.push('/settings');
  }

  if (loading || settingsLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.loading}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Wczytywanie planu" />
        <Text style={text.body}>Wczytuję Twój plan…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {/* Fixed Header matching Stitch Screen 2 with interactive day navigation */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderLeft}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Wróć do kalendarza"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={() => { Keyboard.dismiss(); onClose(); }}
            style={({ pressed }) => [styles.backCircle, (saving || pressed) && styles.buttonMuted]}
          >
            <MaterialIcons name="arrow-back" size={20} color={colors.onSurface} />
          </Pressable>
          <View style={styles.logoBadge}>
            <MaterialIcons name="tram" size={20} color={colors.primary} />
          </View>
          <View style={styles.topHeaderCopy}>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitle}>TravelPlanner</Text>
              <View style={styles.localBadge}>
                <Text style={styles.localBadgeText}>MOJE TRASY</Text>
              </View>
            </View>
            <Text style={styles.topHeaderSub}>Edytor • {selectedDate}</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Poprzedni dzień"
            disabled={saving}
            onPress={() => selectDate(shiftCalendarDate(selectedDate, -1))}
            style={({ pressed }) => [styles.dayStepCircle, pressed && styles.buttonMuted]}
          >
            <MaterialIcons name="chevron-left" size={18} color={colors.onSurface} />
          </Pressable>
          {selectedDate !== today && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Przejdź do dzisiaj"
              disabled={saving}
              onPress={() => selectDate(today)}
              style={({ pressed }) => [styles.todayChip, pressed && styles.buttonMuted]}
            >
              <Text style={styles.todayChipText}>Dziś</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Następny dzień"
            disabled={saving}
            onPress={() => selectDate(shiftCalendarDate(selectedDate, 1))}
            style={({ pressed }) => [styles.dayStepCircle, pressed && styles.buttonMuted]}
          >
            <MaterialIcons name="chevron-right" size={18} color={colors.onSurface} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Otwórz ustawienia punktów"
            disabled={saving}
            onPress={openSettingsScreen}
            style={({ pressed }) => [styles.profileCircle, pressed && styles.buttonMuted]}
          >
            <MaterialIcons name="tune" size={18} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {/* Header Banner / Context Card */}
          <View style={styles.contextBanner}>
            <View style={styles.contextCopy}>
              <View style={styles.contextEyebrowRow}>
                <MaterialIcons name="tune" size={18} color={colors.secondary} />
                <Text style={styles.contextEyebrow}>EDYTOR HARMONOGRAMU • {selectedDate}</Text>
              </View>
              <Text accessibilityRole="header" style={styles.contextTitle}>
                Skonfiguruj plan dojazdu
              </Text>
              <Text style={styles.contextSub}>
                Wpisz punkty trasy lub wybierz zapisane, określ termin i dodaj połączenie ręcznie.
              </Text>
            </View>
            <View style={styles.contextIconCircle}>
              <MaterialIcons name="edit-calendar" size={22} color={colors.primary} />
            </View>
          </View>

          {/* Route Parameters Form Card */}
          <View style={styles.formCard} pointerEvents={saving ? 'none' : 'auto'}>
            <View style={styles.formHeaderRow}>
              <Text accessibilityRole="header" style={styles.formSectionTitle}>Parametry trasy</Text>
              <Pressable
                accessibilityRole="button"
                onPress={openSettingsScreen}
                style={({ pressed }) => [styles.editBadge, pressed && styles.buttonMuted]}
              >
                <MaterialIcons name="pin-drop" size={13} color={colors.secondary} />
                <Text style={styles.editBadgeText}>Zapisane punkty ({settings.startPoints.length + settings.endPoints.length})</Text>
              </Pressable>
            </View>

            <FormField
              label="Nazwa planu (opcjonalnie)"
              icon="bookmark"
              value={day.name}
              maxLength={80}
              editable={!saving}
              placeholder="np. Dojazd do pracy (Zabłocie)"
              error={day.name.length > 80 ? 'Nazwa może mieć maksymalnie 80 znaków.' : undefined}
              onChangeText={(name) => updateDay({ name })}
            />

            {isSeries && (
              <View style={styles.seriesInfoBox}>
                <Text style={styles.seriesInfoText}>
                  ↻ To plan cykliczny od {sourceDate}. Zapisanie zmian zaktualizuje cały cykl.
                </Text>
              </View>
            )}

            {settingsError && <Text accessibilityLiveRegion="polite" style={text.error}>{settingsError}</Text>}

            {/* Origin-Destination Visual Axis */}
            <View style={styles.odAxisContainer}>
              <View style={styles.odVerticalLine} />
              <View style={styles.odItem}>
                <View style={[styles.odNodeDot, styles.odNodeStart]} />
                <SavedPointPicker
                  label="Początek (Start)"
                  icon="home"
                  iconColor={colors.secondary}
                  points={settings.startPoints}
                  selectedId={startPoint?.id ?? null}
                  currentName={plan.origin !== 'Dom' || plan.fromStop ? plan.origin : undefined}
                  currentStopLabel={plan.fromStop?.label}
                  currentWalkMinutes={plan.walkToMinutes}
                  onSelect={(point) => applyPoint(point, true)}
                  onOpenSettings={openSettingsScreen}
                />
              </View>
              <View style={styles.odItem}>
                <View style={[styles.odNodeDot, styles.odNodeEnd]} />
                <SavedPointPicker
                  label="Cel podróży"
                  icon="domain"
                  iconColor={colors.tertiary}
                  points={settings.endPoints}
                  selectedId={endPoint?.id ?? null}
                  currentName={plan.destination || undefined}
                  currentStopLabel={plan.toStop?.label}
                  currentWalkMinutes={plan.walkFromMinutes}
                  onSelect={(point) => applyPoint(point, false)}
                  onOpenSettings={openSettingsScreen}
                />
              </View>
            </View>

            {/* Target Time Selector in Dark Theme — supports both direct typing and +/- buttons */}
            <View style={styles.timeSection}>
              <Text style={styles.fieldEyebrow}>PLANOWANY CZAS DOTARCIA (GG:MM)</Text>
              <View style={[styles.timeHeroBox, errors.time && styles.timeHeroBoxInvalid]}>
                <View style={styles.timeHeroLeft}>
                  <Text style={styles.timeHeroCaption}>Godzina dotarcia na miejsce</Text>
                  <TextInput
                    value={plan.time}
                    editable={!saving}
                    maxLength={5}
                    keyboardType="numbers-and-punctuation"
                    placeholder="08:30"
                    placeholderTextColor={colors.outline}
                    accessibilityLabel="Godzina dotarcia na miejsce w formacie GG:MM"
                    onChangeText={(time) => updatePlan('time', time)}
                    style={styles.timeHeroInput}
                  />
                </View>
                <View style={styles.timeStepButtons}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Odejmij 15 minut"
                    disabled={saving}
                    onPress={() => updatePlan('time', stepWallTime(plan.time, -15))}
                    style={({ pressed }) => [styles.timeStepChip, pressed && styles.buttonMuted]}
                  >
                    <Text style={styles.timeStepChipText}>-15m</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Odejmij 5 minut"
                    disabled={saving}
                    onPress={() => updatePlan('time', stepWallTime(plan.time, -5))}
                    style={({ pressed }) => [styles.timeStepBtn, pressed && styles.buttonMuted]}
                  >
                    <MaterialIcons name="remove" size={20} color={colors.onSurface} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Dodaj 5 minut"
                    disabled={saving}
                    onPress={() => updatePlan('time', stepWallTime(plan.time, 5))}
                    style={({ pressed }) => [styles.timeStepBtn, pressed && styles.buttonMuted]}
                  >
                    <MaterialIcons name="add" size={20} color={colors.onSurface} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Dodaj 15 minut"
                    disabled={saving}
                    onPress={() => updatePlan('time', stepWallTime(plan.time, 15))}
                    style={({ pressed }) => [styles.timeStepChip, pressed && styles.buttonMuted]}
                  >
                    <Text style={styles.timeStepChipText}>+15m</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <RecurrenceFields
              value={day.recurrence}
              disabled={saving}
              isSeries={isSeries}
              selectedDate={selectedDate}
              onChange={(recurrence) => updateDay({ recurrence })}
            />

            {errors.date && <Text accessibilityLiveRegion="polite" style={text.error}>{errors.date}</Text>}
            {errors.time && <Text accessibilityLiveRegion="polite" style={text.error}>{errors.time}</Text>}
            {migrationNotice && <Text accessibilityLiveRegion="polite" style={text.body}>{migrationNotice}</Text>}
          </View>

          <ManualConnectionFields plan={plan} disabled={saving}
            error={!calculation.ok && 'message' in calculation ? calculation.message : undefined}
            onChange={(legs) => updatePlan('legs', legs)} />

          <DepartureCard plan={plan} now={now} />

          {/* Action Suite & Persistence Options */}
          <View style={styles.actionSuiteCard}>
            <View style={styles.selectedSummaryRow}>
              <Text style={styles.selectedSummaryText}>
                Wybrany kurs:{' '}
                <Text style={styles.selectedSummaryStrong}>
                  {selected
                    ? `${formatTime(new Date(selected.departure))} → ${formatTime(new Date(selected.arrival))}`
                    : 'Brak poprawnego połączenia'}
                </Text>
              </Text>
              <View style={styles.syncStatusRow}>
                <View style={[styles.syncDot, !canSave && { backgroundColor: colors.outline }]} />
                <Text style={[styles.syncStatusText, !canSave && { color: colors.onSurfaceVariant }]}>
                  {canSave ? 'Gotowe do zapisu' : 'Uzupełnij połączenie'}
                </Text>
              </View>
            </View>

            {!canSave && (
              <Text style={styles.saveHintText}>
                Aby zapisać dzień, uzupełnij punkty i godziny połączenia, tak aby dotrzeć na czas z wymaganym zapasem.
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: saving || !canSave, busy: saving }}
              disabled={saving || !canSave}
              onPress={() => {
                Keyboard.dismiss();
                void save().then((success) => { if (success) onClose(); });
              }}
              style={({ pressed }) => [styles.saveButton, (saving || !canSave || pressed) && styles.buttonMuted]}
            >
              <MaterialIcons name="save" size={20} color={colors.onPrimary} />
              <Text style={styles.saveButtonText}>
                {saving
                  ? 'Zapisuję…'
                  : isSeries && day.recurrence
                    ? 'Zapisz zmiany cyklu'
                    : 'Zapisz kurs w planie dnia'}
              </Text>
            </Pressable>

            {storageError && <Text accessibilityLiveRegion="polite" style={text.error}>{storageError}</Text>}
            {saved && <Text style={styles.saveStatus}>Plan tego dnia jest zapisany w kalendarzu.</Text>}

            {hasEntry && (
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                accessibilityState={{ disabled: saving }}
                onPress={() => {
                  Keyboard.dismiss();
                  void remove().then((success) => { if (success) onClose(); });
                }}
                style={({ pressed }) => [styles.removeButton, (saving || pressed) && styles.buttonMuted]}
              >
                <Text style={styles.removeButtonText}>
                  {isSeries ? 'Usuń cały cykl z kalendarza' : 'Usuń plan tego dnia'}
                </Text>
              </Pressable>
            )}
          </View>

          <View style={styles.guaranteeBox}>
            <MaterialIcons name="info-outline" size={20} color={colors.secondary} />
            <View style={styles.guaranteeCopy}>
              <Text style={styles.guaranteeTitle}>
                Połączenie i godziny wpisujesz samodzielnie.
              </Text>
              <Text style={styles.guaranteeSub}>
                Plan jest zapisany na urządzeniu i dostępny bez internetu.
              </Text>
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
  topHeader: {
    height: 64,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: 'rgba(13, 19, 32, 0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(66, 71, 84, 0.35)',
  },
  topHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderCopy: {
    flex: 1,
    gap: 1,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.primary,
  },
  localBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
  },
  localBadgeText: {
    fontFamily: fonts.clock,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: colors.secondary,
  },
  topHeaderSub: {
    fontFamily: fonts.clock,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dayStepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.primaryContainer,
  },
  todayChipText: {
    fontFamily: fonts.clock,
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
  profileCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 16,
    paddingBottom: 36,
    gap: 16,
  },
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.35)',
  },
  contextCopy: {
    flex: 1,
    gap: 2,
  },
  contextEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contextEyebrow: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: colors.secondary,
  },
  contextTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: colors.onSurface,
  },
  contextSub: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.onSurfaceVariant,
  },
  contextIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.35)',
    gap: 14,
    ...shadows.card,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formSectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.onSurface,
  },
  editBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
  },
  editBadgeText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondary,
  },
  seriesInfoBox: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.35)',
  },
  seriesInfoText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: colors.secondary,
  },
  odAxisContainer: {
    position: 'relative',
    paddingLeft: 24,
    gap: 12,
  },
  odVerticalLine: {
    position: 'absolute',
    left: 10,
    top: 22,
    bottom: 22,
    width: 2,
    backgroundColor: colors.primaryContainer,
  },
  odItem: {
    position: 'relative',
  },
  odNodeDot: {
    position: 'absolute',
    left: -19,
    top: 24,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2.5,
  },
  odNodeStart: {
    backgroundColor: colors.secondary,
    borderColor: colors.surface,
  },
  odNodeEnd: {
    backgroundColor: colors.tertiary,
    borderColor: colors.surface,
  },
  timeSection: {
    gap: 6,
  },
  fieldEyebrow: {
    fontFamily: fonts.clock,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.onSurfaceVariant,
  },
  timeHeroBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.35)',
  },
  timeHeroBoxInvalid: {
    borderColor: colors.error,
  },
  timeHeroLeft: {
    gap: 2,
  },
  timeHeroCaption: {
    fontFamily: fonts.clock,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  timeHeroInput: {
    fontFamily: fonts.clock,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.primary,
    paddingVertical: 2,
    minWidth: 96,
  },
  timeStepButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeStepBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeStepChip: {
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeStepChipText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondary,
  },
  emptyTimelineCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
  },
  emptyTimelineCopy: {
    flex: 1,
    gap: 4,
  },
  emptyTimelineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
  },
  emptyTimelineText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurfaceVariant,
  },
  detailsGroup: {
    gap: 14,
  },
  overviewCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.35)',
    gap: 12,
    ...shadows.hero,
  },
  overviewDecor: {
    position: 'absolute',
    right: -32,
    top: -32,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(77, 142, 255, 0.1)',
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  overviewTitleCol: {
    flex: 1,
    gap: 2,
  },
  overviewEyebrow: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.secondary,
  },
  overviewTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.onSurface,
  },
  manualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
  },
  manualBadgeText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  instructionBanner: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(77, 142, 255, 0.3)',
    gap: 8,
  },
  instructionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  instructionMain: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    color: colors.onSurface,
  },
  instructionTime: {
    fontFamily: fonts.clock,
    color: colors.primary,
    fontWeight: '700',
  },
  instructionBottomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  targetLabel: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  safeBufferPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 165, 114, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.35)',
  },
  safeBufferPillPast: {
    backgroundColor: colors.errorContainer,
    borderColor: colors.error,
  },
  safeBufferDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.tertiary,
  },
  safeBufferText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '600',
    color: colors.tertiary,
  },
  statsBar: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(26, 31, 45, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.25)',
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    fontFamily: fonts.clock,
    fontSize: 10,
    color: colors.onSurfaceVariant,
  },
  statValue: {
    fontFamily: fonts.clock,
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurface,
  },
  statValueAccent: {
    color: colors.secondary,
  },
  stepperCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.35)',
    ...shadows.card,
  },
  stepperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  stepperTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.onSurface,
  },
  strictPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.35)',
  },
  strictPillText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  nodeCircleSecondary: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.secondaryContainer,
    borderWidth: 2,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCircleTransit: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryContainer,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glowBlue,
  },
  nodeCircleFinal: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glowBlue,
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
    gap: 3,
  },
  stepContentFinal: {
    flex: 1,
    paddingTop: 2,
    gap: 4,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepTime: {
    fontFamily: fonts.clock,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  stepTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.35)',
  },
  stepTagText: {
    fontFamily: fonts.clock,
    fontSize: 10,
    color: colors.onSurfaceVariant,
  },
  platformBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(77, 142, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(173, 198, 255, 0.4)',
  },
  platformBadgeText: {
    fontFamily: fonts.clock,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  destTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(173, 198, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(173, 198, 255, 0.4)',
  },
  destTagText: {
    fontFamily: fonts.clock,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  stepTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.onSurface,
  },
  stepSub: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.onSurfaceVariant,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  trackCol: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedLine: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 4,
  },
  dashDot: {
    width: 3,
    height: 5,
    borderRadius: 2,
    backgroundColor: colors.outline,
  },
  solidLine: {
    flex: 1,
    width: 4,
    minHeight: 16,
    borderRadius: 2,
    backgroundColor: colors.primaryContainer,
  },
  solidSpacer: {
    flex: 1,
    height: 16,
  },
  walkPillWrap: {
    flex: 1,
    paddingVertical: 10,
  },
  walkMetaPill: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(26, 31, 45, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.28)',
  },
  walkMetaLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walkMetaLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  walkMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  walkMetaDuration: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurface,
  },
  walkMetaDot: {
    fontSize: 11,
    color: colors.outline,
  },
  walkMetaDist: {
    fontFamily: fonts.clock,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  transitDetailBox: {
    marginTop: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
    gap: 10,
  },
  transitBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  linePillLarge: {
    minWidth: 44,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linePillLargeText: {
    fontFamily: fonts.clock,
    fontSize: 16,
    fontWeight: '800',
    color: colors.onPrimaryContainer,
  },
  transitBoxCopy: {
    flex: 1,
    gap: 1,
  },
  transitLineName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurface,
  },
  transitDirection: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  transitMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(66, 71, 84, 0.35)',
  },
  transitDurationText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  transitDateText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    color: colors.secondary,
  },
  comfortBanner: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 165, 114, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.3)',
  },
  comfortIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 165, 114, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comfortCopy: {
    flex: 1,
    gap: 1,
  },
  comfortTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.tertiary,
  },
  comfortSub: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  actionSuiteCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.35)',
    gap: 12,
    ...shadows.card,
  },
  selectedSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectedSummaryText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  selectedSummaryStrong: {
    fontWeight: '700',
    color: colors.onSurface,
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.tertiary,
  },
  syncStatusText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '600',
    color: colors.tertiary,
  },
  saveHintText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.onSurfaceVariant,
  },
  saveButton: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    ...shadows.glowBlue,
  },
  saveButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  saveStatus: {
    fontSize: 13,
    color: colors.secondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  removeButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(255, 180, 171, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  removeButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '700',
  },
  guaranteeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(22, 27, 41, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.25)',
  },
  guaranteeCopy: {
    flex: 1,
    gap: 2,
  },
  guaranteeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  guaranteeSub: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.outline,
  },
  buttonMuted: {
    opacity: 0.65,
  },
});
