import { describe, expect, it } from "vitest";
import { parse } from "@/lib/scoreValidator";

// Format od bramki prowadzącego to umowa: { "id": "<gracz>", "wynik": <liczba> }.
// Te testy pilnują, żeby zmiana walidacji nie zepsuła odbioru wyników z bramki.
describe("walidacja wyniku od bramki", () => {
  it("zamienia poprawne body na ScoreDto", () => {
    expect(parse({ id: "ABC", wynik: 123 })).toEqual({ ok: true, dto: { playerId: "ABC", score: 123 } });
  });

  it("przyjmuje wynik jako tekst, bo bramka przepisuje dane z radia", () => {
    expect(parse({ id: "ABC", wynik: "50" })).toEqual({ ok: true, dto: { playerId: "ABC", score: 50 } });
  });

  it("przyjmuje liczbowe id i zamienia je na tekst", () => {
    expect(parse({ id: 7, wynik: 1 })).toEqual({ ok: true, dto: { playerId: "7", score: 1 } });
  });

  it("obcina spacje wokół id", () => {
    expect(parse({ id: "  ABC ", wynik: 1 })).toEqual({ ok: true, dto: { playerId: "ABC", score: 1 } });
  });

  // Bramka może dokleić koniec linii z ramki radiowej (jak przy wyniku "123\r\n")
  it.each(["ABC\r\n", "ABC\n", "\tABC"])("obcina białe znaki wokół id przed sprawdzeniem znaków: %j", (id) => {
    expect(parse({ id, wynik: "123\r\n" })).toEqual({ ok: true, dto: { playerId: "ABC", score: 123 } });
  });

  it("ignoruje dodatkowe pola", () => {
    expect(parse({ id: "ABC", wynik: 1, apiId: "DK" }).ok).toBe(true);
  });

  it.each([0, 99999])("przyjmuje wynik na granicy zakresu: %s", (wynik) => {
    expect(parse({ id: "ABC", wynik }).ok).toBe(true);
  });

  it.each(["123", " 123 ", "123\r\n", "\t42\n", "0", "99999", "007", "0000000000000000000099999"])("przyjmuje wynik jako tekst z samych cyfr: %j", (wynik) => {
    expect(parse({ id: "ABC", wynik }).ok).toBe(true);
  });

  it.each([
    "1e3", "0x1F", "0b1", "0o7", "12.5", "12.0", "12.", ".5", "+5", "-5", "-0", "1 000", "1\n2", "1_000", "100000",
    "Infinity", "NaN", "   ", "１２３", "9".repeat(400),
  ])(
    "odrzuca wynik jako tekst, który nie jest liczbą z samych cyfr albo jest poza zakresem: %j",
    (wynik) => {
      expect(parse({ id: "ABC", wynik }).ok).toBe(false);
    },
  );

  it.each([-1, 100000, 1.5, "abc", "", null, true, undefined])("odrzuca wynik %s", (wynik) => {
    expect(parse({ id: "ABC", wynik }).ok).toBe(false);
  });

  it("przyjmuje id z 32 znaków i odrzuca z 33", () => {
    expect(parse({ id: "x".repeat(32), wynik: 1 }).ok).toBe(true);
    expect(parse({ id: "x".repeat(33), wynik: 1 }).ok).toBe(false);
  });

  it("liczy długość id w znakach, jak baza: 32 emoji tak, 33 nie", () => {
    expect(parse({ id: "👾".repeat(32), wynik: 1 }).ok).toBe(true);
    expect(parse({ id: "👾".repeat(33), wynik: 1 }).ok).toBe(false);
  });

  it.each(["ŻÓŁW", "A B", "gracz-1", "Ünal", "👾"])("przyjmuje zwykły nick: %j", (id) => {
    expect(parse({ id, wynik: 1 }).ok).toBe(true);
  });

  it.each([
    ["NUL", "A\u0000B"],
    ["znak nowej linii w środku", "A\nB"],
    ["tabulator w środku", "A\tB"],
    ["spacja zerowej szerokości", "\u200b"],
    ["zmiana kierunku tekstu (RLO)", "\u202eNIMDA"],
    ["izolacja kierunku (LRI)", "AB\u2066C"],
    ["łącznik zerowej szerokości", "A\u200dB"],
    ["samotny surogat", "A\ud800"],
    ["separator wierszy", "A\u2028B"],
    ["separator akapitów", "A\u2029B"],
    ["DEL", "A\u007fB"],
    ["znak z obszaru prywatnego", "A\ue000"],
  ])("odrzuca id ze znakiem sterującym albo niewidocznym: %s", (_, id) => {
    const result = parse({ id, wynik: 1 });
    expect(result).toEqual({ ok: false, error: '"id" nie może zawierać znaków sterujących ani niewidocznych' });
  });

  it.each([undefined, "", "   ", null, { a: 1 }])("odrzuca brakujące albo puste id: %s", (id) => {
    expect(parse({ id, wynik: 1 }).ok).toBe(false);
  });

  it.each([null, [], "tekst", 5])("odrzuca body, które nie jest obiektem: %s", (body) => {
    expect(parse(body).ok).toBe(false);
  });

  it("zwraca opis błędu, który bramka dostanie w odpowiedzi", () => {
    const result = parse({ id: "ABC", wynik: -5 });
    expect(result).toEqual({ ok: false, error: '"wynik" musi być liczbą całkowitą od 0 do 99999' });
  });
});
