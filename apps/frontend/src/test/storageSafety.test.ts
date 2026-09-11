import { describe, it, expect } from "vitest";
import {
  safeSessionStorageGet,
  safeSessionStorageSet,
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeLocalStorageRemove,
} from "../utils/storageSafety";

describe("storage safety helpers", () => {
  it("returns null when sessionStorage is unavailable", () => {
    const original = globalThis.sessionStorage;
    Object.defineProperty(globalThis, "sessionStorage", {
      value: undefined,
      configurable: true,
    });

    try {
      expect(safeSessionStorageGet("last_view")).toBeNull();
      expect(safeSessionStorageSet("last_view", "VIEWER")).toBeUndefined();
    } finally {
      Object.defineProperty(globalThis, "sessionStorage", {
        value: original,
        configurable: true,
      });
    }
  });

  it("returns null when localStorage is unavailable", () => {
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      configurable: true,
    });

    try {
      expect(safeLocalStorageGet("match-state")).toBeNull();
      expect(safeLocalStorageSet("match-state", "{}") ).toBeUndefined();
      expect(safeLocalStorageRemove("match-state")).toBeUndefined();
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        value: original,
        configurable: true,
      });
    }
  });
});
