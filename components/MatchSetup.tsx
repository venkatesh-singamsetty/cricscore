import React, { useState, useRef, useEffect } from 'react';
import { TeamData } from '../types';

interface MatchSetupProps {
    onStartMatch: (teamA: TeamData, teamB: TeamData, overs: number, batFirstTeam: string, matchId: string, inningId: string) => void;
}

const handleScroll = (textarea: HTMLTextAreaElement, lineNumbers: HTMLDivElement) => {
    if (lineNumbers) {
        lineNumbers.scrollTop = textarea.scrollTop;
    }
};

const SquadInput = ({
    label,
    value,
    setValue,
    accentColor,
    textareaRef,
    lineNumbersRef
}: {
    label: string,
    value: string,
    setValue: (v: string) => void,
    accentColor: string,
    textareaRef: React.RefObject<HTMLTextAreaElement>,
    lineNumbersRef: React.RefObject<HTMLDivElement>
}) => {
    const lines = value.split('\n');
    const lineCount = Math.max(lines.length, 1);

    const handleBlur = () => {
        const cleaned = value.split('\n')
            .map(s => s.trim().toUpperCase())
            .filter(s => s.length > 0);

        const newValue = cleaned.join('\n');
        if (newValue !== value.trim()) {
            setValue(newValue);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        const upValue = e.target.value.toUpperCase();

        setValue(upValue);

        // Re-sync cursor after React state update
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
                <label className={`text-[10px] font-black uppercase tracking-widest ${accentColor}`}>{label}</label>
                <div className="flex gap-2 items-center">
                    <button
                        type="button"
                        onClick={() => setValue("")}
                        className={`text-[9px] font-black px-1.5 py-0.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-400 rounded-full border border-red-500/20 transition-all uppercase`}
                    >
                        CLEAR 🗑️
                    </button>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 bg-white/5 ${accentColor} rounded-full border border-white/5 flex items-center gap-1`}>
                        <span className="animate-pulse">●</span> {lines.filter(s => s.trim().length > 0).length} ROSTER
                    </span>
                </div>
            </div>
            {/* Flexibly scale up to 12 rows (350px) but shrink on small phones */}
            <div className="relative flex-1 min-h-[150px] max-h-[350px] flex bg-slate-950 rounded-[1.5rem] border border-white/10 overflow-hidden focus-within:border-indigo-500/50 transition-all shadow-2xl shrink-0">
                <div
                    ref={lineNumbersRef}
                    className="w-10 bg-slate-900/50 border-r border-white/5 flex flex-col items-center pt-2 select-none overflow-hidden shrink-0"
                >
                    {Array.from({ length: Math.max(lineCount, 50) }).map((_, i) => (
                        <span key={i} className="text-[11px] font-black text-slate-700 h-[28px] leading-[28px]">
                            {i + 1}
                        </span>
                    ))}
                </div>
                <textarea
                    ref={textareaRef}
                    onBlur={handleBlur}
                    onScroll={() => textareaRef.current && lineNumbersRef.current && handleScroll(textareaRef.current, lineNumbersRef.current)}
                    className="flex-1 bg-transparent px-4 pt-2 pb-8 text-sm font-black text-slate-300 outline-none resize-none scrollbar-hide uppercase leading-[28px] overflow-y-auto"
                    value={value}
                    onChange={handleChange}
                    placeholder="Enter player name..."
                />
            </div>
        </div>
    );
};

const MatchSetup: React.FC<MatchSetupProps> = ({ onStartMatch }) => {
    const [teamAName, setTeamAName] = useState('CHICAGO SPARTANS');
    const [teamASquad, setTeamASquad] = useState(['DONNY', 'JIGAR', 'RAJU', 'SANDY', 'SHOBS', 'SHYAM', 'SUNIL', 'SURENDRA', 'VAMSI DESPLANES', 'VAMSI NAPERVILLE', 'VENKY'].join('\n'));

    const [teamBName, setTeamBName] = useState('TEAM B')
    const [teamBSquad, setTeamBSquad] = useState(['ABHISHEK', 'SANJU', 'ISHAN', 'SURYAKUMAR', 'TILAK', 'HARDIK', 'AXAR', 'SHIVAM', 'VARUN', 'ARSHDEEP', 'JASPRIT'].join('\n'));

    const [overs, setOvers] = useState(20);
    const [batFirst, setBatFirst] = useState('Team A'); // 'Team A' or 'Team B'

    const textareaRefA = useRef<HTMLTextAreaElement>(null);
    const textareaRefB = useRef<HTMLTextAreaElement>(null);
    const lineNumbersRefA = useRef<HTMLDivElement>(null);
    const lineNumbersRefB = useRef<HTMLDivElement>(null);

    const parsedTeamA = teamASquad.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    const parsedTeamB = teamBSquad.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    const isValid = parsedTeamA.length >= 2 && parsedTeamB.length >= 2 && teamAName.trim() !== '' && teamBName.trim() !== '';

    const [isCreating, setIsCreating] = useState(false);
    const API_URL = import.meta.env.VITE_API_URL || "https://mmiwp8rgrf.execute-api.us-east-1.amazonaws.com";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isValid) {
            alert("Both teams must have at least 2 players to start a match.");
            return;
        }

        setIsCreating(true);
        try {
            const teamA: TeamData = { name: teamAName.trim(), players: parsedTeamA };
            const teamB: TeamData = { name: teamBName.trim(), players: parsedTeamB };
            const batFirstTeamName = batFirst === 'Team A' ? teamA.name : teamB.name;

            // 🏛️ Initialize Match in Aiven PostgreSQL
            const response = await fetch(`${API_URL}/match`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    teamA: teamA.name,
                    teamB: teamB.name,
                    totalOvers: overs,
                    batFirstTeam: batFirstTeamName,
                    teamASquad: teamA.players,
                    teamBSquad: teamB.players
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Match provisioning failed: ${errText}`);
            }

            const { matchId, inningId } = await response.json();
            console.log("Match Registered in Cloud ☁️:", matchId, "Inning:", inningId);

            onStartMatch(teamA, teamB, overs, batFirstTeamName, matchId, inningId);
        } catch (err) {
            console.error("Match Initialization Failed:", err);
            alert("Cloud Connection Failed. Check your Aiven database status.");
        } finally {
            setIsCreating(false);
        }
    };


    return (
        <div className="h-full bg-slate-950 text-slate-100 overflow-hidden flex flex-col selection:bg-indigo-500/30">
            <div className="max-w-6xl mx-auto flex flex-col h-full w-full p-2 md:p-3 animate-in fade-in zoom-in-95 duration-500">
                {/* Fixed Header */}
                <div className="flex justify-center items-center py-1 shrink-0">
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-500 uppercase tracking-tighter italic leading-none">
                        Match <span className="text-indigo-500">Configurations</span>
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
                    {/* Team Cards Grid - Flexible to fill space */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0">
                        {/* Team A Card */}
                        <div className="relative group flex flex-col min-h-0">
                            <div className="relative flex-1 bg-slate-900/50 border border-white/5 p-4 rounded-[2rem] flex flex-col space-y-3 backdrop-blur-sm shadow-2xl overflow-hidden">
                                <div className="shrink-0 text-center">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-1 block">Team Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-5 py-2 text-base font-black text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all uppercase placeholder:opacity-20 shadow-inner text-center"
                                        value={teamAName}
                                        onChange={(e) => {
                                            const start = e.target.selectionStart;
                                            const end = e.target.selectionEnd;
                                            const val = e.target.value.toUpperCase();
                                            setTeamAName(val);
                                            setTimeout(() => {
                                                e.target.selectionStart = start;
                                                e.target.selectionEnd = end;
                                            }, 0);
                                        }}
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

                        {/* Team B Card */}
                        <div className="relative group flex flex-col min-h-0">
                            <div className="relative flex-1 bg-slate-900/50 border border-white/5 p-4 rounded-[2rem] flex flex-col space-y-3 backdrop-blur-sm shadow-2xl overflow-hidden">
                                <div className="shrink-0 text-center">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-purple-400 mb-1 block">Team Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-5 py-2 text-base font-black text-white focus:ring-2 focus:ring-purple-500 outline-none transition-all uppercase placeholder:opacity-20 shadow-inner text-center"
                                        value={teamBName}
                                        onChange={(e) => {
                                            const start = e.target.selectionStart;
                                            const end = e.target.selectionEnd;
                                            const val = e.target.value.toUpperCase();
                                            setTeamBName(val);
                                            setTimeout(() => {
                                                e.target.selectionStart = start;
                                                e.target.selectionEnd = end;
                                            }, 0);
                                        }}
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

                    {/* Parameters Strip - Anchored to bottom of form */}
                    <div className="bg-slate-900/80 border border-indigo-500/20 p-4 rounded-[2rem] shadow-2xl backdrop-blur-xl shrink-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center px-4">
                            <div className="flex items-center gap-6">
                                <div className="shrink-0">
                                    <label className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500 block mb-0.5">Settings</label>
                                    <h4 className="text-[11px] font-black text-white uppercase italic">Standard Ovs</h4>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min={1}
                                        max={50}
                                        className="w-16 bg-slate-950 border border-indigo-500/30 rounded-xl py-2 text-xl font-black text-white outline-none text-center focus:ring-2 focus:ring-indigo-500 transition-all tabular-nums shadow-inner"
                                        value={overs}
                                        onChange={(e) => setOvers(Number(e.target.value))}
                                    />
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Overs</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500 block">Who Bats First?</label>
                                <div className="bg-slate-950 p-1 rounded-xl border border-white/5 flex gap-2 shadow-inner">
                                    <button
                                        type="button"
                                        onClick={() => setBatFirst('Team A')}
                                        className={`flex-1 py-2 px-3 rounded-lg font-black text-[10px] uppercase tracking-tighter transition-all truncate border ${batFirst === 'Team A' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 border-indigo-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                                    >
                                        {teamAName || 'TEAM A'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBatFirst('Team B')}
                                        className={`flex-1 py-2 px-3 rounded-lg font-black text-[10px] uppercase tracking-tighter transition-all truncate border ${batFirst === 'Team B' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 border-indigo-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                                    >
                                        {teamBName || 'TEAM B'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Launch Button - Must stay visible */}
                    <button
                        type="submit"
                        disabled={!isValid}
                        className={`group relative w-full h-16 rounded-[1.5rem] overflow-hidden transition-all shrink-0 shadow-2xl border-t border-white/20 ${isValid ? 'bg-indigo-600 hover:scale-[1.002] active:scale-[0.98]' : 'bg-slate-800 opacity-80 cursor-not-allowed'}`}
                    >
                        {isValid && <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:opacity-90"></div>}
                        <div className="relative flex flex-col items-center justify-center h-full">
                            <div className="flex items-center gap-4">
                                <span className={`text-xl font-black uppercase italic transition-all ${isValid ? 'text-white tracking-[0.4em] group-hover:tracking-[0.5em]' : 'text-slate-500 tracking-[0.2em]'}`}>Start Fresh Match</span>
                                {isValid && <span className="text-2xl group-hover:translate-x-2 transition-transform">🏁</span>}
                            </div>
                            {!isValid && <span className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-widest">Requires min. 2 players per team</span>}
                        </div>
                    </button>
                </form>

                {/* Footer Detail */}
                <div className="text-center py-1 opacity-10 shrink-0">
                    <p className="text-[8px] font-black uppercase tracking-[0.8em] text-slate-500">CricScore Hyper-Secure Protocol</p>
                </div>
            </div>
        </div>
    );
};

export default MatchSetup;