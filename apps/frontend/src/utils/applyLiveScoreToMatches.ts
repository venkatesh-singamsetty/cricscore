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
  explicitTotalWickets?: number;
  explicit_total_wickets?: number;
  currentOvers?: number;
  current_overs?: number;
  currentBalls?: number;
  current_balls?: number;
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
  const totalRuns = pickNumber(
    payload.explicitTotalRuns,
    payload.explicit_total_runs,
  );
  if (!matchId || totalRuns === undefined) {
    return { matches, applied: false };
  }

  const matchIndex = matches.findIndex((m) => String(m.id) === String(matchId));
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
    innIndex = innings.findIndex((i) => String(i.id) === String(inningId));
  }
  if (innIndex < 0 && battingTeam) {
    innIndex = innings.findIndex(
      (i) => i.batting_team_name?.toLowerCase() === battingTeam.toLowerCase(),
    );
  }
  if (innIndex < 0) {
    innIndex = innings.length - 1;
  }

  const current = innings[innIndex];
  const nextInning: MatchInningSummary = {
    ...current,
    total_runs: totalRuns,
    total_wickets:
      pickNumber(
        payload.explicitTotalWickets,
        payload.explicit_total_wickets,
      ) ?? current.total_wickets,
    overs:
      pickNumber(payload.currentOvers, payload.current_overs) ?? current.overs,
    balls:
      pickNumber(payload.currentBalls, payload.current_balls) ?? current.balls,
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
