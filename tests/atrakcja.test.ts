import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DUZY_EKRAN, faza, krokCyklu, moznaPokazac, ruchCyklu, startCyklu, type Warunki } from "@/lib/atrakcja";

// Ekran pokazowy (WF-19): po minucie bez ruchu 10 s pokazu, 20 s tabeli, 10 s pokazu...
describe("cykl ekranu pokazowego", () => {
  const S = 1_000;

  it("przez pierwszą minutę bez ruchu widać tabelę", () => {
    expect(faza(0)).toEqual({ pokaz: false, doZmiany: 60 * S });
    expect(faza(60 * S - 1)).toEqual({ pokaz: false, doZmiany: 1 });
  });

  it("po 60 s zaczyna się pokaz i trwa 10 s", () => {
    expect(faza(60 * S)).toEqual({ pokaz: true, doZmiany: 10 * S });
    expect(faza(70 * S - 1)).toEqual({ pokaz: true, doZmiany: 1 });
  });

  it("po pokazie 20 s tabeli", () => {
    expect(faza(70 * S)).toEqual({ pokaz: false, doZmiany: 20 * S });
    expect(faza(90 * S - 1)).toEqual({ pokaz: false, doZmiany: 1 });
  });

  it("potem znowu 10 s pokazu i tak w kółko", () => {
    expect(faza(90 * S)).toEqual({ pokaz: true, doZmiany: 10 * S });
    expect(faza(100 * S)).toEqual({ pokaz: false, doZmiany: 20 * S });
    expect(faza(60 * S + 100 * 30 * S + 5 * S)).toEqual({ pokaz: true, doZmiany: 5 * S });
    expect(faza(60 * S + 100 * 30 * S + 15 * S)).toEqual({ pokaz: false, doZmiany: 15 * S });
  });

  it("czas sprzed aktywności (np. zegar cofnięty) daje tabelę", () => {
    expect(faza(-5 * S)).toEqual({ pokaz: false, doZmiany: 60 * S });
  });

  it("czas do zmiany zawsze prowadzi do następnej fazy", () => {
    for (let t = 0; t < 200 * S; t += 777) {
      const f = faza(t);
      expect(f.doZmiany).toBeGreaterThan(0);
      expect(faza(t + f.doZmiany).pokaz).not.toBe(f.pokaz);
      expect(faza(t + f.doZmiany - 1).pokaz).toBe(f.pokaz);
    }
  });
});

describe("cykl pokazu na stronie: start, aktywność, kolejne pokazy", () => {
  const S = 1_000;

  it("minuta liczy się od zamontowania strony rankingu, nie od otwarcia karty", () => {
    // karta otwarta w chwili 0, ranking zamontowany po 62 s (np. powrót z /docs)
    const c = startCyklu(62 * S);
    expect(krokCyklu(c, 62 * S)).toEqual({ cykl: { od: 62 * S, pokaz: false, seria: 0 }, doZmiany: 60 * S });
    expect(krokCyklu(c, 62 * S + 59 * S).cykl.pokaz).toBe(false);
    expect(krokCyklu(c, 62 * S + 60 * S).cykl.pokaz).toBe(true);
  });

  it("aktywność w trakcie pokazu: od razu tabela i pełna minuta do kolejnego pokazu", () => {
    const wPokazie = krokCyklu(startCyklu(0), 65 * S).cykl;
    expect(wPokazie.pokaz).toBe(true);
    const poKliku = ruchCyklu(wPokazie, 65 * S);
    expect(poKliku.pokaz).toBe(false);
    expect(krokCyklu(poKliku, 65 * S)).toEqual({ cykl: { ...poKliku, pokaz: false }, doZmiany: 60 * S });
    // bez resetu po 35 s byłby już kolejny pokaz (90 s od startu)
    expect(krokCyklu(poKliku, 100 * S).cykl.pokaz).toBe(false);
    expect(krokCyklu(poKliku, 125 * S - 1).cykl.pokaz).toBe(false);
    expect(krokCyklu(poKliku, 125 * S).cykl.pokaz).toBe(true);
  });

  it("aktywność przed upływem minuty odsuwa pokaz", () => {
    const c = ruchCyklu(startCyklu(0), 50 * S);
    expect(krokCyklu(c, 60 * S).cykl.pokaz).toBe(false);
    expect(krokCyklu(c, 110 * S).cykl.pokaz).toBe(true);
  });

  it("seria rośnie raz na każdy nowy pokaz", () => {
    let c = startCyklu(0);
    const serie: number[] = [];
    for (let t = 0; t <= 130 * S; t += 500) {
      c = krokCyklu(c, t).cykl;
      serie.push(c.seria);
    }
    // pokazy od 60 s, 90 s i 120 s
    expect(serie.at(-1)).toBe(3);
    expect(krokCyklu(krokCyklu(startCyklu(0), 61 * S).cykl, 62 * S).cykl.seria).toBe(1);
    // ponowne zamontowanie zachowuje serię, więc demo leci dalej
    expect(startCyklu(5 * S, 3).seria).toBe(3);
  });
});

describe("kiedy pokaz w ogóle może się pojawić", () => {
  const wszystko: Warunki = { duzyEkran: true, ograniczonyRuch: false, widoczna: true, polaczenie: true, rekord: false };

  it("duży ekran, bez ograniczonego ruchu, karta na wierzchu, API działa, bez ekranu rekordu", () => {
    expect(moznaPokazac(wszystko)).toBe(true);
  });

  it("każdy warunek osobno blokuje pokaz", () => {
    expect(moznaPokazac({ ...wszystko, duzyEkran: false })).toBe(false);
    expect(moznaPokazac({ ...wszystko, ograniczonyRuch: true })).toBe(false);
    expect(moznaPokazac({ ...wszystko, widoczna: false })).toBe(false);
    expect(moznaPokazac({ ...wszystko, polaczenie: false })).toBe(false);
    expect(moznaPokazac({ ...wszystko, rekord: true })).toBe(false);
  });

  it("duży ekran to ten sam warunek co tryb TV w globals.css", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(css).toContain(`@media ${DUZY_EKRAN} {\n  .ekran {`);
  });
});
