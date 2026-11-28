import { afterEach, describe, expect, it, vi } from "vitest";
import { checkAdminKey, checkApiKey, problemZKluczem } from "@/lib/auth";

const ADRES = "https://sem5-jipp.vercel.app/api/scores";
// Klucze testowe mają co najmniej 32 znaki, jak prawdziwe (krótszy klucz serwer traktuje jak brak klucza)
const BRAMKA = "klucz-bramki-0123456789abcdef0123456789";
const ADMIN = "klucz-admina-0123456789abcdef0123456789";

function zapytanie(headers: Record<string, string> = {}, query = "") {
  return new Request(ADRES + query, { headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("klucz zapisu (API_TOKEN)", () => {
  it("blokuje zapis, gdy serwer nie ma klucza w konfiguracji", () => {
    vi.stubEnv("API_TOKEN", "");
    expect(checkApiKey(zapytanie({ authorization: "Bearer cokolwiek" }))).toBe("not-configured");
  });

  it("odrzuca zapytanie bez klucza", () => {
    vi.stubEnv("API_TOKEN", BRAMKA);
    expect(checkApiKey(zapytanie())).toBe("missing");
    expect(checkApiKey(zapytanie({ authorization: "Bearer " }))).toBe("missing");
  });

  it.each([
    ["nagłówek Authorization: Bearer", { authorization: `Bearer ${BRAMKA}` }, ""],
    ["nagłówek z małym bearer", { authorization: `bearer ${BRAMKA}` }, ""],
    ["nagłówek X-API-Key", { "x-api-key": BRAMKA }, ""],
    ["parametr ?key= w adresie", {}, `?key=${BRAMKA}`],
  ])("przyjmuje dobry klucz: %s", (_opis, headers, query) => {
    vi.stubEnv("API_TOKEN", BRAMKA);
    expect(checkApiKey(zapytanie(headers, query))).toBe("ok");
  });

  it.each(["zly", BRAMKA.slice(0, -1), `${BRAMKA}x`, BRAMKA.toUpperCase()])("odrzuca zły albo podobny klucz: %s", (klucz) => {
    vi.stubEnv("API_TOKEN", BRAMKA);
    expect(checkApiKey(zapytanie({ authorization: `Bearer ${klucz}` }))).toBe("invalid");
  });
});

// API przyjmuje klucz, jeśli pasuje KTÓRYKOLWIEK kandydat, więc dobry klucz sprawdzamy na każdej pozycji
// (pierwszej, środkowej, ostatniej). Inaczej błąd „liczy się tylko ostatni kandydat” przeszedłby niezauważony.
describe("klucz zapisu: bramka podaje klucz w nietypowy sposób", () => {
  it.each([
    ["obcy Bearer + dobry X-API-Key", { authorization: "Bearer cos-od-bramki", "x-api-key": BRAMKA }, ""],
    ["obcy Bearer + dobry ?key=", { authorization: "Bearer cos-od-bramki" }, `?key=${BRAMKA}`],
    ["Basic + dobry ?key=", { authorization: "Basic dXNlcjpoYXNsbw==" }, `?key=${BRAMKA}`],
    ["sam klucz w Authorization, bez Bearer", { authorization: BRAMKA }, ""],
    ["Authorization: Token <klucz>", { authorization: `Token ${BRAMKA}` }, ""],
    ["?key= ze spacją na końcu", {}, `?key=${BRAMKA}%20`],
    ["dobry Bearer + stary ?key=", { authorization: `Bearer ${BRAMKA}` }, "?key=zly"],
    ["dobry Bearer + zły X-API-Key", { authorization: `Bearer ${BRAMKA}`, "x-api-key": "zly" }, ""],
    ["dobry X-API-Key + zły ?key=", { "x-api-key": BRAMKA }, "?key=zly"],
    ["Bearer z tabulatorem", { authorization: `Bearer\t${BRAMKA}` }, ""],
    ["zły Bearer + dobry X-API-Key + zły ?key= (środek z trzech)", { authorization: "Bearer zly", "x-api-key": BRAMKA }, "?key=zly"],
  ])("przyjmuje: %s", (_opis, headers, query) => {
    vi.stubEnv("API_TOKEN", BRAMKA);
    expect(checkApiKey(zapytanie(headers, query))).toBe("ok");
  });

  it.each([
    ["obcy Bearer i nic więcej", { authorization: "Bearer cos-od-bramki" }, ""],
    ["zły klucz w każdym miejscu", { authorization: "Bearer zly", "x-api-key": "zly" }, "?key=zly"],
    ["klucz jako prefiks w Authorization", { authorization: `Bearer ${BRAMKA}-x` }, ""],
    ["sam Basic bez klucza", { authorization: "Basic dXNlcjpoYXNsbw==" }, ""],
    ["Bearer sklejony z kluczem", { authorization: `Bearer${BRAMKA}` }, ""],
  ])("odrzuca: %s", (_opis, headers, query) => {
    vi.stubEnv("API_TOKEN", BRAMKA);
    expect(checkApiKey(zapytanie(headers, query))).toBe("invalid");
  });

  it("sam napis Bearer bez klucza traktuje jak brak klucza", () => {
    vi.stubEnv("API_TOKEN", BRAMKA);
    expect(checkApiKey(zapytanie({ authorization: "Bearer" }))).toBe("missing");
    expect(checkApiKey(zapytanie({}, "?key="))).toBe("missing");
    expect(checkApiKey(zapytanie({ authorization: "Token" }))).toBe("missing");
    expect(checkApiKey(zapytanie({}, "?key=%20%20"))).toBe("missing");
  });

  it("klucz z samych spacji w konfiguracji nie otwiera zapisu spacjami w adresie", () => {
    vi.stubEnv("API_TOKEN", "   ");
    expect(checkApiKey(zapytanie({}, "?key=%20%20%20"))).not.toBe("ok");
  });

  it("przyjmuje klucz podany bez Bearer, nawet gdy zaczyna się od słowa token", () => {
    vi.stubEnv("API_TOKEN", "tokenABC123tokenABC123tokenABC123");
    expect(checkApiKey(zapytanie({ authorization: "tokenABC123tokenABC123tokenABC123" }))).toBe("ok");
  });
});

describe("klucz w konfiguracji serwera z białymi znakami", () => {
  it("klucz z samych spacji traktuje jak brak klucza (zapis i usuwanie zablokowane)", () => {
    vi.stubEnv("API_TOKEN", "   ");
    vi.stubEnv("ADMIN_TOKEN", " \n ");
    expect(checkApiKey(zapytanie({ authorization: "Bearer cokolwiek" }))).toBe("not-configured");
    expect(checkAdminKey(zapytanie({ authorization: "Bearer cokolwiek" }))).toBe("not-configured");
  });

  it("klucz wklejony z enterem na końcu dalej przyjmuje poprawny klucz od bramki", () => {
    vi.stubEnv("API_TOKEN", `${BRAMKA}\n`);
    vi.stubEnv("ADMIN_TOKEN", ` ${ADMIN} `);
    expect(checkApiKey(zapytanie({ authorization: `Bearer ${BRAMKA}` }))).toBe("ok");
    expect(checkApiKey(zapytanie({}, `?key=${BRAMKA}`))).toBe("ok");
    expect(checkAdminKey(zapytanie({ "x-api-key": ADMIN }))).toBe("ok");
    expect(checkApiKey(zapytanie({ authorization: "Bearer zly" }))).toBe("invalid");
  });
});

describe("brak zmiennej z kluczem na serwerze", () => {
  it("blokuje zapis i usuwanie, gdy zmiennej w ogóle nie ma (nie tylko gdy jest pusta)", () => {
    vi.stubEnv("API_TOKEN", undefined);
    vi.stubEnv("ADMIN_TOKEN", undefined);
    expect(checkApiKey(zapytanie({ authorization: "Bearer cokolwiek" }))).toBe("not-configured");
    expect(checkAdminKey(zapytanie({ authorization: "Bearer cokolwiek" }))).toBe("not-configured");
  });
});

describe("klucz admina (ADMIN_TOKEN)", () => {
  it("przyjmuje klucz admina w nagłówku", () => {
    vi.stubEnv("ADMIN_TOKEN", ADMIN);
    expect(checkAdminKey(zapytanie({ authorization: `Bearer ${ADMIN}` }))).toBe("ok");
  });

  it("nie przyjmuje klucza admina w adresie, bo adres zostaje w logach", () => {
    vi.stubEnv("ADMIN_TOKEN", ADMIN);
    expect(checkAdminKey(zapytanie({}, `?key=${ADMIN}`))).toBe("missing");
  });

  it("klucz admina w adresie nie działa także obok obcego nagłówka", () => {
    vi.stubEnv("ADMIN_TOKEN", ADMIN);
    expect(checkAdminKey(zapytanie({ authorization: "Bearer cos" }, `?key=${ADMIN}`))).toBe("invalid");
  });

  it("przyjmuje klucz admina w X-API-Key obok obcego Bearer", () => {
    vi.stubEnv("ADMIN_TOKEN", ADMIN);
    expect(checkAdminKey(zapytanie({ authorization: "Bearer cos", "x-api-key": ADMIN }))).toBe("ok");
    expect(checkAdminKey(zapytanie({ authorization: `Bearer ${ADMIN}`, "x-api-key": "cos" }))).toBe("ok");
  });

  it("klucz bramki nie działa jako admin także w X-API-Key ani w adresie", () => {
    vi.stubEnv("API_TOKEN", BRAMKA);
    vi.stubEnv("ADMIN_TOKEN", ADMIN);
    expect(checkAdminKey(zapytanie({ "x-api-key": BRAMKA }))).toBe("invalid");
    expect(checkAdminKey(zapytanie({}, `?key=${BRAMKA}`))).toBe("missing");
  });

  it("klucz bramki nie działa jako klucz admina", () => {
    vi.stubEnv("API_TOKEN", BRAMKA);
    vi.stubEnv("ADMIN_TOKEN", ADMIN);
    expect(checkAdminKey(zapytanie({ authorization: `Bearer ${BRAMKA}` }))).toBe("invalid");
  });

  it("klucz admina nie działa jako klucz zapisu", () => {
    vi.stubEnv("API_TOKEN", BRAMKA);
    vi.stubEnv("ADMIN_TOKEN", ADMIN);
    expect(checkApiKey(zapytanie({ authorization: `Bearer ${ADMIN}` }))).toBe("invalid");
  });

  it("blokuje usuwanie, gdy brak klucza admina, nawet jeśli klucz zapisu jest ustawiony", () => {
    vi.stubEnv("API_TOKEN", BRAMKA);
    vi.stubEnv("ADMIN_TOKEN", "");
    expect(checkAdminKey(zapytanie({ authorization: `Bearer ${BRAMKA}` }))).toBe("not-configured");
  });
});

describe("klucz w konfiguracji musi mieć co najmniej 32 znaki", () => {
  it("31 znaków to jak brak klucza, 32 już działa", () => {
    vi.stubEnv("API_TOKEN", "k".repeat(31));
    expect(checkApiKey(zapytanie({ authorization: `Bearer ${"k".repeat(31)}` }))).toBe("not-configured");
    vi.stubEnv("API_TOKEN", "k".repeat(32));
    expect(checkApiKey(zapytanie({ authorization: `Bearer ${"k".repeat(32)}` }))).toBe("ok");
  });

  it("liczy znaki, nie jednostki UTF-16: 16 emoji to za mało, 32 emoji wystarczy", () => {
    // Nagłówek HTTP nie uniesie emoji, więc klucz idzie w adresie (?key=)
    vi.stubEnv("API_TOKEN", "🔑".repeat(16));
    expect(checkApiKey(zapytanie({}, `?key=${encodeURIComponent("🔑".repeat(16))}`))).toBe("not-configured");
    vi.stubEnv("API_TOKEN", "🔑".repeat(32));
    expect(checkApiKey(zapytanie({}, `?key=${encodeURIComponent("🔑".repeat(32))}`))).toBe("ok");
  });

  it("liczy długość po przycięciu: 31 znaków z enterem na końcu to dalej za mało", () => {
    vi.stubEnv("API_TOKEN", `${"k".repeat(31)}\n`);
    expect(checkApiKey(zapytanie({ authorization: `Bearer ${"k".repeat(31)}` }))).toBe("not-configured");
  });

  it.each(["klucz-bramki", "dowolny-dlugi-klucz", "inny-dlugi-klucz"])(
    "krótki przykład z README albo z testów nie działa jako klucz: %s",
    (klucz) => {
      vi.stubEnv("API_TOKEN", klucz);
      vi.stubEnv("ADMIN_TOKEN", klucz);
      expect(checkApiKey(zapytanie({ authorization: `Bearer ${klucz}` }))).toBe("not-configured");
      expect(checkAdminKey(zapytanie({ authorization: `Bearer ${klucz}` }))).toBe("not-configured");
    },
  );

  it("krótki klucz admina blokuje usuwanie", () => {
    vi.stubEnv("API_TOKEN", BRAMKA);
    vi.stubEnv("ADMIN_TOKEN", "a".repeat(31));
    expect(checkAdminKey(zapytanie({ authorization: `Bearer ${"a".repeat(31)}` }))).toBe("not-configured");
    expect(problemZKluczem("admina")).toBe("ADMIN_TOKEN ma mniej niż 32 znaki");
  });
});

describe("ten sam klucz w API_TOKEN i ADMIN_TOKEN", () => {
  it("blokuje usuwanie, bo bramka mogłaby usuwać wpisy, a zapis dalej działa", () => {
    vi.stubEnv("API_TOKEN", BRAMKA);
    vi.stubEnv("ADMIN_TOKEN", BRAMKA);
    expect(checkAdminKey(zapytanie({ authorization: `Bearer ${BRAMKA}` }))).toBe("not-configured");
    expect(checkApiKey(zapytanie({ authorization: `Bearer ${BRAMKA}` }))).toBe("ok");
  });

  it("porównuje klucze po przycięciu białych znaków", () => {
    vi.stubEnv("API_TOKEN", ` ${BRAMKA}`);
    vi.stubEnv("ADMIN_TOKEN", `${BRAMKA}\n`);
    expect(checkAdminKey(zapytanie({ authorization: `Bearer ${BRAMKA}` }))).toBe("not-configured");
  });

  it("różne klucze: admin działa", () => {
    vi.stubEnv("API_TOKEN", BRAMKA);
    vi.stubEnv("ADMIN_TOKEN", ADMIN);
    expect(checkAdminKey(zapytanie({ authorization: `Bearer ${ADMIN}` }))).toBe("ok");
    expect(problemZKluczem("admina")).toBeNull();
    expect(problemZKluczem("API")).toBeNull();
  });
});

// Opis trafia do logu, więc podaje nazwę zmiennej i powód, nigdy wartość klucza
describe("opis problemu z kluczem (tylko do logu serwera)", () => {
  it.each([
    ["API", { API_TOKEN: undefined }, "brak zmiennej API_TOKEN"],
    ["API", { API_TOKEN: "krotki-klucz" }, "API_TOKEN ma mniej niż 32 znaki"],
    ["admina", { ADMIN_TOKEN: "  " }, "brak zmiennej ADMIN_TOKEN"],
    ["admina", { API_TOKEN: BRAMKA, ADMIN_TOKEN: BRAMKA }, "ADMIN_TOKEN jest taki sam jak API_TOKEN"],
  ] as const)("klucz %s przy %j: %s", (klucz, env, opis) => {
    for (const [nazwa, wartosc] of Object.entries(env)) vi.stubEnv(nazwa, wartosc);
    expect(problemZKluczem(klucz)).toBe(opis);
  });
});
