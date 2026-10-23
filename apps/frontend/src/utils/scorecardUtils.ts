import { InningsState } from "../types";

/**
 * Safely calculates a batter's strike rate without NaN, division-by-zero, or layout shifts.
 * Consistently handles edge cases where runs === 0 and balls === 0.
 *
 * @param runs Total runs scored by batter
 * @param balls Total legal balls faced by batter
 * @param fallback String to display when balls faced is 0 (default: "-")
 */
export function calculateStrikeRate(
  runs: number | undefined | null,
  balls: number | undefined | null,
  fallback = "-",
): string {
  const r = Number(runs ?? 0);
  const b = Number(balls ?? 0);

  if (!Number.isFinite(r) || !Number.isFinite(b) || b <= 0) {
    return fallback;
  }

  const sr = (r / b) * 100;
  return Number.isFinite(sr) ? sr.toFixed(1) : fallback;
}

/**
 * Computes raw numeric strike rate for sorting or threshold checks.
 */
export function calculateStrikeRateNumber(
  runs: number | undefined | null,
  balls: number | undefined | null,
): number {
  const r = Number(runs ?? 0);
  const b = Number(balls ?? 0);

  if (!Number.isFinite(r) || !Number.isFinite(b) || b <= 0) {
    return 0;
  }

  const sr = (r / b) * 100;
  return Number.isFinite(sr) ? sr : 0;
}

/**
 * Safely calculates a bowler's economy rate per over.
 *
 * @param runsConceded Total runs conceded by bowler
 * @param overs Completed overs bowled
 * @param balls Additional legal balls in current over (0-5)
 * @param fallback String to display when 0 legal deliveries have been bowled (default: "-")
 */
export function calculateEconomy(
  runsConceded: number | undefined | null,
  overs: number | undefined | null,
  balls: number | undefined | null = 0,
  fallback = "-",
): string {
  const r = Number(runsConceded ?? 0);
  const o = Number(overs ?? 0);
  const b = Number(balls ?? 0);
  const totalOvers = o + b / 6;

  if (!Number.isFinite(r) || !Number.isFinite(totalOvers) || totalOvers <= 0) {
    return fallback;
  }

  const econ = r / totalOvers;
  return Number.isFinite(econ) ? econ.toFixed(1) : fallback;
}

/**
 * Computes raw numeric economy rate for sorting or threshold checks.
 */
export function calculateEconomyNumber(
  runsConceded: number | undefined | null,
  overs: number | undefined | null,
  balls: number | undefined | null = 0,
): number {
  const r = Number(runsConceded ?? 0);
  const o = Number(overs ?? 0);
  const b = Number(balls ?? 0);
  const totalOvers = o + b / 6;

  if (!Number.isFinite(r) || !Number.isFinite(totalOvers) || totalOvers <= 0) {
    return 0;
  }

  return r / totalOvers;
}

export interface PlayerContribution {
  name: string;
  teamName: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  overs: number;
  balls: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  impactScore: number;
}

/**
 * Resolves the Player of the Match (POTM) across match innings.
 *
 * CRITICAL LOGIC:
 * In a cricket match, Inning i has:
 *  - battingTeamName: The team batting in Inning i -> `players` represents this team's batting stats.
 *  - bowlingTeamName: The opposing team bowling in Inning i -> `bowlers` represents the OPPOSING team's bowling stats!
 *
 * To avoid cross-team mismatches, each bowler's stats in Inning i are attributed to `bowlingTeamName`
 * (their true team), ensuring seamless combination with their batting stats when their team bats
 * in the opposite inning.
 *
 * @param innings Array of innings in the match (Inns 1, Inns 2)
 * @param fallbackPotm An existing POTM string (e.g. from backend AI summary) to preserve if available
 */
