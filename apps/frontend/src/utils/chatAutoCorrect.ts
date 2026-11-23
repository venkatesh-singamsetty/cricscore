/**
 * Lightweight, zero-dependency English & cricket auto-correct helper for the
 * CricScore chat composer.
 *
 * Desktop browsers (especially Chrome/Edge) do NOT auto-replace misspelled
 * words even when `autoCorrect="on"` and `spellCheck={true}` are set. This
 * helper fills that gap by correcting high-confidence typos on word boundaries
 * (space, punctuation, newline) and right before sending — while preserving
 * proper nouns, city/team names, acronyms (DLS, LBW, POTM), and backspacing.
 */

const EXACT_TYPOS: Record<string, string> = {
  // Common English typos & contractions
  teh: "the",
  hte: "the",
  adn: "and",
  taht: "that",
  waht: "what",
  hwat: "what",
  whta: "what",
  wich: "which",
  whihc: "which",
  wiht: "with",
  wtih: "with",
  abotu: "about",
  abuot: "about",
  becuase: "because",
  beacuse: "because",
  recieve: "receive",
  seperate: "separate",
  definately: "definitely",
  definitly: "definitely",
  occured: "occurred",
  untill: "until",
  grammer: "grammar",
  gramar: "grammar",
  speling: "spelling",
  tomorow: "tomorrow",
  tommorow: "tomorrow",
  tommorrow: "tomorrow",
  todya: "today",
  yesterady: "yesterday",
  yestarday: "yesterday",
  prevuios: "previous",
  previus: "previous",
  prevoius: "previous",
  pervious: "previous",
  privious: "previous",
  latets: "latest",
  laetst: "latest",
  recnet: "recent",
  curent: "current",
  currnet: "current",
  pleae: "please",
  plase: "please",
  plesae: "please",
  thansk: "thanks",
  tehre: "there",
  thier: "their",
  fro: "for",
  fo: "of",
  jsut: "just",
  konw: "know",
  knwo: "know",
  shoudl: "should",
  woudl: "would",
  coudl: "could",
  doesnt: "doesn't",
  dont: "don't",
  cant: "can't",
  wont: "won't",
  didnt: "didn't",
  isnt: "isn't",
  wasnt: "wasn't",
  werent: "weren't",
  shouldnt: "shouldn't",
  wouldnt: "wouldn't",
  couldnt: "couldn't",
  havent: "haven't",
  hasnt: "hasn't",
  thats: "that's",
  whats: "what's",
  whos: "who's",
  im: "I'm",
  ive: "I've",
  // Cricket & CricScore chat typos
  caht: "chat",
  chta: "chat",
  mathc: "match",
  mtach: "match",
  macth: "match",
  matche: "match",
  mathces: "matches",
  scroe: "score",
  sore: "score",
  socre: "score",
  scroes: "scores",
  scroreboard: "scoreboard",
  scoreborad: "scoreboard",
  weatehr: "weather",
  wether: "weather",
  waether: "weather",
  wheather: "weather",
  forcast: "forecast",
  forecats: "forecast",
  palyer: "player",
  playre: "player",
  palyers: "players",
  playres: "players",
  bater: "batter",
  batters: "batters",
  bowelr: "bowler",
  bolwer: "bowler",
  bowelrs: "bowlers",
  inings: "innings",
  innigns: "innings",
  wickte: "wicket",
  wikcet: "wicket",
  wicktes: "wickets",
  wikcets: "wickets",
  ovres: "overs",
  ovre: "over",
  winnner: "winner",
  winer: "winner",
  powerpaly: "powerplay",
  powreplay: "powerplay",
  sumary: "summary",
  summry: "summary",
  tournamnet: "tournament",
  turnament: "tournament",
  rulebok: "rulebook",
  ruls: "rules",
  isue: "issue",
  issuse: "issues",
  isues: "issues",
  feautre: "feature",
  feture: "feature",
  reprot: "report",
  rpeort: "report",
  questoin: "question",
  qeustion: "question",
  predcit: "predict",
  prediciton: "prediction",
  probablity: "probability",
  boundry: "boundary",
  boundries: "boundaries",
  partenrship: "partnership",
  strikrate: "strike rate",
  avreage: "average",
  averge: "average",
  higehst: "highest",
  heighest: "highest",
  lowset: "lowest",
  captian: "captain",
  stadum: "stadium",
  groud: "ground",
  crikcet: "cricket",
  cricekt: "cricket",
  bating: "batting",
  bowlng: "bowling",
  feilding: "fielding",
  targte: "target",
  chaisng: "chasing",
  defedning: "defending",
  penatly: "penalty",
  tiebraeker: "tiebreaker",
  reseravtion: "reserve",
  interupted: "interrupted",
  automaticaly: "automatically",
  automtically: "automatically",
  corecting: "correcting",
  corercting: "correcting",
};

