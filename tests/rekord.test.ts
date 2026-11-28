import { describe, expect, it } from "vitest";
import type { Ranking } from "@/lib/odswiezanie";
import { nowyRekord, POCZATEK, przyjmij, REKORD_MS, zamknij, type Widok } from "@/lib/rekord";
import type { Score } from "@/lib/score";

// Kiedy strona świętuje NEW HIGH SCORE (WF-18) i w jakiej kolejności pokazuje dane
function gra(id: string, score: number, minuta: number): Score {
  return { id, playerId: id, score, timestamp: `2026-11-27T18:${String(minuta).padStart(2, "0")}:00.000Z` };
}

// Ranking od najlepszego, przy remisie starsza gra wyżej (jak w API, WF-11)
function ranking(...gry: Score[]): Ranking {
  const top = [...gry].sort((a, b) => b.score - a.score || a.timestamp.localeCompare(b.timestamp));
  const latest = [...gry].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return { top, latest };
}

const A = gra("A", 100, 1);
const B = gra("B", 50, 2);
const C = gra("C", 10, 3);

// Strona po pierwszym pobraniu: A 100, B 50, C 10
function poStarcie(): Widok {
  return przyjmij(POCZATEK, ranking(A, B, C), []).widok;
}

describe("czy nowa gra to rekord", () => {
  it("nowa gra na 1. miejscu z większym wynikiem to rekord", () => {
    const D = gra("D", 101, 4);
    expect(nowyRekord(ranking(A, B, C, D).top, ["D"], 100)).toEqual(D);
  });

  it("remis z rekordem nie jest rekordem: starsza gra zostaje na 1. miejscu", () => {
    const D = gra("D", 100, 4);
    const r = ranking(A, B, C, D);
    expect(r.top[0].id).toBe("A");
    expect(nowyRekord(r.top, ["D"], 100)).toBeNull();
  });

  it("nowa gra nie na 1. miejscu nie jest rekordem", () => {
    const D = gra("D", 99, 4);
    expect(nowyRekord(ranking(A, B, C, D).top, ["D"], 100)).toBeNull();
  });

  it("stara gra na 1. miejscu nie jest rekordem, nawet gdy przyszła inna nowa", () => {
    const D = gra("D", 5, 4);
    expect(nowyRekord(ranking(A, B, C, D).top, ["D"], 100)).toBeNull();
    // nawet gdy stara gra ma wynik wyższy niż to, co strona uważa za rekord
    expect(nowyRekord(ranking(A, B, C, D).top, ["D"], 0)).toBeNull();
  });

  it("pierwsza gra z wynikiem 0 w pustej tabeli nie jest rekordem, z wynikiem 1 jest", () => {
    const zero = gra("Z", 0, 1);
    expect(nowyRekord([zero], ["Z"], 0)).toBeNull();
    const jeden = gra("J", 1, 1);
    expect(nowyRekord([jeden], ["J"], 0)).toEqual(jeden);
  });

  it("bez nowych gier (pierwsze pobranie, usunięcie wpisu) nie ma rekordu", () => {
    expect(nowyRekord(ranking(A, B).top, [], 0)).toBeNull();
    expect(nowyRekord([], [], 0)).toBeNull();
  });

  it("gra o wyniku równym rekordowi na 1. miejscu (rekord usunięty w tym samym czasie) nie świętuje", () => {
    const D = gra("D", 100, 4);
    expect(nowyRekord(ranking(B, C, D).top, ["D"], 100)).toBeNull();
  });

  it("ekran rekordu trwa 5 s", () => {
    expect(REKORD_MS).toBe(5_000);
  });
});

