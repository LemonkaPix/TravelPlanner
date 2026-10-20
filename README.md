# TravelPlanner

Planer dojazdu na uczelnię dla Krakowa i okolic. React Native, Expo SDK 57,
TypeScript i Expo Router. Interfejs po polsku.

## Darmowe źródło danych

Aplikacja korzysta z oficjalnych, publicznie dostępnych rozkładów ZTP Kraków:
[GTFS tramwajów i autobusów](https://gtfs.ztp.krakow.pl/) oraz
[otwarte dane ZTP](https://ztp.krakow.pl/dane-otwarte).
Nie wymaga konta ani klucza Jakdojade czy innego płatnego API.

ZTP publikuje archiwa GTFS, nie gotowy endpoint wyznaczania tras. Dołączony backend
Node pobiera rozkłady autobusów MPK (`A`), Mobilis (`M`) i tramwajów (`T`), a następnie
udostępnia aplikacji API przystanków i połączeń. Dane są darmowe; hosting backendu
pozostaje po stronie właściciela aplikacji.

## Uruchomienie

Wymagania: Node.js 24 LTS i npm. Zainstaluj zależności aplikacji i backendu:

```sh
npm ci
npm --prefix server ci
npm --prefix server start
```

Nie potrzebujesz pliku `server/.env` ani żadnych kluczy. Opcjonalne ustawienia HTTP
znajdziesz w `server/.env.example`: `HOST`, `PORT`, `ALLOWED_ORIGINS`.
Backend domyślnie nasłuchuje na `127.0.0.1:3001`.

Przy pierwszym uruchomieniu serwer pobiera i importuje trzy archiwa. Może to
potrwać kilka minut — aplikacja pokaże komunikat i przycisk ponowienia. Cache ZIP
jest przechowywany w ignorowanym `server/data/`; nie dodawaj go do repozytorium.
Importer działa w osobnym workerze, poza serwerem HTTP. Zapewnij backendowi
odpowiednio dużo pamięci: same pliki stop_times to obecnie około 150 MB CSV,
a podczas odświeżania mogą współistnieć stary i nowy zestaw danych.

Rozkłady odświeżają się co 6 godzin. Nieudana aktualizacja pozostawia poprzedni
kompletny zestaw; dane starsze niż 24 godziny nie są używane. Po błędzie import jest
ponawiany po minucie. Aktualizacje wymagają działającego backendu i dostępu do ZTP.

W drugim terminalu ustaw publiczny adres backendu i uruchom aplikację:

```sh
cp .env.example .env
```

W głównym `.env` uzupełnij `EXPO_PUBLIC_TRANSIT_API_URL`, np.
`https://transit.twoja-domena.pl`, bez końcowego `/`. To adres backendu, **nie**
adres serwera ZIP ZTP. Zmiana zmiennej wymaga pełnego przeładowania aplikacji.

```sh
npm start
```

Możesz też użyć `npm run android`, `npm run ios` albo `npm run web`.
Expo Go, emulator lub symulator wymagają odpowiedniego środowiska Android/iOS.
Dla lokalnego web domyślnie dozwolony jest origin `http://localhost:8081`.
Na telefonie użyj osiągalnego adresu HTTPS (np. tunelu do backendu); loopback
telefonu nie wskazuje komputera. W razie udostępniania serwera w sieci ustaw
odpowiedni HOST, np. `0.0.0.0`, i konfigurację HTTPS/CORS w reverse proxy.

## Planowanie

1. Wpisz opis miejsca wyjścia oraz budynek/salę docelową.
2. Podaj datę `DD.MM.RRRR` i godzinę `HH:mm` dotarcia do celu.
3. Wyszukaj dwa przystanki w Krakowie lub okolicy — wpisz co najmniej 2 znaki.
   Wybierasz konkretne stanowisko, rozróżniane kodem, np. `100-03`.
4. Podaj dojście do przystanku, dojście od przystanku do celu i zapas przed
   terminem. Każde pole przyjmuje 0–180 minut.
5. Wyszukaj i wybierz połączenie. Oś czasu pokaże wyjście, odjazd, przyjazd na
   przystanek końcowy oraz dotarcie do celu i planowany termin.
6. Naciśnij „Zapisz plan”, aby zachować konfigurację na urządzeniu.

Przykład: zajęcia o 09:00, zapas 10 min i końcowe dojście 5 min → przyjazd na
przystanek najpóźniej o 08:45. Dla wybranego odjazdu 08:10 i dojścia 7 min
aplikacja wskaże wyjście o 08:03.

## Zakres wyszukiwania

- Do trzech propozycji z różnymi godzinami odjazdu, maksymalnie dwie przesiadki,
  w ciągu 24 godzin przed terminem. Więcej przesiadek i dalsze trasy nie są szukane.
- Zmiany tygodniowego kalendarza i wyjątki dla konkretnych dat są uwzględniane.
  Dla dat poza opublikowanym zakresem rozkładów pokaże się komunikat.
- Kursy nocne z godzinami GTFS powyżej 24:00 zachowują właściwy dzień kursowania.
  Godziny są pokazywane w `Europe/Warsaw`, zgodnie ze strefą w plikach ZTP.
- To godziny **rozkładowe**, bez prognoz opóźnień. Lista pokazuje czas pobrania danych.
- Na tym samym stanowisku przesiadka wymaga minimum 2 minut. Między stanowiskami
  tego samego zespołu (do 400 m) dojście jest szacowane z odległości w linii prostej
  przy 1,2 m/s: minimum 3 minuty dojścia i minuta przed kolejnym odjazdem.
  Takie przejścia są oznaczone jako szacowane. Backend nie zna przejść dla pieszych,
  barier ani dostępności; rzeczywista droga może być dłuższa.
- Początkowe dojście kończy się w chwili odjazdu. Zapas dotyczy dotarcia do celu.
  Trasy piesze między odrębnymi zespołami przystankowymi nie są wyszukiwane,
  chyba że przyszły plik transfers.txt jawnie opisze takie przejście.

Backend odrzuci nieobsługiwane warianty danych zamiast zgadywać czasy: brakujące
godziny zdarzeń, godziny >=48:00, częstotliwości zamiast konkretnych kursów oraz
reguły przesiadek zależne od konkretnego kursu/linii. Obecne zbadane archiwa nie
wymagają tych funkcji. Przyszłe zmiany formatu mogą wymagać aktualizacji importera.

## Zapis i prywatność

Konfiguracja jest zapisywana jawnie w `travelplanner.plan.v3`. Wybrane połączenie
pozostaje w bieżącej sesji — po otwarciu aplikacji wyszukaj aktualny rozkład.
Konfigurację można zapisać bez wybierania połączenia.

Poprzedni zapis v2 zachowuje miejsca, termin, zapas i oba dojścia. Przystanki
Jakdojade wymagają ponownego wyboru z danych ZTP. Zapis v1 dodatkowo otrzymuje
po 5 minut na oba dojścia. Migracja ani błędy odczytu nie usuwają starszych danych;
nowa wersja powstaje dopiero po naciśnięciu „Zapisz plan”.

Opisy domu i celu zostają na urządzeniu. Nasz backend otrzymuje nazwę wyszukiwanego
przystanku, wybrane stanowiska i termin. Do ZTP wysyłane są tylko okresowe zapytania
o archiwa rozkładów. Dane w AsyncStorage nie są szyfrowane.

## Weryfikacja

Nie uruchomiono testów, lintów, typechecków, buildów, importera ani aplikacji,
zgodnie z instrukcjami projektu. Przegląd obejmował kod, dokumentację GTFS i
zawartość oficjalnych plików ZTP. Testy routingu, kalendarzy, nocy/zmiany czasu,
migracji i API pozostają do osobnego zlecenia.

Mapa modułów i kontrakty: [ARCHITECTURE.md](ARCHITECTURE.md).
