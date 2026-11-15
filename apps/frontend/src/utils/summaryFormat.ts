/**
 * Removes "Player of the Match: ..." lines (with optional 🏆 / markdown
 * decoration) from an AI summary, so the dedicated POM badge is the only
 * place it is shown.
 */
export const stripPlayerOfMatchLine = (summary: string): string =>
  summary
    .split("\n")
    .filter(
      (line) =>
        !/^\s*(?:[🏆*#>\-\s]|\p{Extended_Pictographic})*\s*(?:player of the match|pom)\b\s*[:\-–]/iu.test(
          line,
        ),
    )
    .join("\n")
    .replace(/^\s*\n+/, "")
    .trim();

export interface ParsedPlayerOfTheMatch {
  name: string;
  details: string | null;
}

/**
 * Parses a Player of the Match string (e.g. "Spartan 2 - scored 5 runs off 3 balls")
 * into separated player name and stats text.
 */
export const parsePlayerOfTheMatch = (
  raw: string | null | undefined,
): ParsedPlayerOfTheMatch => {
  if (!raw) return { name: "", details: null };
  const trimmed = raw.trim();
  // Strip leading POM prefixes if present, e.g. "Player of the Match: " or "POM: "
  const cleaned = trimmed.replace(
    /^(?:[🏆*#>\-\s]|\p{Extended_Pictographic})*\s*(?:player of the match|pom)\s*[:\-–]\s*/iu,
    "",
  );
  // Matches "Player Name - stats" or "Player Name – stats" or "Player Name: stats"
  const match = cleaned.match(/^([^-–:]+?)\s*[-–:]\s*(.+)$/);
  if (match) {
    return {
      name: match[1].trim(),
      details: match[2].trim(),
    };
  }
  return {
    name: cleaned,
    details: null,
  };
};
