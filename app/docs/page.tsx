// Opis API dla prowadzącego i bramki.
import Link from "next/link";

export default function Docs() {
  return (
    <main className="dokumentacja">
      <Link href="/" className="powrot">&lt; RANKING</Link>
      <h1 className="swieci">RAM ATAK API</h1>
      <p className="wstep">
        Projekt JiPP: gra na micro:bicie, wynik przez bramkę radiową trafia do tego API i do bazy.
      </p>

      <h2 className="sekcja">POST /api/scores</h2>
      <p>Zapisuje wynik. Body (JSON):</p>
      <pre>
        {`{ "id": "ABC", "wynik": 50 }`}
      </pre>
      <p>
        Wymaga klucza API: nagłówek <code>Authorization: Bearer &lt;klucz&gt;</code> (albo{" "}
        <code>X-API-Key: &lt;klucz&gt;</code>, albo <code>?key=&lt;klucz&gt;</code> w adresie).
      </p>
      <p>
        Odpowiedź <code>201</code> z zapisanym wynikiem, <code>400</code> z opisem błędu danych albo{" "}
        <code>401</code> bez poprawnego klucza.
      </p>

      <h2 className="sekcja">GET /api/scores?limit=10</h2>
      <p>
        Zwraca ranking od najlepszego wyniku: <code>[{`{ id, playerId, score, timestamp }`}]</code>.
      </p>
      <p>
        <code>?sort=latest</code> zwraca ostatnie gry, od najnowszej.
      </p>

      <h2 className="sekcja">DELETE /api/scores/&lt;id&gt;</h2>
      <p>
        Usuwa wynik po <code>id</code> (np. testowy albo fałszywy wpis). Wymaga osobnego klucza admina w
        nagłówku <code>Authorization: Bearer &lt;klucz&gt;</code> albo <code>X-API-Key</code>. Klucz do
        zapisu wyników nie pozwala usuwać.
      </p>
      <p>
        Odpowiedź <code>200</code> z usuniętym wpisem, <code>404</code> gdy go nie ma, <code>400</code> przy
        złym <code>id</code> albo <code>401</code> bez klucza admina.
      </p>
    </main>
  );
}
