import type { Score } from "./score";

// Błąd do logów serwera bez danych wrażliwych. Sterownik bazy potrafi wkleić do komunikatu
// cały adres połączenia razem z hasłem (np. gdy DATABASE_URL jest źle wpisany).
export function logError(where: string, e: unknown) {
  const err = e instanceof Error ? e : new Error(String(e));
  const code = (err as { code?: unknown }).code;
  console.error(where, ukryjHasla(err.name), ukryjHasla(String(code ?? "-")), ukryjHasla(err.message));
}

// Najpierw adres bazy dokładnie w takiej postaci, w jakiej sterownik go wkleja (także ucięty albo
// bez schematu), potem na zapas wszystko, co wygląda na dane logowania w adresie albo w parametrze.
function ukryjHasla(tekst: string) {
  let wynik = tekst;
  const url = process.env.DATABASE_URL;
  for (const wartosc of [url, url?.trim()]) {
    if (wartosc && wartosc.length >= 8) wynik = wynik.split(wartosc).join("[DATABASE_URL]");
  }
  return wynik
    .replace(/([a-z][a-z0-9+.-]*:\/\/)\S*@/gi, "$1***@")
    .replace(/((?:password|passwd|pwd)["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s&,;)]+)/gi, "$1***");
}

// Ślad udanego zapisu albo usunięcia w logach serwera (Vercel → Logs): widać zalew zapisów i to, co zostało
// usunięte. Jedna linia, bez kluczy i bez adresu IP. Nick jest zapisany jak w JSON (w cudzysłowie), więc
// spacje czy cudzysłowy w nicku nie mieszają się z resztą linii.
export function logZmiana(co: string, wynik: Score) {
  console.info(`${co} id=${wynik.id} nick=${JSON.stringify(wynik.playerId)} wynik=${wynik.score}`);
}
