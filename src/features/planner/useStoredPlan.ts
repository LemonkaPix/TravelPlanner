import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  calendarEntry, createCalendarDay, isStoredCalendar, migrateCalendar, moveCalendarDay, validDayDetails,
  type CalendarDay, type CalendarDays,
} from './calendar';
import { formatDate, isStoredPlan, calculatePlan, migratePreviousPlan, type PlanInput } from './plan';
import { importableDays } from './planTransfer';
import { useStoredSettings } from './StoredSettingsProvider';

const STORAGE_KEY = 'travelplanner.calendar.v3';

function useStoredPlanState() {
  const { addPlanPoints, settings } = useStoredSettings();
  const [selectedDate, selectDate] = useState(() => formatDate(new Date()));
  const [drafts, setDrafts] = useState<CalendarDays>({});
  const [savedDays, setSavedDays] = useState<CalendarDays>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveInProgress = useRef(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);
  const emptyDay = useMemo(() => {
    const empty = createCalendarDay(selectedDate);
    return { ...empty, plan: { ...empty.plan, bufferMinutes: settings.bufferMinutes } };
  }, [selectedDate, settings.bufferMinutes]);
  const entry = useMemo(() => calendarEntry(savedDays, selectedDate), [savedDays, selectedDate]);
  const day = drafts[selectedDate] ?? entry?.day ?? emptyDay;

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active) return;
        if (raw !== null) {
          const stored: unknown = JSON.parse(raw);
          if (!isStoredCalendar(stored)) throw new Error('Invalid calendar');
          setSavedDays(stored);
          return;
        }
        const previousCalendar = await AsyncStorage.getItem('travelplanner.calendar.v2') ?? await AsyncStorage.getItem('travelplanner.calendar.v1');
        if (!active) return;
        if (previousCalendar !== null) {
          const migrated = migrateCalendar(JSON.parse(previousCalendar));
          if (!migrated) throw new Error('Invalid previous calendar');
          setSavedDays(migrated);
          setMigrationNotice('Wczytano poprzedni kalendarz. Uzupełnij ręcznie linie i godziny połączeń w zapisanych planach.');
          return;
        }
        for (const key of ['travelplanner.plan.v3', 'travelplanner.plan.v2', 'travelplanner.plan.v1']) {
          const previous = await AsyncStorage.getItem(key);
          if (!active) return;
          if (previous === null) continue;
          const value: unknown = JSON.parse(previous);
          const plan = migratePreviousPlan(value);
          if (!plan) throw new Error('Invalid previous plan');
          const migrated = { ...createCalendarDay(plan.date), plan };
          if (isStoredPlan(plan)) setSavedDays({ [plan.date]: migrated });
          else setDrafts({ [plan.date]: migrated });
          selectDate(plan.date);
          setMigrationNotice('Przeniesiono poprzedni plan do kalendarza. Otwórz jego dzień, sprawdź punkty i godzinę, a następnie zapisz.');
          return;
        }
      } catch {
        if (active) setStorageError('Nie udało się odczytać kalendarza. Zachowano zapisane dane. Zapisanie planu zastąpi poprzedni kalendarz.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function persist(remove: boolean): Promise<boolean> {
    if (loading || saveInProgress.current || (!remove && (!calculatePlan(day.plan).ok || !validDayDetails(day)))) return false;
    const date = selectedDate;
    const sourceDate = entry?.sourceDate ?? date;
    const snapshot = { ...savedDays };
    delete snapshot[sourceDate];
    if (!remove) {
      const anchorDate = day.recurrence ? sourceDate : date;
      snapshot[anchorDate] = moveCalendarDay({ ...day, name: day.name.trim() }, anchorDate);
      if (!isStoredCalendar(snapshot)) {
        setStorageError('Nie można zapisać cyklu z tą godziną w jego dniu początkowym. Sprawdź godzinę przy zmianie czasu.');
        return false;
      }
    }
    saveInProgress.current = true;
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      setSavedDays(snapshot);
      setDrafts((previous) => {
        if (previous[date] && previous[date] !== day) return previous;
        const next = { ...previous };
        delete next[date];
        return next;
      });
      setStorageError(null);
      setMigrationNotice(null);
      return true;
    } catch {
      setStorageError('Nie udało się zapisać kalendarza. Twoje zmiany pozostają na ekranie. Spróbuj ponownie.');
      return false;
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  }

  function updateDay(patch: Partial<CalendarDay>) {
    if (loading || saveInProgress.current) return;
    setDrafts((previous) => ({ ...previous, [selectedDate]: { ...(previous[selectedDate] ?? day), ...patch } }));
  }

  async function importDays(incoming: CalendarDays): Promise<number | null> {
    if (loading || saveInProgress.current || !isStoredCalendar(incoming)) return null;
    const additions = importableDays(incoming, savedDays, drafts);
    const count = Object.keys(additions).length;
    if (count === 0) return 0;
    const snapshot = { ...savedDays, ...additions };
    saveInProgress.current = true;
    setSaving(true);
    try {
      if (!await addPlanPoints(additions)) {
        setStorageError('Nie udało się dodać punktów importowanych planów. Kalendarz pozostał bez zmian. Spróbuj ponownie.');
        return null;
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      setSavedDays(snapshot);
      setStorageError(null);
      setMigrationNotice(null);
      return count;
    } catch {
      setStorageError('Nie udało się zaimportować kalendarza. Dotychczasowe plany i szkice zachowano. Dodane punkty mogły pozostać w ustawieniach; możesz ponowić import.');
      return null;
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  }

  function updatePlan<K extends keyof PlanInput>(key: K, value: PlanInput[K]) {
    if (loading || saveInProgress.current) return;
    setDrafts((previous) => {
      const current = previous[selectedDate] ?? day;
      if (current.plan[key] === value) return previous;
      const plan = { ...current.plan, [key]: value };
      if (key === 'fromStop' || key === 'toStop') {
        plan.legs = plan.legs.map((leg, index) => ({ ...leg,
          from: index === 0 ? plan.fromStop?.label ?? '' : leg.from,
          to: index === plan.legs.length - 1 ? plan.toStop?.label ?? '' : leg.to,
        }));
      }
      return { ...previous, [selectedDate]: { ...current, plan } };
    });
  }

  const saved = !!entry && JSON.stringify(entry.day) === JSON.stringify(day);
  return {
    day, plan: day.plan, drafts, savedDays, selectedDate, selectDate,
    sourceDate: entry?.sourceDate ?? selectedDate, hasEntry: !!entry || !!drafts[selectedDate],
    isSeries: !!entry?.day.recurrence,
    updatePlan, updateDay, importDays, loading, saving, saved,
    save: () => persist(false), remove: () => persist(true), storageError, migrationNotice,
  };
}

export type StoredPlan = ReturnType<typeof useStoredPlanState>;

const PlanContext = createContext<StoredPlan | null>(null);

export function StoredPlanProvider({ children }: { children: ReactNode }) {
  const value = useStoredPlanState();
  return createElement(PlanContext.Provider, { value }, children);
}

export function useStoredPlan(): StoredPlan {
  const context = useContext(PlanContext);
  if (!context) throw new Error('useStoredPlan requires StoredPlanProvider');
  return context;
}
