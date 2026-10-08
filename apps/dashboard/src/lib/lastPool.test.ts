import { describe, expect, it } from "vitest";
import { lastPoolPath, readLastPool, rememberPool } from "./lastPool.js";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

const entries = [
  { poolId: "p1", entryId: "e1" },
  { poolId: "p2", entryId: "e2" },
];

describe("last pool memory", () => {
  it("reads back what was stored", () => {
    const storage = fakeStorage();
    rememberPool({ poolId: "p2", screen: "standings" }, storage);
    expect(readLastPool(storage)).toEqual({ poolId: "p2", screen: "standings" });
  });

  it("returns nothing when empty or corrupted", () => {
    expect(readLastPool(fakeStorage())).toBeNull();
    expect(readLastPool(fakeStorage({ "bbb:last-pool": "p1", "bbb:last-pool-screen": "nonsense" }))).toBeNull();
    expect(readLastPool({ getItem: () => { throw new Error("blocked"); } })).toBeNull();
  });

  it("does not throw when storage refuses a write", () => {
    expect(() => rememberPool({ poolId: "p1", screen: "pick" }, { setItem: () => { throw new Error("full"); } })).not.toThrow();
  });
});

describe("lastPoolPath", () => {
  it("opens the remembered pick screen", () => {
    expect(lastPoolPath({ poolId: "p2", screen: "pick" }, entries)).toBe("/pool/p2/entry/e2/pick");
  });

  it("opens the remembered standings", () => {
    expect(lastPoolPath({ poolId: "p1", screen: "standings" }, entries)).toBe("/pool/p1");
  });

  it("falls back when the pool is gone or nothing is remembered", () => {
    expect(lastPoolPath({ poolId: "gone", screen: "pick" }, entries)).toBeNull();
    expect(lastPoolPath(null, entries)).toBeNull();
  });
});
