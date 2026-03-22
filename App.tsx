import React, { useState, useEffect } from 'react';
import { InningsState, MatchStatus, TeamData, Player, Bowler } from './types';
import MatchSetup from './components/MatchSetup';
import MatchView from './components/MatchView';

const loadSavedState = () => {
    const saved = localStorage.getItem('cric-scorer-match-state');
    if (saved) {
        try { return JSON.parse(saved); } catch { return null; }
    }
    return null;
};

const App: React.FC = () => {
    const savedState = loadSavedState();

    const [matchStatus, setMatchStatus] = useState<MatchStatus>(savedState?.matchStatus ?? MatchStatus.SETUP);
    const [currentInnings, setCurrentInnings] = useState<InningsState | null>(savedState?.currentInnings ?? null);
    const [previousInnings, setPreviousInnings] = useState<InningsState | undefined>(savedState?.previousInnings ?? undefined);

    // Match Config
    const [teamA, setTeamA] = useState<TeamData | null>(savedState?.teamA ?? null);
    const [teamB, setTeamB] = useState<TeamData | null>(savedState?.teamB ?? null);
    const [totalOvers, setTotalOvers] = useState(savedState?.totalOvers ?? 15);
    const [emailTo, setEmailTo] = useState('venky.2k57@gmail.com');
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    useEffect(() => {
        const stateToSave = {
            matchStatus,
            teamA,
            teamB,
            totalOvers,
            previousInnings,
            currentInnings
        };
        localStorage.setItem('cric-scorer-match-state', JSON.stringify(stateToSave));
    }, [matchStatus, teamA, teamB, totalOvers, previousInnings, currentInnings]);

    // Helper to create an innings
    const createInnings = (
        battingTeam: TeamData,
        bowlingTeam: TeamData,
        inningNumber: 1 | 2,
        target?: number
    ): InningsState => {
        // Initialize Batting Players
        const playersMap: Record<string, Player> = {};
        const battingOrder: string[] = [];
        battingTeam.players.forEach((name, idx) => {
            const id = `bat_${battingTeam.name.replace(/\s/g, '')}_${idx}`;
            playersMap[id] = {
                id,
                name: name,
                runs: 0,
                ballsFaced: 0,
                fours: 0,
                sixes: 0,
                isOut: false
            };
            battingOrder.push(id);
        });

        // Initialize Bowlers (from Bowling Team Squad)
        const bowlersMap: Record<string, Bowler> = {};
        const bowlingOrder: string[] = [];
        bowlingTeam.players.forEach((name, idx) => {
            const id = `bowl_${bowlingTeam.name.replace(/\s/g, '')}_${idx}`;
            bowlersMap[id] = {
                id,
                name: name,
                overs: 0,
                balls: 0,
                maidens: 0,
                runsConceded: 0,
                wickets: 0
            };
            bowlingOrder.push(id);
        });

        return {
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
            strikerId: '',
            nonStrikerId: '',
            currentBowlerId: '',
            players: playersMap,
            bowlers: bowlersMap,
            battingOrder,
            bowlingOrder
        };
    };

    const startMatch = (tA: TeamData, tB: TeamData, overs: number, batFirstTeamName: string) => {
        setTeamA(tA);
        setTeamB(tB);
        setTotalOvers(overs);

        const isTeamABatting = tA.name === batFirstTeamName;
        const battingTeam = isTeamABatting ? tA : tB;
        const bowlingTeam = isTeamABatting ? tB : tA;

        const innings1 = createInnings(battingTeam, bowlingTeam, 1);
        setCurrentInnings(innings1);
        setPreviousInnings(undefined);
        setMatchStatus(MatchStatus.LIVE);
    };

    const handleInningsEnd = (completedInnings: InningsState) => {
        if (completedInnings.inningNumber === 1) {
            // Transition to 2nd Innings
            setPreviousInnings(completedInnings);

            if (!teamA || !teamB) return;

            const nextBattingTeam = completedInnings.battingTeamName === teamA.name ? teamB : teamA;
            const nextBowlingTeam = completedInnings.battingTeamName === teamA.name ? teamA : teamB;

            const target = completedInnings.totalRuns + 1;
            const innings2 = createInnings(nextBattingTeam, nextBowlingTeam, 2, target);

            setCurrentInnings(innings2);
            setMatchStatus(MatchStatus.INNINGS_BREAK);
        } else {
            setCurrentInnings(completedInnings);
            setMatchStatus(MatchStatus.COMPLETED);
        }
    };

    const resetMatch = () => {
        setMatchStatus(MatchStatus.SETUP);
        setCurrentInnings(null);
        setPreviousInnings(undefined);
        localStorage.removeItem('cric-scorer-match-state');
        localStorage.removeItem('cric-scorer-live-innings');
    }

    const getWinnerMessage = () => {
        if (!currentInnings || !previousInnings) return '';

        const target = currentInnings.target || 0;
        if (currentInnings.totalRuns >= target) {
            return `${currentInnings.battingTeamName} won by ${10 - currentInnings.totalWickets} wickets`;
        } else {
            const runDiff = (target - 1) - currentInnings.totalRuns;
            if (runDiff === 0) return "Match Tied!";
            return `${currentInnings.bowlingTeamName} won by ${runDiff} runs`;
        }
    };

    const generateScorecardText = (innings: InningsState) => {
        let text = `${innings.battingTeamName} - ${innings.totalRuns}/${innings.totalWickets} in ${innings.overs}.${innings.balls} Overs\n`;
        text += `\n🏏 BATTING\n`;
        text += `--------------------------------------------------\n`;
        innings.battingOrder.forEach(id => {
            const p = innings.players[id];
            if (p.ballsFaced > 0 || p.isOut) {
                let status = 'not out';
                if (p.isOut) {
                    status = `b ${p.wicketBy} ${p.fielderName ? `c ${p.fielderName}` : ''}`;
                }
                text += `${p.name.padEnd(15)} | ${p.runs} (${p.ballsFaced}) | 4s: ${p.fours} | 6s: ${p.sixes} | ${status}\n`;
            }
        });
        text += `--------------------------------------------------\n`;
        text += `\n🥎 BOWLING\n`;
        text += `--------------------------------------------------\n`;
        innings.bowlingOrder.forEach(id => {
            const b = innings.bowlers[id];
            if (b.overs > 0 || b.balls > 0) {
                text += `${b.name.padEnd(15)} | ${b.overs}.${b.balls} O | ${b.maidens} M | ${b.runsConceded} R | ${b.wickets} W\n`;
            }
        });
        text += `--------------------------------------------------\n`;
        return text;
    };

    const handleSendEmail = () => {
        if (!currentInnings || !previousInnings) return;

        const subject = encodeURIComponent(`CRICSCORE_RESULT: ${previousInnings.battingTeamName} vs ${currentInnings.battingTeamName}`);

        let bodyContext = `🏆 MATCH RESULT 🏆\n${getWinnerMessage()}\n\n`;
        bodyContext += `==================================================\n`;
        bodyContext += `▶ INNINGS 1: ${previousInnings.battingTeamName}\n`;
        bodyContext += `==================================================\n`;
        bodyContext += generateScorecardText(previousInnings) + `\n\n`;
        bodyContext += `==================================================\n`;
        bodyContext += `▶ INNINGS 2: ${currentInnings.battingTeamName}\n`;
        bodyContext += `==================================================\n`;
        bodyContext += generateScorecardText(currentInnings) + `\n\n`;
        bodyContext += `--- Generated securely via CricScore ---`;

        const body = encodeURIComponent(bodyContext);

        window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
    };

    return (
        <div className="h-[100dvh] bg-slate-50 font-sans text-slate-900 flex flex-col overflow-hidden relative">
            {/* Global "Start New Match" Bar */}
            {matchStatus !== MatchStatus.SETUP && (
                <div className="bg-slate-950 px-3 py-2 flex justify-between items-center shrink-0 border-b border-white/10 z-50 shadow-md">
                    <span className="text-[11px] uppercase font-black tracking-widest text-slate-400 italic">
                        CricScore
                    </span>
                    <button
                        onClick={() => setShowResetConfirm(true)}
                        className="px-4 py-1.5 bg-red-900/30 border border-red-500/20 rounded font-black text-[10px] uppercase tracking-wider text-red-500 hover:text-white transition-all hover:bg-red-600 focus:outline-none"
                    >
                        START NEW MATCH
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-hidden relative">

                {/* Custom Reset Confirmation Modal */}
                {showResetConfirm && (
                    <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-700/50 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-center text-slate-100 animate-in zoom-in-95 duration-200">
                            <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                                <span className="text-3xl">⚠️</span>
                            </div>
                            <h3 className="text-xl font-black uppercase tracking-widest text-white mb-2 italic">Reset Scoreboard</h3>
                            <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                                This will end the current match and reset the scoreboard.<br />
                                <br />
                                <strong className="text-white uppercase tracking-wider text-xs block">Do you want to continue?</strong>
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

                {matchStatus === MatchStatus.SETUP && (
                    <MatchSetup onStartMatch={startMatch} />
                )}

                {matchStatus === MatchStatus.LIVE && currentInnings && (
                    <MatchView
                        initialState={currentInnings}
                        previousInnings={previousInnings}
                        totalOvers={totalOvers}
                        onInningsEnd={handleInningsEnd}
                        onResetMatch={() => setShowResetConfirm(true)}
                    />
                )}

                {matchStatus === MatchStatus.INNINGS_BREAK && currentInnings && previousInnings && (
                    <div className="h-full overflow-y-auto flex items-center justify-center p-4 bg-slate-950 selection:bg-indigo-500/30">
                        <div className="relative w-full max-w-2xl animate-in zoom-in-95 duration-500 text-center">
                            <div className="bg-slate-900 border border-white/5 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden backdrop-blur-3xl">
                                <h2 className="text-4xl font-black text-white uppercase tracking-tighter italic mb-4">Innings Break</h2>
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
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500">Official Result</span>
                                        </div>
                                        <div className="text-8xl animate-bounce">🏆</div>
                                        <h1 className="text-6xl font-black text-white uppercase tracking-tighter italic leading-none">
                                            Match<br />Concluded
                                        </h1>
                                    </div>

                                    <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-3xl p-8 transform hover:scale-[1.02] transition-transform">
                                        <p className="text-4xl font-black text-indigo-400 uppercase tracking-tight italic drop-shadow-2xl">
                                            {getWinnerMessage()}
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">Final Scorecards</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {/* First Innings Summary */}
                                            <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-5 flex justify-between items-center group hover:bg-slate-800 transition-colors">
                                                <div className="text-left">
                                                    <span className="text-[10px] font-black text-slate-500 block mb-1 uppercase tracking-widest">Innings 1</span>
                                                    <span className="text-xl font-black text-slate-300 uppercase tracking-tight italic">{previousInnings?.battingTeamName}</span>
                                                </div>
                                                <div className="text-4xl font-black text-white tabular-nums">
                                                    {previousInnings?.totalRuns}<span className="text-slate-600 mx-1 text-2xl">/</span>{previousInnings?.totalWickets}
                                                </div>
                                            </div>

                                            {/* Second Innings Summary */}
                                            <div className="bg-indigo-600 border border-indigo-400 rounded-2xl p-5 flex justify-between items-center shadow-xl shadow-indigo-600/20">
                                                <div className="text-left">
                                                    <span className="text-[10px] font-black text-indigo-100 block mb-1 uppercase tracking-widest">Innings 2</span>
                                                    <span className="text-xl font-black text-white uppercase tracking-tight italic">{currentInnings.battingTeamName}</span>
                                                </div>
                                                <div className="text-4xl font-black text-white tabular-nums">
                                                    {currentInnings.totalRuns}<span className="text-indigo-300 mx-1 text-2xl">/</span>{currentInnings.totalWickets}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-12 w-full space-y-4">
                                        <div className="flex flex-col items-start gap-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-4">Target Email for Result</label>
                                            <input
                                                type="email"
                                                value={emailTo}
                                                onChange={(e) => setEmailTo(e.target.value)}
                                                className="w-full bg-slate-800/50 border border-white/10 rounded-full py-4 px-6 text-white font-bold outline-none focus:border-indigo-500 transition-colors"
                                                placeholder="Enter email address"
                                            />
                                        </div>
                                        <div className="flex flex-col md:flex-row gap-4 w-full">
                                            <button
                                                onClick={handleSendEmail}
                                                className="flex-1 h-20 bg-blue-600 text-white rounded-[1.5rem] font-black text-xl uppercase tracking-widest italic hover:bg-blue-500 active:scale-[0.98] transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3"
                                            >
                                                EMAIL RESULT 📨
                                            </button>
                                            <button
                                                onClick={() => setShowResetConfirm(true)}
                                                className="flex-1 h-20 bg-white text-slate-900 rounded-[1.5rem] font-black text-xl uppercase tracking-widest italic hover:bg-slate-100 active:scale-[0.98] transition-all shadow-2xl flex items-center justify-center gap-3"
                                            >
                                                START NEW FIXTURE
                                                <span className="text-2xl">⚡</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Detail */}
                            <p className="mt-8 text-[10px] font-black text-slate-600 uppercase tracking-[0.5em] text-center italic opacity-50">
                                CricScore Record Log #77291-LIVE
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;