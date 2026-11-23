import Link from "next/link";
import Leaderboard from "./leaderboard";

// Wyświetlacz micro:bita ma 5×5 diod, logo rysujemy tak samo (1 = zapalona).
const LOGO = ["11111", "11111", "01110", "00100", "01110"];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <header className="flex items-center gap-5">
        <div className="grid shrink-0 grid-cols-5 gap-1" aria-hidden>
          {LOGO.join("")
            .split("")
            .map((on, i) => (
              <span key={i} className={`h-2.5 w-2.5 rounded-[2px] ${on === "1" ? "led-on" : "bg-white/10"}`} />
            ))}
        </div>
        <div>
          <h1 className="font-pixel text-2xl tracking-wider sm:text-3xl">RANKING</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Gra na micro:bicie · wyniki przez bramkę radiową</p>
        </div>
      </header>

      <Leaderboard />

      <footer className="mt-16 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
        <Link href="/docs" className="hover:text-[var(--foreground)]">API</Link>
        <a href="https://github.com/Damikk19/Sem5_JiPP" className="hover:text-[var(--foreground)]">GitHub</a>
        <span>Projekt JiPP · WWSI</span>
      </footer>
    </main>
  );
}
