// Demo na ekranie pokazowym: gra RAM INVADERS z micro:bita (microbit/main.ts) na matrycy 5x5, w którą gra bot.
// Czysta symulacja w krokach po 100 ms: ten sam stan daje zawsze ten sam następny stan,
// a losowość pochodzi z generatora z ziarnem zapisanym w stanie.

export const KROK_MS = 100;
export const ROZMIAR = 5;
const RZAD_STATKU = ROZMIAR - 1;
const ZYCIA = 3;

// Jasność diod (0-255) z gry
export const JASNOSC = { ddr4: 30, ddr5: 200, uszkodzona: 90, pocisk: 255, blysk: 120 } as const;
// Jasność statku pokazuje liczbę żyć (indeks = życia)
export const JASNOSC_STATKU = [0, 25, 90, 255];

// Tempo z gry: każda zestrzelona kość przyspiesza spadanie i pojawianie się kości
const SPADANIE = { start: 900, min: 300, krok: 7 };
const POJAWIANIE = { start: 1600, min: 650, krok: 12 };
// Po utracie życia ekran błyska, a gra stoi
const BLYSK_KROKOW = 2;

// Bot jak gracz w microbit/symulacja_tempa.py: po każdym ruchu chwilę czeka, a czasem się zagapi
// i nie zdąży z kością, która dolatuje na dół
const REAKCJA_MAX = 2;
const SZANSA_ZAGAPIENIA = 0.03;
const ZAGAPIENIE = { min: 15, max: 35 };

export type Kosc = { x: number; y: number; ddr5: boolean; uszkodzona: boolean };

export type Demo = {
  // stan generatora liczb losowych
  los: number;
  // kolumna statku, statek jest zawsze w dolnym rzędzie
  statek: number;
  zycia: number;
  // najwyżej jeden pocisk naraz, jak w grze
  pocisk: { x: number; y: number } | null;
  kosci: Kosc[];
  wynik: number;
  tempoSpadania: number;
  tempoPojawiania: number;
  doSpadania: number;
  doPojawienia: number;
  // kroki błysku po utracie życia (gra stoi)
  blysk: number;
  // kroki, przez które bot nic nie robi
  czeka: number;
  // numer partii: po trzech straconych życiach gra zaczyna się od nowa
  partia: number;
};

// Generator mulberry32: z 32-bitowego stanu liczba z [0, 1) i następny stan
export function losuj(los: number): [number, number] {
  const nastepny = (los + 0x6d2b79f5) | 0;
  let t = nastepny;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, nastepny];
}

export function nowaGra(ziarno: number, partia = 0): Demo {
  return {
    los: ziarno | 0,
    statek: 2,
    zycia: ZYCIA,
    pocisk: null,
    kosci: [],
    wynik: 0,
    tempoSpadania: SPADANIE.start,
    tempoPojawiania: POJAWIANIE.start,
    doSpadania: SPADANIE.start,
    // W demie pierwsza kość od razu, żeby od początku coś się działo
    doPojawienia: 0,
    blysk: 0,
    czeka: 0,
    partia,
  };
}

// Cel bota: najniższa kość (najbliżej dna), przy remisie najbliższa statku
export function celBota(kosci: Kosc[], statek: number): Kosc | null {
  let cel: Kosc | null = null;
  for (const k of kosci) {
    if (!cel || k.y > cel.y || (k.y === cel.y && Math.abs(k.x - statek) < Math.abs(cel.x - statek))) cel = k;
  }
  return cel;
}

