// GameController z diagramu C4: POST zapisuje wynik (wymaga klucza API), GET zwraca ranking (publiczny).
// Usuwanie pojedynczego wyniku jest w [id]/route.ts.
import type { NextRequest } from "next/server";
import { checkApiKey } from "@/lib/auth";
import { authError, json, preflight } from "@/lib/http";
import { parse } from "@/lib/scoreValidator";
import { getLatest, getTop, save } from "@/lib/scoreRepository";

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
    console.error("POST /api/scores", e);
    return json({ error: "Błąd bazy danych" }, 500);
  }
}

export async function GET(request: NextRequest) {
  // Brak albo puste ?limit= daje domyślne 10 (Number("") to 0, które podniosłoby limit do 1)
  const param = request.nextUrl.searchParams.get("limit")?.trim();
  const raw = param ? Number(param) : 10;
  const limit = Number.isInteger(raw) ? Math.min(Math.max(raw, 1), 100) : 10;

  // ?sort=latest zwraca ostatnie gry, domyślnie ranking od najlepszego wyniku.
  const latest = request.nextUrl.searchParams.get("sort") === "latest";

  try {
    return json(latest ? await getLatest(limit) : await getTop(limit));
  } catch (e) {
    console.error("GET /api/scores", e);
    return json({ error: "Błąd bazy danych" }, 500);
  }
}

export function OPTIONS() {
  return preflight();
}
