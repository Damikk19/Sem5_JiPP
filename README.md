# Sem5_JiPP

Gra zręcznościowa na micro:bicie. Po grze wynik i nick gracza trafiają do bazy, a ranking widać na stronie i na samym micro:bicie.

## Jak to działa

```
micro:bit (gra) --radio--> micro:bit (odbiornik na USB) --> przeglądarka (Web Serial) --> Next.js API --> PostgreSQL
```

micro:bit nie ma WiFi, więc wynik leci radiem do drugiego micro:bita podpiętego do laptopa. Strona otwarta w Chrome czyta go z USB i wysyła do API. Dzięki temu gra się bez kabla, a jeden odbiornik obsłuży kilku graczy.

## Narzędzia

- micro:bit + MakeCode - gra, nick z 3 liter wybierany przyciskami A/B
- radio micro:bita - wysyłka wyniku do odbiornika
- Web Serial - odczyt z USB w przeglądarce, bez instalowania niczego
- Next.js - strona z rankingiem i API w jednym projekcie
- PostgreSQL (Neon) + Prisma - gracze i wyniki
- Tailwind + shadcn/ui - wygląd strony
- Vercel - hosting

Ranking na urządzeniu: odbiornik przewija top 3 na diodach. Jak starczy czasu, dojdzie Arduino z wyświetlaczem OLED.

## Status

Na razie wybór narzędzi, kod w trakcie.
