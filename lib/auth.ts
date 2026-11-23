import { createHash, timingSafeEqual } from "node:crypto";

// Klucz API do zapisu wyników. Bez niego każdy mógłby dopisać do rankingu dowolny wynik.
// Klucz trzymamy w zmiennej środowiskowej API_TOKEN (Vercel → Settings → Environment Variables),
// nigdy w kodzie ani w repozytorium.

export type AuthResult = "ok" | "missing" | "invalid" | "not-configured";

// Klucz można podać na trzy sposoby, żeby bramka mogła wybrać najprostszy:
// nagłówek "Authorization: Bearer <klucz>", nagłówek "X-API-Key: <klucz>" albo "?key=<klucz>" w adresie.
function tokenFrom(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) return apiKey.trim() || null;
  return new URL(request.url).searchParams.get("key");
}

export function checkApiKey(request: Request): AuthResult {
  const expected = process.env.API_TOKEN;
  // Bez skonfigurowanego klucza zapis jest zablokowany (lepiej odrzucić niż wpuścić wszystkich)
  if (!expected) return "not-configured";
  const given = tokenFrom(request);
  if (!given) return "missing";
  // Porównanie w stałym czasie (skróty SHA-256 mają równą długość), żeby czas odpowiedzi nie zdradzał klucza
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) ? "ok" : "invalid";
}
