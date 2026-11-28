# Wymagania i struktury danych

System rankingu gry RAM INVADERS na micro:bicie. Dokument uzupełnia diagram C4 (`c4-ranking.pdf`): C4 pokazuje, z czego system jest zbudowany, a tutaj jest opisane, co ma robić i jakie dane przepływają między częściami.

## Aktorzy

- **Gracz**: gra na micro:bicie i sprawdza swoje miejsce w rankingu
- **Bramka prowadzącego** (system zewnętrzny): odbiera wyniki radiem i wysyła je do API
- **Widz**: ogląda ranking na stronie albo na wyświetlaczu
- **Administrator** (autor projektu): usuwa niechciane wpisy z rankingu

## Wymagania funkcjonalne

### Gra (micro:bit)

| Nr | Wymaganie |
| --- | --- |
| WF-01 | Gracz porusza statkiem w dolnym rzędzie przyciskami A (w lewo) i B (w prawo), a A+B strzela. Na ekranie jest najwyżej jeden pocisk. |
| WF-02 | Z góry spadają kości RAM: DDR4 (przygaszona) pada po 1 trafieniu i daje 1 pkt, DDR5 (jasna) po 2 trafieniach i daje 3 pkt. |
| WF-03 | Kość, która doleci do dolnego rzędu, zabiera życie. Gracz ma 3 życia, a jasność statku pokazuje, ile zostało. |
| WF-04 | Raz na grę gracz może potrząsnąć micro:bitem, żeby usunąć wszystkie kości z ekranu (Garbage Collector). |
| WF-05 | Każda zestrzelona kość przyspiesza grę. Przeciętna partia trwa około minuty. |
| WF-06 | Po grze gracz wybiera nick z 3 liter: przed każdą literą widać jej numer (1–3), A/B zmienia literę, A+B ją zatwierdza. Nick zostaje na następną grę. Napisy po przegranej (OUT OF MEMORY i wynik) można pominąć przyciskiem. |
| WF-07 | Po zatwierdzeniu nicku micro:bit wysyła wynik radiem do bramki (jedna ramka) i pokazuje nick z wynikiem. |

### API

| Nr | Wymaganie |
| --- | --- |
| WF-08 | API przyjmuje wynik (`POST /api/scores`) tylko z poprawnym kluczem API (w `Authorization`, `X-API-Key` albo `?key=`; sprawdzane jest każde z tych miejsc). Bez klucza odpowiada `401`, zanim przeczyta body. Body większe niż 1024 bajty dostaje `413` (według `Content-Length` albo po przeczytaniu 1024 bajtów, gdy nagłówka nie ma). |
| WF-09 | API odrzuca niepoprawne dane z opisem błędu (`400`): `id` musi mieć 1–32 znaki, bez znaków sterujących i zmieniających kierunek tekstu, z co najmniej jednym widocznym znakiem i bez niewidocznych i formatujących znaków (spacja zerowej szerokości, miękki dywiz, BOM, wypełniacze; ZWJ tylko między emoji, znaki tagów tylko we flagach Anglii, Szkocji i Walii, selektory wariantów tylko po emoji, w keycapie albo po znaku CJK), `wynik` musi być liczbą całkowitą 0–99999 (jako tekst tylko z samych cyfr). |
| WF-10 | API zapisuje wynik w bazie (`201`). Unikalne `id` wpisu i czas zapisu nadaje baza. Zapis z tym samym wynikiem co ostatni wpis tego nicku z ostatnich 30 s to ta sama gra: API odpowiada `200` z tym wpisem i nie dopisuje drugiego. Za częste zapisy dostają `429` z `Retry-After` (limity niżej, w wymaganiach niefunkcjonalnych). |
| WF-11 | API zwraca ranking (`GET /api/scores`) od najlepszego wyniku. Przy remisie wyżej jest ten, kto zagrał wcześniej. Liczbę wyników ustawia `limit` (1–100 z samych cyfr, większa wartość jest przycinana do 100, a 0 do 1; brak albo coś innego, także liczba ujemna, daje 10). Odpowiedź może być do ok. 15 s stara (cache CDN). |
| WF-12 | API zwraca ostatnie gry (`GET /api/scores?sort=latest`), a dla strony TOP 10 i ostatnie gry w jednym żądaniu (`GET /api/ranking`). Też z cache CDN (do ok. 15 s). |
| WF-13 | Administrator może usunąć wynik po `id` (`DELETE /api/scores/{id}`) osobnym kluczem admina. Klucz bramki nie pozwala usuwać, a gdy oba klucze w konfiguracji są takie same, usuwanie jest zablokowane. Usunięty wpis może jeszcze przez ok. 15 s być widoczny w rankingu (cache CDN). |

