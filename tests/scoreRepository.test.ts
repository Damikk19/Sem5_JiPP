import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Score, ScoreDto } from "@/lib/score";
import { getLatest, getTop, remove, save } from "@/lib/scoreRepository";

// Prawdziwy Postgres (PGlite, uruchamiany w procesie testów) z tym samym schema.sql co na produkcji.
// Sprawdza zapytania SQL: kolejność rankingu, remisy, wartości domyślne, ograniczenia tabeli i limity zapisów.
type Zapytanie = { text: string; params?: unknown[] };
const baza = vi.hoisted(() => ({
  pg: null as unknown as PGlite,
  // Ostatnia transakcja: zapytania, opcje i ile blokad doradczych było założonych przed każdym zapytaniem
  transakcja: null as null | { zapytania: Zapytanie[]; opcje: unknown; blokadyPrzed: number[] },
}));

vi.mock("@/lib/db", () => ({
  db: () => ({
    query: async (text: string, params?: unknown[]) => (await baza.pg.query(text, params)).rows,
    // Jak sql.transaction() sterownika Neon: wszystkie zapytania w jednej transakcji, wynik każdego osobno
    transaction: async (zbuduj: (tx: { query: (text: string, params?: unknown[]) => Zapytanie }) => Zapytanie[], opcje?: unknown) => {
      const zapytania = zbuduj({ query: (text, params) => ({ text, params }) });
      const blokadyPrzed: number[] = [];
      const wyniki = await baza.pg.transaction(async (tx) => {
        const rows: unknown[][] = [];
        for (const z of zapytania) {
          const blokady = await tx.query<{ ile: number }>(`SELECT count(*)::int AS ile FROM pg_locks WHERE locktype = 'advisory'`);
          blokadyPrzed.push(blokady.rows[0].ile);
          rows.push((await tx.query(z.text, z.params)).rows);
        }
        return rows;
      });
      baza.transakcja = { zapytania, opcje, blokadyPrzed };
      return wyniki;
    },
  }),
}));

async function wstaw(gracz: string, wynik: number, czas: string) {
  await baza.pg.query(`INSERT INTO scores (player_id, score, "timestamp") VALUES ($1, $2, $3)`, [gracz, wynik, czas]);
}

// Wiersz zapisany podaną liczbę sekund temu (według zegara bazy, tak jak liczy save)
async function wstawTemu(gracz: string, wynik: number, sekund: number) {
  const { rows } = await baza.pg.query<{ id: string }>(
    `INSERT INTO scores (player_id, score, "timestamp") VALUES ($1, $2, now() - make_interval(secs => $3)) RETURNING id`,
    [gracz, wynik, sekund],
  );
  return rows[0].id;
}

async function ileWierszy() {
  return (await baza.pg.query<{ ile: number }>("SELECT count(*)::int AS ile FROM scores")).rows[0].ile;
}

