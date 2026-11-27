import { neon } from "@neondatabase/serverless";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logError } from "@/lib/log";

// Logi na Vercelu widzi właściciel projektu, ale hasło do bazy nie powinno w nich lądować nigdy.
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// Prawdziwy błąd sterownika Neon dla źle wpisanego adresu (sterownik odrzuca go, zanim cokolwiek wyśle)
async function bladSterownika(url: string) {
  try {
    await neon(url)`SELECT 1`;
  } catch (e) {
    return e;
  }
  throw new Error("sterownik nie zgłosił błędu");
}

function zalogowane(e: unknown) {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  logError("GET /api/scores", e);
  return spy.mock.calls.flat().map(String).join(" ");
}

describe("logowanie błędów bez haseł", () => {
  it("ukrywa hasło z adresu bazy w komunikacie sterownika", () => {
    const log = zalogowane(new Error("connection string: postgresql://owner:Tajne123@ep-x.neon.tech/db is invalid"));
    expect(log).not.toContain("Tajne123");
    expect(log).not.toContain("owner");
    expect(log).toContain("postgresql://***@ep-x.neon.tech/db");
  });

  it("ukrywa całe hasło także w źle wpisanym adresie (znak @ albo / w haśle)", () => {
    const log = zalogowane(new Error("(connection string: postgres://u:ab@c/d@ep-x.neon.tech/db)"));
    expect(log).not.toContain("ab@c");
    expect(log).not.toContain("c/d");
  });

  it("ukrywa hasło w każdym adresie w komunikacie, nie tylko w pierwszym", () => {
    const log = zalogowane(new Error("postgres://a:Haslo1@h1/db failed, retry postgresql://b:Haslo2@h2/db password=Haslo3 password=Haslo4"));
    for (const haslo of ["Haslo1", "Haslo2", "Haslo3", "Haslo4"]) expect(log).not.toContain(haslo);
  });

  it.each(["postgresql://neondb_owner:Tajne123", " postgresql://neondb_owner:Tajne123@ep-x.neon.tech/db "])(
    "ukrywa źle wpisany DATABASE_URL w prawdziwym komunikacie sterownika: %j",
    async (url) => {
      vi.stubEnv("DATABASE_URL", url);
      const blad = await bladSterownika(url);
      expect(String((blad as Error).message)).toContain("Tajne123");
      const log = zalogowane(blad);
      expect(log).not.toContain("Tajne123");
      expect(log).toContain("[DATABASE_URL]");
    },
  );

  it("ukrywa adres bazy także wtedy, gdy w komunikacie jest bez spacji z brzegów zmiennej", () => {
    vi.stubEnv("DATABASE_URL", "  postgresql://u:Tajne123  ");
    expect(zalogowane(new Error("błąd: postgresql://u:Tajne123 koniec"))).not.toContain("Tajne123");
  });

  it("ukrywa schemat pisany wielkimi literami", () => {
    expect(zalogowane(new Error("POSTGRES://u:Tajne123@h/db"))).not.toContain("Tajne123");
  });

  it.each(["password: 'Tajne 123'", '{"password":"Tajne123"}', "password = Tajne123", "pwd=Tajne123"])(
    "ukrywa hasło w parametrze: %j",
    (tekst) => {
      expect(zalogowane(new Error(tekst))).not.toContain("Tajne");
    },
  );

  it("ukrywa hasło także w nazwie i kodzie błędu", () => {
    const err = Object.assign(new Error("x"), { name: "postgres://u:Tajne1@h", code: "password=Tajne2" });
    const log = zalogowane(err);
    expect(log).not.toContain("Tajne1");
    expect(log).not.toContain("Tajne2");
  });

  it("ukrywa hasło podane jako password=", () => {
    expect(zalogowane(new Error("host=x password=Tajne123 user=u"))).not.toContain("Tajne123");
  });

  it("zostawia nazwę i kod błędu, żeby dało się go zdiagnozować", () => {
    const err = Object.assign(new Error("timeout"), { name: "NeonDbError", code: "57P01" });
    const log = zalogowane(err);
    expect(log).toContain("GET /api/scores");
    expect(log).toContain("NeonDbError");
    expect(log).toContain("57P01");
    expect(log).toContain("timeout");
  });

  it("radzi sobie z błędem, który nie jest obiektem Error", () => {
    expect(zalogowane("coś poszło nie tak")).toContain("coś poszło nie tak");
  });
});
