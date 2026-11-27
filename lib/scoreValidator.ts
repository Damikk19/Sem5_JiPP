import { MAX_PLAYER_ID_LENGTH, MAX_SCORE, type ScoreDto } from "./score";

export type ParseResult =
  | { ok: true; dto: ScoreDto }
  | { ok: false; error: string };

// Format od bramki prowadzącego (lab 13.11): { "id": "<gracz>", "wynik": <liczba> }.
// Bramka przepisuje dane z radia, więc liczba może przyjść jako tekst, np. "50".
export function parse(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Body musi być obiektem JSON: { "id": "...", "wynik": 123 }' };
  }
  const { id, wynik } = body as Record<string, unknown>;

  if (typeof id !== "string" && typeof id !== "number") {
    return { ok: false, error: 'Brak pola "id" (identyfikator gracza)' };
  }
  const playerId = String(id).trim();
  if (playerId.length === 0 || playerId.length > MAX_PLAYER_ID_LENGTH) {
    return { ok: false, error: `"id" musi mieć od 1 do ${MAX_PLAYER_ID_LENGTH} znaków` };
  }

  // Wynik jako tekst tylko z samych cyfr: "123" tak, ale "1e3", "0x1F" czy "12.5" już nie
  const score = typeof wynik === "string" && /^\d+$/.test(wynik.trim()) ? Number(wynik.trim()) : wynik;
  if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return { ok: false, error: `"wynik" musi być liczbą całkowitą od 0 do ${MAX_SCORE}` };
  }

  return { ok: true, dto: { playerId, score } };
}
