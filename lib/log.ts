// Błąd do logów serwera bez danych wrażliwych. Sterownik bazy potrafi wkleić do komunikatu
// cały adres połączenia razem z hasłem (np. gdy DATABASE_URL jest źle wpisany).
export function logError(where: string, e: unknown) {
  const err = e instanceof Error ? e : new Error(String(e));
  const code = (err as { code?: unknown }).code;
  const message = err.message
    .replace(/([a-z][a-z0-9+.-]*:\/\/)\S*@/gi, "$1***@")
    .replace(/(password=)[^\s&]+/gi, "$1***");
  console.error(where, err.name, code ?? "-", message);
}
