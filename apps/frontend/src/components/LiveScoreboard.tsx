import React, { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import MatchList from "./MatchList"; // Added Phase 6+
import Scoreboard from "./Scoreboard";
import { InningsState, ExtraType, WicketType } from "../types";
import { getCurrentPartnership } from "../utils/partnershipUtils";
import {
  isHubRefreshType,
  isScoreEventType,
  unwrapLiveScoreMessage,
} from "../utils/applyLiveScoreToMatches";

interface LiveBall {
  overNumber: number;
  ballNumber: number;
  bowlerName: string;
  batterName: string;
  runs: number;
  commentary: string;
}

interface LiveScoreboardProps {
  isAdmin?: boolean;
  showDeleteControls?: boolean;
  onResumeMatch?: (matchId: string) => void;
  initialMatchId?: string;
}

const LiveScoreboard: React.FC<LiveScoreboardProps> = ({
  isAdmin,
  showDeleteControls = false,
  onResumeMatch,
  initialMatchId,
}) => {
  const WS_URL = import.meta.env.VITE_WS_URL || "";
  const API_URL = import.meta.env.VITE_API_URL || "";
  const [targetMatchId, setTargetMatchId] = useState<string>("");
  const { lastMessage, isConnected } = useWebSocket(WS_URL);
  const [liveData, setLiveData] = useState<LiveBall | null>(null);
  const [matchDetails, setMatchDetails] = useState<{
    innings: InningsState[];
  } | null>(null);
  const [matchMeta, setMatchMeta] = useState<{
    status: string;
    teamA: string;
    teamB: string;
    totalOvers: number;
    aiSummary?: string | null;
    playerOfTheMatch?: string | null;
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showFullScorecard, setShowFullScorecard] = useState(false);
  const [hubUpdateTrigger, setHubUpdateTrigger] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);

  const handleGenerateAiSummary = useCallback(
    async (force = false) => {
      if (!targetMatchId || isGeneratingAiSummary) return;
      setIsGeneratingAiSummary(true);
      try {
        const response = await fetch(`${API_URL}/chat/summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId: targetMatchId, forceRefresh: force }),
        });
        const data = await response.json();
        if (data.summary) {
          setMatchMeta((prev) =>
            prev
              ? {
                  ...prev,
                  aiSummary: data.summary,
                  playerOfTheMatch: data.playerOfTheMatch,
                }
              : null,
          );
        }
      } catch (err) {
        console.error("Failed to generate AI summary in LiveScoreboard:", err);
      } finally {
        setIsGeneratingAiSummary(false);
      }
    },
    [API_URL, targetMatchId, isGeneratingAiSummary],
  );

  const fetchMatchDetails = useCallback(
    async (matchId: string, isBackground = false) => {
      if (!isBackground) setLoadingDetails(true);
      try {
        const response = await fetch(`${API_URL}/match/${matchId}/details`);
        const data = await response.json();

        setMatchMeta({
          status: data.match.status,
          teamA: data.match.team_a_name,
          teamB: data.match.team_b_name,
          totalOvers: data.match.total_overs,
          aiSummary: data.match.ai_summary,
          playerOfTheMatch: data.match.player_of_the_match,
        });

        // If completed match has missing or stale summary, auto-trigger generation
        const summary = data.match.ai_summary || "";
        const isStale =
          !summary ||
          summary.includes("0/0") ||
          summary.includes("0 balls") ||
          summary.includes("currently live") ||
          summary.includes("yet to begin") ||
          summary.includes("has not started");

        if (data.match.status === "COMPLETED" && isStale) {
          fetch(`${API_URL}/chat/summary`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ matchId, forceRefresh: true }),
          })
            .then((res) => res.json())
            .then((summaryRes) => {
              if (summaryRes.summary) {
                setMatchMeta((prev) =>
                  prev
                    ? {
                        ...prev,
                        aiSummary: summaryRes.summary,
                        playerOfTheMatch: summaryRes.playerOfTheMatch,
                      }
                    : null,
                );
              }
            })
            .catch((e) => console.error("Auto AI summary fetch failed:", e));
        }

        // Map DB rows to InningsState
        const mappedInnings = data.innings.map((inn: any): InningsState => {
          const players = (inn.players || []).reduce((acc: any, p: any) => {
            acc[p.id] = {
              id: p.id,
              name: p.name,
              runs: Number(p.runs || 0),
              ballsFaced: Number(p.balls_faced || 0),
              fours: Number(p.fours || 0),
              sixes: Number(p.sixes || 0),
              isOut: p.is_out,
              wicketBy: p.wicket_by,
              wicketType: p.wicket_type as WicketType,
              fielderName: p.fielder_name,
            };
            return acc;
          }, {});

          const playerRunsSum = Object.values(players).reduce(
            (sum: number, p: any) => sum + Number(p.runs || 0),
            0,
          );

          const allBallsMapped = (inn.allBalls || []).map((b: any) => ({
            ...b,
            bowlerName: b.bowler_name || b.bowlerName,
            batterName: b.batter_name || b.batterName,
            isExtra: b.is_extra !== undefined ? b.is_extra : b.isExtra,
            extraType: (b.extra_type || b.extraType) as ExtraType,
            extraRuns: b.extra_runs !== undefined ? b.extra_runs : b.extraRuns,
            isWicket: b.is_wicket !== undefined ? b.is_wicket : b.isWicket,
            wicketType: (b.wicket_type || b.wicketType) as WicketType,
            overNumber:
              b.over_number !== undefined ? b.over_number : b.overNumber,
            ballNumber:
              b.ball_number !== undefined ? b.ball_number : b.ballNumber,
          }));

          const ballsRunsSum = allBallsMapped.reduce((sum: number, b: any) => {
            const r = Number(b.runs || 0);
            const isExtra = b.isExtra;
            const extraType = b.extraType;
            const extraRuns = Number(b.extraRuns || 0);
            let ballTotal = r;
            if (isExtra) {
              if (
                extraType === ExtraType.WIDE ||
                extraType === ExtraType.NO_BALL
              ) {
                ballTotal = r + (extraRuns > 0 ? extraRuns : 1);
              } else {
                ballTotal = r + extraRuns;
              }
            }
            return sum + ballTotal;
          }, 0);

          const derivedTotalRuns = Math.max(
            Number(inn.total_runs || inn.totalRuns || 0),
            playerRunsSum,
            ballsRunsSum,
          );

          const outWicketsCount = Object.values(players).filter(
            (p: any) => p.isOut && p.wicketType !== WicketType.RETIRED_HURT,
          ).length;

          const ballsWicketsCount = allBallsMapped.filter(
            (b: any) => b.isWicket && b.wicketType !== WicketType.RETIRED_HURT,
          ).length;

          const derivedTotalWickets = Math.max(
            Number(inn.total_wickets || inn.totalWickets || 0),
            outWicketsCount,
            ballsWicketsCount,
          );

          return {
            id: inn.id,
            inningNumber: inn.inning_number,
            target: inn.target,
            battingTeamName: inn.batting_team_name,
            bowlingTeamName: inn.bowling_team_name,
            totalRuns: derivedTotalRuns,
            totalWickets: derivedTotalWickets,
            overs: Number(inn.overs || 0),
            balls: Number(inn.balls || 0),
            currentOver: allBallsMapped.slice(-6),
            allBalls: allBallsMapped,
            strikerId:
              (inn.players || []).find((p: any) => p.name === inn.striker_name)
                ?.id || "",
            nonStrikerId:
              (inn.players || []).find(
                (p: any) => p.name === inn.non_striker_name,
              )?.id || "",
            currentBowlerId:
              (inn.bowlers || []).find(
                (b: any) => b.name === inn.current_bowler_name,
              )?.id || "",
            players,
            bowlers: (inn.bowlers || []).reduce((acc: any, b: any) => {
              acc[b.id] = {
                id: b.id,
                name: b.name,
                overs: b.overs_completed,
                balls: b.balls,
                maidens: b.maidens,
                runsConceded: b.runs_conceded,
                wickets: b.wickets,
              };
              return acc;
            }, {}),
            battingOrder: (inn.players || []).map((p: any) => p.id),
            bowlingOrder: (inn.bowlers || []).map((b: any) => b.id),
          };
        });

        setMatchDetails({ innings: mappedInnings });
      } catch (err) {
        console.error("Failed to fetch match details:", err);
      } finally {
        if (!isBackground) setLoadingDetails(false);
      }
    },
    [API_URL],
  );

  useEffect(() => {
    if (initialMatchId && initialMatchId !== targetMatchId) {
      setTargetMatchId(initialMatchId);
    }
  }, [initialMatchId]);

  useEffect(() => {
    if (!lastMessage) return;

    const unwrapped = unwrapLiveScoreMessage(lastMessage as any);
    if (!unwrapped) return;

    const { type, payload } = unwrapped;

    if (isHubRefreshType(type)) {
      setHubUpdateTrigger((prev) => prev + 1);
      if (targetMatchId) {
        fetchMatchDetails(targetMatchId, true);
      }
      return;
    }

    if (isScoreEventType(type)) {
      const msgMatchId = payload.matchId || payload.match_id;
      if (
        payload &&
        (!targetMatchId ||
          String(msgMatchId).trim().toLowerCase() ===
            String(targetMatchId).trim().toLowerCase())
      ) {
        // Safely unwrap the nested ball data
        setLiveData(
          (payload.ballData ? payload.ballData : payload) as LiveBall,
        );

        const totalOvers = payload.matchTotalOvers ?? payload.match_total_overs;
        if (totalOvers !== undefined) {
          setMatchMeta((prev) =>
            prev ? { ...prev, totalOvers: Number(totalOvers) } : null,
          );
        }

        const totalRuns =
          payload.explicitTotalRuns ??
          payload.explicit_total_runs ??
          payload.totalRuns ??
          payload.total_runs;
        const totalWickets =
          payload.explicitTotalWickets ??
          payload.explicit_total_wickets ??
          payload.totalWickets ??
          payload.total_wickets;
        const currentOvers = payload.currentOvers ?? payload.current_overs;
        const currentBalls = payload.currentBalls ?? payload.current_balls;

        // OPTIMISTIC UPDATE: Eliminate lag and eventual consistency issues
        setMatchDetails((prev: any) => {
          if (!prev || !prev.innings || prev.innings.length === 0) {
            if (targetMatchId) fetchMatchDetails(targetMatchId, true);
            return prev;
          }
          const updatedInnings = [...prev.innings];

          const targetInningId = payload.inningId || payload.inning_id;
          const targetBattingTeam =
            payload.battingTeamName || payload.batting_team_name;

          let targetInningIndex = -1;
          if (targetInningId) {
            targetInningIndex = updatedInnings.findIndex(
              (i: any) =>
                String(i.id).trim().toLowerCase() ===
                String(targetInningId).trim().toLowerCase(),
            );
          }
          if (targetInningIndex < 0 && targetBattingTeam) {
            targetInningIndex = updatedInnings.findIndex(
              (i: any) =>
                i.battingTeamName?.trim().toLowerCase() ===
                  targetBattingTeam.trim().toLowerCase() ||
                i.batting_team_name?.trim().toLowerCase() ===
                  targetBattingTeam.trim().toLowerCase(),
            );
          }
          if (targetInningIndex < 0) {
            targetInningIndex = updatedInnings.length - 1;
          }

          if (targetInningIndex > -1) {
            const rawInn = updatedInnings[targetInningIndex];
            const clonedPlayers = Object.entries(rawInn.players || {}).reduce(
              (acc: any, [k, v]: any) => {
                acc[k] = { ...v };
                return acc;
              },
              {},
            );
            const clonedBowlers = Object.entries(rawInn.bowlers || {}).reduce(
              (acc: any, [k, v]: any) => {
                acc[k] = { ...v };
                return acc;
              },
              {},
            );

            const inn = {
              ...rawInn,
              players: clonedPlayers,
              bowlers: clonedBowlers,
            };

            const strikerName = payload.strikerName || payload.striker_name;
            const nonStrikerName =
              payload.nonStrikerName || payload.non_striker_name;
            const bowlerName = payload.bowlerName || payload.bowler_name;
            const runs = payload.runs;

            if (strikerName && runs !== undefined) {
              const striker = Object.values(inn.players || {}).find(
                (p: any) =>
                  p.name?.trim().toLowerCase() ===
                  strikerName.trim().toLowerCase(),
              ) as any;
              if (striker) {
                striker.runs = runs;
                if (payload.ballsFaced !== undefined)
                  striker.ballsFaced = payload.ballsFaced;
                if (payload.fours !== undefined) striker.fours = payload.fours;
                if (payload.sixes !== undefined) striker.sixes = payload.sixes;
              } else if (inn.players) {
                const id = "p_" + Date.now();
                inn.players[id] = {
                  id,
                  name: strikerName,
                  runs: runs,
                  ballsFaced: payload.ballsFaced || 1,
                  fours: payload.fours || 0,
                  sixes: payload.sixes || 0,
                };
              }
            }

            if (strikerName && inn.players) {
              const s = Object.values(inn.players).find(
                (p: any) =>
                  p.name?.trim().toLowerCase() ===
                  strikerName.trim().toLowerCase(),
              ) as any;
              if (s) inn.strikerId = s.id;
            }
            if (nonStrikerName && inn.players) {
              const ns = Object.values(inn.players).find(
                (p: any) =>
                  p.name?.trim().toLowerCase() ===
                  nonStrikerName.trim().toLowerCase(),
              ) as any;
              if (ns) inn.nonStrikerId = ns.id;
            }
            if (bowlerName && inn.bowlers) {
              let b = Object.values(inn.bowlers).find(
                (b: any) =>
                  b.name?.trim().toLowerCase() ===
                  bowlerName.trim().toLowerCase(),
              ) as any;
              if (!b) {
                const id = "b_" + Date.now();
                inn.bowlers[id] = { id, name: bowlerName };
                b = inn.bowlers[id];
              }
              inn.currentBowlerId = b.id;
            }

            if (payload.ballData) {
              const newBall = {
                ...payload.ballData,
                bowlerName:
                  payload.ballData.bowlerName || payload.ballData.bowler_name,
                batterName:
                  payload.ballData.batterName || payload.ballData.batter_name,
                isExtra:
                  payload.ballData.isExtra !== undefined
                    ? payload.ballData.isExtra
                    : payload.ballData.is_extra,
                extraType:
                  payload.ballData.extraType || payload.ballData.extra_type,
                extraRuns:
                  payload.ballData.extraRuns !== undefined
                    ? payload.ballData.extraRuns
                    : payload.ballData.extra_runs,
                isWicket:
                  payload.ballData.isWicket !== undefined
                    ? payload.ballData.isWicket
                    : payload.ballData.is_wicket,
                wicketType:
                  payload.ballData.wicketType || payload.ballData.wicket_type,
                overNumber:
                  payload.ballData.overNumber !== undefined
                    ? payload.ballData.overNumber
                    : payload.ballData.over_number,
                ballNumber:
                  payload.ballData.ballNumber !== undefined
                    ? payload.ballData.ballNumber
                    : payload.ballData.ball_number,
              };
              inn.allBalls = [...(inn.allBalls || []), newBall];
              inn.currentOver = [...(inn.currentOver || []), newBall].slice(-6);
            }

            const playerRunsSum = Object.values(inn.players || {}).reduce(
              (sum: number, p: any) => sum + Number(p.runs || 0),
              0,
            );

            const ballsRunsSum = (inn.allBalls || []).reduce(
              (sum: number, b: any) => {
                const r = Number(b.runs || 0);
                const isExtra = b.isExtra || b.is_extra;
                const extraType = String(
                  b.extraType || b.extra_type || "",
                ).toUpperCase();
                const extraRuns = Number(
                  b.extraRuns !== undefined ? b.extraRuns : b.extra_runs || 0,
                );
                let ballTotal = r;
                if (isExtra) {
                  if (extraType === "WIDE" || extraType === "NO_BALL") {
                    ballTotal = r + (extraRuns > 0 ? extraRuns : 1);
                  } else {
                    ballTotal = r + extraRuns;
                  }
                }
                return sum + ballTotal;
              },
              0,
            );

            const outWicketsCount = Object.values(inn.players || {}).filter(
              (p: any) => p.isOut && p.wicketType !== WicketType.RETIRED_HURT,
            ).length;

            const ballsWicketsCount = (inn.allBalls || []).filter(
              (b: any) =>
                (b.isWicket || b.is_wicket) &&
                b.wicketType !== WicketType.RETIRED_HURT &&
                b.wicket_type !== WicketType.RETIRED_HURT,
            ).length;

            inn.totalRuns = Math.max(
              Number(totalRuns || 0),
              Number(inn.totalRuns || 0),
              playerRunsSum,
              ballsRunsSum,
            );
            if (totalWickets !== undefined) {
              inn.totalWickets = Math.max(
                Number(totalWickets || 0),
                Number(inn.totalWickets || 0),
                outWicketsCount,
                ballsWicketsCount,
              );
            } else {
              inn.totalWickets = Math.max(
                Number(inn.totalWickets || 0),
                outWicketsCount,
                ballsWicketsCount,
              );
            }

            if (currentOvers !== undefined) inn.overs = Number(currentOvers);
            else if (payload.ballData?.overNumber !== undefined)
              inn.overs = Number(payload.ballData.overNumber);

            if (currentBalls !== undefined) inn.balls = Number(currentBalls);
            else if (payload.ballData?.ballNumber !== undefined)
              inn.balls = Number(payload.ballData.ballNumber);

            updatedInnings[targetInningIndex] = inn;
          }
          return { ...prev, innings: updatedInnings };
        });
      }
    }
  }, [lastMessage, targetMatchId, fetchMatchDetails]);

  useEffect(() => {
    // Reset state when following a new match
    setLiveData(null);
    setMatchDetails(null);
    setMatchMeta(null);
    setShowFullScorecard(false);

    if (targetMatchId) {
      fetchMatchDetails(targetMatchId, false);
    }
  }, [targetMatchId, fetchMatchDetails]);

  // Polling fallback: refresh every 5s while watching a live match,
  // in case WebSocket messages are missed or the connection briefly drops.
  useEffect(() => {
    if (!targetMatchId) return;
    const interval = setInterval(() => {
      if (
        matchMeta?.status === "LIVE" ||
        matchMeta?.status === "INNINGS_BREAK" ||
        !matchMeta
      ) {
        fetchMatchDetails(targetMatchId, true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [targetMatchId, matchMeta?.status, fetchMatchDetails]);

  return (
    <div className="p-6 bg-slate-900 text-white rounded-[2rem] border border-white/5 shadow-2xl w-full">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
            ></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">
              {isConnected ? "LIVE BROADCASTING" : "CONNECTING..."}
            </span>
          </div>
        </div>

        <div className="relative group">
          <input
            type="text"
            placeholder={
              targetMatchId
                ? "FOLLOW MATCH ID..."
                : "SEARCH TEAM OR MATCH ID..."
            }
            className="w-full bg-slate-800/50 border border-white/5 rounded-xl px-4 py-2.5 text-[10px] font-black text-indigo-400 placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-all uppercase tracking-widest tabular-nums"
            value={targetMatchId ? targetMatchId : searchTerm}
            onChange={(e) => {
              const val = e.target.value;
              if (targetMatchId) setTargetMatchId(val);
              else setSearchTerm(val);
            }}
          />
        </div>
      </div>

      {!targetMatchId ? (
        <MatchList
          onSelectMatch={(id) => {
            setTargetMatchId(id);
            setSearchTerm(""); // Reset search on select
          }}
          isAdmin={isAdmin}
          showDeleteControls={showDeleteControls}
          onResumeMatch={onResumeMatch}
          refreshTrigger={hubUpdateTrigger}
          searchTerm={searchTerm}
          lastMessage={lastMessage}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <button
              onClick={() => setTargetMatchId("")}
              className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
            >
              ← BACK TO HUB
            </button>
            {matchMeta && (
              <div className="text-right">
                <span
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${matchMeta.status === "LIVE" ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/10" : "text-slate-500 border-white/10 bg-white/5"}`}
                >
                  {matchMeta.status}
                </span>
              </div>
            )}
          </div>

          {showFullScorecard && matchDetails && (
            <Scoreboard
              currentInnings={
                matchDetails.innings[matchDetails.innings.length - 1]
              }
              previousInnings={
                matchDetails.innings.length > 1
                  ? matchDetails.innings[0]
                  : undefined
              }
              onClose={() => {
                setShowFullScorecard(false);
                if (matchMeta?.status === "COMPLETED") {
                  setTargetMatchId(""); // Return to Hub on completion
                }
              }}
              isSpectator={true}
              totalOvers={matchMeta?.totalOvers}
              playerOfTheMatch={matchMeta?.playerOfTheMatch}
            />
          )}

          {matchDetails && matchMeta?.status === "INNINGS_BREAK" ? (
            <div className="bg-slate-900 border border-white/5 p-10 rounded-[2rem] shadow-2xl relative overflow-hidden backdrop-blur-3xl text-center">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic mb-2">
                Innings Break
              </h2>
              <p className="text-indigo-400 font-bold mb-6 text-sm uppercase tracking-[0.2em]">
                Target: {matchDetails.innings[0]?.totalRuns + 1}
              </p>
              <div className="w-12 h-12 border-2 border-slate-700 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                Waiting for 2nd innings...
              </p>
            </div>
          ) : matchDetails && matchMeta?.status !== "COMPLETED" ? (
            (() => {
              const currentInnings =
                matchDetails.innings[matchDetails.innings.length - 1];

              // Fallback strikers/bowlers from DB if no live sync update yet
              const displayBowlerName =
                liveData?.bowlerName ||
                currentInnings.bowlers[currentInnings.currentBowlerId]?.name ||
                "Waiting...";

              // Find active batters (strictly current striker and non-striker)
              const activeBatters = (() => {
                const matched = Object.values(currentInnings.players || {})
                  .filter(
                    (p: any) =>
                      (p.id === currentInnings.strikerId ||
                        p.id === currentInnings.nonStrikerId) &&
                      p.id !== "",
                  )
                  .sort((a: any, b: any) =>
                    a.id === currentInnings.strikerId ? -1 : 1,
                  );
                if (matched.length > 0) return matched;
                return Object.values(currentInnings.players || {})
                  .filter(
                    (p: any) =>
                      !p.isOut && p.wicketType !== WicketType.RETIRED_HURT,
                  )
                  .slice(0, 2);
              })();

              // Find current bowler
              const currentBowler =
                currentInnings.bowlers[currentInnings.currentBowlerId] ||
                ({
                  name: displayBowlerName,
                  overs: 0,
                  balls: 0,
                  runsConceded: 0,
                  wickets: 0,
                  maidens: 0,
                } as any);

              const totalOversDec =
                currentInnings.overs + currentInnings.balls / 6;
              const crr =
                totalOversDec > 0
                  ? (currentInnings.totalRuns / totalOversDec).toFixed(1)
                  : "0.0";

              return (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  {/* Score header */}
                  <div className="bg-slate-800/80 p-5 rounded-3xl border border-white/5 flex justify-between items-center relative overflow-hidden shadow-xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -z-10"></div>
                    <div className="flex flex-col flex-1">
                      <div className="flex flex-col mb-1.5 gap-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-300 font-black px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider flex items-center gap-1 shadow-sm shadow-emerald-500/10">
                            🏏 BATTING: {currentInnings.battingTeamName}
                          </span>
                          <span className="text-[9px] text-slate-500 italic">
                            vs
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            {currentInnings.bowlingTeamName}
                          </span>
                        </div>
                        <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">
                          {currentInnings.battingTeamName} INNINGS
                        </span>
                      </div>

                      <div className="flex flex-col gap-1">
                        {/* Previous Innings Summary (Tight) */}
                        {matchDetails.innings.length > 1 && (
                          <div className="flex items-center gap-2 mb-1 opacity-60">
                            <span className="text-[8px] font-black bg-slate-700 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                              INN 1
                            </span>
                            <span className="text-xs font-bold text-slate-300">
                              {matchDetails.innings[0].battingTeamName}:{" "}
                              {matchDetails.innings[0].totalRuns}/
                              {matchDetails.innings[0].totalWickets}
                            </span>
                          </div>
                        )}

                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-black text-emerald-400 uppercase tracking-tighter mr-2 flex items-center gap-1">
                            <span>🏏</span> {currentInnings.battingTeamName}:
                          </span>
                          <span className="text-4xl font-black text-white tabular-nums tracking-tighter italic">
                            {currentInnings.totalRuns}
                            <span className="text-slate-600 mx-1">/</span>
                            {currentInnings.totalWickets}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span
                        className={`px-2 py-0.5 border rounded text-[9px] font-black uppercase tracking-widest mb-2 ${matchMeta?.status === "LIVE" || matchMeta?.status === "INNINGS_BREAK" ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : "bg-slate-700 border-white/10 text-slate-400"}`}
                      >
                        {matchMeta?.status === "LIVE"
                          ? `CRR ${crr}`
                          : matchMeta?.status}
                      </span>
                      <span className="text-sm font-black text-slate-300 flex items-baseline gap-1">
                        <span>
                          {currentInnings.overs}.{currentInnings.balls}
                        </span>
                        <span className="text-[10px] text-slate-600">/</span>
                        <span>{matchMeta?.totalOvers}</span>
                        <span className="text-[9px] text-slate-600 tracking-tight ml-0.5">
                          OVS
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* THIS OVER Live Timeline Bar */}
                  <div className="bg-slate-800/50 rounded-2xl border border-white/5 p-3.5 flex items-center justify-between shadow-lg">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      THIS OVER
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                      {!currentInnings.currentOver ||
                      currentInnings.currentOver.length === 0 ? (
                        <span className="text-[10px] font-bold text-slate-500 italic uppercase">
                          Waiting for ball...
                        </span>
                      ) : (
                        currentInnings.currentOver.map(
                          (ball: any, idx: number) => {
                            const isRetHurt =
                              ball.wicketType === WicketType.RETIRED_HURT ||
                              String(ball.wicketType) === "RETIRED_HURT";
                            const isRetOut =
                              ball.wicketType === WicketType.RETIRED_OUT ||
                              String(ball.wicketType) === "RETIRED_OUT";
                            const isWicket = ball.isWicket || ball.is_wicket;
                            const runs = Number(ball.runs || 0);
                            const isExtra = ball.isExtra || ball.is_extra;
                            const extraType = String(
                              ball.extraType || ball.extra_type || "",
                            ).toUpperCase();

                            let badgeBg =
                              "bg-white text-slate-900 border-white";
                            if (isRetHurt)
                              badgeBg =
                                "bg-amber-500 text-amber-950 border-amber-300 shadow-amber-500/30";
                            else if (isRetOut)
                              badgeBg =
                                "bg-purple-600 text-white border-purple-400 shadow-purple-500/30";
                            else if (isWicket)
                              badgeBg =
                                "bg-red-500 text-white border-red-300 shadow-red-500/30";
                            else if (runs === 4)
                              badgeBg =
                                "bg-blue-600 text-white border-blue-400 shadow-blue-500/30";
                            else if (runs === 6)
                              badgeBg =
                                "bg-purple-600 text-white border-purple-400 shadow-purple-500/30";
                            else if (isExtra)
                              badgeBg =
                                "bg-amber-500 text-amber-950 border-amber-300 shadow-amber-500/30";

                            let label = String(runs);
                            if (isRetHurt) label = "RH";
                            else if (isRetOut) label = "RO";
                            else if (isWicket)
                              label = runs > 0 ? `W+${runs}` : "W";
                            else if (isExtra) {
                              if (extraType === "WIDE")
                                label = runs > 0 ? `Wd+${runs}` : "Wd";
                              else if (extraType === "NO_BALL")
                                label = runs > 0 ? `Nb+${runs}` : "Nb";
                              else if (extraType === "BYE")
                                label = runs > 0 ? `B+${runs}` : "B";
                              else if (extraType === "LEG_BYE")
                                label = runs > 0 ? `Lb+${runs}` : "Lb";
                              else label = extraType ? extraType[0] : "E";
                            }

                            return (
                              <span
                                key={idx}
                                className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] md:text-xs font-black border shadow-md transition-all animate-in zoom-in-75 duration-300 ${badgeBg}`}
                              >
                                {label}
                              </span>
                            );
                          },
                        )
                      )}
                    </div>
                  </div>

                  {/* Batsmen */}
                  <div className="bg-white/5 rounded-2xl border border-white/5 p-4 space-y-3">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-4 text-[9px] font-black text-slate-500 uppercase tracking-widest pb-2 border-b border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[7px] text-indigo-400 mb-0.5 tracking-[0.2em]">
                          {currentInnings.battingTeamName}
                        </span>
                        <span>Batter</span>
                      </div>
                      <span className="text-right w-10">R</span>
                      <span className="text-right w-10 text-slate-600">B</span>
                    </div>
                    {activeBatters.length === 0 ? (
                      <div className="text-[10px] font-black text-slate-600 uppercase text-center py-2">
                        Waiting for first ball...
                      </div>
                    ) : (
                      activeBatters.map((b: any) => (
                        <div
                          key={b.id}
                          className="grid grid-cols-[1fr_auto_auto] gap-4 items-center group"
                        >
                          <span
                            className={`font-black uppercase text-sm italic truncate ${b.id === currentInnings.strikerId ? "text-white" : "text-slate-400"}`}
                          >
                            {b.name}{" "}
                            {b.id === currentInnings.strikerId && (
                              <span className="text-indigo-400 ml-1 opacity-80">
                                *
                              </span>
                            )}
                          </span>
                          <span
                            className={`font-black tabular-nums text-right w-10 ${b.id === currentInnings.strikerId ? "text-white" : "text-slate-300"}`}
                          >
                            {b.runs}
                          </span>
                          <span
                            className={`font-black tabular-nums text-right w-10 text-xs ${b.id === currentInnings.strikerId ? "text-slate-400" : "text-slate-500"}`}
                          >
                            {b.ballsFaced}
                          </span>
                        </div>
                      ))
                    )}
                    {currentInnings.allBalls &&
                      currentInnings.allBalls.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <span>Partnership</span>
                          <span className="text-indigo-400">
                            {
                              getCurrentPartnership(currentInnings.allBalls)
                                .runs
                            }{" "}
                            <span className="text-slate-500 text-[9px]">
                              (
                              {
                                getCurrentPartnership(currentInnings.allBalls)
                                  .balls
                              }
                              )
                            </span>
                          </span>
                        </div>
                      )}
                  </div>

                  {/* Bowler */}
                  <div className="bg-white/5 rounded-2xl border border-white/5 p-4 space-y-3">
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 text-[9px] font-black text-slate-500 uppercase tracking-widest pb-2 border-b border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[7px] text-indigo-400 mb-0.5 tracking-[0.2em]">
                          {currentInnings.bowlingTeamName}
                        </span>
                        <span>Bowler</span>
                      </div>
                      <span className="text-right w-8">O</span>
                      <span className="text-right w-8">R</span>
                      <span className="text-right w-8 text-indigo-400">W</span>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                      <span className="font-black text-white uppercase text-sm italic truncate">
                        {currentBowler.name}
                      </span>
                      <span className="text-slate-400 font-black tabular-nums text-right w-8 text-xs">
                        {currentBowler.overs}.{currentBowler.balls}
                      </span>
                      <span className="text-slate-300 font-black tabular-nums text-right w-8">
                        {currentBowler.runsConceded}
                      </span>
                      <span className="text-indigo-400 font-black tabular-nums text-right w-8">
                        {currentBowler.wickets}
                      </span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5 text-center">
                      <span className="px-2 py-0.5 bg-white/5 rounded text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2 w-max mx-auto">
                        LIVE COMMENTARY
                      </span>
                      <p className="text-slate-300 text-xs font-medium italic leading-relaxed">
                        {liveData
                          ? `"${liveData.commentary}"`
                          : "Waiting for the next ball..."}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowFullScorecard(true)}
                    className="w-full py-4 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 rounded-2xl text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] transition-all"
                  >
                    View Full Analysis 📋
                  </button>
                </div>
              );
            })()
          ) : liveData && matchMeta?.status !== "COMPLETED" ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 italic">
                    Current Batter
                  </span>
                  <span className="text-2xl font-black uppercase tracking-tighter italic">
                    {liveData.batterName}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-4xl font-black text-white tabular-nums">
                    {liveData.runs}
                  </span>
                  <span className="text-[10px] font-black text-slate-500 block uppercase tracking-widest">
                    RUNS
                  </span>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Bowler: {liveData.bowlerName}
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-600 rounded text-[9px] font-black uppercase tracking-widest">
                    OVER {liveData.overNumber}.{liveData.ballNumber}
                  </span>
                </div>
                <p className="text-slate-300 text-sm font-medium italic leading-relaxed">
                  "{liveData.commentary}"
                </p>
              </div>

              {matchDetails && (
                <button
                  onClick={() => setShowFullScorecard(true)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] transition-all"
                >
                  View Full Analysis 📋
                </button>
              )}
            </div>
          ) : loadingDetails ? (
            <div className="py-12 text-center animate-pulse">
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest leading-relaxed italic">
                Restoring secure records...
              </span>
            </div>
          ) : matchDetails && matchMeta?.status === "COMPLETED" ? (
            (() => {
              const i1 = matchDetails.innings[0];
              const i2 = matchDetails.innings[1];
              const result = i2
                ? (() => {
                    const i1Runs = Number(i1.totalRuns || 0);
                    const i2Runs = Number(i2.totalRuns || 0);
                    const i2Wickets = Number(i2.totalWickets || 0);

                    if (i2Runs > i1Runs) {
                      return `${i2.battingTeamName} WON BY ${10 - i2Wickets} WICKETS`;
                    } else if (i1Runs > i2Runs) {
                      return `${i1.battingTeamName} WON BY ${i1Runs - i2Runs} RUNS`;
                    }
                    return "MATCH TIED";
                  })()
                : "MATCH COMPLETED";

              return (
                <div className="space-y-6 text-center animate-in zoom-in-95 duration-1000">
                  <div
                    onClick={() => setShowFullScorecard(true)}
                    className="bg-indigo-600/20 border-2 border-indigo-500/30 rounded-[2.5rem] p-10 relative overflow-hidden shadow-2xl shadow-indigo-600/20 cursor-pointer hover:scale-[1.01] transition-transform active:scale-[0.99] group"
                  >
                    <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/20 blur-[100px] animate-pulse"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-rose-500/10 blur-[100px] animate-pulse delay-700"></div>

                    <div className="relative z-10">
                      <div className="flex justify-center gap-4 mb-6 opacity-30">
                        <span className="text-4xl">🏆</span>
                        <span className="text-4xl">🏏</span>
                        <span className="text-4xl">🏆</span>
                      </div>

                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-4">
                        🏆 Final Match Result 🏆
                      </p>

                      <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-8 drop-shadow-2xl">
                        {result}
                      </h3>

                      <div className="flex flex-col gap-2 mb-8">
                        <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-slate-500 border-b border-white/5 pb-2">
                          <span>{i1.battingTeamName}</span>
                          <span className="text-white">
                            {i1.totalRuns}/{i1.totalWickets}
                          </span>
                        </div>
                        {i2 && (
                          <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-slate-500 border-b border-white/5 pb-2">
                            <span>{i2.battingTeamName}</span>
                            <span className="text-white">
                              {i2.totalRuns}/{i2.totalWickets}
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFullScorecard(true);
                        }}
                        className="w-full py-5 bg-indigo-600 group-hover:bg-indigo-500 text-white rounded-3xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/40 hover:scale-[1.02] active:scale-95"
                      >
                        OPEN FULL SCORECARD 📋
                      </button>
                    </div>
                  </div>
                  {!matchMeta?.aiSummary ? (
                    <div className="bg-slate-800/30 border border-white/5 rounded-[2rem] p-6 text-center animate-pulse">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-center gap-2 mb-3">
                        <span className="animate-spin">⏳</span>{" "}
                        {isGeneratingAiSummary
                          ? "GENERATING AI SUMMARY & MOTM..."
                          : "FETCHING AI SUMMARY..."}
                      </span>
                      {!isGeneratingAiSummary && (
                        <button
                          onClick={() => handleGenerateAiSummary(true)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg"
                        >
                          ✨ GENERATE AI SUMMARY NOW
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-800/50 border border-indigo-500/30 rounded-[2rem] p-6 text-left shadow-xl animate-in slide-in-from-bottom-4 duration-700">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                          <span>🤖</span> AI MATCH SUMMARY & MOTM
                        </h4>
                        <button
                          onClick={() => handleGenerateAiSummary(true)}
                          disabled={isGeneratingAiSummary}
                          className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl font-black text-[10px] uppercase tracking-wider border border-indigo-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isGeneratingAiSummary
                            ? "REGENERATING..."
                            : "🔄 REFRESH"}
                        </button>
                      </div>
                      <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {matchMeta.aiSummary}
                      </div>
                      {matchMeta.playerOfTheMatch && (
                        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-3">
                          <span className="text-2xl">🏆</span>
                          <div>
                            <div className="text-amber-500 text-[10px] font-black tracking-widest uppercase">
                              Player of the Match
                            </div>
                            <div className="text-amber-100 font-bold text-sm">
                              {matchMeta.playerOfTheMatch}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic leading-relaxed opacity-50">
                    This match is safely archived in the cloud.
                  </p>
                </div>
              );
            })()
          ) : (
            <div className="py-12 text-center">
              <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] italic">
                Waiting for live update...
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LiveScoreboard;
