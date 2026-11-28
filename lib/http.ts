import { problemZKluczem, type AuthResult, type Klucz } from "./auth";

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

// Czyta body jako tekst (UTF-8, jak request.text()), ale nie więcej niż `limit` bajtów. Zwraca null, gdy body
// jest większe. Najpierw sprawdza Content-Length, zanim przeczyta cokolwiek, a potem liczy bajty strumienia,
// bo Content-Length może nie przyjść (np. przy Transfer-Encoding: chunked) albo być nieczytelny.
// Czytanie kończy się zaraz po przekroczeniu limitu, więc reszta body nie trafia do pamięci.
export async function czytajBody(request: Request, limit: number): Promise<string | null> {
  const dlugosc = request.headers.get("content-length")?.trim();
  if (dlugosc && /^\d+$/.test(dlugosc) && Number(dlugosc) > limit) return null;
  if (!request.body) return "";

  const czytnik = request.body.getReader();
  const dekoder = new TextDecoder();
  let bajty = 0;
  let tekst = "";
  for (;;) {
    const { done, value } = await czytnik.read();
    if (done) break;
    bajty += value.byteLength;
    if (bajty > limit) {
      czytnik.cancel().catch(() => {});
      return null;
    }
    tekst += dekoder.decode(value, { stream: true });
  }
  return tekst + dekoder.decode();
}

// 429: limit zapisów. Retry-After mówi, po ilu sekundach zapis przejdzie; przeglądarka może go przeczytać
// dzięki Access-Control-Expose-Headers (bez tego CORS ukrywa ten nagłówek przed skryptem).
export function zaCzesto(komunikat: string, ponowZaS: number) {
  return Response.json(
    { error: `${komunikat}. Spróbuj za ${ponowZaS} s` },
    { status: 429, headers: { ...CORS, "Retry-After": String(ponowZaS), "Access-Control-Expose-Headers": "Retry-After" } },
  );
}

// Odpowiedź, gdy klucz się nie zgadza albo serwer nie ma go skonfigurowanego. Przy złej konfiguracji
// klient dostaje ogólny komunikat, a to, który klucz i dlaczego, widzi tylko właściciel w logu.
export function authError(result: Exclude<AuthResult, "ok">, which: Klucz) {
  if (result === "not-configured") {
    console.error(`Klucz ${which} wyłączony: ${problemZKluczem(which)}`);
    return json({ error: "Błąd konfiguracji serwera" }, 500);
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
