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

Zapis wymaga klucza API (bez niego każdy mógłby dopisać dowolny wynik): nagłówek `Authorization: Bearer <klucz>`, `X-API-Key: <klucz>` albo `?key=<klucz>` w adresie. API sprawdza każde z tych miejsc, więc obcy nagłówek `Authorization` doklejany przez bramkę nie przeszkadza kluczowi podanemu w `X-API-Key` albo w adresie. Klucz jest w zmiennej `API_TOKEN` na Vercelu, nie w repo. Bez klucza: `401`. Klucz sprawdzany jest przed czytaniem body.

Klucz w konfiguracji musi mieć co najmniej 32 znaki, a `ADMIN_TOKEN` musi być inny niż `API_TOKEN`. Krótszy klucz serwer traktuje jak brak klucza, a przy dwóch takich samych blokuje usuwanie. Wtedy operacja odpowiada `500` z ogólnym komunikatem `Błąd konfiguracji serwera`, a to, który klucz i dlaczego, jest tylko w logu serwera.

- `id` to identyfikator gracza (nick), 1–32 znaki, bez znaków sterujących i zmieniających kierunek tekstu, z co najmniej jednym widocznym znakiem (emoji, także złożone, są w porządku). Bez niewidocznych i formatujących znaków w dowolnym miejscu (np. spacja zerowej szerokości, miękki dywiz, BOM, wypełniacz Hangul, U+FFF9): `400`. Wyjątki tylko w swoim miejscu: łącznik ZWJ między dwoma emoji (👩‍💻), znaki tagów tylko we flagach Anglii, Szkocji i Walii, a selektor wariantu tylko jako VS15/VS16 zaraz po emoji (❤️, ☺︎, ale nie po cyfrze, `#` ani `*`), VS16 w keycapie (cyfra, `#` albo `*`, potem VS16 i U+20E3, np. 1️⃣) albo selektor znaku CJK (U+FE00–FE0F, U+E0100–E01EF) zaraz po znaku CJK. Mongolskie selektory (U+180B–180D, U+180F) nie przechodzą nigdy. API zapisuje nick w jednej postaci: litery złożone (NFC, `ë` jako jeden znak) i jedna zwykła spacja zamiast każdej grupy spacji (także twardych), więc ten sam napis to zawsze ten sam nick
- `wynik` to liczba całkowita 0–99999 (może przyjść też jako tekst z samych cyfr, np. `"50"`; `"1e3"` czy `"12.5"` są odrzucane)
- odpowiedź `201` z zapisanym wynikiem, `200` z istniejącym wpisem, gdy ta sama gra przyszła drugi raz (duplikat), `400` z opisem błędu, `401` bez klucza, `413` przy body większym niż 1024 bajty, `429` z nagłówkiem `Retry-After` przy przekroczeniu limitu zapisów albo `500` przy błędzie serwera

`GET /api/scores?limit=10` (publiczny, bez klucza; `limit` 1–100 z samych cyfr, większa wartość jest przycinana do 100, a 0 do 1; brak albo coś innego, także liczba ujemna, daje 10) zwraca ranking od najlepszego wyniku (przy remisie wyżej jest ten, kto był pierwszy):

```json
[{ "id": "uuid", "playerId": "ABC", "score": 50, "timestamp": "2026-11-23T12:00:00.000Z" }]
```

`GET /api/scores?sort=latest&limit=1` zwraca ostatnią grę.

`GET /api/ranking` zwraca w jednym żądaniu dane dla strony: `{ "top": [...], "latest": [...] }`, czyli TOP 10 i 10 ostatnich gier (`500` przy błędzie serwera).

`DELETE /api/scores/{id}` usuwa wynik (np. testowy albo fałszywy). Wymaga osobnego klucza admina (`ADMIN_TOKEN`) w nagłówku `Authorization: Bearer` albo `X-API-Key` (nie w adresie, bo adres zostaje w logach), bo klucz do zapisu ma tylko dopisywać. Odpowiedź `200`, `400` (złe `id`), `401`, `404` albo `500` przy błędzie serwera. Lokalnie: `npm run usun -- <id>`.

`id` i `timestamp` nadaje baza, bo micro:bit nie ma zegara ani generatora UUID.

