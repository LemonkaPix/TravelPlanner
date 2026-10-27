# Ikona TravelPlanner

Znak łączy otwarty okrąg zegara, wskazówkę i punkt docelowy trasy. Nawiązuje
do głównego zadania aplikacji: zaplanowania dojazdu i godziny wyjścia.
Paleta pochodzi z motywu Nocturne Transit: granat `#0d1320`, błękit `#adc6ff`
i mięta `#4edea3`.

- `icon.png` — 1024 × 1024 px, PNG bez przezroczystości, bez zaokrąglonych rogów;
  główna ikona Expo/iOS/Android i warstwa pierwszego planu Android adaptive icon.
  Znak pozostaje w centralnej części obrazu, z marginesem na maskowanie launchera.
  Warstwa Androida zawiera również granatowe tło; nie jest przezroczystym wycięciem.
- `favicon.png` — 64 × 64 px, pomniejszona wersja tej samej ikony dla przeglądarki.

Grafikę przygotowano wbudowanym narzędziem `image_gen`; rozmiary eksportowe
przygotowano za pomocą macOS `sips`. Nie dodano zależności. Eksportów z błędną
przezroczystością nie użyto w aplikacji. Zmiana ikony launchera wymaga ponownego
zbudowania i zainstalowania aplikacji natywnej.

Konfiguracja: [Expo SDK 58 — app config](https://docs.expo.dev/versions/v58.0.0/config/app/).

## Prompt wybranej grafiki

```text
Use case: logo-brand. Asset type: production launcher icon for TravelPlanner, a Polish local daily transit planner focused on the exact time to leave home. Create one polished 1024x1024 square app icon, full bleed perfectly solid dark navy #0d1320 background with square corners, no outer rounded tile or border. Subject: one bold, distinctive geometric mark combining a transit route with a clock hand: a thick pale blue #adc6ff open circular route sweeping around the lower-left, turning into an angular clock-hand/forward route pointing up-right, with a single mint #4edea3 circular destination node at its upper-right end. Use the visual language of transit diagrams, confident smooth constant-width strokes and generous negative space; a memorable compact silhouette legible at 32px. The symbol must stay entirely within the central 60% of the canvas (including the destination node), optically centered, leaving the outer 20% on every side completely empty navy for adaptive launcher masking. Style: crisp flat vector-like geometry, precise antialiasing, restrained, professional, no gradients, no glow, no shadows, no texture, no 3D. No text, letters, numbers, watermarks, vehicles, map pins, calendar grid, extra decorative elements. Output just the finished icon artwork, no presentation or mockup.
```
