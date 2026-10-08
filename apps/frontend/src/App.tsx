import React, { useState, useEffect, useRef } from "react";
import {
  InningsState,
  MatchStatus,
  TeamData,
  Player,
  Bowler,
  BallEvent,
} from "./types";
import MatchSetup from "./components/MatchSetup";
import MatchView from "./components/MatchView";
import LiveScoreboard from "./components/LiveScoreboard";
import AdminPanel from "./components/AdminPanel";
import { Authenticator, useAuthenticator } from "@aws-amplify/ui-react";
import {
  fetchAuthSession,
  signOut,
  signUp,
  signIn,
  fetchUserAttributes,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { ChatComponent } from "./components/ChatComponent";
import { hasCognitoAuthConfig } from "./authConfig";
import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
  safeSessionStorageGet,
  safeSessionStorageSet,
} from "./utils/storageSafety";

// Key helper for saving match state by email
const getMatchStateKey = (email: string) =>
  `cric-match-state-${email.toLowerCase().trim()}`;

export const isGuestEmail = (email?: string | null) =>
  Boolean(
    email &&
    email.trim().toLowerCase().startsWith("guest-") &&
    email.trim().toLowerCase().endsWith("@cricscore.local"),
  );

export const decodeJwtPayload = (token: string | null | undefined) => {
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(
      payload.length + ((4 - (payload.length % 4)) % 4),
      "=",
    );
    const decoded = atob(padded);
    return JSON.parse(
      decodeURIComponent(
        Array.from(decoded)
          .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
          .join(""),
      ),
    );
  } catch {
    return null;
  }
};

export const getStoredAuthFromLocalStorage = () => {
  if (typeof window === "undefined") return { token: null, email: null };

  const keys = Object.keys(window.localStorage);
  const lastAuthUserKey = keys.find((key) => key.endsWith(".LastAuthUser"));

  if (lastAuthUserKey) {
    const userId = window.localStorage.getItem(lastAuthUserKey);
    if (userId) {
      const baseKey = lastAuthUserKey.replace(/\.LastAuthUser$/, "");
      const tokenKey = `${baseKey}.${userId}.idToken`;
      const token = window.localStorage.getItem(tokenKey);
      const payload = decodeJwtPayload(token);
      const email =
        payload?.email?.toString() ||
        payload?.["cognito:username"]?.toString() ||
        null;

      return { token: token || null, email: email || null };
    }
  }

  const idTokenKey = keys.find(
    (key) => key.endsWith(".idToken") || key.includes("idToken"),
  );

  if (!idTokenKey) return { token: null, email: null };

  const token = window.localStorage.getItem(idTokenKey);
  const payload = decodeJwtPayload(token);
  const email =
    payload?.email?.toString() ||
    payload?.["cognito:username"]?.toString() ||
    null;

  return { token: token || null, email: email || null };
};

const authFormFields = {
  signUp: {
    username: {
      label: "Email (Username)",
      placeholder: "your@email.com",
      isRequired: true,
      order: 1,
    },
    password: {
      label: "Password",
      placeholder: "Min 8 chars, upper+lower+number+special",
      isRequired: true,
      order: 2,
    },
    confirm_password: {
      label: "Confirm Password",
      placeholder: "Re-enter your password",
      isRequired: true,
      order: 3,
    },
    given_name: {
      label: "First Name",
      placeholder: "First name",
      isRequired: true,
      order: 4,
    },
    family_name: {
      label: "Last Name",
      placeholder: "Last name",
      isRequired: true,
      order: 5,
    },
  },
  signIn: {
    username: {
      label: "Email (Username)",
      placeholder: "your@email.com",
    },
    password: {
      label: "Password",
      placeholder: "Enter your password",
    },
  },
};

export const canAccessScorer = ({
  shouldBypassAuth,
  isGuestScorer,
  userToken,
  userEmail,
}: {
  shouldBypassAuth: boolean;
  isGuestScorer: boolean;
  userToken?: string | null;
  userEmail?: string | null;
}) =>
  shouldBypassAuth ||
  isGuestScorer ||
  Boolean(userToken) ||
  Boolean(userEmail && userEmail.trim());

