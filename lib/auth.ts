import { createHash, timingSafeEqual } from "node:crypto";

// Dwa klucze, każdy z innymi uprawnieniami (zasada najmniejszych uprawnień):
// API_TOKEN pozwala tylko dopisywać wyniki (dostaje go bramka prowadzącego),
// ADMIN_TOKEN pozwala usuwać wpisy (ma go tylko właściciel projektu).
// Klucze są w zmiennych środowiskowych (Vercel → Settings → Environment Variables),
// nigdy w kodzie ani w repozytorium.

export type AuthResult = "ok" | "missing" | "invalid" | "not-configured";

// Wszystkie miejsca, w których klient mógł podać klucz. Sprawdzamy każde, bo bramka może
// np. doklejać własny nagłówek Authorization, a nasz klucz wysyłać w X-API-Key albo w adresie.
// - Authorization: "Bearer <klucz>" albo "Token <klucz>", a bez słowa przed kluczem cała wartość
// - X-API-Key: <klucz>
// - ?key=<klucz> w adresie, tylko dla klucza zapisu (adres zostaje w logach i historii)
function candidates(request: Request, allowQuery: boolean): string[] {
  const found: string[] = [];
  const auth = request.headers.get("authorization")?.trim();
  if (auth) {
    const match = auth.match(/^(bearer|token)(?:\s+(.*))?$/i);
    found.push(match ? (match[2] ?? "").trim() : auth);
  }
  const apiKey = request.headers.get("x-api-key")?.trim();
  if (apiKey) found.push(apiKey);
  if (allowQuery) {
    const query = new URL(request.url).searchParams.get("key")?.trim();
    if (query) found.push(query);
  }
  return found.filter((value) => value.length > 0);
}

// Porównanie w stałym czasie (skróty SHA-256 mają równą długość), żeby czas odpowiedzi nie zdradzał klucza
function sameKey(given: string, expected: string) {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function check(request: Request, configured: string | undefined, allowQuery: boolean): AuthResult {
  // Klucz z konfiguracji też przycinamy: wklejony na Vercelu z enterem na końcu nie może blokować bramki
  const expected = configured?.trim();
  // Bez skonfigurowanego klucza operacja jest zablokowana (lepiej odrzucić niż wpuścić wszystkich)
  if (!expected) return "not-configured";
  const given = candidates(request, allowQuery);
  if (given.length === 0) return "missing";
  // Sprawdzamy każdego kandydata do końca, bez przerywania, żeby czas nie zależał od tego, który pasuje
  let ok = false;
  for (const value of given) ok = sameKey(value, expected) || ok;
  return ok ? "ok" : "invalid";
}

export function checkApiKey(request: Request): AuthResult {
  return check(request, process.env.API_TOKEN, true);
}

// Klucz admina tylko w nagłówku: adres z ?key= może zostać w logach albo historii przeglądarki
export function checkAdminKey(request: Request): AuthResult {
  return check(request, process.env.ADMIN_TOKEN, false);
}
