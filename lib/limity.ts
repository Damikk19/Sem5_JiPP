// Limity, które chronią ranking i darmowe plany (Vercel Hobby, Neon) przed zalewem żądań.
// Wszystkie w jednym miejscu, żeby kod, testy i dokumentacja mówiły o tych samych liczbach.

// Poprawne body od bramki, np. {"id":"ABC","wynik":123}, ma ok. 25 bajtów. Nawet najdłuższy nick (32 znaki
// spoza ASCII, zapisane w JSON jako \uXXXX) daje ok. 410 bajtów. 1 KB to duży zapas, a większego body
// nie ma po co czytać.
export const MAX_BODY_BAJTOW = 1024;
