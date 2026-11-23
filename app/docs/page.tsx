// Opis API dla prowadzącego i bramki.
import Link from "next/link";

export default function Docs() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 font-sans">
      <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Ranking</Link>
      <h1 className="mt-4 text-2xl font-semibold">Ranking micro:bit — API</h1>
      <p className="mt-2 text-sm opacity-70">
        Projekt JiPP: gra na micro:bicie, wynik przez bramkę radiową trafia do tego API i do bazy.
      </p>

      <h2 className="mt-8 font-semibold">POST /api/scores</h2>
      <p className="mt-1 text-sm">Zapisuje wynik. Body (JSON):</p>
      <pre className="mt-2 overflow-x-auto rounded bg-white/10 p-3 text-sm">
        {`{ "id": "ABC", "wynik": 50 }`}
      </pre>
      <p className="mt-2 text-sm">
        Odpowiedź <code>201</code> z zapisanym wynikiem albo <code>400</code> z opisem błędu.
      </p>

      <h2 className="mt-8 font-semibold">GET /api/scores?limit=10</h2>
      <p className="mt-1 text-sm">
        Zwraca ranking od najlepszego wyniku: <code>[{`{ id, playerId, score, timestamp }`}]</code>.
      </p>
      <p className="mt-2 text-sm">
        <code>?sort=latest</code> zwraca ostatnie gry, od najnowszej.
      </p>
    </main>
  );
}
