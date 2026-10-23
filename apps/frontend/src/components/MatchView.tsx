import React, { useState, useEffect, useRef } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { InningsState, BallEvent, ExtraType, WicketType } from "../types";
import Scoreboard from "./Scoreboard";
import { FielderSelectModal } from "./MatchView/FielderSelectModal";
import { WicketTypeModal } from "./MatchView/WicketTypeModal";
import { RetireModal } from "./MatchView/RetireModal";
import { RunOutModal } from "./MatchView/RunOutModal";
import { BatterSelectModal } from "./MatchView/BatterSelectModal";
import { BowlerSelectModal } from "./MatchView/BowlerSelectModal";
import { ExtraRunsModal } from "./MatchView/ExtraRunsModal";
import { AiMatchPrediction } from "./AiMatchPrediction";
import { calculateDlsParScore } from "../utils/dlsUtils";

interface MatchViewProps {
  initialState: InningsState;
  previousInnings?: InningsState;
  totalOvers: number;
  matchId: string; // Dynamic ID
  userToken?: string;
  onInningsEnd: (innings: InningsState) => void;
  onResetMatch: () => void;
  onQuitMatch?: () => void;
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
  userToken,
  onInningsEnd,
  onResetMatch,
  onQuitMatch,
  onForceReset,
  onUpdateOvers,
  onStateChange,
}) => {
  const [isEditingOvers, setIsEditingOvers] = useState(false);

  const getAuthHeaders = async () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    let authToken = userToken;
    if (!authToken) {
      try {
        const session = await fetchAuthSession();
        authToken = session.tokens?.idToken?.toString();
      } catch (e) {
        console.warn("MatchView: Could not fetch auth session:", e);
      }
    }
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    return headers;
  };
  // --- Live Persistence (Synchronous Hydration - Match & Innings Specific) ---
  const getLiveKey = (inningNum: number = initialState.inningNumber) =>
    `cric-live-match-${matchId}-inn-${inningNum}`;

  const loadSavedLiveState = () => {
    let savedLive = null;
    try {
      savedLive =
        window.localStorage.getItem(getLiveKey(initialState.inningNumber)) ||
        window.localStorage.getItem(`cric-live-match-${matchId}`);
    } catch {
      return null;
    }
    if (savedLive) {
      try {
        const data = JSON.parse(savedLive);
        // 🛑 STRICT CHECK: Only restore if match ID and inningNumber match
        if (
          data.matchId === matchId &&
          data.innings &&
          data.innings.inningNumber === initialState.inningNumber
        ) {
          const savedBalls =
            (data.innings.overs || 0) * 6 + (data.innings.balls || 0);
          const initBalls =
            (initialState.overs || 0) * 6 + (initialState.balls || 0);
          if (savedBalls >= initBalls) {
            return data;
          }
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

  const middleContainerRef = useRef<HTMLDivElement>(null);
  const skipCreaseSyncRef = useRef(false);

  const actionQueueRef = useRef<(() => Promise<void>)[]>([]);

  const processQueue = async () => {
    console.log("processQueue called", actionQueueRef.current.length);
    if (actionQueueRef.current.length > 0 && !isProcessingRef.current) {
      const nextAction = actionQueueRef.current.shift();
      if (nextAction) {
        await nextAction();
      }
    }
  };

  // Sync real backend inning UUID if MatchView mounted with an optimistic inn2_ ID
  useEffect(() => {
    if (
      initialState.id &&
      !initialState.id.startsWith("inn2_") &&
      innings.inningNumber === initialState.inningNumber &&
      innings.id !== initialState.id
    ) {
      setInnings((prev) => ({ ...prev, id: initialState.id }));
      setHistory((prev) =>
        prev.map((h) =>
          h.inningNumber === initialState.inningNumber
            ? { ...h, id: initialState.id }
            : h,
        ),
      );
    }
  }, [
    initialState.id,
    initialState.inningNumber,
    innings.id,
    innings.inningNumber,
  ]);

  // Save live match state incrementally (Unique per match)
  useEffect(() => {
    const liveState = {
      matchId,
      innings,
      history,
      lastCommentary,
    };
    const storage = window.localStorage;
    try {
      storage.setItem(getLiveKey(), JSON.stringify(liveState));
    } catch {
      // Ignore browser storage failures so live match state does not blank the scorer screen.
    }
    if (onStateChange) onStateChange(innings);
  }, [innings, history, lastCommentary, matchId]);

  useEffect(() => {
    // Scroll the inner container to top on each ball — never escape to window/page
    if (middleContainerRef.current) {
      middleContainerRef.current.scrollTop = 0;
    }
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
    if (runsNeeded <= 0) return "Reached";
    return `${runsNeeded} OFF ${ballsRemaining}`;
  };

  const saveToHistory = () => {
    setHistory((prev) => [...prev, JSON.parse(JSON.stringify(innings))]);
  };

  const reconstructPreviousState = (
    current: InningsState,
  ): InningsState | null => {
    if (!current.allBalls || current.allBalls.length === 0) {
      if ((current.overs || 0) === 0 && (current.balls || 0) === 0) {
        return null;
      }
      const fallbackPrev: InningsState = JSON.parse(JSON.stringify(current));
      const totalLegalBefore = Math.max(
        0,
        fallbackPrev.overs * 6 + fallbackPrev.balls - 1,
      );
      fallbackPrev.overs = Math.floor(totalLegalBefore / 6);
      fallbackPrev.balls = totalLegalBefore % 6;
      return fallbackPrev;
    }
    const prev: InningsState = JSON.parse(JSON.stringify(current));
    const lastBall = prev.allBalls.pop()!;
    const ballTotalRuns = (lastBall.runs || 0) + (lastBall.extraRuns || 0);
    prev.totalRuns = Math.max(0, prev.totalRuns - ballTotalRuns);

    const wasLegal =
      lastBall.extraType !== ExtraType.WIDE &&
      lastBall.extraType !== ExtraType.NO_BALL &&
      lastBall.wicketType !== WicketType.RETIRED_HURT &&
      String(lastBall.wicketType) !== "RETIRED_HURT";

    if (wasLegal) {
      const totalLegalBefore = Math.max(0, prev.overs * 6 + prev.balls - 1);
      prev.overs = Math.floor(totalLegalBefore / 6);
      prev.balls = totalLegalBefore % 6;
    }

    prev.currentOver = prev.allBalls.filter((b) => b.overNumber === prev.overs);

    const batter = Object.values(prev.players).find(
      (p) => p.name === lastBall.batterName,
    );
    if (batter) {
      if (
        lastBall.extraType === ExtraType.NONE ||
        lastBall.extraType === ExtraType.NO_BALL
      ) {
        batter.runs = Math.max(0, batter.runs - (lastBall.runs || 0));
        if (lastBall.runs === 4) batter.fours = Math.max(0, batter.fours - 1);
        if (lastBall.runs === 6) batter.sixes = Math.max(0, batter.sixes - 1);
      }
      if (
        lastBall.extraType !== ExtraType.WIDE &&
        lastBall.wicketType !== WicketType.RETIRED_HURT &&
        String(lastBall.wicketType) !== "RETIRED_HURT"
      ) {
        batter.ballsFaced = Math.max(0, batter.ballsFaced - 1);
      }
    }

    if (lastBall.isWicket) {
      if (
        lastBall.wicketType !== WicketType.RETIRED_HURT &&
        String(lastBall.wicketType) !== "RETIRED_HURT"
      ) {
        prev.totalWickets = Math.max(0, prev.totalWickets - 1);
      }
      const dismissedPlayer =
        (batter && batter.isOut ? batter : undefined) ||
        Object.values(prev.players).find(
          (p) => p.isOut && p.wicketType === lastBall.wicketType,
        );
      if (dismissedPlayer) {
        dismissedPlayer.isOut = false;
        dismissedPlayer.wicketType = undefined;
        dismissedPlayer.wicketBy = undefined;
        dismissedPlayer.fielderName = undefined;
        prev.strikerId = dismissedPlayer.id;
      }
    } else if (batter) {
      if (prev.strikerId !== batter.id && prev.nonStrikerId !== batter.id) {
        prev.strikerId = batter.id;
      }
    }

    const bowlerObj = Object.values(prev.bowlers).find(
      (bw) => bw.name === lastBall.bowlerName,
    );
    if (bowlerObj) {
      prev.currentBowlerId = bowlerObj.id;
      if (
        lastBall.extraType !== ExtraType.BYE &&
        lastBall.extraType !== ExtraType.LEG_BYE
      ) {
        bowlerObj.runsConceded = Math.max(
          0,
          bowlerObj.runsConceded - ballTotalRuns,
        );
      }
      if (wasLegal) {
        const bLegalBefore = Math.max(
          0,
          bowlerObj.overs * 6 + bowlerObj.balls - 1,
        );
        bowlerObj.overs = Math.floor(bLegalBefore / 6);
        bowlerObj.balls = bLegalBefore % 6;
      }
      if (
        lastBall.isWicket &&
        ![
          WicketType.RUN_OUT,
          WicketType.RETIRED_HURT,
          WicketType.RETIRED_OUT,
        ].includes(lastBall.wicketType as WicketType)
      ) {
        bowlerObj.wickets = Math.max(0, bowlerObj.wickets - 1);
      }
    }

    return prev;
  };

  const handleUndo = async () => {
    const previousState =
      history.length > 0
        ? history[history.length - 1]
        : reconstructPreviousState(innings);
    if (!previousState) return;

    isProcessingRef.current = true;
    setIsProcessing(true);
    skipCreaseSyncRef.current = true;
    const nextHistory = history.length > 0 ? history.slice(0, -1) : [];
    setHistory(nextHistory);
    setInnings(previousState);
    setModalView("NONE");
    setPendingExtra(ExtraType.NONE);
    setLastCommentary("Last action undone.");

    try {
      window.localStorage.setItem(
        getLiveKey(previousState.inningNumber),
        JSON.stringify({
          matchId,
          innings: previousState,
          history: nextHistory,
          lastCommentary: "Last action undone.",
        }),
      );
    } catch {
      // Ignore storage errors
    }
    if (onStateChange) onStateChange(previousState);

    // Immediate sync after undo to revert spectator scores & delete last ball in DB
    const strikerObj = previousState.players[previousState.strikerId];
    const s = strikerObj?.name || "";
    const ns = previousState.players[previousState.nonStrikerId]?.name || "";
    const bowlerObj = previousState.bowlers[previousState.currentBowlerId];
    const b = bowlerObj?.name || "";
    const bOvers = bowlerObj?.overs || 0;
    const bBalls = bowlerObj?.balls || 0;

    try {
      if (!matchId.startsWith("guest_")) {
        const headers = await getAuthHeaders();
        await fetch(`${API_URL}/update-score`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            matchId,
            inningId:
              !previousState.id.startsWith("inn2_") ||
              initialState.id.startsWith("inn2_")
                ? previousState.id
                : initialState.id,
            battingTeamName: previousState.battingTeamName,
            strikerName: s,
            nonStrikerName: ns,
            bowlerName: b,
            currentOvers: previousState.overs,
            currentBalls: previousState.balls,
            explicitTotalRuns: previousState.totalRuns,
            explicitTotalWickets: previousState.totalWickets,
            bowlerOvers: bOvers,
            bowlerBalls: bBalls,
            bowlerRuns: bowlerObj?.runsConceded || 0,
            bowlerWickets: bowlerObj?.wickets || 0,
            runs: strikerObj?.runs || 0,
            ballsFaced: strikerObj?.ballsFaced || 0,
            fours: strikerObj?.fours || 0,
            sixes: strikerObj?.sixes || 0,
            syncOnly: true,
            undo: true, // Tell backend to delete the most recent ball row
          }),
        });
      }
    } catch (err) {
      console.error("Undo Sync Failed:", err);
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      processQueue();
    }
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

  const isDuplicateName = (name: string, excludeId?: string) => {
    const up = name.trim().toUpperCase();
    const dup = [
      ...Object.values(innings.players),
      ...Object.values(innings.bowlers),
    ].some((p) => p.id !== excludeId && p.name.trim().toUpperCase() === up);
    if (dup) setAlertMessage(`${up} already exists in this match.`);
    return dup;
  };

  const handleRenamePlayer = (playerId: string) => {
    const player = innings.players[playerId];
    setPromptAction({
      title: "Rename Player",
      placeholder: `Enter new name for ${player.name}:`,
      defaultValue: player.name,
      onConfirm: (newName) => {
        if (isDuplicateName(newName, playerId)) return;
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
        if (isDuplicateName(newName, bowlerId)) return;
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
        if (isDuplicateName(name)) return;
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

  const API_URL = import.meta.env.VITE_API_URL || "";

  const syncMatchState = async () => {
    if (matchId.startsWith("guest_") || !userToken) return;
    if (!innings.strikerId || !innings.nonStrikerId || !innings.currentBowlerId)
      return;
    if (isProcessingRef.current) return;

    try {
      const bOvers = innings.bowlers[innings.currentBowlerId]?.overs || 0;
      const bBalls = innings.bowlers[innings.currentBowlerId]?.balls || 0;

      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/update-score`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          matchId,
          inningId: !innings.id.startsWith("inn2_")
            ? innings.id
            : !initialState.id.startsWith("inn2_")
              ? initialState.id
              : innings.id,
          inningNumber: innings.inningNumber || 1,
          target: innings.target,
          battingTeamName: innings.battingTeamName,
          strikerName: striker.name,
          nonStrikerName: nonStriker.name,
          bowlerName: bowler.name,
          currentOvers: innings.overs,
          currentBalls: innings.balls,
          matchTotalOvers: totalOvers,
          explicitTotalRuns: Number(innings.totalRuns || 0),
          explicitTotalWickets: Number(innings.totalWickets || 0),
          previousInnings: previousInnings
            ? {
                id: previousInnings.id,
                battingTeamName: previousInnings.battingTeamName,
                totalRuns: previousInnings.totalRuns,
                totalWickets: previousInnings.totalWickets,
                overs: previousInnings.overs,
                balls: previousInnings.balls,
              }
            : undefined,
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

  // Auto-sync crease only when players or match duration change manually (not during ball scoring/undo)
  useEffect(() => {
    if (skipCreaseSyncRef.current) {
      skipCreaseSyncRef.current = false;
      return;
    }
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
    matchCompleted = false,
  ) => {
    if (matchId.startsWith("guest_") || !userToken) return;
    try {
      const b = finalInnings.bowlers[finalInnings.currentBowlerId];
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/update-score`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          matchId,
          inningId: !finalInnings.id.startsWith("inn2_")
            ? finalInnings.id
            : !initialState.id.startsWith("inn2_")
              ? initialState.id
              : finalInnings.id,
          inningNumber: finalInnings.inningNumber || 1,
          target: finalInnings.target,
          battingTeamName: finalInnings.battingTeamName,
          ballData: ball,
          strikerName: finalInnings.players[finalInnings.strikerId]?.name || "",
          nonStrikerName:
            finalInnings.players[finalInnings.nonStrikerId]?.name || "",
          bowlerName: b?.name || "",
          currentOvers: finalInnings.overs,
          currentBalls: finalInnings.balls,
          matchTotalOvers: totalOvers,
          explicitTotalRuns: finalInnings.totalRuns,
          explicitTotalWickets: finalInnings.totalWickets,
          matchCompleted,
          previousInnings: previousInnings
            ? {
                id: previousInnings.id,
                battingTeamName: previousInnings.battingTeamName,
                totalRuns: previousInnings.totalRuns,
                totalWickets: previousInnings.totalWickets,
                overs: previousInnings.overs,
                balls: previousInnings.balls,
              }
            : undefined,
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
    if (!innings.strikerId || !innings.nonStrikerId) {
      setModalView("BATTER_SELECT");
      return;
    }
    if (!innings.currentBowlerId) {
      setModalView("BOWLER_SELECT");
      return;
    }
    const validBattersCountNow = innings.battingOrder.filter(
      (id) => !innings.players[id]?.isOut,
    ).length;
    if (
      innings.overs >= totalOvers ||
      innings.totalWickets >= 10 ||
      validBattersCountNow < 2 ||
      Boolean(innings.target && innings.totalRuns >= innings.target)
    ) {
      return;
    }

    if (isProcessingRef.current && !fielderName) {
      actionQueueRef.current.push(() =>
        handleScore(runs, isWicket, wicketType, fielderName, outBatterId),
      );
      return;
    }

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
    const isRetirement =
      isWicket &&
      (wicketType === WicketType.RETIRED_HURT ||
        wicketType === WicketType.RETIRED_OUT);

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
    if (!isWide && !isRetirement) {
      nextStriker.ballsFaced += 1;
    }

    if (batterRuns === 4) nextStriker.fours += 1;
    if (batterRuns === 6) nextStriker.sixes += 1;

    // Update Bowler
    if (!isBye && !isLegBye) {
      nextBowler.runsConceded += totalRunsToAdd;
    }

    // Valid Ball Calculation
    const isValidBall = !isWide && !isNoBall && !isRetirement;
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

    const nextHistory = [...history, JSON.parse(JSON.stringify(innings))];
    skipCreaseSyncRef.current = true;
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
    setPendingExtra(ExtraType.NONE);
    setPendingWicketInfo(null);

    // Commentary
    let commentary = generateSimpleCommentary(newBallEvent);
    if (overCompleted && !isTargetChased && !isAllOut) {
      commentary += " End of over.";
    }
    setLastCommentary(commentary);

    if (isMatchEnding) {
      try {
        window.localStorage.setItem(
          getLiveKey(finalInnings.inningNumber),
          JSON.stringify({
            matchId,
            innings: finalInnings,
            history: nextHistory,
            lastCommentary: commentary,
          }),
        );
      } catch {
        // Ignore storage failure
      }
      isProcessingRef.current = false;
      setIsProcessing(false);
      void postScoreUpdate(
        newBallEvent,
        finalInnings,
        finalInnings.inningNumber === 2,
      );
      onInningsEnd(finalInnings);
      return;
    }

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

    try {
      await postScoreUpdate(newBallEvent, finalInnings);
    } finally {
      // Release the processing lock after the API call completes.
      isProcessingRef.current = false;
      setIsProcessing(false);
      processQueue();
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
  const ballsBowled = innings.overs * 6 + innings.balls;
  const crr =
    ballsBowled > 0
      ? ((innings.totalRuns / ballsBowled) * 6).toFixed(1)
      : "0.0";
  const totalBalls = totalOvers * 6;
  const ballsLeft = Math.max(0, totalBalls - ballsBowled);
  const runsNeeded = innings.target ? innings.target - innings.totalRuns : null;
  const rawRrr =
    runsNeeded !== null && ballsLeft > 0 ? (runsNeeded / ballsLeft) * 6 : null;
  const rrr = rawRrr !== null ? Math.max(0, rawRrr).toFixed(1) : null;
  const dls =
    previousInnings && previousInnings.totalRuns > 0
      ? calculateDlsParScore(
          previousInnings.totalRuns,
          innings.totalRuns,
          innings.totalWickets,
          ballsBowled,
          totalOvers,
        )
      : null;

  const validBattersCount = innings.battingOrder.filter(
    (id) => !innings.players[id]?.isOut,
  ).length;
  const isInningsComplete =
    innings.totalWickets >= 10 ||
    validBattersCount < 2 ||
    innings.overs >= totalOvers ||
    Boolean(innings.target && innings.totalRuns >= innings.target);
  const canUndo =
    history.length > 0 ||
    (innings.allBalls && innings.allBalls.length > 0) ||
    innings.overs > 0 ||
    innings.balls > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 overflow-hidden selection:bg-indigo-500/30">
      {!isInningsComplete && innings.strikerId === "" && (
        <BatterSelectModal
          innings={innings}
          onSelect={handleBatterSelected}
          onRename={handleRenamePlayer}
          onQuickAdd={handleQuickAddPlayer}
          onClose={() => setModalView("NONE")}
        />
      )}
      {!isInningsComplete &&
        innings.strikerId !== "" &&
        innings.nonStrikerId === "" && (
          <BatterSelectModal
            innings={innings}
            onSelect={handleBatterSelected}
            onRename={handleRenamePlayer}
            onQuickAdd={handleQuickAddPlayer}
            onClose={() => setModalView("NONE")}
          />
        )}
      {!isInningsComplete &&
        innings.strikerId !== "" &&
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
          onQuitMatch={onQuitMatch}
          totalOvers={totalOvers}
        />
      )}

      {/* Ultra-Slim Header (Fixed) */}
      <div className="shrink-0 text-white">
        <div className="max-w-5xl mx-auto w-full px-3 py-1.5">
          <div className="flex justify-between items-center gap-4">
            <div className="flex-1 overflow-hidden">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                <span className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest flex-shrink-0">
                  {innings.inningNumber === 1 ? "1st" : "2nd"} INN
                </span>
                <div className="flex items-center gap-1.5 text-white text-[11px] font-black tracking-widest uppercase flex-wrap">
                  <span className="text-slate-500 text-[8px] italic lowercase font-medium">
                    vs
                  </span>
                  <span
                    className="text-indigo-400 cursor-pointer hover:underline text-[10px] font-bold leading-tight"
                    onClick={() => handleRenameTeam(false)}
                  >
                    {innings.bowlingTeamName}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                <span className="w-full sm:w-auto text-lg sm:text-xl md:text-2xl font-black text-emerald-400 uppercase tracking-tighter mr-1 flex items-center gap-1 leading-tight break-words">
                  <span>🏏</span>
                  <span
                    className="cursor-pointer hover:underline"
                    onClick={() => handleRenameTeam(true)}
                  >
                    {innings.battingTeamName}
                  </span>
                </span>
                <span className="text-3xl md:text-4xl font-black tracking-tighter text-white tabular-nums">
                  {innings.totalRuns}
                  <span className="text-slate-500 mx-0.5 text-2xl md:text-3xl">
                    /
                  </span>
                  {innings.totalWickets}
                </span>
                <div className="flex items-center gap-1 text-indigo-400 font-black text-base md:text-lg leading-none tabular-nums group/overs">
                  <span>
                    ({innings.overs}.{innings.balls}
                  </span>
                  <span className="text-slate-600 text-xs mx-0.5">/</span>
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
                      <span>{totalOvers})</span>
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

            <div className="flex flex-col items-center justify-center shrink-0">
              <button
                onClick={() => setShowScoreboard(true)}
                className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md"
              >
                Scorecard 📋
              </button>
              {innings.inningNumber === 2 && Boolean(innings.target) && (
                <div className="flex flex-col items-center mt-1.5">
                  <span className="text-lg sm:text-xl md:text-2xl font-black text-amber-400 uppercase tracking-tight text-center leading-none whitespace-nowrap drop-shadow-sm">
                    {equation ? `🎯 ${equation}` : `TGT: ${innings.target}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* CRR / RRR / DLS Tab Row - Fixed in Header & Always 100% Visible */}
          <div className="mt-1.5 pt-1.5 border-t border-white/10">
            <div
              className={`grid ${dls ? "grid-cols-3" : "grid-cols-2"} gap-1.5 sm:gap-2`}
            >
              <div className="bg-slate-900/90 rounded-lg py-1 px-1 sm:px-2 text-center border border-white/10 shadow-sm">
                <div className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-wider">
                  CRR
                </div>
                <div className="text-sm md:text-base font-black text-white tabular-nums leading-tight mt-0.5">
                  {crr}
                </div>
              </div>
              {rrr !== null ? (
                <div className="bg-amber-500/10 rounded-lg py-1 px-1 sm:px-2 text-center border border-amber-500/30 shadow-sm">
                  <div className="text-[8px] md:text-[9px] font-black text-amber-500 uppercase tracking-wider">
                    RRR
                  </div>
                  <div className="text-sm md:text-base font-black text-amber-400 tabular-nums leading-tight mt-0.5">
                    {rrr}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/90 rounded-lg py-1 px-1 sm:px-2 text-center border border-white/10 shadow-sm">
                  <div className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-wider">
                    BALLS LEFT
                  </div>
                  <div className="text-sm md:text-base font-black text-white tabular-nums leading-tight mt-0.5">
                    {ballsLeft}
                  </div>
                </div>
              )}
              {dls && (
                <div
                  className={`rounded-lg py-1 px-1 sm:px-2 text-center border transition-all shadow-sm ${
                    dls.isAhead
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      : dls.isTied
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                        : "bg-red-500/15 border-red-500/40 text-red-300"
                  }`}
                >
                  <div className="text-[8px] md:text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-0.5">
                    <span>🌧️</span> DLS PAR
                  </div>
                  <div className="text-sm md:text-base font-black tabular-nums leading-tight mt-0.5">
                    {dls.parScore}
                  </div>
                  <div className="text-[7px] md:text-[8px] font-bold truncate opacity-90 leading-none mt-0.5">
                    {dls.statusText.replace(" (DLS)", "")}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Match Prediction — Fixed in Top Header along with stats */}
          <div className="mt-1">
            <AiMatchPrediction
              matchId={matchId}
              teamA={innings.battingTeamName}
              teamB={innings.bowlingTeamName}
              totalOvers={totalOvers}
              compact={true}
              inning={innings.inningNumber}
              currentScore={innings.totalRuns}
              wicketsLost={innings.totalWickets}
              targetScore={innings.target || -1}
              ballsBowled={innings.overs * 6 + innings.balls}
            />
          </div>
        </div>
      </div>

      {/* Main Live Dashboard Area — balanced and distributed, scrollable if needed */}
      <div
        ref={middleContainerRef}
        className="flex-1 min-h-0 overflow-y-auto w-full scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1 flex flex-col"
      >
        <div className="max-w-5xl mx-auto w-full px-3 py-1 flex-1 flex flex-col justify-evenly gap-2 sm:gap-2.5">
          {/* Active Player Cards */}
          <div className="grid grid-cols-2 gap-2">
            {/* Batters */}
            <div className="space-y-1.5">
              {[striker, nonStriker].map((b, idx) => (
                <div
                  key={b.id || idx}
                  className={`flex justify-between items-center px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all ${idx === 0 ? "bg-indigo-600 border-2 border-indigo-300 shadow-xl font-black" : "bg-slate-800 border-2 border-transparent opacity-85"}`}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 overflow-hidden flex-1 min-w-0 pr-1">
                    <span
                      className={`text-xs md:text-sm font-black truncate uppercase tracking-tight cursor-pointer hover:opacity-80 transition-opacity ${idx === 0 ? "text-white" : "text-slate-200"}`}
                      onClick={() => handleRenamePlayer(b.id)}
                    >
                      {b.name || "---"} {idx === 0 && "🏏"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-base md:text-xl font-black ${idx === 0 ? "text-white" : "text-slate-200"}`}
                      >
                        {b.runs}
                      </span>
                      <span
                        className={`text-[10px] md:text-xs font-black ${idx === 0 ? "text-indigo-100" : "text-slate-400"}`}
                      >
                        ({b.ballsFaced})
                      </span>
                    </div>
                    {idx === 0 && (
                      <button
                        type="button"
                        onClick={handleSwapEnds}
                        aria-label="Swap Strike Ends"
                        title="Swap Strike Ends"
                        className="ml-1 w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center bg-white/20 hover:bg-white text-white hover:text-indigo-950 rounded-lg text-xs border border-white/30 active:scale-90 transition-all shadow-md cursor-pointer"
                      >
                        🔄
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Bowlers */}
            <div className="space-y-1">
              <div className="flex justify-between items-center px-3 py-2.5 rounded-xl bg-slate-800 border border-white/10 shadow-inner h-full">
                <div className="flex flex-col min-w-0">
                  <div className="flex flex-col mb-1">
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-0.5 italic">
                      {innings.bowlingTeamName}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="w-1 h-2.5 bg-indigo-500 rounded-full"></span>
                      <span className="text-[9px] font-black text-slate-500 uppercase leading-none">
                        Bowler
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-xs md:text-sm font-black text-indigo-300 uppercase truncate cursor-pointer hover:text-white transition-colors"
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
                  <div className="text-[10px] md:text-xs font-black text-slate-500 tabular-nums uppercase mt-0.5">
                    ({bowler.overs}.{bowler.balls})
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Over Timeline */}
          <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-white/10 shadow-lg shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Over Timeline Balls */}
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide flex-1">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5 shrink-0 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  THIS OVER
                </span>
                {innings.currentOver.length === 0 ? (
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-white/10 bg-slate-800/80 flex items-center justify-center animate-pulse">
                      <span className="text-[10px] italic text-slate-400">
                        0
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider italic">
                      Waiting for ball...
                    </span>
                  </div>
                ) : (
                  (() => {
                    const legalBallsInOver = innings.currentOver.filter(
                      (ball: any) => {
                        const isRetHurt =
                          ball.wicketType === WicketType.RETIRED_HURT ||
                          String(ball.wicketType) === "RETIRED_HURT";
                        const isRetOut =
                          ball.wicketType === WicketType.RETIRED_OUT ||
                          String(ball.wicketType) === "RETIRED_OUT";
                        const extraType = String(
                          ball.extraType || ball.extra_type || "",
                        ).toUpperCase();
                        return (
                          !isRetHurt &&
                          !isRetOut &&
                          extraType !== "WIDE" &&
                          extraType !== "NO_BALL"
                        );
                      },
                    ).length;

                    return (
                      <>
                        {innings.currentOver.map((ball, idx) => {
                          const b = ball as any;
                          const isRetHurt =
                            b.wicketType === WicketType.RETIRED_HURT ||
                            String(b.wicketType) === "RETIRED_HURT";
                          const isRetOut =
                            b.wicketType === WicketType.RETIRED_OUT ||
                            String(b.wicketType) === "RETIRED_OUT";
                          const isWicket = b.isWicket || b.is_wicket;
                          const runs = Number(b.runs || 0);
                          const isExtra = b.isExtra || b.is_extra;
                          const extraType = String(
                            b.extraType || b.extra_type || "",
                          ).toUpperCase();

                          let badgeBg =
                            "bg-white text-slate-900 border-white shadow-sm";
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
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black border shadow-md transition-all animate-in zoom-in-75 duration-300 shrink-0 ${badgeBg}`}
                            >
                              {label}
                            </span>
                          );
                        })}
                        {legalBallsInOver < 6 &&
                          [...Array(6 - legalBallsInOver)].map((_, i) => (
                            <span
                              key={`empty-${i}`}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-white/10 bg-slate-800/80 text-slate-400 font-bold text-[10px] flex items-center justify-center shadow-inner shrink-0"
                            >
                              {legalBallsInOver + i + 1}
                            </span>
                          ))}
                      </>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Operations Cockpit (Fixed at Bottom) */}
      <div className="shrink-0 z-[90]">
        <div className="max-w-5xl mx-auto w-full px-3 pb-1">
          {isInningsComplete ? (
            <div className="my-2 rounded-2xl border border-indigo-500/30 bg-slate-900/90 p-3 sm:p-4 space-y-3 shadow-2xl">
              <div className="text-center">
                <div className="text-xs font-black uppercase tracking-[0.25em] text-indigo-400">
                  {innings.inningNumber === 1
                    ? "1st Innings Complete"
                    : "Innings Complete"}
                </div>
                <div className="text-sm text-slate-200 font-black mt-1">
                  {innings.battingTeamName}: {innings.totalRuns}/
                  {innings.totalWickets} ({innings.overs}.{innings.balls} Overs)
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className="h-16 sm:h-20 min-h-[64px] rounded-2xl bg-slate-800 hover:bg-slate-700 border-2 border-white/15 hover:border-indigo-400/50 text-white font-black text-base sm:text-lg uppercase tracking-wider italic active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-30 cursor-pointer"
                >
                  <span className="text-2xl text-indigo-400">↺</span>
                  <span>Undo Last Ball</span>
                </button>
                <button
                  type="button"
                  onClick={() => onInningsEnd(innings)}
                  className="h-16 sm:h-20 min-h-[64px] rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-2 border-indigo-300/70 text-white font-black text-base sm:text-lg uppercase tracking-wider italic active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_28px_rgba(99,102,241,0.65)] ring-2 ring-indigo-400/40 cursor-pointer"
                >
                  <span>
                    {innings.inningNumber === 1
                      ? "Proceed to 2nd Innings"
                      : "Complete Match"}
                  </span>
                  <span className="text-2xl">
                    {innings.inningNumber === 1 ? "🏏" : "🏆"}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Action Tabs */}
              <div className="grid grid-cols-4 border-b border-white/5 rounded-t-xl overflow-hidden bg-slate-900/40 border-t border-x border-white/5">
                <button
                  onClick={handleUndo}
                  disabled={!canUndo || isProcessing}
                  className="py-2.5 sm:py-2 flex flex-col items-center justify-center gap-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all border-r border-white/5 disabled:opacity-10 active:scale-95"
                >
                  <span className="text-base sm:text-lg text-indigo-400">
                    ↺
                  </span>
                  Undo
                </button>
                <button
                  onClick={() => setModalView("BOWLER_SELECT")}
                  className="py-2.5 sm:py-2 flex flex-col items-center justify-center gap-0.5 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all border-r border-white/5 active:scale-95"
                >
                  <span className="text-base sm:text-lg">🎾</span>
                  Change Bowler
                </button>
                <button
                  onClick={() => setModalView("BATTER_SELECT")}
                  className="py-2.5 sm:py-2 flex flex-col items-center justify-center gap-0.5 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all border-r border-white/5 active:scale-95"
                >
                  <span className="text-base sm:text-lg">🏏</span>
                  Change Batter
                </button>
                <button
                  onClick={() =>
                    innings.strikerId && setModalView("RETIRE_MODAL")
                  }
                  disabled={!innings.strikerId}
                  className={`py-2.5 sm:py-2 flex flex-col items-center justify-center gap-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${!innings.strikerId ? "opacity-40 cursor-not-allowed text-slate-600" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                >
                  <span className="text-base sm:text-lg">🚪</span>
                  Retire
                </button>
              </div>

              {/* Input Hub */}
              <div className="py-2 space-y-2">
                {/* Extras Console */}
                <div className="grid grid-cols-4 gap-2 mb-1">
                  {["WIDE", "NO_BALL", "BYE", "LEG_BYE"].map((type) => {
                    const isActive = pendingExtra === (type as ExtraType);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          const next = isActive
                            ? ExtraType.NONE
                            : (type as ExtraType);
                          setPendingExtra(next);
                          if (next !== ExtraType.NONE) {
                            setModalView("EXTRA_RUNS");
                          }
                        }}
                        className={`h-12 min-h-[48px] py-1.5 px-2 rounded-xl text-xs sm:text-sm font-black border transition-all uppercase tracking-tighter leading-none flex items-center justify-center active:scale-95 ${isActive ? "bg-amber-500 text-slate-950 border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.6)] font-black" : "bg-slate-900 text-amber-400 border-amber-500/30 hover:border-amber-400 hover:text-amber-300"}`}
                      >
                        {type.replace("_", " ")}
                      </button>
                    );
                  })}
                </div>
                {/* Keypad */}
                <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
                  {[0, 1, 2, 3].map((run) => (
                    <button
                      key={run}
                      type="button"
                      onClick={() => handleScore(run)}
                      className="h-16 sm:h-[4.25rem] lg:h-[4.5rem] min-h-[64px] rounded-2xl md:rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-500 hover:bg-slate-700 text-white font-black text-3xl sm:text-4xl active:scale-95 transition-all shadow-lg"
                    >
                      {run}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleScore(4)}
                    className="h-16 sm:h-[4.25rem] lg:h-[4.5rem] min-h-[64px] rounded-2xl md:rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-black text-3xl sm:text-4xl active:scale-95 transition-all shadow-[0_0_15px_rgba(6,182,212,0.6)] border border-cyan-400/50"
                  >
                    4
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScore(5)}
                    className="h-16 sm:h-[4.25rem] lg:h-[4.5rem] min-h-[64px] rounded-2xl md:rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-black text-3xl sm:text-4xl active:scale-95 transition-all shadow-[0_0_15px_rgba(245,158,11,0.6)] border border-amber-400/50"
                  >
                    5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScore(6)}
                    className="h-16 sm:h-[4.25rem] lg:h-[4.5rem] min-h-[64px] rounded-2xl md:rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-black text-3xl sm:text-4xl active:scale-95 transition-all shadow-[0_0_18px_rgba(168,85,247,0.7)] border border-purple-400/50"
                  >
                    6
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalView("WICKET_TYPE")}
                    className="h-16 sm:h-[4.25rem] lg:h-[4.5rem] min-h-[64px] rounded-2xl md:rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-3xl sm:text-4xl active:scale-95 transition-all shadow-[0_0_18px_rgba(239,68,68,0.7)] border border-red-500/50"
                  >
                    W
                  </button>
                </div>
              </div>
            </>
          )}
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