## Limity i ochrona przed nadużyciem

Hosting i baza są na darmowych planach (Vercel Hobby, Neon), a po przekroczeniu miesięcznego limitu Vercel wstrzymuje projekt (strona i API odpowiadają `503`) i projekt nie wraca sam. Dlatego API ogranicza to, co może zrobić skrypt albo pętla w Postmanie:

- **Rozmiar body**: najwyżej 1024 bajty (poprawne body ma ok. 25). Większe dostaje `413`: od razu według `Content-Length`, a bez tego nagłówka (np. `Transfer-Encoding: chunked`) po przeczytaniu 1024 bajtów.
- **Duplikaty**: zapis z tym samym wynikiem co ostatni wpis tego nicku z ostatnich 30 s to ta sama gra (radio może dostarczyć ramkę dwa razy, bramka może ponowić żądanie). API odpowiada `200` z istniejącym wpisem i nie dopisuje drugiego. Gry 0, 10, 0 tego samego nicku to trzy wpisy, bo duplikatem jest tylko powtórka ostatniego.
- **Ten sam nick**: inny wynik tego samego nicku szybciej niż po 5 s od poprzedniego zapisu dostaje `429`.
- **Kilku graczy naraz**: limity liczą się po nicku, więc gracze, którzy grają w tym samym czasie, potrzebują różnych nicków. Na kilku micro:bitach z domyślnym nickiem `AAA` gra skończona w ciągu 5 s od cudzej dostanie `429`, a ten sam wynik w ciągu 30 s zostanie uznany za duplikat.
- **Wszystkie zapisy**: najwyżej 30 nowych wpisów w ciągu ostatnich 60 s. Kolejny dostaje `429`.
- `429` ma nagłówek `Retry-After` z liczbą sekund, po której zapis przejdzie. Limity sprawdza baza w jednej transakcji z blokadą, więc działają także przy równoległych żądaniach. Wszystkie liczby są w `lib/limity.ts`.

Publiczne odczyty (`GET /api/scores`, `GET /api/ranking`) mają przy odpowiedzi `200` nagłówek `Vercel-CDN-Cache-Control: max-age=5, stale-while-revalidate=25`. Odpowiedź jest świeża przez 5 s, a przez kolejne 25 s CDN Vercela oddaje ją dalej i w tle pyta funkcję o nową. CDN odpowiada wtedy sam, bez wywołania funkcji i bez zapytania do bazy, więc funkcja dostaje najwyżej jedno pytanie na ok. 5 s na adres, niezależnie od liczby widzów. Skutek: ranking jest opóźniony do ok. 10 s. Przez kilka sekund po zapisie albo usunięciu (do ok. 10 s) GET i strona mogą pokazywać stan sprzed zmiany. Po dłuższej przerwie bez pytań pierwszy GET może jeszcze dostać zapamiętaną odpowiedź (najwyżej 30 s starą), a CDN pobiera wtedy w tle nową. Błędy (`500`), zapisy i usunięcia nigdy nie trafiają do cache.

Cache CDN zmniejsza koszt zwykłego odpytywania, ale nie jest zabezpieczeniem: da się go ominąć. Każdy inny adres to osobny wpis w cache (np. losowe `?x=123`), żądanie z nagłówkiem `Authorization` nie jest brane z cache wcale, a Next.js dopisuje do odpowiedzi `Vary` (m.in. `rsc`, `next-router-state-tree`, `Accept-Encoding`), więc inne wartości tych nagłówków też dają osobne wpisy. Takie żądania wywołują funkcję i pytają bazę, a zatrzymuje je dopiero reguła Firewalla opisana niżej. Dlatego warto co jakiś czas sprawdzić zużycie (Vercel → Usage, konsola Neona).

Przed zalewem żądań chroni też reguła Firewalla Vercela. Jest ustawiana w panelu (Vercel → projekt → Firewall), nie w repo: rate limit dla ścieżek zaczynających się od `/api`, klucz IP, okno 60 s, 200 żądań, potem `429`. 200 na minutę mieści całą salę za jednym adresem IP (strona pyta 12 razy na minutę na kartę), a zatrzymuje pętle i skrypty. Żądania zatrzymane przez Firewall nie wywołują funkcji i nie liczą się do limitów planu. Zmiana reguły działa od razu, bez wdrażania.

