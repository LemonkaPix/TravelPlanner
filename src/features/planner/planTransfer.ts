import { isRecord } from '../transit/contract';
import { isStoredCalendar, type CalendarDays } from './calendar';

export const MAX_PLAN_FILE_BYTES = 8_000_000;
const MAX_PLAN_FILE_CHARACTERS = 2_000_000;

export class PlanTransferError extends Error {}

export function serializePlans(days: CalendarDays): string {
  if (!isStoredCalendar(days)) throw new PlanTransferError('Nie można wyeksportować niepoprawnych planów.');
  const content = JSON.stringify({ format: 'travelplanner-plans', version: 1, days }, null, 2);
  checkContentSize(content);
  return content;
}

function checkContentSize(content: string) {
  if (content.length > MAX_PLAN_FILE_CHARACTERS) throw new PlanTransferError('Plik zawiera zbyt dużo danych.');
}

export function parsePlans(content: string): CalendarDays {
  checkContentSize(content);
  let value: unknown;
  try {
    value = JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch {
    throw new PlanTransferError('Niepoprawny plik JSON. Wybierz plik wyeksportowany z TravelPlanner.');
  }
  if (!isRecord(value) || value.format !== 'travelplanner-plans') {
    throw new PlanTransferError('To nie jest plik planów TravelPlanner.');
  }
  if (value.version !== 1) throw new PlanTransferError('Nieobsługiwana wersja pliku. Zaktualizuj aplikację i spróbuj ponownie.');
  if (!isStoredCalendar(value.days)) throw new PlanTransferError('Plik zawiera niepoprawne lub niekompletne plany. Nie zaimportowano żadnych danych.');
  return value.days;
}

export function importableDays(incoming: CalendarDays, saved: CalendarDays, drafts: CalendarDays): CalendarDays {
  return Object.fromEntries(Object.entries(incoming).filter(([date]) => !Object.hasOwn(saved, date) && !Object.hasOwn(drafts, date)));
}

export function planFileName(): string {
  return `travelplanner-plany-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
}
