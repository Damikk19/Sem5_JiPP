-- Jedna tabela na wyniki. id i timestamp nadaje baza.
CREATE TABLE IF NOT EXISTS scores (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   varchar(32) NOT NULL,
  score       integer     NOT NULL CHECK (score BETWEEN 0 AND 99999),
  "timestamp" timestamptz NOT NULL DEFAULT now()
);

-- Indeks pod ranking (ORDER BY score DESC, timestamp ASC).
CREATE INDEX IF NOT EXISTS scores_ranking_idx ON scores (score DESC, "timestamp" ASC);
