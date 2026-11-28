import { describe, expect, it } from "vitest";
import { FLIP_MS, przesuniecia, ruch, skala } from "@/lib/flip";

// Przesuwanie wierszy po zmianie danych (WF-15)
const WIERSZ = 40;

// Górne krawędzie wierszy na ekranie: kolejne id jeden pod drugim
function uklad(ids: string[], wysokosc = WIERSZ, od = 300) {
  return new Map(ids.map((id, i) => [id, od + i * wysokosc]));
}

describe("przesunięcia wierszy", () => {
  it("nowa gra na 1. miejscu: wszystkie stare wiersze startują o wiersz wyżej (ujemne przesunięcie)", () => {
    const dy = przesuniecia(uklad(["A", "B", "C"]), uklad(["N", "A", "B", "C"]), 1);
    expect([...dy]).toEqual([
      ["A", -WIERSZ],
      ["B", -WIERSZ],
      ["C", -WIERSZ],
    ]);
  });

  it("nowy wiersz nie wjeżdża, a wiersze nad nim się nie ruszają", () => {
    const dy = przesuniecia(uklad(["A", "B", "C"]), uklad(["A", "N", "B", "C"]), 1);
    expect(dy.has("N")).toBe(false);
    expect(dy.has("A")).toBe(false);
    expect(dy.get("B")).toBe(-WIERSZ);
  });

  it("wiersz, który wypadł z TOP 10, nie ma przesunięcia", () => {
    const przed = uklad(["A", "B", "C"]);
    const po = uklad(["N", "A", "B"]);
    const dy = przesuniecia(przed, po, 1);
    expect(dy.has("C")).toBe(false);
    expect(dy.size).toBe(2);
  });

  it("usunięcie wpisu: wiersze pod nim startują o wiersz niżej", () => {
    const dy = przesuniecia(uklad(["A", "B", "C"]), uklad(["A", "C"]), 1);
    expect(dy.get("C")).toBe(WIERSZ);
    expect(dy.has("A")).toBe(false);
  });

  it("awans o dwa miejsca: przesunięcie o dwa wiersze w dół", () => {
    const dy = przesuniecia(uklad(["A", "B", "C"]), uklad(["C", "A", "B"]), 1);
    expect(dy.get("C")).toBe(2 * WIERSZ);
  });

  it("przy powiększeniu 1,5 przesunięcie jest w pikselach układu, nie ekranu", () => {
    const naEkranie = WIERSZ * 1.5;
    const dy = przesuniecia(uklad(["A", "B"], naEkranie), uklad(["N", "A", "B"], naEkranie), 1.5);
    expect(dy.get("A")).toBe(-WIERSZ);
  });

  it("bez zmian albo ułamek piksela: nic się nie rusza", () => {
    expect(przesuniecia(uklad(["A", "B"]), uklad(["A", "B"]), 1).size).toBe(0);
    const po = new Map([["A", 300.4]]);
    expect(przesuniecia(uklad(["A"]), po, 1).size).toBe(0);
  });

  it("zła skala nie daje przesunięć", () => {
    expect(przesuniecia(uklad(["A"]), uklad(["N", "A"]), 0).size).toBe(0);
    expect(przesuniecia(uklad(["A"]), uklad(["N", "A"]), Number.NaN).size).toBe(0);
  });
});

describe("skala ekranu", () => {
  it("wysokość na ekranie przez wysokość w układzie", () => {
    expect(skala(60, 40)).toBe(1.5);
    expect(skala(40, 40)).toBe(1);
  });

  it("niewidoczny wiersz (wysokość 0) daje skalę 1", () => {
    expect(skala(0, 0)).toBe(1);
    expect(skala(40, 0)).toBe(1);
  });
});

describe("animacja wiersza", () => {
  it("startuje ze starego miejsca, kończy na nowym, skokami po ok. 8 px przez 0,5 s", () => {
    const { klatki, opcje } = ruch(-40);
    expect(klatki).toEqual([{ transform: "translateY(-40px)" }, { transform: "translateY(0)" }]);
    expect(opcje).toEqual({ duration: 500, easing: "steps(5, end)" });
    expect(FLIP_MS).toBe(500);
  });

  it("liczba skoków rośnie z odległością, najmniej jeden", () => {
    expect(ruch(80).opcje.easing).toBe("steps(10, end)");
    expect(ruch(39.6).opcje.easing).toBe("steps(5, end)");
    expect(ruch(2).opcje.easing).toBe("steps(1, end)");
  });
});
