import React, { useState, useEffect } from 'react';
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
    const [matchMeta, setMatchMeta] = useState<{ status: string; teamA: string; teamB: string } | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [showFullScorecard, setShowFullScorecard] = useState(false);

    useEffect(() => {
        // Only accept updates for the match we are following
        if (lastMessage?.type === 'LIVE_SCORE_UPDATE') {
            const data = lastMessage.data;
            console.log("📥 WS Message 'LIVE_SCORE_UPDATE' -> target:", targetMatchId, "incoming:", data.matchId, data);
            if (!targetMatchId || data.matchId === targetMatchId) {
                console.log("✅ Match id matched! Setting liveData with runs:", data.runs);
                setLiveData(data);
            } else {
                console.warn("❌ Match id mismatch. Ignoring.");
            }
        }
    }, [lastMessage, targetMatchId]);

    useEffect(() => {
        // Reset state when following a new match
        setLiveData(null);
        setMatchDetails(null);
        setMatchMeta(null);
        setShowFullScorecard(false);

        if (targetMatchId) {
            const fetchDetails = async () => {
                setLoadingDetails(true);
                try {
                    const response = await fetch(`${API_URL}/match/${targetMatchId}/details`);
                    const data = await response.json();
                    
                    setMatchMeta({
                        status: data.match.status,
                        teamA: data.match.team_a_name,
                        teamB: data.match.team_b_name
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
                        strikerId: '',
                        nonStrikerId: '',
                        currentBowlerId: '',
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
                    setLoadingDetails(false);
                }
            };
            fetchDetails();
        }
    }, [targetMatchId]);

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
                            onResetMatch={() => {}}
                        />
                    )}

                    {liveData ? (
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
