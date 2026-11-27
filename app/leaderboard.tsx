"use client";

// Ranking na żywo: co 5 sekund pyta API o TOP 10 i ostatnie gry (jedno żądanie).
// Wygląd jak tablica HIGH SCORES na automacie. Tabela ma zawsze 10 wierszy,
// więc nic nie skacze, kiedy pojawia się pierwszy wynik. Nowe wyniki migają.
import { useEffect, useState } from "react";
import { odpytuj } from "@/lib/odswiezanie";
import { MAX_SCORE, type Score } from "@/lib/score";

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

export default function Leaderboard() {
  const [top, setTop] = useState<Score[]>([]);
  const [last, setLast] = useState<Score | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [czuwanie, setCzuwanie] = useState(false);
  const [nowe, setNowe] = useState<string[]>([]);

  useEffect(() => {
    const petla = odpytuj({
      pobierz: async (signal) => {
        const res = await fetch("/api/ranking", { cache: "no-store", signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      },
      ukryta: () => document.hidden,
      naDane: (dane, noweId) => {
        setNowe((poprzednie) => (poprzednie.length === 0 && noweId.length === 0 ? poprzednie : noweId));
        setTop(dane.top);
        setLast(dane.latest[0] ?? null);
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
