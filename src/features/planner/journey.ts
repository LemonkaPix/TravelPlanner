import { isLabel, isRecord, parseDateTime } from './dateTime';

export type Stop = { label: string };
export type ManualLeg = {
  label: string;
  from: string;
  to: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  walking: boolean;
};
export type JourneyLeg = {
  label: string; from: string; to: string; departure: string; arrival: string; walking: boolean;
};
export type ManualConnection = { departure: string; arrival: string; legs: JourneyLeg[] };

export function isStop(value: unknown): value is Stop {
  return isRecord(value) && isLabel(value.label);
}

export function localStop(value: unknown): Stop | null {
  if (!isStop(value)) return null;
  const code = 'code' in value && typeof value.code === 'string' ? value.code : '';
  return { label: `${value.label}${code ? ` (${code})` : ''}` };
}

export function createManualLeg(date: string, from = '', to = ''): ManualLeg {
  return { label: '', from, to, departureDate: date, departureTime: '', arrivalDate: date, arrivalTime: '', walking: false };
}

export function resolveConnection(value: unknown): { connection: ManualConnection | null; error?: string } {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    return { connection: null, error: 'Dodaj od 1 do 20 odcinków połączenia.' };
  }
  const legs: JourneyLeg[] = [];
  for (const [index, leg] of value.entries()) {
    const prefix = `Odcinek ${index + 1}: `;
    if (!isRecord(leg) || !isLabel(leg.label) || !isLabel(leg.from) || !isLabel(leg.to) || typeof leg.walking !== 'boolean') {
      return { connection: null, error: `${prefix}wpisz linię lub opis przejścia oraz oba przystanki (do 240 znaków).` };
    }
    if (![leg.departureDate, leg.departureTime, leg.arrivalDate, leg.arrivalTime].every((field) => typeof field === 'string')) {
      return { connection: null, error: `${prefix}uzupełnij daty i godziny.` };
    }
    const departure = parseDateTime(leg.departureDate as string, leg.departureTime as string);
    const arrival = parseDateTime(leg.arrivalDate as string, leg.arrivalTime as string);
    if (!departure || !arrival) return { connection: null, error: `${prefix}podaj poprawne daty DD.MM.RRRR i godziny GG:MM. Godziny przy zmianie czasu muszą być jednoznaczne.` };
    const previous = legs.at(-1);
    if (arrival <= departure || (previous && departure.getTime() < Date.parse(previous.arrival))) {
      return { connection: null, error: `${prefix}przyjazd musi być po odjeździe, a odjazd nie wcześniej niż koniec poprzedniego odcinka.` };
    }
    if (previous && previous.to.trim() !== leg.from.trim()) {
      return { connection: null, error: `${prefix}zacznij na przystanku kończącym poprzedni odcinek lub dodaj odcinek pieszy między przystankami.` };
    }
    legs.push({ label: leg.label, from: leg.from, to: leg.to, walking: leg.walking, departure: departure.toISOString(), arrival: arrival.toISOString() });
  }
  if (legs[0].walking || legs[legs.length - 1].walking) {
    return { connection: null, error: 'Pierwszy i ostatni odcinek powinny być przejazdem. Dojścia do i z przystanku ustaw w parametrach trasy.' };
  }
  return { connection: { departure: legs[0].departure, arrival: legs[legs.length - 1].arrival, legs } };
}
