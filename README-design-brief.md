## Opis projektu dla agenta designowego

Zaprojektuj mobilną aplikację **TravelPlanner** do planowania dojazdów komunikacją miejską w Krakowie i okolicach obsługiwanych przez KMK. Aplikacja pomaga zaplanować, o której trzeba wyjść z domu, aby dotrzeć na miejsce na wybraną godzinę.

Użytkownik zapisuje punkty początkowe i końcowe wraz z przystankami oraz czasem dojścia pieszo. Wybiera dzień i godzinę dotarcia, a aplikacja wyszukuje do trzech propozycji przejazdu. Uwzględnia czas dojścia na przystanek, dojścia z przystanku i zapas bezpieczeństwa. Wybrany kurs można zapisać w kalendarzu, a najbliższy plan jest widoczny nad kalendarzem. Dni mogą się powtarzać w cyklach; plany da się też importować i eksportować jako plik.

Główne obszary aplikacji:

- **Plan** — podsumowanie najbliższego dojazdu, kalendarz miesięczny oraz dodawanie i edycja planu dnia.
- **Edytor dnia** — nazwa planu, wybór zapisanych punktów, godzina dotarcia, propozycje kursów i rozkład od wyjścia z domu do celu. Obsługuje też cykliczne plany.
- **Ustawienia** — zarządzanie zapisanymi punktami początkowymi i końcowymi, przystankami, czasem dojścia oraz wspólnym zapasem czasu.

To aplikacja **po polsku**, przeznaczona na telefon i zbudowana w React Native. Projekt dotyczy Krakowa — nie dodawaj wyboru miasta, lokalizacji GPS, powiadomień ani informacji o opóźnieniach na żywo. Rozkłady pochodzą z oficjalnych danych ZTP; aplikacja pokazuje aktualne propozycje na podstawie tych rozkładów.

Przygotuj czytelny, spokojny interfejs do częstego, praktycznego użycia. Priorytetem są szybkie sprawdzenie najbliższego planu, łatwe wybranie dnia i czytelne porównanie kursów. Uwzględnij stany ładowania, brak zapisanych punktów, brak wyników i błędy wyszukiwania. Adresuj użytkownika prostymi polskimi komunikatami.
