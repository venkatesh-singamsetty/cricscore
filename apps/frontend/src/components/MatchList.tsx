import React, { useState, useEffect, useCallback } from "react";
import HighlightedResult from "./HighlightedResult";
import { fetchAuthSession } from "aws-amplify/auth";
import type { WebSocketMessage } from "../hooks/useWebSocket";
import {
  applyLiveScoreToMatches,
  isHubRefreshType,
  isScoreEventType,
  unwrapLiveScoreMessage,
} from "../utils/applyLiveScoreToMatches";
interface MatchInningSummary {
  id?: string;
  inning_number: number;
  batting_team_name: string;
  total_runs: number;
  total_wickets: number;
  overs: number;
  balls: number;
}

interface MatchMetadata {
  id: string;
  team_a_name: string;
  team_b_name: string;
  total_overs: number;
  status: string;
  created_at: string;
  updated_at: string;
  innings?: MatchInningSummary[];
  scorer_email?: string;
  is_test?: boolean;
  [key: string]: unknown;
}

interface MatchListProps {
  onSelectMatch: (matchId: string) => void;
  isAdmin?: boolean;
  showDeleteControls?: boolean; // Only show delete/purge in DB Management, not Viewer
  onResumeMatch?: (matchId: string) => void;
  refreshTrigger?: number;
  searchTerm?: string;
  lastMessage?: WebSocketMessage | null;
}

const getTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff > 86400000) return new Date(dateStr).toLocaleDateString();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "JUST NOW";
  if (mins < 60) return `${mins} MINS AGO`;
  return `${Math.floor(mins / 60)} HOURS AGO`;
};

