## Opis projektu dla agenta designowego

TravelPlanner to polska aplikacja mobilna React Native do planowania dojazdów
z ręcznie wpisanymi połączeniami. Działa lokalnie i bez internetu.

Użytkownik wpisuje punkty i przystanki lub wybiera je z własnego katalogu,
ustala termin dotarcia, dojścia pieszo i zapas czasu. Dodaje linię oraz daty
i godziny każdego odcinka, także przesiadki i przejścia między przystankami.
Aplikacja oblicza godzinę wyjścia i pokazuje oś czasu od drzwi do celu.

- **Plan** — najbliższy dojazd, kalendarz tygodniowy z rozwijanym miesiącem,
  dodawanie i edycja dnia.
- **Edytor** — nazwa, punkty, termin, ręczne odcinki połączenia, oś czasu,
  zapis/usunięcie i cykliczność.
- **Ustawienia** — własne punkty początkowe/docelowe i przystanki z czasem
  dojścia, wspólny zapas oraz import/eksport planów w pliku JSON.

Zachowaj istniejący ciemny motyw Nocturne Transit. Priorytetem są szybki odczyt
godziny wyjścia i łatwe wpisywanie godzin, także podróży przez północ.
Uwzględnij brak planów/punktów, niepoprawne godziny, niespójne przesiadki,
spóźniony przyjazd i błędy zapisu. Używaj prostych polskich komunikatów.
Aplikacja nie korzysta z ZTP, backendu, GPS ani automatycznych rozkładów.
