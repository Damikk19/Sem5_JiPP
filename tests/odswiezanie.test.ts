import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { czyCzuwanie, LIMIT_CZASU_MS, noweGry, odpytuj, opoznienie } from "@/lib/odswiezanie";
import type { Score } from "@/lib/score";

// Która gra ma migać na stronie (WF-15). Ostatnie gry przychodzą od najnowszej.
function gra(id: string, minuta: number): Score {
  return { id, playerId: id, score: 1, timestamp: `2026-11-27T18:${String(minuta).padStart(2, "0")}:00.000Z` };
}

const A = gra("A", 1);
const B = gra("B", 2);
const C = gra("C", 3);
const D = gra("D", 4);

describe("nowe gry do wyróżnienia na stronie", () => {
  it("pierwsze pobranie niczego nie wyróżnia, tylko zapamiętuje stan", () => {
    expect(noweGry([C, B, A], undefined)).toEqual({ nowe: [], najnowsza: C.timestamp });
  });

  it("nowa gra po ostatnim sprawdzeniu miga", () => {
    expect(noweGry([D, C, B], C.timestamp)).toEqual({ nowe: ["D"], najnowsza: D.timestamp });
  });

  it("dwie gry między sprawdzeniami migają obie", () => {
    expect(noweGry([D, C, B, A], B.timestamp).nowe).toEqual(["D", "C"]);
  });

  it("nic nowego: nic nie miga", () => {
    expect(noweGry([C, B, A], C.timestamp)).toEqual({ nowe: [], najnowsza: C.timestamp });
  });

  it("usunięcie ostatniej gry nie sprawia, że poprzednia wygląda na nową", () => {
    expect(noweGry([C, B, A], D.timestamp)).toEqual({ nowe: [], najnowsza: D.timestamp });
  });

  it("po usunięciu ostatniej gry kolejna prawdziwa gra miga", () => {
    const poUsunieciu = noweGry([C, B, A], D.timestamp);
    const E = gra("E", 5);
    expect(noweGry([E, C, B, A], poUsunieciu.najnowsza).nowe).toEqual(["E"]);
  });

  it("pierwsza gra w pustej bazie miga", () => {
    expect(noweGry([], undefined)).toEqual({ nowe: [], najnowsza: null });
    expect(noweGry([A], null)).toEqual({ nowe: ["A"], najnowsza: A.timestamp });
  });

  it("po wyczyszczeniu całej bazy pamięta najnowszy czas", () => {
    expect(noweGry([], C.timestamp)).toEqual({ nowe: [], najnowsza: C.timestamp });
  });
});

describe("tempo odpytywania", () => {
  // Liczby wprost z wymagań: porównanie stałych między sobą przepuściłoby np. odpytywanie co 1 s
  it("normalnie co 5 s, po błędzie co 15 s, w czuwaniu co 30 min", () => {
    expect(opoznienie({ blad: false, czuwanie: false })).toBe(5_000);
    expect(opoznienie({ blad: true, czuwanie: false })).toBe(15_000);
    expect(opoznienie({ blad: false, czuwanie: true })).toBe(30 * 60_000);
    expect(opoznienie({ blad: true, czuwanie: true })).toBe(30 * 60_000);
  });

  it("zawieszone żądanie kończy się najpóźniej po 8 s", () => {
    expect(LIMIT_CZASU_MS).toBeGreaterThan(0);
    expect(LIMIT_CZASU_MS).toBeLessThanOrEqual(8_000);
  });

  it("czuwanie zaczyna się po godzinie bez nowej gry i bez ruchu na stronie", () => {
    const start = 1_000_000;
    const godzina = 60 * 60_000;
    expect(czyCzuwanie(start + godzina - 1, start)).toBe(false);
    expect(czyCzuwanie(start + godzina, start)).toBe(true);
  });
});

