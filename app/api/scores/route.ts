// GameController z diagramu C4: POST zapisuje wynik (wymaga klucza API), GET zwraca ranking (publiczny).
// Usuwanie pojedynczego wyniku jest w [id]/route.ts.
import type { NextRequest } from "next/server";
import { checkApiKey } from "@/lib/auth";
import { authError, czytajBody, json, jsonPubliczny, preflight, zaCzesto } from "@/lib/http";
import { MAX_BODY_BAJTOW, MAX_ZAPISOW_W_OKNIE, ODSTEP_NICKU_S, OKNO_S } from "@/lib/limity";
import { logError } from "@/lib/log";
import { parse } from "@/lib/scoreValidator";
import { getLatest, getTop, save } from "@/lib/scoreRepository";

// Funkcja nie powinna wisieć minutami, gdy baza nie odpowiada (na Vercelu liczy się każda sekunda)
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  const auth = checkApiKey(request);
  if (auth !== "ok") return authError(auth, "API");

  // Czytamy tekst zamiast request.json(), bo bramka może nie ustawić Content-Type. Klucz jest sprawdzony
  // wcześniej, więc bez niego body nie jest czytane wcale.
  let body: unknown;
  try {
    const tekst = await czytajBody(request, MAX_BODY_BAJTOW);
    if (tekst === null) return json({ error: `Body za duże (maks. ${MAX_BODY_BAJTOW} B)` }, 413);
    body = JSON.parse(tekst);
  } catch {
    return json({ error: "Niepoprawny JSON" }, 400);
  }

  const parsed = parse(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  try {
    const zapis = await save(parsed.dto);
    if (zapis.rodzaj === "limit") {
      const powod =
        zapis.powod === "wszystkie"
          ? `Za dużo zapisów: najwyżej ${MAX_ZAPISOW_W_OKNIE} na ${OKNO_S} s`
          : `Ten nick zapisał inny wynik przed chwilą: najwyżej jeden zapis na ${ODSTEP_NICKU_S} s`;
      return zaCzesto(powod, zapis.ponowZaS);
    }
    // Duplikat (ta sama gra jeszcze raz) dostaje 200 z istniejącym wpisem: bramka wie, że wynik jest zapisany
    return json(zapis.wynik, zapis.rodzaj === "nowy" ? 201 : 200);
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
