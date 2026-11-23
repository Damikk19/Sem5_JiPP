import Link from "next/link";
import Leaderboard from "./leaderboard";
import RamSprite from "./ram-sprite";

export default function Home() {
  return (
    <main className="ekran">
      <header className="tytul">
        <RamSprite />
        <h1 className="swieci">RAM INVADERS</h1>
      </header>

      <Leaderboard />

      <section className="sterowanie" aria-label="Sterowanie">
        <p>
          <b>A</b> / <b>B</b> RUCH &nbsp; <b>A+B</b> STRZAŁ
        </p>
        <p>
          <b>POTRZĄŚNIJ</b> GARBAGE COLLECTOR (RAZ NA GRĘ)
        </p>
      </section>

      <footer className="stopka">
        <Link href="/docs">API</Link>
        <a href="https://github.com/Damikk19/Sem5_JiPP">GITHUB</a>
        <span>JIPP · WWSI</span>
      </footer>
    </main>
  );
}
