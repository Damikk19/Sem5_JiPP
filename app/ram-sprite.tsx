// Kość RAM z ekranu tytułowego gry, narysowana jak matryca 5x5 micro:bita.
import { KLATKA_A, KLATKA_B } from "@/lib/ram";

function klasa(x: number, y: number) {
  const a = KLATKA_A[y][x] === "#";
  const b = KLATKA_B[y][x] === "#";
  if (a && b) return "dioda zapalona";
  if (a) return "dioda zapalona klatka-a";
  if (b) return "dioda klatka-b";
  return "dioda";
}

export default function RamSprite() {
  return (
    <div className="matryca" aria-hidden>
      {KLATKA_A.flatMap((wiersz, y) =>
        wiersz.split("").map((_, x) => <span key={`${x}-${y}`} className={klasa(x, y)} />),
      )}
    </div>
  );
}
