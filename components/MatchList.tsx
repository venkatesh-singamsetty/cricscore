import React, { useState, useEffect } from 'react';

interface MatchMetadata {
    id: string;
    team_a_name: string;
    team_b_name: string;
    total_overs: number;
    status: string;
    created_at: string;
    updated_at: string;
}

interface MatchListProps {
    onSelectMatch: (matchId: string) => void;
}

const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'JUST NOW';
    if (mins < 60) return `${mins} MINS AGO`;
    return `${Math.floor(mins / 60)} HOURS AGO`;
};

const MatchList: React.FC<MatchListProps> = ({ onSelectMatch }) => {
    const [matches, setMatches] = useState<MatchMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const API_URL = import.meta.env.VITE_API_URL || "https://mmiwp8rgrf.execute-api.us-east-1.amazonaws.com";

    const fetchMatches = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/matches`);
            const data = await response.json();
            // Sort by latest first
            const sorted = [...data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setMatches(sorted);
        } catch (err) {
            console.error("Failed to fetch matches:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMatches();
    }, []);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Global Match Directory</h3>
                <button 
                    onClick={fetchMatches}
                    className="text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:text-white transition-colors"
                >
                    REFRESH HUB 🔄
                </button>
            </div>

            {loading ? (
                <div className="py-8 text-center animate-pulse">
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Searching Aiven DB...</span>
                </div>
            ) : matches.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-white/5 rounded-2xl">
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest leading-relaxed"> No Records Found.<br/>Be the first to start a match!</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                    {matches.map((match) => {
                        const isInactive = match.status === 'LIVE' && (Date.now() - new Date(match.updated_at).getTime()) > 3600000; // 1hr
                        const isTrulyLive = match.status === 'LIVE' && !isInactive;

                        return (
                        <button
                            key={match.id}
                            onClick={() => onSelectMatch(match.id)}
                            className="bg-white/5 border border-white/5 rounded-2xl p-4 text-left hover:bg-white/10 hover:border-indigo-500/30 transition-all group active:scale-[0.98]"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[9px] font-black uppercase tracking-widest ${isTrulyLive ? 'text-rose-500' : 'text-indigo-400'}`}>
                                    {getTimeAgo(match.created_at)} • {isTrulyLive ? '🔴 LIVE NOW' : isInactive ? '⏳ STALLED' : 'COMPLETED'}
                                </span>
                                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest tabular-nums">ID: {match.id.substring(0, 8)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="space-y-0.5">
                                    <h4 className="text-sm font-black text-white uppercase tracking-tight italic group-hover:text-indigo-400 transition-colors">
                                        {match.team_a_name}
                                    </h4>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">vs</span>
                                    <h4 className="text-sm font-black text-white uppercase tracking-tight italic group-hover:text-indigo-400 transition-colors">
                                        {match.team_b_name}
                                    </h4>
                                </div>
                                <div className="text-right">
                                    <span className="text-[8px] font-black text-slate-600 block uppercase mb-1">Status</span>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${isTrulyLive ? 'text-rose-500 bg-rose-500/10 border-rose-500/20' : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'}`}>
                                        {match.status}
                                    </span>
                                </div>
                            </div>
                        </button>
                    )})}
                </div>
            )}
        </div>
    );
};

export default MatchList;
