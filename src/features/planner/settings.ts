import { isRecord, isStop, KRAKOW_CITY, type TransitStop } from '../transit/contract';
import { validMinutes } from './plan';

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