/**
 * Curated vocabulary of common English & cricket words (length >= 5) used for
 * safe Damerau-Levenshtein transposition/typo correction when a word is not in
 * EXACT_TYPOS.
 */
const VOCABULARY = new Set([
  "about",
  "after",
  "again",
  "against",
  "already",
  "always",
  "analysis",
  "analyze",
  "answer",
  "another",
  "automatically",
  "average",
  "award",
  "batter",
  "batters",
  "batting",
  "because",
  "before",
  "between",
  "boundary",
  "boundaries",
  "bowler",
  "bowlers",
  "bowling",
  "break",
  "broken",
  "button",
  "captain",
  "caught",
  "chance",
  "chances",
  "change",
  "chasing",
  "check",
  "circle",
  "clear",
  "cloudy",
  "compare",
  "completed",
  "conditions",
  "confirm",
  "correct",
  "correcting",
  "could",
  "cricket",
  "current",
  "currently",
  "defending",
  "delay",
  "delays",
  "delete",
  "desktop",
  "detail",
  "details",
  "detailed",
  "different",
  "economy",
  "eligibility",
  "english",
  "enter",
  "error",
  "explain",
  "extras",
  "facing",
  "feature",
  "feedback",
  "fielder",
  "fielders",
  "fielding",
  "final",
  "first",
  "forecast",
  "format",
  "fourth",
  "github",
  "glitch",
  "grammar",
  "ground",
  "guest",
  "happens",
  "having",
  "highest",
  "history",
  "hourly",
  "hours",
  "humidity",
  "inning",
  "innings",
  "interface",
  "interrupted",
  "issue",
  "issues",
  "latest",
  "league",
  "likely",
  "login",
  "lowest",
  "mandatory",
  "match",
  "matches",
  "message",
  "mobile",
  "month",
  "morning",
  "needed",
  "newline",
  "night",
  "number",
  "opening",
  "outcome",
  "outside",
  "overcast",
  "overs",
  "partnership",
  "penalty",
  "player",
  "players",
  "playing",
  "please",
  "points",
  "policy",
  "possible",
  "powerplay",
  "precedence",
  "predict",
  "prediction",
  "previous",
  "probability",
  "problem",
  "problems",
  "question",
  "questions",
  "raining",
  "rainy",
  "recent",
  "record",
  "records",
  "regulations",
  "remaining",
  "report",
  "request",
  "required",
  "reserve",
  "result",
  "results",
  "right",
  "round",
  "rulebook",
  "rules",
  "running",
  "score",
  "scorecard",
  "scoreboard",
  "scored",
  "scorer",
  "scores",
  "scoring",
  "screen",
  "season",
  "second",
  "select",
  "sending",
  "should",
  "showers",
  "signup",
  "sixes",
  "spelling",
  "stadium",
  "standings",
  "start",
  "statistics",
  "stats",
  "status",
  "still",
  "strike",
  "summary",
  "super",
  "table",
  "target",
  "teams",
  "temperature",
  "thanks",
  "their",
  "there",
  "these",
  "think",
  "third",
  "those",
  "three",
  "tiebreaker",
  "today",
  "tomorrow",
  "total",
  "tournament",
  "typing",
  "unable",
  "under",
  "until",
  "upcoming",
  "update",
  "upload",
  "venue",
  "weather",
  "where",
  "which",
  "while",
  "wicket",
  "wickets",
  "winner",
  "winning",
  "without",
  "working",
  "would",
  "wrong",
  "yesterday",
]);

/**
 * Optimal String Alignment (restricted Damerau-Levenshtein) distance with
 * early exit when distance exceeds `maxDist`.
 */
function damerauLevenshtein(a: string, b: string, maxDist: number): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > maxDist) return maxDist + 1;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    let rowMin = maxDist + 1;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
  }
  return dp[m][n];
}

