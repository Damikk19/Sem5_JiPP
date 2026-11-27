import { describe, expect, it } from "vitest";
import {
  CZUWANIE_PO_MS,
  czyCzuwanie,
  noweGry,
  ODSWIEZANIE_MS,
  opoznienie,
  PO_BLEDZIE_MS,
  W_CZUWANIU_MS,
} from "@/lib/odswiezanie";
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
  it("normalnie co 5 s, po błędzie rzadziej, w czuwaniu co 30 min", () => {
    expect(opoznienie({ blad: false, czuwanie: false })).toBe(ODSWIEZANIE_MS);
    expect(opoznienie({ blad: true, czuwanie: false })).toBe(PO_BLEDZIE_MS);
    expect(opoznienie({ blad: false, czuwanie: true })).toBe(W_CZUWANIU_MS);
    expect(opoznienie({ blad: true, czuwanie: true })).toBe(W_CZUWANIU_MS);
    expect(ODSWIEZANIE_MS).toBeLessThan(PO_BLEDZIE_MS);
    expect(PO_BLEDZIE_MS).toBeLessThan(W_CZUWANIU_MS);
  });

  it("czuwanie zaczyna się po godzinie bez nowej gry i bez ruchu na stronie", () => {
    const start = 1_000_000;
    expect(czyCzuwanie(start + CZUWANIE_PO_MS - 1, start)).toBe(false);
    expect(czyCzuwanie(start + CZUWANIE_PO_MS, start)).toBe(true);
  });
});
