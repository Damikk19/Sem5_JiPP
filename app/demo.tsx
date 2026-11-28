"use client";

// Ekran pokazowy w miejscu tabeli: demo gry na dużej matrycy 5x5 jak na micro:bicie, gra bot (lib/demo.ts).
// Tabela zostaje pod spodem w DOM, więc czytnik ekranu dalej ją czyta, a pokaz jest aria-hidden.
import { useEffect, useState } from "react";
import { POKAZ_MS } from "@/lib/atrakcja";
import { JASNOSC, KROK_MS, krok, nowaGra, obraz, poziom, przewin } from "@/lib/demo";

const ZIARNO = 2026;
// Kolejne pokazy to dalszy ciąg jednej partii, a co tyle pokazów wszystko zaczyna się od początku
const SERIE = 12;
const KROKOW_NA_POKAZ = POKAZ_MS / KROK_MS;

export default function Demo({ seria }: { seria: number }) {
  const [stan, setStan] = useState(() => przewin(nowaGra(ZIARNO), (seria % SERIE) * KROKOW_NA_POKAZ));

  useEffect(() => {
    const timer = setInterval(() => setStan(krok), KROK_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="demo" aria-hidden>
      <p className="demo-napis swieci">DEMO</p>
      <div className="demo-matryca">
        {obraz(stan).map((jasnosc, i) => (
          <span key={i} className={`demo-dioda j${poziom(jasnosc)}`} />
        ))}
      </div>
      <p className="demo-zacheta swieci">GRAJ NA MICRO:BICIE</p>
      <div className="demo-punkty">
        <p>
          <span className={`demo-dioda j${poziom(JASNOSC.ddr4)}`} /> DDR4 = 1 PKT
        </p>
        <p>
          <span className={`demo-dioda j${poziom(JASNOSC.ddr5)}`} /> DDR5 = 3 PKT
        </p>
      </div>
    </div>
  );
}
