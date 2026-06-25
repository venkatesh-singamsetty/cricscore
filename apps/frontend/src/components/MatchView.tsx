import React, { useState, useEffect, useRef } from "react";
import { InningsState, BallEvent, ExtraType, WicketType } from "../types";
import Scoreboard from "./Scoreboard";
import { FielderSelectModal } from "./MatchView/FielderSelectModal";
import { WicketTypeModal } from "./MatchView/WicketTypeModal";
import { RetireModal } from "./MatchView/RetireModal";
import { RunOutModal } from "./MatchView/RunOutModal";
import { BatterSelectModal } from "./MatchView/BatterSelectModal";
import { BowlerSelectModal } from "./MatchView/BowlerSelectModal";
import { ExtraRunsModal } from "./MatchView/ExtraRunsModal";

interface MatchViewProps {
  initialState: InningsState;
  previousInnings?: InningsState;
  totalOvers: number;
  matchId: string; // Dynamic ID
  onInningsEnd: (innings: InningsState) => void;
  onResetMatch: () => void;
  onForceReset?: () => void;
  onUpdateOvers?: (overs: number) => void;
  onStateChange?: (state: InningsState) => void;
}

type ModalType =
  | "NONE"
  | "WICKET_TYPE"
  | "BATTER_SELECT"
  | "BOWLER_SELECT"
  | "FIELDER_SELECT"
  | "EXTRA_RUNS"
  | "RUN_OUT_MODAL"
  | "RETIRE_MODAL";

interface PromptModalProps {
  title: string;
  placeholder: string;
  defaultValue?: string;
  onClose: () => void;
  onConfirm: (val: string) => void;
}

const PromptModal: React.FC<PromptModalProps> = ({
  title,
  placeholder,
  defaultValue = "",
  onClose,
  onConfirm,
}) => {
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-[300] p-4 backdrop-blur-xl animate-in fade-in duration-300">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-indigo-500/20 rounded-[2.5rem] w-full max-w-sm shadow-2xl shadow-indigo-500/10 overflow-hidden p-8 text-slate-100 animate-in zoom-in-95 duration-500 relative"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none"></div>

        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/30 rotate-3 shadow-inner">
          <span className="text-2xl -rotate-3">✍️</span>
        </div>

        <h3 className="text-2xl font-black uppercase tracking-tighter text-white mb-2 italic text-center drop-shadow-sm">
          {title}
        </h3>
        <p className="text-indigo-300/80 text-[11px] font-black uppercase tracking-widest mb-6 text-center">
          {placeholder}
        </p>

        <div className="mb-8 relative group">
          <input
            type="text"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-slate-950/50 border-2 border-slate-800 rounded-2xl px-5 py-4 text-lg text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all uppercase text-center font-black tracking-wider shadow-inner group-hover:border-slate-700"
            placeholder="TYPE NAME HERE..."
          />
        </div>

        <div className="flex gap-4 relative z-10">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 bg-slate-800/50 hover:bg-slate-800 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-all border border-slate-700/50 active:scale-95"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:grayscale rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] text-white transition-all shadow-xl shadow-indigo-600/20 active:scale-95 border border-indigo-400/30"
          >
            Confirm
          </button>
        </div>
      </form>
    </div>
  );
};

