// GameController z diagramu C4: POST zapisuje wynik (wymaga klucza API), GET zwraca ranking (publiczny).
// Usuwanie pojedynczego wyniku jest w [id]/route.ts.
import type { NextRequest } from "next/server";
import { checkApiKey } from "@/lib/auth";
import { authError, json, jsonPubliczny, preflight } from "@/lib/http";
import { logError } from "@/lib/log";
import { parse } from "@/lib/scoreValidator";
import { getLatest, getTop, save } from "@/lib/scoreRepository";

// Funkcja nie powinna wisieć minutami, gdy baza nie odpowiada (na Vercelu liczy się każda sekunda)
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  const auth = checkApiKey(request);
  if (auth !== "ok") return authError(auth, "API");

  // Czytamy tekst zamiast request.json(), bo bramka może nie ustawić Content-Type.
  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return json({ error: "Niepoprawny JSON" }, 400);
  }

  const parsed = parse(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  try {
    const score = await save(parsed.dto);
    return json(score, 201);
  } catch (e) {
    logError("POST /api/scores", e);
    return json({ error: "Błąd bazy danych" }, 500);
  }
}

export async function GET(request: NextRequest) {
  // ?limit= tylko z samych cyfr (jak wynik), przycinany do 1–100. Brak albo coś innego (np. "0x10", "-5") daje 10.
  const param = request.nextUrl.searchParams.get("limit")?.trim() ?? "";
  const limit = /^\d+$/.test(param) ? Math.min(Math.max(Number(param), 1), 100) : 10;

  // ?sort=latest zwraca ostatnie gry, domyślnie ranking od najlepszego wyniku.
  const latest = request.nextUrl.searchParams.get("sort") === "latest";

  try {
    return jsonPubliczny(latest ? await getLatest(limit) : await getTop(limit));
  } catch (e) {
    logError("GET /api/scores", e);
    return json({ error: "Błąd bazy danych" }, 500);
  }
}

export function OPTIONS() {
  return preflight("GET, POST");
}
