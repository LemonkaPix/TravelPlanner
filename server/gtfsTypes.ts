import type { TransitStop } from '../src/features/transit/contract.ts';

export type StopTime = {
  stop: string; sequence: number; arrival: number; departure: number;
  pickup: boolean; dropoff: boolean;
};
export type Trip = { id: string; service: string; label: string; times: StopTime[] };
export type Calendar = { start: string; end: string; weekdays: boolean[] };
export type Feed = {
  id: string;
  calendars: Map<string, Calendar>;
  exceptions: Map<string, Map<string, boolean>>;
  trips: Trip[];
  firstDate: string;
  lastDate: string;
};
export type Footpath = { from: string; to: string; seconds: number };
export type TransferRule = { from: string; to: string; minimum: number; prohibited: boolean };
export type Timetable = {
  stops: Map<string, TransitStop>;
  feeds: Feed[];
  rules: TransferRule[];
  downloadedAt: number;
};