### Ranking

| Nr | Wymaganie |
| --- | --- |
| WF-14 | Strona pokazuje 10 najlepszych wyników i ostatnią grę, odświeża się co 5 s bez przeładowania. Po godzinie bez nowej gry i bez ruchu na stronie pyta API co 30 min (czuwanie), a kliknięcie albo powrót do karty od razu ją budzi. |
| WF-15 | Nowe wyniki (wszystkie od poprzedniego odświeżenia) są wyróżnione na stronie: migają, a przy wyłączonych animacjach są podświetlone. Usunięcie wpisu nie wyróżnia starszej gry. Wiersze, które zmieniły miejsce, przeskakują ze starego miejsca na nowe skokowo (co ok. 8 px przez 0,5 s, jak na starym sprzęcie). Nowy wiersz nie wjeżdża, tylko miga, a wiersz, który wypadł z TOP 10, znika. Pierwsze pobranie i zmiana rozmiaru okna niczego nie przesuwają. |
| WF-16 | Gdy strona traci połączenie z API, pokazuje komunikat „BRAK SYGNAŁU Z SERWERA”, a przy działającym połączeniu zachęca do gry. |
| WF-17 | Wyświetlacz fizyczny pokazuje 5 najlepszych wyników i odświeża je co 10 s. **Planowane**, sprzęt do ustalenia. |
| WF-18 | Nowa gra na 1. miejscu z wynikiem wyższym od dotychczasowego rekordu (więc większym od 0) otwiera na 5 s ekran NEW HIGH SCORE z nickiem i wynikiem. Klik albo Escape zamyka go wcześniej. Pod ekranem zostaje stara tabela, a nowe dane (także te, które przyjdą w trakcie) wchodzą po jego zamknięciu, więc widać przesunięcie wierszy, a nowe gry migają w całości (wyróżnienie trwa jeszcze jedno pytanie bez nowych gier). Wyższy rekord w trakcie podmienia ekran (od nowa 5 s), niższa albo równa gra czeka. Strona pod ekranem jest nieaktywna, a fokus wraca po jego zamknięciu. Przejście na inną podstronę zamyka ekran, a po powrocie nic z niego nie wraca. Remis, wynik 0, usunięcie wpisu i pierwsze pobranie nie otwierają ekranu. Czytnik ekranu dostaje komunikat „Nowy rekord: NICK, WYNIK pkt” z osobnego regionu, który nie jest częścią nieaktywnej strony. |
| WF-19 | Na dużym ekranie (od 1250×760, jak tryb projektora) po 60 s bez nowej gry i bez kliknięcia albo klawisza (liczone od wejścia na stronę rankingu, także po powrocie z opisu API) w miejscu tabeli na zmianę leci pokaz (10 s) i wraca tabela (20 s). Pokaz to demo gry na matrycy 5×5, w którą gra bot według zasad gry, z zachętą do gry i punktacją DDR4/DDR5. Nowa gra, kliknięcie i klawisz od razu wracają do tabeli. Pokazu nie ma na telefonie i w małym oknie, przy braku połączenia z API ani w trakcie ekranu rekordu. Tabela zostaje pod pokazem dla czytnika ekranu. |
| WF-20 | Strona ma dźwięk 8-bit (fala prostokątna, cicho, bez plików): dwa krótkie sygnały przy nowej grze i fanfara C-E-G-C przy rekordzie, przy kilku nowych grach naraz jeden dźwięk (rekord ma pierwszeństwo). Pokaz jest cichy. Dźwięk jest domyślnie wyłączony, włącza go przycisk „DŹWIĘK: WYŁ/WŁ”, a wybór zostaje w przeglądarce. Po przeładowaniu z włączonym dźwiękiem gra on od pierwszego kliknięcia na stronie (wymóg przeglądarki). |
| WF-21 | Przy ustawieniu systemu „ogranicz ruch” (`prefers-reduced-motion`) strona nie miga, nie przesuwa wierszy, nie zmienia kolorów na ekranie rekordu i nie włącza pokazu. Dźwięk działa, jeśli jest włączony. Karta w tle niczego nie animuje i nic nie gra. |

