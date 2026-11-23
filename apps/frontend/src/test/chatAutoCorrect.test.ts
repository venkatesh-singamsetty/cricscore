import { describe, it, expect } from "vitest";
import {
  correctWord,
  autoCorrectAtBoundary,
  autoCorrectTrailingWord,
} from "../utils/chatAutoCorrect";

describe("chatAutoCorrect", () => {
  it("corrects common English and cricket typos from the dictionary", () => {
    expect(correctWord("prevuios")).toBe("previous");
    expect(correctWord("mathc")).toBe("match");
    expect(correctWord("grammer")).toBe("grammar");
    expect(correctWord("weatehr")).toBe("weather");
    expect(correctWord("caht")).toBe("chat");
    expect(correctWord("dont")).toBe("don't");
    expect(correctWord("i")).toBe("I");
  });

  it("corrects single-edit / transposition typos via fuzzy vocabulary matching", () => {
    expect(correctWord("macthes")).toBe("matches");
    expect(correctWord("forcast")).toBe("forecast");
    expect(correctWord("palyers")).toBe("players");
    expect(correctWord("wicktes")).toBe("wickets");
  });

  it("preserves ALL-CAPS acronyms, city/proper nouns, and valid words", () => {
    expect(correctWord("KADAPA")).toBe("KADAPA");
    expect(correctWord("DLS")).toBe("DLS");
    expect(correctWord("LBW")).toBe("LBW");
    expect(correctWord("POTM")).toBe("POTM");
    expect(correctWord("Kadapa")).toBe("Kadapa");
    expect(correctWord("Spartans")).toBe("Spartans");
    expect(correctWord("match")).toBe("match");
  });

  it("auto-corrects preceding word on space or punctuation and adjusts cursor", () => {
    const res1 = autoCorrectAtBoundary("prevuios ", 9);
    expect(res1.text).toBe("previous ");
    expect(res1.cursorPos).toBe(9);

    const res2 = autoCorrectAtBoundary("previous mathc?", 15);
    expect(res2.text).toBe("previous match?");
    expect(res2.cursorPos).toBe(15);

    // Does not alter mid-word typing before delimiter
    const res3 = autoCorrectAtBoundary("prevuios", 8);
    expect(res3.text).toBe("prevuios");
  });

  it("auto-corrects the trailing word right before sending", () => {
    expect(autoCorrectTrailingWord("previous mathc")).toBe("previous match");
    expect(autoCorrectTrailingWord("check weatehr")).toBe("check weather");
    expect(autoCorrectTrailingWord("check KADAPA")).toBe("check KADAPA");
  });
});