describe("co widać na stronie po nowych danych", () => {
  it("pierwsze pobranie: dane od razu w tabeli, bez rekordu i bez dźwięku", () => {
    const { widok, dzwiek } = przyjmij(POCZATEK, ranking(A, B, C), []);
    expect(widok.tabela?.dane.top.map((g) => g.id)).toEqual(["A", "B", "C"]);
    expect(widok.rekord).toBeNull();
    expect(widok.czeka).toBeNull();
    expect(dzwiek).toBeNull();
  });

  it("pierwsze pobranie z grą na 1. miejscu nie świętuje", () => {
    const { widok, dzwiek } = przyjmij(POCZATEK, ranking(A), []);
    expect(widok.rekord).toBeNull();
    expect(dzwiek).toBeNull();
  });

  it("nowa gra bez rekordu: od razu w tabeli, miga, dwa bipy", () => {
    const D = gra("D", 60, 4);
    const { widok, dzwiek } = przyjmij(poStarcie(), ranking(A, B, C, D), ["D"]);
    expect(widok.tabela?.dane.top.map((g) => g.id)).toEqual(["A", "D", "B", "C"]);
    expect(widok.tabela?.nowe).toEqual(["D"]);
    expect(widok.rekord).toBeNull();
    expect(dzwiek).toBe("nowa-gra");
  });

  it("nic nowego: dane odświeżone, bez dźwięku", () => {
    const { widok, dzwiek } = przyjmij(poStarcie(), ranking(A, B, C), []);
    expect(widok.tabela?.nowe).toEqual([]);
    expect(dzwiek).toBeNull();
  });

  it("pusta tabela: pierwsza gra z wynikiem 0 tylko miga, z wynikiem 1 to rekord", () => {
    const pusta = przyjmij(POCZATEK, ranking(), []).widok;
    const zero = gra("Z", 0, 1);
    const poZerze = przyjmij(pusta, ranking(zero), ["Z"]);
    expect(poZerze.widok.rekord).toBeNull();
    expect(poZerze.widok.tabela?.nowe).toEqual(["Z"]);
    expect(poZerze.dzwiek).toBe("nowa-gra");
    const jeden = gra("J", 1, 2);
    expect(przyjmij(pusta, ranking(jeden), ["J"]).widok.rekord).toEqual(jeden);
  });

  it("usunięcie wpisu nie świętuje i nic nie gra", () => {
    const { widok, dzwiek } = przyjmij(poStarcie(), ranking(B, C), []);
    expect(widok.rekord).toBeNull();
    expect(widok.tabela?.dane.top.map((g) => g.id)).toEqual(["B", "C"]);
    expect(dzwiek).toBeNull();
  });

  it("remis z rekordem: nowa gra w tabeli i miga, ale bez ekranu rekordu", () => {
    const D = gra("D", 100, 4);
    const { widok, dzwiek } = przyjmij(poStarcie(), ranking(A, B, C, D), ["D"]);
    expect(widok.rekord).toBeNull();
    expect(widok.tabela?.nowe).toEqual(["D"]);
    expect(dzwiek).toBe("nowa-gra");
  });

  it("rekord: ekran rekordu nad starą tabelą, fanfara, nowe dane czekają", () => {
    const start = poStarcie();
    const D = gra("D", 500, 4);
    const { widok, dzwiek } = przyjmij(start, ranking(A, B, C, D), ["D"]);
    expect(widok.rekord).toEqual(D);
    expect(widok.tabela).toBe(start.tabela);
    expect(widok.czeka?.dane.top[0]).toEqual(D);
    expect(dzwiek).toBe("rekord");
  });

  it("dwie nowe gry naraz, jedna z rekordem: jeden dźwięk i jest nim fanfara", () => {
    const D = gra("D", 500, 4);
    const E = gra("E", 20, 5);
    const { widok, dzwiek } = przyjmij(poStarcie(), ranking(A, B, C, D, E), ["E", "D"]);
    expect(widok.rekord).toEqual(D);
    expect(widok.czeka?.nowe).toEqual(["E", "D"]);
    expect(dzwiek).toBe("rekord");
  });

  it("dwie nowe gry naraz bez rekordu: obie migają, jeden dźwięk", () => {
    const D = gra("D", 60, 4);
    const E = gra("E", 20, 5);
    const { widok, dzwiek } = przyjmij(poStarcie(), ranking(A, B, C, D, E), ["E", "D"]);
    expect(widok.rekord).toBeNull();
    expect(widok.tabela?.nowe).toEqual(["E", "D"]);
    expect(dzwiek).toBe("nowa-gra");
  });

  it("dane w trakcie ekranu rekordu czekają razem: najnowsze dane i suma nowych gier, bez dźwięku", () => {
    const D = gra("D", 500, 4);
    const E = gra("E", 20, 5);
    const poRekordzie = przyjmij(poStarcie(), ranking(A, B, C, D), ["D"]).widok;
    const { widok, dzwiek } = przyjmij(poRekordzie, ranking(A, B, C, D, E), ["E"]);
    expect(widok.rekord).toEqual(D);
    expect(widok.tabela).toBe(poRekordzie.tabela);
    expect(widok.czeka?.dane.top.map((g) => g.id)).toEqual(["D", "A", "B", "E", "C"]);
    expect(widok.czeka?.nowe).toEqual(["D", "E"]);
    expect(dzwiek).toBeNull();
    // Kolejne pytanie bez nowych gier nie gubi tych, które czekają
    const dalej = przyjmij(widok, ranking(A, B, C, D, E), []).widok;
    expect(dalej.czeka?.nowe).toEqual(["D", "E"]);
  });

  it("ta sama gra z dwóch pytań liczy się raz", () => {
    const D = gra("D", 500, 4);
    const poRekordzie = przyjmij(poStarcie(), ranking(A, B, C, D), ["D"]).widok;
    expect(przyjmij(poRekordzie, ranking(A, B, C, D), ["D"]).widok.czeka?.nowe).toEqual(["D"]);
  });

  it("drugi rekord w trakcie ekranu rekordu nie otwiera drugiego ekranu", () => {
    const D = gra("D", 500, 4);
    const E = gra("E", 900, 5);
    const poRekordzie = przyjmij(poStarcie(), ranking(A, B, C, D), ["D"]).widok;
    const { widok, dzwiek } = przyjmij(poRekordzie, ranking(A, B, C, D, E), ["E"]);
    expect(widok.rekord).toEqual(D);
    expect(dzwiek).toBeNull();
  });
});