function matchCase(original: string, replacement: string): string {
  // Preserve explicit capitalized contractions like "I'm", "I've"
  if (replacement.startsWith("I'")) return replacement;
  if (
    original.length > 0 &&
    original[0] === original[0].toUpperCase() &&
    original[0] !== original[0].toLowerCase()
  ) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Corrects a single word token if it is a high-confidence typo.
 * Never alters ALL-CAPS acronyms, numbers, or unknown capitalized proper nouns.
 */
export function correctWord(word: string): string {
  if (!word || !/^[A-Za-z]+$/.test(word)) return word;

  // Skip ALL-CAPS acronyms/names (e.g., DLS, LBW, POTM, KADAPA)
  if (word.length > 1 && word === word.toUpperCase()) return word;

  const lower = word.toLowerCase();

  // Standalone lowercase "i" -> "I"
  if (word === "i") return "I";

  // 1. Exact high-confidence typo dictionary
  if (Object.prototype.hasOwnProperty.call(EXACT_TYPOS, lower)) {
    return matchCase(word, EXACT_TYPOS[lower]);
  }

  // 2. Fuzzy match only for lowercase words of length >= 5 (skips proper nouns
  //    like city/player/team names such as "Kadapa", "Kohli", "Spartans").
  const isCapitalized = word[0] !== word[0].toLowerCase();
  if (isCapitalized || lower.length < 5 || VOCABULARY.has(lower)) {
    return word;
  }

  let bestMatch: string | null = null;
  let bestDist = 2; // only accept distance 1 (single edit/transposition)
  let tie = false;

  for (const candidate of VOCABULARY) {
    if (candidate[0] !== lower[0]) continue;
    if (Math.abs(candidate.length - lower.length) > 1) continue;
    const d = damerauLevenshtein(lower, candidate, 1);
    if (d < bestDist) {
      bestDist = d;
      bestMatch = candidate;
      tie = false;
    } else if (d === bestDist && bestMatch !== null) {
      tie = true;
    }
  }

  if (bestMatch && !tie) {
    return bestMatch;
  }

  return word;
}

const DELIMITER_RE = /[\s.,?!;:\n]/;

/**
 * Auto-corrects the word immediately preceding the cursor when a user types a
 * word boundary (space, punctuation, newline). Returns the updated text and
 * adjusted cursor position so typing feels seamless.
 */
export function autoCorrectAtBoundary(
  value: string,
  cursorPos: number,
): { text: string; cursorPos: number } {
  if (cursorPos <= 1 || cursorPos > value.length) {
    return { text: value, cursorPos };
  }

  const typedChar = value[cursorPos - 1];
  if (!DELIMITER_RE.test(typedChar)) {
    return { text: value, cursorPos };
  }

  // Walk backwards from cursorPos - 2 to locate the preceding word
  let wordEnd = cursorPos - 1;
  let wordStart = wordEnd;
  while (wordStart > 0 && /[A-Za-z]/.test(value[wordStart - 1])) {
    wordStart--;
  }

  if (wordStart === wordEnd) {
    return { text: value, cursorPos };
  }

  // Don't touch URLs, emails, or hyphenated/underscored identifiers
  if (wordStart > 0 && /[/@._-]/.test(value[wordStart - 1])) {
    return { text: value, cursorPos };
  }

  const word = value.slice(wordStart, wordEnd);
  const corrected = correctWord(word);
  if (corrected === word) {
    return { text: value, cursorPos };
  }

  const nextText = value.slice(0, wordStart) + corrected + value.slice(wordEnd);
  const delta = corrected.length - word.length;
  return { text: nextText, cursorPos: cursorPos + delta };
}

/**
 * Auto-corrects the final word of a message right before submission (in case
 * the user clicks Send without pressing Space after the last word).
 */
export function autoCorrectTrailingWord(value: string): string {
  const match = value.match(/([A-Za-z]+)(\s*)$/);
  if (!match) return value;
  const word = match[1];
  const trailingSpace = match[2];
  const wordStart = value.length - word.length - trailingSpace.length;
  if (wordStart > 0 && /[/@._-]/.test(value[wordStart - 1])) {
    return value;
  }
  const corrected = correctWord(word);
  if (corrected === word) return value;
  return value.slice(0, wordStart) + corrected + trailingSpace;
}
