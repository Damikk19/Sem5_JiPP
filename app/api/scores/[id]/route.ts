// Usuwanie wyniku z rankingu (D z CRUD), np. testowego albo fałszywego wpisu.
// Wymaga klucza admina, innego niż klucz bramki: bramka może tylko dopisywać.
import type { NextRequest } from "next/server";
import { checkAdminKey } from "@/lib/auth";
import { authError, json, preflight } from "@/lib/http";
import { logError, logZmiana } from "@/lib/log";
import { remove } from "@/lib/scoreRepository";

export const maxDuration = 10;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/scores/[id]">) {
  const auth = checkAdminKey(request);
  if (auth !== "ok") return authError(auth, "admina");

  const { id } = await ctx.params;
  if (!UUID.test(id)) return json({ error: "Niepoprawne id (oczekiwany UUID)" }, 400);

  try {
    const deleted = await remove(id);
    if (!deleted) return json({ error: "Nie ma wyniku o takim id" }, 404);
    logZmiana("DELETE /api/scores usunięty", deleted);
    return json(deleted);
  } catch (e) {
    logError("DELETE /api/scores/[id]", e);
    return json({ error: "Błąd bazy danych" }, 500);
  }
}

export function OPTIONS() {
  return preflight("DELETE");
}
