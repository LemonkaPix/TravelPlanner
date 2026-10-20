import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { createDefaultSettings, isPlannerSettings, type PlannerSettings } from './settings';

const STORAGE_KEY = 'travelplanner.settings.v1';
type StoredSettings = {
  settings: PlannerSettings;
  loading: boolean;
  saving: boolean;
  storageError: string | null;
  saveSettings: (snapshot: PlannerSettings) => Promise<boolean>;
};
const SettingsContext = createContext<StoredSettings | null>(null);

export function StoredSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(createDefaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const saveInProgress = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active || raw === null) return;
        const stored: unknown = JSON.parse(raw);
        if (!isPlannerSettings(stored)) throw new Error('Invalid stored settings');
        setSettings(stored);
      } catch {
        if (active) setStorageError('Nie udało się odczytać ustawień. Zachowano zapisane dane. Zapisanie nowych ustawień zastąpi poprzedni wpis.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function saveSettings(snapshot: PlannerSettings): Promise<boolean> {
    if (loading || saveInProgress.current) return false;
    if (!isPlannerSettings(snapshot)) {
      setStorageError('Ustawienia są niepoprawne. Sprawdź nazwy, przystanki i minuty (0–180).');
      return false;
    }
    saveInProgress.current = true;
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      setSettings(snapshot);
      setStorageError(null);
      return true;
    } catch {
      setStorageError('Nie udało się zapisać ustawień. Spróbuj ponownie.');
      return false;
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, saving, storageError, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useStoredSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useStoredSettings requires StoredSettingsProvider');
  return context;
}
