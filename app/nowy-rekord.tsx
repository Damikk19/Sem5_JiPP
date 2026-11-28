"use client";

// Ekran NEW HIGH SCORE na cały ekran: nad starą tabelą, zanim do niej wejdą nowe dane.
// Portal do body, czyli poza powiększeniem (zoom) trybu TV, ale pod liniami kineskopu.
// Czytnik ekranu dostaje komunikat z osobnego regionu aria-live (app/leaderboard.tsx), więc sam ekran jest aria-hidden.
// Strona pod spodem jest na ten czas nieaktywna (inert): klawiatura i kliknięcia w nią nie trafiają.
// Ekran i region z komunikatem mają atrybut data-poza-inert.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { REKORD_MS } from "@/lib/rekord";
import { useZamontowany } from "./przegladarka";
import RamSprite from "./ram-sprite";

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

  useEffect(() => {
    const aktywny = document.activeElement;
    const poprzedni = aktywny instanceof HTMLElement && aktywny !== document.body ? aktywny : null;
    const tlo = Array.from(document.body.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !el.hasAttribute("data-poza-inert") && !el.inert,
    );
    for (const el of tlo) el.inert = true;
    return () => {
      for (const el of tlo) el.inert = false;
      // Fokus, który zniknął razem ze stroną pod spodem (np. z przycisku dźwięku), wraca na swoje miejsce
      const teraz = document.activeElement;
      if (poprzedni?.isConnected && (!teraz || teraz === document.body)) poprzedni.focus({ preventScroll: true });
    };
  }, []);

  if (!zamontowany) return null;

  return createPortal(
    // Klik w ekran rekordu zamyka go i nie trafia w nic pod spodem
    <div className="rekord" aria-hidden data-poza-inert="" onClick={zamknij}>
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
