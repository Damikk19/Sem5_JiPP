import { db } from "./db";
import type { Score, ScoreDto } from "./score";

const COLUMNS = `id, player_id AS "playerId", score, "timestamp"`;

// Sterownik bazy zwraca timestamptz jako Date, a API obiecuje tekst ISO (np. "2026-11-23T12:00:00.000Z"),
// więc zamieniamy go tutaj, w jednym miejscu
type Row = Omit<Score, "timestamp"> & { timestamp: Date | string };

function toScore(row: Row): Score {
  return { id: row.id, playerId: row.playerId, score: row.score, timestamp: new Date(row.timestamp).toISOString() };
}

export async function save(dto: ScoreDto): Promise<Score> {
  const rows = await db().query(
    `INSERT INTO scores (player_id, score) VALUES ($1, $2) RETURNING ${COLUMNS}`,
    [dto.playerId, dto.score],
  );
  return toScore(rows[0] as Row);
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
