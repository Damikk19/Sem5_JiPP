import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getLatest, getTop, remove, save } from "@/lib/scoreRepository";

// Prawdziwy Postgres (PGlite, uruchamiany w procesie testów) z tym samym schema.sql co na produkcji.
// Sprawdza zapytania SQL: kolejność rankingu, remisy, wartości domyślne i ograniczenia tabeli.
const baza = vi.hoisted(() => ({ pg: null as unknown as PGlite }));

vi.mock("@/lib/db", () => ({
  db: () => ({
    query: async (text: string, params?: unknown[]) => (await baza.pg.query(text, params)).rows,
  }),
}));

async function wstaw(gracz: string, wynik: number, czas: string) {
  await baza.pg.query(`INSERT INTO scores (player_id, score, "timestamp") VALUES ($1, $2, $3)`, [gracz, wynik, czas]);
}

beforeAll(async () => {
  baza.pg = new PGlite();
  await baza.pg.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
});

beforeEach(async () => {
  await baza.pg.exec("DELETE FROM scores");
});

describe("ScoreRepository na prawdziwym Postgresie", () => {
  it("save: id (UUID) i czas zapisu nadaje baza", async () => {
    const wynik = await save({ playerId: "ABC", score: 42 });
    expect(wynik.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(wynik).toMatchObject({ playerId: "ABC", score: 42 });
    expect(Number.isNaN(new Date(wynik.timestamp).getTime())).toBe(false);
  });

  it("getTop: od najwyższego wyniku, przy remisie wyżej ten, kto zagrał wcześniej", async () => {
    await wstaw("PÓŹNY", 50, "2026-11-23 10:00:00+00");
    await wstaw("NAJLEPSZY", 80, "2026-11-23 11:00:00+00");
    await wstaw("WCZESNY", 50, "2026-11-23 09:00:00+00");
    await wstaw("SŁABY", 5, "2026-11-23 08:00:00+00");
    const ranking = await getTop(10);
    expect(ranking.map((w) => w.playerId)).toEqual(["NAJLEPSZY", "WCZESNY", "PÓŹNY", "SŁABY"]);
  });

  it("getTop: zwraca tylko tyle wyników, ile wynosi limit", async () => {
    for (let i = 0; i < 5; i++) await wstaw(`G${i}`, i, "2026-11-23 10:00:00+00");
    expect(await getTop(3)).toHaveLength(3);
  });

  it("zwraca czas jako tekst ISO, tak jak opisuje API", async () => {
    await wstaw("ABC", 1, "2026-11-23 12:00:00.5+00");
    const [wynik] = await getTop(1);
    expect(wynik.timestamp).toBe("2026-11-23T12:00:00.500Z");
    expect((await save({ playerId: "X", score: 2 })).timestamp).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  });

  it("getLatest i getTop: przy identycznym czasie kolejność jest zawsze ta sama", async () => {
    await baza.pg.exec(`
      INSERT INTO scores (id, player_id, score, "timestamp") VALUES
        ('00000000-0000-4000-8000-000000000001', 'A', 5, '2026-11-23 10:00:00+00'),
        ('00000000-0000-4000-8000-000000000003', 'C', 5, '2026-11-23 10:00:00+00'),
        ('00000000-0000-4000-8000-000000000002', 'B', 5, '2026-11-23 10:00:00+00')`);
    expect((await getLatest(3)).map((w) => w.playerId)).toEqual(["C", "B", "A"]);
    expect((await getTop(3)).map((w) => w.playerId)).toEqual(["A", "B", "C"]);
  });

  it("getLatest: od najnowszej gry, niezależnie od wyniku", async () => {
    await wstaw("STARY", 999, "2026-11-23 08:00:00+00");
    await wstaw("NOWY", 1, "2026-11-23 12:00:00+00");
    const [ostatni] = await getLatest(1);
    expect(ostatni.playerId).toBe("NOWY");
  });

  it("remove: usuwa wpis i go zwraca, a drugi raz zwraca null", async () => {
    const zapisany = await save({ playerId: "TEST", score: 7 });
    expect(await remove(zapisany.id)).toMatchObject({ id: zapisany.id, playerId: "TEST" });
    expect(await remove(zapisany.id)).toBeNull();
    expect(await getTop(10)).toEqual([]);
  });

  it("baza sama odrzuca wynik spoza 0-99999 (CHECK), nawet gdyby ktoś ominął API", async () => {
    await expect(wstaw("OSZUST", 100000, "2026-11-23 10:00:00+00")).rejects.toThrow();
    await expect(wstaw("OSZUST", -1, "2026-11-23 10:00:00+00")).rejects.toThrow();
  });

  it("baza odrzuca nick dłuższy niż 32 znaki", async () => {
    await expect(save({ playerId: "x".repeat(33), score: 1 })).rejects.toThrow();
  });
});
