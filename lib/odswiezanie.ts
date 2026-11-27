import type { Score } from "./score";

// Jak często strona z rankingiem pyta API. Każde pytanie to wywołanie funkcji na Vercelu
// i zapytanie do bazy, a darmowe plany mają miesięczne limity, więc strona nie pyta częściej niż trzeba.
export const ODSWIEZANIE_MS = 5_000;
export const PO_BLEDZIE_MS = 15_000;
export const LIMIT_CZASU_MS = 8_000;
// Po godzinie bez nowej gry i bez ruchu na stronie (np. projektor zostawiony na noc) strona pyta
// co 30 minut, żeby baza mogła zasnąć. Kliknięcie albo powrót do karty od razu ją budzi.
export const CZUWANIE_PO_MS = 60 * 60_000;
export const W_CZUWANIU_MS = 30 * 60_000;

// Nowe gry to te zapisane później niż najnowsza znana. Liczy się czas, nie id: po usunięciu
// ostatniej gry poprzednia nie może wyglądać na nową. Przy pierwszym pobraniu nic nie jest nowe.
// najnowszaZnana: undefined = jeszcze nic nie pobrano, null = pobrano, ale baza była pusta.
export function noweGry(ostatnie: Score[], najnowszaZnana: string | null | undefined) {
  const najnowszaTeraz = ostatnie[0]?.timestamp ?? null;
  const najnowsza =
    najnowszaZnana && (!najnowszaTeraz || najnowszaZnana > najnowszaTeraz) ? najnowszaZnana : najnowszaTeraz;
  if (najnowszaZnana === undefined) return { nowe: [] as string[], najnowsza };
  const nowe = ostatnie.filter((g) => najnowszaZnana === null || g.timestamp > najnowszaZnana).map((g) => g.id);
  return { nowe, najnowsza };
}

export function czyCzuwanie(teraz: number, ostatniaAktywnosc: number) {
  return teraz - ostatniaAktywnosc >= CZUWANIE_PO_MS;
}

export function opoznienie(stan: { blad: boolean; czuwanie: boolean }) {
  if (stan.czuwanie) return W_CZUWANIU_MS;
  return stan.blad ? PO_BLEDZIE_MS : ODSWIEZANIE_MS;
}
