import { BallEvent } from "../types";

export interface Partnership {
  wicketNumber: number;
  runs: number;
  balls: number;
  outBatterName: string | null;
}

/**
 * Calculates all partnerships from a sequence of ball events.
 * A partnership runs from the start of an innings or the fall of the previous wicket,
 * up to the fall of the next wicket (or the end of the innings).
 */
export const getPartnerships = (allBalls: BallEvent[]): Partnership[] => {
  const partnerships: Partnership[] = [];
  let currentRuns = 0;
  let currentBalls = 0;
  let wicketCount = 0;

  for (const ball of allBalls) {
    // Add runs to the partnership
    currentRuns += (ball.runs || 0) + (ball.extraRuns || 0);

    // Add legal balls to the partnership count
    if (ball.extraType !== "WIDE" && ball.extraType !== "NO_BALL") {
      currentBalls += 1;
    }

    // End of partnership if wicket falls
    if (ball.isWicket) {
      wicketCount += 1;
      partnerships.push({
        wicketNumber: wicketCount,
        runs: currentRuns,
        balls: currentBalls,
        outBatterName: ball.batterName,
      });

      // Reset for next partnership
      currentRuns = 0;
      currentBalls = 0;
    }
  }

  // Add the unbroken partnership (if match is still ongoing, or finished without being bowled out)
  if (
    currentRuns > 0 ||
    currentBalls > 0 ||
    (allBalls.length > 0 && partnerships.length === 0)
  ) {
    partnerships.push({
      wicketNumber: wicketCount + 1,
      runs: currentRuns,
      balls: currentBalls,
      outBatterName: null, // Unbroken
    });
  }

  return partnerships;
};

/**
 * Convenience function to get the current (latest) partnership.
 */
export const getCurrentPartnership = (allBalls: BallEvent[]) => {
  const partnerships = getPartnerships(allBalls);
  if (partnerships.length === 0) {
    return { runs: 0, balls: 0 };
  }
  return partnerships[partnerships.length - 1];
};
