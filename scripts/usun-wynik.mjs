// Usuwa wynik z rankingu po id: npm run usun -- <id>
// id widać w odpowiedzi GET /api/scores. Klucz admina (ADMIN_TOKEN) bierze z .env.local.
const id = process.argv[2];
const token = process.env.ADMIN_TOKEN;
const base = process.env.API_URL ?? "https://sem5-jipp.vercel.app";

if (!id) {
  console.error("Podaj id wyniku: npm run usun -- <id>");
  process.exit(1);
}
if (!token) {
  console.error("Brak ADMIN_TOKEN w .env.local");
  process.exit(1);
}

const res = await fetch(`${base}/api/scores/${id}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${token}` },
});
console.log(res.status, await res.text());
