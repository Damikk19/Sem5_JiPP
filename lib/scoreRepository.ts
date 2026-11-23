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
