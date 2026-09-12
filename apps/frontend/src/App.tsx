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

  const [emailTo, setEmailTo] = useState("");
  const [hasRestored, setHasRestored] = useState(false);
  const emailInputRef = React.useRef<HTMLInputElement>(null);

  const isRestoringRef = React.useRef(false);
  const isEndingInningsRef = React.useRef(false);
  const prevEmailRef = React.useRef<string | null>(null); // track identity changes

  // Auto-position cursor before @gmail.com when modal opens

  const [view, setView] = useState<
    "VIEWER" | "SCORER" | "ADMIN_PANEL" | "CHAT"
  >(() => (safeSessionStorageGet("last_view") as any) || "VIEWER");

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

          const isGuest = isGuestEmail(emailStr);
          setIsGuestScorer(isGuest);
          setIsAdmin(groups.includes("Admin"));
          if (emailStr) {
            setEmailTo(emailStr);
          }
        } else {
          setUserToken(null);
          setIsAdmin(false);
          setUserEmail(null);
          setIsGuestScorer(false);
        }
      } catch (err) {
        const fallbackAuth = getStoredAuthFromLocalStorage();
        if (fallbackAuth.token && fallbackAuth.email) {
          setUserToken(fallbackAuth.token);
          setUserEmail(fallbackAuth.email);
          setIsGuestScorer(isGuestEmail(fallbackAuth.email));
          setIsAdmin(false);
          if (fallbackAuth.email) {
            setEmailTo(fallbackAuth.email);
          }
          return;
        }

        setUserToken(null);
        setIsAdmin(false);
        setUserEmail(null);
        setIsGuestScorer(false);
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
      setIsGuestScorer(
        !!(
          currentEmail?.startsWith("guest-") &&
          currentEmail?.endsWith("@cricscore.local")
        ),
      );
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

  const [isGuestScorer, setIsGuestScorer] = useState(false);
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
            onClick={async () => {
              try {
                try {
                  await signOut();
                  // Give Amplify a moment to clear local storage tokens
                  await new Promise((resolve) => setTimeout(resolve, 500));
                } catch (e) {
                  console.warn(
                    "Sign out before guest login failed or no user:",
                    e,
                  );
                }

                // Generate a shadow account email
                const guestEmail = `guest-${Date.now()}@cricscore.local`;
                const guestPassword = "GuestPassword#12345";

                await signUp({
                  username: guestEmail,
                  password: guestPassword,
                  options: {
                    userAttributes: { email: guestEmail },
                  },
                });

                // Sign in immediately
                try {
                  await signIn({
                    username: guestEmail,
                    password: guestPassword,
                  });
                } catch (signInErr: any) {
                  if (
                    signInErr.name === "UserAlreadyAuthenticatedException" ||
                    signInErr.message?.includes("already signed in")
                  ) {
                    console.warn(
                      "User already signed in, forcing sign out and retrying...",
                    );
                    await signOut();
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    await signIn({
                      username: guestEmail,
                      password: guestPassword,
                    });
                  } else {
                    throw signInErr;
                  }
                }

                // Clear state
                setMatchStatus(MatchStatus.SETUP);
                setMatchId(null);
                setTeamA(null);
                setTeamB(null);
                setCurrentInnings(null);
                setPreviousInnings(undefined);
                setIsGuestScorer(true);
                setView("SCORER");
              } catch (err: any) {
                console.error("Guest login failed:", err);
                setAlertMessage(
                  `Failed to start guest session: ${err.message || JSON.stringify(err)}`,
                );
              }
            }}
            className="text-xs font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-wider py-2 px-4 bg-slate-900/90 rounded-xl border border-indigo-500/30 hover:border-indigo-500/60 shadow-lg transition-all"
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
      Footer() {
        return (
          <div className="text-center pt-3 border-t border-slate-800/80 mt-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  try {
                    await signOut();
                  } catch (e) {
                    // Ignore
                  }

                  // Generate a shadow account email
                  const guestEmail = `guest-${Date.now()}@cricscore.local`;
                  const guestPassword = "GuestPassword#12345";

                  await signUp({
                    username: guestEmail,
                    password: guestPassword,
                    options: {
                      userAttributes: { email: guestEmail },
                    },
                  });

                  // Sign in immediately
                  await signIn({
                    username: guestEmail,
                    password: guestPassword,
                  });

                  // Clear state
                  setMatchStatus(MatchStatus.SETUP);
                  setMatchId(null);
                  setTeamA(null);
                  setTeamB(null);
                  setCurrentInnings(null);
                  setPreviousInnings(undefined);
                  setIsGuestScorer(true);
                  setView("SCORER");
                } catch (err: any) {
                  console.error("Guest login failed:", err);
                  setAlertMessage(
                    `Failed to start guest session: ${err.message || JSON.stringify(err)}`,
                  );
                }
              }}
              className="text-xs font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-wider py-2 px-4 bg-slate-900/90 rounded-xl border border-indigo-500/30 hover:border-indigo-500/60 shadow-lg transition-all"
            >
              🎮 Continue as Guest (Start & Score Match)
            </button>
          </div>
        );
      },
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
  }, [view]);

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
    setHubKey((k) => k + 1);
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

      const isGuest = !userToken && matchId?.startsWith("guest_");
      let requestBody: any = { matchId, forceRefresh };

      // ONLY send local matchData if it's a guest match, so the backend doesn't try to query the DB for guest data.
      // For registered matches, the backend MUST query the DB directly so it can save the summary to the matches table (for email usage).
      if (isGuest) {
        requestBody.matchData = {
          teamAName: teamA?.name,
          teamBName: teamB?.name,
          previousInnings,
          currentInnings,
          winnerMessage: getWinnerMessage(),
          status: matchStatus,
        };
      }

      const response = await fetch(`${API_URL}/chat/summary`, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate");

      const finalSummary = data.playerOfTheMatch
        ? `${data.summary}\n\n🏆 Player of the Match: ${data.playerOfTheMatch}`
        : data.summary;

      setAiSummary(finalSummary);
    } catch (error) {
      console.error(error);
      setAlertMessage("Failed to generate AI summary.");
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
          // 🕰️ Wait 3.0 seconds to ensure the final ball's SQS message is fully processed by the database
          setTimeout(() => {
            handleGenerateAiSummary(true).finally(() => {
              // Wait 2 extra seconds for DB write to propagate before sending email
              setTimeout(() => handleSendEmail(true, true), 2000);
            });
          }, 3000);
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
    <div className="fixed inset-0 bg-slate-950 font-sans text-slate-100 flex flex-col overflow-hidden">
      {/* Global Header Switcher - Always Visible & Clickable */}
      <div className="bg-slate-950 px-2 py-1.5 md:px-4 md:py-2 flex justify-between items-center shrink-0 border-b border-white/10 z-[500] sticky top-0 shadow-md">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none max-w-full">
          <div className="flex bg-slate-900 p-1 rounded-xl border border-white/5 shrink-0">
            <button
              onClick={() => handleViewClick("VIEWER")}
              className={`px-2.5 py-1 md:px-4 md:py-1.5 font-bold text-[11px] md:text-xs tracking-wide transition-colors whitespace-nowrap ${view === "VIEWER" ? "text-blue-500 bg-slate-800/80 rounded-lg shadow-sm" : "text-gray-400 hover:text-blue-400"}`}
            >
              VIEWER 🌍
            </button>
            <button
              onClick={() => handleViewClick("SCORER")}
              className={`px-2.5 py-1 md:px-4 md:py-1.5 font-bold text-[11px] md:text-xs tracking-wide transition-colors whitespace-nowrap ${view === "SCORER" ? "text-green-500 bg-slate-800/80 rounded-lg shadow-sm" : "text-gray-400 hover:text-green-400"}`}
            >
              SCORER 🎮
            </button>
            <button
              onClick={() => handleViewClick("CHAT")}
              className={`px-2.5 py-1 md:px-4 md:py-1.5 font-bold text-[11px] md:text-xs tracking-wide transition-colors whitespace-nowrap ${view === "CHAT" ? "text-amber-500 bg-slate-800/80 rounded-lg shadow-sm" : "text-gray-400 hover:text-amber-400"}`}
            >
              AI CHAT ✨
            </button>
            {hasAuthenticatedUser && !isGuestScorer && (
              <button
                onClick={handleSignOut}
                className="px-2.5 py-1 md:px-4 md:py-1.5 font-bold text-[11px] md:text-xs tracking-wide text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap"
              >
                SIGN OUT
              </button>
            )}
          </div>

          {isAdmin && (
            <div className="flex bg-slate-900 p-1 rounded-xl border border-white/5 shrink-0">
              <button
                onClick={() => handleViewClick("ADMIN")}
                title="Admin Control Center"
                className={`px-3 py-1 font-bold text-sm tracking-wide transition-colors whitespace-nowrap ${view === "ADMIN_PANEL" ? "text-rose-400 bg-slate-800/80 rounded-lg shadow-sm" : "text-gray-400 hover:text-rose-400"}`}
              >
                ⚙️
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {matchStatus !== MatchStatus.SETUP && view !== "VIEWER" && (
            <button
              onClick={() => setShowResetConfirm(true)}
              title="Reset Match"
              className="w-7 h-7 flex items-center justify-center bg-red-900/30 border border-red-500/20 rounded-lg text-red-500 hover:text-white hover:bg-red-600 transition-all active:scale-95 text-xs font-black"
            >
              ✖
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
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
          <div className="h-full bg-slate-950 flex flex-col p-4 md:p-8 overflow-y-auto">
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
              <div className="h-full bg-slate-950 flex flex-col p-4 md:p-8 overflow-y-auto">
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
            <div className="h-full w-full flex flex-col">
              {shouldBypassAuth && !isGuestScorer && (
                <div className="h-full w-full flex items-center justify-center bg-slate-950 p-4">
                  <div className="w-full max-w-lg rounded-[2rem] border border-indigo-500/20 bg-slate-900/80 p-8 text-center shadow-2xl">
                    <div className="text-xs font-black uppercase tracking-[0.4em] text-indigo-400 mb-4">
                      Demo Mode
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic text-white mb-3">
                      Match{" "}
                      <span className="text-indigo-500">Configuration</span>
                    </h1>
                    <p className="text-sm text-slate-300 leading-relaxed mb-6">
                      Authentication is not configured in this environment, so
                      guest scoring is available without sign-in.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsGuestScorer(true);
                        setMatchStatus(MatchStatus.SETUP);
                        setView("SCORER");
                      }}
                      className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
                    >
                      🎮 Continue as Guest
                    </button>
                  </div>
                </div>
              )}
              {isGuestScorer && (
                <div className="bg-slate-900/90 border-b border-indigo-500/20 px-4 py-2 flex justify-between items-center text-xs font-bold text-indigo-300 shrink-0">
                  <span>🎮 GUEST SCORER MODE</span>
                  <button
                    onClick={async () => {
                      setIsGuestScorer(false);
                      try {
                        await signOut();
                      } catch (e) {}
                    }}
                    className="underline hover:text-white uppercase tracking-wider text-[10px]"
                  >
                    Sign In to Save
                  </button>
                </div>
              )}
              {matchStatus === MatchStatus.SETUP && (
                <MatchSetup
                  onStartMatch={startMatch}
                  onResumeMatch={resumeMatch}
                  initialEmail={userEmail || "guest@cricscore.local"}
                  hideResume={true}
                  canDelete={false}
                  token={userToken || undefined}
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

              {matchStatus === MatchStatus.COMPLETED && currentInnings && (
                <div className="h-full overflow-y-auto flex py-10 items-center justify-center p-4 bg-slate-950 selection:bg-indigo-500/30">
                  <div className="relative w-full max-w-2xl animate-in zoom-in-95 duration-500">
                    {/* Dramatic Glow Background */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-indigo-600/10 blur-[120px] rounded-full -z-10"></div>

                    <div className="bg-slate-900 border border-white/5 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden backdrop-blur-3xl">
                      {/* Accent Header */}
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

                        {/* AI Summary Block */}
                        <div className="mt-2">
                          {isGeneratingAi ? (
                            <div className="bg-slate-800/40 border border-indigo-500/20 rounded-2xl p-4 text-center animate-pulse">
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center justify-center gap-2">
                                <span className="animate-spin">⏳</span>{" "}
                                GENERATING AI SUMMARY...
                              </span>
                            </div>
                          ) : aiSummary ? (
                            <div className="bg-slate-800/50 border border-indigo-500/30 rounded-2xl p-4 text-left shadow-xl">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                  <span>🤖</span> AI MATCH SUMMARY & MOTM
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
                                ✨ GENERATE AI SUMMARY
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
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
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
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
                      initialEmail={userEmail || ""}
                      hideResume={true}
                      canDelete={false}
                      token={userToken || undefined}
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

                  {matchStatus === MatchStatus.COMPLETED && currentInnings && (
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
                                {matchId ? `#${matchId.substring(0, 8)}` : ""}
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
          ))}
        {view === "CHAT" && (
          <div className="h-full bg-slate-950 flex flex-col p-4 md:p-8 overflow-y-auto">
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
