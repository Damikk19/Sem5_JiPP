"use client";

// Ranking na żywo: co 5 sekund pyta API o TOP 10 i ostatnie gry (jedno żądanie).
// Wygląd jak tablica HIGH SCORES na automacie. Tabela ma zawsze 10 wierszy,
// więc nic nie skacze, kiedy pojawia się pierwszy wynik. Nowe wyniki migają.
import { useEffect, useRef, useState } from "react";
import { czyCzuwanie, LIMIT_CZASU_MS, noweGry, opoznienie } from "@/lib/odswiezanie";
import { MAX_SCORE, type Score } from "@/lib/score";

const TOP = 10;
const CYFRY = String(MAX_SCORE).length;
// Kolory kolejnych miejsc, jak na starych automatach
const KOLORY = ["var(--led)", "var(--orange)", "var(--yellow)", "var(--green)", "var(--cyan)"];

type Status = "loading" | "live" | "offline";
type Ranking = { top: Score[]; latest: Score[] };

function punkty(wynik: number) {
  return String(wynik).padStart(CYFRY, "0");
}

function miejsce(n: number) {
  if (n === 1) return "1ST";
  if (n === 2) return "2ND";
  if (n === 3) return "3RD";
  return `${n}TH`;
}

export default function Leaderboard() {
  const [top, setTop] = useState<Score[]>([]);
  const [last, setLast] = useState<Score | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [czuwanie, setCzuwanie] = useState(false);
  const [nowe, setNowe] = useState<string[]>([]);
  const najnowsza = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let biezace: AbortController | null = null;
    let aktywnosc = Date.now();
    let czuwa = false;

    async function tick() {
      clearTimeout(timer);
      // Poprzednie pytanie, jeśli jeszcze trwa (np. po kliknięciu w czuwaniu), nie jest już potrzebne
      biezace?.abort();
      let blad = false;

      // Karta w tle nie odpytuje API.
      if (!document.hidden) {
        const ctrl = new AbortController();
        biezace = ctrl;
        // Bez limitu czasu zawieszone połączenie trzymałoby stare dane z napisem, że wszystko działa
        const limit = setTimeout(() => ctrl.abort(), LIMIT_CZASU_MS);
        try {
          const res = await fetch("/api/ranking", { cache: "no-store", signal: ctrl.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const dane: Ranking = await res.json();
          if (stopped || biezace !== ctrl) return;
          const wynik = noweGry(dane.latest, najnowsza.current);
          najnowsza.current = wynik.najnowsza;
          if (wynik.nowe.length > 0) aktywnosc = Date.now();
          setNowe((poprzednie) => (poprzednie.length === 0 && wynik.nowe.length === 0 ? poprzednie : wynik.nowe));
          setTop(dane.top);
          setLast(dane.latest[0] ?? null);
          setStatus("live");
        } catch {
          // Przerwane, bo zastąpiło je nowsze pytanie albo strona została zamknięta: nic nie robimy
          if (stopped || biezace !== ctrl) return;
          blad = true;
          setStatus("offline");
        } finally {
          clearTimeout(limit);
        }
      }

      if (stopped) return;
      czuwa = czyCzuwanie(Date.now(), aktywnosc);
      setCzuwanie(czuwa);
      timer = setTimeout(tick, opoznienie({ blad, czuwanie: czuwa }));
    }

    // Powrót do karty: od razu świeże dane zamiast czekania na następne pytanie
    function powrot() {
      if (document.hidden) return;
      aktywnosc = Date.now();
      tick();
    }

    // Kliknięcie albo klawisz budzi stronę z czuwania
    function ruch() {
      aktywnosc = Date.now();
      if (czuwa) tick();
    }

    document.addEventListener("visibilitychange", powrot);
    window.addEventListener("pointerdown", ruch);
    window.addEventListener("keydown", ruch);
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
      biezace?.abort();
      document.removeEventListener("visibilitychange", powrot);
      window.removeEventListener("pointerdown", ruch);
      window.removeEventListener("keydown", ruch);
    };
  }, []);

  const rekord = top[0];
  const wiersze = Array.from({ length: TOP }, (_, i) => top[i] ?? null);
  const nowy = (wynik: Score | null | undefined) => (wynik && nowe.includes(wynik.id) ? "miga-nowy" : "");

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
          <tbody>
            {wiersze.map((wynik, i) =>
              wynik ? (
                <tr key={wynik.id} className={`swieci ${nowy(wynik)}`} style={{ color: KOLORY[i % KOLORY.length] }}>
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
        {/* Dla czytnika ekranu: miganie widać tylko na ekranie */}
        <p className="sr-only" aria-live="polite">
          {last && nowe.includes(last.id) ? `Nowy wynik: ${last.playerId}, ${last.score} pkt` : ""}
        </p>
      </div>
    </section>
  );
}
