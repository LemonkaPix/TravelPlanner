import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { createDefaultPlan, isStoredPlan, type PlanInput } from './plan';

const STORAGE_KEY = 'travelplanner.plan.v1';

export function useStoredPlan() {
  const [plan, setPlan] = useState(createDefaultPlan);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedPlan, setSavedPlan] = useState<PlanInput | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active || raw === null) return;
        const stored: unknown = JSON.parse(raw);
        if (!isStoredPlan(stored)) throw new Error('Invalid stored plan');
        setPlan(stored);
        setSavedPlan(stored);
      } catch {
        if (active) setStorageError('Nie udało się odczytać planu. Możesz ułożyć i zapisać nowy.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function save() {
    if (loading || saving || !isStoredPlan(plan)) return;
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
      setSavedPlan(plan);
      setStorageError(null);
    } catch {
      setStorageError('Nie udało się zapisać planu. Spróbuj ponownie przyciskiem „Zapisz plan”.');
    } finally {
      setSaving(false);
    }
  }

  function updatePlan(key: keyof PlanInput, value: string) {
    setPlan((previous) => ({ ...previous, [key]: value }));
  }

  const saved = savedPlan !== null && JSON.stringify(savedPlan) === JSON.stringify(plan);
  return { plan, updatePlan, loading, saving, saved, save, storageError };
}
