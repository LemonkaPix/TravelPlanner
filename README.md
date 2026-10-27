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

## Budziki systemowe na Androidzie

W Ustawieniach określ czas na przygotowanie oraz opcjonalną serię budzików.
Przy zapisanym planie dnia zobaczysz wyliczone godziny i przycisk przekazania
budzików do systemowego Zegara. Ostatni alarm pozostawia pełny czas przygotowania;
wcześniejsze alarmy są dodawane w wybranych odstępach.

Ustawianie budzików wymaga własnej wersji aplikacji z uprawnieniem
`com.android.alarm.permission.SET_ALARM` zapisanym w `app.json`. Zmiana tego pliku
nie nadaje uprawnień zainstalowanemu Expo Go. W Expo Go aplikacja pokazuje podgląd
i pozwala otworzyć Zegar, aby ustawić godziny ręcznie; przekazywanie jest wyłączone.

Aby zbudować i uruchomić własną wersję lokalnie, skonfiguruj Android Studio,
Android SDK i JDK zgodnie z [instrukcją Expo](https://docs.expo.dev/guides/local-app-development/),
podłącz telefon z debugowaniem USB i uruchom w katalogu projektu:

```sh
npx expo run:android --device
```

Polecenie generuje projekt natywny z `app.json`, buduje go, instaluje na telefonie
i uruchamia TravelPlanner. Otwieraj zainstalowany TravelPlanner. `npm run android`
również uruchamia lokalny build przez `expo run:android`.
Przy zmianie uprawnień lub zależności natywnych potrzebna jest ponowna kompilacja
uwzględniająca konfigurację. Nie edytuj ręcznie wygenerowanych plików `android/`.

Dane Expo Go i własnej aplikacji są oddzielne. Przenieś plany przez eksport JSON
w Expo Go i import pliku w TravelPlanner.

Zegar przyjmuje godzinę bez daty. Alarm można przekazać, gdy jego najbliższe
wystąpienie odpowiada wybranemu dniowi, zwykle w ciągu 24 godzin. Już dodane
budziki zmieniasz i usuwasz w Zegarze; edycja planu ich nie aktualizuje.

## Widget na pulpicie Androida

Widget „Najbliższy dojazd” pokazuje godzinę i datę wyjścia, cel, termin dotarcia
oraz pierwszy odjazd. Uwzględnia zapisane plany cykliczne. Domyślnie zajmuje
4×3 pola; możesz zmienić jego rozmiar. Dotknięcie planu otwiera planer.

### APK przez EAS i instalacja kodem QR

Projekt ma profil `preview` w `eas.json`, który buduje APK do instalacji poza Google Play.
Zaloguj się do EAS (jeśli jeszcze tego nie robiłeś), a następnie z katalogu projektu
uruchom build w chmurze:

```sh
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Po zakończeniu otwórz link do buildu wyświetlony w terminalu albo stronę buildu w EAS.
W sekcji artefaktu wybierz **Install**, zeskanuj kod QR telefonem, pobierz APK
i otwórz pobrany plik, aby zainstalować TravelPlanner. Jeśli Android zablokuje
instalację, zezwól przeglądarce na instalowanie aplikacji z tego źródła i ponów próbę.

Po zmianie zależności natywnych, takich jak widget, trzeba zbudować i zainstalować
nowy APK. Do lokalnego buildu przez Android SDK i USB użyj zamiast tego:

```sh
npx expo prebuild --platform android
npx expo run:android --device
```

Konfiguracja `expo-build-properties` w `app.json` zachowuje konstruktory Room
i InputMerger używane przez bibliotekę widgetu. Zapobiega to [znanej awarii
przy starcie APK release w Expo SDK 58](https://github.com/sAleksovski/react-native-android-widget/issues/159),
gdy R8 usuwa te konstruktory podczas optymalizacji. Poprawka wymaga nowego APK;
przy lokalnym buildzie najpierw wykonaj powyższy `prebuild`, aby zastosować reguły.

Następnie otwórz TravelPlanner → Ustawienia → Widget na pulpicie → Dodaj widget
i potwierdź w oknie systemowym. Możesz też przytrzymać puste miejsce na pulpicie
i wybrać Widgety → TravelPlanner → Najbliższy dojazd. Expo Go nie obsługuje widgetu;
przenieś z niego plany przez eksport/import JSON.

Widget odczytuje wyłącznie zapisane plany. Aktualizuje się po zapisie, imporcie,
usunięciu planu i powrocie do aplikacji. W tle Android odświeża go nie częściej niż
co 30 minut i może opóźniać aktualizacje, np. podczas oszczędzania baterii.
Po upływie terminu dotarcia kolejna aktualizacja wybierze następny plan.
Sprawdź datę i godzinę ostatniej aktualizacji na widżecie; przycisk „Odśwież”
odczytuje plany ponownie bez otwierania aplikacji. Nie jest to budzik ani zegar
odliczający na żywo. Nie wymaga internetu ani uprawnienia do powiadomień.

## Dane i kopie zapasowe

Pełne połączenia są zapisywane lokalnie w `travelplanner.calendar.v3`,
a punkty, wspólny zapas i ustawienia budzików w `travelplanner.settings.v3` (AsyncStorage).
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
