import { neonConfig } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { save } from "@/lib/scoreRepository";

// Testy na PGlite podmieniają sql.transaction(). Tutaj działa prawdziwy sterownik Neon, a podmienione jest
// tylko wysyłanie: żądanie trafia do funkcji w teście (adres 127.0.0.1, więc nic nie wychodzi z komputera).
// Sprawdza, że blokada i zapis idą razem, w tej kolejności i w READ COMMITTED (opis w lib/scoreRepository.ts).
const wyslane: { url: string; headers: Record<string, string>; body: { queries: { query: string; params: unknown[] }[] } }[] = [];

beforeAll(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost/test");
  neonConfig.fetchEndpoint = () => "http://127.0.0.1:9/sql";
  neonConfig.fetchFunction = async (url: string, init: RequestInit) => {
    wyslane.push({ url: String(url), headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    const wiersz = { fields: [{ name: "x", dataTypeID: 25 }], rows: [[""]], command: "SELECT", rowCount: 1, rowAsArray: true };
    const zapis = {
      fields: ["rodzaj", "id", "playerId", "score", "timestamp", "limitWszystkich", "ponowZaS"].map((name) => ({ name, dataTypeID: 25 })),
      rows: [["nowy", "3f2b8c1e-7a4d-4c2b-9e1f-0a6b5c4d3e2f", "ABC", 5, "2026-11-28 12:00:00+00", null, null]],
      command: "SELECT",
      rowCount: 1,
      rowAsArray: true,
    };
    return Response.json({ results: [wiersz, zapis] });
  };
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("save przez sterownik Neon", () => {
  it("wysyła blokadę i zapis w jednym żądaniu, jako jedną transakcję READ COMMITTED", async () => {
    const zapis = await save({ playerId: "ABC", score: 5 });
    expect(zapis).toMatchObject({ rodzaj: "nowy", wynik: { playerId: "ABC", timestamp: "2026-11-28T12:00:00.000Z" } });
    expect(wyslane).toHaveLength(1);
    expect(wyslane[0].url).toBe("http://127.0.0.1:9/sql");
    expect(wyslane[0].headers["Neon-Batch-Isolation-Level"]).toBe("ReadCommitted");
    const [blokada, polecenie] = wyslane[0].body.queries;
    expect(blokada.query).toContain("pg_advisory_xact_lock");
    expect(polecenie.query).toContain("INSERT INTO scores");
    // Nick i wynik idą jako parametry, nigdy wklejone w tekst zapytania
    expect(polecenie.params.slice(0, 2)).toEqual(["ABC", "5"]);
    expect(polecenie.query).not.toContain("ABC");
  });
});
