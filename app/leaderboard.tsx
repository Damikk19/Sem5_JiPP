"use client";

// Ranking na żywo: co 5 sekund pyta API o TOP 10 i ostatnie gry (jedno żądanie).
// Wygląd jak tablica HIGH SCORES na automacie. Tabela ma zawsze 10 wierszy,
// więc nic nie skacze, kiedy pojawia się pierwszy wynik. Nowe wyniki migają, a wiersze, które zmieniły
// miejsce, przeskakują na nowe. Rekord ma własny ekran, a po minucie bez gier na dużym ekranie leci pokaz.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DUZY_EKRAN, moznaPokazac, OGRANICZONY_RUCH } from "@/lib/atrakcja";
import { przesuniecia, ruch, skala } from "@/lib/flip";
import { odpytuj } from "@/lib/odswiezanie";
import { POCZATEK, przyjmij, zamknij, type Dzwiek, type Widok } from "@/lib/rekord";
import { MAX_SCORE, type Score } from "@/lib/score";
import Demo from "./demo";
import NowyRekord from "./nowy-rekord";
import { useDzwiek, useMedia, usePokaz, useWidoczna } from "./przegladarka";

const TOP = 10;
const CYFRY = String(MAX_SCORE).length;
// Kolory kolejnych miejsc, jak na starych automatach
const KOLORY = ["var(--led)", "var(--orange)", "var(--yellow)", "var(--green)", "var(--cyan)"];

type Status = "loading" | "live" | "offline";

function punkty(wynik: number) {
  return String(wynik).padStart(CYFRY, "0");
}

function miejsce(n: number) {
  if (n === 1) return "1ST";
  if (n === 2) return "2ND";
  if (n === 3) return "3RD";
  return `${n}TH`;
}

// Górne krawędzie wierszy z wynikami na ekranie (po id) i skala ekranu względem układu strony
function pozycje(tbody: HTMLTableSectionElement | null) {
  const mapa = new Map<string, number>();
  let skalaEkranu = 1;
  for (const tr of tbody ? Array.from(tbody.rows) : []) {
    const id = tr.dataset.id;
    if (!id) continue;
    const r = tr.getBoundingClientRect();
    mapa.set(id, r.top);
    skalaEkranu = skala(r.height, tr.offsetHeight);
  }
  return { mapa, skala: skalaEkranu };
}

