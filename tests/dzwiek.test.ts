import { describe, expect, it } from "vitest";
import {
  doZapisu,
  GLOSNOSC,
  harmonogram,
  obwiednia,
  OPOZNIENIE,
  zagraj,
  zapamietany,
  type KontekstDzwieku,
  type Rodzaj,
} from "@/lib/dzwiek";

// Dźwięk 8-bit (WF-20)
const RODZAJE: Rodzaj[] = ["nowa-gra", "rekord", "wlaczenie"];

describe("harmonogram nut", () => {
  it("nowa gra: dwa krótkie bipy", () => {
    const nuty = harmonogram("nowa-gra");
    expect(nuty).toHaveLength(2);
    for (const n of nuty) expect(n.czas).toBeLessThanOrEqual(0.1);
  });

  it("rekord: fanfara C-E-G-C (oktawa wyżej na końcu), ostatnia nuta najdłuższa", () => {
    const nuty = harmonogram("rekord");
    expect(nuty.map((n) => Math.round(n.hz))).toEqual([523, 659, 784, 1047]);
    expect(nuty[3].hz / nuty[0].hz).toBeCloseTo(2, 3);
    expect(nuty[3].czas).toBeGreaterThan(Math.max(...nuty.slice(0, 3).map((n) => n.czas)));
  });

  it("nuty idą po kolei, nie nakładają się i każdy dźwięk trwa krócej niż sekundę", () => {
    for (const r of RODZAJE) {
      const nuty = harmonogram(r);
      expect(nuty[0].od).toBe(0);
      for (let i = 1; i < nuty.length; i++) expect(nuty[i].od).toBeGreaterThanOrEqual(nuty[i - 1].od + nuty[i - 1].czas);
      const koniec = nuty[nuty.length - 1];
      expect(koniec.od + koniec.czas).toBeLessThan(1);
    }
  });
});

describe("obwiednia", () => {
  it("zaczyna i kończy się na zerze (bez trzasków), narasta i wygasa w co najmniej 5 ms", () => {
    for (const r of RODZAJE) {
      for (const n of harmonogram(r)) {
        const punkty = obwiednia(n);
        expect(punkty[0]).toEqual([n.od, 0]);
        expect(punkty[punkty.length - 1][0]).toBeCloseTo(n.od + n.czas, 9);
        expect(punkty[punkty.length - 1][1]).toBe(0);
        expect(punkty[1][0] - punkty[0][0]).toBeGreaterThanOrEqual(0.005);
        expect(punkty[3][0] - punkty[2][0]).toBeGreaterThanOrEqual(0.005);
        // czas rośnie
        for (let i = 1; i < punkty.length; i++) expect(punkty[i][0]).toBeGreaterThan(punkty[i - 1][0]);
      }
    }
  });

  it("cicho: najwyżej 0,1 pełnej głośności", () => {
    expect(GLOSNOSC).toBeGreaterThan(0);
    expect(GLOSNOSC).toBeLessThanOrEqual(0.1);
    expect(Math.max(...obwiednia(harmonogram("rekord")[0]).map(([, v]) => v))).toBe(GLOSNOSC);
  });
});

// Atrapa Web Audio: zapisuje, co i kiedy zostało zaplanowane
function atrapa(teraz: number) {
  const zdarzenia: string[] = [];
  const destination = { nazwa: "wyjście" };
  const oscylator = () => ({
    type: "sine",
    frequency: { value: 440 },
    onended: null as (() => void) | null,
    poczatek: Number.NaN,
    koniec: Number.NaN,
    connect: (cel: unknown) => zdarzenia.push(cel === destination ? "osc->wyjście" : "osc->głośność"),
    disconnect: () => zdarzenia.push("osc odłączony"),
    start(t: number) {
      this.poczatek = t;
    },
    stop(t: number) {
      this.koniec = t;
    },
  });
  const oscylatory: ReturnType<typeof oscylator>[] = [];
  const glosnosci: { gain: { punkty: [string, number, number][] } }[] = [];
  const ctx = {
    currentTime: teraz,
    destination,
    createOscillator() {
      const o = oscylator();
      oscylatory.push(o);
      return o;
    },
    createGain() {
      const g = {
        gain: {
          punkty: [] as [string, number, number][],
          setValueAtTime(v: number, t: number) {
            this.punkty.push(["set", t, v]);
          },
          linearRampToValueAtTime(v: number, t: number) {
            this.punkty.push(["ramp", t, v]);
          },
        },
        connect: (cel: unknown) => zdarzenia.push(cel === destination ? "głośność->wyjście" : "głośność->?"),
        disconnect: () => zdarzenia.push("głośność odłączona"),
      };
      glosnosci.push(g);
      return g;
    },
  };
  return { ctx: ctx as unknown as KontekstDzwieku, oscylatory, glosnosci, zdarzenia };
}

