// Dane dla strony z rankingiem w jednym żądaniu: TOP 10 i ostatnie gry (do paska LAST i do wykrywania nowych gier).
// Strona pyta co kilka sekund, więc jedno żądanie zamiast dwóch to o połowę mniej wywołań funkcji.
import { json, preflight } from "@/lib/http";
import { logError } from "@/lib/log";
import { getLatest, getTop } from "@/lib/scoreRepository";

export const maxDuration = 10;

const TOP = 10;
const OSTATNIE = 10;

export async function GET() {
  try {
    const [top, latest] = await Promise.all([getTop(TOP), getLatest(OSTATNIE)]);
    return json({ top, latest });
  } catch (e) {
    logError("GET /api/ranking", e);
    return json({ error: "Błąd bazy danych" }, 500);
  }
}

export function OPTIONS() {
  return preflight("GET");
}
