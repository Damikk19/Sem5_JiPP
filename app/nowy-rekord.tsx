"use client";

// Ekran NEW HIGH SCORE na cały ekran: nad starą tabelą, zanim do niej wejdą nowe dane.
// Portal do body, czyli poza powiększeniem (zoom) trybu TV, ale pod liniami kineskopu.
// Czytnik ekranu dostaje komunikat z regionu aria-live w tabeli, więc sam ekran jest aria-hidden.
import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { REKORD_MS } from "@/lib/rekord";
import RamSprite from "./ram-sprite";

const bezZmian = () => () => {};

// Portal dopiero po zamontowaniu: na serwerze i przy hydracji nie ma jeszcze document.body
function useZamontowany() {
  return useSyncExternalStore(
    bezZmian,
    () => true,
    () => false,
  );
}

type Props = { nick: string; wynik: string; zamknij: () => void };

export default function NowyRekord({ nick, wynik, zamknij }: Props) {
  const zamontowany = useZamontowany();

  useEffect(() => {
    const timer = setTimeout(zamknij, REKORD_MS);
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === "Escape") zamknij();
    };
    window.addEventListener("keydown", klawisz);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", klawisz);
    };
  }, [zamknij]);

  if (!zamontowany) return null;

  return createPortal(
    // Klik w ekran rekordu zamyka go i nie trafia w nic pod spodem
    <div className="rekord" aria-hidden onClick={zamknij}>
      <p className="rekord-tytul swieci">NEW HIGH SCORE!</p>
      <p className="rekord-gracz swieci">
        <bdi>{nick}</bdi>
        <span>{wynik}</span>
      </p>
      <RamSprite />
    </div>,
    document.body,
  );
}
