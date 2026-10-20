# TravelPlanner

Aplikacja mobilna w React Native, która oblicza, kiedy wyjść z domu, żeby dotrzeć
na uczelnię przed zajęciami. Expo SDK 58, TypeScript, Expo Router. Interfejs po polsku.

## Uruchomienie

Wymagania: Node.js 24 LTS i npm. Zainstaluj zależności i uruchom serwer Expo:

```sh
npm ci
npm start
```

Otwórz projekt na telefonie w Expo Go obsługującym SDK 58 albo uruchom emulator:

```sh
npm run android
npm run ios
npm run web
```

Android wymaga skonfigurowanego emulatora Android Studio; symulator iOS wymaga
macOS i Xcode. Podgląd web otwiera tę samą aplikację w przeglądarce.

## Pierwsza wersja

- Wpisz miejsce wyjścia, budynek lub salę, datę i godzinę zajęć.
- Podaj czas całej drogi, łącznie z dojściem i oczekiwaniem, oraz dodatkowy zapas.
- Godzina wyjścia i oś podróży aktualizują się podczas edycji.
- Przycisk „Zapisz plan” zachowuje jeden plan lokalnie na urządzeniu.
- Aplikacja obsługuje wyjście poprzedniego dnia, błędne daty i ostrzega o minionych terminach.

Przykład: zajęcia o **09:00**, dojazd **35 min**, zapas **10 min** → wyjście
o **08:15**, dotarcie na miejsce o **08:50**.

Daty wpisuj jako `DD.MM.RRRR`, godziny jako `HH:mm`. Dojazd: 1–720 min, zapas:
0–180 min. Obliczenia używają strefy czasowej telefonu. Zmiana strefy oznacza
ponowne zinterpretowanie zapisanej daty i godziny w nowej strefie.

## Zakres i dalszy rozwój

Czas dojazdu jest wpisywany ręcznie. Miejsca są etykietami; aplikacja nie wyznacza
tras, nie sprawdza rozkładów ani korków i nie wysyła przypomnień. Nie wymaga
backendu, kluczy API, logowania ani uprawnień do lokalizacji. Plan jest zapisany
w nieszyfrowanym AsyncStorage i nie jest wysyłany do serwera.

Kolejne możliwe kroki: ulubione miejsca i wiele planów, integracja z dostawcą
tras lub transportu publicznego, lokalne przypomnienia o wyjściu.

Opis modułów i przepływu danych: [ARCHITECTURE.md](ARCHITECTURE.md).
Dokumentacja użytego środowiska: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/).

## Weryfikacja

Zgodnie z instrukcją projektu podczas przygotowania bazy nie uruchamiano testów,
lintowania, sprawdzania typów, buildu ani aplikacji. Kod przejrzano ręcznie;
działanie na telefonie i w przeglądarce wymaga jeszcze sprawdzenia.
