import React, { useEffect, useState } from "react";

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
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeBattingTeam = battingTeam || teamA;
  const activeBowlingTeam =
    bowlingTeam || (activeBattingTeam === teamA ? teamB : teamA);

  const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://api.cricscoredev.venkateshsingamsetty.com";

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

    if (teamA && teamB) {
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

  if (loading)
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

  if (compact) {
    return (
      <div className="flex flex-col gap-1 mt-1.5 w-full">
        <div className="flex items-center justify-between w-full">
          <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">
            🤖 Win Prediction
          </span>
          <span className="text-[8px] font-bold text-slate-400 uppercase">
            {prediction.team1}{" "}
            {Math.round(prediction.team1WinProbability * 100)}% -{" "}
            {Math.round(prediction.team2WinProbability * 100)}%{" "}
            {prediction.team2}
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-slate-700/50">
          <div
            className="bg-emerald-500 h-full transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
            style={{ width: `${prediction.team1WinProbability * 100}%` }}
          ></div>
          <div
            className="bg-rose-500 h-full transition-all duration-1000 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
            style={{ width: `${prediction.team2WinProbability * 100}%` }}
          ></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-4 mt-4 shadow-inner">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
          <span>🤖</span> AI Match Prediction
        </h3>
        <span className="text-[8px] text-slate-500 border border-slate-700/50 px-1.5 py-0.5 rounded uppercase">
          Model: {prediction.modelVersion}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-xs font-bold text-white">
          <span>{prediction.team1}</span>
          <span>{prediction.team2}</span>
        </div>

        <div className="w-full h-2 rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500 h-full transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
            style={{ width: `${prediction.team1WinProbability * 100}%` }}
          ></div>
          <div
            className="bg-rose-500 h-full transition-all duration-1000 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
            style={{ width: `${prediction.team2WinProbability * 100}%` }}
          ></div>
        </div>

        <div className="flex justify-between text-[10px] text-slate-400 font-black">
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

        <div className="text-center mt-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest italic">
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
