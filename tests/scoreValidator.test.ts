import { describe, expect, it, vi } from "vitest";
import { parse } from "@/lib/scoreValidator";

// Format od bramki prowadzącego to umowa: { "id": "<gracz>", "wynik": <liczba> }.
// Te testy pilnują, żeby zmiana walidacji nie zepsuła odbioru wyników z bramki.
describe("walidacja wyniku od bramki", () => {
  it("zamienia poprawne body na ScoreDto", () => {
    expect(parse({ id: "ABC", wynik: 123 })).toEqual({ ok: true, dto: { playerId: "ABC", score: 123 } });
  });

  it("przyjmuje wynik jako tekst, bo bramka przepisuje dane z radia", () => {
    expect(parse({ id: "ABC", wynik: "50" })).toEqual({ ok: true, dto: { playerId: "ABC", score: 50 } });
  });

  it("przyjmuje liczbowe id i zamienia je na tekst", () => {
    expect(parse({ id: 7, wynik: 1 })).toEqual({ ok: true, dto: { playerId: "7", score: 1 } });
  });

  it("obcina spacje wokół id", () => {
    expect(parse({ id: "  ABC ", wynik: 1 })).toEqual({ ok: true, dto: { playerId: "ABC", score: 1 } });
  });

  // Bramka może dokleić koniec linii z ramki radiowej (jak przy wyniku "123\r\n")
  it.each(["ABC\r\n", "ABC\n", "\tABC"])("obcina białe znaki wokół id przed sprawdzeniem znaków: %j", (id) => {
    expect(parse({ id, wynik: "123\r\n" })).toEqual({ ok: true, dto: { playerId: "ABC", score: 123 } });
  });

  it("ignoruje dodatkowe pola", () => {
    expect(parse({ id: "ABC", wynik: 1, apiId: "DK" }).ok).toBe(true);
  });

  it.each([0, 99999])("przyjmuje wynik na granicy zakresu: %s", (wynik) => {
    expect(parse({ id: "ABC", wynik }).ok).toBe(true);
  });

  it.each(["123", " 123 ", "123\r\n", "\t42\n", "0", "99999", "007", "0000000000000000000099999"])("przyjmuje wynik jako tekst z samych cyfr: %j", (wynik) => {
    expect(parse({ id: "ABC", wynik }).ok).toBe(true);
  });

  it.each([
    "1e3", "0x1F", "0b1", "0o7", "12.5", "12.0", "12.", ".5", "+5", "-5", "-0", "1 000", "1\n2", "1_000", "100000",
    "Infinity", "NaN", "   ", "１２３", "9".repeat(400),
  ])(
    "odrzuca wynik jako tekst, który nie jest liczbą z samych cyfr albo jest poza zakresem: %j",
    (wynik) => {
      expect(parse({ id: "ABC", wynik }).ok).toBe(false);
    },
  );

  it.each([-1, 100000, 1.5, "abc", "", null, true, undefined])("odrzuca wynik %s", (wynik) => {
    expect(parse({ id: "ABC", wynik }).ok).toBe(false);
  });

  it("przyjmuje id z 32 znaków i odrzuca z 33", () => {
    expect(parse({ id: "x".repeat(32), wynik: 1 }).ok).toBe(true);
    expect(parse({ id: "x".repeat(33), wynik: 1 }).ok).toBe(false);
  });

  it("liczy długość id w znakach, jak baza: 32 emoji tak, 33 nie", () => {
    expect(parse({ id: "👾".repeat(32), wynik: 1 }).ok).toBe(true);
    expect(parse({ id: "👾".repeat(33), wynik: 1 }).ok).toBe(false);
  });

  it("bardzo długie id odrzuca od razu, bez rozbijania tekstu na znaki", () => {
    const rozbijanie = vi.spyOn(String.prototype, Symbol.iterator);
    try {
      // Krótkie id jest liczone po znakach (to pokazuje, że podsłuch działa)
      expect(parse({ id: "ABC", wynik: 1 }).ok).toBe(true);
      expect(rozbijanie).toHaveBeenCalled();
      rozbijanie.mockClear();
      const wynik = parse({ id: "x".repeat(100_000), wynik: 1 });
      expect(wynik).toEqual({ ok: false, error: '"id" musi mieć od 1 do 32 znaków' });
      expect(rozbijanie).not.toHaveBeenCalled();
    } finally {
      rozbijanie.mockRestore();
    }
  });

  it.each([
    "ŻÓŁW", "A B", "gracz-1", "Ünal", "👾", "👍🏽", "🇵🇱", "❤️",
    "🧑\u200d💻", "👩🏽\u200d💻", "🏳️\u200d🌈", "🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
    "Москва", "中文", "e\u0301",
  ])("przyjmuje zwykły nick, także emoji złożone: %j", (id) => {
    expect(parse({ id, wynik: 1 }).ok).toBe(true);
  });

  it.each([
    ["NUL", "A\u0000B"],
    ["znak nowej linii w środku", "A\nB"],
    ["tabulator w środku", "A\tB"],
    ["DEL", "A\u007fB"],
    ["zmiana kierunku tekstu (RLO)", "\u202eNIMDA"],
    ["izolacja kierunku (LRI)", "AB\u2066C"],
    ["znak kierunku (RLM)", "A\u200fB"],
    ["samotny surogat", "A\ud800"],
    ["separator wierszy", "A\u2028B"],
    ["separator akapitów", "A\u2029B"],
    ["znak z obszaru prywatnego", "A\ue000"],
    ["znak nieprzypisany", "A\u0378"],
    ["arabski znak kierunku (ALM)", "A\u061cB"],
    ["znak kierunku (LRM)", "A\u200eB"],
    ["osadzenie i nadpisanie kierunku (LRE, RLE, PDF, LRO)", "A\u202a\u202b\u202c\u202dB"],
    ["izolacje kierunku (RLI, FSI, PDI)", "A\u2067\u2068\u2069B"],
  ])("odrzuca id ze znakiem sterującym albo zmieniającym kierunek tekstu: %s", (_, id) => {
    const result = parse({ id, wynik: 1 });
    expect(result).toEqual({ ok: false, error: '"id" nie może zawierać znaków sterujących ani zmieniających kierunek tekstu' });
  });

  it.each([
    ["spacja zerowej szerokości", "\u200b"],
    ["sam łącznik zerowej szerokości", "\u200d"],
    ["wypełniacz Hangul", "\u3164"],
    ["pusty znak Braille'a", "\u2800\u2800"],
    ["sam znak łączący", "\u0300"],
    ["selektor wariantu", "\ufe0f"],
    ["miękki dywiz", "\u00ad"],
    ["wypełniacze Hangul", "\u115f\u1160\uffa0"],
  ])("odrzuca id, które w rankingu byłoby puste: %s", (_, id) => {
    const result = parse({ id, wynik: 1 });
    expect(result).toEqual({ ok: false, error: '"id" musi zawierać co najmniej jeden widoczny znak' });
  });

  // Warianty, które wyglądają jak inny nick (np. "ABC"), a dla bazy byłyby nowym nickiem: omijałyby limit
  // nicku i duplikaty, a w rankingu dawały kilka "takich samych" graczy
  it.each([
    ["spacja zerowej szerokości na końcu", "ABC\u200b"],
    ["spacja zerowej szerokości w środku", "A\u200bBC"],
    ["łącznik wyrazów (WORD JOINER)", "ABC\u2060"],
    ["BOM w środku", "AB\ufeffC"],
    ["wypełniacz Hangul na końcu", "ABC\u3164"],
    ["wypełniacze Hangul w środku", "A\u115fB\u1160C\uffa0"],
    ["pusty znak Braille'a w środku", "AB\u2800C"],
    ["miękki dywiz", "A\u00adBC"],
    ["mongolski separator samogłosek", "ABC\u180e"],
    ["rozłącznik zerowej szerokości (ZWNJ)", "AB\u200cC"],
    ["niewidoczne operatory matematyczne", "A\u2061B\u2062C\u2063\u2064"],
    ["łącznik grafemów (CGJ)", "ABC\u034f"],
    ["ZWJ po literze", "ABC\u200d"],
    ["ZWJ między literami", "A\u200dBC"],
    ["ZWJ przed emoji, ale po literze", "A\u200d👾"],
    ["ZWJ na końcu po emoji", "👾\u200d"],
    ["selektor wariantu po literze (VS16)", "ABC\ufe0f"],
    ["selektor wariantu po selektorze", "❤\ufe0f\ufe0f"],
    ["znak tagu poza flagą", "ABC\u{E0041}"],
    ["flaga z tagami bez znaku końca", "🏴\u{E0067}\u{E0062}\u{E0065}"],
    // Selektor wariantu tylko tam, gdzie coś zmienia (VS15/VS16 po emoji, VS16 w keycapie, CJK po znaku CJK)
    ["VS16 po cyfrze bez keycapa", "ABC1\ufe0f"],
    ["VS16 po # bez keycapa", "ABC#\ufe0f"],
    ["VS16 po * bez keycapa", "AB*\ufe0f"],
    ["VS15 w keycapie", "1\ufe0e\u20e3"],
    ["selektor CJK po emoji (VS2)", "👾\ufe01"],
    ["selektor IVS po emoji", "👾\u{E0100}"],
    ["selektor IVS po literze", "ABC\u{E0100}"],
    ["mongolski selektor po cyfrze", "1\u180b"],
    ["mongolski selektor po znaku CJK", "葛\u180b"],
    ["dwa selektory po znaku CJK", "葛\u{E0100}\u{E0101}"],
    // Znaki tagów tylko w trzech flagach ze standardu emoji (Anglia, Szkocja, Walia)
    ["flaga Teksasu (tagi spoza standardu)", "🏴\u{E0075}\u{E0073}\u{E0074}\u{E0078}\u{E007F}"],
    ["flaga Anglii bez ostatniej litery", "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E007F}"],
    ["flaga Szkocji z dodatkową literą", "🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E0074}\u{E007F}"],
    ["flaga Walii pisana wielkimi tagami", "🏴\u{E0047}\u{E0042}\u{E0057}\u{E004C}\u{E0053}\u{E007F}"],
    // Pozostałe znaki formatujące (\p{Cf})
    ["znak adnotacji U+FFF9", "AB\ufff9C"],
    ["arabski znak liczby U+0600", "\u0600ABC"],
    ["egipski znak formatujący U+13430", "A\u{13430}BC"],
    ["znak liczby Kaithi U+110BD", "ABC\u{110BD}"],
  ])("odrzuca nick z niewidocznym znakiem: %s", (_, id) => {
    expect(parse({ id, wynik: 1 })).toEqual({
      ok: false,
      error: '"id" nie może zawierać niewidocznych znaków (np. spacji zerowej szerokości)',
    });
  });

  // Ten sam napis zapisany inaczej daje ten sam nick, więc limit nicku i duplikaty działają na niego tak samo
  it.each([
    ["ë jako e + dwie kropki (NFD)", "Zoe\u0308", "Zo\u00eb"],
    ["polskie litery zostają bez zmian", "ŁOŚ", "ŁOŚ"],
    ["twarda spacja w środku", "A\u00a0BC", "A BC"],
    ["spacja ideograficzna w środku", "A\u3000BC", "A BC"],
    ["wąska twarda spacja i cienka spacja", "A\u202fB\u2009C", "A B C"],
    ["twarda spacja na początku", "\u00a0ABC", "ABC"],
    ["spacja zwykła na końcu", "ABC ", "ABC"],
    ["dwie zwykłe spacje w środku", "A  BC", "A BC"],
    ["spacja, twarda spacja i spacja", "A \u00a0 BC", "A BC"],
    ["dwie spacje ideograficzne", "A\u3000\u3000BC", "A BC"],
    ["kilka grup spacji", "A   B  C", "A B C"],
  ])("zapisuje nick w jednej postaci: %s", (_, id, zapisany) => {
    const wynik = parse({ id, wynik: 1 });
    expect(wynik).toEqual({ ok: true, dto: { playerId: zapisany, score: 1 } });
  });

  // Kontrakt z bramką: emoji złożone (ZWJ, odcienie skóry, flagi z tagami, keycapy) dalej przechodzą
  it.each([
    "Zażółć gęślą", "A B", "AB CD",
    "👨\u200d👩\u200d👧\u200d👦", "❤\ufe0f\u200d🔥", "🧑\u200d🦰", "🏃🏻\u200d♀\ufe0f", "🐻\u200d❄\ufe0f",
    "🏴\u200d☠\ufe0f", "👁\ufe0f\u200d🗨\ufe0f", "🫱🏻\u200d🫲🏼",
    "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}", "🏴\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}",
    "1\ufe0f\u20e3", "#\ufe0f\u20e3", "*\ufe0f\u20e3", "ABC 7\ufe0f\u20e3", "☺\ufe0e", "™\ufe0f", "©\ufe0f",
    "❤\ufe0f", "👾\ufe0e", "ABC 👾", "GRACZ🏳\ufe0f\u200d🌈", "葛\u{E0100}", "辻\ufe00",
    "🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}", "🏴", "A B C",
  ])("dalej przyjmuje nick: %j", (id) => {
    const wynik = parse({ id, wynik: 1 });
    expect(wynik).toEqual({ ok: true, dto: { playerId: id.normalize("NFC"), score: 1 } });
  });

  it.each([undefined, "", "   ", null, { a: 1 }])("odrzuca brakujące albo puste id: %s", (id) => {
    expect(parse({ id, wynik: 1 }).ok).toBe(false);
  });

  it.each([null, [], "tekst", 5])("odrzuca body, które nie jest obiektem: %s", (body) => {
    expect(parse(body).ok).toBe(false);
  });

  it("zwraca opis błędu, który bramka dostanie w odpowiedzi", () => {
    const result = parse({ id: "ABC", wynik: -5 });
    expect(result).toEqual({ ok: false, error: '"wynik" musi być liczbą całkowitą od 0 do 99999' });
  });
});
