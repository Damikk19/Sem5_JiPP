# RAM ATAK (micro:bit)

Strzelanka na micro:bita: z góry spadają kości RAM, a Ty strzelasz do nich ze statku w dolnym rzędzie. Po grze wybierasz nick z 3 liter i wynik leci radiem do bramki prowadzącego, a z niej do naszego API.

## Sterowanie

- **A / B**: statek w lewo / w prawo
- **A+B**: strzał (jeden pocisk naraz)
- na ekranie tytułowym dowolny przycisk startuje grę

## Zasady

- **DDR4** (przygaszona dioda): 1 trafienie, 1 pkt
- **DDR5** (jasna dioda): 2 trafienia (po pierwszym przygasa), 3 pkt. Pojawia się coraz częściej.
- Kość, która doleci do dolnego rzędu, zabiera życie. Są 3 życia, a jasność statku pokazuje, ile zostało.
- Każda zestrzelona kość przyspiesza grę.

## Nick i wysyłka

Po grze: **A / B** zmienia literę, **A+B** zatwierdza. Po trzeciej literze micro:bit wysyła radiem ramkę:

```
DK;ABC;123     (ID_API;NICK;WYNIK, max 19 znaków)
```

Bramka prowadzącego zamienia ją na `POST /api/scores` z body `{ "id": "ABC", "wynik": 123 }`.

**Do potwierdzenia z prowadzącym:** grupa radia (`GRUPA_RADIA`, teraz 1), identyfikator naszego API (`ID_API`, teraz `DK`) i format ramki. Wszystko jest na górze `main.ts`.

## Jak otworzyć

1. https://makecode.microbit.org → Nowy projekt → JavaScript
2. wklej zawartość `main.ts` (MakeCode sam doda pakiet radia)
3. gra działa od razu w symulatorze, a **Pobierz** wgrywa ją na micro:bita przez USB

Kod da się przełączyć na bloki. Szare zostają tylko dwa bloki od szybkiego wyświetlania liter nicku.
