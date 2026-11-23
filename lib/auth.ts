import { createHash, timingSafeEqual } from "node:crypto";

// Dwa klucze, każdy z innymi uprawnieniami (zasada najmniejszych uprawnień):
// API_TOKEN pozwala tylko dopisywać wyniki (dostaje go bramka prowadzącego),
// ADMIN_TOKEN pozwala usuwać wpisy (ma go tylko właściciel projektu).
// Klucze są w zmiennych środowiskowych (Vercel → Settings → Environment Variables),
// nigdy w kodzie ani w repozytorium.

export type AuthResult = "ok" | "missing" | "invalid" | "not-configured";

// Klucz w nagłówku "Authorization: Bearer <klucz>" albo "X-API-Key: <klucz>".
// Klucz do zapisu może też przyjść jako "?key=<klucz>", żeby bramce wystarczył sam adres.
function tokenFrom(request: Request, allowQuery: boolean): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) return apiKey.trim() || null;
  return allowQuery ? new URL(request.url).searchParams.get("key") : null;
}

function check(request: Request, expected: string | undefined, allowQuery: boolean): AuthResult {
  // Bez skonfigurowanego klucza operacja jest zablokowana (lepiej odrzucić niż wpuścić wszystkich)
  if (!expected) return "not-configured";
  const given = tokenFrom(request, allowQuery);
  if (!given) return "missing";
  // Porównanie w stałym czasie (skróty SHA-256 mają równą długość), żeby czas odpowiedzi nie zdradzał klucza
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) ? "ok" : "invalid";
}

export function checkApiKey(request: Request): AuthResult {
  return check(request, process.env.API_TOKEN, true);
}

// Klucz admina tylko w nagłówku: adres z ?key= może zostać w logach albo historii przeglądarki
export function checkAdminKey(request: Request): AuthResult {
  return check(request, process.env.ADMIN_TOKEN, false);
}
