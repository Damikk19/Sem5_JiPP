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

describe("klucz admina (ADMIN_TOKEN)", () => {
  it("przyjmuje klucz admina w nagłówku", () => {
    vi.stubEnv("ADMIN_TOKEN", "klucz-admina");
    expect(checkAdminKey(zapytanie({ authorization: "Bearer klucz-admina" }))).toBe("ok");
  });

  it("nie przyjmuje klucza admina w adresie, bo adres zostaje w logach", () => {
    vi.stubEnv("ADMIN_TOKEN", "klucz-admina");
    expect(checkAdminKey(zapytanie({}, "?key=klucz-admina"))).toBe("missing");
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