describe("zamknięcie ekranu rekordu", () => {
  it("po zamknięciu w tabeli są dane, które czekały, rekord miga, bez drugiego dźwięku", () => {
    const D = gra("D", 500, 4);
    const poRekordzie = przyjmij(poStarcie(), ranking(A, B, C, D), ["D"]).widok;
    const { widok, dzwiek } = zamknij(poRekordzie);
    expect(widok.rekord).toBeNull();
    expect(widok.czeka).toBeNull();
    expect(widok.tabela?.dane.top.map((g) => g.id)).toEqual(["D", "A", "B", "C"]);
    expect(widok.tabela?.nowe).toEqual(["D"]);
    expect(widok.tabela?.rekord).toEqual(D);
    expect(dzwiek).toBeNull();
  });

  it("gry, które przyszły w trakcie, migają razem z rekordem i dają dwa bipy", () => {
    const D = gra("D", 500, 4);
    const E = gra("E", 20, 5);
    let w = przyjmij(poStarcie(), ranking(A, B, C, D), ["D"]).widok;
    w = przyjmij(w, ranking(A, B, C, D, E), ["E"]).widok;
    const { widok, dzwiek } = zamknij(w);
    expect(widok.tabela?.nowe).toEqual(["D", "E"]);
    expect(dzwiek).toBe("nowa-gra");
  });

  it("zamknięcie bez otwartego ekranu niczego nie zmienia", () => {
    const start = poStarcie();
    expect(zamknij(start)).toEqual({ widok: start, dzwiek: null });
  });

  it("po zamknięciu kolejna nowa gra porównuje się z nowym rekordem", () => {
    const D = gra("D", 500, 4);
    const E = gra("E", 400, 5);
    const poZamknieciu = zamknij(przyjmij(poStarcie(), ranking(A, B, C, D), ["D"]).widok).widok;
    const { widok, dzwiek } = przyjmij(poZamknieciu, ranking(A, B, C, D, E), ["E"]);
    expect(widok.rekord).toBeNull();
    expect(dzwiek).toBe("nowa-gra");
  });
});
