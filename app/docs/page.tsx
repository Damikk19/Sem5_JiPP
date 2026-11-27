// Opis API dla prowadzącego i bramki.
import type { Metadata } from "next";
import Link from "next/link";
import { OPEN_GRAPH } from "@/lib/metadata";

export const metadata: Metadata = {
  title: "RAM INVADERS · API",
  openGraph: { ...OPEN_GRAPH, title: "RAM INVADERS · API", url: "/docs" },
};

export default function Docs() {
  return (
    <main className="dokumentacja">
      <Link href="/" className="powrot">&lt; RANKING</Link>
      <h1 className="swieci">RAM INVADERS API</h1>
      <p className="wstep">
        Projekt JiPP: gra na micro:bicie, wynik przez bramkę radiową trafia do tego API i do bazy.
      </p>

      <h2 className="sekcja">POST /api/scores</h2>
      <p>Zapisuje wynik. Body (JSON):</p>
      <pre>
        {`{ "id": "ABC", "wynik": 50 }`}
      </pre>
      <p>
        <code>id</code>: identyfikator gracza, 1–32 znaki, bez znaków sterujących i niewidocznych. <code>wynik</code>: liczba całkowita 0–99999 (może
        przyjść jako tekst z samych cyfr, np. <code>&quot;50&quot;</code>).
      </p>
      <p>
        Wymaga klucza API: nagłówek <code>Authorization: Bearer &lt;klucz&gt;</code> (albo{" "}
        <code>X-API-Key: &lt;klucz&gt;</code>, albo <code>?key=&lt;klucz&gt;</code> w adresie). API sprawdza
        każde z tych miejsc.
      </p>
      <p>
        Odpowiedź <code>201</code> z zapisanym wynikiem, <code>400</code> z opisem błędu danych,{" "}
        <code>401</code> bez poprawnego klucza albo <code>500</code> przy błędzie serwera.
      </p>

      <h2 className="sekcja">GET /api/scores?limit=10</h2>
      <p>
        Zwraca ranking od najlepszego wyniku: <code>[{`{ id, playerId, score, timestamp }`}]</code>. Bez klucza.{" "}
        <code>limit</code> 1–100 (wartość spoza zakresu jest przycinana), domyślnie 10 (także gdy to nie liczba).
      </p>
      <p>
        <code>?sort=latest</code> zwraca ostatnie gry, od najnowszej.
      </p>

      <h2 className="sekcja">GET /api/ranking</h2>
      <p>
        Dane dla strony z rankingiem w jednym żądaniu: <code>{`{ top, latest }`}</code>, czyli TOP 10 i 10
        ostatnich gier. Bez klucza.
      </p>

      <h2 className="sekcja">DELETE /api/scores/&lt;id&gt;</h2>
      <p>
        Usuwa wynik po <code>id</code> (np. testowy albo fałszywy wpis). Wymaga osobnego klucza admina w
        nagłówku <code>Authorization: Bearer &lt;klucz&gt;</code> albo <code>X-API-Key</code>. Klucz do
        zapisu wyników nie pozwala usuwać.
      </p>
      <p>
        Odpowiedź <code>200</code> z usuniętym wpisem, <code>404</code> gdy go nie ma, <code>400</code> przy
        złym <code>id</code>, <code>401</code> bez klucza admina albo <code>500</code> przy błędzie serwera.
      </p>
    </main>
  );
}
