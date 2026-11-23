# Sem5_JiPP

Gra zręcznościowa na micro:bicie. Po grze wynik i nick gracza trafiają do bazy, a ranking widać na stronie i na fizycznym wyświetlaczu.

Na żywo: https://sem5-jipp.vercel.app · API: https://sem5-jipp.vercel.app/api/scores

## Jak to działa

```
micro:bit (gra) --radio--> bramka prowadzącego --HTTP POST--> API (Next.js, Vercel) --> PostgreSQL (Neon)
                                                              API --GET--> strona z rankingiem, wyświetlacz
```

Bramkę robi prowadzący: odbiera wynik przez radio i wysyła go do naszego API. Diagram C4: `docs/c4-ranking.pdf`.

## API

`POST /api/scores` zapisuje wynik. Body w formacie bramki:

```json
{ "id": "ABC", "wynik": 50 }
```

Zapis wymaga klucza API (bez niego każdy mógłby dopisać dowolny wynik): nagłówek `Authorization: Bearer <klucz>`, `X-API-Key: <klucz>` albo `?key=<klucz>` w adresie. Klucz jest w zmiennej `API_TOKEN` na Vercelu, nie w repo. Bez klucza: `401`.

- `id` to identyfikator gracza (nick), 1–32 znaki
- `wynik` to liczba całkowita 0–99999 (może przyjść też jako tekst, np. `"50"`)
- odpowiedź `201` z zapisanym wynikiem, `400` z opisem błędu albo `401` bez klucza

`GET /api/scores?limit=10` (publiczny, bez klucza) zwraca ranking od najlepszego wyniku (przy remisie wyżej jest ten, kto był pierwszy):

```json
[{ "id": "uuid", "playerId": "ABC", "score": 50, "timestamp": "2026-11-23T12:00:00.000Z" }]
```

`GET /api/scores?sort=latest&limit=1` zwraca ostatnią grę (pasek „ostatnia gra” na stronie).

`id` i `timestamp` nadaje baza, bo micro:bit nie ma zegara ani generatora UUID.

## Kod

- `app/api/scores/route.ts` - GameController (POST, GET)
- `lib/auth.ts` - sprawdza klucz API przy zapisie
- `lib/scoreValidator.ts` - sprawdza body od bramki
- `lib/scoreRepository.ts` - zapis i ranking w bazie
- `app/leaderboard.tsx` - ranking na stronie, odświeżany co 2 s, nowy wynik miga
- `db/schema.sql` - tabela `scores`
- `microbit/main.ts` - gra RAM ATAK w MakeCode (opis w `microbit/README.md`)

## Uruchomienie lokalnie

```
npm install
echo 'DATABASE_URL=postgres://...' >> .env.local
echo 'API_TOKEN=dowolny-dlugi-klucz' >> .env.local
npm run db:init
npm run dev
```

## Status

- [x] API + baza
- [x] strona z rankingiem
- [x] gra w MakeCode (do potwierdzenia: grupa radia i format ramki)
- [ ] wyświetlacz fizyczny
