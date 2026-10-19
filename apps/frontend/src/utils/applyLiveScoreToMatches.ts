export interface MatchInningSummary {
  id?: string;
  inning_number?: number;
  batting_team_name: string;
  total_runs: number;
  total_wickets: number;
  overs: number;
  balls: number;
}

export interface MatchListItem {
  id: string;
  innings?: MatchInningSummary[] | string | null;
  updated_at?: string;
  [key: string]: unknown;
}

export interface LiveScorePayload {
  type?: string;
  matchId?: string;
  match_id?: string;
  inningId?: string;
  inning_id?: string;
  battingTeamName?: string;
  batting_team_name?: string;
  explicitTotalRuns?: number;
  explicit_total_runs?: number;
  totalRuns?: number;
  total_runs?: number;
  explicitTotalWickets?: number;
  explicit_total_wickets?: number;
  totalWickets?: number;
  total_wickets?: number;
  currentOvers?: number;
  current_overs?: number;
  currentBalls?: number;
  current_balls?: number;
  matchTotalOvers?: number;
  match_total_overs?: number;
  strikerName?: string;
  striker_name?: string;
  nonStrikerName?: string;
  non_striker_name?: string;
  bowlerName?: string;
  bowler_name?: string;
  runs?: number;
  ballsFaced?: number;
  fours?: number;
  sixes?: number;
  bowlerOvers?: number;
  bowlerBalls?: number;
  bowlerRuns?: number;
  bowlerWickets?: number;
  syncOnly?: boolean;
  undo?: boolean;
  ballData?: any;
  data?: LiveScorePayload;
}

export interface WebSocketEnvelope {
  type?: string;
  data?: LiveScorePayload | string;
  [key: string]: unknown;
}

const SCORE_EVENT_TYPES = new Set(["LIVE_SCORE_UPDATE", "STATE_SYNC"]);

function asObject(value: unknown): LiveScorePayload | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") return value as LiveScorePayload;
  return null;
}

/** Unwrap SNS/broadcaster envelopes so matchId is always on the returned payload. */
export function unwrapLiveScoreMessage(
  message: WebSocketEnvelope | null | undefined,
): {
  type: string;
  payload: LiveScorePayload;
} | null {
  if (!message) return null;

  let payload = asObject(message.data) || asObject(message);
  if (!payload) return null;

  // Double-wrapped: { type, data: { type, data: { matchId } } }
  if (!payload.matchId && !payload.match_id && payload.data) {
    const nested = asObject(payload.data);
    if (nested && (nested.matchId || nested.match_id)) {
      payload = nested;
    }
  }

  const type = String(
    message.type || payload.type || (payload.data && payload.data.type) || "",
  );
  return { type, payload };
}

export function isScoreEventType(type: string): boolean {
  return SCORE_EVENT_TYPES.has(type);
}

export function isHubRefreshType(type: string): boolean {
  return (
    type === "HUB_UPDATE" ||
    type === "MATCH_CREATED" ||
    type === "MATCH_UPDATED"
  );
}

