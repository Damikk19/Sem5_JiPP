import type { AuthResult } from "./auth";

// Bramka i Arduino nie wysyłają nagłówków CORS, ale przeglądarka już tak,
// więc pozwalamy na wywołania z dowolnej strony (np. testy z przeglądarki).
// Bez ciasteczek i sesji, więc obca strona może najwyżej przeczytać publiczny ranking.
export const CORS = { "Access-Control-Allow-Origin": "*" };

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: CORS });
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
