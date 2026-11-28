import { describe, expect, it } from "vitest";
import {
  celBota,
  JASNOSC,
  JASNOSC_STATKU,
  krok,
  losuj,
  nowaGra,
  obraz,
  poziom,
  przewin,
  ROZMIAR,
  type Demo,
} from "@/lib/demo";

// Demo gry na ekranie pokazowym (WF-19): zasady jak w microbit/main.ts, gra bot
const KROKOW = 3_000;

// Kolejne stany od nowej gry
function przebieg(ziarno: number, kroki = KROKOW) {
  const stany: Demo[] = [nowaGra(ziarno)];
  for (let i = 0; i < kroki; i++) stany.push(krok(stany[stany.length - 1]));
  return stany;
}

describe("generator liczb losowych", () => {
  it("to samo ziarno daje te same liczby z [0, 1)", () => {
    let a = 42;
    let b = 42;
    for (let i = 0; i < 100; i++) {
      const [x, na] = losuj(a);
      const [y, nb] = losuj(b);
      expect(x).toBe(y);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      a = na;
      b = nb;
    }
  });
});

describe("symulacja demo", () => {
  it("jest deterministyczna: to samo ziarno daje ten sam przebieg, inne ziarno inny", () => {
    const a = przebieg(7).map(obraz);
    const b = przebieg(7).map(obraz);
    const c = przebieg(8).map(obraz);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("nie zmienia stanu, który dostaje", () => {
    const s = przewin(nowaGra(3), 50);
    const kopia = structuredClone(s);
    krok(s);
    expect(s).toEqual(kopia);
  });

  it("statek jest zawsze w dolnym rzędzie, a kości i pocisk nigdy", () => {
    for (const s of przebieg(11)) {
      expect(s.statek).toBeGreaterThanOrEqual(0);
      expect(s.statek).toBeLessThan(ROZMIAR);
      for (const k of s.kosci) expect(k.y).toBeLessThan(ROZMIAR - 1);
      if (s.pocisk) expect(s.pocisk.y).toBeLessThan(ROZMIAR - 1);
      if (s.blysk > 0) continue;
      const dol = obraz(s).slice((ROZMIAR - 1) * ROZMIAR);
      expect(dol.filter((j) => j > 0)).toHaveLength(1);
      expect(dol[s.statek]).toBe(JASNOSC_STATKU[s.zycia]);
    }
  });

  it("najwyżej jeden pocisk: nowy pojawia się tylko, gdy poprzedniego już nie ma", () => {
    const stany = przebieg(12);
    let strzalow = 0;
    for (let i = 1; i < stany.length; i++) {
      const [przed, po] = [stany[i - 1], stany[i]];
      // nad dolnym rzędem: statek z pełnymi życiami świeci tak samo jak pocisk
      const pociskow = obraz(po)
        .slice(0, (ROZMIAR - 1) * ROZMIAR)
        .filter((j) => j === JASNOSC.pocisk).length;
      if (po.blysk === 0) expect(pociskow).toBeLessThanOrEqual(1);
      // pocisk tuż nad statkiem to nowy strzał
      if (po.pocisk && po.pocisk.y === ROZMIAR - 2 && po.partia === przed.partia) {
        expect(przed.pocisk).toBeNull();
        strzalow++;
      }
    }
    expect(strzalow).toBeGreaterThan(10);
  });

  it("bot trafia: zestrzelone kości dają punkty (DDR4 1 pkt, DDR5 3 pkt)", () => {
    const stany = przebieg(5);
    const przyrosty = new Set<number>();
    for (let i = 1; i < stany.length; i++) {
      if (stany[i].partia === stany[i - 1].partia && stany[i].wynik > stany[i - 1].wynik) {
        przyrosty.add(stany[i].wynik - stany[i - 1].wynik);
      }
    }
    expect([...przyrosty].sort()).toEqual([1, 3]);
    expect(Math.max(...stany.map((s) => s.wynik))).toBeGreaterThan(20);
  });

  it("bot czasem nie zdąży: kość na dole zabiera życie, a statek przygasa", () => {
    const stany = przebieg(5);
    const strata = stany.findIndex((s, i) => i > 0 && s.zycia < stany[i - 1].zycia);
    expect(strata).toBeGreaterThan(0);
    expect(stany[strata].blysk).toBeGreaterThan(0);
    expect(obraz(stany[strata]).every((j) => j === JASNOSC.blysk)).toBe(true);
  });

  it("po trzech straconych życiach gra zaczyna się od nowa", () => {
    // Ostatnie życie, kość tuż nad dolnym rzędem z daleka od statku, bot zagapiony
    const s: Demo = {
      ...nowaGra(1),
      zycia: 1,
      statek: 0,
      kosci: [{ x: 4, y: ROZMIAR - 2, ddr5: false, uszkodzona: false }],
      wynik: 17,
      doSpadania: 100,
      doPojawienia: 10_000,
      czeka: 10,
    };
    const po = krok(s);
    expect(po.zycia).toBe(0);
    expect(po.blysk).toBeGreaterThan(0);
    const nowa = przewin(po, po.blysk);
    expect(nowa.partia).toBe(1);
    expect(nowa.zycia).toBe(3);
    expect(nowa.wynik).toBe(0);
    expect(nowa.kosci).toEqual([]);
  });

  it("w długim przebiegu bot gra kolejne partie", () => {
    const stany = przebieg(9, 6_000);
    expect(stany[stany.length - 1].partia).toBeGreaterThan(0);
    // Każda partia kończy się po dokładnie trzech stratach
    let straty = 0;
    for (let i = 1; i < stany.length; i++) {
      if (stany[i].partia !== stany[i - 1].partia) {
        expect(straty).toBe(3);
        straty = 0;
      } else straty += stany[i - 1].zycia - stany[i].zycia;
    }
  });

  it("DDR5 po pierwszym trafieniu tylko przygasa, po drugim znika", () => {
    const s: Demo = {
      ...nowaGra(1),
      statek: 2,
      kosci: [{ x: 2, y: 1, ddr5: true, uszkodzona: false }],
      pocisk: { x: 2, y: 2 },
      doSpadania: 10_000,
      doPojawienia: 10_000,
      czeka: 10,
    };
    const po = krok(s);
    expect(po.pocisk).toBeNull();
    expect(po.kosci).toEqual([{ x: 2, y: 1, ddr5: true, uszkodzona: true }]);
    expect(po.wynik).toBe(0);
    const drugi = krok({ ...po, pocisk: { x: 2, y: 2 } });
    expect(drugi.kosci).toEqual([]);
    expect(drugi.wynik).toBe(3);
    expect(drugi.tempoSpadania).toBeLessThan(s.tempoSpadania);
  });
});

describe("bot", () => {
  it("celuje w najniższą kość, przy remisie w najbliższą statku", () => {
    const k = (x: number, y: number) => ({ x, y, ddr5: false, uszkodzona: false });
    expect(celBota([k(0, 1), k(4, 3), k(2, 2)], 0)).toEqual(k(4, 3));
    expect(celBota([k(0, 2), k(3, 2)], 4)).toEqual(k(3, 2));
    expect(celBota([], 2)).toBeNull();
  });
});

describe("obraz na matrycy", () => {
  it("25 diod: kości jasnością jak w grze, statek jasnością żyć", () => {
    const s: Demo = {
      ...nowaGra(1),
      statek: 1,
      zycia: 2,
      pocisk: { x: 1, y: 2 },
      kosci: [
        { x: 0, y: 0, ddr5: false, uszkodzona: false },
        { x: 4, y: 1, ddr5: true, uszkodzona: false },
        { x: 3, y: 3, ddr5: true, uszkodzona: true },
      ],
    };
    const diody = obraz(s);
    expect(diody).toHaveLength(25);
    expect(diody[0]).toBe(30);
    expect(diody[1 * 5 + 4]).toBe(200);
    expect(diody[3 * 5 + 3]).toBe(90);
    expect(diody[2 * 5 + 1]).toBe(255);
    expect(diody[4 * 5 + 1]).toBe(90);
    expect(diody.filter((j) => j > 0)).toHaveLength(5);
  });

  it("jasność statku: 3 życia pełna, 2 średnia, 1 przygaszona", () => {
    expect(JASNOSC_STATKU.slice(1)).toEqual([25, 90, 255]);
  });

  it("poziomy świecenia na stronie rozróżniają DDR4, uszkodzoną DDR5, DDR5 i pełną jasność", () => {
    expect([0, 25, 30, 90, 120, 200, 255].map(poziom)).toEqual([0, 1, 1, 2, 2, 3, 4]);
  });
});