function normalizeInnings(
  innings: MatchListItem["innings"],
): MatchInningSummary[] | null {
  if (!innings) return null;
  if (typeof innings === "string") {
    try {
      const parsed = JSON.parse(innings);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return Array.isArray(innings) ? innings : null;
}

function pickNumber(...values: Array<number | undefined>): number | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

/**
 * Apply a live score websocket payload onto the hub fixture list.
 * Returns the original array when the event cannot be applied.
 */
export function applyLiveScoreToMatches<T extends MatchListItem>(
  matches: T[],
  payload: LiveScorePayload,
): { matches: T[]; applied: boolean } {
  const matchId = payload.matchId || payload.match_id;
  if (!matchId) {
    return { matches, applied: false };
  }

  const matchIndex = matches.findIndex(
    (m) =>
      String(m.id).trim().toLowerCase() ===
      String(matchId).trim().toLowerCase(),
  );
  if (matchIndex === -1) {
    return { matches, applied: false };
  }

  const match = matches[matchIndex];
  const innings = normalizeInnings(match.innings);
  if (!innings || innings.length === 0) {
    return { matches, applied: false };
  }

  const inningId = payload.inningId || payload.inning_id;
  const battingTeam = payload.battingTeamName || payload.batting_team_name;

  let innIndex = -1;
  if (inningId) {
    innIndex = innings.findIndex(
      (i) =>
        i.id &&
        String(i.id).trim().toLowerCase() ===
          String(inningId).trim().toLowerCase(),
    );
  }
  if (innIndex < 0 && battingTeam) {
    innIndex = innings.findIndex(
      (i) =>
        i.batting_team_name?.trim().toLowerCase() ===
        battingTeam.trim().toLowerCase(),
    );
    // If battingTeam is explicitly provided (e.g. 2nd innings team) and not yet in match.innings,
    // return applied: false so MatchList refreshes from the server instead of overwriting innings 1.
    if (innIndex < 0) {
      return { matches, applied: false };
    }
  }
  if (innIndex < 0) {
    innIndex = innings.length - 1;
  }

  const current = innings[innIndex];

  let ballExtraRuns = 0;
  if (payload.ballData) {
    const r = Number(payload.ballData.runs || 0);
    const isExtra = payload.ballData.isExtra || payload.ballData.is_extra;
    const extraType = String(
      payload.ballData.extraType || payload.ballData.extra_type || "",
    ).toUpperCase();
    const extraRuns = Number(
      payload.ballData.extraRuns !== undefined
        ? payload.ballData.extraRuns
        : payload.ballData.extra_runs || 0,
    );
    if (isExtra) {
      if (extraType === "WIDE" || extraType === "NO_BALL") {
        ballExtraRuns = r + (extraRuns > 0 ? extraRuns : 1);
      } else {
        ballExtraRuns = r + extraRuns;
      }
    } else {
      ballExtraRuns = r;
    }
  }

  const payloadRuns = pickNumber(
    payload.explicitTotalRuns,
    payload.explicit_total_runs,
    payload.totalRuns,
    payload.total_runs,
  );

  const incomingWickets = pickNumber(
    payload.explicitTotalWickets,
    payload.explicit_total_wickets,
    payload.totalWickets,
    payload.total_wickets,
  );

  const incomingOvers = pickNumber(
    payload.currentOvers,
    payload.current_overs,
    payload.ballData?.overNumber,
    payload.ballData?.over_number,
  );
  const incomingBalls = pickNumber(
    payload.currentBalls,
    payload.current_balls,
    payload.ballData?.ballNumber,
    payload.ballData?.ball_number,
  );

  const currentTotalBalls =
    Number(current.overs || 0) * 6 + Number(current.balls || 0);
  const nextOvers = incomingOvers ?? current.overs;
  const nextBalls = incomingBalls ?? current.balls;
  const nextTotalBalls = Number(nextOvers || 0) * 6 + Number(nextBalls || 0);

  // Ignore out-of-order stale syncOnly messages that lag behind already-applied balls
  if (payload.syncOnly && !payload.undo && nextTotalBalls < currentTotalBalls) {
    return { matches, applied: true };
  }

  let nextTotalRuns: number;
  let nextTotalWickets: number;

  if (payload.undo) {
    nextTotalRuns =
      payloadRuns !== undefined
        ? payloadRuns
        : Math.max(0, Number(current.total_runs || 0) - ballExtraRuns);
    nextTotalWickets =
      incomingWickets !== undefined
        ? incomingWickets
        : Number(current.total_wickets || 0);
  } else if (payloadRuns !== undefined) {
    nextTotalRuns =
      nextTotalBalls >= currentTotalBalls
        ? payloadRuns
        : Math.max(payloadRuns, Number(current.total_runs || 0));
    nextTotalWickets =
      incomingWickets !== undefined
        ? nextTotalBalls >= currentTotalBalls
          ? incomingWickets
          : Math.max(incomingWickets, Number(current.total_wickets || 0))
        : Math.max(
            Number(current.total_wickets || 0),
            payload.ballData?.isWicket
              ? Number(current.total_wickets || 0) + 1
              : 0,
          );
  } else {
    nextTotalRuns = Number(current.total_runs || 0) + ballExtraRuns;
    nextTotalWickets = Math.max(
      incomingWickets ?? current.total_wickets ?? 0,
      Number(current.total_wickets || 0),
      payload.ballData?.isWicket ? Number(current.total_wickets || 0) + 1 : 0,
    );
  }

  const nextInning: MatchInningSummary = {
    ...current,
    total_runs: nextTotalRuns,
    total_wickets: nextTotalWickets,
    overs: nextOvers,
    balls: nextBalls,
  };

  const newInnings = [...innings];
  newInnings[innIndex] = nextInning;
  const nextMatches = [...matches];
  nextMatches[matchIndex] = {
    ...match,
    innings: newInnings,
    updated_at: new Date().toISOString(),
  };

  return { matches: nextMatches, applied: true };
}
