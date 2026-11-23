# Sem5_JiPP

Gra zręcznościowa na micro:bicie. Po grze wynik i nick gracza trafiają do bazy, a ranking widać na stronie i na fizycznym wyświetlaczu.

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

- `id` to identyfikator gracza (nick), 1–32 znaki
- `wynik` to liczba całkowita 0–99999 (może przyjść też jako tekst, np. `"50"`)
- odpowiedź `201` z zapisanym wynikiem albo `400` z opisem błędu

`GET /api/scores?limit=10` zwraca ranking od najlepszego wyniku (przy remisie wyżej jest ten, kto był pierwszy):

```json
[{ "id": "uuid", "playerId": "ABC", "score": 50, "timestamp": "2026-11-23T12:00:00.000Z" }]
```

`id` i `timestamp` nadaje baza, bo micro:bit nie ma zegara ani generatora UUID.

## Kod

- `app/api/scores/route.ts` - GameController (POST, GET)
- `lib/scoreValidator.ts` - sprawdza body od bramki
- `lib/scoreRepository.ts` - zapis i ranking w bazie
- `db/schema.sql` - tabela `scores`

## Uruchomienie lokalnie

```
npm install
echo 'DATABASE_URL=postgres://...' > .env.local
npm run db:init
npm run dev
```

## Status

- [x] API + baza
- [ ] strona z rankingiem
- [ ] gra w MakeCode
- [ ] wyświetlacz fizyczny