## Wymagania niefunkcjonalne

- **Bezpieczeństwo**: klucze są tylko w zmiennych środowiskowych serwera, nie w kodzie. Klucz porównywany jest w stałym czasie. Brak skonfigurowanego klucza albo klucz krótszy niż 32 znaki blokuje operację, a odpowiedź `500` nie zdradza, którego klucza brakuje (szczegół jest tylko w logu). Dane sprawdza API, a dodatkowo `CHECK` w bazie. Strona wysyła nagłówki bezpieczeństwa (CSP, `nosniff`, `Referrer-Policy`), a logi błędów nie zawierają haseł.
- **Uprawnienia**: dwa klucze z różnymi uprawnieniami. Klucz zapisu tylko dopisuje, klucz admina tylko usuwa.
- **Wydajność**: odpowiedź API w ok. 0,2 s. Ranking korzysta z indeksu `(score DESC, timestamp ASC)`, a ostatnie gry z indeksu `(timestamp DESC, id DESC)`.
- **Kompatybilność**: gra działa na micro:bicie V1 i V2 (uniwersalny plik `.hex`).
- **Koszt**: hosting (Vercel) i baza (Neon) na darmowych planach z miesięcznymi limitami (m.in. 1 mln wywołań funkcji, 100 godzin pracy bazy). Dlatego strona pyta jednym żądaniem co 5 s, a w czuwaniu co 30 min, żeby baza mogła zasnąć. Ekran rekordu, pokaz, dźwięk i przesuwanie wierszy działają w przeglądarce na danych z tego samego żądania, więc nie dokładają zapytań.
- **Wdrażanie**: każdy push na `main` automatycznie buduje i wdraża nową wersję. Nieudany build nie zastępuje działającej wersji.
- **Limity (ochrona przed nadużyciem)**: skrypt ani pętla w Postmanie nie mogą zalać rankingu ani wyczerpać darmowych planów. Body zapisu ma najwyżej 1024 bajty (`413`). Powtórka ostatniego wpisu nicku (ten sam wynik w ciągu 30 s) nie tworzy nowego wpisu (`200` z istniejącym). Inny wynik tego samego nicku przed upływem 5 s od poprzedniego zapisu i więcej niż 30 nowych wpisów w ciągu 60 s (łącznie) dostają `429` z `Retry-After`. Limity sprawdza baza w jednej transakcji z blokadą, więc działają także przy równoległych żądaniach. Publiczne odczyty mają cache CDN: odpowiedź jest świeża przez 5 s, a przez kolejne 25 s CDN oddaje ją dalej i w tle pobiera nową. Funkcja i baza dostają więc najwyżej jedno pytanie na ok. 5 s niezależnie od liczby widzów, a strona (pyta co 5 s) pokazuje dane najwyżej ok. 15 s stare. Przez kilka sekund po zapisie (do ok. 15 s) GET może pokazywać stan sprzed zapisu, a pierwsze pytanie po dłuższej przerwie może jeszcze dostać zapamiętaną odpowiedź (najwyżej 30 s starą). Dodatkowo reguła Firewalla Vercela (ustawiana w panelu, nie w repo) zatrzymuje więcej niż 200 żądań do `/api` na minutę z jednego IP (`429`), zanim wywołają funkcję. Każdy udany zapis i usunięcie zostawia w logach jedną linię (id, nick, wynik), a sprzątanie po zalewie opisuje README.

## Komunikacja

