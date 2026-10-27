import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { systemAlarmDateIssue, type PlannedAlarm } from './alarms';

export const systemAlarmSupported = Platform.OS === 'android';
export const systemAlarmLimitation = Platform.OS === 'ios'
  ? 'iOS nie udostępnia tej aplikacji dodawania budzików do systemowego Zegara. Ustaw poniższe godziny ręcznie w Zegarze.'
  : 'W przeglądarce nie można dodać budzików do systemowego Zegara. Ustaw poniższe godziny ręcznie lub użyj aplikacji na Androidzie.';

// expoVersion identifies Expo Go specifically. In SDK 58, StoreClient also
// includes development builds, which can declare our SET_ALARM permission.
export const systemAlarmCreationIssue = !systemAlarmSupported ? systemAlarmLimitation
  : typeof Constants.expoVersion === 'string'
    ? 'Ustawianie budzików wymaga własnej wersji TravelPlanner na Androida. Expo Go nie otrzymuje uprawnienia do budzików z konfiguracji projektu. Do tego czasu otwórz Zegar i ustaw pokazane godziny ręcznie.'
    : null;

let handoffInProgress = false;

function clockErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/com\.android\.alarm\.permission\.SET_ALARM|Permission Denial|SecurityException/i.test(message)) {
    return 'Zainstalowana wersja aplikacji nie ma uprawnienia do ustawiania budzików. Zbuduj i zainstaluj ponownie TravelPlanner z aktualną konfiguracją; samo przeładowanie aplikacji nie wystarczy.';
  }
  if (/Cannot find native module.*ExpoIntentLauncher|IntentLauncher.*not available/i.test(message)) {
    return 'Ta wersja aplikacji nie zawiera obsługi systemowego Zegara. Zbuduj i zainstaluj ponownie TravelPlanner z aktualnymi zależnościami.';
  }
  if (/No Activity found|ActivityNotFoundException|unable to resolve Intent/i.test(message)) {
    return 'Nie znaleziono aplikacji obsługującej tę funkcję Zegara. Zainstaluj lub włącz aplikację Zegar.';
  }
  if (message.startsWith('Godzina') || message.startsWith('Zegar przyjmuje')) return message;
  return 'System nie pozwolił otworzyć Zegara. Spróbuj ponownie lub otwórz go ręcznie.';
}

export async function sendSystemAlarms(alarms: PlannedAlarm[], name: string): Promise<string> {
  if (systemAlarmCreationIssue) throw new Error(systemAlarmCreationIssue);
  if (handoffInProgress) throw new Error('Trwa przekazywanie budzików do Zegara. Poczekaj na zakończenie.');
  const issue = systemAlarmDateIssue(alarms, Date.now());
  if (issue) throw new Error(issue);
  handoffInProgress = true;
  let sent = 0;
  try {
    // Load only on Android. Expo converts numeric extras to the native Int
    // required by AlarmClock; React Native Linking.sendIntent sends Doubles.
    const { startActivityAsync } = await import('expo-intent-launcher');
    for (const alarm of alarms) {
      const currentIssue = systemAlarmDateIssue([alarm], Date.now());
      if (currentIssue) throw new Error(currentIssue);
      await startActivityAsync('android.intent.action.SET_ALARM', {
        extra: {
          'android.intent.extra.alarm.HOUR': alarm.date.getHours(),
          'android.intent.extra.alarm.MINUTES': alarm.date.getMinutes(),
          'android.intent.extra.alarm.MESSAGE': `TravelPlanner · ${name} · ${alarm.label}`,
          'android.intent.extra.alarm.VIBRATE': true,
          'android.intent.extra.alarm.SKIP_UI': true,
        },
      });
      sent += 1;
    }
    // SET_ALARM provides no reliable confirmation or IDs to manage afterwards.
    return `Przekazano do Zegara: ${sent}. Sprawdź, czy budziki są włączone i mają właściwy dźwięk. Zmienisz je lub usuniesz w Zegarze.`;
  } catch (error) {
    throw new Error(`Nie udało się przekazać wszystkich budzików. Przekazano: ${sent} z ${alarms.length}. ${clockErrorMessage(error)} Sprawdź budziki w Zegarze przed ponowną próbą.`);
  } finally {
    handoffInProgress = false;
  }
}

export async function openSystemAlarms(): Promise<void> {
  if (!systemAlarmSupported) throw new Error(systemAlarmLimitation);
  if (handoffInProgress) throw new Error('Poczekaj na zakończenie przekazywania budzików.');
  handoffInProgress = true;
  try {
    const { startActivityAsync } = await import('expo-intent-launcher');
    await startActivityAsync('android.intent.action.SHOW_ALARMS');
  } catch (error) {
    throw new Error(clockErrorMessage(error));
  } finally {
    handoffInProgress = false;
  }
}
