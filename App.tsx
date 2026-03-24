import React, { useState, useEffect } from 'react';
import { InningsState, MatchStatus, TeamData, Player, Bowler, BallEvent } from './types';
import MatchSetup from './components/MatchSetup';
import MatchView from './components/MatchView';
import LiveScoreboard from './components/LiveScoreboard'; // Added Phase 6

const loadSavedState = () => {
    const saved = localStorage.getItem('cric-scorer-match-state');
    if (saved) {
        try { return JSON.parse(saved); } catch { return null; }
    }
    return null;
};

const App: React.FC = () => {
    const savedState = loadSavedState();

    const [view, setView] = useState<'VIEWER' | 'SCORER' | 'ADMIN'>(savedState?.view ?? 'VIEWER');
    const [hubKey, setHubKey] = useState(0); // For forcing reset to list
    const [matchStatus, setMatchStatus] = useState<MatchStatus>(savedState?.matchStatus ?? MatchStatus.SETUP);
    const [currentInnings, setCurrentInnings] = useState<InningsState | null>(savedState?.currentInnings ?? null);
    const [previousInnings, setPreviousInnings] = useState<InningsState | undefined>(savedState?.previousInnings ?? undefined);

    // Match Config
    const [teamA, setTeamA] = useState<TeamData | null>(savedState?.teamA ?? null);
    const [teamB, setTeamB] = useState<TeamData | null>(savedState?.teamB ?? null);
    const [totalOvers, setTotalOvers] = useState(savedState?.totalOvers ?? 15);
    const [matchId, setMatchId] = useState<string | null>(savedState?.matchId ?? null);
    const [emailTo, setEmailTo] = useState('@gmail.com');
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [targetMatchId, setTargetMatchId] = useState<string | null>(null);
    const [hasSentAutoEmail, setHasSentAutoEmail] = useState<boolean>(savedState?.hasSentAutoEmail ?? false);

    useEffect(() => {
        // Handle direct links to matches via URL ?matchId=xxx
        const params = new URLSearchParams(window.location.search);
        const mId = params.get('matchId');
        if (mId && mId !== targetMatchId) {
            setTargetMatchId(mId);
        }
    }, []);

    useEffect(() => {
        // Reset state when following a new match
        if (targetMatchId && targetMatchId !== matchId) {
            // Clear current match state to load the new one
            setMatchStatus(MatchStatus.SETUP);
            setCurrentInnings(null);
            setPreviousInnings(undefined);
            setTeamA(null);
            setTeamB(null);
            setTotalOvers(15);
            setMatchId(null);
            setView('VIEWER'); // Automatically switch to viewer view
            resumeMatch(targetMatchId); // Attempt to load the match
        }
    }, [targetMatchId]);

    useEffect(() => {
        const stateToSave = {
            matchStatus,
            matchId,
            teamA,
            teamB,
            totalOvers,
            previousInnings,
            currentInnings,
            view, // Persist the tab view
            hasSentAutoEmail
        };
        localStorage.setItem('cric-scorer-match-state', JSON.stringify(stateToSave));
    }, [matchStatus, matchId, teamA, teamB, totalOvers, previousInnings, currentInnings, view, hasSentAutoEmail]);

    // Helper to create an innings
    const createInnings = (
        id: string,
        battingTeam: TeamData,
        bowlingTeam: TeamData,
        inningNumber: 1 | 2,
        target?: number
    ): InningsState => {
        // Initialize Batting Players
        const playersMap: Record<string, Player> = {};
        const battingOrder: string[] = [];
        battingTeam.players.forEach((name, idx) => {
            const playerId = `bat_${battingTeam.name.replace(/\s/g, '')}_${idx}`;
            playersMap[playerId] = {
                id: playerId,
                name: name,
                runs: 0,
                ballsFaced: 0,
                fours: 0,
                sixes: 0,
                isOut: false
            };
            battingOrder.push(playerId);
        });

        // Initialize Bowlers (from Bowling Team Squad)
        const bowlersMap: Record<string, Bowler> = {};
        const bowlingOrder: string[] = [];
        bowlingTeam.players.forEach((name, idx) => {
            const bowlerId = `bowl_${bowlingTeam.name.replace(/\s/g, '')}_${idx}`;
            bowlersMap[bowlerId] = {
                id: bowlerId,
                name: name,
                overs: 0,
                balls: 0,
                maidens: 0,
                runsConceded: 0,
                wickets: 0
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
            strikerId: '',
            nonStrikerId: '',
            currentBowlerId: '',
            players: playersMap,
            bowlers: bowlersMap,
            battingOrder,
            bowlingOrder
        };
    };

    const startMatch = (tA: TeamData, tB: TeamData, overs: number, batFirstTeamName: string, mId: string, iId: string) => {
        setTeamA(tA);
        setTeamB(tB);
        setTotalOvers(overs);
        setMatchId(mId);

        const isTeamABatting = tA.name === batFirstTeamName;
        const battingTeam = isTeamABatting ? tA : tB;
        const bowlingTeam = isTeamABatting ? tB : tA;

        const innings1 = createInnings(iId, battingTeam, bowlingTeam, 1);
        setCurrentInnings(innings1);
        setPreviousInnings(undefined);
        setMatchStatus(MatchStatus.LIVE);
    };

    const handleInningsEnd = async (completedInnings: InningsState) => {
        if (completedInnings.inningNumber === 1) {
            // Transition to 2nd Innings
            setPreviousInnings(completedInnings);

            if (!teamA || !teamB) return;

            const nextBattingTeam = completedInnings.battingTeamName === teamA.name ? teamB : teamA;
            const nextBowlingTeam = completedInnings.battingTeamName === teamA.name ? teamA : teamB;

            const target = completedInnings.totalRuns + 1;

            const API_URL = import.meta.env.VITE_API_URL || "https://mmiwp8rgrf.execute-api.us-east-1.amazonaws.com";
            
            try {
                const response = await fetch(`${API_URL}/match/${matchId}/innings`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        matchId,
                        inningNumber: 2,
                        battingTeam: nextBattingTeam.name,
                        bowlingTeam: nextBowlingTeam.name,
                        target,
                        battingSquad: nextBattingTeam.players,
                        bowlingSquad: nextBowlingTeam.players
                    })
                });
                const { inningId: id2 } = await response.json();
                const innings2 = createInnings(id2, nextBattingTeam, nextBowlingTeam, 2, target);
                setCurrentInnings(innings2);
                setMatchStatus(MatchStatus.INNINGS_BREAK);
            } catch (err) {
                console.error("Failed to create 2nd Innings:", err);
            }
        } else {
            setCurrentInnings(completedInnings);
            setMatchStatus(MatchStatus.COMPLETED);

            // Sync final match status to DB
            if (matchId) {
                const API_URL = import.meta.env.VITE_API_URL || "https://mmiwp8rgrf.execute-api.us-east-1.amazonaws.com";
                try {
                    await fetch(`${API_URL}/match/${matchId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: MatchStatus.COMPLETED })
                    });
                    console.log("Match Status Updated to COMPLETED ✅");
                } catch (err) {
                    console.error("Failed to update match status:", err);
                }
            }
        }
    };

    const resumeMatch = async (mId: string) => {
        const API_URL = import.meta.env.VITE_API_URL || "https://mmiwp8rgrf.execute-api.us-east-1.amazonaws.com";
        try {
            console.log("Resuming Match...", mId);
            const response = await fetch(`${API_URL}/match/${mId}/details`);
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
                        fielderName: p.fielder_name
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
                        wickets: b.wickets
                    };
                    bowlingOrder.push(b.id);
                });

                // Mapping Ball Events
                const allMappedBalls: BallEvent[] = (inn.allBalls || []).map((alt: any) => ({
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
                    commentary: alt.commentary
                }));

                const currentOver = allMappedBalls.filter(b => b.overNumber === inn.overs);

                return {
                    id: inn.id,
                    inningNumber: inn.inning_number,
                    target: inn.target,
                    battingTeamName: inn.batting_team_name,
                    bowlingTeamName: inn.bowling_team_name,
                    totalRuns: inn.total_runs,
                    totalWickets: inn.total_wickets,
                    overs: inn.overs,
                    balls: inn.balls,
                    currentOver,
                    allBalls: allMappedBalls,
                    strikerId: inn.striker_name ? (inn.players.find((p: any) => p.name === inn.striker_name)?.id || '') : '',
                    nonStrikerId: inn.non_striker_name ? (inn.players.find((p: any) => p.name === inn.non_striker_name)?.id || '') : '',
                    currentBowlerId: inn.current_bowler_name ? (inn.bowlers.find((b: any) => b.name === inn.current_bowler_name)?.id || '') : '',
                    players: playersMap,
                    bowlers: bowlersMap,
                    battingOrder,
                    bowlingOrder
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
                if (match.status === 'COMPLETED') {
                    setMatchStatus(MatchStatus.COMPLETED);
                } else if (inn2.totalRuns === 0 && inn2.overs === 0 && inn2.balls === 0) {
                     setMatchStatus(MatchStatus.INNINGS_BREAK);
                } else {
                    setMatchStatus(MatchStatus.LIVE);
                }
            }

            console.log("Match Resumed ✅");
        } catch (err) {
            console.error("Failed to resume match:", err);
            alert("Resuming match failed. Please try again.");
        }
    };

    const resetMatch = () => {
        setMatchStatus(MatchStatus.SETUP);
        setCurrentInnings(null);
        setPreviousInnings(undefined);
        localStorage.removeItem('cric-scorer-match-state');
        localStorage.removeItem('cric-scorer-live-innings');
    }

    const updateMatchOvers = async (newOvers: number) => {
        if (!matchId) return;
        setTotalOvers(newOvers);
        const API_URL = import.meta.env.VITE_API_URL || "https://mmiwp8rgrf.execute-api.us-east-1.amazonaws.com";
        try {
             await fetch(`${API_URL}/match/${matchId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ totalOvers: newOvers })
            });
            console.log("Match Overs Updated 📡");
        } catch (err) {
            console.error("Failed to update match overs:", err);
        }
    };

    const getWinnerMessage = () => {
        if (!currentInnings || !previousInnings) return '';

        const target = currentInnings.target || 0;
        if (currentInnings.totalRuns >= target) {
            return `${currentInnings.battingTeamName} WON BY ${10 - currentInnings.totalWickets} WICKETS`;
        } else {
            const runDiff = (target - 1) - currentInnings.totalRuns;
            if (runDiff === 0) return "MATCH TIED!";
            return `${currentInnings.bowlingTeamName} WON BY ${runDiff} RUNS`;
        }
    };

    const generateScorecardText = (innings: InningsState) => {
        const header = `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n┃ ${innings.battingTeamName.padEnd(30)} ${innings.totalRuns.toString().padStart(3)}/${innings.totalWickets} ┃\n┃ ${(`${innings.overs}.${innings.balls} Overs`).padEnd(30)}        ┃\n┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫`;
        
        let batting = `\n┃ 🏏 BATTING                                          ┃\n`;
        innings.battingOrder.forEach(id => {
            const p = innings.players[id];
            if (p.ballsFaced > 0 || p.isOut || p.id === innings.strikerId || p.id === innings.nonStrikerId) {
                const score = `${p.runs}(${p.ballsFaced})`.padEnd(10);
                const boundary = `${p.fours}x4 ${p.sixes}x6`.padEnd(10);
                const line = `┃ ${p.name.padEnd(15)} | ${score} | ${boundary} ┃`;
                batting += line + `\n`;
            }
        });

        let bowling = `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n┃ 🥎 BOWLING                                          ┃\n`;
        innings.bowlingOrder.forEach(id => {
            const b = innings.bowlers[id];
            if (b.overs > 0 || b.balls > 0) {
                const stats = `${b.overs}.${b.balls}ov ${b.runsConceded}r ${b.wickets}w`.padEnd(25);
                const line = `┃ ${b.name.padEnd(15)} | ${stats}  ┃`;
                bowling += line + `\n`;
            }
        });

        const footer = `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;
        return header + batting + bowling + footer;
    };

    const [sendingEmail, setSendingEmail] = useState(false);

    const handleSendEmail = async (silent = false) => {
        if (!currentInnings || !matchId) return;

        setSendingEmail(true);
        const API_URL = import.meta.env.VITE_API_URL || "https://mmiwp8rgrf.execute-api.us-east-1.amazonaws.com";
        
        try {
            const response = await fetch(`${API_URL}/match/${matchId}/email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emailTo: silent ? 'venky.2k57@gmail.com' : emailTo,
                    origin: window.location.origin
                })
            });

            if (!response.ok) throw new Error();
            if (!silent) alert("✨ FANCY REPORT SENT!\nCheck your inbox for the official scorecard.");
            else console.log("Automatic scorecard email sent! 🚀");
        } catch (err) {
            console.error("Email API failed:", err);
            // Fallback to mailto if API fails (e.g. SES not verified)
            if (!silent) {
                const subject = encodeURIComponent(`🏆 FINAL RESULT: ${previousInnings.battingTeamName} vs ${currentInnings.battingTeamName}`);
                const body = encodeURIComponent(`🏆 VIEW FANCY SCORECARD:\n${window.location.origin}?matchId=${matchId}\n\n(Cloud email service requires manual verification. Please forward this link!)`);
                window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
            }
        } finally {
            setSendingEmail(false);
        }
    };

    // Auto-trigger email on match completion
    useEffect(() => {
        if (matchStatus === MatchStatus.COMPLETED && !hasSentAutoEmail) {
            setHasSentAutoEmail(true);
            handleSendEmail(true); // Silent send
        }
        if (matchStatus === MatchStatus.SETUP) {
            setHasSentAutoEmail(false); // Reset for next match
        }
    }, [matchStatus, matchId, hasSentAutoEmail]);

    return (
        <div className="h-[100dvh] bg-slate-50 font-sans text-slate-900 flex flex-col overflow-hidden relative">
            {/* Global Header Switcher */}
            <div className="bg-slate-950 px-3 py-2 flex justify-between items-center shrink-0 border-b border-white/10 z-50 shadow-md">
                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-900 p-1 rounded-xl border border-white/5">
                        <button 
                            onClick={() => { setView('VIEWER'); setHubKey(k => k + 1); }}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${view === 'VIEWER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Viewer 🌍
                        </button>
                        <button 
                            onClick={() => setView('SCORER')}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${view === 'SCORER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Scorer 🎮
                        </button>
                        <button 
                            onClick={() => { setView('ADMIN'); setHubKey(k => k + 1); }}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${view === 'ADMIN' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Admin ⚡
                        </button>
                    </div>
                </div>
                
                {matchStatus !== MatchStatus.SETUP && view !== 'VIEWER' && (
                    <button
                        onClick={() => setShowResetConfirm(true)}
                        className="px-4 py-1.5 bg-red-900/30 border border-red-500/20 rounded font-black text-[10px] uppercase tracking-wider text-red-500 hover:text-white transition-all hover:bg-red-600"
                    >
                        RESET MATCH
                    </button>
                )}
            </div>

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

                {(view === 'VIEWER' || view === 'ADMIN') && (
                    <div className="h-full bg-slate-950 flex flex-col p-4 md:p-8 overflow-y-auto">
                        <div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in zoom-in-95 duration-500">
                             <div className="text-center space-y-2">
                                <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">
                                    Match <span className={view === 'ADMIN' ? 'text-rose-500' : 'text-indigo-500'}>
                                        {view === 'ADMIN' ? 'Control Center' : 'Hub Center'}
                                    </span>
                                </h1>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">
                                    {view === 'ADMIN' ? 'Cloud Management & Database Pruning' : 'Live Feeds & Historical Records'}
                                </p>
                             </div>
                             <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[2rem] backdrop-blur-3xl shadow-2xl">
                                <LiveScoreboard 
                                    key={`hub-${hubKey}`} 
                                    isAdmin={view === 'ADMIN'}
                                    onResumeMatch={view !== 'VIEWER' ? (id) => {
                                        resumeMatch(id);
                                        setView('SCORER');
                                    } : undefined}
                                />
                             </div>
                        </div>
                    </div>
                )}

                {matchStatus === MatchStatus.SETUP && view === 'SCORER' && (
                    <MatchSetup 
                        onStartMatch={startMatch} 
                        onResumeMatch={resumeMatch} 
                        hideResume={true}
                        canDelete={false}
                    />
                )}

                {matchStatus === MatchStatus.LIVE && currentInnings && view === 'SCORER' && (
                    <MatchView
                        initialState={currentInnings}
                        previousInnings={previousInnings}
                        totalOvers={totalOvers}
                        matchId={matchId!}
                        onInningsEnd={handleInningsEnd}
                        onResetMatch={() => setShowResetConfirm(true)}
                        onUpdateOvers={updateMatchOvers}
                        onStateChange={(state) => setCurrentInnings(state)} // Sync ball-by-ball
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
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-4">Target Email for Result</label>
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
                                                disabled={sendingEmail}
                                                className="flex-1 h-20 bg-blue-600 text-white rounded-[1.5rem] font-black text-xl uppercase tracking-widest italic hover:bg-blue-500 active:scale-[0.98] transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 disabled:opacity-50"
                                            >
                                                {sendingEmail ? '🚀 SENDING...' : 'EMAIL RESULT 📨'}
                                            </button>
                                            <button
                                                onClick={() => setShowResetConfirm(true)}
                                                className="flex-1 h-20 bg-white text-slate-900 rounded-[1.5rem] font-black text-xl uppercase tracking-widest italic hover:bg-slate-100 active:scale-[0.98] transition-all shadow-2xl flex items-center justify-center gap-3"
                                            >
                                                {view === 'SCORER' ? 'START FRESH MATCH 🏏' : 'RESET HUB 🔄'}
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