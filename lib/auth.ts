import { createHash, timingSafeEqual } from "node:crypto";

// Dwa klucze, każdy z innymi uprawnieniami (zasada najmniejszych uprawnień):
// API_TOKEN pozwala tylko dopisywać wyniki (dostaje go bramka prowadzącego),
// ADMIN_TOKEN pozwala usuwać wpisy (ma go tylko właściciel projektu).
// Klucze są w zmiennych środowiskowych (Vercel → Settings → Environment Variables),
// nigdy w kodzie ani w repozytorium.

export type AuthResult = "ok" | "missing" | "invalid" | "not-configured";
export type Klucz = "API" | "admina";

// Krótszy klucz w konfiguracji traktujemy jak brak klucza: przykład z README albo z testów, wpisany na
// serwerze przez pomyłkę, nie może stać się prawdziwym kluczem, a krótki klucz dałoby się zgadywać.
// Prawdziwe klucze to losowe ciągi, np. z `openssl rand -hex 24` (48 znaków).
const MIN_DLUGOSC_KLUCZA = 32;

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

// Klucz z konfiguracji albo opis, dlaczego nie można go używać. Opis trafia tylko do logu serwera.
// Klucz z konfiguracji też przycinamy: wklejony na Vercelu z enterem na końcu nie może blokować bramki.
function configured(klucz: Klucz): { klucz: string } | { problem: string } {
  const nazwa = klucz === "API" ? "API_TOKEN" : "ADMIN_TOKEN";
  const wartosc = process.env[nazwa]?.trim();
  if (!wartosc) return { problem: `brak zmiennej ${nazwa}` };
  // Długość w znakach, nie w jednostkach UTF-16: 16 emoji to 16 znaków, a nie 32
  if ([...wartosc].length < MIN_DLUGOSC_KLUCZA) return { problem: `${nazwa} ma mniej niż ${MIN_DLUGOSC_KLUCZA} znaki` };
  // Ten sam klucz w obu zmiennych dałby bramce prawo usuwania. Porównujemy dwie wartości z konfiguracji,
  // nie dane od klienta, więc zwykłe porównanie niczego nie zdradza czasem odpowiedzi.
  if (klucz === "admina" && wartosc === process.env.API_TOKEN?.trim()) {
    return { problem: "ADMIN_TOKEN jest taki sam jak API_TOKEN" };
  }
  return { klucz: wartosc };
}

// Dlaczego klucz nie działa (null, gdy jest w porządku). Do logu, gdy operacja jest zablokowana.
export function problemZKluczem(klucz: Klucz): string | null {
  const wynik = configured(klucz);
  return "problem" in wynik ? wynik.problem : null;
}

function check(request: Request, klucz: Klucz, allowQuery: boolean): AuthResult {
  // Bez poprawnego klucza w konfiguracji operacja jest zablokowana (lepiej odrzucić niż wpuścić wszystkich)
  const konfiguracja = configured(klucz);
  if ("problem" in konfiguracja) return "not-configured";
  const expected = konfiguracja.klucz;
  const given = candidates(request, allowQuery);
  if (given.length === 0) return "missing";
  // Sprawdzamy każdego kandydata do końca, bez przerywania, żeby czas nie zależał od tego, który pasuje
  let ok = false;
  for (const value of given) ok = sameKey(value, expected) || ok;
  return ok ? "ok" : "invalid";
}

export function checkApiKey(request: Request): AuthResult {
  return check(request, "API", true);
}

// Klucz admina tylko w nagłówku: adres z ?key= może zostać w logach albo historii przeglądarki
export function checkAdminKey(request: Request): AuthResult {
  return check(request, "admina", false);
}
