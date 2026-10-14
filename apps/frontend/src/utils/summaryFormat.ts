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
