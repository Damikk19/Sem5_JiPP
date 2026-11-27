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

export type Ranking = { top: Score[]; latest: Score[] };

type Opcje = {
  pobierz: (signal: AbortSignal) => Promise<Ranking>;
  ukryta: () => boolean;
  naDane: (dane: Ranking, nowe: string[]) => void;
  naBlad: () => void;
  naCzuwanie: (czuwanie: boolean) => void;
};

// Odrzuca, gdy pytanie zostanie przerwane (limit czasu albo nowsze pytanie), nawet jeśli samo pobieranie
// nie reaguje na sygnał
function przerwanie(signal: AbortSignal) {
  return new Promise<never>((_, odrzuc) => {
    signal.addEventListener("abort", () => odrzuc(new Error("przerwane")), { once: true });
  });
}

// Pętla odpytywania strony z rankingiem. Pytania nigdy się nie nakładają: nowe pytanie przerywa poprzednie.
// Zwraca funkcje dla zdarzeń strony (powrót do karty, kliknięcie albo klawisz) i do zatrzymania.
export function odpytuj(o: Opcje) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let biezace: AbortController | null = null;
  let najnowsza: string | null | undefined = undefined;
  let aktywnosc = Date.now();
  let czuwa = false;

  async function tick() {
    clearTimeout(timer);
    biezace?.abort();
    let blad = false;

    // Karta w tle nie odpytuje API
    if (!o.ukryta()) {
      const ctrl = new AbortController();
      biezace = ctrl;
      // Bez limitu czasu zawieszone połączenie trzymałoby stare dane z napisem, że wszystko działa
      const limit = setTimeout(() => ctrl.abort(), LIMIT_CZASU_MS);
      try {
        const dane = await Promise.race([o.pobierz(ctrl.signal), przerwanie(ctrl.signal)]);
        if (stopped || biezace !== ctrl) return;
        const wynik = noweGry(dane.latest, najnowsza);
        najnowsza = wynik.najnowsza;
        if (wynik.nowe.length > 0) aktywnosc = Date.now();
        o.naDane(dane, wynik.nowe);
      } catch {
        // Przerwane przez nowsze pytanie albo zamknięcie strony: tym zajmuje się nowsze wywołanie
        if (stopped || biezace !== ctrl) return;
        blad = true;
        o.naBlad();
      } finally {
        clearTimeout(limit);
      }
    }

    if (stopped) return;
    czuwa = czyCzuwanie(Date.now(), aktywnosc);
    o.naCzuwanie(czuwa);
    timer = setTimeout(tick, opoznienie({ blad, czuwanie: czuwa }));
  }

  tick();

  return {
    // Powrót do karty: od razu świeże dane zamiast czekania na następne pytanie
    powrot() {
      if (stopped || o.ukryta()) return;
      aktywnosc = Date.now();
      tick();
    },
    // Kliknięcie albo klawisz budzi stronę z czuwania. Tylko pierwsze: kolejne (np. przytrzymany klawisz)
    // nie wysyłają kolejnych pytań.
    ruch() {
      aktywnosc = Date.now();
      if (stopped || !czuwa) return;
      czuwa = false;
      o.naCzuwanie(false);
      tick();
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      biezace?.abort();
    },
  };
}
