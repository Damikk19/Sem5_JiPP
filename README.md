# Sem5_JiPP

[![CI](https://github.com/Damikk19/Sem5_JiPP/actions/workflows/ci.yml/badge.svg)](https://github.com/Damikk19/Sem5_JiPP/actions/workflows/ci.yml)

Gra zręcznościowa na micro:bicie. Po grze wynik i nick gracza trafiają do bazy, a ranking widać na stronie (fizyczny wyświetlacz jest planowany, sprzęt do ustalenia z prowadzącym).

Na żywo: https://sem5-jipp.vercel.app · API: https://sem5-jipp.vercel.app/api/scores

## Jak to działa

```
micro:bit (gra) --radio--> bramka prowadzącego --HTTP POST--> API (Next.js, Vercel) --> PostgreSQL (Neon)
                                                              API --GET--> strona z rankingiem, wyświetlacz
```

Bramkę robi prowadzący: odbiera wynik przez radio i wysyła go do naszego API. Diagram C4: `docs/c4-ranking.pdf`, wymagania funkcjonalne i struktury danych: `docs/wymagania.md`.

## API

`POST /api/scores` zapisuje wynik. Body w formacie bramki:

```json
{ "id": "ABC", "wynik": 50 }
```

Zapis wymaga klucza API (bez niego każdy mógłby dopisać dowolny wynik): nagłówek `Authorization: Bearer <klucz>`, `X-API-Key: <klucz>` albo `?key=<klucz>` w adresie. API sprawdza każde z tych miejsc, więc obcy nagłówek `Authorization` doklejany przez bramkę nie przeszkadza kluczowi podanemu w `X-API-Key` albo w adresie. Klucz jest w zmiennej `API_TOKEN` na Vercelu, nie w repo. Bez klucza: `401`.

- `id` to identyfikator gracza (nick), 1–32 znaki, bez znaków sterujących i niewidocznych
- `wynik` to liczba całkowita 0–99999 (może przyjść też jako tekst z samych cyfr, np. `"50"`; `"1e3"` czy `"12.5"` są odrzucane)
- odpowiedź `201` z zapisanym wynikiem, `400` z opisem błędu, `401` bez klucza albo `500` przy błędzie serwera

`GET /api/scores?limit=10` (publiczny, bez klucza; `limit` 1–100, wartość spoza zakresu jest przycinana, a brak albo coś innego niż liczba daje 10) zwraca ranking od najlepszego wyniku (przy remisie wyżej jest ten, kto był pierwszy):

```json
[{ "id": "uuid", "playerId": "ABC", "score": 50, "timestamp": "2026-11-23T12:00:00.000Z" }]
```

`GET /api/scores?sort=latest&limit=1` zwraca ostatnią grę.

`GET /api/ranking` zwraca w jednym żądaniu dane dla strony: `{ "top": [...], "latest": [...] }`, czyli TOP 10 i 10 ostatnich gier.

`DELETE /api/scores/{id}` usuwa wynik (np. testowy albo fałszywy). Wymaga osobnego klucza admina (`ADMIN_TOKEN`) w nagłówku `Authorization: Bearer` albo `X-API-Key` (nie w adresie, bo adres zostaje w logach), bo klucz do zapisu ma tylko dopisywać. Odpowiedź `200`, `400` (złe `id`), `401`, `404` albo `500` przy błędzie serwera. Lokalnie: `npm run usun -- <id>`.

`id` i `timestamp` nadaje baza, bo micro:bit nie ma zegara ani generatora UUID.

## Kod

- `app/api/scores/route.ts` - GameController (POST, GET)
- `app/api/ranking/route.ts` - dane dla strony z rankingiem (GET)
- `app/api/scores/[id]/route.ts` - usuwanie wyniku (DELETE)
- `lib/auth.ts` - klucze: `API_TOKEN` do zapisu, `ADMIN_TOKEN` do usuwania
- `lib/scoreValidator.ts` - sprawdza body od bramki
- `lib/scoreRepository.ts` - zapis i ranking w bazie
- `app/leaderboard.tsx` - ranking na stronie, odświeżany co 5 s, nowe wyniki migają
- `lib/odswiezanie.ts` - które gry są nowe i jak często pytać API (po godzinie bez gier co 30 min, żeby baza mogła zasnąć)
- `db/schema.sql` - tabela `scores` i indeksy
- `next.config.ts` - nagłówki bezpieczeństwa (CSP, `nosniff`, `Referrer-Policy`)
- `microbit/main.ts` - gra RAM INVADERS w MakeCode (opis w `microbit/README.md`)

## Testy i CI

`npm test` uruchamia testy (Vitest):

- `tests/scoreValidator.test.ts` - umowa z bramką: format `{ id, wynik }`, granice zakresu, wynik jako tekst
- `tests/auth.test.ts` - klucze: brak klucza na serwerze blokuje operację, klucz bramki nie usuwa, klucz admina nie działa w adresie
- `tests/api.test.ts` - kody odpowiedzi API i to, że bez klucza nic nie trafia do bazy
- `tests/scoreRepository.test.ts` - prawdziwe zapytania SQL na Postgresie w pamięci (PGlite) z tym samym `db/schema.sql`: kolejność rankingu, remisy, `CHECK`, format czasu
- `tests/odswiezanie.test.ts` - które gry migają (także po usunięciu wpisu) i tempo odpytywania
- `tests/log.test.ts` - hasło do bazy nie trafia do logów
- `tests/usunWynik.test.ts` - skrypt usuwania wysyła klucz admina tylko na adres wyniku

Testy sprawdziłem, celowo psując kod (m.in. usunięcie sprawdzania klucza, odwrócony remis, zła granica wyniku). Każdą taką zmianę wykrywają.

GitHub Actions (`.github/workflows/ci.yml`) przy pushu na `main` i przy pull requeście sprawdza lint, typy, testy i build. Wdrożenie (CD) robi Vercel po pushu na `main`.

Gry na micro:bicie nie da się testować w Node (to kod MakeCode), więc testowałem ją w symulatorze MakeCode.

## Uruchomienie lokalnie

```
npm install
echo 'DATABASE_URL=postgres://...' >> .env.local
echo 'API_TOKEN=dowolny-dlugi-klucz' >> .env.local
echo 'ADMIN_TOKEN=inny-dlugi-klucz' >> .env.local
npm run db:init
npm run dev
npm test
```

## Status

- [x] API + baza
- [x] strona z rankingiem
- [x] gra w MakeCode (do potwierdzenia: grupa radia i format ramki)
- [ ] wyświetlacz fizyczny