describe("zagranie w Web Audio", () => {
  it("fala prostokątna, każda nuta we właściwym czasie, po kolei przez głośność do wyjścia", () => {
    const { ctx, oscylatory, zdarzenia } = atrapa(10);
    zagraj(ctx, harmonogram("rekord"));
    expect(oscylatory.map((o) => o.type)).toEqual(["square", "square", "square", "square"]);
    expect(oscylatory.map((o) => Math.round(o.frequency.value))).toEqual([523, 659, 784, 1047]);
    const nuty = harmonogram("rekord");
    oscylatory.forEach((o, i) => {
      expect(o.poczatek).toBeCloseTo(10 + OPOZNIENIE + nuty[i].od, 9);
      expect(o.koniec).toBeCloseTo(10 + OPOZNIENIE + nuty[i].od + nuty[i].czas, 9);
    });
    expect(zdarzenia.filter((z) => z === "osc->głośność")).toHaveLength(4);
    expect(zdarzenia.filter((z) => z === "głośność->wyjście")).toHaveLength(4);
  });

  it("głośność każdej nuty idzie po obwiedni: od zera, rampą w górę, rampą do zera na końcu nuty (bez trzasków)", () => {
    const { ctx, oscylatory, glosnosci } = atrapa(10);
    const nuty = harmonogram("rekord");
    zagraj(ctx, nuty);
    expect(glosnosci).toHaveLength(nuty.length);
    glosnosci.forEach((g, i) => {
      const start = 10 + OPOZNIENIE;
      const oczekiwane = obwiednia(nuty[i]).map(([t, v], j) => [j === 0 ? "set" : "ramp", start + t, v]);
      expect(g.gain.punkty).toHaveLength(oczekiwane.length);
      g.gain.punkty.forEach(([rodzaj, t, v], j) => {
        expect(rodzaj).toBe(oczekiwane[j][0]);
        expect(t).toBeCloseTo(oczekiwane[j][1] as number, 9);
        expect(v).toBe(oczekiwane[j][2]);
      });
      // cisza w chwili startu i zatrzymania oscylatora
      expect(g.gain.punkty[0][1]).toBeCloseTo(oscylatory[i].poczatek, 9);
      expect(g.gain.punkty.at(-1)?.[1]).toBeCloseTo(oscylatory[i].koniec, 9);
      expect(g.gain.punkty.at(-1)?.[2]).toBe(0);
    });
  });

  it("pierwsza nuta nie zaczyna się w przeszłości", () => {
    const { ctx, oscylatory } = atrapa(3);
    zagraj(ctx, harmonogram("nowa-gra"));
    expect(oscylatory[0].poczatek).toBeGreaterThan(3);
  });

  it("po zagraniu nuta odłącza się od wyjścia", () => {
    const { ctx, oscylatory, zdarzenia } = atrapa(0);
    zagraj(ctx, harmonogram("wlaczenie"));
    oscylatory[0].onended?.();
    expect(zdarzenia).toContain("osc odłączony");
    expect(zdarzenia).toContain("głośność odłączona");
  });
});

describe("zapamiętany wybór", () => {
  it("domyślnie wyłączony: brak wpisu albo dowolna inna wartość to WYŁ", () => {
    expect(zapamietany(null)).toBe(false);
    expect(zapamietany("0")).toBe(false);
    expect(zapamietany("true")).toBe(false);
    expect(zapamietany("1")).toBe(true);
  });

  it("zapis i odczyt dają ten sam wybór", () => {
    expect(zapamietany(doZapisu(true))).toBe(true);
    expect(zapamietany(doZapisu(false))).toBe(false);
  });
});
