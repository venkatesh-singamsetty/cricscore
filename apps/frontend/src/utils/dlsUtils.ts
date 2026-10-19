/**
 * Duckworth-Lewis(-Stern) resource calculations for ANY match length (1-50 overs).
 *
 * Model (Duckworth & Lewis, Standard Edition form):
 *   Z(u, w) = F(w) * (1 - exp(-b * u / F(w)))
 * where u = overs remaining, w = wickets lost.
 *
 *  - b is calibrated so the 0-wicket curve matches the published Standard
 *    Edition table (20 overs = 56.6%, 10 = 32.1%, 5 = 17.2%, 1 = 3.6% of a
 *    full 50-over innings).
 *  - F(w) is solved so that Z(50, w) reproduces the published 50-over row
 *    (100, 93.4, 85.1, 74.9, 62.7, 49.0, 34.9, 22.0, 11.9, 4.7).
 *
 * Resources for a match of N overs are expressed relative to Z(N, 0), so a
 * 1-over, 5-over, 10-over or 20-over match all start at exactly 100% and the
 * par score scales correctly with no T20-specific hacks.
 */

const B = 0.027;
const FIFTY_OVER_ROW = [
  100, 93.4, 85.1, 74.9, 62.7, 49.0, 34.9, 22.0, 11.9, 4.7,
];

const rawZ = (u: number, f: number): number =>
  f <= 0 ? 0 : f * (1 - Math.exp((-B * Math.max(0, u)) / f));

/** Solve F(w) so Z(50, w) / Z(50, 0) equals the published 50-over row. */
const F_BY_WICKETS: number[] = (() => {
  const z50 = rawZ(50, 1);
  return FIFTY_OVER_ROW.map((pct, w) => {
    if (w === 0) return 1;
    const goal = (pct / 100) * z50;
    let lo = 1e-6;
    let hi = 1;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (rawZ(50, mid) < goal) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  });
})();

const zResource = (oversRemaining: number, wicketsLost: number): number => {
  if (wicketsLost >= 10) return 0;
  const w = Math.max(0, Math.floor(wicketsLost));
  return rawZ(oversRemaining, F_BY_WICKETS[w]);
};

/**
 * Percentage of resources remaining (0-100) for a given number of overs left
 * and wickets lost, relative to a full innings of `totalMatchOvers`.
 */
export const calculateDlsResource = (
  oversRemaining: number,
  wicketsLost: number,
  totalMatchOvers: number = 20,
): number => {
  const full = zResource(Math.max(0, totalMatchOvers), 0);
  if (full <= 0) return 0;
  const u = Math.min(Math.max(0, oversRemaining), totalMatchOvers);
  const pct = (zResource(u, wicketsLost) / full) * 100;
  return Math.min(100, Math.max(0, pct));
};

export interface DlsResult {
  parScore: number;
  targetToWin: number;
  difference: number;
  statusText: string;
  isAhead: boolean;
  isTied: boolean;
}

/**
 * Calculates DLS Par Score for 2nd innings chasing team.
 * @param team1Score Total score scored by Team 1 in 1st innings
 * @param team2Score Current score of Team 2 in 2nd innings
 * @param team2Wickets Wickets lost by Team 2
 * @param ballsBowled Balls bowled in 2nd innings
 * @param totalMatchOvers Total overs allotted for the match (any value, e.g. 1, 5, 10, 20)
 */
export const calculateDlsParScore = (
  team1Score: number,
  team2Score: number,
  team2Wickets: number,
  ballsBowled: number,
  totalMatchOvers: number = 20,
): DlsResult => {
  const totalMatchBalls = Math.max(1, Math.round(totalMatchOvers * 6));
  const ballsLeft = Math.max(0, totalMatchBalls - ballsBowled);
  const oversRemaining = ballsLeft / 6.0;

  // Resource remaining (as % of a full innings of this match length)
  const resourceRemaining = calculateDlsResource(
    oversRemaining,
    team2Wickets,
    totalMatchBalls / 6,
  );

  // Resource used so far by Team 2
  const resourceUsed = Math.max(0, 100 - resourceRemaining);

  // Par score: what Team 2 "should" have at this point to be level
  const parScore = Math.floor(team1Score * (resourceUsed / 100));
  const targetToWin = parScore + 1;
  const difference = team2Score - parScore;

  let statusText = "";
  let isAhead = false;
  let isTied = false;

  if (difference > 0) {
    isAhead = true;
    statusText = `AHEAD BY ${difference} RUN${difference > 1 ? "S" : ""} (DLS)`;
  } else if (difference < 0) {
    statusText = `BEHIND BY ${Math.abs(difference)} RUN${Math.abs(difference) > 1 ? "S" : ""} (DLS)`;
  } else {
    isTied = true;
    statusText = "PAR SCORE TIED (DLS)";
  }

  return {
    parScore,
    targetToWin,
    difference,
    statusText,
    isAhead,
    isTied,
  };
};
