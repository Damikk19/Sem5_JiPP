"use client";

// Ranking na żywo: co 2 sekundy pyta API o TOP 10 i ostatnią grę.
// Wygląd jak tablica HIGH SCORES na automacie. Tabela ma zawsze 10 wierszy,
// więc nic nie skacze, kiedy pojawia się pierwszy wynik. Nowy wynik miga.
import { useEffect, useRef, useState } from "react";
import { MAX_SCORE, type Score } from "@/lib/score";

const REFRESH_MS = 2000;
const TOP = 10;
const CYFRY = String(MAX_SCORE).length;
// Kolory kolejnych miejsc, jak na starych automatach
const KOLORY = ["var(--led)", "var(--orange)", "var(--yellow)", "var(--green)", "var(--cyan)"];

type Status = "loading" | "live" | "offline";

async function getScores(query: string): Promise<Score[]> {
  const res = await fetch(`/api/scores?${query}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

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
  const [freshId, setFreshId] = useState<string | null>(null);
  const lastId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      // Karta w tle nie odpytuje API.
      if (!document.hidden) {
        try {
          const [best, latest] = await Promise.all([
            getScores(`limit=${TOP}`),
            getScores("sort=latest&limit=1"),
          ]);
          if (stopped) return;
          const newest = latest[0] ?? null;
          // Pierwsze pobranie tylko zapamiętuje stan, miganie dopiero przy nowych grach.
          if (lastId.current !== undefined && newest && newest.id !== lastId.current) {
            setFreshId(newest.id);
          }
          lastId.current = newest?.id ?? null;
          setTop(best);
          setLast(newest);
          setStatus("live");
        } catch {
          if (!stopped) setStatus("offline");
        }
      }
      if (!stopped) timer = setTimeout(tick, REFRESH_MS);
    }

    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  const rekord = top[0];
  const wiersze = Array.from({ length: TOP }, (_, i) => top[i] ?? null);

  return (
    <section>
      <div className="hud">
        <div>
          <p className="etykieta">LAST</p>
          <p className={`wartosc swieci ${last && last.id === freshId ? "miga-nowy" : ""}`} key={last?.id}>
            {last ? `${last.playerId} ${punkty(last.score)}` : `--- ${punkty(0)}`}
          </p>
        </div>
        <div>
          <p className="etykieta">HI-SCORE</p>
          <p className={`wartosc swieci ${rekord && rekord.id === freshId ? "miga-nowy" : ""}`} key={rekord?.id}>
            {punkty(rekord?.score ?? 0)}
          </p>
        </div>
      </div>

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
              <tr
                key={wynik.id}
                className={`swieci ${wynik.id === freshId ? "miga-nowy" : ""}`}
                style={{ color: KOLORY[i % KOLORY.length] }}
              >
                <td className="rank">{miejsce(i + 1)}</td>
                <td className="score">{punkty(wynik.score)}</td>
                <td className="name">{wynik.playerId}</td>
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
        {status === "live" && (top.length === 0 ? "ZAGRAJ PIERWSZY NA MICRO:BICIE" : "GRAJ NA MICRO:BICIE")}
      </p>
    </section>
  );
}
