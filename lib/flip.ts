// Przesuwanie wierszy tabeli techniką FLIP: wiersz po zmianie danych startuje z miejsca, w którym był,
// i wraca na nowe. Skokowo jak na starym sprzęcie (co ok. 8 px), nie płynnie.

export const FLIP_MS = 500;
export const KROK_PX = 8;

// Skala ekranu względem układu strony. Tryb TV ma zoom: getBoundingClientRect podaje piksele na ekranie,
// a przesunięcie (transform) działa w pikselach układu, więc przy powiększeniu 1,5 bez dzielenia
// wiersz przeskoczyłby półtora raza za daleko.
export function skala(wysokoscNaEkranie: number, wysokoscUkladu: number) {
  if (!(wysokoscNaEkranie > 0) || !(wysokoscUkladu > 0)) return 1;
  return wysokoscNaEkranie / wysokoscUkladu;
}

// Przesunięcia wierszy (po id) w pikselach układu: o ile wiersz ma startować od nowego miejsca.
// przed, po: górna krawędź wiersza na ekranie przed zmianą danych i po niej.
// Wiersz nowy w TOP 10 nie ma pozycji „przed”, więc nie wjeżdża (miga). Wiersz, który wypadł, po prostu znika.
export function przesuniecia(przed: Map<string, number>, po: Map<string, number>, skalaEkranu: number) {
  const wynik = new Map<string, number>();
  if (!(skalaEkranu > 0)) return wynik;
  for (const [id, y] of po) {
    const stary = przed.get(id);
    if (stary === undefined) continue;
    const dy = (stary - y) / skalaEkranu;
    // Ułamek piksela to zaokrąglenie przeglądarki, nie ruch
    if (Math.abs(dy) >= 1) wynik.set(id, dy);
  }
  return wynik;
}

// Animacja jednego wiersza: od starego miejsca do nowego w skokach po ok. 8 px
export function ruch(dy: number) {
  const kroki = Math.max(1, Math.round(Math.abs(dy) / KROK_PX));
  return {
    klatki: [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
    opcje: { duration: FLIP_MS, easing: `steps(${kroki}, end)` },
  };
}
