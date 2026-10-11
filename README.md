# Sem5_JiPP

Gra zręcznościowa na micro:bicie. Po grze wynik i nick gracza trafiają do bazy, a ranking widać na stronie i na samym micro:bicie.

## Jak to działa

```
micro:bit (gra) --USB--> przeglądarka (Web Serial) --> Next.js API --> PostgreSQL
```

micro:bit nie ma WiFi, więc jest podłączony kablem USB do laptopa. Po grze wysyła wynik i nick, a strona otwarta w Chrome odbiera je i wysyła do API. Gra się po kolei, jak na automacie.

## Narzędzia

- micro:bit + MakeCode - gra, nick z 3 liter wybierany przyciskami A/B
- USB (port szeregowy) - wynik z micro:bita do komputera
- Web Serial - odczyt z USB w przeglądarce, bez instalowania niczego
- Next.js - strona z rankingiem i API w jednym projekcie
- PostgreSQL (Neon) + Prisma - gracze i wyniki
- Tailwind + shadcn/ui - wygląd strony
- Vercel - hosting

Ranking na urządzeniu: po grze micro:bit przewija top 3 na diodach. Jak starczy czasu, dojdzie Arduino z wyświetlaczem OLED.

## Status

Na razie wybór narzędzi, kod w trakcie.
