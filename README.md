# TravelPlanner

Lokalny planer dojazdów z ręcznym dodawaniem połączeń. React Native 0.88,
Expo SDK 58, TypeScript i Expo Router. Interfejs po polsku.

## Uruchomienie

Zainstaluj zależności i uruchom Expo (Node.js 24.3+):

```sh
npm ci
npm start
```

Dostępne są też `npm run android`, `npm run ios` oraz `npm run web`.
Aplikacja nie wymaga backendu, konfiguracji adresu API ani danych ZTP.

## Dodawanie planu

1. Wybierz dzień w kalendarzu lub otwórz zakładkę Edytor.
2. Wpisz miejsce wyjścia i cel, nazwy przystanków oraz czasy dojścia.
   Możesz też wybrać punkty wcześniej dodane w Ustawieniach.
3. Podaj godzinę dotarcia do celu i zapas przed terminem (0–180 minut).
4. Naciśnij „Dodaj połączenie” i wpisz linię oraz godziny odjazdu i przyjazdu.
   Przystanki pierwszego i ostatniego odcinka pochodzą z parametrów trasy.
5. W razie przesiadek dodaj kolejne odcinki i uzupełnij przystanki pośrednie.
   Dla przejścia między różnymi przystankami dodaj osobny odcinek pieszy
   pomiędzy przejazdami. Odcinki muszą tworzyć ciągłą trasę w kolejności czasowej.
6. Daty przy odcinkach domyślnie odpowiadają dniowi planu. Zmień je dla podróży
   przez północ, np. odjazdu poprzedniego dnia. Godziny są w `Europe/Warsaw`.
7. Opcjonalnie nadaj nazwę i ustaw powtarzanie. Zapisz plan.

Aplikacja pokazuje oś czasu i godzinę wyjścia: odjazd minus dojście do przystanku.
Przyjazd z końcowym dojściem musi zapewniać wybrany zapas przed terminem.
Przykład: odjazd o 08:10 i dojście 7 minut → wyjście o 08:03.
Podsumowanie najbliższego planu korzysta z zapisanych godzin.

## Dane i kopie zapasowe

Pełne połączenia są zapisywane lokalnie w `travelplanner.calendar.v3`,
a punkty i wspólny zapas w `travelplanner.settings.v2` (AsyncStorage).
Zapis jest jawny; zamknięty bez zapisu szkic pozostaje tylko do końca sesji.
Zmiana katalogu punktów nie zmienia wcześniej zapisanych tras.

Starsze kalendarze i punkty są odczytywane bez usuwania poprzednich wpisów.
Zachowane zostają nazwy, terminy, przystanki, dojścia i cykle. Starsza wersja
nie zapisywała pełnych połączeń, dlatego linie i godziny trzeba uzupełnić ręcznie.
Nowy format jest zapisywany dopiero przy jawnej operacji zapisu/importu/usunięcia.

W Ustawieniach możesz eksportować i importować plik JSON. Format v2 zawiera
pełne ręczne połączenia; import starszego v1 zachowuje plan do uzupełnienia.
Podgląd importu pokazuje konflikty; istniejące daty i szkice są pomijane.
Brakujące punkty importowanych planów są dodawane do ustawień.

Plany działają bez internetu. Wpisane godziny nie są automatycznie aktualizowane.
AsyncStorage nie jest szyfrowany. Aplikacja nie korzysta z GPS ani powiadomień.

## Weryfikacja

Zgodnie z instrukcjami projektu nie uruchomiono testów, lintowania, typechecka,
builda ani aplikacji. Zmiany podlegają wyłącznie statycznemu przeglądowi kodu.

Mapa modułów: [ARCHITECTURE.md](ARCHITECTURE.md).