export default function Leaderboard() {
  const [widok, setWidok] = useState<Widok>(POCZATEK);
  const widokRef = useRef<Widok>(POCZATEK);
  const [status, setStatus] = useState<Status>("loading");
  const [czuwanie, setCzuwanie] = useState(false);
  const tbody = useRef<HTMLTableSectionElement>(null);
  // Pozycje wierszy tuż przed zmianą danych w tabeli (FLIP), null = bez przesuwania
  const przed = useRef<Map<string, number> | null>(null);

  const duzyEkran = useMedia(DUZY_EKRAN);
  const ograniczonyRuch = useMedia(OGRANICZONY_RUCH);
  const widoczna = useWidoczna();
  const { wlaczony, przelacz, graj } = useDzwiek();
  const pokaz = usePokaz(
    moznaPokazac({ duzyEkran, ograniczonyRuch, widoczna, polaczenie: status === "live", rekord: widok.rekord !== null }),
  );
  const aktywnosc = pokaz.ruch;

  const pokazWidok = useCallback(
    (w: Widok, dzwiek: Dzwiek, przesun: boolean) => {
      // Pozycje „przed” trzeba zmierzyć, zanim React podmieni wiersze
      if (w.tabela !== widokRef.current.tabela) przed.current = przesun ? pozycje(tbody.current).mapa : null;
      widokRef.current = w;
      setWidok(w);
      if (dzwiek) graj(dzwiek);
    },
    [graj],
  );

  const zamknijRekord = useCallback(() => {
    const { widok: w, dzwiek } = zamknij(widokRef.current);
    pokazWidok(w, dzwiek, true);
  }, [pokazWidok]);

  useEffect(() => {
    // Pierwsze dane po wejściu na stronę (albo po powrocie z innej podstrony) wchodzą bez przesuwania
    let pierwsze = true;
    const petla = odpytuj({
      pobierz: async (signal) => {
        const res = await fetch("/api/ranking", { cache: "no-store", signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      },
      ukryta: () => document.hidden,
      naDane: (dane, noweId) => {
        const { widok: w, dzwiek } = przyjmij(widokRef.current, dane, noweId);
        pokazWidok(w, dzwiek, !pierwsze);
        pierwsze = false;
        // Nowa gra przerywa pokaz i liczy minutę od nowa
        if (noweId.length > 0) aktywnosc();
        setStatus("live");
      },
      naBlad: () => setStatus("offline"),
      naCzuwanie: setCzuwanie,
    });

    document.addEventListener("visibilitychange", petla.powrot);
    window.addEventListener("pointerdown", petla.ruch);
    window.addEventListener("keydown", petla.ruch);
    return () => {
      petla.stop();
      document.removeEventListener("visibilitychange", petla.powrot);
      window.removeEventListener("pointerdown", petla.ruch);
      window.removeEventListener("keydown", petla.ruch);
    };
  }, [pokazWidok, aktywnosc]);

  // FLIP: wiersze startują z miejsca sprzed zmiany i przeskakują na nowe (przed narysowaniem klatki).
  // Bez ruchu przy ograniczonym ruchu i w karcie w tle.
  useLayoutEffect(() => {
    const stare = przed.current;
    przed.current = null;
    const wiersze = tbody.current;
    if (!stare || !wiersze || document.hidden || window.matchMedia(OGRANICZONY_RUCH).matches) return;
    const po = pozycje(wiersze);
    const dy = przesuniecia(stare, po.mapa, po.skala);
    const animacje: Animation[] = [];
    for (const tr of Array.from(wiersze.rows)) {
      const przesuniecie = tr.dataset.id ? dy.get(tr.dataset.id) : undefined;
      if (przesuniecie === undefined) continue;
      const { klatki, opcje } = ruch(przesuniecie);
      animacje.push(tr.animate(klatki, opcje));
    }
    return () => {
      for (const a of animacje) a.cancel();
    };
  }, [widok.tabela]);

  const top = widok.tabela?.dane.top ?? [];
  const last = widok.tabela?.dane.latest[0] ?? null;
  const nowe = widok.tabela?.nowe ?? [];
  const rekord = top[0];
  // Rekord z otwartego ekranu albo ten, który przyniósł dane w tabeli: po zamknięciu ekranu komunikat
  // się nie zmienia, więc czytnik ekranu nie czyta go drugi raz
  const swietowany = widok.rekord ?? widok.tabela?.rekord ?? null;
  const wiersze = Array.from({ length: TOP }, (_, i) => top[i] ?? null);
  const nowy = (wynik: Score | null | undefined) => (wynik && nowe.includes(wynik.id) ? "miga-nowy" : "");

  let komunikat = "";
  if (swietowany) komunikat = `Nowy rekord: ${swietowany.playerId}, ${swietowany.score} pkt`;
  else if (last && nowe.includes(last.id)) komunikat = `Nowy wynik: ${last.playerId}, ${last.score} pkt`;

  return (
    <section className="ranking">
      <div className="hud">
        <div>
          <p className="etykieta">LAST</p>
          <p className={`wartosc swieci ${nowy(last)}`} key={last?.id}>
            {last ? (
              <>
                <bdi>{last.playerId}</bdi> {punkty(last.score)}
              </>
            ) : (
              `--- ${punkty(0)}`
            )}
          </p>
        </div>
        <div>
          <p className="etykieta">HI-SCORE</p>
          <p className={`wartosc swieci ${nowy(rekord)}`} key={rekord?.id}>
            {punkty(rekord?.score ?? 0)}
          </p>
        </div>
      </div>

      <div className="tabela">
        <h2 className="naglowek swieci">HIGH SCORES</h2>

        <table className="wyniki">
          <thead>
            <tr>
              <th className="rank">RANK</th>
              <th className="score">SCORE</th>
              <th className="name">NAME</th>
            </tr>
          </thead>
          <tbody ref={tbody}>
            {wiersze.map((wynik, i) =>
              wynik ? (
                <tr
                  key={wynik.id}
                  data-id={wynik.id}
                  className={`swieci ${nowy(wynik)}`}
                  style={{ color: KOLORY[i % KOLORY.length] }}
                >
                  <td className="rank">{miejsce(i + 1)}</td>
                  <td className="score">{punkty(wynik.score)}</td>
                  <td className="name">
                    <bdi>{wynik.playerId}</bdi>
                  </td>
                </tr>
              ) : (
                <tr key={`pusty-${i}`} className="pusty">
                  <td className="rank">{miejsce(i + 1)}</td>
                  <td className="score">{punkty(0)}</td>
                  <td className="name">---</td>
                </tr>
              ),
            )}
          </tbody>
        </table>

        <p className={`zacheta swieci ${status === "offline" ? "alarm" : ""}`} aria-live="polite">
          {status === "loading" && "WCZYTYWANIE..."}
          {status === "offline" && "BRAK SYGNAŁU Z SERWERA"}
          {status === "live" && czuwanie && "CZUWANIE · KLIKNIJ"}
          {status === "live" && !czuwanie && (top.length === 0 ? "ZAGRAJ PIERWSZY NA MICRO:BICIE" : "GRAJ NA MICRO:BICIE")}
        </p>
        <button type="button" className="dzwiek" aria-pressed={wlaczony} onClick={przelacz}>
          DŹWIĘK: {wlaczony ? "WŁ" : "WYŁ"}
        </button>
        {/* Dla czytnika ekranu: miganie i ekran rekordu widać tylko na ekranie */}
        <p className="sr-only" aria-live="polite">
          {komunikat}
        </p>

        {pokaz.pokaz && <Demo key={pokaz.seria} seria={pokaz.seria} />}
      </div>

      {widok.rekord && (
        // Klucz: wyższy rekord w trakcie to nowy ekran z własnymi 5 s
        <NowyRekord
          key={widok.rekord.id}
          nick={widok.rekord.playerId}
          wynik={punkty(widok.rekord.score)}
          zamknij={zamknijRekord}
        />
      )}
    </section>
  );
}
