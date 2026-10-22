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
  status?: string;
  total_overs?: number;
  innings?: MatchInningSummary[] | string | null;
  updated_at?: string;
  [key: string]: unknown;
}

export interface PreviousInningsSnapshot {
  id?: string;
  battingTeamName?: string;
  batting_team_name?: string;
  totalRuns?: number;
  total_runs?: number;
  totalWickets?: number;
  total_wickets?: number;
  overs?: number;
  balls?: number;
}

export interface LiveScorePayload {
  type?: string;
  matchId?: string;
  match_id?: string;
  inningId?: string;
  inning_id?: string;
  inningNumber?: number;
  inning_number?: number;
  target?: number;
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
  battingOrderNames?: string[];
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
  matchCompleted?: boolean;
  previousInnings?: PreviousInningsSnapshot;
  ballData?: any;
  data?: LiveScorePayload;
  body?: unknown;
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

  // Handle lambda direct invocation event.body wrapping: { body: "..." }
  if (
    !payload.matchId &&
    !payload.match_id &&
    (payload as Record<string, unknown>).body
  ) {
    const bodyObj = asObject((payload as Record<string, unknown>).body);
    if (bodyObj) {
      payload = bodyObj;
    }
  }

  const type = String(
    payload.type || (payload.data && payload.data.type) || message.type || "",
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
  const matchId =
    payload.matchId ||
    payload.match_id ||
    payload.ballData?.matchId ||
    payload.ballData?.match_id;
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
  const rawInnings = normalizeInnings(match.innings);
  if (!rawInnings || rawInnings.length === 0) {
    return { matches, applied: false };
  }

  const innings = [...rawInnings];

  // If the scorer included an authoritative previousInnings snapshot, reconcile Innings 1 first
  // so a lagging background DB read can never leave Innings 1 stuck at a stale mid-innings score.
  if (payload.previousInnings && innings.length > 0) {
    const prevSnap = payload.previousInnings;
    const prevTeam = prevSnap.battingTeamName || prevSnap.batting_team_name;
    const prevIdx = prevTeam
      ? innings.findIndex(
          (i) =>
            i.batting_team_name?.trim().toLowerCase() ===
            prevTeam.trim().toLowerCase(),
        )
      : 0;
    const targetIdx = prevIdx >= 0 ? prevIdx : 0;
    const existingPrev = innings[targetIdx];
    const snapOvers = pickNumber(prevSnap.overs) ?? existingPrev.overs;
    const snapBalls = pickNumber(prevSnap.balls) ?? existingPrev.balls;
    const snapRuns = pickNumber(
      prevSnap.totalRuns,
      prevSnap.total_runs,
      existingPrev.total_runs,
    )!;
    const snapWickets = pickNumber(
      prevSnap.totalWickets,
      prevSnap.total_wickets,
      existingPrev.total_wickets,
    )!;
    const existingBalls =
      Number(existingPrev.overs || 0) * 6 + Number(existingPrev.balls || 0);
    const incomingSnapBalls =
      Number(snapOvers || 0) * 6 + Number(snapBalls || 0);
    if (incomingSnapBalls >= existingBalls) {
      innings[targetIdx] = {
        ...existingPrev,
        total_runs: Math.max(snapRuns, Number(existingPrev.total_runs || 0)),
        total_wickets: Math.max(
          snapWickets,
          Number(existingPrev.total_wickets || 0),
        ),
        overs: snapOvers,
        balls: snapBalls,
      };
    }
  }

  const inningId = payload.inningId || payload.inning_id;
  const battingTeam = payload.battingTeamName || payload.batting_team_name;
  const inningNumber = pickNumber(payload.inningNumber, payload.inning_number);

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
    if (innIndex < 0) {
      // If the payload explicitly carries 2nd-innings metadata (or previousInnings),
      // dynamically append the 2nd innings entry so MatchList updates immediately
      // without triggering a background GET /matches that could race with SQS.
      if (inningNumber === 2 || payload.previousInnings) {
        const createdSecondInning: MatchInningSummary = {
          id: inningId || `inn2_${matchId}`,
          inning_number: 2,
          batting_team_name: battingTeam,
          total_runs: 0,
          total_wickets: 0,
          overs: 0,
          balls: 0,
        };
        innings.push(createdSecondInning);
        innIndex = innings.length - 1;
      } else {
        return { matches, applied: false };
      }
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

  // Determine if the 2nd innings has concluded the match so MatchList transitions to COMPLETED immediately
  let nextStatus = match.status;
  if (payload.matchCompleted) {
    nextStatus = "COMPLETED";
  } else if (newInnings.length >= 2 && innIndex === 1 && !payload.undo) {
    const i1Runs = Number(newInnings[0].total_runs || 0);
    const i2Runs = Number(nextInning.total_runs || 0);
    const i2Wickets = Number(nextInning.total_wickets || 0);
    const maxOvers = pickNumber(
      payload.matchTotalOvers,
      payload.match_total_overs,
      Number(match.total_overs || 0) || undefined,
    );
    if (
      i2Runs > i1Runs ||
      i2Wickets >= 10 ||
      (maxOvers !== undefined &&
        maxOvers > 0 &&
        Number(nextInning.overs || 0) >= maxOvers)
    ) {
      nextStatus = "COMPLETED";
    }
  }

  const nextMatches = [...matches];
  nextMatches[matchIndex] = {
    ...match,
    ...(nextStatus ? { status: nextStatus } : {}),
    innings: newInnings,
    updated_at: new Date().toISOString(),
  };

  return { matches: nextMatches, applied: true };
}
