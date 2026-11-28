import type { AuthResult } from "./auth";

// Bramka i Arduino nie wysyłają nagłówków CORS, ale przeglądarka już tak,
// więc pozwalamy na wywołania z dowolnej strony (np. testy z przeglądarki).
// Bez ciasteczek i sesji, więc obca strona może najwyżej przeczytać publiczny ranking.
export const CORS = { "Access-Control-Allow-Origin": "*" };

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

// Cache CDN Vercela dla publicznych odczytów: przez 5 s odpowiedź jest świeża, potem jeszcze przez 25 s CDN
// oddaje poprzednią i w tle pyta funkcję o nową. Funkcja i baza dostają więc najwyżej jedno pytanie na ok. 5 s
// na adres, niezależnie od liczby widzów, a dane na stronie są najwyżej ok. 10 s stare.
// Nagłówek czyta tylko CDN Vercela (nie przeglądarka), a CDN nie trzyma odpowiedzi na żądania z Authorization.
const CACHE_CDN = "max-age=5, stale-while-revalidate=25";

// Udana odpowiedź publicznego GET (ranking). Zawsze 200: błędów, zapisów ani usunięć CDN nie może zapamiętać.
export function jsonPubliczny(data: unknown) {
  return Response.json(data, { status: 200, headers: { ...CORS, "Vercel-CDN-Cache-Control": CACHE_CDN } });
}

// Odpowiedź, gdy klucz się nie zgadza albo serwer nie ma go skonfigurowanego
export function authError(result: Exclude<AuthResult, "ok">, which: string) {
  if (result === "not-configured") {
    console.error(`Brak klucza ${which} w zmiennych środowiskowych`);
    return json({ error: `Serwer nie ma skonfigurowanego klucza ${which}` }, 500);
  }
  return Response.json(
    { error: result === "missing" ? `Brak klucza ${which}` : `Zły klucz ${which}` },
    { status: 401, headers: { ...CORS, "WWW-Authenticate": "Bearer" } },
  );
}

// Odpowiedź na zapytanie wstępne przeglądarki (OPTIONS): metody, które obsługuje dana trasa
export function preflight(methods: string) {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": `${methods}, OPTIONS`,
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      "Access-Control-Max-Age": "86400",
    },
  });
}
