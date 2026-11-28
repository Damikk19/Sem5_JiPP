// Dźwięk 8-bit jak na automacie: fala prostokątna z Web Audio, bez plików. Domyślnie wyłączony.

export type Rodzaj = "nowa-gra" | "rekord" | "wlaczenie";

// Nuta: częstotliwość (Hz), początek i długość (s) od chwili zagrania
export type Nuta = { hz: number; od: number; czas: number };

// Cicho: fala prostokątna jest głośna sama w sobie
export const GLOSNOSC = 0.05;
// Krótkie narastanie i wygaszanie zamiast skoku głośności, inaczej na początku i końcu nuty słychać trzask
export const NARASTANIE = 0.005;
export const WYGASZANIE = 0.02;
// Zapas na zaplanowanie nut, żeby pierwsza nie zaczęła się w przeszłości
export const OPOZNIENIE = 0.02;

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

export function harmonogram(rodzaj: Rodzaj): Nuta[] {
  switch (rodzaj) {
    // Dwa krótkie „bipy”
    case "nowa-gra":
      return [
        { hz: 988, od: 0, czas: 0.07 },
        { hz: 1319, od: 0.11, czas: 0.07 },
      ];
    // Fanfara C-E-G-C, ostatnia nuta dłuższa
    case "rekord":
      return [
        { hz: C5, od: 0, czas: 0.12 },
        { hz: E5, od: 0.14, czas: 0.12 },
        { hz: G5, od: 0.28, czas: 0.12 },
        { hz: C6, od: 0.42, czas: 0.36 },
      ];
    // Potwierdzenie po włączeniu dźwięku przyciskiem
    case "wlaczenie":
      return [{ hz: 880, od: 0, czas: 0.06 }];
  }
}

// Głośność nuty w czasie: [czas (s), głośność]. Zaczyna się i kończy na zerze.
export function obwiednia(n: Nuta, glosnosc = GLOSNOSC): [number, number][] {
  return [
    [n.od, 0],
    [n.od + NARASTANIE, glosnosc],
    [n.od + n.czas - WYGASZANIE, glosnosc],
    [n.od + n.czas, 0],
  ];
}

// Tyle z Web Audio, ile potrzeba do zagrania nut (w testach podstawiany jest atrapą)
export type KontekstDzwieku = Pick<BaseAudioContext, "currentTime" | "destination" | "createOscillator" | "createGain">;

// Planuje nuty w kontekście Web Audio. Każda nuta ma własny oscylator, który po zagraniu się odłącza.
export function zagraj(ctx: KontekstDzwieku, nuty: Nuta[]) {
  const start = ctx.currentTime + OPOZNIENIE;
  for (const n of nuty) {
    const osc = ctx.createOscillator();
    const glos = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = n.hz;
    const [pierwszy, ...reszta] = obwiednia(n);
    glos.gain.setValueAtTime(pierwszy[1], start + pierwszy[0]);
    for (const [t, v] of reszta) glos.gain.linearRampToValueAtTime(v, start + t);
    osc.connect(glos);
    glos.connect(ctx.destination);
    osc.onended = () => {
      osc.disconnect();
      glos.disconnect();
    };
    osc.start(start + n.od);
    osc.stop(start + n.od + n.czas);
  }
}

// Wybór zapamiętany w localStorage przeglądarki
export const KLUCZ = "ram-invaders-dzwiek";

export function zapamietany(wartosc: string | null) {
  return wartosc === "1";
}

export function doZapisu(wlaczony: boolean) {
  return wlaczony ? "1" : "0";
}
