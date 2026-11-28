// Ekran pokazowy jak na automacie: po minucie bez nowej gry i bez ruchu na stronie w miejscu tabeli
// na zmianę leci demo gry (10 s) i wraca tabela (20 s).

// Duży ekran (projektor, monitor). Musi się zgadzać z media query trybu TV w app/globals.css
// (układ w dwóch kolumnach), bo pokaz zajmuje miejsce tabeli w prawej kolumnie.
export const DUZY_EKRAN = "(min-width: 1250px) and (min-height: 760px)";
export const OGRANICZONY_RUCH = "(prefers-reduced-motion: reduce)";

export const PO_BEZCZYNNOSCI_MS = 60_000;
export const POKAZ_MS = 10_000;
export const TABELA_MS = 20_000;

// Czy teraz widać pokaz i za ile ms to się zmieni. odAktywnosci: ms od ostatniej nowej gry,
// kliknięcia, klawisza albo powrotu do karty.
export function faza(odAktywnosci: number): { pokaz: boolean; doZmiany: number } {
  const t = Math.max(0, odAktywnosci);
  if (t < PO_BEZCZYNNOSCI_MS) return { pokaz: false, doZmiany: PO_BEZCZYNNOSCI_MS - t };
  const wCyklu = (t - PO_BEZCZYNNOSCI_MS) % (POKAZ_MS + TABELA_MS);
  if (wCyklu < POKAZ_MS) return { pokaz: true, doZmiany: POKAZ_MS - wCyklu };
  return { pokaz: false, doZmiany: POKAZ_MS + TABELA_MS - wCyklu };
}

export type Warunki = {
  duzyEkran: boolean;
  ograniczonyRuch: boolean;
  // karta na wierzchu
  widoczna: boolean;
  // dane z API przychodzą (nie „BRAK SYGNAŁU” i nie wczytywanie)
  polaczenie: boolean;
  // otwarty ekran rekordu
  rekord: boolean;
};

// Pokaz tylko na dużym ekranie (na telefonie i w małym oknie nie przeszkadza w czytaniu), bez ograniczonego
// ruchu, na widocznej karcie, przy działającym API i nie w trakcie ekranu rekordu
export function moznaPokazac(w: Warunki) {
  return w.duzyEkran && !w.ograniczonyRuch && w.widoczna && w.polaczenie && !w.rekord;
}
