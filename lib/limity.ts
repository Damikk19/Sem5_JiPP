// Limity, które chronią ranking i darmowe plany (Vercel Hobby, Neon) przed zalewem żądań.
// Wszystkie w jednym miejscu, żeby kod, testy i dokumentacja mówiły o tych samych liczbach.

// Poprawne body od bramki, np. {"id":"ABC","wynik":123}, ma ok. 25 bajtów. Nawet najdłuższy nick (32 znaki
// spoza ASCII, zapisane w JSON jako \uXXXX) daje ok. 410 bajtów. 1 KB to duży zapas, a większego body
// nie ma po co czytać.
export const MAX_BODY_BAJTOW = 1024;

// Limity zapisów w bazie (POST /api/scores). Sprawdza je baza w jednej transakcji, więc działają także przy
// wielu równoległych żądaniach i na wielu instancjach funkcji naraz.

// Ten sam nick i ten sam wynik w ciągu 30 s to ta sama gra: radio może dostarczyć ramkę dwa razy, a bramka
// może ponowić żądanie po zerwanym połączeniu. API odpowiada wtedy 200 z istniejącym wpisem zamiast dopisywać
// drugi. Dwie różne gry z tym samym wynikiem w 30 s zdarzają się tylko przy bardzo krótkich partiach, a wtedy
// pominięty drugi wpis nie zmienia rankingu (przy remisie i tak wyżej jest wcześniejszy).
export const DUPLIKAT_S = 30;

// Dwie prawdziwe gry jednego nicku dzieli cała partia (nawet przegrana bez jednego strzału trwa ok. 7 s)
// i zatwierdzenie nicku, więc inny wynik tego samego nicku po mniej niż 5 s to pomyłka albo skrypt: 429.
export const ODSTEP_NICKU_S = 5;

// Najwyżej 30 nowych wpisów na minutę łącznie (każdy nick). Sala z kilkunastoma micro:bitami robi kilka
// zapisów na minutę, a zalew skryptem zatrzymuje się po 30 wierszach na minutę zamiast tysięcy.
export const OKNO_S = 60;
export const MAX_ZAPISOW_W_OKNIE = 30;