Każdy udany zapis, duplikat i usunięcie zostawia w logach serwera (Vercel → Logs) jedną linię, np. `POST /api/scores zapisany id=... nick="ABC" wynik=50`. Bez kluczy i bez adresów IP.

### Sprzątanie po zalewie

1. W Vercel → Logs znaleźć linie `POST /api/scores zapisany` z zalewu i odczytać zakres czasu.
2. Vercel → Storage → baza → Query (albo SQL Editor w konsoli Neona): najpierw podgląd wierszy z tego zakresu, potem usunięcie tych samych wierszy jednym poleceniem:

```sql
SELECT id, player_id, score, "timestamp" FROM scores
WHERE "timestamp" BETWEEN '2026-12-01 10:00:00+01' AND '2026-12-01 10:15:00+01'
ORDER BY "timestamp";

DELETE FROM scores
WHERE "timestamp" BETWEEN '2026-12-01 10:00:00+01' AND '2026-12-01 10:15:00+01'
RETURNING id, player_id, score, "timestamp";
```

Pojedyncze wpisy usuwa `npm run usun -- <id>`. Ranking na stronie odświeży się po ok. 10 s (cache CDN).

## Kod

- `app/api/scores/route.ts` - GameController (POST, GET)
- `app/api/ranking/route.ts` - dane dla strony z rankingiem (GET)
- `app/api/scores/[id]/route.ts` - usuwanie wyniku (DELETE)
- `lib/auth.ts` - klucze: `API_TOKEN` do zapisu, `ADMIN_TOKEN` do usuwania
- `lib/scoreValidator.ts` - sprawdza body od bramki
- `lib/limity.ts` - limity: rozmiar body, duplikaty, odstęp nicku, zapisy na minutę
- `lib/scoreRepository.ts` - zapis i ranking w bazie
- `app/leaderboard.tsx` - ranking na stronie, odświeżany co 5 s, nowe wyniki migają
- `lib/odswiezanie.ts` - które gry są nowe i jak często pytać API (po godzinie bez gier co 30 min, żeby baza mogła zasnąć)
- `db/schema.sql` - tabela `scores` i indeksy
- `next.config.ts` - nagłówki bezpieczeństwa (CSP, `nosniff`, `Referrer-Policy`), bez `X-Powered-By`
- `microbit/main.ts` - gra RAM INVADERS w MakeCode (opis w `microbit/README.md`)

## Testy i CI

`npm test` uruchamia testy (Vitest):

- `tests/scoreValidator.test.ts` - umowa z bramką: format `{ id, wynik }`, granice zakresu, wynik jako tekst, nick w jednej postaci, niewidoczne znaki odrzucane i emoji złożone dalej przyjmowane
- `tests/auth.test.ts` - klucze: brak albo za krótki klucz na serwerze blokuje operację, ten sam klucz w obu zmiennych blokuje usuwanie, klucz bramki nie usuwa, klucz admina nie działa w adresie
- `tests/api.test.ts` - kody odpowiedzi API (także `200` przy duplikacie, `413`, `429` z `Retry-After`), cache CDN tylko przy udanym GET, ślad w logach i to, że bez klucza nic nie trafia do bazy
- `tests/scoreRepository.test.ts` - prawdziwe zapytania SQL na Postgresie w pamięci (PGlite) z tym samym `db/schema.sql`: kolejność rankingu, remisy, `CHECK`, format czasu, limity zapisów (wiersze ze znanym czasem po obu stronach każdej granicy) i to, że zapytania po czasie idą indeksem
- `tests/zapisNeon.test.ts` - zapis przez prawdziwy sterownik Neon (bez sieci): blokada i zapis idą razem jako jedna transakcja
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
echo "API_TOKEN=$(openssl rand -hex 24)" >> .env.local
echo "ADMIN_TOKEN=$(openssl rand -hex 24)" >> .env.local
npm run db:init
npm run dev
npm test
```

## Status

- [x] API + baza
- [x] strona z rankingiem
- [x] gra w MakeCode (do potwierdzenia: grupa radia i format ramki)
- [ ] wyświetlacz fizyczny
