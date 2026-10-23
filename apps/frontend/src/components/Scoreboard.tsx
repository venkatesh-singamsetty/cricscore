import React, { useState, useRef, useEffect } from "react";
import HighlightedResult from "./HighlightedResult";
import { InningsState, Player, Bowler, ExtraType } from "../types";
import { getPartnerships } from "../utils/partnershipUtils";
import {
  calculateStrikeRate,
  calculateStrikeRateNumber,
  calculateEconomy,
  calculateEconomyNumber,
  resolvePOTM,
} from "../utils/scorecardUtils";

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

    const isPlayerBatted = (id: string) => {
      const player = players?.[id];
      if (!player) return false;
      return (
        player.ballsFaced > 0 ||
        player.isOut ||
        player.wicketType === "RETIRED_HURT" ||
        player.wicketType === "RETIRED_OUT" ||
        id === strikerId ||
        id === nonStrikerId
      );
    };

    const initialBatted = effectiveOrder.filter(isPlayerBatted);
    // If nobody has batted yet, default to first 2 in order as openers
    const displayBattedOrder =
      initialBatted.length > 0
        ? initialBatted
        : effectiveOrder.slice(0, Math.min(2, effectiveOrder.length));

    const unbattedOrder = effectiveOrder.filter(
      (id) => !displayBattedOrder.includes(id),
    );

    return (
      <div className="space-y-2">
        <div className="overflow-x-auto -mx-1 sm:mx-0">
          <table className="w-full text-left border-separate border-spacing-y-0.5 sm:border-spacing-y-1">
            <thead>
              <tr className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="px-2.5 py-1 sm:py-1.5 whitespace-nowrap">
                  Batter
                </th>
                <th className="px-2 py-1 sm:py-1.5 whitespace-nowrap">
                  Status
                </th>
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
              {displayBattedOrder.map((id) => {
                const player = players?.[id];
                if (!player) return null;
                const isStriker = id === strikerId;
                const isNonStriker = id === nonStrikerId;
                const highlight = isCurrentTab && (isStriker || isNonStriker);
                const sr = calculateStrikeRate(player.runs, player.ballsFaced);
                const srNum = calculateStrikeRateNumber(
                  player.runs,
                  player.ballsFaced,
                );
                const srColor = highlight
                  ? "text-white"
                  : srNum >= 180
                    ? "text-amber-300 font-black"
                    : srNum >= 130
                      ? "text-emerald-400 font-bold"
                      : "text-indigo-400";

                return (
                  <tr
                    key={id}
                    className={`group transition-all duration-300 ${
                      highlight
                        ? "bg-indigo-600/35 border-y border-indigo-400/50 shadow-lg shadow-indigo-600/20 backdrop-blur-sm"
                        : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <td
                      className={`px-2.5 py-2 first:rounded-l-lg font-black uppercase tracking-tight text-xs sm:text-sm whitespace-nowrap ${
                        highlight ? "text-white" : "text-slate-100"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 font-extrabold text-white text-xs sm:text-sm tracking-tight">
                        {player.name}
                        {isStriker && (
                          <span className="text-amber-300 animate-pulse text-xs">
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
                      {player.isOut || player.wicketType === "RETIRED_HURT" ? (
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
                            <span className="text-red-400 font-black uppercase tracking-tight whitespace-nowrap drop-shadow-sm">
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
                        highlight ? "text-white" : "text-slate-100"
                      }`}
                    >
                      {player.runs}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right font-black text-[11px] tabular-nums whitespace-nowrap ${
                        highlight ? "text-indigo-200" : "text-slate-400"
                      }`}
                    >
                      {player.ballsFaced}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right font-black text-[11px] tabular-nums whitespace-nowrap ${
                        highlight
                          ? "text-white"
                          : player.fours > 0
                            ? "text-sky-400 font-bold"
                            : "text-slate-400"
                      }`}
                    >
                      {player.fours}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right font-black text-[11px] tabular-nums whitespace-nowrap ${
                        highlight
                          ? "text-white"
                          : player.sixes > 0
                            ? "text-amber-400 font-extrabold"
                            : "text-slate-400"
                      }`}
                    >
                      {player.sixes}
                    </td>
                    <td
                      className={`px-2 py-1.5 last:rounded-r-lg text-right font-black text-[11px] tabular-nums whitespace-nowrap ${srColor}`}
                    >
                      {sr}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {unbattedOrder.length > 0 && (
          <div className="px-3 py-2 bg-slate-800/80 border border-white/10 rounded-xl sm:rounded-2xl flex items-center gap-2 flex-wrap shadow-sm">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 italic shrink-0">
              {isCompleted ? "DID NOT BAT:" : "YET TO BAT:"}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {unbattedOrder.map((id) => (
                <span
                  key={id}
                  className="px-2 py-0.5 rounded-lg bg-slate-900/80 border border-white/10 text-[10px] sm:text-[11px] font-bold text-slate-200 tracking-tight shadow-sm whitespace-nowrap"
                >
                  {players[id]?.name || id}
                </span>
              ))}
            </div>
          </div>
        )}
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

              const econ = calculateEconomy(
                bowler.runsConceded,
                bowler.overs,
                bowler.balls,
              );
              const econNum = calculateEconomyNumber(
                bowler.runsConceded,
                bowler.overs,
                bowler.balls,
              );
              const isCurrent = isCurrentTab && id === currentBowlerId;
              const econColor = isCurrent
                ? "text-white"
                : econNum > 0 && econNum <= 6.0
                  ? "text-emerald-400 font-bold"
                  : econNum >= 10.0
                    ? "text-amber-400 font-bold"
                    : "text-slate-300";

              return (
                <tr
                  key={id}
                  className={`group transition-all duration-300 ${isCurrent ? "bg-indigo-600/35 border-y border-indigo-400/50 shadow-lg shadow-indigo-600/20 backdrop-blur-sm" : "bg-white/5 hover:bg-white/10"}`}
                >
                  <td
                    className={`px-2.5 py-2 first:rounded-l-lg font-black uppercase tracking-tight text-xs sm:text-sm whitespace-nowrap ${isCurrent ? "text-white" : "text-slate-100"}`}
                  >
                    <span className="inline-flex items-center gap-1.5 font-extrabold text-white text-xs sm:text-sm tracking-tight">
                      {bowler.name}
                      {isCurrent && (
                        <span className="text-amber-300 animate-pulse text-xs">
                          ⚡
                        </span>
                      )}
                    </span>
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
                    className={`px-2 py-1.5 text-right font-black text-xs sm:text-sm tabular-nums whitespace-nowrap ${isCurrent ? "text-white" : bowler.wickets > 0 ? "text-indigo-300 font-black" : "text-slate-400"}`}
                  >
                    {bowler.wickets}
                  </td>
                  <td
                    className={`px-2 py-1.5 last:rounded-r-lg text-right font-black text-[11px] tabular-nums whitespace-nowrap ${econColor}`}
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
          const marginW = 10 - i2Wickets;
          return {
            text: `${i2.battingTeamName} WON BY ${marginW} ${marginW === 1 ? "WICKET" : "WICKETS"}`,
            team: i2.battingTeamName,
          };
        } else if (
          i1Runs > i2Runs &&
          (i2Overs >= matchTotalOvers || i2Wickets >= 10 || i2.isCompleted)
        ) {
          const marginR = i1Runs - i2Runs;
          return {
            text: `${i1.battingTeamName} WON BY ${marginR} ${marginR === 1 ? "RUN" : "RUNS"}`,
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

  const isMatchFinished =
    Boolean(matchResult) ||
    Boolean(
      currentInnings?.isCompleted &&
      (previousInnings || currentInnings.inningNumber === 2),
    );

  const effectivePOTM =
    isMatchFinished || playerOfTheMatch
      ? resolvePOTM(
          [previousInnings, currentInnings].filter(Boolean) as InningsState[],
          playerOfTheMatch,
        )
      : null;

  return (
    <div className="fixed inset-x-0 top-14 bottom-0 md:top-16 bg-slate-950/85 z-[400] flex items-center justify-center p-2 sm:p-4 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] sm:rounded-[2.5rem] w-full max-w-5xl max-h-full md:max-h-[calc(100vh-8rem)] min-h-0 overflow-hidden flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-500">
        {/* Subtle glossy glow background elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-3xl pointer-events-none -z-10"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 blur-3xl pointer-events-none -z-10"></div>

        {/* Header */}
        <div className="bg-slate-950/70 backdrop-blur-md px-4 py-2.5 sm:px-6 sm:py-4 flex justify-between items-center shrink-0 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-6 sm:h-7 bg-gradient-to-b from-indigo-500 to-blue-500 rounded-full shadow-md shadow-indigo-500/50"></div>
            <h2 className="text-base sm:text-xl font-black uppercase tracking-tighter italic text-white flex items-center gap-2">
              Match{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
                Scorecard
              </span>
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close scorecard"
            className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center transition-all active:scale-95 text-white font-bold text-xl sm:text-2xl shadow-sm"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-950/50 backdrop-blur-md p-1 sm:p-2 shrink-0 border-b border-white/10 gap-1 sm:gap-2">
          {previousInnings && (
            <button
              onClick={() => setActiveTab("previous")}
              className={`flex-1 min-w-0 py-1.5 sm:py-2 px-1 sm:px-2.5 rounded-lg sm:rounded-xl text-[9.5px] xs:text-[10.5px] sm:text-xs font-bold sm:font-black uppercase tracking-tight italic transition-all flex items-center justify-between gap-1 sm:gap-1.5 ${
                activeTab === "previous"
                  ? "bg-gradient-to-r from-indigo-600/90 to-blue-600/90 border border-indigo-400/40 text-white shadow-lg shadow-indigo-600/30 backdrop-blur-md"
                  : "bg-slate-800/50 border border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              <span className="flex-1 min-w-0 text-left truncate whitespace-nowrap block">
                {previousInnings.battingTeamName} (Inns 1)
              </span>
              <span
                className={`px-1 py-0.5 rounded text-[9px] sm:text-[10px] font-black tabular-nums border shrink-0 ${
                  activeTab === "previous"
                    ? "bg-black/40 border-white/20 text-white"
                    : "bg-black/20 border-white/5 text-slate-400"
                }`}
              >
                {previousInnings.totalRuns}/{previousInnings.totalWickets}
              </span>
            </button>
          )}
          <button
            onClick={() => setActiveTab("current")}
            className={`flex-1 min-w-0 py-1.5 sm:py-2 px-1 sm:px-2.5 rounded-lg sm:rounded-xl text-[9.5px] xs:text-[10.5px] sm:text-xs font-bold sm:font-black uppercase tracking-tight italic transition-all flex items-center justify-between gap-1 sm:gap-1.5 ${
              activeTab === "current"
                ? "bg-gradient-to-r from-indigo-600/90 to-blue-600/90 border border-indigo-400/40 text-white shadow-lg shadow-indigo-600/30 backdrop-blur-md"
                : "bg-slate-800/50 border border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
            }`}
          >
            <span className="flex-1 min-w-0 text-left truncate whitespace-nowrap block">
              {currentInnings.battingTeamName} (Inns{" "}
              {currentInnings.inningNumber})
            </span>
            <span
              className={`px-1 py-0.5 rounded text-[9px] sm:text-[10px] font-black tabular-nums border shrink-0 ${
                activeTab === "current"
                  ? "bg-black/40 border-white/20 text-white"
                  : "bg-black/20 border-white/5 text-slate-400"
              }`}
            >
              {currentInnings.totalRuns}/{currentInnings.totalWickets}
            </span>
          </button>
        </div>

        {/* Result Highlight */}
        {matchResult && (
          <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-indigo-950/80 border-b border-amber-500/30 shrink-0 px-4 py-2.5 sm:py-3 text-center overflow-hidden relative shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
            <div className="relative z-10 flex flex-col items-center justify-center px-2">
              <span className="text-[8px] sm:text-[9px] font-black text-amber-400 uppercase tracking-[0.4em] opacity-90 mb-0.5 leading-none flex items-center gap-1.5">
                <span>🏆</span> MATCH RESULT
              </span>
              <span className="max-w-full text-sm sm:text-lg font-black text-white uppercase tracking-tight italic drop-shadow-md leading-tight break-words">
                <HighlightedResult
                  text={matchResult.text}
                  teamClassName="text-amber-300 font-extrabold"
                />
              </span>
              {effectivePOTM && (
                <span className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-sm">
                  <span>🎖️</span> POTM: {effectivePOTM}
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
            {effectivePOTM && !matchResult && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 sm:px-5 sm:py-3 flex items-center gap-3">
                <span className="text-xl sm:text-2xl">🏆</span>
                <div>
                  <div className="text-[9px] sm:text-xs font-black uppercase tracking-[0.3em] text-amber-300">
                    Player of the Match
                  </div>
                  <div className="text-xs sm:text-base font-black text-amber-100 uppercase tracking-tight italic">
                    {effectivePOTM}
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
              <div className="bg-slate-800/80 border border-white/10 rounded-2xl p-4 overflow-x-auto shadow-lg backdrop-blur-sm">
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
                      <tr
                        key={idx}
                        className="bg-slate-900/60 hover:bg-slate-900/90 transition-colors"
                      >
                        <td className="px-2 py-2 rounded-l-xl font-black text-xs text-slate-400 whitespace-nowrap">
                          {p.wicketNumber}
                        </td>
                        <td className="px-2 py-2 font-black text-indigo-300 whitespace-nowrap">
                          {p.runs}{" "}
                          <span className="text-slate-500 text-[10px] ml-1">
                            ({p.balls})
                          </span>
                        </td>
                        <td className="px-2 py-2 rounded-r-xl font-bold text-[10px] text-slate-300 uppercase tracking-widest whitespace-nowrap">
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
                          className="bg-slate-800/80 border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-all shadow-md"
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
                          <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
                            {balls.map((ball: any, idx: number) => {
                              const isRetHurt =
                                ball.wicketType === "RETIRED_HURT";
                              const isWicket = Boolean(ball.isWicket);
                              const isExtra = Boolean(ball.isExtra);
                              const runs = Number(ball.runs || 0);

                              let label = String(runs);
                              let badgeStyle =
                                "bg-slate-800/90 text-slate-200 border border-white/10";
                              let deliveryDesc = `${runs} run${runs === 1 ? "" : "s"}`;

                              if (isRetHurt) {
                                label = "RH";
                                badgeStyle =
                                  "bg-amber-500/25 text-amber-300 border-2 border-amber-400 shadow-md shadow-amber-500/20";
                                deliveryDesc = "Retired Hurt";
                              } else if (isWicket && (runs > 0 || isExtra)) {
                                label = `W+${runs}`;
                                badgeStyle =
                                  "bg-gradient-to-br from-red-600 to-rose-700 text-white border-2 border-amber-400 shadow-md shadow-red-600/30 ring-1 ring-amber-400/70 font-black";
                                deliveryDesc = `Wicket + ${runs} run${runs === 1 ? "" : "s"}`;
                              } else if (isWicket) {
                                label = "W";
                                badgeStyle =
                                  "bg-red-600 text-white border-2 border-red-400 shadow-md shadow-red-600/30 font-black";
                                deliveryDesc = "Wicket";
                              } else if (ball.extraType === "WIDE") {
                                label = runs > 0 ? `WD+${runs}` : "WD";
                                badgeStyle =
                                  "bg-amber-500/20 text-amber-300 border-2 border-amber-400/90 shadow-sm font-black";
                                deliveryDesc = `Wide${runs > 0 ? ` + ${runs}` : ""}`;
                              } else if (ball.extraType === "NO_BALL") {
                                label = runs > 0 ? `NB+${runs}` : "NB";
                                badgeStyle =
                                  "bg-purple-500/20 text-purple-300 border-2 border-purple-400/90 shadow-sm font-black";
                                deliveryDesc = `No Ball${runs > 0 ? ` + ${runs}` : ""}`;
                              } else if (ball.extraType === "BYE") {
                                label = runs > 0 ? `B+${runs}` : "B";
                                badgeStyle =
                                  "bg-sky-500/20 text-sky-300 border border-sky-400/60 font-bold";
                                deliveryDesc = `Bye${runs > 0 ? ` (${runs})` : ""}`;
                              } else if (ball.extraType === "LEG_BYE") {
                                label = runs > 0 ? `LB+${runs}` : "LB";
                                badgeStyle =
                                  "bg-indigo-500/20 text-indigo-300 border border-indigo-400/60 font-bold";
                                deliveryDesc = `Leg Bye${runs > 0 ? ` (${runs})` : ""}`;
                              } else if (runs === 4) {
                                label = "4";
                                badgeStyle =
                                  "bg-sky-500/25 text-sky-300 border-2 border-sky-400/80 font-black shadow-sm";
                                deliveryDesc = "Boundary 4";
                              } else if (runs === 6) {
                                label = "6";
                                badgeStyle =
                                  "bg-emerald-500/25 text-emerald-300 border-2 border-emerald-400/80 font-black shadow-sm";
                                deliveryDesc = "Sixer 6";
                              } else if (runs === 0) {
                                label = "0";
                                badgeStyle =
                                  "bg-slate-900/90 text-slate-400 border border-white/10";
                                deliveryDesc = "Dot ball";
                              }

                              return (
                                <div
                                  key={idx}
                                  title={`Ball ${idx + 1}: ${deliveryDesc}`}
                                  className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-lg flex items-center justify-center text-[9px] sm:text-[10px] font-black tabular-nums transition-all ${badgeStyle}`}
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
            <div className="bg-slate-800/80 rounded-2xl sm:rounded-[2rem] p-3 sm:p-5 md:p-6 border border-white/10 backdrop-blur-xl relative overflow-hidden group shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -z-10 group-hover:bg-indigo-500/20 transition-all"></div>

              <div className="flex flex-row flex-nowrap items-center justify-between gap-2 sm:gap-6 w-full">
                <div className="space-y-0.5 min-w-0 shrink-0">
                  <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                    Innings Total
                  </span>
                  <div className="whitespace-nowrap flex items-baseline gap-1 sm:gap-1.5">
                    <span className="text-xl sm:text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter tabular-nums">
                      {displayInnings.totalRuns}
                    </span>
                    <span className="text-[11px] sm:text-xs font-black text-indigo-400 uppercase tracking-wider">
                      RUNS
                    </span>
                    <span className="text-slate-400 text-[10px] sm:text-xs font-bold whitespace-nowrap">
                      ({displayInnings.totalWickets} wkts,{" "}
                      {displayInnings.overs}.{displayInnings.balls} ov)
                    </span>
                  </div>
                </div>
                <div className="space-y-0.5 min-w-0 shrink-0 text-right">
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
                      if (ball.extraType === ExtraType.WIDE) w += totalBallRuns;
                      if (ball.extraType === ExtraType.NO_BALL)
                        nb += totalBallRuns;
                      if (ball.extraType === ExtraType.BYE) b += totalBallRuns;
                      if (ball.extraType === ExtraType.LEG_BYE)
                        lb += totalBallRuns;
                    });
                    return (
                      <>
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest block whitespace-nowrap">
                          Extras: {w + nb + b + lb}
                        </span>
                        <div className="flex flex-nowrap items-center justify-end gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] font-bold text-indigo-400 uppercase tracking-wider overflow-x-auto scrollbar-hide">
                          <span className="bg-white/5 border border-white/5 px-1 sm:px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
                            WD: {w}
                          </span>
                          <span className="bg-white/5 border border-white/5 px-1 sm:px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
                            NB: {nb}
                          </span>
                          <span className="bg-white/5 border border-white/5 px-1 sm:px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
                            B: {b}
                          </span>
                          <span className="bg-white/5 border border-white/5 px-1 sm:px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
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