// Pętla odpytywania strony na fałszywych timerach: bez przeglądarki, ale na prawdziwym kodzie strony.
describe("pętla odpytywania strony", () => {
  const MINUTA = 60_000;
  const GODZINA = 60 * MINUTA;
  let ostatnie: Score[] = [];
  let tryb: "ok" | "wisi" | "blad" = "ok";
  let ukryta = false;
  let sygnaly: AbortSignal[] = [];
  let zdarzenia: { dane: string[][]; bledy: number; czuwanie: boolean[] };

  function pobierz(signal: AbortSignal) {
    sygnaly.push(signal);
    if (tryb === "wisi") return new Promise<never>(() => {});
    if (tryb === "blad") return Promise.reject(new Error("HTTP 500"));
    return Promise.resolve({ top: ostatnie, latest: ostatnie });
  }

  function start() {
    return odpytuj({
      pobierz,
      ukryta: () => ukryta,
      naDane: (_, nowe) => zdarzenia.dane.push(nowe),
      naBlad: () => zdarzenia.bledy++,
      naCzuwanie: (c) => zdarzenia.czuwanie.push(c),
    });
  }

  function graTeraz(id: string): Score {
    return { id, playerId: id, score: 1, timestamp: new Date().toISOString() };
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-11-27T18:00:00Z") });
    ostatnie = [];
    tryb = "ok";
    ukryta = false;
    sygnaly = [];
    zdarzenia = { dane: [], bledy: 0, czuwanie: [] };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pierwsze dane bez wyróżnień, nowa gra miga przy następnym pytaniu po 5 s", async () => {
    ostatnie = [graTeraz("A")];
    const petla = start();
    await vi.advanceTimersByTimeAsync(0);
    expect(zdarzenia.dane).toEqual([[]]);
    await vi.advanceTimersByTimeAsync(1_000);
    ostatnie = [graTeraz("B"), ...ostatnie];
    await vi.advanceTimersByTimeAsync(4_000);
    expect(zdarzenia.dane).toEqual([[], ["B"]]);
    petla.stop();
  });

  it("zawieszone pytanie kończy się błędem po 8 s, kolejne pytanie po 15 s", async () => {
    tryb = "wisi";
    const petla = start();
    await vi.advanceTimersByTimeAsync(7_999);
    expect(zdarzenia.bledy).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(zdarzenia.bledy).toBe(1);
    expect(sygnaly[0].aborted).toBe(true);
    tryb = "ok";
    await vi.advanceTimersByTimeAsync(14_999);
    expect(sygnaly).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sygnaly).toHaveLength(2);
    petla.stop();
  });

  it("przy graniu co 10 minut strona nie zasypia i pyta najwyżej 720 razy na godzinę", async () => {
    const petla = start();
    for (let m = 0; m < 120; m += 10) {
      ostatnie = [graTeraz(`G${m}`), ...ostatnie];
      await vi.advanceTimersByTimeAsync(10 * MINUTA);
    }
    expect(zdarzenia.czuwanie).not.toContain(true);
    // bez pytania startowego z chwili 0
    const naGodzine = (sygnaly.length - 1) / 2;
    expect(naGodzine).toBeGreaterThan(700);
    expect(naGodzine).toBeLessThanOrEqual(720);
    petla.stop();
  });

  it("bez gier i bez ruchu zasypia po godzinie i potem pyta najwyżej 2 razy na godzinę", async () => {
    const petla = start();
    await vi.advanceTimersByTimeAsync(GODZINA + 5_000);
    expect(zdarzenia.czuwanie.at(-1)).toBe(true);
    const przed = sygnaly.length;
    await vi.advanceTimersByTimeAsync(GODZINA);
    expect(sygnaly.length - przed).toBeLessThanOrEqual(2);
    petla.stop();
  });

  it("kliknięcie budzi z czuwania od razu i tylko raz, nawet przy wielu kliknięciach", async () => {
    const petla = start();
    await vi.advanceTimersByTimeAsync(GODZINA + 5_000);
    tryb = "wisi";
    const przed = sygnaly.length;
    for (let i = 0; i < 40; i++) petla.ruch();
    expect(sygnaly.length - przed).toBe(1);
    expect(zdarzenia.czuwanie.at(-1)).toBe(false);
    petla.stop();
  });

  it("karta w tle nie pyta API, a po powrocie pyta od razu", async () => {
    ukryta = true;
    const petla = start();
    await vi.advanceTimersByTimeAsync(MINUTA);
    expect(sygnaly).toHaveLength(0);
    ukryta = false;
    petla.powrot();
    expect(sygnaly).toHaveLength(1);
    petla.stop();
  });

  it("powrót w trakcie pytania przerywa poprzednie i zostaje jedna pętla", async () => {
    tryb = "wisi";
    const petla = start();
    tryb = "ok";
    petla.powrot();
    expect(sygnaly[0].aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(zdarzenia.bledy).toBe(0);
    const przed = sygnaly.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(sygnaly.length - przed).toBe(6);
    petla.stop();
  });

  it("powrót do karty między pytaniami nie tworzy drugiej pętli", async () => {
    const petla = start();
    await vi.advanceTimersByTimeAsync(2_000);
    petla.powrot();
    await vi.advanceTimersByTimeAsync(0);
    const przed = sygnaly.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(sygnaly.length - przed).toBe(6);
    petla.stop();
  });

  it("ukrycie karty w trakcie pytania: bez fałszywego błędu i bez drugiej pętli", async () => {
    tryb = "wisi";
    const petla = start();
    ukryta = true;
    petla.powrot();
    await vi.advanceTimersByTimeAsync(0);
    expect(zdarzenia.bledy).toBe(0);
    ukryta = false;
    tryb = "ok";
    petla.powrot();
    await vi.advanceTimersByTimeAsync(0);
    const przed = sygnaly.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(sygnaly.length - przed).toBe(6);
    petla.stop();
  });

  it("powrót do karty po ponad godzinie budzi z czuwania", async () => {
    const petla = start();
    await vi.advanceTimersByTimeAsync(2 * GODZINA);
    expect(zdarzenia.czuwanie.at(-1)).toBe(true);
    petla.powrot();
    await vi.advanceTimersByTimeAsync(0);
    expect(zdarzenia.czuwanie.at(-1)).toBe(false);
    petla.stop();
  });

  it("po zatrzymaniu (zamknięcie strony) nic już nie przychodzi i nic nie jest pytane", async () => {
    tryb = "wisi";
    const petla = start();
    petla.stop();
    expect(sygnaly[0].aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(GODZINA);
    expect(sygnaly).toHaveLength(1);
    expect(zdarzenia).toEqual({ dane: [], bledy: 0, czuwanie: [] });
  });
});
