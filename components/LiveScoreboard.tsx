import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import MatchList from './MatchList'; // Added Phase 6+
import Scoreboard from './Scoreboard';
import { InningsState, ExtraType, WicketType } from '../types';

interface LiveBall {
    overNumber: number;
    ballNumber: number;
    bowlerName: string;
    batterName: string;
    runs: number;
    commentary: string;
}

const LiveScoreboard: React.FC = () => {
    const WS_URL = import.meta.env.VITE_WS_URL || "wss://i4cnmjy0tg.execute-api.us-east-1.amazonaws.com/prod";
    const API_URL = import.meta.env.VITE_API_URL || "https://mmiwp8rgrf.execute-api.us-east-1.amazonaws.com";
    const [targetMatchId, setTargetMatchId] = useState<string>("");
    const { lastMessage, isConnected } = useWebSocket(WS_URL);
    const [liveData, setLiveData] = useState<LiveBall | null>(null);
    const [matchDetails, setMatchDetails] = useState<{ innings: InningsState[] } | null>(null);
    const [matchMeta, setMatchMeta] = useState<{ status: string; teamA: string; teamB: string; totalOvers: number } | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [showFullScorecard, setShowFullScorecard] = useState(false);

    const fetchMatchDetails = useCallback(async (matchId: string, isBackground = false) => {
        if (!isBackground) setLoadingDetails(true);
        try {
            const response = await fetch(`${API_URL}/match/${matchId}/details`);
            const data = await response.json();
            
            setMatchMeta({
                status: data.match.status,
                teamA: data.match.team_a_name,
                teamB: data.match.team_b_name,
                totalOvers: data.match.total_overs
            });

            // Map DB rows to InningsState
            const mappedInnings = data.innings.map((inn: any): InningsState => ({
                id: inn.id,
                inningNumber: inn.inning_number,
                target: inn.target,
                battingTeamName: inn.batting_team_name,
                bowlingTeamName: inn.bowling_team_name,
                totalRuns: inn.total_runs,
                totalWickets: inn.total_wickets,
                overs: inn.overs,
                balls: inn.balls,
                currentOver: [],
                allBalls: (inn.allBalls || []).map((b: any) => ({
                    ...b,
                    bowlerName: b.bowler_name,
                    batterName: b.batter_name,
                    extraType: b.extra_type as ExtraType,
                    extraRuns: b.extra_runs,
                    wicketType: b.wicket_type as WicketType,
                    overNumber: b.over_number,
                    ballNumber: b.ball_number
                })),
                strikerId: (inn.players || []).find((p: any) => p.name === inn.striker_name)?.id || '',
                nonStrikerId: (inn.players || []).find((p: any) => p.name === inn.non_striker_name)?.id || '',
                currentBowlerId: (inn.bowlers || []).find((b: any) => b.name === inn.current_bowler_name)?.id || '',
                players: (inn.players || []).reduce((acc: any, p: any) => {
                    acc[p.id] = {
                        id: p.id,
                        name: p.name,
                        runs: p.runs,
                        ballsFaced: p.balls_faced,
                        fours: p.fours,
                        sixes: p.sixes,
                        isOut: p.is_out,
                        wicketBy: p.wicket_by,
                        wicketType: p.wicket_type as WicketType,
                        fielderName: p.fielder_name
                    };
                    return acc;
                }, {}),
                bowlers: (inn.bowlers || []).reduce((acc: any, b: any) => {
                    acc[b.id] = {
                        id: b.id,
                        name: b.name,
                        overs: b.overs_completed,
                        balls: b.balls,
                        maidens: b.maidens,
                        runsConceded: b.runs_conceded,
                        wickets: b.wickets
                    };
                    return acc;
                }, {}),
                battingOrder: (inn.players || []).map((p: any) => p.id),
                bowlingOrder: (inn.bowlers || []).map((b: any) => b.id)
            }));

            setMatchDetails({ innings: mappedInnings });
        } catch (err) {
            console.error("Failed to fetch match details:", err);
        } finally {
            if (!isBackground) setLoadingDetails(false);
        }
    }, [API_URL]);

    useEffect(() => {
        // Only accept updates for the match we are following
        if (['LIVE_SCORE_UPDATE', 'STATE_SYNC'].includes(lastMessage?.type || '')) {
            const data = lastMessage.data;
            console.log(`📥 WS Message ${lastMessage.type} -> target:`, targetMatchId, "incoming:", data.matchId, data);
            if (!targetMatchId || data.matchId === targetMatchId) {
                setLiveData(data);
                if (data.matchTotalOvers !== undefined) {
                    setMatchMeta(prev => prev ? { ...prev, totalOvers: data.matchTotalOvers } : null);
                }
                if (targetMatchId) {
                    fetchMatchDetails(targetMatchId, true);
                }
            } else {
                console.warn("❌ Match id mismatch. Ignoring.");
            }
        }
    }, [lastMessage, targetMatchId, fetchMatchDetails]);

    useEffect(() => {
        // Reset state when following a new match
        setLiveData(null);
        setMatchDetails(null);
        setMatchMeta(null);
        setShowFullScorecard(false);

        if (targetMatchId) {
            fetchMatchDetails(targetMatchId, false);
        }
    }, [targetMatchId, fetchMatchDetails]);

    return (
        <div className="p-6 bg-slate-900 text-white rounded-[2rem] border border-white/5 shadow-2xl max-w-md mx-auto">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">
                            {isConnected ? 'LIVE BROACASTING' : 'CONNECTING...'}
                        </span>
                    </div>
                </div>

                <div className="relative group">
                    <input 
                        type="text"
                        placeholder="FOLLOW MATCH ID..."
                        className="w-full bg-slate-800/50 border border-white/5 rounded-xl px-4 py-2.5 text-[10px] font-black text-indigo-400 placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-all uppercase tracking-widest tabular-nums"
                        value={targetMatchId}
                        onChange={(e) => setTargetMatchId(e.target.value)}
                    />
                </div>
            </div>

            {!targetMatchId ? (
                <MatchList onSelectMatch={(id) => setTargetMatchId(id)} />
            ) : (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <button 
                            onClick={() => setTargetMatchId("")}
                            className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                        >
                            ← BACK TO HUB
                        </button>
                        {matchMeta && (
                            <div className="text-right">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${matchMeta.status === 'LIVE' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10' : 'text-slate-500 border-white/10 bg-white/5'}`}>
                                    {matchMeta.status}
                                </span>
                            </div>
                        )}
                    </div>

                    {showFullScorecard && matchDetails && (
                        <Scoreboard 
                            currentInnings={matchDetails.innings[matchDetails.innings.length - 1]} 
                            previousInnings={matchDetails.innings.length > 1 ? matchDetails.innings[0] : undefined}
                            onClose={() => setShowFullScorecard(false)}
                            isSpectator={true}
                            totalOvers={matchMeta?.totalOvers}
                        />
                    )}

                    {matchDetails && matchMeta?.status !== 'COMPLETED' ? (() => {
                        const currentInnings = matchDetails.innings[matchDetails.innings.length - 1];
                        
                        // Fallback strikers/bowlers from DB if no live Kafka update yet
                        const displayStrikerName = liveData?.batterName || currentInnings.players[currentInnings.strikerId]?.name || 'Waiting...';
                        const displayNonStrikerName = currentInnings.players[currentInnings.nonStrikerId]?.name || 'Waiting...';
                        const displayBowlerName = liveData?.bowlerName || currentInnings.bowlers[currentInnings.currentBowlerId]?.name || 'Waiting...';

                        // Find active batters (strictly current striker and non-striker)
                        const activeBatters = Object.values(currentInnings.players)
                            .filter((p: any) => (p.id === currentInnings.strikerId || p.id === currentInnings.nonStrikerId) && p.id !== "")
                            .sort((a: any, b: any) => a.id === currentInnings.strikerId ? -1 : 1);
                        
                        // Find current bowler
                        const currentBowler = currentInnings.bowlers[currentInnings.currentBowlerId] || {
                            name: displayBowlerName, overs: 0, balls: 0, runsConceded: 0, wickets: 0, maidens: 0
                        } as any;

                        const totalOversDec = currentInnings.overs + (currentInnings.balls / 6);
                        const crr = totalOversDec > 0 ? (currentInnings.totalRuns / totalOversDec).toFixed(1) : '0.0';

                        return (
                            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                {/* Score header */}
                                <div className="bg-slate-800/80 p-5 rounded-3xl border border-white/5 flex justify-between items-center relative overflow-hidden shadow-xl">
                                     <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -z-10"></div>
                                     <div className="flex flex-col">
                                         <div className="flex items-center gap-2 mb-1">
                                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{currentInnings.battingTeamName}</span>
                                             <span className="text-[8px] text-slate-600 italic">vs</span>
                                             <span className="text-[10px] font-black text-indigo-500/80 uppercase tracking-widest">{currentInnings.bowlingTeamName}</span>
                                         </div>
                                         <div className="flex items-baseline gap-2">
                                             <span className="text-4xl font-black text-white tabular-nums tracking-tighter italic">
                                                 {currentInnings.totalRuns}<span className="text-slate-600 mx-1">/</span>{currentInnings.totalWickets}
                                             </span>
                                         </div>
                                     </div>
                                     <div className="text-right flex flex-col items-end">
                                          <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded text-[9px] font-black uppercase tracking-widest mb-2">
                                              CRR {crr}
                                          </span>
                                          <span className="text-sm font-black text-slate-300 flex items-baseline gap-1">
                                              <span>{currentInnings.overs}.{currentInnings.balls}</span>
                                              <span className="text-[10px] text-slate-600">/</span>
                                              <span>{matchMeta?.totalOvers}</span>
                                              <span className="text-[9px] text-slate-600 tracking-tight ml-0.5">OVS</span>
                                          </span>
                                     </div>
                                </div>

                                {/* Batsmen */}
                                <div className="bg-white/5 rounded-2xl border border-white/5 p-4 space-y-3">
                                    <div className="grid grid-cols-[1fr_auto_auto] gap-4 text-[9px] font-black text-slate-500 uppercase tracking-widest pb-2 border-b border-white/5">
                                        <span>Batter</span>
                                        <span className="text-right w-10">R</span>
                                        <span className="text-right w-10 text-slate-600">B</span>
                                    </div>
                                    {activeBatters.length === 0 ? (
                                        <div className="text-[10px] font-black text-slate-600 uppercase text-center py-2">Waiting for first ball...</div>
                                    ) : activeBatters.map((b: any) => (
                                        <div key={b.id} className="grid grid-cols-[1fr_auto_auto] gap-4 items-center group">
                                            <span className={`font-black uppercase text-sm italic truncate ${b.id === currentInnings.strikerId ? 'text-white' : 'text-slate-400'}`}>
                                                {b.name} {b.id === currentInnings.strikerId && <span className="text-indigo-400 ml-1 opacity-80">*</span>}
                                            </span>
                                            <span className={`font-black tabular-nums text-right w-10 ${b.id === currentInnings.strikerId ? 'text-white' : 'text-slate-300'}`}>{b.runs}</span>
                                            <span className={`font-black tabular-nums text-right w-10 text-xs ${b.id === currentInnings.strikerId ? 'text-slate-400' : 'text-slate-500'}`}>{b.ballsFaced}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Bowler */}
                                <div className="bg-white/5 rounded-2xl border border-white/5 p-4 space-y-3">
                                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 text-[9px] font-black text-slate-500 uppercase tracking-widest pb-2 border-b border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[7px] text-indigo-400 mb-0.5 tracking-[0.2em]">{currentInnings.bowlingTeamName}</span>
                                            <span>Bowler</span>
                                        </div>
                                        <span className="text-right w-8">O</span>
                                        <span className="text-right w-8">R</span>
                                        <span className="text-right w-8 text-indigo-400">W</span>
                                    </div>
                                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                                        <span className="font-black text-white uppercase text-sm italic truncate">
                                            {currentBowler.name}
                                        </span>
                                        <span className="text-slate-400 font-black tabular-nums text-right w-8 text-xs">{currentBowler.overs}.{currentBowler.balls}</span>
                                        <span className="text-slate-300 font-black tabular-nums text-right w-8">{currentBowler.runsConceded}</span>
                                        <span className="text-indigo-400 font-black tabular-nums text-right w-8">{currentBowler.wickets}</span>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-white/5 text-center">
                                         <span className="px-2 py-0.5 bg-white/5 rounded text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2 w-max mx-auto">
                                            LIVE COMMENTARY
                                        </span>
                                        <p className="text-slate-300 text-xs font-medium italic leading-relaxed">
                                            {liveData ? `"${liveData.commentary}"` : "Waiting for the next ball..."}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowFullScorecard(true)}
                                    className="w-full py-4 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 rounded-2xl text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] transition-all"
                                >
                                    View Full Analysis 📋
                                </button>
                            </div>
                        );
                    })() : liveData ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                             <div className="flex justify-between items-end">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 italic">Current Batter</span>
                                    <span className="text-2xl font-black uppercase tracking-tighter italic">{liveData.batterName}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-4xl font-black text-white tabular-nums">{liveData.runs}</span>
                                    <span className="text-[10px] font-black text-slate-500 block uppercase tracking-widest">RUNS</span>
                                </div>
                            </div>

                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bowler: {liveData.bowlerName}</span>
                                    <span className="px-2 py-0.5 bg-indigo-600 rounded text-[9px] font-black uppercase tracking-widest">
                                        OVER {liveData.overNumber}.{liveData.ballNumber}
                                    </span>
                                </div>
                                <p className="text-slate-300 text-sm font-medium italic leading-relaxed">
                                    "{liveData.commentary}"
                                </p>
                            </div>

                            {matchDetails && (
                                <button
                                    onClick={() => setShowFullScorecard(true)}
                                    className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] transition-all"
                                >
                                    View Full Analysis 📋
                                </button>
                            )}
                        </div>
                    ) : loadingDetails ? (
                        <div className="py-12 text-center animate-pulse">
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest leading-relaxed italic">Restoring secure records...</span>
                        </div>
                    ) : matchDetails ? (
                        <div className="space-y-6 text-center">
                            <div className="bg-white/5 border border-white/5 rounded-3xl p-8 transform transition-transform">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Final Match Status</p>
                                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-4">
                                    {matchMeta?.teamA} vs {matchMeta?.teamB}
                                </h3>
                                <button
                                    onClick={() => setShowFullScorecard(true)}
                                    className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20"
                                >
                                    OPEN FULL SCORECARD 📋
                                </button>
                            </div>
                            <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest italic leading-relaxed">Waiting for Live Kafka Broadcast...<br/>(If Match is Live)</p>
                        </div>
                    ) : (
                         <div className="py-12 text-center">
                            <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] italic">Waiting for Kafka update...</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LiveScoreboard;
