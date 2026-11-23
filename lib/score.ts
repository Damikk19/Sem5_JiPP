// Wynik zapisany w bazie (encja Score z diagramu C4).
// id i timestamp nadaje serwer, bo micro:bit nie ma zegara ani generatora UUID.
export type Score = {
  id: string;
  playerId: string;
  score: number;
  timestamp: string;
};

// To, co przychodzi od bramki prowadzącego po przetworzeniu.
export type ScoreDto = {
  playerId: string;
  score: number;
};

export const MAX_SCORE = 99999;
export const MAX_PLAYER_ID_LENGTH = 32;