| Od | Do | Co | Jak | Kiedy |
| --- | --- | --- | --- | --- |
| Gra (micro:bit) | Bramka | ramka z wynikiem | radio micro:bit | po zatwierdzeniu nicku |
| Bramka | API | wynik do zapisu | HTTPS `POST /api/scores`, JSON, klucz API | po odebraniu ramki |
| API | Baza | zapis, odczyt, usunięcie | SQL przez HTTPS (sterownik Neon) | przy każdym żądaniu |
| Strona | API | ranking i ostatnie gry | HTTPS `GET /api/ranking`, JSON | co 5 s (w czuwaniu co 30 min) |
| Wyświetlacz | API | 5 najlepszych wyników | HTTPS `GET /api/scores?limit=5`, JSON | co 10 s (planowane) |
| Administrator | API | usunięcie wyniku | HTTPS `DELETE /api/scores/{id}`, klucz admina | ręcznie |

## Struktury danych

### 1. Ramka radiowa (powstaje na micro:bicie)

Tekst `ID_API;NICK;WYNIK`, np. `DK;ABC;123`, maksymalnie 19 znaków (limit pakietu radiowego micro:bita).

| Pole | Typ | Opis |
| --- | --- | --- |
| `ID_API` | tekst | identyfikator naszego API w bramce (do potwierdzenia z prowadzącym) |
| `NICK` | tekst, 3 litery | A–Z |
| `WYNIK` | liczba | 0–99999 |

### 2. Żądanie zapisu (powstaje w bramce)

`POST /api/scores`, klucz w nagłówku `Authorization: Bearer <klucz>` (albo `X-API-Key`, albo `?key=` w adresie).

```json
{ "id": "ABC", "wynik": 123 }
```

| Pole | Typ | Opis |
| --- | --- | --- |
| `id` | tekst | identyfikator gracza (nick), 1–32 znaki, bez znaków sterujących i zmieniających kierunek tekstu, z co najmniej jednym widocznym znakiem i bez niewidocznych znaków (emoji, także złożone, są w porządku) |
| `wynik` | liczba całkowita | 0–99999, może przyjść jako tekst z samych cyfr (`"123"`) |

### 3. ScoreDto (powstaje w API po walidacji)

| Pole | Typ | Skąd |
| --- | --- | --- |
| `playerId` | string | z pola `id`: bez spacji na brzegach, w postaci NFC, każda grupa spacji (także twardych) zamieniona na jedną zwykłą |
| `score` | number | z pola `wynik` |

### 4. Wiersz tabeli `scores` (powstaje w bazie)

| Kolumna | Typ | Ograniczenia |
| --- | --- | --- |
| `id` | uuid | klucz główny, `DEFAULT gen_random_uuid()` |
| `player_id` | varchar(32) | `NOT NULL` |
| `score` | integer | `NOT NULL`, `CHECK (score BETWEEN 0 AND 99999)` |
| `timestamp` | timestamptz | `NOT NULL`, `DEFAULT now()` |

`id` i `timestamp` nadaje baza, bo micro:bit nie ma zegara ani generatora UUID.

### 5. Wynik zwracany przez API (Score)

```json
{ "id": "3f2b8c1e-7a4d-4c2b-9e1f-0a6b5c4d3e2f", "playerId": "ABC", "score": 123, "timestamp": "2026-11-23T13:09:54.827Z" }
```

`GET /api/scores` zwraca tablicę takich obiektów, a `POST` (`201` dla nowego wpisu, `200` dla duplikatu) i `DELETE` (`200`) zwracają jeden. `GET /api/ranking` zwraca obiekt `{ "top": Score[], "latest": Score[] }` (TOP 10 i 10 ostatnich gier).

### 6. Błąd

```json
{ "error": "opis błędu" }
```

| Kod | Kiedy |
| --- | --- |
| `400` | niepoprawne dane albo `id` |
| `401` | brak klucza albo zły klucz |
| `404` | nie ma wyniku o takim `id` (usuwanie) |
| `413` | body zapisu większe niż 1024 bajty |
| `429` | za częste zapisy (inny wynik tego samego nicku przed upływem 5 s od poprzedniego zapisu albo ponad 30 wpisów w minucie); nagłówek `Retry-After` podaje, po ilu sekundach spróbować |
| `500` | błąd bazy albo zła konfiguracja kluczy na serwerze (ogólny komunikat, szczegół w logu) |
