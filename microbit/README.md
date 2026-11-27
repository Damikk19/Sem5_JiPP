# RAM INVADERS (micro:bit)

Strzelanka na micro:bita: z góry spadają kości RAM, a Ty strzelasz do nich ze statku w dolnym rzędzie. Po grze wybierasz nick z 3 liter i wynik leci radiem do bramki prowadzącego, a z niej do naszego API.

## Sterowanie

- **A / B**: statek w lewo / w prawo
- **A+B**: strzał (jeden pocisk naraz)
- na ekranie tytułowym dowolny przycisk startuje grę

## Zasady

- **DDR4** (przygaszona dioda): 1 trafienie, 1 pkt
- **DDR5** (jasna dioda): 2 trafienia (po pierwszym przygasa), 3 pkt. Pojawia się coraz częściej.
- Kość, która doleci do dolnego rzędu, zabiera życie. Są 3 życia, a jasność statku pokazuje, ile zostało.
- Każda zestrzelona kość przyspiesza grę. Tempo jest dobrane symulacją (`symulacja_tempa.py`: logika gry w Pythonie + boty o różnym refleksie): przeciętna partia trwa ok. minuty (mediana od 45 s u wolnego bota do ok. 100 s u szybkiego).
- **Potrząśnięcie = Garbage Collector** (raz na grę): ekran „skanuje pamięć” od góry do dołu, gra na chwilę staje jak przy GC typu stop-the-world i znikają wszystkie kości. Punktów za to nie ma, to koło ratunkowe.
- Kiedy kość „wycieknie” na dół, ekran krótko błyska. Po trzeciej przegrana kończy się napisem **OUT OF MEMORY**.
- W trakcie błysku i GC gra stoi, więc przyciski nic wtedy nie robią.

## Nick i wysyłka

Po grze: **A / B** zmienia literę, **A+B** zatwierdza (krótki dźwięk, przy każdej kolejnej literze wyższy). Po trzeciej literze micro:bit wysyła radiem ramkę:

```
DK;ABC;123     (ID_API;NICK;WYNIK, max 19 znaków)
```

Bramka prowadzącego zamienia ją na `POST /api/scores` z body `{ "id": "ABC", "wynik": 123 }`. Wynik w ramce to najwyżej 99999, bo tyle przyjmuje API.

**Do potwierdzenia z prowadzącym:** grupa radia (`GRUPA_RADIA`, teraz 1), identyfikator naszego API (`ID_API`, teraz `DK`) i format ramki. Wszystko jest na górze `main.ts`.

## Wgranie bez internetu

`ram-invaders.hex` to gotowa gra (uniwersalny plik dla micro:bita V1 i V2). Podłącz micro:bita kablem USB i przeciągnij plik na dysk **MICROBIT**.

Po zmianie `main.ts` plik trzeba pobrać z MakeCode od nowa (Pobierz → Pobierz jako plik).

## Jak otworzyć w MakeCode

1. https://makecode.microbit.org → Nowy projekt → JavaScript
2. wklej zawartość `main.ts` (pakiet radia nowy projekt ma od razu)
3. gra działa od razu w symulatorze, a **Pobierz** wgrywa ją na micro:bita przez USB

Dźwięki używają klasycznego `music.playTone` zamiast nowego `music.play`, bo z nowym API program nie mieścił się na micro:bicie V1. Wszystkie dźwięki gra jeden wątek w tle, więc krótki (np. strzał) nie ucina dłuższego (utrata życia).
