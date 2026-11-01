import React, { useEffect, useState } from "react";
import {
  getTeamBrandColor,
  getTeamGlow,
  TEAM_BRAND_COLORS,
} from "../utils/teamColorUtils";

interface AiMatchPredictionProps {
  matchId: string;
  teamA: string;
  teamB: string;
  totalOvers: number;
  compact?: boolean;
  inning?: number;
  currentScore?: number;
  wicketsLost?: number;
  targetScore?: number;
  ballsBowled?: number;
  battingTeam?: string;
  bowlingTeam?: string;
}

interface PredictionData {
  team1: string;
  team2: string;
  team1WinProbability: number;
  team2WinProbability: number;
  predictedWinner: string;
  modelVersion: string;
}

export const AiMatchPrediction: React.FC<AiMatchPredictionProps> = ({
  teamA,
  teamB,
  totalOvers,
  compact = false,
  inning = 1,
  currentScore = 0,
  wicketsLost = 0,
  targetScore = -1,
  ballsBowled = 0,
  battingTeam,
  bowlingTeam,
}) => {
  const activeBattingTeam = battingTeam || teamA;
  const activeBowlingTeam =
    bowlingTeam || (activeBattingTeam === teamA ? teamB : teamA);

  const [prediction, setPrediction] = useState<PredictionData | null>(() => {
    // Provide instant 50-50 baseline at match inception so UI renders immediately
    if (
      inning === 1 &&
      currentScore === 0 &&
      wicketsLost === 0 &&
      ballsBowled === 0 &&
      teamA &&
      teamB
    ) {
      return {
        team1: activeBattingTeam,
        team2: activeBowlingTeam,
        team1WinProbability: 0.5,
        team2WinProbability: 0.5,
        predictedWinner: "Balanced (50-50)",
        modelVersion: "baseline-50-50",
      };
    }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || "";

  useEffect(() => {
    let isMounted = true;
    const fetchPrediction = async () => {
      setLoading(true);
      try {
        const ballsLeft = Math.max(0, totalOvers * 6 - ballsBowled);

        // Impossible Chase Override (2nd Innings)
        // Batting team cannot achieve target -> Batting team gets 0%, Bowling team gets 100%
        if (inning === 2 && targetScore > 0) {
          const runsNeeded = targetScore - currentScore;
          // Assume max 6 runs per ball. If runsNeeded > ballsLeft * 6, it's mathematically impossible
          if (runsNeeded > ballsLeft * 6) {
            if (isMounted) {
              setPrediction({
                team1: activeBattingTeam,
                team2: activeBowlingTeam,
                team1WinProbability: 0.0,
                team2WinProbability: 1.0,
                predictedWinner: activeBowlingTeam,
                modelVersion: "override-v1",
              });
              setLoading(false);
            }
            return; // Skip calling the API
          }
        }

        const response = await fetch(`${API_URL}/match/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team1: activeBattingTeam,
            team2: activeBowlingTeam,
            venue: "Unknown",
            tossWinner: "Unknown",
            tossDecision: "Unknown",
            inning,
            currentScore,
            wicketsLost,
            targetScore,
            ballsLeft,
            ballsBowled,
          }),
        });
        if (!response.ok) throw new Error("Failed to fetch prediction");
        const data = await response.json();
        if (isMounted) setPrediction(data);
      } catch (err) {
        if (isMounted) setError("Prediction unavailable");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Skip transient states (no overs yet, or 2nd innings without a target)
    // and keep the last valid prediction instead of showing a bogus swing.
    const inputsReady = totalOvers > 0 && (inning !== 2 || targetScore > 0);
    if (teamA && teamB && inputsReady) {
      fetchPrediction();
    }

    return () => {
      isMounted = false;
    };
  }, [
    API_URL,
    teamA,
    teamB,
    activeBattingTeam,
    activeBowlingTeam,
    totalOvers,
    inning,
    currentScore,
    wicketsLost,
    targetScore,
    ballsBowled,
  ]);

  if (loading && !prediction)
    return (
      <div
        className={`text-[10px] text-slate-500 animate-pulse ${compact ? "mt-1" : ""}`}
      >
        🤖 Loading AI Prediction...
      </div>
    );
  if (error || !prediction) {
    if (compact) return null;
    return (
      <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-4 mt-4 shadow-inner">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
            <span>🤖</span> AI Match Prediction
          </h3>
        </div>
        <div className="text-[10px] text-red-400">
          ⚠️ {error || "Failed to load prediction data."}
        </div>
      </div>
    );
  }

  const p1 = Math.round(prediction.team1WinProbability * 100);
  const p2 = Math.round(prediction.team2WinProbability * 100);

  const norm = (s?: string) => (s || "").trim().toLowerCase();
  const isTeam1Batting = norm(prediction.team1) === norm(activeBattingTeam);

  // Map brand colors consistently: Chicago Spartans = #00D2FF (Cyan/Blue), Midwest Gladiators = #00F5A0 (Mint Green)
  const color1 = getTeamBrandColor(prediction.team1, teamA, teamB);
  let color2 = getTeamBrandColor(prediction.team2, teamA, teamB);
  if (color2 === color1) {
    color2 =
      color1 === TEAM_BRAND_COLORS.SPARTANS
        ? TEAM_BRAND_COLORS.GLADIATORS
        : TEAM_BRAND_COLORS.SPARTANS;
  }

  const glow1 = getTeamGlow(color1);
  const glow2 = getTeamGlow(color2);

  if (compact) {
    return (
      <div className="w-full bg-slate-800/60 p-2.5 sm:p-3 rounded-xl border border-white/10 shadow-sm flex flex-col gap-2 sm:gap-2.5">
        <span className="sr-only">
          {prediction.team1} {p1}% - {p2}% {prediction.team2}
        </span>
        {/* Percentages on outer edges with WIN PREDICTION centered (No team names) */}
        <div className="flex justify-between items-center text-xs sm:text-sm font-black tabular-nums tracking-wider leading-none">
          <span
            style={{ color: color1 }}
            className="font-black drop-shadow-sm flex items-center gap-1"
          >
            <span className="text-xs sm:text-sm select-none">
              {isTeam1Batting ? "🏏" : "🎾"}
            </span>
            <span>{p1}%</span>
          </span>
          <span className="text-slate-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-widest flex items-center gap-1">
            <span>🤖</span> WIN PREDICTION
          </span>
          <span
            style={{ color: color2 }}
            className="font-black drop-shadow-sm flex items-center gap-1"
          >
            <span className="text-xs sm:text-sm select-none">
              {isTeam1Batting ? "🎾" : "🏏"}
            </span>
            <span>{p2}%</span>
          </span>
        </div>
        {/* 2-Color Split Progress Bar */}
        <div className="flex h-2 sm:h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="transition-all duration-500"
            style={{
              width: `${prediction.team1WinProbability * 100}%`,
              backgroundColor: color1,
              boxShadow: glow1,
            }}
          />
          <div
            className="transition-all duration-500"
            style={{
              width: `${prediction.team2WinProbability * 100}%`,
              backgroundColor: color2,
              boxShadow: glow2,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-2.5 mt-2 shadow-inner">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
          <span>🤖</span> AI Match Prediction
        </h3>
        <span className="text-[8px] text-slate-500 border border-slate-700/50 px-1 py-0.5 rounded uppercase">
          Model: {prediction.modelVersion}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs font-black uppercase tracking-wider">
          <span
            style={{ color: color1 }}
            className="drop-shadow-sm flex items-center gap-1"
          >
            <span>{isTeam1Batting ? "🏏" : "🎾"}</span>
            <span>{prediction.team1}</span>
          </span>
          <span
            style={{ color: color2 }}
            className="drop-shadow-sm flex items-center gap-1"
          >
            <span>{isTeam1Batting ? "🎾" : "🏏"}</span>
            <span>{prediction.team2}</span>
          </span>
        </div>

        <div className="w-full h-1.5 rounded-full overflow-hidden flex">
          <div
            className="h-full transition-all duration-1000"
            style={{
              width: `${prediction.team1WinProbability * 100}%`,
              backgroundColor: color1,
              boxShadow: glow1,
            }}
          ></div>
          <div
            className="h-full transition-all duration-1000"
            style={{
              width: `${prediction.team2WinProbability * 100}%`,
              backgroundColor: color2,
              boxShadow: glow2,
            }}
          ></div>
        </div>

        <div className="flex justify-between text-[9px] text-slate-400 font-black">
          <span
            className={
              prediction.team1WinProbability > 0.5 ? "text-indigo-400" : ""
            }
          >
            {Math.round(prediction.team1WinProbability * 100)}%
          </span>
          <span
            className={
              prediction.team2WinProbability > 0.5 ? "text-slate-300" : ""
            }
          >
            {Math.round(prediction.team2WinProbability * 100)}%
          </span>
        </div>

        <div className="text-center mt-0.5">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest italic">
            Predicted Winner:{" "}
            <span className="text-white font-bold">
              {prediction.predictedWinner}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};
