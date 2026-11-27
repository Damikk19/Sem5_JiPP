import { afterEach, describe, expect, it, vi } from "vitest";
import { checkAdminKey, checkApiKey } from "@/lib/auth";

const ADRES = "https://sem5-jipp.vercel.app/api/scores";

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
    vi.stubEnv("API_TOKEN", "klucz-bramki");
    expect(checkApiKey(zapytanie())).toBe("missing");
    expect(checkApiKey(zapytanie({ authorization: "Bearer " }))).toBe("missing");
  });

  it.each([
    ["nagłówek Authorization: Bearer", { authorization: "Bearer klucz-bramki" }, ""],
    ["nagłówek z małym bearer", { authorization: "bearer klucz-bramki" }, ""],
    ["nagłówek X-API-Key", { "x-api-key": "klucz-bramki" }, ""],
    ["parametr ?key= w adresie", {}, "?key=klucz-bramki"],
  ])("przyjmuje dobry klucz: %s", (_opis, headers, query) => {
    vi.stubEnv("API_TOKEN", "klucz-bramki");
    expect(checkApiKey(zapytanie(headers, query))).toBe("ok");
  });

  it.each(["zly", "klucz-bramk", "klucz-bramkix", "KLUCZ-BRAMKI"])("odrzuca zły albo podobny klucz: %s", (klucz) => {
    vi.stubEnv("API_TOKEN", "klucz-bramki");
    expect(checkApiKey(zapytanie({ authorization: `Bearer ${klucz}` }))).toBe("invalid");
  });
});

// API przyjmuje klucz, jeśli pasuje KTÓRYKOLWIEK kandydat, więc dobry klucz sprawdzamy na każdej pozycji
// (pierwszej, środkowej, ostatniej). Inaczej błąd „liczy się tylko ostatni kandydat” przeszedłby niezauważony.
describe("klucz zapisu: bramka podaje klucz w nietypowy sposób", () => {
  it.each([
    ["obcy Bearer + dobry X-API-Key", { authorization: "Bearer cos-od-bramki", "x-api-key": "klucz-bramki" }, ""],
    ["obcy Bearer + dobry ?key=", { authorization: "Bearer cos-od-bramki" }, "?key=klucz-bramki"],
    ["Basic + dobry ?key=", { authorization: "Basic dXNlcjpoYXNsbw==" }, "?key=klucz-bramki"],
    ["sam klucz w Authorization, bez Bearer", { authorization: "klucz-bramki" }, ""],
    ["Authorization: Token <klucz>", { authorization: "Token klucz-bramki" }, ""],
    ["?key= ze spacją na końcu", {}, "?key=klucz-bramki%20"],
    ["dobry Bearer + stary ?key=", { authorization: "Bearer klucz-bramki" }, "?key=zly"],
    ["dobry Bearer + zły X-API-Key", { authorization: "Bearer klucz-bramki", "x-api-key": "zly" }, ""],
    ["dobry X-API-Key + zły ?key=", { "x-api-key": "klucz-bramki" }, "?key=zly"],
    ["Bearer z tabulatorem", { authorization: "Bearer\tklucz-bramki" }, ""],
  ])("przyjmuje: %s", (_opis, headers, query) => {
    vi.stubEnv("API_TOKEN", "klucz-bramki");
    expect(checkApiKey(zapytanie(headers, query))).toBe("ok");
  });

  it.each([
    ["obcy Bearer i nic więcej", { authorization: "Bearer cos-od-bramki" }, ""],
    ["zły klucz w każdym miejscu", { authorization: "Bearer zly", "x-api-key": "zly" }, "?key=zly"],
    ["klucz jako prefiks w Authorization", { authorization: "Bearer klucz-bramki-x" }, ""],
    ["sam Basic bez klucza", { authorization: "Basic dXNlcjpoYXNsbw==" }, ""],
    ["Bearer sklejony z kluczem", { authorization: "Bearerklucz-bramki" }, ""],
  ])("odrzuca: %s", (_opis, headers, query) => {
    vi.stubEnv("API_TOKEN", "klucz-bramki");
    expect(checkApiKey(zapytanie(headers, query))).toBe("invalid");
  });

  it("sam napis Bearer bez klucza traktuje jak brak klucza", () => {
    vi.stubEnv("API_TOKEN", "klucz-bramki");
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
    vi.stubEnv("API_TOKEN", "tokenABC123");
    expect(checkApiKey(zapytanie({ authorization: "tokenABC123" }))).toBe("ok");
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
    vi.stubEnv("ADMIN_TOKEN", "klucz-admina");
    expect(checkAdminKey(zapytanie({ authorization: "Bearer klucz-admina" }))).toBe("ok");
  });

  it("nie przyjmuje klucza admina w adresie, bo adres zostaje w logach", () => {
    vi.stubEnv("ADMIN_TOKEN", "klucz-admina");
    expect(checkAdminKey(zapytanie({}, "?key=klucz-admina"))).toBe("missing");
  });

  it("klucz admina w adresie nie działa także obok obcego nagłówka", () => {
    vi.stubEnv("ADMIN_TOKEN", "klucz-admina");
    expect(checkAdminKey(zapytanie({ authorization: "Bearer cos" }, "?key=klucz-admina"))).toBe("invalid");
  });

  it("przyjmuje klucz admina w X-API-Key obok obcego Bearer", () => {
    vi.stubEnv("ADMIN_TOKEN", "klucz-admina");
    expect(checkAdminKey(zapytanie({ authorization: "Bearer cos", "x-api-key": "klucz-admina" }))).toBe("ok");
    expect(checkAdminKey(zapytanie({ authorization: "Bearer klucz-admina", "x-api-key": "cos" }))).toBe("ok");
  });

  it("klucz bramki nie działa jako admin także w X-API-Key ani w adresie", () => {
    vi.stubEnv("API_TOKEN", "klucz-bramki");
    vi.stubEnv("ADMIN_TOKEN", "klucz-admina");
    expect(checkAdminKey(zapytanie({ "x-api-key": "klucz-bramki" }))).toBe("invalid");
    expect(checkAdminKey(zapytanie({}, "?key=klucz-bramki"))).toBe("missing");
  });

  it("klucz bramki nie działa jako klucz admina", () => {
    vi.stubEnv("API_TOKEN", "klucz-bramki");
    vi.stubEnv("ADMIN_TOKEN", "klucz-admina");
    expect(checkAdminKey(zapytanie({ authorization: "Bearer klucz-bramki" }))).toBe("invalid");
  });

  it("klucz admina nie działa jako klucz zapisu", () => {
    vi.stubEnv("API_TOKEN", "klucz-bramki");
    vi.stubEnv("ADMIN_TOKEN", "klucz-admina");
    expect(checkApiKey(zapytanie({ authorization: "Bearer klucz-admina" }))).toBe("invalid");
  });

  it("blokuje usuwanie, gdy brak klucza admina, nawet jeśli klucz zapisu jest ustawiony", () => {
    vi.stubEnv("API_TOKEN", "klucz-bramki");
    vi.stubEnv("ADMIN_TOKEN", "");
    expect(checkAdminKey(zapytanie({ authorization: "Bearer klucz-bramki" }))).toBe("not-configured");
  });
});