const App: React.FC = () => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isGuestScorer, setIsGuestScorer] = useState(false);

  const [emailTo, setEmailTo] = useState("");
  const [hasRestored, setHasRestored] = useState(false);

  const isRestoringRef = React.useRef(false);
  const isEndingInningsRef = React.useRef(false);
  const prevEmailRef = React.useRef<string | null>(null); // track identity changes

  // Auto-position cursor before @gmail.com when modal opens
  const [view, setView] = useState<
    "VIEWER" | "SCORER" | "ADMIN_PANEL" | "CHAT"
  >(() => (safeSessionStorageGet("last_view") as any) || "VIEWER");
  const [showMatchMenu, setShowMatchMenu] = useState(false);
  const matchMenuRef = useRef<HTMLDivElement>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Security: Auto-open modal if unauthorized on a restricted view
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        const fallbackAuth = getStoredAuthFromLocalStorage();
        const effectiveToken = token || fallbackAuth.token;

        if (effectiveToken) {
          setUserToken(effectiveToken);
          const payload =
            session.tokens?.idToken?.payload ||
            decodeJwtPayload(effectiveToken);
          let emailStr = payload?.email?.toString() || fallbackAuth.email || "";

          if (!emailStr) {
            try {
              const attributes = await fetchUserAttributes();
              emailStr = attributes.email || "";
            } catch (e) {
              console.warn("Failed to fetch user attributes", e);
            }
          }

          setUserEmail(emailStr || null);
          const groups = (payload?.["cognito:groups"] as string[]) || [];

          setIsAdmin(groups.includes("Admin"));
          if (emailStr) {
            setEmailTo(emailStr);
          }
        } else {
          setUserToken(null);
          setIsAdmin(false);
          setUserEmail(null);
        }
      } catch (err) {
        const fallbackAuth = getStoredAuthFromLocalStorage();
        if (fallbackAuth.token && fallbackAuth.email) {
          setUserToken(fallbackAuth.token);
          setUserEmail(fallbackAuth.email);
          setIsAdmin(false);
          if (fallbackAuth.email) {
            setEmailTo(fallbackAuth.email);
          }
          return;
        }

        setUserToken(null);
        setIsAdmin(false);
        setUserEmail(null);
      }
    };

    checkSession();
    const unsubscribe = Hub.listen("auth", (data) => {
      if (
        data.payload.event === "signedIn" ||
        data.payload.event === "signedOut"
      ) {
        checkSession();
      }
    });

    return unsubscribe;
  }, []);

  // Reset match state when a DIFFERENT user logs in (e.g. guest → real account)
  useEffect(() => {
    const currentEmail = userEmail;
    const prevEmail = prevEmailRef.current;

    if (prevEmail !== null && currentEmail !== prevEmail) {
      // User identity changed — clear all match state so stale data doesn't bleed across sessions
      console.log(
        `🔄 User changed from ${prevEmail} to ${currentEmail} — resetting match state`,
      );
      setMatchStatus(MatchStatus.SETUP);
      setMatchId(null);
      setTeamA(null);
      setTeamB(null);
      setCurrentInnings(null);
      setPreviousInnings(undefined);
      setHasSentAutoEmail(false);
      setHasRestored(false);
      setHubKey((k) => k + 1); // Force LiveScoreboard to refresh
    }
    prevEmailRef.current = currentEmail;
  }, [userEmail]);
  const [hubKey, setHubKey] = useState(0); // For forcing reset to list
  const [urlMatchId, setUrlMatchId] = useState<string | null>(null);
  const [matchStatus, setMatchStatus] = useState<MatchStatus>(
    MatchStatus.SETUP,
  );

  const getAuthHeaders = async () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    let token = userToken;
    if (!token) {
      try {
        const session = await fetchAuthSession();
        token = session.tokens?.idToken?.toString() || null;
      } catch (e) {
        // Ignore session fetch error
      }
    }
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (userEmail && userEmail.startsWith("guest-")) {
      headers["X-Guest-Email"] = userEmail;
    }
    return headers;
  };
  const [currentInnings, setCurrentInnings] = useState<InningsState | null>(
    null,
  );
  const [previousInnings, setPreviousInnings] = useState<
    InningsState | undefined
  >(undefined);

  // Match Config
  const [teamA, setTeamA] = useState<TeamData | null>(null);
  const [teamB, setTeamB] = useState<TeamData | null>(null);
  const [totalOvers, setTotalOvers] = useState(1);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [hasSentAutoEmail, setHasSentAutoEmail] = useState<boolean>(false);
  const hasSentAutoEmailRef = useRef(false);

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const canUseAuth = hasCognitoAuthConfig();
  const shouldBypassAuth = !canUseAuth;
  const hasAuthenticatedUser = Boolean(userToken || userEmail);
  const canAccessScorerView = canAccessScorer({
    shouldBypassAuth,
    isGuestScorer,
    userToken,
    userEmail,
  });

  const SignInFooter = () => {
    const { toForgotPassword } = useAuthenticator();
    return (
      <div className="text-center space-y-3 pt-3 border-t border-slate-800/80 mt-3">
        <div>
          <button
            type="button"
            onClick={toForgotPassword}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
          >
            Forgot your password?
          </button>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setIsGuestScorer(true)}
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            🎮 Continue as Guest (Start & Score Match)
          </button>
        </div>
      </div>
    );
  };

  const authComponents = {
    SignIn: {
      Footer: SignInFooter,
    },
    SignUp: {
      Footer: () => (
        <div className="text-center pt-3 border-t border-slate-800/80 mt-3">
          <button
            type="button"
            onClick={() => setIsGuestScorer(true)}
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            🎮 Continue as Guest (Start & Score Match)
          </button>
        </div>
      ),
    },
  };

  // Helper to load match state based on email
  const applyLoadedState = (saved: any) => {
    if (!saved) {
      setMatchStatus(MatchStatus.SETUP);
      setMatchId(null);
      setTeamA(null);
      setTeamB(null);
      setTotalOvers(15);
      setPreviousInnings(undefined);
      setCurrentInnings(null);
      setHasSentAutoEmail(false);
      return;
    }

    // ✅ Never restore a COMPLETED match — always start fresh on next login.
    if (saved.matchStatus === MatchStatus.COMPLETED) {
      console.log("🏁 Previous match COMPLETED. Starting fresh session.");
      safeLocalStorageRemove(getMatchStateKey(emailTo));
      applyLoadedState(null);
      return;
    }

    setMatchStatus(saved.matchStatus ?? MatchStatus.SETUP);
    setMatchId(saved.matchId ?? null);
    setTeamA(saved.teamA ?? null);
    setTeamB(saved.teamB ?? null);
    setTotalOvers(saved.totalOvers ?? 15);
    setPreviousInnings(saved.previousInnings ?? undefined);
    setCurrentInnings(saved.currentInnings ?? null);
    setHasSentAutoEmail(saved.hasSentAutoEmail ?? false);
  };

  // Restore on mount for Scorer if already authorized (session refresh)
  useEffect(() => {
    const init = async () => {
      if (userToken && emailTo && !hasRestored) {
        setHasRestored(true);
        isRestoringRef.current = true;
        const savedRaw = safeLocalStorageGet(getMatchStateKey(emailTo));
        if (savedRaw) {
          try {
            const saved = JSON.parse(savedRaw);
            applyLoadedState(saved);

            if (saved.matchId) {
              setView("SCORER"); // Auto-resume view
              const API_URL = import.meta.env.VITE_API_URL || "";
              const res = await fetch(
                `${API_URL}/match/${saved.matchId}/details`,
              );
              if (res.status === 404) {
                console.warn(
                  "Match not found in Cloud! 🗑️ It may have been deleted by an Admin.",
                );
                // Force Wipe Stale Local Data
                safeLocalStorageRemove(getMatchStateKey(emailTo));
                applyLoadedState(null);
                setView("VIEWER"); // Revert if match deleted
              }
            }
          } catch (e) {
            console.error("Restore failed:", e);
          }
        }

        setTimeout(() => {
          isRestoringRef.current = false;
        }, 500);
      }
    };
    init();
  }, [userToken, emailTo, hasRestored]);

  useEffect(() => {
    // Handle direct links to matches via URL ?matchId=xxx
    const params = new URLSearchParams(window.location.search);
    const mId = params.get("matchId");
    if (mId) {
      console.log("🔗 Deep Link Captured:", mId);
      setUrlMatchId(mId);

      if (!!userToken) {
        // Scorers can also jump to a match directly
        resumeMatch(mId);
        setView("SCORER");
      }
    } else if (window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [userToken]);

  // Handle view persistence or role-based logic updates here if needed

  useEffect(() => {
    // Only save persistence if we are in Scorer view and NOT in the middle of a reset/restore
    if (userToken && emailTo && view === "SCORER" && !isRestoringRef.current) {
      const stateToSave = {
        matchStatus,
        matchId,
        teamA,
        teamB,
        totalOvers,
        previousInnings,
        currentInnings,
        hasSentAutoEmail,
        completedAt: matchStatus === MatchStatus.COMPLETED ? Date.now() : null,
      };
      safeLocalStorageSet(
        getMatchStateKey(emailTo),
        JSON.stringify(stateToSave),
      );
    }
  }, [
    matchStatus,
    matchId,
    teamA,
    teamB,
    totalOvers,
    previousInnings,
    currentInnings,
    view,
    hasSentAutoEmail,
    emailTo,
    userToken,
  ]);

  // Persist the current view globally
  useEffect(() => {
    safeSessionStorageSet("last_view", view);
    setShowMatchMenu(false);
    setShowProfileMenu(false);
  }, [view]);

  // Close match menu when clicking outside
  useEffect(() => {
    if (!showMatchMenu) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        matchMenuRef.current &&
        !matchMenuRef.current.contains(e.target as Node)
      ) {
        setShowMatchMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showMatchMenu]);

  // Close profile menu when clicking outside
  useEffect(() => {
    if (!showProfileMenu) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showProfileMenu]);

  // 🕒 Auto-Cleanup Timer: If user stays on Completed screen for 5 mins, reset to setup
  useEffect(() => {
    if (matchStatus === MatchStatus.COMPLETED && view === "SCORER") {
      const timer = setTimeout(
        () => {
          console.log("🕒 Foreground TTL expired. Resetting to Setup.");
          safeLocalStorageRemove(getMatchStateKey(emailTo));
          applyLoadedState(null);
        },
        5 * 60 * 1000,
      ); // 5 Minutes
      return () => clearTimeout(timer);
    }
  }, [matchStatus, view]);

  // Helper to create an innings
  const createInnings = (
    id: string,
    battingTeam: TeamData,
    bowlingTeam: TeamData,
    inningNumber: 1 | 2,
    target?: number,
  ): InningsState => {
    // Initialize Batting Players
    const playersMap: Record<string, Player> = {};
    const battingOrder: string[] = [];
    battingTeam.players.forEach((name, idx) => {
      const playerId = `bat_${battingTeam.name.replace(/\s/g, "")}_${idx}`;
      playersMap[playerId] = {
        id: playerId,
        name: name,
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
      };
      battingOrder.push(playerId);
    });

    // Initialize Bowlers (from Bowling Team Squad)
    const bowlersMap: Record<string, Bowler> = {};
    const bowlingOrder: string[] = [];
    bowlingTeam.players.forEach((name, idx) => {
      const bowlerId = `bowl_${bowlingTeam.name.replace(/\s/g, "")}_${idx}`;
      bowlersMap[bowlerId] = {
        id: bowlerId,
        name: name,
        overs: 0,
        balls: 0,
        maidens: 0,
        runsConceded: 0,
        wickets: 0,
      };
      bowlingOrder.push(bowlerId);
    });

    return {
      id,
      inningNumber,
      target,
      battingTeamName: battingTeam.name,
      bowlingTeamName: bowlingTeam.name,
      totalRuns: 0,
      totalWickets: 0,
      overs: 0,
      balls: 0,
      currentOver: [],
      allBalls: [],
      strikerId: "",
      nonStrikerId: "",
      currentBowlerId: "",
      players: playersMap,
      bowlers: bowlersMap,
      battingOrder,
      bowlingOrder,
    };
  };

  const startMatch = (
    tA: TeamData,
    tB: TeamData,
    overs: number,
    batFirstTeamName: string,
    mId: string,
    iId: string,
    email: string,
  ) => {
    setTeamA(tA);
    setTeamB(tB);
    setTotalOvers(overs);
    setMatchId(mId);
    setEmailTo(email);

    const isTeamABatting = tA.name === batFirstTeamName;
    const battingTeam = isTeamABatting ? tA : tB;
    const bowlingTeam = isTeamABatting ? tB : tA;

    const innings1 = createInnings(iId, battingTeam, bowlingTeam, 1);
    setCurrentInnings(innings1);
    setPreviousInnings(undefined);
    setMatchStatus(MatchStatus.LIVE);
    window.history.replaceState({}, "", window.location.pathname);
  };

  const handleInningsEnd = async (completedInnings: InningsState) => {
    if (completedInnings.inningNumber === 1) {
      if (isEndingInningsRef.current) return;
      isEndingInningsRef.current = true;

      // Transition to 2nd Innings
      setPreviousInnings(completedInnings);

      if (!teamA || !teamB || !matchId) {
        isEndingInningsRef.current = false;
        return;
      }

      const nextBattingTeam =
        completedInnings.battingTeamName === teamA.name ? teamB : teamA;
      const nextBowlingTeam =
        completedInnings.battingTeamName === teamA.name ? teamA : teamB;

      const target = completedInnings.totalRuns + 1;

      const API_URL = import.meta.env.VITE_API_URL || "";

      try {
        const headers = await getAuthHeaders();
        const response = await fetch(
          `${API_URL}/match/${encodeURIComponent(matchId)}/innings`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              matchId,
              inningNumber: 2,
              battingTeam: nextBattingTeam.name,
              bowlingTeam: nextBowlingTeam.name,
              target,
              battingSquad: nextBattingTeam.players,
              bowlingSquad: nextBowlingTeam.players,
            }),
          },
        );
        const { inningId: id2 } = await response.json();
        const innings2 = createInnings(
          id2,
          nextBattingTeam,
          nextBowlingTeam,
          2,
          target,
        );
        setCurrentInnings(innings2);
        setMatchStatus(MatchStatus.INNINGS_BREAK);
      } catch (err) {
        console.error("Failed to create 2nd Innings:", err);
      } finally {
        isEndingInningsRef.current = false;
      }
    } else {
      setCurrentInnings(completedInnings);
      setMatchStatus(MatchStatus.COMPLETED);

      // Sync final match status + winner to DB
      if (matchId) {
        const API_URL = import.meta.env.VITE_API_URL || "";
        try {
          // Compute winner string from completedInnings (2nd innings)
          const target = completedInnings.target || 0;
          let matchWinner = "";
          if (completedInnings.totalRuns >= target) {
            matchWinner = `${completedInnings.battingTeamName} WON BY ${10 - completedInnings.totalWickets} WICKETS`;
          } else {
            const runDiff = target - 1 - completedInnings.totalRuns;
            matchWinner =
              runDiff === 0
                ? "MATCH TIED"
                : `${completedInnings.bowlingTeamName} WON BY ${runDiff} RUNS`;
          }
          const headers = await getAuthHeaders();
          await fetch(`${API_URL}/match/${encodeURIComponent(matchId)}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              status: MatchStatus.COMPLETED,
              matchWinner,
              finalInnings: {
                id: completedInnings.id,
                totalRuns: completedInnings.totalRuns,
                totalWickets: completedInnings.totalWickets,
                overs: completedInnings.overs,
                balls: completedInnings.balls,
              },
              previousInnings: previousInnings
                ? {
                    id: previousInnings.id,
                    totalRuns: previousInnings.totalRuns,
                    totalWickets: previousInnings.totalWickets,
                    overs: previousInnings.overs,
                    balls: previousInnings.balls,
                  }
                : undefined,
            }),
          });
          console.log(
            "Match Status + Winner Updated to COMPLETED ✅",
            matchWinner,
          );
        } catch (err) {
          console.error("Failed to update match status:", err);
        }
      }
    }
  };

  const resumeMatch = async (mId: string) => {
    const API_URL = import.meta.env.VITE_API_URL || "";
    try {
      console.log("Resuming Match...", mId);
      const response = await fetch(
        `${API_URL}/match/${encodeURIComponent(mId)}/details`,
      );
      const data = await response.json();

      const { match, innings } = data;
      if (!match) return;

      // 1. Reconstruct Teams
      // Note: Since Squads aren't strictly stored as a separate list of names in the 'matches' table,
      // we'll infer them from the innings player/bowler records.
      const tA: TeamData = { name: match.team_a_name, players: [] };
      const tB: TeamData = { name: match.team_b_name, players: [] };

      // Find squads from first innings
      if (innings.length > 0) {
        const firstInn = innings[0];
        const isTeamABattingFirst = firstInn.batting_team_name === tA.name;

        const battingSquad = firstInn.players.map((p: any) => p.name);
        const bowlingSquad = firstInn.bowlers.map((b: any) => b.name);

        if (isTeamABattingFirst) {
          tA.players = battingSquad;
          tB.players = bowlingSquad;
        } else {
          tB.players = battingSquad;
          tA.players = bowlingSquad;
        }
      }

      setTeamA(tA);
      setTeamB(tB);
      setTotalOvers(match.total_overs);
      setMatchId(mId);
      setAiSummary(match.ai_summary || null);

      // 2. Reconstruct Innings State
      const mapInnings = (inn: any): InningsState => {
        const playersMap: Record<string, Player> = {};
        const battingOrder: string[] = [];
        inn.players.forEach((p: any) => {
          playersMap[p.id] = {
            id: p.id,
            name: p.name,
            runs: p.runs,
            ballsFaced: p.balls_faced,
            fours: p.fours,
            sixes: p.sixes,
            isOut: p.is_out,
            wicketBy: p.wicket_by,
            wicketType: p.wicket_type as any,
            fielderName: p.fielder_name,
          };
          battingOrder.push(p.id);
        });

        const bowlersMap: Record<string, Bowler> = {};
        const bowlingOrder: string[] = [];
        inn.bowlers.forEach((b: any) => {
          bowlersMap[b.id] = {
            id: b.id,
            name: b.name,
            overs: b.overs_completed,
            balls: b.balls,
            maidens: b.maidens,
            runsConceded: b.runs_conceded,
            wickets: b.wickets,
          };
          bowlingOrder.push(b.id);
        });

        // Mapping Ball Events
        const allMappedBalls: BallEvent[] = (inn.allBalls || []).map(
          (alt: any) => ({
            id: alt.id,
            overNumber: alt.over_number,
            ballNumber: alt.ball_number,
            bowlerName: alt.bowler_name,
            batterName: alt.batter_name,
            runs: alt.runs,
            isExtra: alt.is_extra,
            extraType: alt.extra_type as any,
            extraRuns: alt.extra_runs,
            isWicket: alt.is_wicket,
            wicketType: alt.wicket_type as any,
            fielderName: alt.fielder_name,
            commentary: alt.commentary,
          }),
        );

        const currentOver = allMappedBalls.filter(
          (b) => b.overNumber === inn.overs,
        );

        return {
          id: inn.id,
          inningNumber: inn.inning_number,
          target: inn.target,
          battingTeamName: inn.batting_team_name,
          bowlingTeamName: inn.bowling_team_name,
          totalRuns: Number(inn.total_runs || 0),
          totalWickets: Number(inn.total_wickets || 0),
          overs: Number(inn.overs || 0),
          balls: Number(inn.balls || 0),
          currentOver,
          allBalls: allMappedBalls,
          strikerId: inn.striker_name
            ? inn.players.find((p: any) => p.name === inn.striker_name)?.id ||
              ""
            : "",
          nonStrikerId: inn.non_striker_name
            ? inn.players.find((p: any) => p.name === inn.non_striker_name)
                ?.id || ""
            : "",
          currentBowlerId: inn.current_bowler_name
            ? inn.bowlers.find((b: any) => b.name === inn.current_bowler_name)
                ?.id || ""
            : "",
          players: playersMap,
          bowlers: bowlersMap,
          battingOrder,
          bowlingOrder,
        };
      };

      if (innings.length === 1) {
        setCurrentInnings(mapInnings(innings[0]));
        setPreviousInnings(undefined);
        setMatchStatus(MatchStatus.LIVE);
      } else if (innings.length === 2) {
        setPreviousInnings(mapInnings(innings[0]));
        const inn2 = mapInnings(innings[1]);
        setCurrentInnings(inn2);

        // If it's already COMPLETED in DB, stay there.
        // Otherwise if 2nd inn started but match isn't completed, mark as LIVE.
        if (match.status === "COMPLETED") {
          setMatchStatus(MatchStatus.COMPLETED);
        } else if (
          inn2.totalRuns === 0 &&
          inn2.overs === 0 &&
          inn2.balls === 0
        ) {
          setMatchStatus(MatchStatus.INNINGS_BREAK);
        } else {
          setMatchStatus(MatchStatus.LIVE);
        }
      }

      console.log("Match Resumed ✅");
    } catch (err) {
      console.error("Failed to resume match:", err);
      setAlertMessage("Resuming match failed. Please try again.");
    }
  };

  const resetMatch = () => {
    setMatchStatus(MatchStatus.SETUP);
    setCurrentInnings(null);
    setPreviousInnings(undefined);
    setTeamA(null);
    setTeamB(null);
    setMatchId(null);
    setHasSentAutoEmail(false);
    setHubKey((k) => k + 1);
    window.history.replaceState({}, "", window.location.pathname);
  };

  const handleQuitMatch = () => {
    safeLocalStorageRemove(getMatchStateKey(emailTo));
    resetMatch();
    setView("VIEWER");
  };

  const forceResetMatch = async () => {
    if (matchId && matchStatus !== MatchStatus.COMPLETED) {
      try {
        const API_URL = import.meta.env.VITE_API_URL || "";
        const headers = await getAuthHeaders();
        // Fire and forget delete so UI isn't blocked by network
        fetch(`${API_URL}/match/${encodeURIComponent(matchId)}`, {
          method: "DELETE",
          headers,
        }).catch((e) => console.error("Failed to delete abandoned match", e));
      } catch (err) {
        console.error(err);
      }
    }
    resetMatch();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUserToken(null);
      setIsAdmin(false);
      setUserEmail(null);
      setView("VIEWER");
    } catch (e) {
      console.error("Sign out error", e);
    }
  };

  const handleViewClick = (target: "VIEWER" | "SCORER" | "ADMIN" | "CHAT") => {
    if (target === "ADMIN") {
      setView("ADMIN_PANEL");
    } else {
      setView(target);
    }
  };

  const updateMatchOvers = async (newOvers: number) => {
    if (!matchId) return;
    setTotalOvers(newOvers);
    const API_URL = import.meta.env.VITE_API_URL || "";
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/match/${encodeURIComponent(matchId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ totalOvers: newOvers }),
      });
      console.log("Match Overs Updated 📡");
    } catch (err) {
      console.error("Failed to update match overs:", err);
    }
  };

  const getWinnerMessage = () => {
    if (!currentInnings || !previousInnings) return "";

    const target = currentInnings.target || 0;
    if (currentInnings.totalRuns >= target) {
      return `${currentInnings.battingTeamName} WON BY ${10 - currentInnings.totalWickets} WICKETS`;
    } else {
      const runDiff = target - 1 - currentInnings.totalRuns;
      if (runDiff === 0) return "MATCH TIED!";
      return `${currentInnings.bowlingTeamName} WON BY ${runDiff} RUNS`;
    }
  };

  const [copyFeedback, setCopyFeedback] = useState(false);

  const copyMatchLink = () => {
    if (!matchId) return;
    const shareUrl = `${window.location.origin}?matchId=${matchId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleSendEmail = async (silent = false, sendToAdmin = false) => {
    if (!currentInnings || !matchId) return;

    const API_URL = import.meta.env.VITE_API_URL || "";

    try {
      const reportState = {
        innings: [
          ...(previousInnings ? [previousInnings] : []),
          currentInnings,
        ],
      };

      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_URL}/match/${encodeURIComponent(matchId)}/email`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            emailTo,
            origin: window.location.origin,
            reportState,
            sendToAdmin,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) throw new Error();

      if (!silent) {
        if (data.scorerSent) {
          setAlertMessage(
            "✨ FANCY REPORT SENT!\nCheck your inbox for the official scorecard.",
          );
        } else if (data.adminSent) {
          setAlertMessage(
            "📡 ADMIN COPY SENT!\nYour automated report is pending AWS approval. A copy was sent to the tournament master for verification.",
          );
        }
      } else {
        console.log(
          `Email Sync - Admin: ${data.adminSent}, Scorer: ${data.scorerSent}`,
        );
      }
    } catch (err) {
      console.error("Email API failed:", err);
      if (!silent) {
        const subject = encodeURIComponent(
          `🏆 FINAL RESULT: ${previousInnings?.battingTeamName || "Team"} vs ${currentInnings.battingTeamName}`,
        );
        const body = encodeURIComponent(
          `🏆 VIEW FANCY SCORECARD:\n${window.location.origin}?matchId=${encodeURIComponent(matchId)}\n\n(Cloud email service requires manual verification. Please forward this link!)`,
        );
        window.location.assign(
          `mailto:${encodeURIComponent(emailTo)}?subject=${subject}&body=${body}`,
        );
      }
    }
  };

  const handleGenerateAiSummary = async (forceRefresh: boolean = false) => {
    if (!matchId) return;
    setIsGeneratingAi(true);
    setAiSummary(null); // Instantly clear stale text so loading indicator shows
    const API_URL = import.meta.env.VITE_API_URL || "";
    try {
      const headers = await getAuthHeaders();

      // ALWAYS send matchData so summaryHandler receives exact, instant final stats (no SQS lag)
      const requestBody: any = {
        matchId,
        forceRefresh,
        matchData: {
          teamAName: teamA?.name,
          teamBName: teamB?.name,
          tossWinner: teamA?.name,
          previousInnings,
          currentInnings,
          winnerMessage: getWinnerMessage(),
          status: matchStatus,
        },
      };

      const response = await fetch(`${API_URL}/chat/summary`, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate");

      const finalSummary = data.summary;

      setAiSummary(finalSummary);
      return data;
    } catch (error) {
      console.error(error);
      setAlertMessage("Failed to generate AI summary.");
      throw error;
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Auto-trigger email and AI summary on match completion
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (matchStatus === MatchStatus.COMPLETED) {
      if (!hasSentAutoEmail && !hasSentAutoEmailRef.current) {
        hasSentAutoEmailRef.current = true;
        setHasSentAutoEmail(true);
        setAiSummary(null); // Instantly purge live 0/0 summary

        const isGuest = !userToken && matchId?.startsWith("guest_");

        if (isGuest) {
          // Guest matches: generate AI summary locally (no DB), skip email
          setTimeout(() => {
            handleGenerateAiSummary(true).catch(() => {
              setAiSummary(
                "AI summary is only available for registered scorers. Sign up to unlock post-match analytics! 🎯",
              );
            });
          }, 1000);
        } else {
          // 🕰️ Wait 2 seconds to ensure backend state is settled, then generate AI summary
          // AND ONLY AFTER AI summary finishes & saves to DB, dispatch the report email!
          setTimeout(() => {
            handleGenerateAiSummary(true)
              .then(() => {
                console.log(
                  "✅ AI Summary generated & saved to DB. Dispatching report email...",
                );
                return handleSendEmail(true, true);
              })
              .catch((err) => {
                console.error(
                  "AI Summary generation failed before email dispatch:",
                  err,
                );
                // Fallback: send report email even if AI summary generation failed
                handleSendEmail(true, true);
              });
          }, 2000);
        }
      }
    }
    if (matchStatus === MatchStatus.SETUP) {
      hasSentAutoEmailRef.current = false;
      setHasSentAutoEmail(false); // Reset for next match
      setAiSummary(null);
    }
  }, [matchStatus, matchId, hasSentAutoEmail]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 font-sans text-slate-100 overflow-hidden">
      {/* Global Header Switcher - Always Visible & Clickable */}
      <div className="bg-slate-950 px-2 py-1.5 md:px-4 md:py-2 flex justify-between items-center shrink-0 border-b border-white/10 z-[500] sticky top-0 shadow-md">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none max-w-full">
          <div className="flex bg-slate-900 p-1 rounded-xl border border-white/5 shrink-0">
            <button
              onClick={() => handleViewClick("VIEWER")}
              className={`px-3 py-1.5 md:px-5 md:py-2 font-bold text-xs md:text-sm tracking-wide transition-colors whitespace-nowrap ${view === "VIEWER" ? "text-blue-500 bg-slate-800/80 rounded-lg shadow-sm" : "text-gray-400 hover:text-blue-400"}`}
            >
              VIEWER 🌍
            </button>
            <button
              onClick={() => handleViewClick("SCORER")}
              className={`px-3 py-1.5 md:px-5 md:py-2 font-bold text-xs md:text-sm tracking-wide transition-colors whitespace-nowrap ${view === "SCORER" ? "text-green-500 bg-slate-800/80 rounded-lg shadow-sm" : "text-gray-400 hover:text-green-400"}`}
            >
              SCORER 🎮
            </button>
            <button
              onClick={() => handleViewClick("CHAT")}
              className={`px-3 py-1.5 md:px-5 md:py-2 font-bold text-xs md:text-sm tracking-wide transition-colors whitespace-nowrap ${view === "CHAT" ? "text-amber-500 bg-slate-800/80 rounded-lg shadow-sm" : "text-gray-400 hover:text-amber-400"}`}
            >
              CHAT BOT ✨
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div ref={matchMenuRef}>
            {matchStatus !== MatchStatus.SETUP && view !== "VIEWER" && (
              <div className="relative">
                <button
                  onClick={() => setShowMatchMenu((v) => !v)}
                  title="Match Options"
                  className="w-7 h-7 flex items-center justify-center bg-rose-600 border border-rose-500 rounded-lg text-white hover:bg-rose-500 transition-all active:scale-95 text-xs font-black shadow-lg shadow-rose-900/20 cursor-pointer"
                >
                  ✖
                </button>
                {showMatchMenu && (
                  <div className="absolute right-0 top-9 z-[600] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden w-48 animate-in fade-in zoom-in-95 duration-150">
                    <button
                      onClick={() => {
                        setShowMatchMenu(false);
                        handleQuitMatch();
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-bold text-rose-400 hover:bg-rose-900/30 transition-colors flex items-center gap-3 border-b border-white/5"
                    >
                      <span className="text-base">🚪</span>
                      <div>
                        <div className="text-xs font-black uppercase tracking-wider">
                          Quit Match
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          Go back to Viewer
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setShowMatchMenu(false);
                        setShowResetConfirm(true);
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-bold text-amber-400 hover:bg-amber-900/20 transition-colors flex items-center gap-3"
                    >
                      <span className="text-base">🏏</span>
                      <div>
                        <div className="text-xs font-black uppercase tracking-wider">
                          New Match
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          Reset &amp; start fresh
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profile / Hamburger Menu — always visible when logged in or guest */}
          {hasAuthenticatedUser ? (
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu((v) => !v)}
                title="Profile & Settings"
                className="w-7 h-7 flex items-center justify-center bg-slate-800 border border-white/10 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all active:scale-95 cursor-pointer"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    y="1"
                    width="14"
                    height="1.5"
                    rx="0.75"
                    fill="currentColor"
                  />
                  <rect
                    y="6.25"
                    width="14"
                    height="1.5"
                    rx="0.75"
                    fill="currentColor"
                  />
                  <rect
                    y="11.5"
                    width="14"
                    height="1.5"
                    rx="0.75"
                    fill="currentColor"
                  />
                </svg>
              </button>
              {showProfileMenu && (
                <div className="absolute right-0 top-9 z-[600] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden w-56 animate-in fade-in zoom-in-95 duration-150">
                  {/* Profile info header */}
                  <div className="px-4 py-3 border-b border-white/5 bg-slate-800/50">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                        {userEmail ? userEmail[0].toUpperCase() : "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-black text-white uppercase tracking-wider truncate">
                          {isAdmin ? "Admin" : "Scorer"}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate font-medium">
                          {userEmail || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Settings — admin only */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleViewClick("ADMIN");
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-800 transition-colors border-b border-white/5 ${view === "ADMIN_PANEL" ? "text-rose-400" : "text-slate-300"}`}
                    >
                      <span className="text-base">⚙️</span>
                      <div>
                        <div className="text-xs font-black uppercase tracking-wider">
                          Settings
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          Admin Control Center
                        </div>
                      </div>
                    </button>
                  )}
                  {/* Sign Out */}
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleSignOut();
                    }}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 text-rose-400 hover:bg-rose-900/20 transition-colors"
                  >
                    <span className="text-base">🚪</span>
                    <div className="text-xs font-black uppercase tracking-wider">
                      Sign Out
                    </div>
                  </button>
                </div>
              )}
            </div>
          ) : isGuestScorer ? (
            <button
              onClick={async () => {
                setIsGuestScorer(false);
                try {
                  await signOut();
                } catch (e) {}
              }}
              className="px-3 py-1.5 bg-indigo-500/10 text-indigo-300 hover:text-white border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm"
              title="Sign In to Save"
            >
              SIGN IN
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 flex flex-col relative w-full min-h-0">
        {/* Custom Reset Confirmation Modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700/50 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-center text-slate-100 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <span className="text-3xl">⚠️</span>
              </div>
              <h3 className="text-xl font-black uppercase tracking-widest text-white mb-2 italic">
                Reset Scoreboard
              </h3>
              <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                This will end the current match and reset the scoreboard.
                <br />
                <br />
                <strong className="text-white uppercase tracking-wider text-xs block">
                  Do you want to continue?
                </strong>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-4 bg-slate-800 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] text-slate-300 hover:text-white hover:bg-slate-700 transition-all border border-slate-700/50 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowResetConfirm(false);
                    resetMatch();
                  }}
                  className="flex-1 py-4 bg-red-600 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] text-white hover:bg-red-500 transition-all shadow-lg shadow-red-600/20 active:scale-95"
                >
                  Start New Match
                </button>
              </div>
            </div>
          </div>
        )}

        {view === "VIEWER" && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-950 flex flex-col p-4 md:p-8">
            <div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="text-center space-y-2">
                <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">
                  Match <span className="text-indigo-500">Hub Center</span>
                </h1>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">
                  Live Feeds & Historical Records
                </p>
              </div>
              <LiveScoreboard
                key={`hub-${hubKey}`}
                isAdmin={isAdmin}
                initialMatchId={urlMatchId || undefined}
                onResumeMatch={undefined}
              />
            </div>
          </div>
        )}

        {view === "ADMIN_PANEL" && (
          <Authenticator
            hideSignUp
            formFields={authFormFields}
            components={authComponents}
          >
            {() => (
              <div className="absolute inset-0 bg-slate-950 flex flex-col p-4 md:p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in zoom-in-95 duration-500">
                  <div className="text-center space-y-2">
                    <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">
                      Match{" "}
                      <span className="text-rose-500">Control Center</span>
                    </h1>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">
                      Cloud Management & Database Pruning
                    </p>
                  </div>
                  <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[2rem] backdrop-blur-3xl shadow-2xl mb-8">
                    {isAdmin ? (
                      <AdminPanel hubKey={hubKey} isAdmin={isAdmin} />
                    ) : (
                      <div className="text-center text-white p-10 font-bold text-xl">
                        Access Denied: You must be in the Admin group.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Authenticator>
        )}

        {view === "SCORER" &&
          (canAccessScorerView ? (
            <div className="w-full flex-1 flex flex-col min-h-0">
              {matchStatus === MatchStatus.SETUP && (
                <MatchSetup
                  onStartMatch={startMatch}
                  onResumeMatch={resumeMatch}
                  initialEmail={
                    userEmail || (isGuestScorer ? "guest@cricscore.local" : "")
                  }
                  hideResume={true}
                  canDelete={false}
                  token={userToken || undefined}
                  onCancel={handleQuitMatch}
                  isGuestMode={isGuestScorer}
                />
              )}

              {matchStatus === MatchStatus.LIVE && currentInnings && (
                <MatchView
                  initialState={currentInnings}
                  previousInnings={previousInnings}
                  totalOvers={totalOvers}
                  matchId={matchId!}
                  userToken={userToken || undefined}
                  onInningsEnd={handleInningsEnd}
                  onResetMatch={() => setShowResetConfirm(true)}
                  onQuitMatch={handleQuitMatch}
                  onForceReset={forceResetMatch}
                  onUpdateOvers={updateMatchOvers}
                  onStateChange={(state) => setCurrentInnings(state)}
                />
              )}

              {matchStatus === MatchStatus.INNINGS_BREAK &&
                currentInnings &&
                previousInnings && (
                  <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-4 bg-slate-950 selection:bg-indigo-500/30">
                    <div className="relative w-full max-w-2xl animate-in zoom-in-95 duration-500 text-center">
                      <div className="bg-slate-900 border border-white/5 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden backdrop-blur-3xl">
                        <h2 className="text-4xl font-black text-white uppercase tracking-tighter italic mb-4">
                          Innings Break
                        </h2>
                        <p className="text-xl text-indigo-400 font-bold mb-8">
                          Target: {currentInnings.target}
                        </p>
                        <button
                          onClick={() => setMatchStatus(MatchStatus.LIVE)}
                          className="w-full h-20 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xl uppercase tracking-widest italic hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3"
                        >
                          START 2ND INNINGS
                          <span className="text-2xl">🏏</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              {matchStatus === MatchStatus.COMPLETED && currentInnings && (
                <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-4 bg-slate-950 selection:bg-indigo-500/30">
                  <div className="relative w-full max-w-2xl animate-in zoom-in-95 duration-500 text-center">
                    <div className="bg-slate-900 border border-white/5 p-6 md:p-8 rounded-2xl shadow-2xl relative overflow-hidden backdrop-blur-3xl">
                      <div className="text-center space-y-6">
                        <div className="space-y-2">
                          <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter italic">
                            {getWinnerMessage()}
                          </h2>
                          <p className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em]">
                            Match {matchId ? `#${matchId.substring(0, 8)}` : ""}
                          </p>
                        </div>

                        {/* Final Scorecard Comparison */}
                        <div className="grid grid-cols-2 gap-4 bg-slate-950/60 p-6 rounded-3xl border border-white/5 shadow-inner">
                          <div className="text-center border-r border-white/5 pr-4">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                              {previousInnings
                                ? previousInnings.battingTeamName
                                : currentInnings.battingTeamName}
                            </span>
                            <span className="text-2xl font-black text-white tracking-tighter tabular-nums">
                              {previousInnings
                                ? `${previousInnings.totalRuns}/${previousInnings.totalWickets}`
                                : `${currentInnings.totalRuns}/${currentInnings.totalWickets}`}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 block">
                              (
                              {previousInnings
                                ? `${previousInnings.overs}.${previousInnings.balls}`
                                : `${currentInnings.overs}.${currentInnings.balls}`}{" "}
                              Ovs)
                            </span>
                          </div>
                          <div className="text-center pl-4">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">
                              {previousInnings
                                ? currentInnings.battingTeamName
                                : currentInnings.bowlingTeamName}
                            </span>
                            <span className="text-2xl font-black text-indigo-300 tracking-tighter tabular-nums">
                              {previousInnings
                                ? `${currentInnings.totalRuns}/${currentInnings.totalWickets}`
                                : "N/A"}
                            </span>
                            <span className="text-[10px] font-bold text-indigo-400/60 block">
                              (
                              {previousInnings
                                ? `${currentInnings.overs}.${currentInnings.balls}`
                                : "0.0"}{" "}
                              Ovs)
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-row gap-2 pt-2">
                          <button
                            onClick={copyMatchLink}
                            className={`flex-1 py-3 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest border transition-all flex items-center justify-center gap-1 ${
                              copyFeedback
                                ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/40"
                                : "bg-slate-800/80 text-white border-white/10 hover:bg-slate-800"
                            }`}
                          >
                            {copyFeedback ? (
                              <>
                                <span>COPIED!</span>
                                <span className="text-xs md:text-sm">✅</span>
                              </>
                            ) : (
                              <>
                                <span>SHARE</span>
                                <span className="text-xs md:text-sm">🔗</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setShowResetConfirm(true)}
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-1"
                          >
                            <span>NEW MATCH</span>
                            <span className="text-xs md:text-sm">🏏</span>
                          </button>
                          <button
                            onClick={handleQuitMatch}
                            className="flex-1 py-3 bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest shadow-xl shadow-rose-950/40 active:scale-95 transition-all flex items-center justify-center gap-1"
                          >
                            <span>QUIT</span>
                            <span className="text-xs md:text-sm">🚪</span>
                          </button>
                        </div>

                        {/* AI Summary Block */}
                        <div className="mt-2">
                          {isGeneratingAi ? (
                            <div className="bg-slate-800/40 border border-indigo-500/20 rounded-2xl p-4 text-center animate-pulse">
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center justify-center gap-2">
                                <span className="animate-spin">⏳</span>{" "}
                                GENERATING POM & MATCH SUMMARY...
                              </span>
                            </div>
                          ) : aiSummary ? (
                            <div className="bg-slate-800/50 border border-indigo-500/30 rounded-2xl p-4 text-left shadow-xl">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                  <span>🤖</span> POM & MATCH SUMMARY
                                </h4>
                                <button
                                  onClick={() => handleGenerateAiSummary(true)}
                                  disabled={isGeneratingAi}
                                  className="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg font-black text-[9px] uppercase tracking-wider border border-indigo-500/30 transition-all disabled:opacity-50"
                                >
                                  🔄 REFRESH
                                </button>
                              </div>
                              <div className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">
                                {aiSummary}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-slate-800/30 border border-white/5 rounded-2xl p-4 text-center">
                              <button
                                onClick={() => handleGenerateAiSummary(true)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg"
                              >
                                ✨ GENERATE POM & MATCH SUMMARY
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col w-full bg-slate-950 items-center justify-center p-4">
              <Authenticator
                signUpAttributes={["given_name", "family_name"]}
                formFields={authFormFields}
                components={authComponents}
              >
                {() => (
                  <div className="h-full w-full flex flex-col">
                    {matchStatus === MatchStatus.SETUP && (
                      <MatchSetup
                        onStartMatch={startMatch}
                        onResumeMatch={resumeMatch}
                        initialEmail={
                          userEmail ||
                          (isGuestScorer ? "guest@cricscore.local" : "")
                        }
                        hideResume={true}
                        canDelete={false}
                        token={userToken || undefined}
                        isGuestMode={isGuestScorer}
                      />
                    )}

                    {matchStatus === MatchStatus.LIVE && currentInnings && (
                      <MatchView
                        initialState={currentInnings}
                        previousInnings={previousInnings}
                        totalOvers={totalOvers}
                        matchId={matchId!}
                        userToken={userToken || undefined}
                        onInningsEnd={handleInningsEnd}
                        onResetMatch={() => setShowResetConfirm(true)}
                        onQuitMatch={handleQuitMatch}
                        onForceReset={forceResetMatch}
                        onUpdateOvers={updateMatchOvers}
                        onStateChange={(state) => setCurrentInnings(state)}
                      />
                    )}

                    {matchStatus === MatchStatus.INNINGS_BREAK &&
                      currentInnings &&
                      previousInnings && (
                        <div className="h-full overflow-y-auto flex items-center justify-center p-4 bg-slate-950 selection:bg-indigo-500/30">
                          <div className="relative w-full max-w-2xl animate-in zoom-in-95 duration-500 text-center">
                            <div className="bg-slate-900 border border-white/5 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden backdrop-blur-3xl">
                              <h2 className="text-4xl font-black text-white uppercase tracking-tighter italic mb-4">
                                Innings Break
                              </h2>
                              <p className="text-xl text-indigo-400 font-bold mb-8">
                                Target: {currentInnings.target}
                              </p>
                              <button
                                onClick={() => setMatchStatus(MatchStatus.LIVE)}
                                className="w-full h-20 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xl uppercase tracking-widest italic hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3"
                              >
                                START 2ND INNINGS
                                <span className="text-2xl">🏏</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                    {matchStatus === MatchStatus.COMPLETED &&
                      currentInnings && (
                        <div className="h-full overflow-y-auto flex py-10 items-center justify-center p-4 bg-slate-950 selection:bg-indigo-500/30">
                          <div className="relative w-full max-w-2xl animate-in zoom-in-95 duration-500">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-indigo-600/10 blur-[120px] rounded-full -z-10"></div>

                            <div className="bg-slate-900 border border-white/5 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden backdrop-blur-3xl">
                              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"></div>

                              <div className="text-center space-y-8">
                                <div className="space-y-2">
                                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 mb-4">
                                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500">
                                      Official Result
                                    </span>
                                  </div>
                                  <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter italic">
                                    {getWinnerMessage()}
                                  </h2>
                                  <p className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em]">
                                    Match{" "}
                                    {matchId
                                      ? `#${matchId.substring(0, 8)}`
                                      : ""}
                                  </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 bg-slate-950/60 p-6 rounded-3xl border border-white/5 shadow-inner">
                                  <div className="text-center border-r border-white/5 pr-4">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                      {previousInnings
                                        ? previousInnings.battingTeamName
                                        : currentInnings.battingTeamName}
                                    </span>
                                    <span className="text-2xl font-black text-white tracking-tighter tabular-nums">
                                      {previousInnings
                                        ? `${previousInnings.totalRuns}/${previousInnings.totalWickets}`
                                        : `${currentInnings.totalRuns}/${currentInnings.totalWickets}`}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-500 block">
                                      (
                                      {previousInnings
                                        ? `${previousInnings.overs}.${previousInnings.balls}`
                                        : `${currentInnings.overs}.${currentInnings.balls}`}{" "}
                                      Ovs)
                                    </span>
                                  </div>
                                  <div className="text-center pl-4">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">
                                      {previousInnings
                                        ? currentInnings.battingTeamName
                                        : currentInnings.bowlingTeamName}
                                    </span>
                                    <span className="text-2xl font-black text-indigo-300 tracking-tighter tabular-nums">
                                      {previousInnings
                                        ? `${currentInnings.totalRuns}/${currentInnings.totalWickets}`
                                        : "N/A"}
                                    </span>
                                    <span className="text-[10px] font-bold text-indigo-400/60 block">
                                      (
                                      {previousInnings
                                        ? `${currentInnings.overs}.${currentInnings.balls}`
                                        : "0.0"}{" "}
                                      Ovs)
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                  <button
                                    onClick={copyMatchLink}
                                    className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${
                                      copyFeedback
                                        ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/40"
                                        : "bg-slate-800/80 text-white border-white/10 hover:bg-slate-800"
                                    }`}
                                  >
                                    {copyFeedback ? (
                                      <>
                                        <span>COPIED LINK!</span>
                                        <span className="text-sm">✅</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>SHARE SCORECARD</span>
                                        <span className="text-sm">🔗</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setShowResetConfirm(true)}
                                    className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                  >
                                    <span>START FRESH MATCH</span>
                                    <span className="text-sm">🏏</span>
                                  </button>
                                  <button
                                    onClick={handleQuitMatch}
                                    className="flex-1 py-4 bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-950/40 active:scale-95 transition-all flex items-center justify-center gap-2"
                                  >
                                    <span>QUIT</span>
                                    <span className="text-sm">🚪</span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            <p className="mt-8 text-[10px] font-black text-slate-600 uppercase tracking-[0.5em] text-center italic opacity-50">
                              CricScore Record Log #77291-LIVE
                            </p>
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </Authenticator>
            </div>
          ))}
        {view === "CHAT" && (
          <div className="flex-1 w-full flex flex-col bg-slate-950 p-0 sm:p-4 md:p-8 min-h-0 relative">
            <ChatComponent
              matchId={matchId}
              apiUrl={import.meta.env.VITE_API_URL}
              isAdmin={isAdmin}
              setAlertMessage={setAlertMessage}
            />
          </div>
        )}
      </div>
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

export default App;
