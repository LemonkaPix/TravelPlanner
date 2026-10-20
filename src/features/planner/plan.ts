export type PlanInput = {
  origin: string;
  destination: string;
  date: string;
  time: string;
  travelMinutes: string;
  bufferMinutes: string;
};

export type PlanErrors = Partial<Record<keyof PlanInput, string>>;

const pad = (value: number) => String(value).padStart(2, '0');

export function formatDate(date: Date): string {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function createDefaultPlan(): PlanInput {
  const now = new Date();
  const arrival = new Date(now);
  arrival.setHours(9, 0, 0, 0);
  // Leave at least the default 45 minutes for today's journey.
  if (arrival.getTime() - 45 * 60_000 <= now.getTime()) {
    arrival.setDate(arrival.getDate() + 1);
  }
  return {
    origin: 'Dom',
    destination: '',
    date: formatDate(arrival),
    time: '09:00',
    travelMinutes: '35',
    bufferMinutes: '10',
  };
}

function parseDate(value: string): Date | null {
  const match = /^(\d{2})\.(\d{2})\.(20\d{2})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function validMinutes(value: string, min: number, max: number): boolean {
  return /^\d{1,3}$/.test(value) && Number(value) >= min && Number(value) <= max;
}

export function calculatePlan(input: PlanInput) {
  const errors: PlanErrors = {};
  if (!input.origin.trim() || input.origin.length > 120) {
    errors.origin = 'Wpisz miejsce wyjścia (do 120 znaków).';
  }
  if (!input.destination.trim() || input.destination.length > 120) {
    errors.destination = 'Wpisz miejsce zajęć (do 120 znaków).';
  }
  const arrival = parseDate(input.date);
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(input.time);
  if (!arrival) errors.date = 'Podaj poprawną datę: DD.MM.RRRR (2000–2099).';
  if (!validTime) errors.time = 'Podaj godzinę od 00:00 do 23:59.';
  if (!validMinutes(input.travelMinutes, 1, 720)) {
    errors.travelMinutes = 'Wpisz od 1 do 720 minut.';
  }
  if (!validMinutes(input.bufferMinutes, 0, 180)) {
    errors.bufferMinutes = 'Wpisz od 0 do 180 minut.';
  }
  if (arrival && validTime) {
    const [hours, minutes] = input.time.split(':').map(Number);
    arrival.setHours(hours, minutes, 0, 0);
    if (arrival.getHours() !== hours || arrival.getMinutes() !== minutes) {
      errors.time = 'Ta godzina nie istnieje w dniu zmiany czasu. Wybierz inną.';
    }
  }
  if (!arrival || Object.keys(errors).length > 0) return { ok: false as const, errors };
  const travelMinutes = Number(input.travelMinutes);
  const bufferMinutes = Number(input.bufferMinutes);
  const campusArrival = new Date(arrival.getTime() - bufferMinutes * 60_000);
  const departure = new Date(campusArrival.getTime() - travelMinutes * 60_000);
  return { ok: true as const, arrival, campusArrival, departure, travelMinutes, bufferMinutes };
}

export function isStoredPlan(value: unknown): value is PlanInput {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const keys: (keyof PlanInput)[] = [
    'origin', 'destination', 'date', 'time', 'travelMinutes', 'bufferMinutes',
  ];
  return keys.every((key) => typeof record[key] === 'string') && calculatePlan(value as PlanInput).ok;
}
