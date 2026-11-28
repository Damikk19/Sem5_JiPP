import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DUZY_EKRAN, faza, moznaPokazac, type Warunki } from "@/lib/atrakcja";

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

  it("aktywność liczy minutę od nowa: czas liczony jest od ostatniej aktywności", () => {
    const start = 500_000;
    const klik = start + 65 * S;
    expect(faza(klik - start).pokaz).toBe(true);
    // zaraz po kliknięciu tabela i pełna minuta do pokazu
    expect(faza(klik - klik)).toEqual({ pokaz: false, doZmiany: 60 * S });
    expect(faza(klik + 59 * S - klik).pokaz).toBe(false);
    expect(faza(klik + 60 * S - klik).pokaz).toBe(true);
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
    expect(DUZY_EKRAN).toBe("(min-width: 1250px) and (min-height: 760px)");
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(css).toContain(`@media ${DUZY_EKRAN} {\n  .ekran {`);
  });
});
