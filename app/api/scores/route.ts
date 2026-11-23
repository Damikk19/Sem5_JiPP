// GameController z diagramu C4: POST zapisuje wynik (wymaga klucza API), GET zwraca ranking (publiczny).
import type { NextRequest } from "next/server";
import { checkApiKey } from "@/lib/auth";
import { parse } from "@/lib/scoreValidator";
import { getLatest, getTop, save } from "@/lib/scoreRepository";

// Bramka i Arduino nie wysyłają nagłówków CORS, ale przeglądarka już tak,
// więc pozwalamy na wywołania z dowolnej strony (np. testy z przeglądarki).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

export async function POST(request: NextRequest) {
  const auth = checkApiKey(request);
  if (auth === "not-configured") {
    console.error("POST /api/scores: brak API_TOKEN w zmiennych środowiskowych");
    return json({ error: "Serwer nie ma skonfigurowanego klucza API" }, 500);
  }
  if (auth !== "ok") {
    return Response.json(
      { error: auth === "missing" ? "Brak klucza API" : "Zły klucz API" },
      { status: 401, headers: { ...CORS, "WWW-Authenticate": "Bearer" } },
    );
  }

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
  const raw = Number(request.nextUrl.searchParams.get("limit") ?? 10);
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
  return new Response(null, { status: 204, headers: CORS });
}
