// Tymczasowa strona główna: opis API. W kolejnym kroku zastąpi ją ranking.
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 font-sans">
      <h1 className="text-2xl font-semibold">Ranking micro:bit — API</h1>
      <p className="mt-2 text-sm opacity-70">
        Projekt JiPP: gra na micro:bicie, wynik przez bramkę radiową trafia do tego API i do bazy.
      </p>

      <h2 className="mt-8 font-semibold">POST /api/scores</h2>
      <p className="mt-1 text-sm">Zapisuje wynik. Body (JSON):</p>
      <pre className="mt-2 overflow-x-auto rounded bg-black/5 p-3 text-sm dark:bg-white/10">
        {`{ "id": "ABC", "wynik": 50 }`}
      </pre>
      <p className="mt-2 text-sm">
        Odpowiedź <code>201</code> z zapisanym wynikiem albo <code>400</code> z opisem błędu.
      </p>

      <h2 className="mt-8 font-semibold">GET /api/scores?limit=10</h2>
      <p className="mt-1 text-sm">
        Zwraca ranking od najlepszego wyniku: <code>[{`{ id, playerId, score, timestamp }`}]</code>.
      </p>
    </main>
  );
}
