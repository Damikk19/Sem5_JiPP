# Wymagania i struktury danych

System rankingu gry RAM ATAK na micro:bicie. Dokument uzupełnia diagram C4 (`c4-ranking.pdf`): C4 pokazuje, z czego system jest zbudowany, a tutaj jest opisane, co ma robić i jakie dane przepływają między częściami.

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
| WF-06 | Po grze gracz wybiera nick z 3 liter: A/B zmienia literę, A+B ją zatwierdza. Nick zostaje na następną grę. |
| WF-07 | Po zatwierdzeniu nicku micro:bit wysyła wynik radiem do bramki (jedna ramka) i pokazuje nick z wynikiem. |

### API

| Nr | Wymaganie |
| --- | --- |
| WF-08 | API przyjmuje wynik (`POST /api/scores`) tylko z poprawnym kluczem API. Bez klucza odpowiada `401`. |
| WF-09 | API odrzuca niepoprawne dane z opisem błędu (`400`): `id` musi mieć 1–32 znaki, `wynik` musi być liczbą całkowitą 0–99999. |
| WF-10 | API zapisuje wynik w bazie. Unikalne `id` wpisu i czas zapisu nadaje baza. |
| WF-11 | API zwraca ranking (`GET /api/scores`) od najlepszego wyniku. Przy remisie wyżej jest ten, kto zagrał wcześniej. Liczbę wyników ustawia `limit` (1–100, domyślnie 10). |
| WF-12 | API zwraca ostatnie gry (`GET /api/scores?sort=latest`). |
| WF-13 | Administrator może usunąć wynik po `id` (`DELETE /api/scores/{id}`) osobnym kluczem admina. Klucz bramki nie pozwala usuwać. |

### Ranking

| Nr | Wymaganie |
| --- | --- |
| WF-14 | Strona pokazuje 10 najlepszych wyników i ostatnią grę, odświeża się co 2 s bez przeładowania. |
| WF-15 | Nowy wynik jest wyróżniony na stronie (miga). |
| WF-16 | Strona pokazuje stan połączenia z API (na żywo albo brak połączenia). |
| WF-17 | Wyświetlacz fizyczny pokazuje 5 najlepszych wyników i odświeża je co 10 s. **Planowane**, sprzęt do ustalenia. |

## Wymagania niefunkcjonalne

- **Bezpieczeństwo**: klucze są tylko w zmiennych środowiskowych serwera, nie w kodzie. Klucz porównywany jest w stałym czasie. Brak skonfigurowanego klucza blokuje operację. Dane sprawdza API, a dodatkowo `CHECK` w bazie.
- **Uprawnienia**: dwa klucze z różnymi uprawnieniami. Klucz zapisu tylko dopisuje, klucz admina tylko usuwa.
- **Wydajność**: odpowiedź API w ok. 0,2 s. Ranking korzysta z indeksu `(score DESC, timestamp ASC)`.
- **Kompatybilność**: gra działa na micro:bicie V1 i V2 (uniwersalny plik `.hex`).
- **Koszt**: hosting (Vercel) i baza (Neon) na darmowych planach.
- **Wdrażanie**: każdy push na `main` automatycznie buduje i wdraża nową wersję. Nieudany build nie zastępuje działającej wersji.

## Komunikacja

| Od | Do | Co | Jak | Kiedy |
| --- | --- | --- | --- | --- |
| Gra (micro:bit) | Bramka | ramka z wynikiem | radio micro:bit | po zatwierdzeniu nicku |
| Bramka | API | wynik do zapisu | HTTPS `POST /api/scores`, JSON, klucz API | po odebraniu ramki |
| API | Baza | zapis, odczyt, usunięcie | SQL przez HTTPS (sterownik Neon) | przy każdym żądaniu |
| Strona | API | ranking i ostatnia gra | HTTPS `GET /api/scores`, JSON | co 2 s |
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
| `id` | tekst | identyfikator gracza (nick), 1–32 znaki |
| `wynik` | liczba całkowita | 0–99999, może przyjść jako tekst (`"123"`) |

### 3. ScoreDto (powstaje w API po walidacji)

| Pole | Typ | Skąd |
| --- | --- | --- |
| `playerId` | string | z pola `id` |
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

`GET` zwraca tablicę takich obiektów, a `POST` (`201`) i `DELETE` (`200`) zwracają jeden.

### 6. Błąd

```json
{ "error": "opis błędu" }
```

| Kod | Kiedy |
| --- | --- |
| `400` | niepoprawne dane albo `id` |
| `401` | brak klucza albo zły klucz |
| `404` | nie ma wyniku o takim `id` (usuwanie) |
| `500` | błąd bazy albo brak skonfigurowanego klucza na serwerze |