export function krok(s: Demo): Demo {
  // Błysk po utracie życia: gra stoi, a po trzeciej stracie zaczyna się od nowa
  if (s.blysk > 0) {
    if (s.blysk === 1 && s.zycia === 0) return nowaGra(s.los, s.partia + 1);
    return { ...s, blysk: s.blysk - 1 };
  }

  let los = s.los;
  const losowa = () => {
    const [x, nastepny] = losuj(los);
    los = nastepny;
    return x;
  };
  let { statek, zycia, wynik, tempoSpadania, tempoPojawiania, doSpadania, doPojawienia, czeka } = s;
  let pocisk = s.pocisk && { ...s.pocisk };
  let kosci = s.kosci.map((k) => ({ ...k }));
  let blysk = 0;

  // Pocisk w miejscu kości: DDR5 po pierwszym trafieniu tylko przygasa, kość zestrzelona przyspiesza grę
  const trafienie = () => {
    if (!pocisk) return;
    const { x, y } = pocisk;
    const i = kosci.findIndex((k) => k.x === x && k.y === y);
    if (i < 0) return;
    pocisk = null;
    const k = kosci[i];
    if (k.ddr5 && !k.uszkodzona) {
      k.uszkodzona = true;
      return;
    }
    wynik += k.ddr5 ? 3 : 1;
    kosci.splice(i, 1);
    tempoSpadania = Math.max(SPADANIE.min, tempoSpadania - SPADANIE.krok);
    tempoPojawiania = Math.max(POJAWIANIE.min, tempoPojawiania - POJAWIANIE.krok);
  };

  // Bot: jedna akcja na krok (ruch albo strzał), potem chwila reakcji
  let wystrzelony = false;
  if (czeka > 0) {
    czeka--;
  } else {
    const cel = celBota(kosci, statek);
    if (cel) {
      if (cel.x < statek) statek--;
      else if (cel.x > statek) statek++;
      else if (!pocisk) {
        pocisk = { x: statek, y: RZAD_STATKU - 1 };
        wystrzelony = true;
        trafienie();
      }
      czeka = Math.floor(losowa() * (REAKCJA_MAX + 1));
    }
    if (losowa() < SZANSA_ZAGAPIENIA) {
      czeka = ZAGAPIENIE.min + Math.floor(losowa() * (ZAGAPIENIE.max - ZAGAPIENIE.min + 1));
    }
  }

  // Pocisk leci w górę o jeden rząd na krok (dopiero od kroku po strzale) i znika za górną krawędzią
  if (pocisk && !wystrzelony) {
    if (pocisk.y === 0) pocisk = null;
    else {
      pocisk.y--;
      trafienie();
    }
  }

  // Kości spadają o rząd. Kość, która doleci do dolnego rzędu, zabiera życie.
  doSpadania -= KROK_MS;
  if (doSpadania <= 0) {
    doSpadania += tempoSpadania;
    const zostaja: Kosc[] = [];
    for (const k of kosci) {
      k.y++;
      if (k.y < RZAD_STATKU) zostaja.push(k);
      else if (zycia > 0) {
        zycia--;
        blysk = BLYSK_KROKOW;
      }
    }
    kosci = zostaja;
    trafienie();
  }

  // Nowa kość w górnym rzędzie (nie na innej kości). DDR5 coraz częściej, najwyżej w 40% przypadków.
  doPojawienia -= KROK_MS;
  if (doPojawienia <= 0) {
    doPojawienia += tempoPojawiania;
    const x = Math.floor(losowa() * ROZMIAR);
    const ddr5 = Math.floor(losowa() * 100) < Math.min(40, wynik * 2);
    if (!kosci.some((k) => k.y === 0 && k.x === x)) {
      kosci.push({ x, y: 0, ddr5, uszkodzona: false });
      trafienie();
    }
  }

  return {
    los,
    statek,
    zycia,
    pocisk,
    kosci,
    wynik,
    tempoSpadania,
    tempoPojawiania,
    doSpadania,
    doPojawienia,
    blysk,
    czeka,
    partia: s.partia,
  };
}

// Jasność 25 diod (wiersz po wierszu, od góry)
export function obraz(s: Demo): number[] {
  if (s.blysk > 0) return Array<number>(ROZMIAR * ROZMIAR).fill(JASNOSC.blysk);
  const diody = Array<number>(ROZMIAR * ROZMIAR).fill(0);
  for (const k of s.kosci) {
    diody[k.y * ROZMIAR + k.x] = k.ddr5 ? (k.uszkodzona ? JASNOSC.uszkodzona : JASNOSC.ddr5) : JASNOSC.ddr4;
  }
  if (s.pocisk) diody[s.pocisk.y * ROZMIAR + s.pocisk.x] = JASNOSC.pocisk;
  diody[RZAD_STATKU * ROZMIAR + s.statek] = JASNOSC_STATKU[s.zycia];
  return diody;
}

// Stan po podanej liczbie kroków
export function przewin(s: Demo, kroki: number): Demo {
  let stan = s;
  for (let i = 0; i < kroki; i++) stan = krok(stan);
  return stan;
}

// Poziom świecenia diody na stronie (0 = zgaszona, 4 = pełna jasność)
export function poziom(jasnosc: number) {
  if (jasnosc <= 0) return 0;
  if (jasnosc <= JASNOSC.ddr4) return 1;
  if (jasnosc <= JASNOSC.blysk) return 2;
  if (jasnosc <= JASNOSC.ddr5) return 3;
  return 4;
}
