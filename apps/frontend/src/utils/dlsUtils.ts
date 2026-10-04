/**
 * Duckworth-Lewis-Stern (DLS) Standard T20 Resource Calculations
 */

// Standard ICC T20 Resource Parameters per wicket lost (0 to 9)
const DLS_RESOURCE_PARAMS: Record<number, { R0: number; b: number }> = {
  0: { R0: 100.0, b: 0.0544 },
  1: { R0: 93.4, b: 0.0558 },
  2: { R0: 85.1, b: 0.0575 },
  3: { R0: 74.9, b: 0.0598 },
  4: { R0: 62.7, b: 0.0631 },
  5: { R0: 48.5, b: 0.0682 },
  6: { R0: 33.1, b: 0.0765 },
  7: { R0: 18.7, b: 0.091 },
  8: { R0: 8.2, b: 0.12 },
  9: { R0: 2.1, b: 0.18 },
};

/**
 * Calculates the percentage of resources remaining (0-100%) for a given number of overs left and wickets lost.
 * Formula: R(u, w) = R0(w) * (1 - e^(-b(w) * u))
 */
export const calculateDlsResource = (
  oversRemaining: number,
  wicketsLost: number,
): number => {
  const w = Math.min(9, Math.max(0, wicketsLost));
  const u = Math.max(0, oversRemaining);
  const param = DLS_RESOURCE_PARAMS[w] || DLS_RESOURCE_PARAMS[0];
  const resource = param.R0 * (1 - Math.exp(-param.b * u));
  return Math.min(100.0, Math.max(0.0, resource));
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
 * @param totalMatchOvers Total overs allotted for the match (e.g. 20)
 */
export const calculateDlsParScore = (
  team1Score: number,
  team2Score: number,
  team2Wickets: number,
  ballsBowled: number,
  totalMatchOvers: number = 20,
): DlsResult => {
  const totalMatchBalls = totalMatchOvers * 6;
  const ballsLeft = Math.max(0, totalMatchBalls - ballsBowled);
  const oversRemaining = ballsLeft / 6.0;

  // Resource available at start of innings (100% for full overs)
  const resourceStart = calculateDlsResource(totalMatchOvers, 0);

  // Resource remaining at current ball
  const resourceRemaining = calculateDlsResource(oversRemaining, team2Wickets);

  // Resource used so far by Team 2
  const resourceUsed = Math.max(0.1, resourceStart - resourceRemaining);

  // Calculate Par Score
  const parScore = Math.floor(team1Score * (resourceUsed / resourceStart));
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