const MatchView: React.FC<MatchViewProps> = ({
  initialState,
  previousInnings,
  totalOvers,
  matchId,
  onInningsEnd,
  onResetMatch,
  onForceReset,
  onUpdateOvers,
  onStateChange,
}) => {
  const [isEditingOvers, setIsEditingOvers] = useState(false);
  // --- Live Persistence (Synchronous Hydration - Match Specific) ---
  const getLiveKey = () => `cric-live-match-${matchId}`;

  const loadSavedLiveState = () => {
    const savedLive = localStorage.getItem(getLiveKey());
    if (savedLive) {
      try {
        const data = JSON.parse(savedLive);
        // 🛑 STRICT CHECK: Only restore if match ID stays the same
        if (
          data.matchId === matchId &&
          data.innings.inningNumber === initialState.inningNumber
        ) {
          return data;
        }
      } catch (e) {
        console.error("Failed to restore live innings", e);
      }
    }
    return null;
  };
  const savedState = loadSavedLiveState();

  const [innings, setInnings] = useState<InningsState>(
    savedState ? savedState.innings : initialState,
  );
  const [history, setHistory] = useState<InningsState[]>(
    savedState ? savedState.history || [] : [],
  );
  const [lastCommentary, setLastCommentary] = useState<string>(
    savedState
      ? savedState.lastCommentary || ""
      : initialState.inningNumber === 2
        ? "Second innings started!"
        : "Match started.",
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const [showScoreboard, setShowScoreboard] = useState(false);

  // Scoring State UI controls
  const [pendingExtra, setPendingExtra] = useState<ExtraType>(ExtraType.NONE);
  const [modalView, setModalView] = useState<ModalType>("NONE");
  const [pendingWicketInfo, setPendingWicketInfo] = useState<{
    runs: number;
    wicketType: WicketType;
    outBatterId?: string;
  } | null>(null);
  const [runOutRuns, setRunOutRuns] = useState<number | null>(null);
  const [promptAction, setPromptAction] = useState<{
    title: string;
    placeholder: string;
    defaultValue?: string;
    onConfirm: (val: string) => void;
  } | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const commentaryEndRef = useRef<HTMLDivElement>(null);

  // Save live match state incrementally (Unique per match)
  useEffect(() => {
    const liveState = {
      matchId,
      innings,
      history,
      lastCommentary,
    };
    localStorage.setItem(getLiveKey(), JSON.stringify(liveState));
    if (onStateChange) onStateChange(innings);
  }, [innings, history, lastCommentary, matchId]);

  useEffect(() => {
    commentaryEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastCommentary]);

  const getCurrentStriker = () =>
    innings.players[innings.strikerId] || {
      name: "Selecting...",
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      id: "",
    };
  const getCurrentNonStriker = () =>
    innings.players[innings.nonStrikerId] || {
      name: "Selecting...",
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      id: "",
    };
  const getCurrentBowler = () =>
    innings.bowlers[innings.currentBowlerId] || {
      name: "Selecting...",
      overs: 0,
      balls: 0,
      maidens: 0,
      runsConceded: 0,
      wickets: 0,
      id: "",
    };
  const striker = getCurrentStriker();
  const nonStriker = getCurrentNonStriker();
  const bowler = getCurrentBowler();

  // Calculate equation for 2nd innings
  const getEquation = () => {
    if (innings.inningNumber !== 2 || !innings.target) return null;
    const runsNeeded = innings.target - innings.totalRuns;
    const ballsRemaining = totalOvers * 6 - (innings.overs * 6 + innings.balls);
    if (runsNeeded <= 0) return "Target Reached!";
    return `Need ${runsNeeded} runs in ${ballsRemaining} balls`;
  };

  const saveToHistory = () => {
    setHistory((prev) => [...prev, JSON.parse(JSON.stringify(innings))]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    isProcessingRef.current = false;
    setIsProcessing(false);
    setInnings(previousState);
    setModalView("NONE");
    setPendingExtra(ExtraType.NONE);
    setLastCommentary("Last action undone.");

    // Immediate sync after undo to revert spectator scores & delete last ball in DB
    const s = previousState.players[previousState.strikerId]?.name || "";
    const ns = previousState.players[previousState.nonStrikerId]?.name || "";
    const b = previousState.bowlers[previousState.currentBowlerId]?.name || "";
    const bOvers =
      previousState.bowlers[previousState.currentBowlerId]?.overs || 0;
    const bBalls =
      previousState.bowlers[previousState.currentBowlerId]?.balls || 0;

    fetch(`${API_URL}/update-score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        inningId: previousState.id,
        strikerName: s,
        nonStrikerName: ns,
        bowlerName: b,
        totalOvers: previousState.overs,
        totalBalls: previousState.balls,
        totalRuns: previousState.totalRuns,
        totalWickets: previousState.totalWickets,
        bowlerOvers: bOvers,
        bowlerBalls: bBalls,
        syncOnly: true,
        undo: true, // Tell backend to delete the most recent ball row
      }),
    }).catch((err) => console.error("Undo Sync Failed:", err));
  };

  const generateSimpleCommentary = (ball: BallEvent): string => {
    let msg = `${ball.bowlerName} to ${ball.batterName}, `;
    if (ball.isWicket) {
      msg += `OUT! ${ball.wicketType}.`;
    } else if (ball.extraType !== ExtraType.NONE) {
      msg += `${ball.extraType}! ${ball.runs > 0 ? ball.runs + " runs." : ""}`;
    } else if (ball.runs === 0) {
      msg += "no run.";
    } else if (ball.runs === 4) {
      msg += "FOUR! Beautifully played.";
    } else if (ball.runs === 6) {
      msg += "SIX! That's a massive hit.";
    } else {
      msg += `${ball.runs} run${ball.runs > 1 ? "s" : ""}.`;
    }
    return msg;
  };

  const handleSwapEnds = () => {
    saveToHistory();
    setInnings((prev) => ({
      ...prev,
      strikerId: prev.nonStrikerId,
      nonStrikerId: prev.strikerId,
    }));
  };

  const handleRenamePlayer = (playerId: string) => {
    const player = innings.players[playerId];
    setPromptAction({
      title: "Rename Player",
      placeholder: `Enter new name for ${player.name}:`,
      defaultValue: player.name,
      onConfirm: (newName) => {
        setInnings((prev) => {
          const next = { ...prev };
          next.players[playerId] = {
            ...player,
            name: newName.trim().toUpperCase(),
          };
          return next;
        });
        setLastCommentary(`Renamed player to ${newName.trim().toUpperCase()}`);
      },
    });
  };

  const handleRenameBowler = (bowlerId: string) => {
    const b = innings.bowlers[bowlerId];
    setPromptAction({
      title: "Rename Bowler",
      placeholder: `Enter new name for ${b.name}:`,
      defaultValue: b.name,
      onConfirm: (newName) => {
        setInnings((prev) => {
          const next = { ...prev };
          next.bowlers[bowlerId] = { ...b, name: newName.trim().toUpperCase() };
          return next;
        });
        setLastCommentary(`Renamed bowler to ${newName.trim().toUpperCase()}`);
      },
    });
  };

  const handleRenameTeam = (isBattingTeam: boolean) => {
    const curName = isBattingTeam
      ? innings.battingTeamName
      : innings.bowlingTeamName;
    setPromptAction({
      title: "Rename Team",
      placeholder: `Enter new name for ${curName}:`,
      defaultValue: curName,
      onConfirm: (newName) => {
        setInnings((prev) => {
          const next = { ...prev };
          if (isBattingTeam)
            next.battingTeamName = newName.trim().toUpperCase();
          else next.bowlingTeamName = newName.trim().toUpperCase();
          return next;
        });
      },
    });
  };

  const handleQuickAddPlayer = (isBatter: boolean) => {
    setPromptAction({
      title: `Add ${isBatter ? "Batter" : "Bowler"}`,
      placeholder: `Enter new name:`,
      defaultValue: "",
      onConfirm: (name) => {
        const upName = name.trim().toUpperCase();
        const id = `${isBatter ? "bat" : "bowl"}_${Date.now()}`;
        setInnings((prev) => {
          const next = { ...prev };
          if (isBatter) {
            next.players[id] = {
              id,
              name: upName,
              runs: 0,
              ballsFaced: 0,
              fours: 0,
              sixes: 0,
              isOut: false,
            };
            next.battingOrder = [...next.battingOrder, id];
          } else {
            next.bowlers[id] = {
              id,
              name: upName,
              overs: 0,
              balls: 0,
              maidens: 0,
              runsConceded: 0,
              wickets: 0,
            };
            next.bowlingOrder = [...next.bowlingOrder, id];
          }
          return next;
        });
      },
    });
  };

  const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://ispht71fh0.execute-api.us-east-1.amazonaws.com";

  const syncMatchState = async () => {
    if (!innings.strikerId || !innings.nonStrikerId || !innings.currentBowlerId)
      return;

    try {
      const bOvers = innings.bowlers[innings.currentBowlerId]?.overs || 0;
      const bBalls = innings.bowlers[innings.currentBowlerId]?.balls || 0;

      const response = await fetch(`${API_URL}/update-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          inningId: innings.id,
          strikerName: striker.name,
          nonStrikerName: nonStriker.name,
          bowlerName: bowler.name,
          currentOvers: innings.overs,
          currentBalls: innings.balls,
          matchTotalOvers: totalOvers,
          totalRuns: innings.totalRuns,
          totalWickets: innings.totalWickets,
          bowlerOvers: bOvers,
          bowlerBalls: bBalls,
          battingOrderNames: innings.battingOrder
            .map((id) => innings.players[id]?.name)
            .filter(Boolean),
          syncOnly: true,
        }),
      });

      if (response.status === 404) {
        setAlertMessage(
          "🚨 MATCH NOT FOUND!\nIt may have been deleted by an Administrator. Scoreboard will be reset.",
        );
        if (onForceReset) onForceReset();
        else onResetMatch();
        return;
      }

      console.log("Crease State Synced 📡");
    } catch (err) {
      console.error("Crease Sync Failed:", err);
    }
  };

  // Auto-sync crease when players or match duration change
  useEffect(() => {
    if (innings.strikerId && innings.nonStrikerId && innings.currentBowlerId) {
      syncMatchState();
    }
  }, [
    innings.strikerId,
    innings.nonStrikerId,
    innings.currentBowlerId,
    totalOvers,
  ]);

  const postScoreUpdate = async (
    ball: BallEvent,
    finalInnings: InningsState,
  ) => {
    try {
      const b = finalInnings.bowlers[finalInnings.currentBowlerId];
      const response = await fetch(`${API_URL}/update-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          inningId: finalInnings.id,
          ballData: ball,
          strikerName: finalInnings.players[finalInnings.strikerId]?.name || "",
          nonStrikerName:
            finalInnings.players[finalInnings.nonStrikerId]?.name || "",
          bowlerName: b?.name || "",
          currentOvers: finalInnings.overs,
          currentBalls: finalInnings.balls,
          matchTotalOvers: totalOvers,
          totalRuns: finalInnings.totalRuns,
          totalWickets: finalInnings.totalWickets,
          bowlerOvers: b?.overs || 0,
          bowlerBalls: b?.balls || 0,
          battingOrderNames: finalInnings.battingOrder
            .map((id) => finalInnings.players[id]?.name)
            .filter(Boolean),
          // Absolute stats snapshots to correct any database drift
          runs: finalInnings.players[ball.batterName]
            ? finalInnings.players[ball.batterName].runs
            : Object.values(finalInnings.players).find(
                (p) => p.name === ball.batterName,
              )?.runs || 0,
          ballsFaced: finalInnings.players[ball.batterName]
            ? finalInnings.players[ball.batterName].ballsFaced
            : Object.values(finalInnings.players).find(
                (p) => p.name === ball.batterName,
              )?.ballsFaced || 0,
          fours: finalInnings.players[ball.batterName]
            ? finalInnings.players[ball.batterName].fours
            : Object.values(finalInnings.players).find(
                (p) => p.name === ball.batterName,
              )?.fours || 0,
          sixes: finalInnings.players[ball.batterName]
            ? finalInnings.players[ball.batterName].sixes
            : Object.values(finalInnings.players).find(
                (p) => p.name === ball.batterName,
              )?.sixes || 0,
          bowlerRuns: b?.runsConceded || 0,
          bowlerWickets: b?.wickets || 0,
        }),
      });

      if (response.status === 404) {
        setAlertMessage(
          "🚨 ACTION FAILED: MATCH DELETED!\nThis match is no longer in the system.",
        );
        if (onForceReset) onForceReset();
        else onResetMatch();
        return;
      }

      console.log("Live Sync: Ball record sent successfully 🏏📡");
    } catch (err) {
      console.error("Live Sync Failed:", err);
    }
  };

  const handleScore = async (
    runs: number,
    isWicket = false,
    wicketType = WicketType.NONE,
    fielderName?: string,
    outBatterId?: string,
  ) => {
    if ((isProcessing || isProcessingRef.current) && !fielderName) return;

    // Check if we need a fielder first
    if (
      isWicket &&
      (wicketType === WicketType.CAUGHT ||
        wicketType === WicketType.STUMPED ||
        wicketType === WicketType.RUN_OUT) &&
      !fielderName
    ) {
      setPendingWicketInfo({ runs, wicketType, outBatterId });
      setModalView("FIELDER_SELECT");
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    saveToHistory();

    const isWide = pendingExtra === ExtraType.WIDE;
    const isNoBall = pendingExtra === ExtraType.NO_BALL;
    const isBye = pendingExtra === ExtraType.BYE;
    const isLegBye = pendingExtra === ExtraType.LEG_BYE;

    // Calculate runs added to total score
    let totalRunsToAdd = runs;
    if (isWide || isNoBall) totalRunsToAdd += 1;

    // Calculate runs accredited to batter
    let batterRuns = 0;
    if (!isWide && !isBye && !isLegBye) {
      batterRuns = runs;
    }

    const striker = getCurrentStriker();
    const bowler = getCurrentBowler();

    const newBallEvent: BallEvent = {
      id: Date.now().toString(),
      bowlerName: bowler.name,
      batterName: striker.name,
      runs: runs,
      isExtra: pendingExtra !== ExtraType.NONE,
      extraType: pendingExtra,
      extraRuns: isWide || isNoBall ? 1 : 0,
      isWicket,
      wicketType,
      fielderName,
      overNumber: innings.overs,
      ballNumber: innings.balls + 1,
    };

    // --- State Update Logic ---
    const nextInnings = { ...innings };
    const nextStriker = { ...nextInnings.players[nextInnings.strikerId] };
    const nextBowler = { ...nextInnings.bowlers[nextInnings.currentBowlerId] };

    // Update Runs
    nextInnings.totalRuns += totalRunsToAdd;
    nextStriker.runs += batterRuns;
    if (!isWide) {
      nextStriker.ballsFaced += 1;
    }

    if (batterRuns === 4) nextStriker.fours += 1;
    if (batterRuns === 6) nextStriker.sixes += 1;

    // Update Bowler
    if (!isBye && !isLegBye) {
      nextBowler.runsConceded += totalRunsToAdd;
    }

    // Valid Ball Calculation
    const isValidBall =
      !isWide &&
      !isNoBall &&
      wicketType !== WicketType.RETIRED_HURT &&
      wicketType !== WicketType.RETIRED_OUT;
    let overCompleted = false;

    if (isValidBall) {
      nextInnings.balls += 1;
      nextBowler.balls += 1; // Track ball for bowler

      if (nextBowler.balls === 6) {
        nextBowler.balls = 0;
        nextBowler.overs += 1;
      }

      if (nextInnings.balls === 6) {
        nextInnings.balls = 0;
        nextInnings.overs += 1;
        overCompleted = true;
      }
    }

    // Wicket Logic
    if (isWicket) {
      // RETIRED_HURT does NOT count as a wicket (Law of Cricket)
      if (wicketType !== WicketType.RETIRED_HURT) {
        nextInnings.totalWickets += 1;
      }
      const isBowlerWicket =
        (!isNoBall &&
          !isWide &&
          wicketType !== WicketType.RUN_OUT &&
          wicketType !== WicketType.RETIRED_HURT &&
          wicketType !== WicketType.RETIRED_OUT) ||
        (isWide &&
          (wicketType === WicketType.STUMPED ||
            wicketType === WicketType.HIT_WICKET));
      if (isBowlerWicket) {
        nextBowler.wickets += 1;
      }
      if (
        wicketType === WicketType.RUN_OUT &&
        outBatterId === nextInnings.nonStrikerId
      ) {
        const nextNonStriker = {
          ...nextInnings.players[nextInnings.nonStrikerId],
        };
        nextNonStriker.isOut = true;
        nextNonStriker.wicketType = wicketType;
        nextNonStriker.wicketBy = bowler.name;
        nextNonStriker.fielderName = fielderName;
        nextInnings.players[nextInnings.nonStrikerId] = nextNonStriker;
      } else {
        nextStriker.isOut = wicketType !== WicketType.RETIRED_HURT;
        nextStriker.wicketType = wicketType;
        nextStriker.wicketBy = bowler.name;
        nextStriker.fielderName = fielderName;
      }

      if (wicketType === WicketType.RETIRED_HURT) {
        nextInnings.strikerId = "";
      }
    }

    // Strike Rotation
    if (runs % 2 !== 0) {
      [nextInnings.strikerId, nextInnings.nonStrikerId] = [
        nextInnings.nonStrikerId,
        nextInnings.strikerId,
      ];
    }

    // End of over strike rotation
    if (overCompleted) {
      [nextInnings.strikerId, nextInnings.nonStrikerId] = [
        nextInnings.nonStrikerId,
        nextInnings.strikerId,
      ];
    }

    // Commit State Updates - Deep Copy to avoid mutation leaks
    const finalInnings: InningsState = {
      ...nextInnings,
      players: { ...nextInnings.players, [striker.id]: nextStriker },
      bowlers: { ...nextInnings.bowlers, [bowler.id]: nextBowler },
      allBalls: [...nextInnings.allBalls, newBallEvent],
      currentOver: [...nextInnings.currentOver, newBallEvent],
    };

    if (finalInnings.currentOver.length > 6) {
      finalInnings.currentOver = finalInnings.currentOver.slice(1);
    }

    // Maiden Over check
    // A maiden requires ZERO runs and NO wides/no-balls in the over
    if (overCompleted) {
      const currentOverNumber = newBallEvent.overNumber;
      const overBalls = finalInnings.allBalls.filter(
        (b) => b.overNumber === currentOverNumber,
      );

      const isMaiden = !overBalls.some(
        (b) =>
          b.extraType === ExtraType.WIDE ||
          b.extraType === ExtraType.NO_BALL ||
          b.runs > 0 ||
          b.extraRuns > 0,
      );

      if (isMaiden) {
        const updatedBowler = {
          ...finalInnings.bowlers[bowler.id],
          maidens: (finalInnings.bowlers[bowler.id].maidens || 0) + 1,
        };
        finalInnings.bowlers[bowler.id] = updatedBowler;
      }
    }

    setInnings(finalInnings);
    // Innings ends if 10 wickets fall OR if fewer than 2 batters are left not out (handles teams < 11 players)
    const validBattersCount = finalInnings.battingOrder.filter(
      (id) => !finalInnings.players[id].isOut,
    ).length;
    const isAllOut = finalInnings.totalWickets >= 10 || validBattersCount < 2;
    const isOversDone = finalInnings.overs >= totalOvers;
    const isTargetChased =
      finalInnings.target && finalInnings.totalRuns >= finalInnings.target;
    const isMatchEnding = isAllOut || isOversDone || isTargetChased;

    // Logic for next actions (Modals)
    setModalView("NONE"); // Close wicket type modal if open

    if (!isMatchEnding) {
      if (
        isWicket &&
        wicketType !== WicketType.RETIRED_HURT
        // Note: RETIRED_OUT still needs modalView="BATTER_SELECT" since it does
        // NOT set strikerId="" — the hardcoded modal only fires for strikerId="".
        // RETIRED_HURT sets strikerId="" so it uses the hardcoded modal instead.
      ) {
        setModalView("BATTER_SELECT");
      } else if (overCompleted) {
        setModalView("BOWLER_SELECT");
      }
    }

    // Release the processing lock immediately after all state is committed
    // synchronously. The API call (postScoreUpdate) runs in the background
    // and should NOT block the user from scoring the next ball.
    // Only match-ending scenarios keep the UI locked permanently.
    if (!isMatchEnding) {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }

    await postScoreUpdate(newBallEvent, finalInnings);
    setPendingExtra(ExtraType.NONE);
    setPendingWicketInfo(null);

    // Commentary
    let commentary = generateSimpleCommentary(newBallEvent);
    if (overCompleted && !isTargetChased && !isAllOut) {
      commentary += " End of over.";
    }
    setLastCommentary(commentary);

    if (isMatchEnding) {
      // Delay slightly so users see the wicket/run
      setTimeout(() => onInningsEnd(finalInnings), 500);
      return; // Lock the UI permanently until the parent unmounts this view
    }
  };

  const handleBatterSelected = (newBatterId: string) => {
    // Compute updated state directly from current innings (safe since React
    // re-renders before any user click, so innings is always current here).
    const updated = { ...innings, players: { ...innings.players } };

    if (updated.players[newBatterId]) {
      const player = { ...updated.players[newBatterId] };
      if (player.wicketType === WicketType.RETIRED_HURT) {
        player.wicketType = undefined;
        player.wicketBy = undefined;
        player.fielderName = undefined;
        updated.players[newBatterId] = player;
      }
    }

    if (newBatterId === updated.nonStrikerId) {
      [updated.strikerId, updated.nonStrikerId] = [
        updated.nonStrikerId,
        updated.strikerId,
      ];
    } else if (newBatterId === updated.strikerId) {
      // Do nothing if same striker is selected
    } else if (
      updated.strikerId === "" ||
      updated.players[updated.strikerId]?.isOut
    ) {
      updated.strikerId = newBatterId;
    } else if (
      updated.nonStrikerId === "" ||
      updated.players[updated.nonStrikerId]?.isOut
    ) {
      updated.nonStrikerId = newBatterId;
    } else {
      updated.strikerId = newBatterId;
    }

    // Determine next modal from the fully-computed updated state.
    // This is evaluated synchronously before any setState call so the value
    // is correct when setModalView is called below.
    let nextModal: ModalType;
    if (updated.nonStrikerId === "") {
      nextModal = "BATTER_SELECT";
    } else if (updated.currentBowlerId === "") {
      nextModal = "BOWLER_SELECT";
    } else if (
      updated.balls === 0 &&
      updated.overs > 0 &&
      updated.overs < totalOvers &&
      // Only trigger bowler select if a real over just completed (currentOver has
      // non-retirement balls). If the replacement is for a RETIRED_HURT/OUT that
      // happened between overs, the bowler was already selected and currentOver
      // will only contain retirement events — so we skip the BOWLER_SELECT.
      updated.currentOver.some(
        (b) =>
          b.wicketType !== WicketType.RETIRED_HURT &&
          b.wicketType !== WicketType.RETIRED_OUT,
      )
    ) {
      nextModal = "BOWLER_SELECT";
    } else {
      nextModal = "NONE";
    }

    // Both setters called in the same synchronous block — React batches them.
    setInnings(updated);
    setModalView(nextModal);
  };

  const handleBowlerSelected = (newBowlerId: string) => {
    setInnings((prev) => ({
      ...prev,
      currentBowlerId: newBowlerId,
      currentOver: [],
    }));
    setModalView("NONE");
  };

  const handleRetire = (type: WicketType) => {
    handleScore(0, true, type);
  };

  const handleFielderSelected = (fielderName: string) => {
    if (pendingWicketInfo) {
      handleScore(
        pendingWicketInfo.runs,
        true,
        pendingWicketInfo.wicketType,
        fielderName,
        pendingWicketInfo.outBatterId,
      );
    }
  };

  // --- SUB COMPONENTS EXTRACTED ---

  const equation = getEquation();

  return (
    <div className="h-full bg-slate-900 text-slate-100 flex flex-col overflow-hidden selection:bg-indigo-500/30">
      {innings.strikerId === "" && (
        <BatterSelectModal
          innings={innings}
          onSelect={handleBatterSelected}
          onRename={handleRenamePlayer}
          onQuickAdd={handleQuickAddPlayer}
          onClose={() => setModalView("NONE")}
        />
      )}
      {innings.strikerId !== "" && innings.nonStrikerId === "" && (
        <BatterSelectModal
          innings={innings}
          onSelect={handleBatterSelected}
          onRename={handleRenamePlayer}
          onQuickAdd={handleQuickAddPlayer}
          onClose={() => setModalView("NONE")}
        />
      )}
      {innings.strikerId !== "" &&
        innings.nonStrikerId !== "" &&
        innings.currentBowlerId === "" && (
          <BowlerSelectModal
            innings={innings}
            totalOvers={totalOvers}
            onSelect={handleBowlerSelected}
            onRename={handleRenameBowler}
            onQuickAdd={handleQuickAddPlayer}
            onClose={() => setModalView("NONE")}
          />
        )}

      {modalView === "WICKET_TYPE" && (
        <WicketTypeModal
          pendingExtra={pendingExtra}
          onSelect={(type) => {
            if (type === WicketType.RUN_OUT) {
              setModalView("RUN_OUT_MODAL");
            } else {
              handleScore(0, true, type);
            }
          }}
          onClose={() => setModalView("NONE")}
        />
      )}
      {modalView === "RUN_OUT_MODAL" && (
        <RunOutModal
          innings={innings}
          runOutRuns={runOutRuns}
          setRunOutRuns={setRunOutRuns}
          onSelect={(runs, outBatterId) => {
            setRunOutRuns(null);
            handleScore(runs, true, WicketType.RUN_OUT, undefined, outBatterId);
          }}
          onClose={() => {
            setModalView("NONE");
            setRunOutRuns(null);
          }}
        />
      )}
      {modalView === "BATTER_SELECT" && (
        <BatterSelectModal
          innings={innings}
          onSelect={handleBatterSelected}
          onRename={handleRenamePlayer}
          onQuickAdd={handleQuickAddPlayer}
          onClose={() => setModalView("NONE")}
        />
      )}
      {modalView === "BOWLER_SELECT" && (
        <BowlerSelectModal
          innings={innings}
          totalOvers={totalOvers}
          onSelect={handleBowlerSelected}
          onRename={handleRenameBowler}
          onQuickAdd={handleQuickAddPlayer}
          onClose={() => setModalView("NONE")}
        />
      )}
      {modalView === "FIELDER_SELECT" && (
        <FielderSelectModal
          innings={innings}
          pendingWicketInfo={pendingWicketInfo as any}
          onSelect={handleFielderSelected}
          onClose={() => {
            setModalView("NONE");
            setPendingWicketInfo(null);
            setIsProcessing(false);
          }}
        />
      )}
      {modalView === "EXTRA_RUNS" && (
        <ExtraRunsModal
          pendingExtra={pendingExtra}
          onScore={(runs) => handleScore(runs)}
          onIgnore={() => {
            setPendingExtra(ExtraType.NONE);
            setModalView("NONE");
          }}
        />
      )}
      {modalView === "RETIRE_MODAL" && (
        <RetireModal
          strikerName={innings.players[innings.strikerId]?.name || "Striker"}
          onRetire={(type) => {
            handleRetire(type);
          }}
          onClose={() => setModalView("NONE")}
        />
      )}

      {showScoreboard && (
        <Scoreboard
          currentInnings={innings}
          previousInnings={previousInnings}
          onClose={() => setShowScoreboard(false)}
          onResetMatch={onResetMatch}
          totalOvers={totalOvers}
        />
      )}

      {/* Ultra-Slim Header (Fixed) */}
      <div className="bg-slate-950 text-white shadow-2xl border-b border-indigo-500/30 shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-2">
          <div className="flex justify-between items-center gap-4">
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center gap-2 mb-0.5 overflow-hidden">
                <span className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest flex-shrink-0">
                  {innings.inningNumber === 1 ? "1st" : "2nd"} INN
                </span>
                <div className="flex items-center gap-1.5 text-white text-[11px] font-black tracking-widest uppercase truncate">
                  <span
                    className="text-blue-400 cursor-pointer hover:underline"
                    onClick={() => handleRenameTeam(true)}
                  >
                    {innings.battingTeamName}
                  </span>
                  <span className="text-slate-600 text-[8px] italic lowercase font-medium">
                    vs
                  </span>
                  <span
                    className="text-indigo-400 cursor-pointer hover:underline"
                    onClick={() => handleRenameTeam(false)}
                  >
                    {innings.bowlingTeamName}
                  </span>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tighter text-white tabular-nums">
                  {innings.totalRuns}
                  <span className="text-slate-500 mx-0.5 text-xl">/</span>
                  {innings.totalWickets}
                </span>
                <div className="flex items-center gap-1 text-indigo-400 font-black text-sm leading-none tabular-nums group/overs">
                  <span>
                    {innings.overs}.{innings.balls}
                  </span>
                  <span className="text-slate-600 text-[10px] mx-0.5">/</span>
                  {isEditingOvers ? (
                    <div className="flex items-center gap-1 animate-in zoom-in-75 duration-200">
                      <input
                        type="number"
                        autoFocus
                        defaultValue={totalOvers}
                        className="w-10 bg-indigo-600/30 border border-indigo-400/50 rounded text-center outline-none text-white text-xs py-0.5 font-black"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = parseInt(
                              (e.target as HTMLInputElement).value,
                            );
                            if (!isNaN(val)) onUpdateOvers?.(val);
                            setIsEditingOvers(false);
                          }
                          if (e.key === "Escape") setIsEditingOvers(false);
                        }}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) onUpdateOvers?.(val);
                          setIsEditingOvers(false);
                        }}
                      />
                      <span
                        className="text-[10px] text-emerald-400"
                        onClick={() => setIsEditingOvers(false)}
                      >
                        ✅
                      </span>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer hover:text-indigo-300 transition-colors flex items-center gap-1"
                      onClick={() => setIsEditingOvers(true)}
                    >
                      <span>{totalOvers}</span>
                      <span className="text-[10px] opacity-0 group-hover/overs:opacity-100 ml-0.5">
                        ✏️
                      </span>
                    </span>
                  )}
                  <span className="text-slate-600 text-[9px] tracking-tight ml-0.5">
                    OVS
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <button
                onClick={() => setShowScoreboard(true)}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
              >
                Scorecard 📋
              </button>
              {innings.target && (
                <span className="text-[10px] font-black text-yellow-500 uppercase tracking-tighter mt-1">
                  TGT: {innings.target}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Live Dashboard Area (Centered and Tight) */}
      <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col py-1">
        <div className="max-w-4xl mx-auto w-full px-4 space-y-2 pb-2 my-auto">
          {/* Active Player Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Batters */}
            <div className="space-y-1 relative">
              {[striker, nonStriker].map((b, idx) => (
                <div
                  key={b.id || idx}
                  className={`flex justify-between items-center p-2.5 md:p-3 rounded-xl border transition-all ${idx === 0 ? "bg-indigo-600 border-indigo-300 shadow-xl scale-105 z-10" : "bg-slate-800 border-white/5 opacity-80"}`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span
                      className={`text-[11px] md:text-xs font-black truncate uppercase tracking-widest cursor-pointer hover:opacity-80 transition-opacity ${idx === 0 ? "text-white" : "text-slate-200"}`}
                      onClick={() => handleRenamePlayer(b.id)}
                    >
                      {b.name || "---"} {idx === 0 && "🏏"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-lg md:text-xl font-black ${idx === 0 ? "text-white" : "text-slate-200"}`}
                    >
                      {b.runs}
                    </span>
                    <span
                      className={`text-[10px] md:text-[11px] font-black ${idx === 0 ? "text-indigo-100" : "text-slate-500"}`}
                    >
                      ({b.ballsFaced})
                    </span>
                  </div>
                </div>
              ))}
              <button
                onClick={handleSwapEnds}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white text-indigo-950 rounded-full text-xs border-2 border-slate-900 active:scale-90 transition-all shadow-xl z-20"
              >
                🔄
              </button>
            </div>

            {/* Bowlers */}
            <div className="space-y-1">
              <div className="flex justify-between items-center p-2.5 md:p-3 rounded-xl bg-slate-800 border border-white/10 shadow-inner h-full">
                <div className="flex flex-col min-w-0">
                  <div className="flex flex-col mb-1.5">
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1 italic">
                      {innings.bowlingTeamName}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="w-1 h-3 bg-indigo-500 rounded-full"></span>
                      <span className="text-[9px] font-black text-slate-500 uppercase leading-none">
                        Bowler
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-[11px] md:text-xs font-black text-indigo-300 uppercase truncate cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleRenameBowler(bowler.id)}
                  >
                    {bowler.name || "---"}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-lg md:text-xl font-black text-white leading-none tabular-nums">
                    {bowler.wickets}
                    <span className="text-indigo-500 mx-0.5">/</span>
                    {bowler.runsConceded}
                  </div>
                  <div className="text-[10px] md:text-[11px] font-black text-slate-500 tabular-nums uppercase mt-0.5">
                    ({bowler.overs}.{bowler.balls})
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Over Tracking (Prominent) */}
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
                Live Timeline
              </span>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full">
                This Over
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
              {innings.currentOver.length === 0 ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center animate-pulse">
                    <span className="text-[10px] italic">0</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tighter opacity-50 italic">
                    Waiting...
                  </span>
                </div>
              ) : (
                innings.currentOver.map((ball, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center gap-1.5 animate-in slide-in-from-right-4 duration-300"
                  >
                    <div
                      className={`flex-shrink-0 w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center text-[13px] md:text-[15px] font-black border-2 transition-all shadow-xl ${
                        ball.isWicket
                          ? "bg-red-500 text-white border-red-300 shadow-red-500/40"
                          : ball.runs === 4
                            ? "bg-blue-600 text-white border-blue-400 shadow-blue-500/40"
                            : ball.runs === 6
                              ? "bg-purple-600 text-white border-purple-400 shadow-purple-500/40"
                              : ball.isExtra
                                ? "bg-amber-500 text-amber-950 border-amber-300 shadow-amber-500/40"
                                : "bg-white text-slate-900 border-white shadow-white/10"
                      }`}
                    >
                      {(() => {
                        if (ball.isWicket)
                          return ball.runs > 0 ? `W+${ball.runs}` : "W";
                        if (ball.isExtra) {
                          if (ball.extraType === "WIDE")
                            return ball.runs > 0 ? `Wd+${ball.runs}` : "Wd";
                          if (ball.extraType === "NO_BALL")
                            return ball.runs > 0 ? `Nb+${ball.runs}` : "Nb";
                          if (ball.extraType === "BYE")
                            return ball.runs > 0 ? `B+${ball.runs}` : "B";
                          if (ball.extraType === "LEG_BYE")
                            return ball.runs > 0 ? `Lb+${ball.runs}` : "Lb";
                          return ball.runs > 0
                            ? `${ball.extraType[0]}+${ball.runs}`
                            : ball.extraType[0];
                        }
                        return ball.runs;
                      })()}
                    </div>
                    <span className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase">
                      {ball.isExtra ? ball.extraType.split("_")[0] : "RUN"}
                    </span>
                  </div>
                ))
              )}
              {innings.currentOver.length > 0 &&
                innings.currentOver.length < 6 &&
                [...Array(6 - innings.currentOver.length)].map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="w-9 h-9 md:w-11 md:h-11 rounded-full border-2 border-dashed border-slate-700/50 flex items-center justify-center opacity-30"
                  >
                    <span className="text-[10px] text-slate-600 font-bold">
                      •
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Live Commentary & Equation */}
          <div className="space-y-2">
            <div className="bg-indigo-600/5 rounded-xl p-2.5 border border-indigo-500/10 shadow-inner">
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 text-[10px] font-black text-indigo-400 uppercase italic">
                  LIVE
                </span>
                <p className="text-xs md:text-sm text-slate-200 font-bold tracking-wide italic uppercase leading-none truncate">
                  {lastCommentary}
                </p>
              </div>
            </div>
            {equation && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 text-center">
                <span className="text-[10px] md:text-sm font-black text-yellow-500 uppercase tracking-[0.2em]">
                  {equation}
                </span>
              </div>
            )}
          </div>
          <div ref={commentaryEndRef} className="h-0" />
        </div>
      </div>

      {/* Operations Cockpit (Fixed Bottom) */}
      <div className="shrink-0 bg-slate-950 border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[90]">
        <div className="max-w-4xl mx-auto">
          {/* Action Tabs */}
          <div className="grid grid-cols-4 border-b border-white/5">
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className="py-2 flex flex-col items-center justify-center gap-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all border-r border-white/5 disabled:opacity-10"
            >
              <span className="text-base text-indigo-400">↺</span>
              Undo
            </button>
            <button
              onClick={() => setModalView("BOWLER_SELECT")}
              className="py-2 flex flex-col items-center justify-center gap-1 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all border-r border-white/5"
            >
              <span className="text-base">🎾</span>
              Change Bowler
            </button>
            <button
              onClick={() => setModalView("BATTER_SELECT")}
              className="py-2 flex flex-col items-center justify-center gap-1 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all border-r border-white/5"
            >
              <span className="text-base">🏏</span>
              Change Batter
            </button>
            <button
              onClick={() => innings.strikerId && setModalView("RETIRE_MODAL")}
              disabled={!innings.strikerId}
              className={`py-2 flex flex-col items-center justify-center gap-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${!innings.strikerId ? "opacity-40 cursor-not-allowed text-slate-600" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
            >
              <span className="text-base">🚪</span>
              Retire
            </button>
          </div>

          {/* Input Hub */}
          <div className="p-2 md:p-3 space-y-2">
            {/* Ultra-Large Extras Console */}
            <div className="grid grid-cols-4 gap-2 md:gap-3 mb-1">
              {["WIDE", "NO_BALL", "BYE", "LEG_BYE"].map((type) => {
                const isActive = pendingExtra === (type as ExtraType);
                return (
                  <button
                    key={type}
                    onClick={() => {
                      const next = isActive
                        ? ExtraType.NONE
                        : (type as ExtraType);
                      setPendingExtra(next);
                      if (next !== ExtraType.NONE) {
                        setModalView("EXTRA_RUNS");
                      }
                    }}
                    className={`py-3 md:py-4 lg:py-5 rounded-2xl md:rounded-xl text-[10px] md:text-xs font-black border transition-all uppercase tracking-tighter leading-none ${isActive ? "bg-indigo-600 text-white border-indigo-300 shadow-2xl scale-95" : "bg-slate-900 text-slate-400 border-white/10 hover:border-white/30 hover:text-white"}`}
                  >
                    {type.replace("_", " ")}
                  </button>
                );
              })}
            </div>
            {/* Keypad */}
            <div className="grid grid-cols-4 gap-2 md:gap-3">
              {[0, 1, 2, 3].map((run) => (
                <button
                  key={run}
                  onClick={() => handleScore(run)}
                  className="h-14 sm:h-16 lg:h-20 rounded-xl md:rounded-lg bg-slate-900 border border-white/5 hover:border-white/20 text-white font-black text-3xl md:text-4xl active:scale-95 transition-all shadow-inner"
                >
                  {run}
                </button>
              ))}
              <button
                onClick={() => handleScore(4)}
                className="h-14 sm:h-16 lg:h-20 rounded-xl md:rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-3xl md:text-4xl active:scale-95 transition-all shadow-xl shadow-blue-600/20 border border-blue-400/30"
              >
                4
              </button>
              <button
                onClick={() => handleScore(5)}
                className="h-14 sm:h-16 lg:h-20 rounded-xl md:rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-3xl md:text-4xl active:scale-95 transition-all shadow-xl shadow-emerald-600/20 border border-emerald-400/30"
              >
                5
              </button>
              <button
                onClick={() => handleScore(6)}
                className="h-14 sm:h-16 lg:h-20 rounded-xl md:rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-3xl md:text-4xl active:scale-95 transition-all shadow-xl shadow-purple-600/20 border border-purple-400/30"
              >
                6
              </button>
              <button
                onClick={() => setModalView("WICKET_TYPE")}
                className="h-14 sm:h-16 lg:h-20 rounded-xl md:rounded-lg bg-red-600 hover:bg-red-500 text-white font-black text-3xl md:text-4xl active:scale-95 transition-all shadow-xl shadow-red-600/20 border border-red-400/30"
              >
                W
              </button>
            </div>
          </div>
        </div>
      </div>

      {promptAction && (
        <PromptModal
          title={promptAction.title}
          placeholder={promptAction.placeholder}
          defaultValue={promptAction.defaultValue}
          onClose={() => setPromptAction(null)}
          onConfirm={promptAction.onConfirm}
        />
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

export default MatchView;
