// Usuwa wynik z rankingu po id: npm run usun -- <id>
// id widać w odpowiedzi GET /api/scores. Klucz admina (ADMIN_TOKEN) bierze z .env.local.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const id = process.argv[2];
const token = process.env.ADMIN_TOKEN;
const base = new URL(process.env.API_URL ?? "https://sem5-jipp.vercel.app");

if (!id || !UUID.test(id)) {
  console.error("Podaj id wyniku (UUID z GET /api/scores): npm run usun -- <id>");
  process.exit(1);
}
// Klucz admina tylko przez HTTPS (zwykłe http tylko do serwera na tym komputerze)
const lokalny = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
if (base.protocol !== "https:" && !(lokalny && base.protocol === "http:")) {
  console.error("API_URL musi zaczynać się od https:// (http:// tylko dla localhost)");
  process.exit(1);
}
if (!token) {
  console.error("Brak ADMIN_TOKEN w .env.local");
  process.exit(1);
}

const res = await fetch(new URL(`/api/scores/${id}`, base), {
  method: "DELETE",
  headers: { Authorization: `Bearer ${token}` },
});
console.log(res.status, await res.text());
