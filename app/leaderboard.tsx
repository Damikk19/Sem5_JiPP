"use client";

// Ranking na żywo: co 2 sekundy pyta API o top 10 i ostatnią grę.
// Nowy wynik miga, żeby przy teście z bramką od razu było go widać.
import { useEffect, useRef, useState } from "react";
import { MAX_SCORE, type Score } from "@/lib/score";

const REFRESH_MS = 2000;
const TOP = 10;
const SCORE_DIGITS = String(MAX_SCORE).length;

type Status = "loading" | "live" | "offline";

async function getScores(query: string): Promise<Score[]> {
  const res = await fetch(`/api/scores?${query}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function Leaderboard() {
  const [top, setTop] = useState<Score[]>([]);
  const [last, setLast] = useState<Score | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [freshId, setFreshId] = useState<string | null>(null);
  const [now, setNow] = useState(0);
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
          setNow(Date.now());
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

  return (
    <section className="mt-8">
      <StatusLine status={status} />

      {last && (
        <div
          key={last.id}
          className={`mt-4 rounded border border-[var(--line)] px-4 py-3 sm:flex sm:items-baseline sm:gap-6 ${
            last.id === freshId ? "flash" : ""
          }`}
        >
          <span className="shrink-0 text-xs uppercase tracking-widest text-[var(--muted)]">Ostatnia gra</span>
          <span className="mt-1 flex min-w-0 flex-1 items-baseline gap-2 sm:mt-0">
            <span className="min-w-0 truncate font-semibold">{last.playerId}</span>
            <span className="shrink-0 tabular-nums">{last.score} pkt</span>
            <span className="ml-auto shrink-0 text-sm text-[var(--muted)]">{ago(last.timestamp, now)}</span>
          </span>
        </div>
      )}

      <table className="mt-6 w-full table-fixed border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase tracking-widest text-[var(--muted)]">
            <th className="w-12 pb-3 font-normal">#</th>
            <th className="pb-3 font-normal">Gracz</th>
            <th className="w-28 pb-3 text-right font-normal">Wynik</th>
            <th className="hidden w-36 pb-3 text-right font-normal sm:table-cell">Kiedy</th>
          </tr>
        </thead>
        <tbody>
          {top.map((s, i) => (
            <tr
              key={s.id}
              className={`border-t border-[var(--line)] ${s.id === freshId ? "flash" : ""}`}
            >
              <td className={`py-3 font-pixel text-sm ${rankColor(i)}`}>{i + 1}</td>
              <td className={`truncate py-3 font-semibold ${i === 0 ? "text-[var(--gold)]" : ""}`}>
                {s.playerId}
              </td>
              <td className="py-3 text-right tabular-nums">
                <PaddedScore value={s.score} />
              </td>
              <td className="hidden py-3 text-right text-sm text-[var(--muted)] sm:table-cell">
                {ago(s.timestamp, now)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {status === "live" && top.length === 0 && (
        <p className="mt-10 text-center text-[var(--muted)]">
          Brak wyników. Zagraj na micro:bicie i bądź pierwszy.
        </p>
      )}
    </section>
  );
}

function StatusLine({ status }: { status: Status }) {
  const text = { loading: "Łączenie…", live: "Na żywo", offline: "Brak połączenia z API" }[status];
  const dot = {
    loading: "bg-[var(--muted)]",
    live: "bg-[var(--live)] animate-pulse",
    offline: "bg-[var(--led)]",
  }[status];
  return (
    <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--muted)]" aria-live="polite">
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      {text}
    </p>
  );
}

// Wynik w stylu automatu: 00050, z przygaszonymi zerami z przodu.
function PaddedScore({ value }: { value: number }) {
  const digits = String(value);
  const zeros = "0".repeat(Math.max(SCORE_DIGITS - digits.length, 0));
  return (
    <span className="font-pixel text-sm">
      <span className="opacity-25">{zeros}</span>
      {digits}
    </span>
  );
}

function rankColor(i: number) {
  return ["text-[var(--gold)]", "text-[var(--silver)]", "text-[var(--bronze)]"][i] ?? "text-[var(--muted)]";
}

const relative = new Intl.RelativeTimeFormat("pl", { numeric: "auto" });

function ago(timestamp: string, now: number) {
  const seconds = Math.round((new Date(timestamp).getTime() - now) / 1000);
  if (seconds > -45) return "przed chwilą";
  if (seconds > -3600) return relative.format(Math.round(seconds / 60), "minute");
  if (seconds > -86400) return relative.format(Math.round(seconds / 3600), "hour");
  return new Date(timestamp).toLocaleDateString("pl-PL");
}
