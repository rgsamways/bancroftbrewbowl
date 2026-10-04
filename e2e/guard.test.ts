import { describe, expect, it } from "vitest";
import { assertLocalDatabase } from "./guard";

describe("assertLocalDatabase", () => {
  it("accepts the local docker and CI databases", () => {
    expect(() => assertLocalDatabase("postgres://bbb:bbb@localhost:5437/bbb")).not.toThrow();
    expect(() => assertLocalDatabase("postgres://bbb:bbb@127.0.0.1:5432/bbb")).not.toThrow();
  });

  it("refuses a production-style Railway address", () => {
    expect(() => assertLocalDatabase("postgresql://postgres:pw@roundhouse.proxy.rlwy.net:12345/railway")).toThrow(/not a local database/);
  });

  it("refuses a staging-style private Railway address", () => {
    expect(() => assertLocalDatabase("postgresql://postgres:pw@postgres-sjmd.railway.internal:5432/railway")).toThrow(/not a local database/);
  });

  it("refuses a look-alike host that merely contains localhost", () => {
    expect(() => assertLocalDatabase("postgres://u:p@localhost.evil.example/bbb")).toThrow(/not a local database/);
  });

  it("refuses a missing or unreadable URL", () => {
    expect(() => assertLocalDatabase(undefined)).toThrow(/not set/);
    expect(() => assertLocalDatabase("not a url")).toThrow(/not a valid URL/);
  });
});
