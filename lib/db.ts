import { neon } from "@neondatabase/serverless";

// Połączenie z Postgresem (Neon) przez HTTP. Adres bazy jest w zmiennej DATABASE_URL,
// lokalnie w .env.local, na Vercelu w ustawieniach projektu.
export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Brak DATABASE_URL");
  return neon(url);
}
