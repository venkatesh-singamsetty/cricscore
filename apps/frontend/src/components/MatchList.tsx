import React, { useState, useEffect } from "react";

interface MatchInningSummary {
  inning_number: number;
  batting_team_name: string;
  total_runs: number;
  total_wickets: number;
  overs: number;
  balls: number;
}

interface MatchMetadata {
  id: string;
  team_a_name: string;
  team_b_name: string;
  total_overs: number;
  status: string;
  created_at: string;
  updated_at: string;
  innings?: MatchInningSummary[];
}

interface MatchListProps {
  onSelectMatch: (matchId: string) => void;
  isAdmin?: boolean;
  onResumeMatch?: (matchId: string) => void;
  refreshTrigger?: number;
  searchTerm?: string;
}

const getTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff > 86400000) return new Date(dateStr).toLocaleDateString();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "JUST NOW";
  if (mins < 60) return `${mins} MINS AGO`;
  return `${Math.floor(mins / 60)} HOURS AGO`;
};

const MatchList: React.FC<MatchListProps> = ({
  onSelectMatch,
  isAdmin,
  onResumeMatch,
  refreshTrigger,
  searchTerm = "",
}) => {
  const [matches, setMatches] = useState<MatchMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{
    type: "DELETE_MATCH" | "PURGE_DB";
    matchId?: string;
    matchName?: string;
  } | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://ispht71fh0.execute-api.us-east-1.amazonaws.com";
  const WS_URL = import.meta.env.VITE_WS_URL || "";

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/matches`);
      const data = await response.json();
      // Sort matches so LIVE matches are on top, and then sort by most recently updated
      const sorted = [...data].sort((a, b) => {
        if (a.status === "LIVE" && b.status !== "LIVE") return -1;
        if (b.status === "LIVE" && a.status !== "LIVE") return 1;
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      });
      setMatches(sorted);
    } catch (err) {
      console.error("Failed to fetch matches:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [refreshTrigger, API_URL]);

  // Connect to websocket to receive hub updates and refresh match list
  useEffect(() => {
    if (!WS_URL) return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => console.log("MatchList WS connected");
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          const t = msg?.type || "";
          // Refresh on hub-level updates or match list changes
          if (
            t === "HUB_UPDATE" ||
            t === "MATCH_CREATED" ||
            t === "MATCH_UPDATED" ||
            t === "SCORE_UPDATE"
          ) {
            console.log("MatchList received WS event", t);
            fetchMatches();
          }
        } catch (e) {
          console.error("MatchList WS parse error", e);
        }
      };
      ws.onclose = () => console.log("MatchList WS disconnected");
      ws.onerror = (e) => console.error("MatchList WS error", e);
    } catch (err) {
      console.error("Failed to connect MatchList WS", err);
    }
    return () => {
      if (ws) ws.close();
    };
  }, [WS_URL]);

  const calculateResult = (match: MatchMetadata) => {
    if (!match.innings || match.innings.length < 2) return null;
    const i1 = match.innings[0];
    const i2 = match.innings[1];
    if (i2.total_runs > i1.total_runs) {
      return `${i2.batting_team_name} WON BY ${10 - i2.total_wickets} WICKETS`;
    } else if (i1.total_runs > i2.total_runs) {
      return `${i1.batting_team_name} WON BY ${i1.total_runs - i2.total_runs} RUNS`;
    } else if (
      i1.total_runs === i2.total_runs &&
      (i2.overs >= match.total_overs || i2.total_wickets >= 10)
    ) {
      return "MATCH TIED";
    }
    return null;
  };

  const filteredMatches = matches.filter((m) => {
    if (!searchTerm) return true;
    const s = searchTerm.toUpperCase();
    return (
      m.team_a_name.toUpperCase().includes(s) ||
      m.team_b_name.toUpperCase().includes(s) ||
      m.id.toUpperCase().includes(s)
    );
  });

  const stats = {
    total: matches.length,
    live: matches.filter((m) => m.status === "LIVE").length,
    completed: matches.filter((m) => m.status === "COMPLETED").length,
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats Dashboard */}
      <div className="grid grid-cols-3 gap-3 px-1">
        <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-3 text-center">
          <span className="block text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-1">
            TOTAL
          </span>
          <span className="text-lg font-black text-white tabular-nums">
            {stats.total}
          </span>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/10 rounded-2xl p-3 text-center">
          <span className="block text-[8px] font-black text-emerald-500 uppercase tracking-tighter mb-1">
            LIVE
          </span>
          <span className="text-lg font-black text-emerald-400 tabular-nums">
            {stats.live}
          </span>
        </div>
        <div className="bg-indigo-500/10 border border-indigo-500/10 rounded-2xl p-3 text-center">
          <span className="block text-[8px] font-black text-indigo-500 uppercase tracking-tighter mb-1">
            FINISHED
          </span>
          <span className="text-lg font-black text-indigo-400 tabular-nums">
            {stats.completed}
          </span>
        </div>
      </div>

      <div className="flex justify-between items-end px-1 border-t border-white/5 pt-6">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            {searchTerm ? `SEARCHING: ${searchTerm}` : "LATEST FIXTURES"}
          </h3>
          <p className="text-[9px] font-black text-indigo-500/50 uppercase tracking-widest mt-1">
            {searchTerm
              ? `Filtering ${filteredMatches.length} Matches`
              : "Showing Active Database"}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-4">
            <button
              onClick={() => {
                setConfirmAction({ type: "PURGE_DB" });
              }}
              className="flex flex-col items-center gap-1 group"
            >
              <span className="text-[9px] font-black text-rose-500 group-hover:text-rose-400 uppercase tracking-tighter">
                PURGE DB
              </span>
              <span className="text-lg grayscale group-hover:grayscale-0 transition-all">
                🧨
              </span>
            </button>
            <button
              onClick={fetchMatches}
              className="flex flex-col items-center gap-1 group"
            >
              <span className="text-[9px] font-black text-indigo-500 group-hover:text-indigo-400 uppercase tracking-tighter">
                REFRESH
              </span>
              <span className="text-lg group-hover:rotate-180 transition-transform duration-500">
                🔄
              </span>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center animate-pulse">
          <p className="text-slate-600 font-black uppercase tracking-[0.3em] text-[10px]">
            Consulting Oracle Databases...
          </p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="py-20 text-center bg-slate-900 shadow-inner rounded-[2rem] border border-white/5">
          <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] italic">
            No matches found for "{searchTerm}"
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-hide">
          {filteredMatches.map((match) => {
            const diff = Date.now() - new Date(match.updated_at).getTime();
            const isStale = match.status === "LIVE" && diff > 86400000;
            const result =
              match.status === "COMPLETED" ? calculateResult(match) : null;

            return (
              <div
                key={match.id}
                className={`bg-white/5 border border-white/5 rounded-2xl p-5 text-left hover:bg-white/10 ${match.status === "COMPLETED" ? "hover:border-indigo-500/30" : "hover:border-emerald-500/30"} transition-all group relative overflow-hidden`}
              >
                {/* Role Actions */}
                <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                  {match.status === "LIVE" && onResumeMatch && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResumeMatch(match.id);
                      }}
                      className="px-3 py-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg font-black text-[9px] hover:bg-indigo-600 hover:text-white transition-all uppercase border border-indigo-500/20"
                    >
                      RESUME
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmAction({
                          type: "DELETE_MATCH",
                          matchId: match.id,
                          matchName: `${match.team_a_name} VS ${match.team_b_name}`,
                        });
                      }}
                      className="w-8 h-8 flex items-center justify-center bg-red-900/20 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition-all text-xs border border-red-500/10"
                    >
                      🗑️
                    </button>
                  )}
                </div>

                <div
                  className="flex flex-col gap-4 cursor-pointer"
                  onClick={() => onSelectMatch(match.id)}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500/70 italic">
                      {getTimeAgo(match.updated_at)}
                    </span>
                    <div className="mr-24 md:mr-32">
                      {match.status === "COMPLETED" ? (
                        <span className="px-2 py-1 rounded bg-indigo-900/40 text-indigo-400 border border-indigo-500/20 font-black text-[9px] uppercase tracking-widest">
                          COMPLETED
                        </span>
                      ) : isStale ? (
                        <span className="px-2 py-1 rounded bg-rose-900/40 text-rose-500 border border-rose-500/20 font-black text-[9px] uppercase tracking-widest italic flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          STALED
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-500/20 font-black text-[9px] uppercase tracking-widest flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                    {(() => {
                      // Match each team's innings by batting_team_name (not by index position)
                      const teamAInnings = match.innings?.find(
                        (i) => i.batting_team_name === match.team_a_name,
                      );
                      const teamBInnings = match.innings?.find(
                        (i) => i.batting_team_name === match.team_b_name,
                      );
                      return (
                        <>
                          <div className="flex flex-col">
                            <h4 className="text-base font-black text-white uppercase tracking-tight italic group-hover:text-indigo-400 transition-colors">
                              {match.team_a_name}
                            </h4>
                            {teamAInnings ? (
                              <span className="text-xs font-black text-slate-400 tabular-nums">
                                {teamAInnings.total_runs}/
                                {teamAInnings.total_wickets}
                                <span className="text-[10px] text-slate-600 lowercase ml-1">
                                  ({teamAInnings.overs}.{teamAInnings.balls})
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs font-black text-slate-600 tabular-nums">
                                —
                              </span>
                            )}
                          </div>

                          <div className="text-[10px] font-black text-slate-600 uppercase italic">
                            VS
                          </div>

                          <div className="flex flex-col text-right">
                            <h4 className="text-base font-black text-white uppercase tracking-tight italic group-hover:text-indigo-400 transition-colors">
                              {match.team_b_name}
                            </h4>
                            {teamBInnings ? (
                              <span className="text-xs font-black text-slate-400 tabular-nums">
                                {teamBInnings.total_runs}/
                                {teamBInnings.total_wickets}
                                <span className="text-[10px] text-slate-600 lowercase ml-1">
                                  ({teamBInnings.overs}.{teamBInnings.balls})
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs font-black text-slate-600 tabular-nums">
                                —
                              </span>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {result && (
                    <div className="mt-1 py-3 px-4 bg-indigo-500/10 border-y border-indigo-500/20 text-center rounded-xl">
                      <span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest animate-in fade-in slide-in-from-top-1">
                        🏁 {result}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-2 pt-3 border-t border-white/5">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest group-hover:text-slate-400 transition-colors">
                      {isAdmin
                        ? "CLOUD ANALYTICS ⚡"
                        : onResumeMatch
                          ? "SCORER DASHBOARD 🎮"
                          : "VIEW SCOREBOARD 🌍"}
                    </span>
                    <span className="text-[8px] font-black text-slate-600 uppercase">
                      ID: {match.id.substring(0, 8)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[300] p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700/50 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-center text-slate-100 animate-in zoom-in-95 duration-200">
            {confirmAction.type === "PURGE_DB" ? (
              <>
                <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                  <span className="text-3xl">🧨</span>
                </div>
                <h3 className="text-xl font-black uppercase tracking-widest text-white mb-2 italic">
                  Purge Database?
                </h3>
                <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                  This will clear everything from the cloud. All historical
                  records will be gone.
                  <br />
                  <br />
                  <strong className="text-white uppercase tracking-wider text-xs block">
                    Do you want to continue?
                  </strong>
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="flex-1 py-4 bg-slate-800 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] text-slate-300 hover:text-white hover:bg-slate-700 transition-all border border-slate-700/50 active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setConfirmAction(null);
                      try {
                        const res = await fetch(`${API_URL}/matches`, {
                          method: "DELETE",
                        });
                        if (!res.ok) throw new Error("Purge failed");
                        fetchMatches();
                      } catch (err: any) {
                        setAlertMessage(`Purge failed!\n${err.message}`);
                      }
                    }}
                    className="flex-1 py-4 bg-red-600 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] text-white hover:bg-red-500 transition-all shadow-lg shadow-red-600/20 active:scale-95"
                  >
                    Purge All
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                  <span className="text-3xl">🚨</span>
                </div>
                <h3 className="text-xl font-black uppercase tracking-widest text-white mb-2 italic">
                  Delete Match?
                </h3>
                <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                  This record{" "}
                  <span className="text-indigo-400 font-bold">
                    ({confirmAction.matchName})
                  </span>{" "}
                  will be permanently removed.
                  <br />
                  <br />
                  <strong className="text-white uppercase tracking-wider text-xs block">
                    Do you want to continue?
                  </strong>
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="flex-1 py-4 bg-slate-800 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] text-slate-300 hover:text-white hover:bg-slate-700 transition-all border border-slate-700/50 active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const matchId = confirmAction.matchId!;
                      setConfirmAction(null);
                      setMatches((prev) =>
                        prev.filter((m) => m.id !== matchId),
                      );
                      try {
                        const res = await fetch(`${API_URL}/match/${matchId}`, {
                          method: "DELETE",
                        });
                        if (!res.ok) throw new Error("Delete failed");
                        fetchMatches();
                      } catch (err: any) {
                        setAlertMessage(`Delete failed!\n${err.message}`);
                        fetchMatches();
                      }
                    }}
                    className="flex-1 py-4 bg-red-600 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] text-white hover:bg-red-500 transition-all shadow-lg shadow-red-600/20 active:scale-95"
                  >
                    Delete Match
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
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

export default MatchList;
