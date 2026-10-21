import { isRecord, isStop, KRAKOW_CITY, type TransitStop } from '../transit/contract';
import { validMinutes } from './plan';
import type { CalendarDays } from './calendar';

export type PointDraft = { name: string; stop: TransitStop | null; walkMinutes: string };
export type SavedPoint = PointDraft & { id: string; stop: TransitStop };
export type PointList = 'startPoints' | 'endPoints';
export type PlannerSettings = {
  startPoints: SavedPoint[];
  endPoints: SavedPoint[];
  bufferMinutes: string;
};

export function createDefaultSettings(): PlannerSettings {
  return { startPoints: [], endPoints: [], bufferMinutes: '10' };
}

export function validatePoint(input: PointDraft) {
  const errors: Partial<Record<keyof PointDraft, string>> = {};
  if (!input.name.trim() || input.name.length > 120) errors.name = 'Wpisz nazwę punktu (do 120 znaków).';
  if (!isStop(input.stop) || input.stop.cityId !== KRAKOW_CITY.id) errors.stop = 'Wybierz przystanek ZTP Kraków z listy.';
  if (!validMinutes(input.walkMinutes)) errors.walkMinutes = 'Wpisz od 0 do 180 minut.';
  return errors;
}

function isSavedPoint(value: unknown): value is SavedPoint {
  return isRecord(value) && typeof value.id === 'string' && value.id.trim().length > 0 && value.id.length <= 120 &&
    typeof value.name === 'string' && typeof value.walkMinutes === 'string' && isStop(value.stop) &&
    Object.keys(validatePoint(value as SavedPoint)).length === 0;
}

export function isPlannerSettings(value: unknown): value is PlannerSettings {
  if (!isRecord(value) || typeof value.bufferMinutes !== 'string' || !validMinutes(value.bufferMinutes) ||
      !Array.isArray(value.startPoints) || !Array.isArray(value.endPoints) ||
      !value.startPoints.every(isSavedPoint) || !value.endPoints.every(isSavedPoint)) return false;
  const ids = [...value.startPoints, ...value.endPoints].map((point) => point.id);
  return new Set(ids).size === ids.length;
}

export function settingsWithPlanPoints(settings: PlannerSettings, days: CalendarDays): PlannerSettings {
  const snapshot = { ...settings, startPoints: [...settings.startPoints], endPoints: [...settings.endPoints] };
  const ids = new Set([...snapshot.startPoints, ...snapshot.endPoints].map((point) => point.id));
  let sequence = 0;
  for (const { plan } of Object.values(days)) {
    for (const list of ['startPoints', 'endPoints'] as const) {
      const start = list === 'startPoints';
      const name = start ? plan.origin : plan.destination;
      const stop = start ? plan.fromStop : plan.toStop;
      const walkMinutes = start ? plan.walkToMinutes : plan.walkFromMinutes;
      if (!stop || snapshot[list].some((point) => point.name === name && point.walkMinutes === walkMinutes &&
          JSON.stringify(point.stop) === JSON.stringify(stop))) continue;
      let id: string;
      do { id = `import-${sequence++}`; } while (ids.has(id));
      ids.add(id);
      snapshot[list].push({ id, name, stop, walkMinutes });
    }
  }
  return snapshot;
}
