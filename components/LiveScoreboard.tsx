import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import MatchList from './MatchList'; // Added Phase 6+

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
    const [targetMatchId, setTargetMatchId] = useState<string>("");
    const { lastMessage, isConnected } = useWebSocket(WS_URL);
    const [liveData, setLiveData] = useState<LiveBall | null>(null);

    useEffect(() => {
        // Only accept updates for the match we are following
        if (lastMessage?.type === 'LIVE_SCORE_UPDATE') {
            const data = lastMessage.data;
            if (!targetMatchId || data.matchId === targetMatchId) {
                setLiveData(data);
            }
        }
    }, [lastMessage, targetMatchId]);

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
            ) : !liveData ? (
                <div className="py-12 text-center">
                    <button 
                        onClick={() => setTargetMatchId("")}
                        className="text-[10px] font-black text-slate-700 uppercase tracking-widest hover:text-indigo-400 transition-colors"
                    >
                        ← BACK TO MATCH LIST
                    </button>
                    <p className="mt-8 text-slate-500 font-black uppercase tracking-widest text-[10px] italic">Waiting for Kafka update...</p>
                </div>
            ) : (
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
                        <p className="text-slate-300 text-sm font-medium italic italic leading-relaxed">
                            "{liveData.commentary}"
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveScoreboard;