export function resolvePOTM(
  innings: (InningsState | undefined | null)[],
  fallbackPotm?: string | null,
): string | null {
  if (fallbackPotm && fallbackPotm.trim().length > 0) {
    return fallbackPotm.trim();
  }

  const validInnings = (innings || []).filter(
    (inn): inn is InningsState => !!inn && typeof inn === "object",
  );

  if (validInnings.length === 0) {
    return null;
  }

  // Keyed by normalized lowercase player name to aggregate batting + bowling across innings
  const playersMap = new Map<string, PlayerContribution>();

  const getOrCreate = (name: string, teamName: string): PlayerContribution => {
    const key = name.trim().toLowerCase();
    let entry = playersMap.get(key);
    if (!entry) {
      entry = {
        name: name.trim(),
        teamName,
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        overs: 0,
        balls: 0,
        maidens: 0,
        runsConceded: 0,
        wickets: 0,
        impactScore: 0,
      };
      playersMap.set(key, entry);
    }
    if (!entry.teamName && teamName) {
      entry.teamName = teamName;
    }
    return entry;
  };

  validInnings.forEach((inn) => {
    const battingTeam = inn.battingTeamName || "Team A";
    const bowlingTeam = inn.bowlingTeamName || "Team B";

    // 1. Batting attribution (this inning's batting team)
    if (inn.players) {
      Object.values(inn.players).forEach((p) => {
        if (!p || !p.name) return;
        const record = getOrCreate(p.name, battingTeam);
        record.runs += Number(p.runs || 0);
        record.ballsFaced += Number(p.ballsFaced || 0);
        record.fours += Number(p.fours || 0);
        record.sixes += Number(p.sixes || 0);
      });
    }

    // 2. Bowling attribution (attributed to the OPPOSING team bowling in this inning!)
    if (inn.bowlers) {
      Object.values(inn.bowlers).forEach((b) => {
        if (!b || !b.name) return;
        const record = getOrCreate(b.name, bowlingTeam);
        record.overs += Number(b.overs || 0);
        record.balls += Number(b.balls || 0);
        record.maidens += Number(b.maidens || 0);
        record.runsConceded += Number(b.runsConceded || 0);
        record.wickets += Number(b.wickets || 0);
      });
    }
  });

  // Calculate Impact Score for every participant
  const candidates: PlayerContribution[] = [];

  playersMap.forEach((p) => {
    // Only consider players who actively participated with bat or ball
    const hasBatted = p.ballsFaced > 0 || p.runs > 0;
    const hasBowled = p.overs > 0 || p.balls > 0 || p.wickets > 0;

    if (!hasBatted && !hasBowled) {
      return;
    }

    let impact = 0;

    // Batting impact
    impact += p.runs;
    if (p.runs >= 100) impact += 40;
    else if (p.runs >= 50) impact += 20;
    else if (p.runs >= 30) impact += 10;
    impact += p.fours * 1 + p.sixes * 2;

    // Bowling impact
    impact += p.wickets * 25;
    if (p.wickets >= 5) impact += 40;
    else if (p.wickets >= 3) impact += 20;
    impact += p.maidens * 10;
    // Economy factor: subtract 0.25 per run conceded
    impact -= p.runsConceded * 0.25;

    p.impactScore = impact;
    candidates.push(p);
  });

  if (candidates.length === 0) {
    return null;
  }

  // Sort descending by impactScore, then wickets, then runs, then fewest runsConceded
  candidates.sort((a, b) => {
    if (b.impactScore !== a.impactScore) {
      return b.impactScore - a.impactScore;
    }
    if (b.wickets !== a.wickets) {
      return b.wickets - a.wickets;
    }
    if (b.runs !== a.runs) {
      return b.runs - a.runs;
    }
    return a.runsConceded - b.runsConceded;
  });

  const top = candidates[0];
  if (!top || top.impactScore <= 0) {
    return null;
  }

  // Format descriptive performance string
  if (top.wickets > 0 && top.runs > 0) {
    return `${top.name} - ${top.runs} (${top.ballsFaced}b) & ${top.wickets}/${top.runsConceded}`;
  } else if (top.wickets > 0) {
    const wktText = top.wickets === 1 ? "1 WICKET" : `${top.wickets} WICKETS`;
    return `${top.name} - TOOK ${wktText} FOR ${top.runsConceded} RUNS`;
  } else if (top.runs > 0) {
    return `${top.name} - ${top.runs} RUNS (${top.ballsFaced} BALLS)`;
  }

  return top.name;
}