// Zapis, który musi się udać (nowy albo duplikat): zwraca wpis
async function zapisz(dto: ScoreDto) {
  const zapis = await save(dto);
  if (zapis.rodzaj === "limit") throw new Error(`nieoczekiwany limit: ${JSON.stringify(zapis)}`);
  return zapis.wynik;
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
    const zapis = await save({ playerId: "ABC", score: 42 });
    expect(zapis.rodzaj).toBe("nowy");
    const wynik = (zapis as { wynik: Score }).wynik;
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
    const [ostatni] = await getLatest(1);
    expect(ostatni.timestamp).toBe("2026-11-23T12:00:00.500Z");
    expect((await remove(wynik.id))?.timestamp).toBe("2026-11-23T12:00:00.500Z");
    expect((await zapisz({ playerId: "X", score: 2 })).timestamp).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  });

  it("getLatest i getTop: przy identycznym czasie kolejność jest zawsze ta sama", async () => {
    await baza.pg.exec(`
      INSERT INTO scores (id, player_id, score, "timestamp") VALUES
        ('00000000-0000-4000-8000-000000000001', 'A', 5, '2026-11-23 10:00:00+00'),
        ('00000000-0000-4000-8000-000000000003', 'C', 5, '2026-11-23 10:00:00+00'),
        ('00000000-0000-4000-8000-000000000002', 'B', 5, '2026-11-23 10:00:00+00')`);
    // Bez indeksów kolejność zależy tylko od ORDER BY (na produkcji indeks ostatnich gier może jeszcze nie istnieć)
    await baza.pg.exec("SET enable_indexscan = off; SET enable_indexonlyscan = off; SET enable_bitmapscan = off");
    try {
      expect((await getLatest(3)).map((w) => w.playerId)).toEqual(["C", "B", "A"]);
      expect((await getTop(3)).map((w) => w.playerId)).toEqual(["A", "B", "C"]);
    } finally {
      await baza.pg.exec("RESET enable_indexscan; RESET enable_indexonlyscan; RESET enable_bitmapscan");
    }
  });

  it("getLatest: od najnowszej gry, niezależnie od wyniku", async () => {
    await wstaw("STARY", 999, "2026-11-23 08:00:00+00");
    await wstaw("NOWY", 1, "2026-11-23 12:00:00+00");
    const [ostatni] = await getLatest(1);
    expect(ostatni.playerId).toBe("NOWY");
  });

  it("remove: usuwa wpis i go zwraca, a drugi raz zwraca null", async () => {
    const zapisany = await zapisz({ playerId: "TEST", score: 7 });
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

// Starsze wiersze mają jawny czas zapisu "N s temu" według zegara bazy, więc granice okien sprawdzamy
// z obu stron, pół sekundy od granicy (np. 29,5 s i 30,5 s dla okna 30 s), bez czekania w teście.
describe("save: limity zapisów", () => {
  it("ten sam nick i wynik w ciągu 30 s: istniejący wpis, bez nowego wiersza", async () => {
    const id = await wstawTemu("ABC", 50, 29.5);
    const zapis = await save({ playerId: "ABC", score: 50 });
    expect(zapis).toMatchObject({ rodzaj: "duplikat", wynik: { id, playerId: "ABC", score: 50 } });
    expect(await ileWierszy()).toBe(1);
  });

  it("ten sam nick i wynik po ponad 30 s: nowy wiersz (kolejna gra)", async () => {
    const stary = await wstawTemu("ABC", 50, 30.5);
    const zapis = await save({ playerId: "ABC", score: 50 });
    expect(zapis.rodzaj).toBe("nowy");
    expect((zapis as { wynik: Score }).wynik.id).not.toBe(stary);
    expect(await ileWierszy()).toBe(2);
  });

  it("ponowienie zaraz po zapisie (bramka, radio) zwraca ten sam wpis", async () => {
    const pierwszy = await zapisz({ playerId: "ABC", score: 7 });
    const drugi = await save({ playerId: "ABC", score: 7 });
    expect(drugi).toEqual({ rodzaj: "duplikat", wynik: pierwszy });
    expect(await ileWierszy()).toBe(1);
  });

  it("duplikat to ten sam nick i ten sam wynik: inny nick albo inny wynik to nie duplikat", async () => {
    await wstawTemu("ABC", 50, 10);
    expect((await save({ playerId: "XYZ", score: 50 })).rodzaj).toBe("nowy");
    expect((await save({ playerId: "ABC", score: 51 })).rodzaj).toBe("nowy");
    expect(await ileWierszy()).toBe(3);
  });

  it("inny wynik tego samego nicku w ciągu 5 s: limit z czasem do ponowienia", async () => {
    await wstawTemu("ABC", 50, 4.5);
    expect(await save({ playerId: "ABC", score: 60 })).toMatchObject({ rodzaj: "limit", powod: "nick" });
    await baza.pg.exec("DELETE FROM scores");
    await wstawTemu("ABC", 50, 2);
    const zapis = await save({ playerId: "ABC", score: 60 });
    expect(zapis).toEqual({ rodzaj: "limit", powod: "nick", ponowZaS: 3 });
    expect(await ileWierszy()).toBe(1);
  });

  it("czas do ponowienia jest zaokrąglany w górę: tuż przed końcem okna to 1 s, nie 0", async () => {
    await wstawTemu("ABC", 50, 4.9);
    expect(await save({ playerId: "ABC", score: 60 })).toEqual({ rodzaj: "limit", powod: "nick", ponowZaS: 1 });
  });

  it("inny wynik tego samego nicku po ponad 5 s: zapis przechodzi", async () => {
    await wstawTemu("ABC", 50, 5.5);
    expect((await save({ playerId: "ABC", score: 60 })).rodzaj).toBe("nowy");
    expect(await ileWierszy()).toBe(2);
  });

  it("limit nicku nie dotyczy innych nicków", async () => {
    await wstawTemu("ABC", 50, 1);
    expect((await save({ playerId: "ABD", score: 60 })).rodzaj).toBe("nowy");
  });

  it("30. zapis w minucie przechodzi, 31. dostaje limit z czasem do wypadnięcia najstarszego z okna", async () => {
    // 29 zapisów różnych nicków z ostatniej minuty, najstarszy 50 s temu
    await wstawTemu("G00", 1, 50);
    for (let i = 1; i < 29; i++) await wstawTemu(`G${String(i).padStart(2, "0")}`, 1, 40 - i);
    expect((await save({ playerId: "NOWY", score: 1 })).rodzaj).toBe("nowy");
    expect(await ileWierszy()).toBe(30);
    expect(await save({ playerId: "INNY", score: 1 })).toEqual({ rodzaj: "limit", powod: "wszystkie", ponowZaS: 10 });
    expect(await ileWierszy()).toBe(30);
  });

  it("czas do wypadnięcia z okna też jest zaokrąglany w górę: pół sekundy to 1 s", async () => {
    await wstawTemu("G00", 1, 59.5);
    for (let i = 1; i < 30; i++) await wstawTemu(`G${String(i).padStart(2, "0")}`, 1, 30);
    expect(await save({ playerId: "NOWY", score: 1 })).toEqual({ rodzaj: "limit", powod: "wszystkie", ponowZaS: 1 });
  });

  it("zapisy sprzed ponad minuty nie liczą się do limitu", async () => {
    for (let i = 0; i < 40; i++) await wstawTemu(`S${i}`, 1, 60.5 + i);
    for (let i = 0; i < 29; i++) await wstawTemu(`G${i}`, 1, 30);
    expect((await save({ playerId: "NOWY", score: 1 })).rodzaj).toBe("nowy");
  });

  it("gdy działają oba limity, czas do ponowienia jest dłuższy z dwóch", async () => {
    // Okno pełne, ale najstarszy wpis wypada za 2 s, a nick może zapisać dopiero za 4 s
    await wstawTemu("G00", 1, 58);
    for (let i = 1; i < 29; i++) await wstawTemu(`G${String(i).padStart(2, "0")}`, 1, 30);
    await wstawTemu("ABC", 50, 1);
    expect(await save({ playerId: "ABC", score: 60 })).toEqual({ rodzaj: "limit", powod: "wszystkie", ponowZaS: 4 });
    // I odwrotnie: nick za 3 s, okno dopiero za 45 s
    await baza.pg.exec("DELETE FROM scores");
    await wstawTemu("G00", 1, 15);
    for (let i = 1; i < 29; i++) await wstawTemu(`G${String(i).padStart(2, "0")}`, 1, 10);
    await wstawTemu("ABC", 50, 2);
    expect(await save({ playerId: "ABC", score: 60 })).toEqual({ rodzaj: "limit", powod: "wszystkie", ponowZaS: 45 });
  });

  it("duplikat przechodzi także przy pełnym limicie (żaden nowy wiersz nie powstaje)", async () => {
    for (let i = 0; i < 29; i++) await wstawTemu(`G${i}`, 1, 20);
    const id = await wstawTemu("ABC", 50, 3);
    expect(await save({ playerId: "ABC", score: 50 })).toMatchObject({ rodzaj: "duplikat", wynik: { id } });
    expect(await ileWierszy()).toBe(30);
  });

  it("równoległe zapisy: jedna gra wysłana kilka razy daje jeden wiersz, a zalew najwyżej 30", async () => {
    const ta_sama = await Promise.all([1, 2, 3].map(() => save({ playerId: "ABC", score: 9 })));
    expect(ta_sama.map((z) => z.rodzaj).sort()).toEqual(["duplikat", "duplikat", "nowy"]);
    const zalew = await Promise.all(Array.from({ length: 35 }, (_, i) => save({ playerId: `Z${i}`, score: i })));
    expect(zalew.filter((z) => z.rodzaj === "nowy")).toHaveLength(29);
    expect(zalew.filter((z) => z.rodzaj === "limit")).toHaveLength(6);
    expect(await ileWierszy()).toBe(30);
  });

  // PGlite ma jedno połączenie, więc prawdziwego wyścigu dwóch instancji funkcji nie da się tu odtworzyć.
  // Przed wyścigiem na Neonie chroni blokada w tej samej transakcji, w READ COMMITTED (opis w save).
  it("sprawdzenie limitów i dopisanie wiersza działają pod blokadą w tej samej transakcji", async () => {
    await save({ playerId: "ABC", score: 1 });
    const t = baza.transakcja!;
    expect(t.opcje).toMatchObject({ isolationLevel: "ReadCommitted" });
    expect(t.blokadyPrzed[0]).toBe(0);
    expect(t.blokadyPrzed.at(-1)).toBe(1);
    expect(t.zapytania.at(-1)!.text).toContain("INSERT INTO scores");
    // Po transakcji blokada jest zwolniona
    expect((await baza.pg.query<{ ile: number }>(`SELECT count(*)::int AS ile FROM pg_locks WHERE locktype = 'advisory'`)).rows[0].ile).toBe(0);
  });

  it("zapytania po czasie idą indeksem, bez czytania całej tabeli", async () => {
    await save({ playerId: "ABC", score: 1 });
    const zapis = baza.transakcja!.zapytania.at(-1)!;
    await baza.pg.exec("SET enable_seqscan = off");
    try {
      const plan = (await baza.pg.query<{ "QUERY PLAN": string }>(`EXPLAIN ${zapis.text}`, zapis.params)).rows
        .map((w) => w["QUERY PLAN"])
        .join("\n");
      expect(plan).not.toContain("Seq Scan");
      expect(plan).toContain("scores_latest_idx");
    } finally {
      await baza.pg.exec("RESET enable_seqscan");
    }
  });
});