const MatchList: React.FC<MatchListProps> = ({
  onSelectMatch,
  isAdmin,
  showDeleteControls = false,
  onResumeMatch,
  refreshTrigger,
  searchTerm = "",
  lastMessage = null,
}) => {
  const [matches, setMatches] = useState<MatchMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGuestMatches, setShowGuestMatches] = useState(false);
  const [showTestMatches, setShowTestMatches] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "DELETE_MATCH";
    matchId?: string;
    matchName?: string;
  } | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const API_URL = import.meta.env.VITE_API_URL || "";
  const activeMessage = lastMessage;

  const fetchMatches = useCallback(
    async (background = false) => {
      if (!background) setLoading(true);
      try {
        const response = await fetch(`${API_URL}/matches?t=${Date.now()}`, {
          cache: "no-store",
        });
        const data = await response.json();
        const rows = Array.isArray(data) ? data : [];
        const normalized = rows.map((row: MatchMetadata) => ({
          ...row,
          innings:
            typeof row.innings === "string"
              ? JSON.parse(row.innings as unknown as string)
              : row.innings,
        }));
        const sorted = [...normalized].sort((a, b) => {
          return (
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
        });
        setMatches((prev) => {
          if (!background || prev.length === 0) return sorted;
          return sorted.map((incoming) => {
            const existing = prev.find((m) => m.id === incoming.id);
            if (!existing) return incoming;
            const incInnings = Array.isArray(incoming.innings)
              ? incoming.innings
              : [];
            const exInnings = Array.isArray(existing.innings)
              ? existing.innings
              : [];
            const mergedInnings = incInnings.map((incInn) => {
              const exInn = exInnings.find(
                (i) =>
                  (i.id && incInn.id && i.id === incInn.id) ||
                  i.batting_team_name?.trim().toLowerCase() ===
                    incInn.batting_team_name?.trim().toLowerCase(),
              );
              if (!exInn) return incInn;
              const incBalls =
                Number(incInn.overs || 0) * 6 + Number(incInn.balls || 0);
              const exBalls =
                Number(exInn.overs || 0) * 6 + Number(exInn.balls || 0);
              if (exBalls > incBalls) {
                return {
                  ...incInn,
                  overs: exInn.overs,
                  balls: exInn.balls,
                  total_runs: Math.max(
                    Number(exInn.total_runs || 0),
                    Number(incInn.total_runs || 0),
                  ),
                  total_wickets: Math.max(
                    Number(exInn.total_wickets || 0),
                    Number(incInn.total_wickets || 0),
                  ),
                };
              }
              return incInn;
            });
            // Preserve any 2nd innings already tracked via WebSocket if background DB read hasn't seen it yet
            for (const exInn of exInnings) {
              const alreadyPresent = mergedInnings.some(
                (i) =>
                  (i.id && exInn.id && i.id === exInn.id) ||
                  i.batting_team_name?.trim().toLowerCase() ===
                    exInn.batting_team_name?.trim().toLowerCase(),
              );
              if (!alreadyPresent) {
                mergedInnings.push(exInn);
              }
            }
            return {
              ...incoming,
              status:
                existing.status === "COMPLETED" ? "COMPLETED" : incoming.status,
              innings: mergedInnings,
            };
          });
        });
      } catch (err) {
        console.error("Failed to fetch matches:", err);
      } finally {
        if (!background) setLoading(false);
      }
    },
    [API_URL],
  );

  useEffect(() => {
    fetchMatches(false);
  }, [refreshTrigger, fetchMatches]);

  useEffect(() => {
    if (!activeMessage) return;
    try {
      const unwrapped = unwrapLiveScoreMessage(activeMessage as any);
      if (!unwrapped) return;
      const { type, payload } = unwrapped;

      if (isHubRefreshType(type)) {
        fetchMatches(true);
        return;
      }

      if (isScoreEventType(type)) {
        setMatches((prev) => {
          const result = applyLiveScoreToMatches(prev, payload);
          if (!result.applied) {
            Promise.resolve().then(() => fetchMatches(true));
            return prev;
          }
          return result.matches as unknown as MatchMetadata[];
        });
      }
    } catch (err) {
      console.error("MatchList live update error", err);
    }
  }, [activeMessage, fetchMatches]);

  const calculateResult = (match: any) => {
    if (match.match_winner) return match.match_winner;
    if (!match.innings || match.innings.length < 2) return null;

    const i1 = match.innings[0];
    const i2 = match.innings[1];
    const totalOvers = match.total_overs;

    const i1Runs = Number(i1.total_runs || 0);
    const i2Runs = Number(i2.total_runs || 0);
    const i2Wickets = Number(i2.total_wickets || 0);
    const i2Overs = Number(i2.overs || 0);

    if (i2Runs > i1Runs) {
      return `${i2.batting_team_name} WON BY ${10 - i2Wickets} WICKETS`;
    } else if (i1Runs > i2Runs && (i2Overs >= totalOvers || i2Wickets >= 10)) {
      // Team 1 wins only if Team 2 is all out or ran out of overs
      return `${i1.batting_team_name} WON BY ${i1Runs - i2Runs} RUNS`;
    } else if (
      i1Runs === i2Runs &&
      (i2Overs >= totalOvers || i2Wickets >= 10)
    ) {
      return "MATCH TIED";
    }

    // Match is completed but condition wasn't met (e.g. DLS, admin manual end)
    if (match.status === "COMPLETED") {
      return i1Runs > i2Runs
        ? `${i1.batting_team_name} WON BY ${i1Runs - i2Runs} RUNS`
        : "MATCH TIED";
    }

    return null;
  };

  const isTestMatch = (m: MatchMetadata) =>
    Boolean(
      m.is_test === true ||
      String(m.is_test) === "true" ||
      (m.scorer_email &&
        (m.scorer_email.startsWith("test-") ||
          m.scorer_email.includes("@test.") ||
          m.scorer_email.includes("playwright"))) ||
      (m.team_a_name &&
        /test|demo|playwright|mock|sync/i.test(m.team_a_name)) ||
      (m.team_b_name && /test|demo|playwright|mock|sync/i.test(m.team_b_name)),
    );

  const isGuestMatch = (m: MatchMetadata) =>
    !isTestMatch(m) &&
    Boolean(
      m.scorer_email &&
      (m.scorer_email.includes("@cricscore.local") ||
        m.scorer_email.startsWith("guest-") ||
        m.scorer_email.startsWith("guest_")),
    );

  const filteredMatches = matches.filter((m) => {
    const isGuest = isGuestMatch(m);
    const isTest = isTestMatch(m);

    // In Admin Database Management view, filter to guest-only or test-only when toggled
    if (showDeleteControls && showGuestMatches && !isGuest) {
      return false;
    }
    if (showDeleteControls && showTestMatches && !isTest) {
      return false;
    }

    if (!searchTerm) return true;
    const s = searchTerm.toUpperCase();
    return (
      m.team_a_name.toUpperCase().includes(s) ||
      m.team_b_name.toUpperCase().includes(s) ||
      m.id.toUpperCase().includes(s)
    );
  });

  const baseMatches =
    showDeleteControls && showGuestMatches
      ? matches.filter(isGuestMatch)
      : showDeleteControls && showTestMatches
        ? matches.filter(isTestMatch)
        : matches;

  const stats = {
    total: baseMatches.length,
    live: baseMatches.filter((m) => m.status === "LIVE").length,
    completed: baseMatches.filter((m) => m.status === "COMPLETED").length,
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats Dashboard */}
      <div className="grid grid-cols-3 gap-3 px-1">
        <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-3 text-center">
          <span className="block text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-1">
            TOTAL
          </span>
          <span className="text-lg font-black text-white tabular-nums">
            {stats.total}
          </span>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/10 rounded-2xl p-3 text-center">
          <span className="block text-[8px] font-black text-emerald-500 uppercase tracking-tighter mb-1">
            LIVE
          </span>
          <span className="text-lg font-black text-emerald-400 tabular-nums">
            {stats.live}
          </span>
        </div>
        <div className="bg-indigo-500/10 border border-indigo-500/10 rounded-2xl p-3 text-center">
          <span className="block text-[8px] font-black text-indigo-500 uppercase tracking-tighter mb-1">
            FINISHED
          </span>
          <span className="text-lg font-black text-indigo-400 tabular-nums">
            {stats.completed}
          </span>
        </div>
      </div>

      <div className="flex justify-between items-end px-1 border-t border-white/5 pt-6">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            {searchTerm
              ? `SEARCHING: ${searchTerm}`
              : showTestMatches
                ? "TEST FIXTURES"
                : showGuestMatches
                  ? "GUEST FIXTURES"
                  : "LATEST FIXTURES"}
          </h3>
          <p className="text-[9px] font-black text-indigo-500/50 uppercase tracking-widest mt-1">
            {searchTerm
              ? `Filtering ${filteredMatches.length} Matches`
              : showTestMatches
                ? `Filtering ${filteredMatches.length} Test Matches`
                : showGuestMatches
                  ? `Filtering ${filteredMatches.length} Guest Matches`
                  : "Showing Active Database"}
          </p>
        </div>
        {showDeleteControls && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const next = !showGuestMatches;
                setShowGuestMatches(next);
                if (next) setShowTestMatches(false);
              }}
              title={
                showGuestMatches
                  ? "Showing guest matches only — click to show all matches"
                  : "Filter to guest matches only"
              }
              className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl border transition-all group ${
                showGuestMatches
                  ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.25)]"
                  : "border-transparent text-slate-500 hover:text-indigo-400"
              }`}
            >
              <span className="text-[9px] font-black uppercase tracking-tighter">
                GUESTS
              </span>
              <span
                className={`text-lg transition-all ${
                  showGuestMatches
                    ? "grayscale-0"
                    : "grayscale group-hover:grayscale-0"
                }`}
              >
                👻
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !showTestMatches;
                setShowTestMatches(next);
                if (next) setShowGuestMatches(false);
              }}
              title={
                showTestMatches
                  ? "Showing test matches only — click to show all matches"
                  : "Filter to test matches only"
              }
              className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl border transition-all group ${
                showTestMatches
                  ? "bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.25)]"
                  : "border-transparent text-slate-500 hover:text-purple-400"
              }`}
            >
              <span className="text-[9px] font-black uppercase tracking-tighter">
                TESTS
              </span>
              <span
                className={`text-lg transition-all ${
                  showTestMatches
                    ? "grayscale-0"
                    : "grayscale group-hover:grayscale-0"
                }`}
              >
                🧪
              </span>
            </button>

            <button
              type="button"
              onClick={() => fetchMatches()}
              className="flex flex-col items-center gap-1 px-2 py-1 group"
            >
              <span className="text-[9px] font-black text-indigo-500 group-hover:text-indigo-400 uppercase tracking-tighter">
                REFRESH
              </span>
              <span className="text-lg group-hover:rotate-180 transition-transform duration-500">
                🔄
              </span>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center animate-pulse">
          <p className="text-slate-600 font-black uppercase tracking-[0.3em] text-[10px]">
            Consulting Oracle Databases...
          </p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="py-20 text-center bg-slate-900 shadow-inner rounded-[2rem] border border-white/5">
          <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] italic">
            {searchTerm
              ? `No matches found for "${searchTerm}"`
              : showTestMatches
                ? "No test matches found"
                : showGuestMatches
                  ? "No guest matches found"
                  : "No matches found"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[700px] overflow-y-auto pr-2 scrollbar-hide">
          {filteredMatches.map((match) => {
            const diff = Date.now() - new Date(match.updated_at).getTime();
            const isStale = match.status === "LIVE" && diff > 86400000;
            const isTest = isTestMatch(match);
            const isGuest = isGuestMatch(match);
            const result =
              match.status === "COMPLETED" ? calculateResult(match) : null;

            return (
              <div
                key={match.id}
                onClick={() => onSelectMatch(match.id)}
                className={`w-full bg-slate-900/70 border border-white/5 rounded-2xl p-4 sm:p-5 text-left hover:bg-slate-800/80 ${match.status === "COMPLETED" ? "hover:border-indigo-500/30" : "hover:border-emerald-500/30"} transition-all group relative overflow-hidden flex flex-col gap-4 cursor-pointer`}
              >
                {/* Header Row: Time Ago, Test / Guest Badge, Status on Left; Actions on Right (Same Row Level) */}
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400/80 italic whitespace-nowrap">
                      {getTimeAgo(match.updated_at)}
                    </span>
                    {isTest ? (
                      <span
                        data-testid="test-match-badge"
                        className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 font-black text-[8px] uppercase tracking-widest flex items-center gap-1 whitespace-nowrap"
                      >
                        TEST 🧪
                      </span>
                    ) : isGuest ? (
                      <span
                        data-testid="guest-match-badge"
                        className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-black text-[8px] uppercase tracking-widest flex items-center gap-1 whitespace-nowrap"
                      >
                        GUEST 👻
                      </span>
                    ) : null}
                    {match.status === "COMPLETED" ? (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-900/40 text-indigo-400 border border-indigo-500/20 font-black text-[8px] uppercase tracking-widest whitespace-nowrap">
                        COMPLETED
                      </span>
                    ) : isStale ? (
                      <span className="px-2 py-0.5 rounded-md bg-rose-900/40 text-rose-500 border border-rose-500/20 font-black text-[8px] uppercase tracking-widest italic flex items-center gap-1.5 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        STALED
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-black text-[8px] uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.25)] whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
                        LIVE
                      </span>
                    )}
                  </div>

                  {/* Actions (Resume, Delete) on the right in the same line */}
                  <div className="flex items-center gap-2 shrink-0">
                    {match.status === "LIVE" && onResumeMatch && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onResumeMatch(match.id);
                        }}
                        className="px-3 py-1 bg-indigo-600/20 text-indigo-400 rounded-lg font-black text-[9px] hover:bg-indigo-600 hover:text-white transition-all uppercase border border-indigo-500/20 active:scale-95"
                      >
                        RESUME
                      </button>
                    )}
                    {showDeleteControls && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmAction({
                            type: "DELETE_MATCH",
                            matchId: match.id,
                            matchName: `${match.team_a_name} VS ${match.team_b_name}`,
                          });
                        }}
                        title={`Delete match ${match.id.substring(0, 8)}`}
                        className="p-1.5 min-w-[30px] min-h-[30px] flex items-center justify-center bg-red-950/40 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition-all text-xs border border-red-500/30 shadow-sm active:scale-95"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                    {(() => {
                      // Match each team's innings by batting_team_name (not by index position)
                      const leftTeamName =
                        match.innings?.[0]?.batting_team_name ||
                        match.team_a_name;
                      const rightTeamName =
                        leftTeamName.trim().toUpperCase() ===
                        match.team_a_name.trim().toUpperCase()
                          ? match.team_b_name
                          : match.team_a_name;

                      const leftTeamInnings = match.innings?.find(
                        (i) =>
                          i.batting_team_name?.trim().toLowerCase() ===
                          leftTeamName.trim().toLowerCase(),
                      );
                      const rightTeamInnings = match.innings?.find(
                        (i) =>
                          i.batting_team_name?.trim().toLowerCase() ===
                          rightTeamName.trim().toLowerCase(),
                      );
                      return (
                        <>
                          <div className="flex flex-col">
                            <h4 className="text-base font-black text-white uppercase tracking-tight italic group-hover:text-indigo-400 transition-colors">
                              {leftTeamName}
                            </h4>
                            {leftTeamInnings &&
                            (match.status === "LIVE" ||
                              Number(leftTeamInnings.overs) > 0 ||
                              Number(leftTeamInnings.balls) > 0 ||
                              Number(leftTeamInnings.total_runs) > 0 ||
                              Number(leftTeamInnings.total_wickets) > 0) ? (
                              <span className="text-xs font-black text-slate-400 tabular-nums">
                                {Number(leftTeamInnings.total_runs)}/
                                {Number(leftTeamInnings.total_wickets)}
                                <span className="text-[10px] text-slate-600 lowercase ml-1">
                                  ({leftTeamInnings.overs}.
                                  {leftTeamInnings.balls})
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs font-black text-slate-600 tabular-nums">
                                —
                              </span>
                            )}
                          </div>

                          <div className="text-[10px] font-black text-slate-600 uppercase italic">
                            VS
                          </div>

                          <div className="flex flex-col text-right">
                            <h4 className="text-base font-black text-white uppercase tracking-tight italic group-hover:text-indigo-400 transition-colors">
                              {rightTeamName}
                            </h4>
                            {rightTeamInnings &&
                            ((match.status === "LIVE" &&
                              match.innings &&
                              match.innings.length > 1) ||
                              Number(rightTeamInnings.overs) > 0 ||
                              Number(rightTeamInnings.balls) > 0 ||
                              Number(rightTeamInnings.total_runs) > 0 ||
                              Number(rightTeamInnings.total_wickets) > 0) ? (
                              <span className="text-xs font-black text-slate-400 tabular-nums">
                                {rightTeamInnings.total_runs}/
                                {rightTeamInnings.total_wickets}
                                <span className="text-[10px] text-slate-600 lowercase ml-1">
                                  ({rightTeamInnings.overs}.
                                  {rightTeamInnings.balls})
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs font-black text-slate-600 tabular-nums">
                                —
                              </span>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {match.status === "LIVE" &&
                    match.innings &&
                    match.innings.length > 1 &&
                    !result &&
                    (() => {
                      const i1 = match.innings[0];
                      const i2 = match.innings[1];
                      const target = Number(i1.total_runs || 0) + 1;
                      const runsNeeded = target - Number(i2.total_runs || 0);
                      const totalBalls = Number(match.total_overs || 20) * 6;
                      const ballsBowled =
                        Number(i2.overs || 0) * 6 + Number(i2.balls || 0);
                      const ballsLeft = Math.max(0, totalBalls - ballsBowled);
                      return (
                        <div className="mt-2 py-1 px-3 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-center justify-between text-[10px] font-black text-amber-300 uppercase tracking-tight">
                          <span className="flex items-center gap-1.5">
                            <span>🎯</span>
                            <span>
                              {runsNeeded > 0
                                ? `NEED ${runsNeeded} RUNS OFF ${ballsLeft} BALLS`
                                : "TARGET REACHED"}
                            </span>
                          </span>
                          <span className="text-amber-400/80 font-bold tabular-nums">
                            TGT: {target}
                          </span>
                        </div>
                      );
                    })()}

                  {result && (
                    <div className="mt-1 py-3 px-4 bg-indigo-500/10 border-y border-indigo-500/20 text-center rounded-xl">
                      <span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest animate-in fade-in slide-in-from-top-1">
                        🏁 <HighlightedResult text={result} />
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-2 pt-3 border-t border-white/5">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest group-hover:text-slate-400 transition-colors">
                      {isAdmin
                        ? "CLOUD ANALYTICS ⚡"
                        : onResumeMatch
                          ? "SCORER DASHBOARD 🎮"
                          : "VIEW SCOREBOARD 🌍"}
                    </span>
                    <span className="text-[8px] font-black text-slate-600 uppercase">
                      ID: {match.id.substring(0, 8)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[300] p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700/50 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-center text-slate-100 animate-in zoom-in-95 duration-200">
            <>
              <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <span className="text-3xl">🚨</span>
              </div>
              <h3 className="text-xl font-black uppercase tracking-widest text-white mb-2 italic">
                Delete Match{" "}
                {confirmAction.matchId
                  ? `#${confirmAction.matchId.substring(0, 8)}`
                  : ""}
                ?
              </h3>
              <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                This record{" "}
                <span className="text-indigo-400 font-bold">
                  ({confirmAction.matchName})
                </span>{" "}
                will be permanently removed.
                <br />
                <br />
                <strong className="text-white uppercase tracking-wider text-xs block">
                  Do you want to continue?
                </strong>
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-4 bg-slate-800 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] text-slate-300 hover:text-white hover:bg-slate-700 transition-all border border-slate-700/50 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const matchId = confirmAction.matchId!;
                    setConfirmAction(null);
                    setMatches((prev) => prev.filter((m) => m.id !== matchId));
                    try {
                      const session = await fetchAuthSession();
                      const token = session.tokens?.idToken?.toString();
                      const res = await fetch(`${API_URL}/match/${matchId}`, {
                        method: "DELETE",
                        headers: {
                          Authorization: `Bearer ${token}`,
                        },
                      });
                      if (!res.ok) throw new Error("Delete failed");
                      fetchMatches();
                    } catch (err: any) {
                      setAlertMessage(`Delete failed!\n${err.message}`);
                      fetchMatches();
                    }
                  }}
                  className="flex-1 py-4 bg-red-600 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] text-white hover:bg-red-500 transition-all shadow-lg shadow-red-600/20 active:scale-95"
                >
                  Delete Match
                </button>
              </div>
            </>
          </div>
        </div>
      )}

      {alertMessage && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[400] p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700/50 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-center text-slate-100 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <span className="text-3xl">⚠️</span>
            </div>
            <h3 className="text-xl font-black uppercase tracking-widest text-white mb-2 italic">
              Notification
            </h3>
            <p className="text-slate-300 text-sm font-medium mb-8 leading-relaxed whitespace-pre-line">
              {alertMessage}
            </p>
            <button
              type="button"
              onClick={() => setAlertMessage(null)}
              className="w-full py-4 bg-indigo-600 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchList;
