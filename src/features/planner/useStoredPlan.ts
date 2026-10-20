import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

import { createDefaultPlan, isStoredPlan, migrateJakdojadePlan, migrateLegacyPlan, type PlanInput } from './plan';

const STORAGE_KEY = 'travelplanner.plan.v3';
const PREVIOUS_KEY = 'travelplanner.plan.v2';
const LEGACY_KEY = 'travelplanner.plan.v1';

export function useStoredPlan() {
  const [plan, setPlan] = useState(createDefaultPlan);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveInProgress = useRef(false);
  const [savedPlan, setSavedPlan] = useState<PlanInput | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active) return;
        if (raw !== null) {
          const stored: unknown = JSON.parse(raw);
          if (!isStoredPlan(stored)) throw new Error('Invalid stored plan');
          setPlan(stored);
          setSavedPlan(stored);
        } else {
          const previous = await AsyncStorage.getItem(PREVIOUS_KEY);
          if (!active) return;
          if (previous !== null) {
            const migrated = migrateJakdojadePlan(JSON.parse(previous));
            if (!migrated) throw new Error('Invalid previous plan');
            setPlan(migrated);
            setMigrationNotice('Wczytano konfigurację poprzedniego planu. Korzystamy teraz z rozkładów ZTP Kraków. Wybierz ponownie oba przystanki i zapisz plan.');
            return;
          }
          const legacy = await AsyncStorage.getItem(LEGACY_KEY);
          if (!active || legacy === null) return;
          const migrated = migrateLegacyPlan(JSON.parse(legacy));
          if (!migrated) throw new Error('Invalid legacy plan');
          setPlan(migrated);
          setMigrationNotice('Wczytano poprzedni plan. Wybierz oba przystanki w Krakowie lub okolicy, sprawdź czasy dojścia i zapisz ponownie.');
        }
      } catch {
        if (active) setStorageError('Nie udało się odczytać planu. Zachowano zapisane dane. Możesz ułożyć i zapisać nowy plan.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function save() {
    if (loading || saveInProgress.current || !isStoredPlan(plan)) return;
    saveInProgress.current = true;
    setSaving(true);
    const snapshot = plan;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      setSavedPlan(snapshot);
      setStorageError(null);
      setMigrationNotice(null);
    } catch {
      setStorageError('Nie udało się zapisać planu. Spróbuj ponownie przyciskiem „Zapisz plan”.');
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  }

  function updatePlan<K extends keyof PlanInput>(key: K, value: PlanInput[K]) {
    setPlan((previous) => ({ ...previous, [key]: value }));
  }

  const saved = savedPlan !== null && JSON.stringify(savedPlan) === JSON.stringify(plan);
  return { plan, updatePlan, loading, saving, saved, save, storageError, migrationNotice };
}
