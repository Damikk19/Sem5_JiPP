import { afterEach, describe, expect, it, vi } from "vitest";
import { logError } from "@/lib/log";

// Logi na Vercelu widzi właściciel projektu, ale hasło do bazy nie powinno w nich lądować nigdy.
afterEach(() => {
  vi.restoreAllMocks();
});

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
