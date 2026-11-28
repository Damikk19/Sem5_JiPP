import { db } from "./db";
import { DUPLIKAT_S, MAX_ZAPISOW_W_OKNIE, ODSTEP_NICKU_S, OKNO_S } from "./limity";
import type { Score, ScoreDto } from "./score";

const COLUMNS = `id, player_id AS "playerId", score, "timestamp"`;

// Sterownik bazy zwraca timestamptz jako Date, a API obiecuje tekst ISO (np. "2026-11-23T12:00:00.000Z"),
// więc zamieniamy go tutaj, w jednym miejscu
type Row = Omit<Score, "timestamp"> & { timestamp: Date | string };

function toScore(row: Row): Score {
  return { id: row.id, playerId: row.playerId, score: row.score, timestamp: new Date(row.timestamp).toISOString() };
}

// Wynik zapisu: nowy wiersz, istniejący wiersz tej samej gry (duplikat) albo odmowa z czasem do ponowienia
export type Zapis =
  | { rodzaj: "nowy" | "duplikat"; wynik: Score }
  | { rodzaj: "limit"; powod: "nick" | "wszystkie"; ponowZaS: number };

// Jedna blokada na wszystkie zapisy: zapisy czekają na siebie w kolejce, więc dwa równoległe żądania nie
// zobaczą tego samego stanu i nie przekroczą razem limitu (także łącznego, dlatego nie blokada na nicku).
// Blokada trwa do końca transakcji, czyli milisekundy (oba polecenia idą do Neona w jednym żądaniu HTTP),
// a zapisów jest najwyżej kilka na minutę, więc kolejka nie spowalnia bramki.
const BLOKADA = `SELECT pg_advisory_xact_lock(hashtext('scores:zapis'))`;

// Po blokadzie jedno polecenie sprawdza limity i dopisuje wiersz, tylko gdy żaden nie zabrania.
// Każdy warunek czasu ma postać "timestamp" > now() - okno, żeby baza szła istniejącym indeksem
// scores_latest_idx i czytała tylko wiersze z okna. Zwraca zawsze dokładnie jeden wiersz: "nowy" (dopisany),
// "duplikat" (ta sama gra przed chwilą) albo "limit" z czasem do ponowienia w sekundach (zaokrąglonym w górę,
// więc co najmniej 1).
// Duplikat to tylko ostatni wpis tego nicku z okna, i to z tym samym wynikiem. Gry 0, 10, 0 to trzy różne
// gry, a nie powtórka pierwszej, bo między nimi była inna.
const ZAPIS = `
WITH
  duplikat AS (
    SELECT * FROM (
      SELECT ${COLUMNS} FROM scores
      WHERE "timestamp" > now() - make_interval(secs => $3) AND player_id = $1
      ORDER BY "timestamp" DESC, id DESC
      LIMIT 1
    ) ostatni
    WHERE score = $2
  ),
  nick AS (
    SELECT max("timestamp") AS ostatni FROM scores
    WHERE "timestamp" > now() - make_interval(secs => $4) AND player_id = $1
  ),
  okno AS (
    -- Wpis numer $6 od najnowszego w oknie: jeśli istnieje, limit jest wyczerpany, a gdy wypadnie z okna,
    -- zrobi się miejsce na następny
    SELECT "timestamp" AS graniczny FROM scores
    WHERE "timestamp" > now() - make_interval(secs => $5)
    ORDER BY "timestamp" DESC, id DESC
    OFFSET $6::int - 1
    LIMIT 1
  ),
  nowy AS (
    INSERT INTO scores (player_id, score)
    SELECT $1, $2
    WHERE NOT EXISTS (SELECT FROM duplikat)
      AND (SELECT ostatni FROM nick) IS NULL
      AND NOT EXISTS (SELECT FROM okno)
    RETURNING ${COLUMNS}
  )
SELECT 'nowy' AS rodzaj, nowy.*, NULL::boolean AS "limitWszystkich", NULL::int AS "ponowZaS" FROM nowy
UNION ALL
SELECT 'duplikat', duplikat.*, NULL, NULL FROM duplikat
UNION ALL
SELECT 'limit', NULL, NULL, NULL, NULL,
  EXISTS (SELECT FROM okno),
  greatest(
    ceil(extract(epoch FROM (SELECT ostatni FROM nick) + make_interval(secs => $4) - now())),
    ceil(extract(epoch FROM (SELECT graniczny FROM okno) + make_interval(secs => $5) - now()))
  )::int
WHERE NOT EXISTS (SELECT FROM nowy) AND NOT EXISTS (SELECT FROM duplikat)`;

type WierszZapisu = Row & { rodzaj: Zapis["rodzaj"]; limitWszystkich: boolean | null; ponowZaS: number | null };

export async function save(dto: ScoreDto): Promise<Zapis> {
  const sql = db();
  // READ COMMITTED: każde polecenie widzi stan z chwili, w której się zaczęło, czyli już po zdobyciu blokady,
  // razem z wierszami dopisanymi przez poprzedni zapis z kolejki. Przy REPEATABLE READ widziałoby stan sprzed
  // czekania na blokadę i limity dałoby się obejść równoległymi żądaniami.
  const [, rows] = await sql.transaction(
    (tx) => [
      tx.query(BLOKADA),
      tx.query(ZAPIS, [dto.playerId, dto.score, DUPLIKAT_S, ODSTEP_NICKU_S, OKNO_S, MAX_ZAPISOW_W_OKNIE]),
    ],
    { isolationLevel: "ReadCommitted" },
  );
  const row = rows[0] as WierszZapisu;
  if (row.rodzaj === "limit") {
    return { rodzaj: "limit", powod: row.limitWszystkich ? "wszystkie" : "nick", ponowZaS: Number(row.ponowZaS) };
  }
  return { rodzaj: row.rodzaj, wynik: toScore(row) };
}

// Ranking: najwyższy wynik pierwszy, przy remisie wygrywa ten, kto był pierwszy.
// id na końcu tylko po to, żeby kolejność była zawsze ta sama (gdyby czas był identyczny).
export async function getTop(limit: number): Promise<Score[]> {
  const rows = await db().query(
    `SELECT ${COLUMNS} FROM scores ORDER BY score DESC, "timestamp" ASC, id ASC LIMIT $1`,
    [limit],
  );
  return (rows as Row[]).map(toScore);
}

// Ostatnie gry, od najnowszej (do paska „ostatnia gra” na stronie).
export async function getLatest(limit: number): Promise<Score[]> {
  const rows = await db().query(
    `SELECT ${COLUMNS} FROM scores ORDER BY "timestamp" DESC, id DESC LIMIT $1`,
    [limit],
  );
  return (rows as Row[]).map(toScore);
}

// Usuwa wynik po id i zwraca usunięty wpis (null, jeśli takiego nie było)
export async function remove(id: string): Promise<Score | null> {
  const rows = await db().query(`DELETE FROM scores WHERE id = $1 RETURNING ${COLUMNS}`, [id]);
  return rows[0] ? toScore(rows[0] as Row) : null;
}
