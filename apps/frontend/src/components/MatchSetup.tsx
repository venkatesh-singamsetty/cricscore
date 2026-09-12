import React, { useState, useRef, useEffect } from "react";
import { TeamData } from "../types";

interface MatchSetupProps {
  onStartMatch: (
    teamA: TeamData,
    teamB: TeamData,
    overs: number,
    batFirstTeam: string,
    matchId: string,
    inningId: string,
    email: string,
  ) => void;
  onResumeMatch: (matchId: string) => void;
  initialEmail?: string;
  hideResume?: boolean;
  canDelete?: boolean;
  token?: string;
}

const handleScroll = (
  textarea: HTMLTextAreaElement,
  lineNumbers: HTMLDivElement,
) => {
  if (lineNumbers) lineNumbers.scrollTop = textarea.scrollTop;
};

const SquadInput = ({
  label,
  value,
  setValue,
  accentColor,
  textareaRef,
  lineNumbersRef,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  accentColor: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  lineNumbersRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const lines = value.split("\n");
  const lineCount = Math.max(lines.length, 1);

  const handleBlur = () => {
    const cleaned = value
      .split("\n")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);
    const newValue = cleaned.join("\n");
    if (newValue !== value.trim()) setValue(newValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const start = e.target.selectionStart;
    const end = e.target.selectionEnd;
    const upValue = e.target.value.toUpperCase();
    setValue(upValue);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = start;
        textareaRef.current.selectionEnd = end;
      }
    }, 0);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex justify-between items-center mb-1 shrink-0 px-1">
        <label
          className={`text-[10px] font-black uppercase tracking-widest ${accentColor}`}
        >
          {label}
        </label>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setValue("")}
            className="text-[9px] font-black px-1.5 py-0.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-full border border-red-500/20 transition-all uppercase"
          >
            CLEAR 🗑️
          </button>
          <span
            className={`text-[9px] font-black px-1.5 py-0.5 bg-white/5 ${accentColor} rounded-full border border-white/5 flex items-center gap-1`}
          >
            <span className="animate-pulse">●</span>{" "}
            {lines.filter((s) => s.trim().length > 0).length} ROSTER
          </span>
        </div>
      </div>
      <div className="relative flex-1 min-h-[150px] max-h-[350px] flex bg-slate-950 rounded-[1.5rem] border border-white/10 overflow-hidden focus-within:border-indigo-500/50 transition-all shadow-2xl shrink-0">
        <div
          ref={lineNumbersRef}
          className="w-10 bg-slate-900/50 border-r border-white/5 flex flex-col items-center pt-2 select-none overflow-hidden shrink-0"
        >
          {Array.from({ length: lineCount }).map((_, i) => (
            <span
              key={i}
              className="text-[11px] font-black text-slate-700 h-[28px] leading-[28px]"
            >
              {i + 1}
            </span>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          onBlur={handleBlur}
          onScroll={() =>
            textareaRef.current &&
            lineNumbersRef.current &&
            handleScroll(textareaRef.current, lineNumbersRef.current)
          }
          className="flex-1 bg-transparent px-4 pt-2 pb-8 text-sm font-black text-slate-300 outline-none resize-none scrollbar-hide uppercase leading-[28px] overflow-y-auto"
          value={value}
          onChange={handleChange}
          placeholder="Enter player name..."
        />
      </div>
    </div>
  );
};

const MatchSetup: React.FC<MatchSetupProps> = ({
  onStartMatch,
  onResumeMatch,
  hideResume,
  canDelete = true,
  token,
  initialEmail = import.meta.env.VITE_DEFAULT_EMAIL || "",
}) => {
  const [teamAName, setTeamAName] = useState("TEAM A");
  const [teamBName, setTeamBName] = useState("TEAM B");
  const [teamASquad, setTeamASquad] = useState(
    "Player A1\nPlayer A2\nPlayer A3\nPlayer A4\nPlayer A5\nPlayer A6\nPlayer A7\nPlayer A8\nPlayer A9\nPlayer A10\nPlayer A11",
  );
  const [teamBSquad, setTeamBSquad] = useState(
    "Player B1\nPlayer B2\nPlayer B3\nPlayer B4\nPlayer B5\nPlayer B6\nPlayer B7\nPlayer B8\nPlayer B9\nPlayer B10\nPlayer B11",
  );
  const [overs, setOvers] = useState<number | string>(1);
  const [tossWinner, setTossWinner] = useState("Team A");
  const [tossDecision, setTossDecision] = useState("BAT");
  const [mobileStep, setMobileStep] = useState<1 | 2 | 3>(1);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const textareaRefA = useRef<HTMLTextAreaElement>(null);
  const textareaRefB = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRefA = useRef<HTMLDivElement>(null);
  const lineNumbersRefB = useRef<HTMLDivElement>(null);

  const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://ispht71fh0.execute-api.us-east-1.amazonaws.com";

  const parsedTeamA = teamASquad
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const parsedTeamB = teamBSquad
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const isValid =
    parsedTeamA.length >= 2 &&
    parsedTeamB.length >= 2 &&
    teamAName.trim() !== "" &&
    teamBName.trim() !== "";

  const makeNameHandler =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.toUpperCase();
      const s = e.target.selectionStart;
      const en = e.target.selectionEnd;
      setter(v);
      setTimeout(() => {
        e.target.selectionStart = s;
        e.target.selectionEnd = en;
      }, 0);
    };

  const fetchRecentMatches = async () => {
    setLoadingRecent(true);
    try {
      const response = await fetch(`${API_URL}/matches`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();
      setRecentMatches(
        data.filter((m: any) => m.status === "LIVE").slice(0, 1),
      );
    } catch (err) {
      console.error("Failed to fetch recent matches:", err);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    fetchRecentMatches();
  }, []);

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "JUST NOW";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    if (!isValid) {
      setAlertMessage(
        "Both teams must have at least 2 players to start a match.",
      );
      return;
    }
    setIsCreating(true);
    try {
      const teamA: TeamData = { name: teamAName.trim(), players: parsedTeamA };
      const teamB: TeamData = { name: teamBName.trim(), players: parsedTeamB };
      const batFirstTeamName =
        (tossWinner === "Team A" && tossDecision === "BAT") ||
        (tossWinner === "Team B" && tossDecision === "BOWL")
          ? teamA.name
          : teamB.name;
      const tossWinnerName = tossWinner === "Team A" ? teamA.name : teamB.name;

      let matchId = `guest_match_${Date.now()}`;
      let inningId = `guest_inning_${Date.now()}`;

      if (token) {
        try {
          const response = await fetch(`${API_URL}/match`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              ...(initialEmail && initialEmail.startsWith("guest-")
                ? { "X-Guest-Email": initialEmail }
                : {}),
            },
            body: JSON.stringify({
              teamA: teamA.name,
              teamB: teamB.name,
              totalOvers: Number(overs) || 1,
              batFirstTeam: batFirstTeamName,
              tossWinner: tossWinnerName,
              tossDecision,
              teamASquad: teamA.players,
              teamBSquad: teamB.players,
              scorerEmail: initialEmail,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            matchId = data.matchId;
            inningId = data.inningId;
          } else {
            console.warn("Cloud registration warning:", await response.text());
          }
        } catch (cloudErr) {
          console.warn("Cloud registration failed:", cloudErr);
        }
      }

      onStartMatch(
        teamA,
        teamB,
        Number(overs) || 1,
        batFirstTeamName,
        matchId,
        inningId,
        initialEmail || "guest@cricscore.local",
      );
    } catch (err) {
      console.error("Match Initialization Failed:", err);
      setAlertMessage(
        "Could not initialize match. Please check team names and player lists.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const StepDots = () => (
    <div className="flex items-center justify-center gap-2 py-2 shrink-0">
      {([1, 2, 3] as const).map((s, i) => (
        <React.Fragment key={s}>
          <button
            type="button"
            onClick={() => {
              if (s < mobileStep) setMobileStep(s);
            }}
            className={`w-8 h-8 rounded-full font-black text-xs flex items-center justify-center border transition-all ${
              mobileStep === s
                ? "bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30"
                : mobileStep > s
                  ? "bg-emerald-600/80 text-white border-emerald-400 cursor-pointer"
                  : "bg-slate-800 text-slate-500 border-white/5"
            }`}
          >
            {mobileStep > s ? "✓" : s}
          </button>
          {i < 2 && (
            <div
              className={`w-8 h-0.5 rounded-full transition-all ${mobileStep > s ? "bg-emerald-500" : "bg-slate-700"}`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-hidden flex flex-col selection:bg-indigo-500/30">
      {/* ── MOBILE WIZARD (md:hidden) ── */}
      <div className="md:hidden h-full flex flex-col">
        <StepDots />

        {/* Step 1: Team A */}
        {mobileStep === 1 && (
          <div className="flex-1 flex flex-col px-3 pb-3 gap-3 overflow-hidden animate-in fade-in duration-300">
            <div className="text-center shrink-0">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest text-indigo-400">
                Team A · First Team
              </span>
            </div>
            {!hideResume && recentMatches.length > 0 && (
              <div className="bg-slate-900/60 border border-indigo-500/10 rounded-2xl p-3 shrink-0">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400/60 mb-2">
                  Resume a live match
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {recentMatches.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onResumeMatch(m.id)}
                      className="shrink-0 bg-slate-950 border border-white/5 p-2.5 rounded-xl hover:border-indigo-500/50 transition-all text-left min-w-[140px]"
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                        <span className="text-[8px] font-bold text-slate-500 uppercase">
                          {getTimeAgo(m.created_at)}
                        </span>
                      </div>
                      <div className="text-[11px] font-black text-white truncate uppercase">
                        {m.team_a_name} vs {m.team_b_name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex-1 bg-slate-900/50 border border-indigo-500/20 p-4 rounded-[2rem] flex flex-col gap-3 min-h-0 overflow-y-auto scrollbar-hide shadow-2xl">
              <input
                type="text"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-base font-black text-white focus:ring-2 focus:ring-indigo-500 outline-none uppercase text-center placeholder:opacity-30 shrink-0"
                value={teamAName}
                placeholder="TEAM A NAME"
                onChange={makeNameHandler(setTeamAName)}
              />
              <SquadInput
                label="Squad (one player per line)"
                value={teamASquad}
                setValue={setTeamASquad}
                accentColor="text-indigo-400"
                textareaRef={textareaRefA}
                lineNumbersRef={lineNumbersRefA}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (!teamAName.trim()) {
                  setAlertMessage("Please enter Team A name.");
                  return;
                }
                if (parsedTeamA.length < 2) {
                  setAlertMessage("Team A needs at least 2 players.");
                  return;
                }
                setMobileStep(2);
              }}
              className="w-full py-4 bg-indigo-600 rounded-2xl font-black text-sm uppercase tracking-widest text-white shadow-lg shadow-indigo-600/20 active:scale-95 transition-all shrink-0"
            >
              Next: Team B →
            </button>
          </div>
        )}

        {/* Step 2: Team B */}
        {mobileStep === 2 && (
          <div className="flex-1 flex flex-col px-3 pb-3 gap-3 overflow-hidden animate-in fade-in duration-300">
            <div className="text-center shrink-0">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] font-black uppercase tracking-widest text-purple-400">
                Team B · Second Team
              </span>
              <p className="text-[10px] text-slate-600 mt-1 font-bold uppercase">
                vs <span className="text-indigo-400">{teamAName}</span>
              </p>
            </div>
            <div className="flex-1 bg-slate-900/50 border border-purple-500/20 p-4 rounded-[2rem] flex flex-col gap-3 min-h-0 overflow-y-auto scrollbar-hide shadow-2xl">
              <input
                type="text"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-base font-black text-white focus:ring-2 focus:ring-purple-500 outline-none uppercase text-center placeholder:opacity-30 shrink-0"
                value={teamBName}
                placeholder="TEAM B NAME"
                onChange={makeNameHandler(setTeamBName)}
              />
              <SquadInput
                label="Squad (one player per line)"
                value={teamBSquad}
                setValue={setTeamBSquad}
                accentColor="text-purple-400"
                textareaRef={textareaRefB}
                lineNumbersRef={lineNumbersRefB}
              />
            </div>
            <div className="grid grid-cols-5 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setMobileStep(1)}
                className="col-span-2 py-3.5 bg-slate-800 border border-white/5 rounded-2xl font-bold text-xs text-slate-300 uppercase tracking-wider active:scale-95"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!teamBName.trim()) {
                    setAlertMessage("Please enter Team B name.");
                    return;
                  }
                  if (parsedTeamB.length < 2) {
                    setAlertMessage("Team B needs at least 2 players.");
                    return;
                  }
                  setMobileStep(3);
                }}
                className="col-span-3 py-3.5 bg-purple-600 rounded-2xl font-black text-sm uppercase tracking-widest text-white shadow-lg shadow-purple-600/20 active:scale-95 transition-all"
              >
                Next: Overs &amp; Toss →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Settings & Toss */}
        {mobileStep === 3 && (
          <form
            onSubmit={handleSubmit}
            className="flex-1 flex flex-col px-3 pb-3 gap-3 overflow-y-auto scrollbar-hide animate-in fade-in duration-300"
          >
            <div className="text-center shrink-0">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest text-amber-400">
                Overs &amp; Toss
              </span>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-xs font-black text-indigo-400 uppercase">
                  {teamAName}
                </span>
                <span className="text-slate-600 text-[10px]">vs</span>
                <span className="text-xs font-black text-purple-400 uppercase">
                  {teamBName}
                </span>
              </div>
            </div>
            {/* Overs */}
            <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl flex items-center justify-between shrink-0">
              <div>
                <div className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500 mb-0.5">
                  Match Format
                </div>
                <div className="text-sm font-black text-white">
                  Overs per Side
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="text-3xl font-black text-white tabular-nums w-24 text-center bg-slate-950 border border-indigo-500/30 focus:border-indigo-500 focus:bg-slate-800 rounded-lg outline-none transition-all py-1.5"
                  value={overs}
                  onChange={(e) => setOvers(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
            {/* Toss Winner */}
            <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl space-y-2.5 shrink-0">
              <div className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500">
                🪙 Toss Winner
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTossWinner("Team A")}
                  className={`py-3.5 rounded-xl font-black text-sm uppercase truncate transition-all border active:scale-95 ${tossWinner === "Team A" ? "bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/20" : "bg-slate-800 text-slate-400 border-white/5"}`}
                >
                  {teamAName}
                </button>
                <button
                  type="button"
                  onClick={() => setTossWinner("Team B")}
                  className={`py-3.5 rounded-xl font-black text-sm uppercase truncate transition-all border active:scale-95 ${tossWinner === "Team B" ? "bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/20" : "bg-slate-800 text-slate-400 border-white/5"}`}
                >
                  {teamBName}
                </button>
              </div>
            </div>
            {/* Toss Decision */}
            <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl space-y-2.5 shrink-0">
              <div className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500">
                Decision ·{" "}
                <span className="text-white">
                  {tossWinner === "Team A" ? teamAName : teamBName}
                </span>{" "}
                elects to
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTossDecision("BAT")}
                  className={`py-3.5 rounded-xl font-black text-sm uppercase transition-all border active:scale-95 flex items-center justify-center gap-2 ${tossDecision === "BAT" ? "bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30" : "bg-slate-800 text-slate-400 border-white/5"}`}
                >
                  <span className="text-2xl">🏏</span>
                  <span>BAT</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTossDecision("BOWL")}
                  className={`py-3.5 rounded-xl font-black text-sm uppercase transition-all border active:scale-95 flex items-center justify-center gap-2 ${tossDecision === "BOWL" ? "bg-amber-600 text-white border-amber-400 shadow-lg" : "bg-slate-800 text-slate-400 border-white/5"}`}
                >
                  <span className="text-2xl">🎾</span>
                  <span>BOWL</span>
                </button>
              </div>
              <p className="text-[10px] font-bold text-slate-500 text-center pt-0.5">
                <span className="text-white">
                  {tossWinner === "Team A" ? teamAName : teamBName}
                </span>{" "}
                will {tossDecision === "BAT" ? "bat" : "bowl"} first
              </p>
            </div>
            {/* Back + Launch */}
            <div className="grid grid-cols-5 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setMobileStep(2)}
                className="col-span-2 py-4 bg-slate-800 border border-white/5 rounded-2xl font-bold text-xs text-slate-300 uppercase tracking-wider active:scale-95"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={!isValid || isCreating}
                className={`col-span-3 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl active:scale-95 ${isValid && !isCreating ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-indigo-600/30" : "bg-slate-700 text-slate-500 cursor-not-allowed"}`}
              >
                {isCreating ? "Creating..." : "🏁 Start Match"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── DESKTOP LAYOUT (md+) ── */}
      <div className="hidden md:flex max-w-6xl mx-auto flex-col h-full w-full p-3 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex justify-center items-center py-1 shrink-0">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-500 uppercase tracking-tighter italic leading-none">
            Match <span className="text-indigo-500">Configuration</span>
          </h1>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col gap-3 min-h-0"
        >
          {!hideResume && recentMatches.length > 0 && (
            <div className="bg-slate-900/40 border border-indigo-500/10 rounded-3xl p-4 shrink-0 overflow-hidden">
              <div className="flex justify-between items-center mb-2 px-1">
                <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400/60">
                  Resume Recent Match
                </h3>
                {loadingRecent && (
                  <span className="text-[8px] font-bold text-slate-500 animate-pulse uppercase">
                    Refreshing...
                  </span>
                )}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                {recentMatches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onResumeMatch(m.id)}
                    className="shrink-0 bg-slate-950 border border-white/5 p-3 rounded-2xl hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-left min-w-[160px] group"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[8px] font-bold text-slate-500 uppercase">
                        {getTimeAgo(m.created_at)}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                    </div>
                    <div className="text-[11px] font-black text-white truncate italic uppercase group-hover:text-indigo-400 transition-colors">
                      {m.team_a_name}{" "}
                      <span className="text-[8px] text-slate-600 not-italic mx-0.5">
                        vs
                      </span>{" "}
                      {m.team_b_name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
            <div className="relative group flex flex-col flex-1 min-h-0">
              <div className="relative flex-1 bg-slate-900/50 border border-white/5 p-4 rounded-[2rem] flex flex-col space-y-3 backdrop-blur-sm shadow-2xl overflow-y-auto scrollbar-hide min-h-[220px]">
                <div className="shrink-0 text-center">
                  <label className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-1 block">
                    Team Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-5 py-2 text-base font-black text-white focus:ring-2 focus:ring-indigo-500 outline-none uppercase placeholder:opacity-20 shadow-inner text-center"
                    value={teamAName}
                    onChange={makeNameHandler(setTeamAName)}
                  />
                </div>
                <SquadInput
                  label="Squad List"
                  value={teamASquad}
                  setValue={setTeamASquad}
                  accentColor="text-indigo-400"
                  textareaRef={textareaRefA}
                  lineNumbersRef={lineNumbersRefA}
                />
              </div>
            </div>
            <div className="relative group flex flex-col flex-1 min-h-0">
              <div className="relative flex-1 bg-slate-900/50 border border-white/5 p-4 rounded-[2rem] flex flex-col space-y-3 backdrop-blur-sm shadow-2xl overflow-y-auto scrollbar-hide min-h-[220px]">
                <div className="shrink-0 text-center">
                  <label className="text-[9px] font-black uppercase tracking-[0.3em] text-purple-400 mb-1 block">
                    Team Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-5 py-2 text-base font-black text-white focus:ring-2 focus:ring-purple-500 outline-none uppercase placeholder:opacity-20 shadow-inner text-center"
                    value={teamBName}
                    onChange={makeNameHandler(setTeamBName)}
                  />
                </div>
                <SquadInput
                  label="Squad List"
                  value={teamBSquad}
                  setValue={setTeamBSquad}
                  accentColor="text-purple-400"
                  textareaRef={textareaRefB}
                  lineNumbersRef={lineNumbersRefB}
                />
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-indigo-500/20 p-4 rounded-[2rem] shadow-2xl backdrop-blur-xl shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center px-4">
              <div className="flex items-center gap-6">
                <div className="shrink-0">
                  <label className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500 block mb-0.5">
                    Settings
                  </label>
                  <h4 className="text-[11px] font-black text-white uppercase italic">
                    Standard Ovs
                  </h4>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="w-16 bg-slate-950 border border-indigo-500/30 rounded-xl py-2 text-xl font-black text-white outline-none text-center focus:ring-2 focus:ring-indigo-500 tabular-nums shadow-inner"
                    value={overs}
                    onChange={(e) =>
                      setOvers(e.target.value.replace(/\D/g, ""))
                    }
                  />
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
                    Overs
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500 block">
                    Toss Winner
                  </label>
                  <div className="bg-slate-950 p-1 rounded-xl border border-white/5 flex gap-2 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setTossWinner("Team A")}
                      className={`flex-1 py-2 px-3 rounded-lg font-black text-[10px] uppercase tracking-tighter transition-all truncate border ${tossWinner === "Team A" ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 border-indigo-400" : "text-slate-500 border-transparent hover:text-slate-300"}`}
                    >
                      {teamAName || "TEAM A"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTossWinner("Team B")}
                      className={`flex-1 py-2 px-3 rounded-lg font-black text-[10px] uppercase tracking-tighter transition-all truncate border ${tossWinner === "Team B" ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 border-indigo-400" : "text-slate-500 border-transparent hover:text-slate-300"}`}
                    >
                      {teamBName || "TEAM B"}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500 block">
                    Decision
                  </label>
                  <div className="bg-slate-950 p-1 rounded-xl border border-white/5 flex gap-2 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setTossDecision("BAT")}
                      className={`flex-1 py-2 px-3 rounded-lg font-black text-[10px] uppercase tracking-tighter transition-all border flex items-center justify-center gap-1.5 ${tossDecision === "BAT" ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 border-indigo-400" : "text-slate-500 border-transparent hover:text-slate-300"}`}
                    >
                      <span className="text-base">🏏</span>BAT
                    </button>
                    <button
                      type="button"
                      onClick={() => setTossDecision("BOWL")}
                      className={`flex-1 py-2 px-3 rounded-lg font-black text-[10px] uppercase tracking-tighter transition-all border flex items-center justify-center gap-1.5 ${tossDecision === "BOWL" ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 border-indigo-400" : "text-slate-500 border-transparent hover:text-slate-300"}`}
                    >
                      <span className="text-base text-emerald-300">🎾</span>
                      <span className="text-emerald-300">BOWL</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={!isValid || isCreating}
            className={`group relative w-full h-14 md:h-16 rounded-[1.5rem] overflow-hidden transition-all shrink-0 shadow-2xl border-t border-white/20 ${isValid && !isCreating ? "bg-indigo-600 hover:scale-[1.002] active:scale-[0.98]" : "bg-slate-800 opacity-80 cursor-not-allowed"}`}
          >
            {isValid && !isCreating && (
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:opacity-90"></div>
            )}
            <div className="relative flex flex-col items-center justify-center h-full">
              <div className="flex items-center gap-4">
                <span
                  className={`text-lg md:text-xl font-black uppercase italic transition-all ${isValid && !isCreating ? "text-white tracking-[0.3em] md:tracking-[0.4em]" : "text-slate-500 tracking-[0.2em]"}`}
                >
                  {isCreating ? "Provisioning..." : "Start Fresh Match"}
                </span>
                {isValid && !isCreating && (
                  <span className="text-xl md:text-2xl group-hover:translate-x-2 transition-transform">
                    🏁
                  </span>
                )}
              </div>
              {!isValid && (
                <span className="text-[9px] md:text-[10px] font-bold text-red-500 mt-0.5 uppercase tracking-widest">
                  Requires min. 2 players per team
                </span>
              )}
            </div>
          </button>
        </form>
      </div>

      {/* Delete Confirm Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[300] p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl w-full max-w-sm shadow-2xl shadow-indigo-500/20 overflow-hidden p-6 text-center text-slate-100 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-500/15 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-400/30">
              <span className="text-3xl">🚨</span>
            </div>
            <h3 className="text-xl font-black uppercase tracking-widest text-white mb-2 italic">
              Delete Match?
            </h3>
            <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
              This record will be permanently removed.
              <br />
              <br />
              <strong className="text-indigo-300 uppercase tracking-wider text-xs block">
                Do you want to continue?
              </strong>
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-4 bg-slate-800 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] text-slate-300 hover:text-white hover:bg-slate-700 transition-all border border-slate-700/50 active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const matchId = deleteConfirmId;
                  setDeleteConfirmId(null);
                  setRecentMatches((prev) =>
                    prev.filter((item) => item.id !== matchId),
                  );
                  try {
                    const res = await fetch(`${API_URL}/match/${matchId}`, {
                      method: "DELETE",
                    });
                    if (!res.ok) {
                      const errData = await res.json();
                      throw new Error(errData.error || "Server failed");
                    }
                    fetchRecentMatches();
                  } catch (err: any) {
                    setAlertMessage(`Delete failed!\n${err.message}`);
                    fetchRecentMatches();
                  }
                }}
                className="flex-1 py-4 bg-gradient-to-r from-rose-500 to-red-600 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] text-white hover:from-red-500 hover:to-rose-500 transition-all shadow-lg shadow-rose-600/20 active:scale-95"
              >
                Delete Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
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

export default MatchSetup;
