import { db } from "./db";
import type { Score, ScoreDto } from "./score";

const COLUMNS = `id, player_id AS "playerId", score, "timestamp"`;

export async function save(dto: ScoreDto): Promise<Score> {
  const rows = await db().query(
    `INSERT INTO scores (player_id, score) VALUES ($1, $2) RETURNING ${COLUMNS}`,
    [dto.playerId, dto.score],
  );
  return rows[0] as Score;
}

// Ranking: najwyższy wynik pierwszy, przy remisie wygrywa ten, kto był pierwszy.
export async function getTop(limit: number): Promise<Score[]> {
  const rows = await db().query(
    `SELECT ${COLUMNS} FROM scores ORDER BY score DESC, "timestamp" ASC LIMIT $1`,
    [limit],
  );
  return rows as Score[];
}

// Ostatnie gry, od najnowszej (do paska „ostatnia gra” na stronie).
export async function getLatest(limit: number): Promise<Score[]> {
  const rows = await db().query(
    `SELECT ${COLUMNS} FROM scores ORDER BY "timestamp" DESC LIMIT $1`,
    [limit],
  );
  return rows as Score[];
}

// Usuwa wynik po id i zwraca usunięty wpis (null, jeśli takiego nie było)
export async function remove(id: string): Promise<Score | null> {
  const rows = await db().query(`DELETE FROM scores WHERE id = $1 RETURNING ${COLUMNS}`, [id]);
  return (rows[0] as Score | undefined) ?? null;
}
