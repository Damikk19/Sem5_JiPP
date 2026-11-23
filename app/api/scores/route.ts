// GameController z diagramu C4: POST zapisuje wynik, GET zwraca ranking.
import type { NextRequest } from "next/server";
import { parse } from "@/lib/scoreValidator";
import { getTop, save } from "@/lib/scoreRepository";

// Bramka i Arduino nie wysyłają nagłówków CORS, ale przeglądarka już tak,
// więc pozwalamy na wywołania z dowolnej strony (np. testy z przeglądarki).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

export async function POST(request: NextRequest) {
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

  try {
    return json(await getTop(limit));
  } catch (e) {
    console.error("GET /api/scores", e);
    return json({ error: "Błąd bazy danych" }, 500);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
