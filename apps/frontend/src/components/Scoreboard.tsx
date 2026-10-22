import React, { useState, useRef, useEffect } from "react";
import HighlightedResult from "./HighlightedResult";
import { InningsState, Player, Bowler, ExtraType } from "../types";
import { getPartnerships } from "../utils/partnershipUtils";

interface ScoreboardProps {
  currentInnings: InningsState;
  previousInnings?: InningsState;
  onClose: () => void;
  onResetMatch?: () => void;
  onQuitMatch?: () => void;
  isSpectator?: boolean;
  totalOvers?: number;
  playerOfTheMatch?: string | null;
}

interface BattingTableProps {
  players: Record<string, Player>;
  order: string[];
  strikerId?: string | null;
  nonStrikerId?: string | null;
  isCompleted?: boolean;
  isCurrentTab: boolean;
}

const BattingTable: React.FC<BattingTableProps> = React.memo(
  ({ players, order, strikerId, nonStrikerId, isCompleted, isCurrentTab }) => {
    const allPlayerIds = Object.keys(players || {});
    const effectiveOrder = [
      ...(order || []).filter((id) => players?.[id]),
      ...allPlayerIds.filter((id) => !(order || []).includes(id)),
    ];

    return (
      <div className="overflow-x-auto -mx-1 sm:mx-0">
        <table className="w-full text-left border-separate border-spacing-y-0.5 sm:border-spacing-y-1">
          <thead>
            <tr className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500">
              <th className="px-2.5 py-1 sm:py-1.5 whitespace-nowrap">
                Batter
              </th>
              <th className="px-2 py-1 sm:py-1.5 whitespace-nowrap">Status</th>
              <th className="px-2 py-1 sm:py-1.5 text-right whitespace-nowrap">
                R
              </th>
              <th className="px-2 py-1 sm:py-1.5 text-right whitespace-nowrap">
                B
              </th>
              <th className="px-2 py-1 sm:py-1.5 text-right whitespace-nowrap">
                4s
              </th>
              <th className="px-2 py-1 sm:py-1.5 text-right whitespace-nowrap">
                6s
              </th>
              <th className="px-2 py-1 sm:py-1.5 text-right text-indigo-400 whitespace-nowrap">
                SR
              </th>
            </tr>
          </thead>
          <tbody>
            {effectiveOrder.map((id) => {
              const player = players?.[id];
              if (!player) return null;
              const isStriker = id === strikerId;
              const isNonStriker = id === nonStrikerId;
              const isUnbatted =
                player.ballsFaced === 0 &&
                !player.isOut &&
                player.wicketType !== "RETIRED_HURT" &&
                !isStriker &&
                !isNonStriker;

              const highlight = isCurrentTab && (isStriker || isNonStriker);
              const sr =
                player.ballsFaced > 0
                  ? ((player.runs / player.ballsFaced) * 100).toFixed(1)
                  : "-";

              return (
                <tr
                  key={id}
                  className={`group transition-all duration-300 ${
                    highlight
                      ? "bg-indigo-600 shadow-md shadow-indigo-600/20"
                      : isUnbatted
                        ? "bg-white/[0.02] hover:bg-white/[0.05] opacity-75"
                        : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <td
                    className={`px-2.5 py-1.5 first:rounded-l-lg font-black uppercase tracking-tight italic text-xs whitespace-nowrap ${
                      highlight
                        ? "text-white"
                        : isUnbatted
                          ? "text-slate-400 font-bold"
                          : "text-slate-200"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {player.name}
                      {isStriker && (
                        <span className="text-indigo-300 animate-pulse text-xs">
                          🏏
                        </span>
                      )}
                    </span>
                  </td>
                  <td
                    className={`px-2 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-tight whitespace-nowrap ${
                      highlight ? "text-indigo-100" : "text-slate-500"
                    }`}
                  >
                    {isUnbatted ? (
                      <span className="text-slate-500 font-bold tracking-wider">
                        {isCompleted ? "DID NOT BAT" : "YET TO BAT"}
                      </span>
                    ) : player.isOut || player.wicketType === "RETIRED_HURT" ? (
                      (() => {
                        const type = player.wicketType;
                        const bowler = player.wicketBy;
                        const fielder = player.fielderName;

                        let text = "";
                        if (type === "CAUGHT") {
                          if (fielder === bowler) text = `c & b ${bowler}`;
                          else text = `c ${fielder || "---"} b ${bowler}`;
                        } else if (type === "STUMPED") {
                          text = `st ${fielder || "---"} b ${bowler}`;
                        } else if (type === "RUN_OUT") {
                          text = `run out (${fielder || "---"})`;
                        } else if (type === "LBW") {
                          text = `lbw b ${bowler}`;
                        } else if (type === "BOWLED") {
                          text = `b ${bowler}`;
                        } else if (type === "HIT_WICKET") {
                          text = `hit wicket b ${bowler}`;
                        } else if (type === "RETIRED_HURT") {
                          text = "ret. hurt";
                        } else if (type === "RETIRED_OUT") {
                          text = "ret. out";
                        } else {
                          text = `${type?.toLowerCase().replace(/_/g, " ")}`;
                        }

                        if (type === "RETIRED_HURT") {
                          return (
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black tracking-wide inline-flex items-center gap-1 shadow-sm whitespace-nowrap">
                              🚑 {text}
                            </span>
                          );
                        }
                        if (type === "RETIRED_OUT") {
                          return (
                            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black tracking-wide inline-flex items-center gap-1 shadow-sm whitespace-nowrap">
                              🚪 {text}
                            </span>
                          );
                        }
                        return (
                          <span className="text-red-400 opacity-90 font-medium whitespace-nowrap">
                            {text}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-emerald-400 font-bold opacity-90 inline-flex items-center gap-1 whitespace-nowrap">
                        {highlight ? "🏏 BATTING" : "NOT OUT"}
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-black text-xs sm:text-sm tabular-nums whitespace-nowrap ${
                      highlight
                        ? "text-white"
                        : isUnbatted
                          ? "text-slate-600"
                          : "text-slate-100"
                    }`}
                  >
                    {isUnbatted ? "-" : player.runs}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-black text-[11px] tabular-nums whitespace-nowrap ${
                      highlight
                        ? "text-indigo-200"
                        : isUnbatted
                          ? "text-slate-600"
                          : "text-slate-400"
                    }`}
                  >
                    {isUnbatted ? "-" : player.ballsFaced}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-black text-[11px] tabular-nums whitespace-nowrap ${
                      highlight
                        ? "text-indigo-200"
                        : isUnbatted
                          ? "text-slate-600"
                          : "text-slate-400"
                    }`}
                  >
                    {isUnbatted ? "-" : player.fours}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-black text-[11px] tabular-nums whitespace-nowrap ${
                      highlight
                        ? "text-indigo-200"
                        : isUnbatted
                          ? "text-slate-600"
                          : "text-slate-400"
                    }`}
                  >
                    {isUnbatted ? "-" : player.sixes}
                  </td>
                  <td
                    className={`px-2 py-1.5 last:rounded-r-lg text-right font-black text-[11px] tabular-nums whitespace-nowrap ${
                      highlight
                        ? "text-white"
                        : isUnbatted
                          ? "text-slate-600"
                          : "text-indigo-400"
                    }`}
                  >
                    {sr}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  },
);
BattingTable.displayName = "BattingTable";

interface BowlingTableProps {
  bowlers: Record<string, Bowler>;
  order: string[];
  currentBowlerId?: string | null;
  isCurrentTab: boolean;
}

const BowlingTable: React.FC<BowlingTableProps> = React.memo(
  ({ bowlers, order, currentBowlerId, isCurrentTab }) => {
    const allBowlerIds = Object.keys(bowlers || {});
    const effectiveOrder = [
      ...(order || []).filter((id) => bowlers?.[id]),
      ...allBowlerIds.filter((id) => !(order || []).includes(id)),
    ];

    return (
      <div className="overflow-x-auto -mx-1 sm:mx-0">
        <table className="w-full text-left border-separate border-spacing-y-0.5 sm:border-spacing-y-1">
          <thead>
            <tr className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500">
              <th className="px-2.5 py-1 sm:py-1.5 whitespace-nowrap">
                Bowler
              </th>
              <th className="px-2 py-1 sm:py-1.5 text-right whitespace-nowrap">
                O
              </th>
              <th className="px-2 py-1 sm:py-1.5 text-right whitespace-nowrap">
                M
              </th>
              <th className="px-2 py-1 sm:py-1.5 text-right whitespace-nowrap">
                R
              </th>
              <th className="px-2 py-1 sm:py-1.5 text-right text-indigo-400 whitespace-nowrap">
                W
              </th>
              <th className="px-2 py-1 sm:py-1.5 text-right whitespace-nowrap">
                Econ
              </th>
            </tr>
          </thead>
          <tbody>
            {effectiveOrder.map((id) => {
              const bowler = bowlers?.[id];
              if (!bowler) return null;
              if (bowler.overs === 0 && bowler.balls === 0 && !isCurrentTab)
                return null;
              if (
                bowler.overs === 0 &&
                bowler.balls === 0 &&
                id !== currentBowlerId
              )
                return null;

              const totalOvers = bowler.overs + bowler.balls / 6;
              const econ =
                totalOvers > 0
                  ? (bowler.runsConceded / totalOvers).toFixed(1)
                  : "-";
              const isCurrent = isCurrentTab && id === currentBowlerId;

              return (
                <tr
                  key={id}
                  className={`group transition-all duration-300 ${isCurrent ? "bg-indigo-600 shadow-md shadow-indigo-600/20" : "bg-white/5 hover:bg-white/10"}`}
                >
                  <td
                    className={`px-2.5 py-1.5 first:rounded-l-lg font-black uppercase tracking-tight italic text-xs whitespace-nowrap ${isCurrent ? "text-white" : "text-slate-200"}`}
                  >
                    {bowler.name}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-black text-[11px] tabular-nums whitespace-nowrap ${isCurrent ? "text-indigo-200" : "text-slate-400"}`}
                  >
                    {bowler.overs}.{bowler.balls}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-black text-[11px] tabular-nums whitespace-nowrap ${isCurrent ? "text-indigo-200" : "text-slate-400"}`}
                  >
                    {bowler.maidens}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-black text-xs sm:text-sm tabular-nums whitespace-nowrap ${isCurrent ? "text-white" : "text-slate-100"}`}
                  >
                    {bowler.runsConceded}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-black text-xs sm:text-sm tabular-nums whitespace-nowrap ${isCurrent ? "text-white" : "text-indigo-400"}`}
                  >
                    {bowler.wickets}
                  </td>
                  <td
                    className={`px-2 py-1.5 last:rounded-r-lg text-right font-black text-[11px] tabular-nums whitespace-nowrap opacity-60 ${isCurrent ? "text-white" : "text-slate-400"}`}
                  >
                    {econ}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  },
);
BowlingTable.displayName = "BowlingTable";

const Scoreboard: React.FC<ScoreboardProps> = ({
  currentInnings,
  previousInnings,
  onClose,
  onResetMatch,
  onQuitMatch,
  isSpectator = false,
  totalOvers,
  playerOfTheMatch,
}) => {
  const [activeTab, setActiveTab] = useState<"current" | "previous">("current");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const displayInnings =
    activeTab === "current" ? currentInnings : previousInnings;

  if (!displayInnings && activeTab === "previous") {
    setActiveTab("current");
  }

  const matchTotalOvers = Number(
    totalOvers && totalOvers > 0 ? totalOvers : 20,
  );
  const matchResult = previousInnings
    ? (() => {
        const i1 = previousInnings;
        const i2 = currentInnings;
        const i1Runs = Number(i1.totalRuns || 0);
        const i2Runs = Number(i2.totalRuns || 0);
        const i2Wickets = Number(i2.totalWickets || 0);
        const i2Overs = Number(i2.overs || 0);

        if (i2Runs > i1Runs) {
          return {
            text: `${i2.battingTeamName} WON BY ${10 - i2Wickets} WICKETS`,
            team: i2.battingTeamName,
          };
        } else if (
          i1Runs > i2Runs &&
          (i2Overs >= matchTotalOvers || i2Wickets >= 10 || i2.isCompleted)
        ) {
          return {
            text: `${i1.battingTeamName} WON BY ${i1Runs - i2Runs} RUNS`,
            team: i1.battingTeamName,
          };
        } else if (
          i1Runs === i2Runs &&
          (i2Overs >= matchTotalOvers || i2Wickets >= 10 || i2.isCompleted)
        ) {
          return { text: "MATCH TIED", team: "TIED" };
        }
        return null;
      })()
    : null;

  return (
    <div className="fixed inset-x-0 top-14 bottom-0 md:top-16 bg-slate-950/80 z-[400] flex items-center justify-center p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-white/10 rounded-[1.5rem] sm:rounded-[2.5rem] w-full max-w-5xl max-h-full md:max-h-[calc(100vh-8rem)] min-h-0 overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-500">
        {/* Header */}
        <div className="bg-slate-950 px-4 py-2.5 sm:px-6 sm:py-4 flex justify-between items-center shrink-0 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-6 sm:h-7 bg-indigo-600 rounded-full"></div>
            <h2 className="text-base sm:text-xl font-black uppercase tracking-tighter italic text-white flex items-center gap-2">
              Match <span className="text-indigo-500">Scorecard</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close scorecard"
            className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-all active:scale-95 text-white font-bold text-xl sm:text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-950/50 p-1 sm:p-1.5 shrink-0 border-b border-white/5">
          {previousInnings && (
            <button
              onClick={() => setActiveTab("previous")}
              className={`flex-1 py-2 sm:py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] italic transition-all ${activeTab === "previous" ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/20" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
            >
              {previousInnings.battingTeamName} (Inns 1)
            </button>
          )}
          <button
            onClick={() => setActiveTab("current")}
            className={`flex-1 py-2 sm:py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] italic transition-all ${activeTab === "current" ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/20" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
          >
            {currentInnings.battingTeamName} (Inns {currentInnings.inningNumber}
            )
          </button>
        </div>

        {/* Result Highlight */}
        {matchResult && (
          <div className="bg-indigo-600 shrink-0 px-4 py-2 sm:py-2.5 text-center overflow-hidden relative shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
            <div className="relative z-10 flex flex-col items-center justify-center px-2">
              <span className="text-[8px] sm:text-[9px] font-black text-indigo-100 uppercase tracking-[0.4em] opacity-80 mb-0.5 leading-none">
                🏆 MATCH RESULT
              </span>
              <span className="max-w-full text-sm sm:text-lg font-black text-white uppercase tracking-tighter italic drop-shadow-lg leading-tight break-words">
                <HighlightedResult
                  text={matchResult.text}
                  teamClassName="text-yellow-300"
                />
              </span>
              {playerOfTheMatch && (
                <span className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-200 text-[10px] sm:text-xs font-black uppercase tracking-wider">
                  <span>🏆</span> POTM: {playerOfTheMatch}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        {displayInnings ? (
          <div
            ref={contentRef}
            className="min-h-0 flex-1 p-3 sm:p-5 overflow-y-auto overscroll-contain pb-12 scrollbar-hide space-y-3 sm:space-y-4"
          >
            {playerOfTheMatch && !matchResult && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 sm:px-5 sm:py-3 flex items-center gap-3">
                <span className="text-xl sm:text-2xl">🏆</span>
                <div>
                  <div className="text-[9px] sm:text-xs font-black uppercase tracking-[0.3em] text-amber-300">
                    Player of the Match
                  </div>
                  <div className="text-xs sm:text-base font-black text-amber-100 uppercase tracking-tight italic">
                    {playerOfTheMatch}
                  </div>
                </div>
              </div>
            )}

            {/* Target & Chase Status Banner in Innings 2 */}
            {(() => {
              const isChasing =
                activeTab === "current" &&
                (Boolean(previousInnings) || displayInnings.inningNumber === 2);
              if (!isChasing) {
                if (activeTab === "previous" && !matchResult) {
                  const setTarget = Number(displayInnings.totalRuns || 0) + 1;
                  return (
                    <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-2 sm:p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm sm:text-base">📋</span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                          1st Innings Total:{" "}
                          <span className="font-black text-white">
                            {displayInnings.totalRuns}/
                            {displayInnings.totalWickets}
                          </span>
                        </span>
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-black uppercase text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        Sets Target: {setTarget}
                      </span>
                    </div>
                  );
                }
                return null;
              }

              const target =
                displayInnings.target ||
                (previousInnings
                  ? Number(previousInnings.totalRuns || 0) + 1
                  : null);
              if (target === null) return null;

              const runsNeeded = target - Number(displayInnings.totalRuns || 0);
              const totalBalls = Number(totalOvers || 20) * 6;
              const ballsBowled =
                Number(displayInnings.overs || 0) * 6 +
                Number(displayInnings.balls || 0);
              const ballsLeft = Math.max(0, totalBalls - ballsBowled);

              // Suppress Target Equation when match is complete or target already reached (avoids duplicate info with Match Result)
              if (matchResult || runsNeeded <= 0) return null;

              return (
                <div className="rounded-xl sm:rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-slate-900/60 p-2.5 sm:p-3.5 flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <span className="text-lg sm:text-xl">🎯</span>
                    <div>
                      <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.25em] text-amber-400/80">
                        Target Equation
                      </div>
                      <div className="text-xs sm:text-sm font-black uppercase tracking-tight text-amber-200 mt-0.5">
                        Need {runsNeeded} runs off {ballsLeft} balls
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.25em] text-amber-400/80">
                      Target
                    </div>
                    <div className="text-base sm:text-lg font-black tabular-nums text-amber-300">
                      {target}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Batting Section */}
            <div>
              <div className="flex justify-between items-center mb-2 sm:mb-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-indigo-400 italic">
                    Batting Performance
                  </span>
                </div>
                <div className="text-right flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-white tabular-nums tracking-tighter italic">
                    {displayInnings.totalRuns}
                    <span className="text-slate-700 mx-0.5">/</span>
                    {displayInnings.totalWickets}
                  </span>
                  <span className="text-[11px] font-black text-slate-500 bg-white/5 px-1.5 py-0.5 rounded uppercase tracking-tighter tabular-nums flex items-baseline gap-0.5">
                    <span>
                      {displayInnings.overs}.{displayInnings.balls}
                    </span>
                    {totalOvers && (
                      <>
                        <span className="text-[9px] opacity-40">/</span>
                        <span>{totalOvers}</span>
                      </>
                    )}
                    <span className="ml-0.5 text-[9px] opacity-50">OVS</span>
                  </span>
                </div>
              </div>
              <BattingTable
                players={displayInnings.players}
                order={displayInnings.battingOrder}
                strikerId={displayInnings.strikerId}
                nonStrikerId={displayInnings.nonStrikerId}
                isCompleted={displayInnings.isCompleted}
                isCurrentTab={activeTab === "current"}
              />
            </div>

            {/* Bowling Section */}
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-2 sm:mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] text-slate-400 tracking-[0.15em] uppercase">
                    {displayInnings.bowlingTeamName}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-indigo-400 italic">
                    Bowling
                  </span>
                </div>
              </div>
              <BowlingTable
                bowlers={displayInnings.bowlers}
                order={displayInnings.bowlingOrder}
                currentBowlerId={displayInnings.currentBowlerId}
                isCurrentTab={activeTab === "current"}
              />
            </div>

            {/* Fall of Wickets / Partnerships */}
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-2 sm:mb-3">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-indigo-400 italic">
                  Partnerships
                </span>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                      <th className="px-2 pb-2 w-16">Wkt</th>
                      <th className="px-2 pb-2">Runs (Balls)</th>
                      <th className="px-2 pb-2">Dismissed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPartnerships(displayInnings.allBalls).length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="text-[10px] text-slate-500 text-center py-2 uppercase"
                        >
                          No partnerships yet
                        </td>
                      </tr>
                    )}
                    {getPartnerships(displayInnings.allBalls).map((p, idx) => (
                      <tr key={idx} className="bg-white/5">
                        <td className="px-2 py-2 rounded-l-xl font-black text-xs text-slate-400">
                          {p.wicketNumber}
                        </td>
                        <td className="px-2 py-2 font-black text-indigo-300">
                          {p.runs}{" "}
                          <span className="text-slate-500 text-[10px] ml-1">
                            ({p.balls})
                          </span>
                        </td>
                        <td className="px-2 py-2 rounded-r-xl font-bold text-[10px] text-slate-300 uppercase tracking-widest">
                          {p.outBatterName || "Unbroken"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ball by Ball Timeline */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 italic">
                  Innings Timeline (Ball by Ball)
                </span>
              </div>
              <div className="space-y-3">
                {(() => {
                  const overs: Record<number, any[]> = {};
                  displayInnings.allBalls.forEach((ball) => {
                    if (!overs[ball.overNumber]) overs[ball.overNumber] = [];
                    overs[ball.overNumber].push(ball);
                  });

                  return Object.entries(overs)
                    .sort(([a], [b]) => Number(b) - Number(a))
                    .map(([overNum, balls]) => {
                      const bowler = balls[0]?.bowlerName || "---";
                      return (
                        <div
                          key={overNum}
                          className="bg-white/5 border border-white/5 rounded-2xl p-4 hover:bg-white/10 transition-colors"
                        >
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-indigo-400 uppercase italic">
                                Over {Number(overNum) + 1}
                              </span>
                              <span className="w-1 h-3 bg-slate-700 rounded-full"></span>
                              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">
                                {bowler}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {balls.map((ball: any, idx: number) => {
                              const isRetHurt =
                                ball.wicketType === "RETIRED_HURT";
                              const isWicket = ball.isWicket;
                              const isExtra = ball.isExtra;
                              let label = String(ball.runs);
                              if (isWicket || isRetHurt) {
                                label = ball.runs > 0 ? `W+${ball.runs}` : "W";
                              } else if (ball.extraType === "WIDE") {
                                label =
                                  ball.runs > 0 ? `Wd+${ball.runs}` : "Wd";
                              } else if (ball.extraType === "NO_BALL") {
                                label =
                                  ball.runs > 0 ? `Nb+${ball.runs}` : "Nb";
                              } else if (ball.extraType === "BYE") {
                                label = ball.runs > 0 ? `B+${ball.runs}` : "B";
                              } else if (ball.extraType === "LEG_BYE") {
                                label =
                                  ball.runs > 0 ? `Lb+${ball.runs}` : "Lb";
                              }

                              return (
                                <div
                                  key={idx}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${isRetHurt ? "bg-amber-500 text-amber-950 shadow-lg shadow-amber-500/30 border border-amber-300" : isWicket ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : isExtra ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" : "bg-slate-800 text-slate-300"}`}
                                >
                                  {label}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>
            </div>

            {/* Extras & Reset Footer */}
            <div className="bg-white/5 rounded-[2rem] p-8 border border-white/5 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -z-10 group-hover:bg-indigo-500/20 transition-all"></div>

              <div className="flex flex-wrap items-center justify-between gap-8">
                <div className="flex gap-12">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                      Innings Total
                    </span>
                    <span className="text-2xl font-black text-white italic uppercase tracking-tighter">
                      {displayInnings.totalRuns} Runs
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      let w = 0,
                        nb = 0,
                        b = 0,
                        lb = 0;
                      displayInnings.allBalls.forEach((ball) => {
                        const extraR = Number(
                          ball.extraRuns !== undefined
                            ? ball.extraRuns
                            : (ball as any).extra_runs || 0,
                        );
                        const r = Number(ball.runs || 0);
                        const totalBallRuns = extraR + r;
                        if (ball.extraType === ExtraType.WIDE)
                          w += totalBallRuns;
                        if (ball.extraType === ExtraType.NO_BALL)
                          nb += totalBallRuns;
                        if (ball.extraType === ExtraType.BYE)
                          b += totalBallRuns;
                        if (ball.extraType === ExtraType.LEG_BYE)
                          lb += totalBallRuns;
                      });
                      return (
                        <>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                            Extras Total: {w + nb + b + lb}
                          </span>
                          <div className="flex gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                            <span className="bg-white/5 px-2 py-0.5 rounded">
                              WD: {w}
                            </span>
                            <span className="bg-white/5 px-2 py-0.5 rounded">
                              NB: {nb}
                            </span>
                            <span className="bg-white/5 px-2 py-0.5 rounded">
                              B: {b}
                            </span>
                            <span className="bg-white/5 px-2 py-0.5 rounded">
                              LB: {lb}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                {!isSpectator && onResetMatch && activeTab === "current" && (
                  <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap gap-4 items-center justify-center">
                    <button
                      onClick={() => {
                        onClose();
                        onResetMatch();
                      }}
                      className="py-3 px-8 rounded-full bg-indigo-900/40 text-indigo-400 font-black text-xs uppercase tracking-widest border border-indigo-500/20 active:scale-95 transition-transform hover:bg-indigo-900/60"
                    >
                      START NEW MATCH
                    </button>
                    {onQuitMatch && (
                      <button
                        onClick={() => {
                          onClose();
                          onQuitMatch();
                        }}
                        className="py-3 px-8 rounded-full bg-rose-900/40 text-rose-400 font-black text-xs uppercase tracking-widest border border-rose-500/20 active:scale-95 transition-transform hover:bg-rose-900/60"
                      >
                        QUIT MATCH
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-32 text-center text-slate-600 font-black uppercase italic tracking-[0.5em] opacity-20">
            Secure Data Lost
          </div>
        )}
      </div>
    </div>
  );
};

export default Scoreboard;
