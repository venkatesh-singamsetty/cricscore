import React, { useState, useEffect, useRef } from 'react';
import { InningsState, BallEvent, ExtraType, WicketType, Bowler } from '../types';
import Scoreboard from './Scoreboard';

interface MatchViewProps {
    initialState: InningsState;
    previousInnings?: InningsState;
    totalOvers: number;
    matchId: string; // Dynamic ID
    onInningsEnd: (innings: InningsState) => void;
    onResetMatch: () => void;
    onForceReset?: () => void;
    onUpdateOvers?: (overs: number) => void;
    onStateChange?: (state: InningsState) => void;
}

type ModalType = 'NONE' | 'WICKET_TYPE' | 'BATTER_SELECT' | 'BOWLER_SELECT' | 'FIELDER_SELECT' | 'EXTRA_RUNS' | 'RUN_OUT_MODAL';

const MatchView: React.FC<MatchViewProps> = ({
    initialState,
    previousInnings,
    totalOvers,
    matchId,
    onInningsEnd,
    onResetMatch,
    onForceReset,
    onUpdateOvers,
    onStateChange
}) => {
    const [isEditingOvers, setIsEditingOvers] = useState(false);
    // --- Live Persistence (Synchronous Hydration - Match Specific) ---
    const getLiveKey = () => `cric-live-match-${matchId}`;

    const loadSavedLiveState = () => {
        const savedLive = localStorage.getItem(getLiveKey());
        if (savedLive) {
            try {
                const data = JSON.parse(savedLive);
                // 🛑 STRICT CHECK: Only restore if match ID stays the same
                if (data.matchId === matchId && 
                    data.innings.inningNumber === initialState.inningNumber) {
                    return data;
                }
            } catch (e) {
                console.error("Failed to restore live innings", e);
            }
        }
        return null;
    };
    const savedState = loadSavedLiveState();

    const [innings, setInnings] = useState<InningsState>(savedState ? savedState.innings : initialState);
    const [history, setHistory] = useState<InningsState[]>(savedState ? savedState.history || [] : []);
    const [lastCommentary, setLastCommentary] = useState<string>(savedState ? savedState.lastCommentary || "" : (initialState.inningNumber === 2 ? "Second innings started!" : "Match started."));
    const [isProcessing, setIsProcessing] = useState(false);
    const isProcessingRef = useRef(false);
    const [showScoreboard, setShowScoreboard] = useState(false);

    // Scoring State UI controls
    const [pendingExtra, setPendingExtra] = useState<ExtraType>(ExtraType.NONE);
    const [modalView, setModalView] = useState<ModalType>('NONE');
    const [pendingWicketInfo, setPendingWicketInfo] = useState<{ runs: number, wicketType: WicketType, outBatterId?: string } | null>(null);
    const [runOutRuns, setRunOutRuns] = useState<number | null>(null);

    const commentaryEndRef = useRef<HTMLDivElement>(null);

    // Save live match state incrementally (Unique per match)
    useEffect(() => {
        const liveState = {
            matchId,
            innings,
            history,
            lastCommentary
        };
        localStorage.setItem(getLiveKey(), JSON.stringify(liveState));
        if (onStateChange) onStateChange(innings);
    }, [innings, history, lastCommentary, matchId]);

    useEffect(() => {
        commentaryEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [lastCommentary]);

    const getCurrentStriker = () => innings.players[innings.strikerId] || { name: 'Selecting...', runs: 0, ballsFaced: 0, fours: 0, sixes: 0, id: '' };
    const getCurrentNonStriker = () => innings.players[innings.nonStrikerId] || { name: 'Selecting...', runs: 0, ballsFaced: 0, fours: 0, sixes: 0, id: '' };
    const getCurrentBowler = () => innings.bowlers[innings.currentBowlerId] || { name: 'Selecting...', overs: 0, balls: 0, maidens: 0, runsConceded: 0, wickets: 0, id: '' };
    const getPreviousBowler = () => {
        if (innings.allBalls.length === 0) return null;
        const currentBowlerName = getCurrentBowler().name;
        const lastDifferentBall = [...innings.allBalls].reverse().find(b => b.bowlerName !== currentBowlerName);
        if (!lastDifferentBall) return null;
        return (Object.values(innings.bowlers) as Bowler[]).find(b => b.name === lastDifferentBall.bowlerName) || null;
    };

    const striker = getCurrentStriker();
    const nonStriker = getCurrentNonStriker();
    const bowler = getCurrentBowler();
    const prevBowler = getPreviousBowler();

    // Calculate equation for 2nd innings
    const getEquation = () => {
        if (innings.inningNumber !== 2 || !innings.target) return null;
        const runsNeeded = innings.target - innings.totalRuns;
        const ballsRemaining = (totalOvers * 6) - (innings.overs * 6 + innings.balls);
        if (runsNeeded <= 0) return "Target Reached!";
        return `Need ${runsNeeded} runs in ${ballsRemaining} balls`;
    };

    const saveToHistory = () => {
        setHistory(prev => [...prev, JSON.parse(JSON.stringify(innings))]);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previousState = history[history.length - 1];
        setHistory(prev => prev.slice(0, -1));
        setIsProcessing(false);
        setInnings(previousState);
        setModalView('NONE');
        setPendingExtra(ExtraType.NONE);
        setLastCommentary("Last action undone.");
        
        // Immediate sync after undo to revert spectator scores & delete last ball in DB
        const s = previousState.players[previousState.strikerId]?.name || '';
        const ns = previousState.players[previousState.nonStrikerId]?.name || '';
        const b = previousState.bowlers[previousState.currentBowlerId]?.name || '';
        const bOvers = previousState.bowlers[previousState.currentBowlerId]?.overs || 0;
        const bBalls = previousState.bowlers[previousState.currentBowlerId]?.balls || 0;

        fetch(`${API_URL}/update-score`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                matchId,
                inningId: previousState.id,
                strikerName: s,
                nonStrikerName: ns,
                bowlerName: b,
                totalOvers: previousState.overs,
                totalBalls: previousState.balls,
                totalRuns: previousState.totalRuns,
                totalWickets: previousState.totalWickets,
                bowlerOvers: bOvers,
                bowlerBalls: bBalls,
                syncOnly: true,
                undo: true // Tell backend to delete the most recent ball row
            })
        }).catch(err => console.error("Undo Sync Failed:", err));
    };

    const generateSimpleCommentary = (ball: BallEvent): string => {
        let msg = `${ball.bowlerName} to ${ball.batterName}, `;
        if (ball.isWicket) {
            msg += `OUT! ${ball.wicketType}.`;
        } else if (ball.extraType !== ExtraType.NONE) {
            msg += `${ball.extraType}! ${ball.runs > 0 ? ball.runs + ' runs.' : ''}`;
        } else if (ball.runs === 0) {
            msg += "no run.";
        } else if (ball.runs === 4) {
            msg += "FOUR! Beautifully played.";
        } else if (ball.runs === 6) {
            msg += "SIX! That's a massive hit.";
        } else {
            msg += `${ball.runs} run${ball.runs > 1 ? 's' : ''}.`;
        }
        return msg;
    };

    const handleSwapEnds = () => {
        saveToHistory();
        setInnings(prev => ({
            ...prev,
            strikerId: prev.nonStrikerId,
            nonStrikerId: prev.strikerId
        }));
    };

    const handleRenamePlayer = (playerId: string) => {
        const player = innings.players[playerId];
        const newName = prompt(`Rename ${player.name} to:`, player.name);
        if (newName && newName.trim()) {
            setInnings(prev => {
                const next = { ...prev };
                next.players[playerId] = { ...player, name: newName.trim().toUpperCase() };
                return next;
            });
            setLastCommentary(`Renamed player to ${newName.trim().toUpperCase()}`);
        }
    };

    const handleRenameBowler = (bowlerId: string) => {
        const b = innings.bowlers[bowlerId];
        const newName = prompt(`Rename ${b.name} to:`, b.name);
        if (newName && newName.trim()) {
            setInnings(prev => {
                const next = { ...prev };
                next.bowlers[bowlerId] = { ...b, name: newName.trim().toUpperCase() };
                return next;
            });
            setLastCommentary(`Renamed bowler to ${newName.trim().toUpperCase()}`);
        }
    };

    const handleRenameTeam = (isBattingTeam: boolean) => {
        const curName = isBattingTeam ? innings.battingTeamName : innings.bowlingTeamName;
        const newName = prompt(`Rename ${curName} to:`, curName);
        if (newName && newName.trim()) {
            setInnings(prev => {
                const next = { ...prev };
                if (isBattingTeam) next.battingTeamName = newName.trim().toUpperCase();
                else next.bowlingTeamName = newName.trim().toUpperCase();
                return next;
            });
        }
    };

    const handleQuickAddPlayer = (isBatter: boolean) => {
        const name = prompt(`Enter new ${isBatter ? 'Batter' : 'Bowler'} name:`);
        if (name && name.trim()) {
            const upName = name.trim().toUpperCase();
            const id = `${isBatter ? 'bat' : 'bowl'}_${Date.now()}`;
            setInnings(prev => {
                const next = { ...prev };
                if (isBatter) {
                    next.players[id] = { id, name: upName, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false };
                    next.battingOrder = [...next.battingOrder, id];
                } else {
                    next.bowlers[id] = { id, name: upName, overs: 0, balls: 0, maidens: 0, runsConceded: 0, wickets: 0 };
                    next.bowlingOrder = [...next.bowlingOrder, id];
                }
                return next;
            });
        }
    };

    const API_URL = import.meta.env.VITE_API_URL || "https://mmiwp8rgrf.execute-api.us-east-1.amazonaws.com";
    
    const syncMatchState = async () => {
        if (!innings.strikerId || !innings.nonStrikerId || !innings.currentBowlerId) return;
        
        try {
            const bOvers = innings.bowlers[innings.currentBowlerId]?.overs || 0;
            const bBalls = innings.bowlers[innings.currentBowlerId]?.balls || 0;

            const response = await fetch(`${API_URL}/update-score`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    matchId,
                    inningId: innings.id,
                    strikerName: striker.name,
                    nonStrikerName: nonStriker.name,
                    bowlerName: bowler.name,
                    currentOvers: innings.overs,
                    currentBalls: innings.balls,
                    matchTotalOvers: totalOvers,
                    totalRuns: innings.totalRuns,
                    totalWickets: innings.totalWickets,
                    bowlerOvers: bOvers,
                    bowlerBalls: bBalls,
                    syncOnly: true
                })
            });

            if (response.status === 404) {
                alert("🚨 MATCH NOT FOUND!\nIt may have been deleted by an Administrator. Scoreboard will be reset.");
                if (onForceReset) onForceReset();
                else onResetMatch();
                return;
            }

            console.log("Crease State Synced 📡");
        } catch (err) {
            console.error("Crease Sync Failed:", err);
        }
    };

    // Auto-sync crease when players or match duration change
    useEffect(() => {
        if (innings.strikerId && innings.nonStrikerId && innings.currentBowlerId) {
            syncMatchState();
        }
    }, [innings.strikerId, innings.nonStrikerId, innings.currentBowlerId, totalOvers]);

    const postScoreUpdate = async (ball: BallEvent, finalInnings: InningsState) => {
        try {
            const b = finalInnings.bowlers[finalInnings.currentBowlerId];
            const response = await fetch(`${API_URL}/update-score`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    matchId,
                    inningId: finalInnings.id,
                    ballData: ball,
                    strikerName: finalInnings.players[finalInnings.strikerId]?.name || '',
                    nonStrikerName: finalInnings.players[finalInnings.nonStrikerId]?.name || '',
                    bowlerName: b?.name || '',
                    currentOvers: finalInnings.overs,
                    currentBalls: finalInnings.balls,
                    matchTotalOvers: totalOvers,
                    totalRuns: finalInnings.totalRuns,
                    totalWickets: finalInnings.totalWickets,
                    bowlerOvers: b?.overs || 0,
                    bowlerBalls: b?.balls || 0,
                    // Absolute stats snapshots to correct any database drift
                    runs: finalInnings.players[ball.batterName] ? finalInnings.players[ball.batterName].runs : (Object.values(finalInnings.players).find(p => p.name === ball.batterName)?.runs || 0),
                    ballsFaced: finalInnings.players[ball.batterName] ? finalInnings.players[ball.batterName].ballsFaced : (Object.values(finalInnings.players).find(p => p.name === ball.batterName)?.ballsFaced || 0),
                    fours: finalInnings.players[ball.batterName] ? finalInnings.players[ball.batterName].fours : (Object.values(finalInnings.players).find(p => p.name === ball.batterName)?.fours || 0),
                    sixes: finalInnings.players[ball.batterName] ? finalInnings.players[ball.batterName].sixes : (Object.values(finalInnings.players).find(p => p.name === ball.batterName)?.sixes || 0),
                    bowlerRuns: b?.runsConceded || 0,
                    bowlerWickets: b?.wickets || 0
                })
            });

            if (response.status === 404) {
                alert("🚨 ACTION FAILED: MATCH DELETED!\nThis match is no longer in the system.");
                if (onForceReset) onForceReset();
                else onResetMatch();
                return;
            }

            console.log("Live Sync: Ball sent to Aiven Kafka 🏏📡");
        } catch (err) {
            console.error("Live Sync Failed:", err);
        }
    };

    const handleScore = async (runs: number, isWicket = false, wicketType = WicketType.NONE, fielderName?: string, outBatterId?: string) => {
        if ((isProcessing || isProcessingRef.current) && !fielderName) return; 

        // Check if we need a fielder first
        if (isWicket && (wicketType === WicketType.CAUGHT || wicketType === WicketType.STUMPED || wicketType === WicketType.RUN_OUT) && !fielderName) {
            setPendingWicketInfo({ runs, wicketType, outBatterId });
            setModalView('FIELDER_SELECT');
            return;
        }

        isProcessingRef.current = true;
        setIsProcessing(true);
        saveToHistory();

        const isWide = pendingExtra === ExtraType.WIDE;
        const isNoBall = pendingExtra === ExtraType.NO_BALL;
        const isBye = pendingExtra === ExtraType.BYE;
        const isLegBye = pendingExtra === ExtraType.LEG_BYE;

        // Calculate runs added to total score
        let totalRunsToAdd = runs;
        if (isWide || isNoBall) totalRunsToAdd += 1;

        // Calculate runs accredited to batter
        let batterRuns = 0;
        if (!isWide && !isBye && !isLegBye) {
            batterRuns = runs;
        }

        const striker = getCurrentStriker();
        const bowler = getCurrentBowler();

        const newBallEvent: BallEvent = {
            id: Date.now().toString(),
            bowlerName: bowler.name,
            batterName: striker.name,
            runs: runs,
            isExtra: pendingExtra !== ExtraType.NONE,
            extraType: pendingExtra,
            extraRuns: (isWide || isNoBall) ? 1 : 0,
            isWicket,
            wicketType,
            fielderName,
            overNumber: innings.overs,
            ballNumber: innings.balls + 1,
        };

        // --- State Update Logic ---
        const nextInnings = { ...innings };
        const nextStriker = { ...nextInnings.players[nextInnings.strikerId] };
        const nextBowler = { ...nextInnings.bowlers[nextInnings.currentBowlerId] };

        // Update Runs
        nextInnings.totalRuns += totalRunsToAdd;
        nextStriker.runs += batterRuns;
        if (!isWide) {
            nextStriker.ballsFaced += 1;
        }

        if (batterRuns === 4) nextStriker.fours += 1;
        if (batterRuns === 6) nextStriker.sixes += 1;

        // Update Bowler
        if (!isBye && !isLegBye) {
            nextBowler.runsConceded += totalRunsToAdd;
        }

        // Valid Ball Calculation
        const isValidBall = !isWide && !isNoBall;
        let overCompleted = false;

        if (isValidBall) {
            nextInnings.balls += 1;
            nextBowler.balls += 1; // Track ball for bowler

            if (nextBowler.balls === 6) {
                nextBowler.balls = 0;
                nextBowler.overs += 1;
            }

            if (nextInnings.balls === 6) {
                nextInnings.balls = 0;
                nextInnings.overs += 1;
                overCompleted = true;
            }
        }

        // Wicket Logic
        if (isWicket) {
            nextInnings.totalWickets += 1;
            if (!isWide && !isNoBall && wicketType !== WicketType.RUN_OUT && wicketType !== WicketType.RETIRED_HURT && wicketType !== WicketType.RETIRED_OUT) {
                nextBowler.wickets += 1;
            }
            if (wicketType === WicketType.RUN_OUT && outBatterId === nextInnings.nonStrikerId) {
                const nextNonStriker = { ...nextInnings.players[nextInnings.nonStrikerId] };
                nextNonStriker.isOut = true;
                nextNonStriker.wicketType = wicketType;
                nextNonStriker.wicketBy = bowler.name;
                nextNonStriker.fielderName = fielderName;
                nextInnings.players[nextInnings.nonStrikerId] = nextNonStriker;
            } else {
                nextStriker.isOut = true;
                nextStriker.wicketType = wicketType;
                nextStriker.wicketBy = bowler.name;
                nextStriker.fielderName = fielderName;
            }
        }

        // Strike Rotation
        if (runs % 2 !== 0) {
            [nextInnings.strikerId, nextInnings.nonStrikerId] = [nextInnings.nonStrikerId, nextInnings.strikerId];
        }

        // End of over strike rotation
        if (overCompleted) {
            [nextInnings.strikerId, nextInnings.nonStrikerId] = [nextInnings.nonStrikerId, nextInnings.strikerId];
        }

        // Commit State Updates - Deep Copy to avoid mutation leaks
        const finalInnings: InningsState = {
            ...nextInnings,
            players: { ...nextInnings.players, [striker.id]: nextStriker },
            bowlers: { ...nextInnings.bowlers, [bowler.id]: nextBowler },
            allBalls: [...nextInnings.allBalls, newBallEvent],
            currentOver: [...nextInnings.currentOver, newBallEvent]
        };

        if (finalInnings.currentOver.length > 6) {
            finalInnings.currentOver = finalInnings.currentOver.slice(1);
        }

        // Maiden Over check
        if (overCompleted) {
            const currentOverNumber = newBallEvent.overNumber;
            const overBalls = finalInnings.allBalls.filter(b => b.overNumber === currentOverNumber);

            const runsOffBatInOver = overBalls.reduce((sum, b) => {
                if (b.extraType !== ExtraType.NONE) return sum;
                return sum + b.runs;
            }, 0);

            if (runsOffBatInOver === 0) {
                const updatedBowler = { ...finalInnings.bowlers[bowler.id], maidens: (finalInnings.bowlers[bowler.id].maidens || 0) + 1 };
                finalInnings.bowlers[bowler.id] = updatedBowler;
            }
        }
    
        setInnings(finalInnings);
        await postScoreUpdate(newBallEvent, finalInnings);
        setPendingExtra(ExtraType.NONE);
        setPendingWicketInfo(null);

        // Check Match/Innings End Conditions
        const isAllOut = finalInnings.totalWickets >= 10;
        const isOversDone = finalInnings.overs >= totalOvers;
        const isTargetChased = finalInnings.target && finalInnings.totalRuns >= finalInnings.target;
        const isMatchEnding = isAllOut || isOversDone || isTargetChased;

        // Logic for next actions (Modals)
        setModalView('NONE'); // Close wicket type modal if open

        if (!isMatchEnding) {
            if (isWicket) {
                setModalView('BATTER_SELECT');
            } else if (overCompleted) {
                setModalView('BOWLER_SELECT');
            }
        }

        // Commentary
        let commentary = generateSimpleCommentary(newBallEvent);
        if (overCompleted && !isTargetChased && !isAllOut) {
            commentary += " End of over.";
        }
        setLastCommentary(commentary);

        if (isMatchEnding) {
            // Delay slightly so users see the wicket/run
            setTimeout(() => onInningsEnd(finalInnings), 500);
            return; // Lock the UI permanently until the parent unmounts this view
        }

        isProcessingRef.current = false;
        setIsProcessing(false);
    };

    const handleBatterSelected = (newBatterId: string) => {
        setInnings(prev => {
            const updated = { ...prev };

            if (updated.strikerId === "" || updated.players[updated.strikerId]?.isOut) {
                updated.strikerId = newBatterId;
            } else if (updated.nonStrikerId === "" || updated.players[updated.nonStrikerId]?.isOut) {
                updated.nonStrikerId = newBatterId;
            } else {
                updated.strikerId = newBatterId;
            }

            // Decide what modal to show next
            if (updated.nonStrikerId === "") {
                // Keep BATTER_SELECT open to choose the second opener
            } else if (updated.currentBowlerId === "") {
                setModalView('BOWLER_SELECT');
            } else if (updated.balls === 0 && updated.overs > 0 && updated.overs < totalOvers) {
                setModalView('BOWLER_SELECT');
            } else {
                setModalView('NONE');
            }

            return updated;
        });
    };

    const handleBowlerSelected = (newBowlerId: string) => {
        setInnings(prev => ({
            ...prev,
            currentBowlerId: newBowlerId,
            currentOver: []
        }));
        setModalView('NONE');
    };

    const handleRetire = (type: WicketType) => {
        handleScore(0, true, type);
    };

    const handleFielderSelected = (fielderName: string) => {
        if (pendingWicketInfo) {
            handleScore(pendingWicketInfo.runs, true, pendingWicketInfo.wicketType, fielderName, pendingWicketInfo.outBatterId);
        }
    };

    // --- SUB COMPONENTS ---

    const FielderSelectModal = () => {
        let title = "Who took the fielder action?";
        if (pendingWicketInfo?.wicketType === WicketType.CAUGHT) title = "Who took the catch?";
        else if (pendingWicketInfo?.wicketType === WicketType.STUMPED) title = "Who performed the stumping?";
        else if (pendingWicketInfo?.wicketType === WicketType.RUN_OUT) title = "Who performed the run out?";

        return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-slate-900">
                    <div className="p-4 bg-slate-50 border-b border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                    </div>
                    <div className="overflow-y-auto p-2 pb-10">
                        {innings.bowlingOrder.map(id => {
                            const fielder = innings.bowlers[id];
                            return (
                                <button
                                    key={id}
                                    onClick={() => handleFielderSelected(fielder.name)}
                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 rounded-lg flex justify-between items-center group transition-colors border-b border-slate-50 last:border-0"
                                >
                                    <span className="font-medium text-slate-700 group-hover:text-blue-700">{fielder.name}</span>
                                    <span className="text-blue-500 opacity-0 group-hover:opacity-100">Select →</span>
                                </button>
                            );
                        })}
                    </div>
                    <button onClick={() => {
                        setModalView('NONE');
                        setPendingWicketInfo(null);
                        setIsProcessing(false);
                    }} className="p-4 text-sm text-slate-400 hover:text-slate-600 border-t">Cancel</button>
                </div>
            </div>
        );
    };

    const WicketTypeModal = () => (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[200] p-4 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
                <div className="p-6 bg-slate-950 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
                        <h3 className="text-lg font-black uppercase tracking-tighter italic text-white">Dismissal Type</h3>
                    </div>
                </div>
                <div className="p-6 grid grid-cols-2 gap-3">
                    {[WicketType.BOWLED, WicketType.CAUGHT, WicketType.LBW, WicketType.RUN_OUT, WicketType.STUMPED].map((type) => (
                        <button
                            key={type}
                            onClick={() => {
                                if (type === WicketType.RUN_OUT) {
                                    setModalView('RUN_OUT_MODAL');
                                } else {
                                    handleScore(0, true, type);
                                }
                            }}
                            className="py-5 px-4 bg-white/5 text-slate-200 border border-white/5 rounded-2xl font-black hover:bg-red-600 hover:text-white hover:border-red-400 transition-all active:scale-95 uppercase text-xs italic"
                        >
                            {type.replace('_', ' ')}
                        </button>
                    ))}
                    <button
                        onClick={() => setModalView('NONE')}
                        className="col-span-2 mt-4 py-4 px-4 bg-slate-800 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all"
                    >
                        Abort
                    </button>
                </div>
            </div>
        </div>
    );

    const RunOutModal = () => {
        return (
            <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[200] p-4 backdrop-blur-md animate-in fade-in duration-300">
                <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-500 flex flex-col gap-4">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                        <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
                        <h3 className="text-lg font-black uppercase tracking-tighter italic text-white flex-1">Run Out Details</h3>
                    </div>

                    {runOutRuns === null ? (
                        <div className="flex flex-col gap-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Runs Completed Before Run Out?</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[0, 1, 2, 3, 4, 5].map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setRunOutRuns(r)}
                                        className="py-4 rounded-xl font-black text-xl transition-all active:scale-95 shadow-lg border border-white/5 bg-slate-800 text-white hover:bg-slate-700 hover:border-white/20"
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Who was Run Out?</label>
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => {
                                        setRunOutRuns(null);
                                        handleScore(runOutRuns, true, WicketType.RUN_OUT, undefined, innings.strikerId);
                                    }}
                                    className="py-4 px-4 bg-slate-800 text-slate-200 border border-white/5 rounded-2xl font-black hover:bg-red-600 hover:text-white transition-all active:scale-95 text-sm uppercase italic flex justify-between items-center"
                                >
                                    <span>{innings.players[innings.strikerId]?.name || 'Striker'}</span>
                                    <span className="text-[9px] opacity-50 tracking-widest">STRIKER</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setRunOutRuns(null);
                                        handleScore(runOutRuns, true, WicketType.RUN_OUT, undefined, innings.nonStrikerId);
                                    }}
                                    className="py-4 px-4 bg-slate-800 text-slate-200 border border-white/5 rounded-2xl font-black hover:bg-red-600 hover:text-white transition-all active:scale-95 text-sm uppercase italic flex justify-between items-center"
                                >
                                    <span>{innings.players[innings.nonStrikerId]?.name || 'Non-Striker'}</span>
                                    <span className="text-[9px] opacity-50 tracking-widest">NON-STRIKER</span>
                                </button>
                            </div>
                            <button
                                onClick={() => setRunOutRuns(null)}
                                className="mt-2 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors text-center"
                            >
                                ← Back
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => {
                            setModalView('NONE');
                            setRunOutRuns(null);
                        }}
                        className="mt-2 py-3 px-4 bg-transparent text-slate-500 rounded-full font-black uppercase tracking-widest text-[9px] hover:bg-white/5 hover:text-white transition-all border border-transparent hover:border-white/10"
                    >
                        Abort Wicket
                    </button>
                </div>
            </div>
        );
    };

    const BatterSelectModal = () => {
        const availableBatters = innings.battingOrder.filter(id => {
            const p = innings.players[id];
            return !p.isOut && id !== innings.strikerId && id !== innings.nonStrikerId;
        });

        const title = innings.strikerId === "" ? "Select Striker" : (innings.nonStrikerId === "" ? "Select Non-Striker" : "Select New Batter");

        return (
            <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[200] p-4 backdrop-blur-md animate-in fade-in duration-300">
                <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[70vh] animate-in zoom-in-95 duration-500">
                    <div className="p-6 bg-slate-950 border-b border-white/5 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                            <h3 className="text-lg font-black uppercase tracking-tighter italic text-white">{title}</h3>
                        </div>
                        <span className="text-2xl animate-bounce">🏏</span>
                    </div>
                    <div className="overflow-y-auto p-4 space-y-3 pb-8 scrollbar-hide flex-1">
                        {availableBatters.length === 0 ? (
                            <p className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">No batters remaining in squad.</p>
                        ) : (
                            availableBatters.map(id => (
                                <button
                                    key={id}
                                    onClick={() => handleBatterSelected(id)}
                                    className="w-full text-left px-5 py-4 bg-white/5 hover:bg-indigo-600 rounded-2xl flex justify-between items-center group transition-all active:scale-95 border border-white/5"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-lg opacity-40 group-hover:opacity-100 transition-opacity">🏏</span>
                                        <span className="font-black text-slate-200 group-hover:text-white uppercase tracking-tight text-sm italic truncate">{innings.players[id].name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs p-2 hover:bg-white/20 rounded-lg transition-colors" onClick={(e) => { e.stopPropagation(); handleRenamePlayer(id); }}>✏️</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">Select</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                    <div className="p-4 border-t border-white/10 bg-slate-950/50 flex flex-col gap-2 shrink-0">
                        <button
                            onClick={() => handleQuickAddPlayer(true)}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20"
                        >
                            + ADD NEW PLAYER TO SQUAD
                        </button>
                        {!(innings.strikerId === "" || innings.nonStrikerId === "" || innings.players[innings.strikerId]?.isOut || innings.players[innings.nonStrikerId]?.isOut) && <button onClick={() => setModalView('NONE')} className="w-full py-2 text-slate-500 text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors">Close View</button>}
                    </div>
                </div>
            </div>
        );
    };

    const BowlerSelectModal = () => (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[200] p-4 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-500">
                <div className="p-6 bg-slate-950 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-purple-500 rounded-full"></div>
                        <h3 className="text-lg font-black uppercase tracking-tighter italic text-white">
                            {innings.allBalls.length === 0 ? "Opening Bowler" : "Next Bowler"}
                        </h3>
                    </div>
                    <span className="text-2xl">🎾</span>
                </div>
                <div className="overflow-y-auto p-4 space-y-3 pb-8 scrollbar-hide flex-1">
                    {innings.allBalls.length > 0 && (
                        <>
                            <div className="px-2 mb-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Previous Bowler</span>
                                <span className="text-xs font-black text-indigo-400 uppercase italic">{getCurrentBowler()?.name || '---'}</span>
                            </div>
                            <div className="h-px bg-white/5 mx-2 my-4"></div>
                        </>
                    )}
                    {innings.bowlingOrder.map(id => {
                        const bowler = innings.bowlers[id];
                        const isCurrent = id === innings.currentBowlerId;
                        return (
                            <button
                                key={id}
                                onClick={() => handleBowlerSelected(id)}
                                disabled={isCurrent}
                                className={`w-full text-left px-5 py-4 rounded-2xl flex justify-between items-center transition-all ${isCurrent ? 'bg-slate-800/30 opacity-20 cursor-not-allowed grayscale' : 'bg-white/5 hover:bg-purple-600 group active:scale-95 border border-white/5'}`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-lg opacity-40 group-hover:opacity-100 transition-opacity">🎾</span>
                                    <div className="flex flex-col min-w-0">
                                        <span className={`font-black uppercase tracking-tight text-sm italic truncate ${isCurrent ? 'text-slate-500' : 'text-slate-200 group-hover:text-white'}`}>{bowler.name}</span>
                                        <div className="text-[10px] font-bold text-slate-500 group-hover:text-purple-200">{bowler.overs}.{bowler.balls} OVS • {bowler.wickets} WKT</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs p-2 hover:bg-white/20 rounded-lg transition-colors" onClick={(e) => { e.stopPropagation(); handleRenameBowler(id); }}>✏️</span>
                                    {!isCurrent && <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">Select</span>}
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="p-4 border-t border-white/10 bg-slate-950/50 flex flex-col gap-2 shrink-0">
                    <button
                        onClick={() => handleQuickAddPlayer(false)}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl shadow-purple-600/20"
                    >
                        + ADD NEW BOWLER TO SQUAD
                    </button>
                    {!(innings.currentBowlerId === "" || (innings.balls === 0 && innings.allBalls.length > 0)) && <button onClick={() => setModalView('NONE')} className="w-full py-2 text-slate-500 text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors">Close View</button>}
                </div>
            </div>
        </div>
    );

    const ExtraRunsModal = () => (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[200] p-4 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-500 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 italic">
                        {pendingExtra.replace('_', ' ')} Detected
                    </span>
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic mb-2">Additional Runs?</h3>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-8">Select any runs conceded from this delivery</p>
                <div className="grid grid-cols-4 gap-2 md:gap-3">
                    {[0, 1, 2, 3].map(r => (
                        <button
                            key={r}
                            onClick={() => handleScore(r)}
                            className="py-5 sm:py-6 rounded-2xl font-black text-2xl sm:text-3xl transition-all active:scale-95 shadow-xl border-t border-white/10 bg-slate-900 text-white hover:bg-slate-800"
                        >
                            {r}
                        </button>
                    ))}
                    {[4, 5, 6].map(r => (
                        <button
                            key={r}
                            onClick={() => handleScore(r)}
                            className={`py-5 sm:py-6 rounded-2xl font-black text-2xl sm:text-3xl transition-all active:scale-95 shadow-xl border-t border-white/10 ${r === 4 ? 'bg-blue-600 text-white shadow-blue-600/20' :
                                r === 5 ? 'bg-emerald-600 text-white shadow-emerald-600/20' :
                                    'bg-purple-600 text-white shadow-purple-600/20'
                                }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => {
                        setPendingExtra(ExtraType.NONE);
                        setModalView('NONE');
                    }}
                    className="mt-8 w-full py-4 text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] hover:text-white transition-colors"
                >
                    Ignore Extra
                </button>
            </div>
        </div>
    );

    const equation = getEquation();

    return (
        <div className="h-full bg-slate-900 text-slate-100 flex flex-col overflow-hidden selection:bg-indigo-500/30">
            {innings.strikerId === "" && <BatterSelectModal />}
            {/* Modal rendering remains the same... */}
            {innings.strikerId !== "" && innings.nonStrikerId === "" && <BatterSelectModal />}
            {innings.strikerId !== "" && innings.nonStrikerId !== "" && innings.currentBowlerId === "" && <BowlerSelectModal />}

            {modalView === 'WICKET_TYPE' && <WicketTypeModal />}
            {modalView === 'RUN_OUT_MODAL' && <RunOutModal />}
            {modalView === 'BATTER_SELECT' && <BatterSelectModal />}
            {modalView === 'BOWLER_SELECT' && <BowlerSelectModal />}
            {modalView === 'FIELDER_SELECT' && <FielderSelectModal />}
            {modalView === 'EXTRA_RUNS' && <ExtraRunsModal />}

            {showScoreboard && (
                <Scoreboard
                    currentInnings={innings}
                    previousInnings={previousInnings}
                    onClose={() => setShowScoreboard(false)}
                    onResetMatch={onResetMatch}
                    totalOvers={totalOvers}
                />
            )}

            {/* Ultra-Slim Header (Fixed) */}
            <div className="bg-slate-950 text-white shadow-2xl border-b border-indigo-500/30 shrink-0">
                <div className="max-w-4xl mx-auto px-4 py-2">
                    <div className="flex justify-between items-center gap-4">
                        <div className="flex-1 overflow-hidden">
                            <div className="flex items-center gap-2 mb-0.5 overflow-hidden">
                                <span className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest flex-shrink-0">{innings.inningNumber === 1 ? '1st' : '2nd'} INN</span>
                                <div className="flex items-center gap-1.5 text-white text-[11px] font-black tracking-widest uppercase truncate">
                                    <span className="text-blue-400 cursor-pointer hover:underline" onClick={() => handleRenameTeam(true)}>{innings.battingTeamName}</span>
                                    <span className="text-slate-600 text-[8px] italic lowercase font-medium">vs</span>
                                    <span className="text-indigo-400 cursor-pointer hover:underline" onClick={() => handleRenameTeam(false)}>{innings.bowlingTeamName}</span>
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black tracking-tighter text-white tabular-nums">
                                    {innings.totalRuns}<span className="text-slate-500 mx-0.5 text-xl">/</span>{innings.totalWickets}
                                </span>
                                <div className="flex items-center gap-1 text-indigo-400 font-black text-sm leading-none tabular-nums group/overs">
                                    <span>{innings.overs}.{innings.balls}</span>
                                    <span className="text-slate-600 text-[10px] mx-0.5">/</span>
                                    {isEditingOvers ? (
                                        <div className="flex items-center gap-1 animate-in zoom-in-75 duration-200">
                                            <input
                                                type="number"
                                                autoFocus
                                                defaultValue={totalOvers}
                                                className="w-10 bg-indigo-600/30 border border-indigo-400/50 rounded text-center outline-none text-white text-xs py-0.5 font-black"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = parseInt((e.target as HTMLInputElement).value);
                                                        if (!isNaN(val)) onUpdateOvers?.(val);
                                                        setIsEditingOvers(false);
                                                    }
                                                    if (e.key === 'Escape') setIsEditingOvers(false);
                                                }}
                                                onBlur={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    if (!isNaN(val)) onUpdateOvers?.(val);
                                                    setIsEditingOvers(false);
                                                }}
                                            />
                                            <span className="text-[10px] text-emerald-400" onClick={() => setIsEditingOvers(false)}>✅</span>
                                        </div>
                                    ) : (
                                        <span 
                                            className="cursor-pointer hover:text-indigo-300 transition-colors flex items-center gap-1"
                                            onClick={() => setIsEditingOvers(true)}
                                        >
                                            <span>{totalOvers}</span>
                                            <span className="text-[10px] opacity-0 group-hover/overs:opacity-100 ml-0.5">✏️</span>
                                        </span>
                                    )}
                                    <span className="text-slate-600 text-[9px] tracking-tight ml-0.5">OVS</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end">
                            <button
                                onClick={() => setShowScoreboard(true)}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                            >
                                Scorecard 📋
                            </button>
                            {innings.target && (
                                <span className="text-[10px] font-black text-yellow-500 uppercase tracking-tighter mt-1">TGT: {innings.target}</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Live Dashboard Area (Centered and Tight) */}
            <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col py-1">
                <div className="max-w-4xl mx-auto w-full px-4 space-y-2 pb-2 my-auto">
                    {/* Active Player Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Batters */}
                        <div className="space-y-1 relative">
                            {[striker, nonStriker].map((b, idx) => (
                                <div key={b.id || idx} className={`flex justify-between items-center p-2.5 md:p-3 rounded-xl border transition-all ${idx === 0 ? 'bg-indigo-600 border-indigo-300 shadow-xl scale-105 z-10' : 'bg-slate-800 border-white/5 opacity-80'}`}>
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <span className={`text-[11px] md:text-xs font-black truncate uppercase tracking-widest cursor-pointer hover:opacity-80 transition-opacity ${idx === 0 ? 'text-white' : 'text-slate-200'}`} onClick={() => handleRenamePlayer(b.id)}>
                                            {b.name || '---'} {idx === 0 && '🏏'}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-lg md:text-xl font-black ${idx === 0 ? 'text-white' : 'text-slate-200'}`}>{b.runs}</span>
                                        <span className={`text-[10px] md:text-[11px] font-black ${idx === 0 ? 'text-indigo-100' : 'text-slate-500'}`}>({b.ballsFaced})</span>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={handleSwapEnds}
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white text-indigo-950 rounded-full text-xs border-2 border-slate-900 active:scale-90 transition-all shadow-xl z-20"
                            >
                                🔄
                            </button>
                        </div>

                        {/* Bowlers */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center p-2.5 md:p-3 rounded-xl bg-slate-800 border border-white/10 shadow-inner h-full">
                                <div className="flex flex-col min-w-0">
                                    <div className="flex flex-col mb-1.5">
                                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1 italic">{innings.bowlingTeamName}</span>
                                        <div className="flex items-center gap-1">
                                            <span className="w-1 h-3 bg-indigo-500 rounded-full"></span>
                                            <span className="text-[9px] font-black text-slate-500 uppercase leading-none">Bowler</span>
                                        </div>
                                    </div>
                                    <span className="text-[11px] md:text-xs font-black text-indigo-300 uppercase truncate cursor-pointer hover:text-white transition-colors" onClick={() => handleRenameBowler(bowler.id)}>{bowler.name || '---'}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg md:text-xl font-black text-white leading-none tabular-nums">{bowler.wickets}<span className="text-indigo-500 mx-0.5">/</span>{bowler.runsConceded}</div>
                                    <div className="text-[10px] md:text-[11px] font-black text-slate-500 tabular-nums uppercase mt-0.5">({bowler.overs}.{bowler.balls})</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Over Tracking (Prominent) */}
                    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10 shadow-2xl">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Live Timeline</span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full">This Over</span>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                            {innings.currentOver.length === 0 ? (
                                <div className="flex items-center gap-2 text-slate-500">
                                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center animate-pulse">
                                        <span className="text-[10px] italic">0</span>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-tighter opacity-50 italic">Waiting...</span>
                                </div>
                            ) : (
                                innings.currentOver.map((ball, idx) => (
                                    <div key={idx} className="flex flex-col items-center gap-1.5 animate-in slide-in-from-right-4 duration-300">
                                        <div className={`flex-shrink-0 w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center text-[13px] md:text-[15px] font-black border-2 transition-all shadow-xl ${ball.isWicket ? 'bg-red-500 text-white border-red-300 shadow-red-500/40' :
                                            ball.runs === 4 ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/40' :
                                                ball.runs === 6 ? 'bg-purple-600 text-white border-purple-400 shadow-purple-500/40' :
                                                    ball.isExtra ? 'bg-amber-500 text-amber-950 border-amber-300 shadow-amber-500/40' :
                                                        'bg-white text-slate-900 border-white shadow-white/10'
                                            }`}>
                                            {ball.isWicket ? (ball.runs > 0 ? `W+${ball.runs}` : 'W') : (ball.isExtra ? (ball.runs > 0 ? `${ball.runs}${ball.extraType[0]}` : ball.extraType[0]) : ball.runs)}
                                        </div>
                                        <span className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase">{ball.isExtra ? ball.extraType.split('_')[0] : 'RUN'}</span>
                                    </div>
                                ))
                            )}
                            {innings.currentOver.length > 0 && innings.currentOver.length < 6 && [...Array(6 - innings.currentOver.length)].map((_, i) => (
                                <div key={`empty-${i}`} className="w-9 h-9 md:w-11 md:h-11 rounded-full border-2 border-dashed border-slate-700/50 flex items-center justify-center opacity-30">
                                    <span className="text-[10px] text-slate-600 font-bold">•</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Live Commentary & Equation */}
                    <div className="space-y-2">
                        <div className="bg-indigo-600/5 rounded-xl p-2.5 border border-indigo-500/10 shadow-inner">
                            <div className="flex items-center gap-3">
                                <span className="flex-shrink-0 text-[10px] font-black text-indigo-400 uppercase italic">LIVE</span>
                                <p className="text-xs md:text-sm text-slate-200 font-bold tracking-wide italic uppercase leading-none truncate">{lastCommentary}</p>
                            </div>
                        </div>
                        {equation && (
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 text-center">
                                <span className="text-[10px] md:text-sm font-black text-yellow-500 uppercase tracking-[0.2em]">{equation}</span>
                            </div>
                        )}
                    </div>
                    <div ref={commentaryEndRef} className="h-0" />
                </div>
            </div>

            {/* Operations Cockpit (Fixed Bottom) */}
            <div className="shrink-0 bg-slate-950 border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[90]">
                <div className="max-w-4xl mx-auto">
                    {/* Action Tabs */}
                    <div className="grid grid-cols-4 border-b border-white/5">
                        <button onClick={handleUndo} disabled={history.length === 0} className="py-2 flex flex-col items-center justify-center gap-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all border-r border-white/5 disabled:opacity-10">
                            <span className="text-base text-indigo-400">↺</span>
                            Undo
                        </button>
                        <button onClick={() => setModalView('BOWLER_SELECT')} className="py-2 flex flex-col items-center justify-center gap-1 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all border-r border-white/5">
                            <span className="text-base">🎾</span>
                            Change Bowler
                        </button>
                        <button onClick={() => setModalView('BATTER_SELECT')} className="py-2 flex flex-col items-center justify-center gap-1 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all border-r border-white/5">
                            <span className="text-base">🏏</span>
                            Change Batter
                        </button>
                        <button onClick={() => handleRetire(WicketType.RETIRED_HURT)} className="py-2 flex flex-col items-center justify-center gap-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all">
                            <span className="text-base">🤕</span>
                            Hurt
                        </button>
                    </div>

                    {/* Input Hub */}
                    <div className="p-2 md:p-3 space-y-2">
                        {/* Ultra-Large Extras Console */}
                        <div className="grid grid-cols-4 gap-2 md:gap-3 mb-1">
                            {['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE'].map((type) => {
                                const isActive = pendingExtra === type as ExtraType;
                                return (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            const next = isActive ? ExtraType.NONE : type as ExtraType;
                                            setPendingExtra(next);
                                            if (next !== ExtraType.NONE) {
                                                setModalView('EXTRA_RUNS');
                                            }
                                        }}
                                        className={`py-3 md:py-4 lg:py-5 rounded-2xl md:rounded-xl text-[10px] md:text-xs font-black border transition-all uppercase tracking-tighter leading-none ${isActive ? 'bg-indigo-600 text-white border-indigo-300 shadow-2xl scale-95' : 'bg-slate-900 text-slate-400 border-white/10 hover:border-white/30 hover:text-white'}`}
                                    >
                                        {type.replace('_', ' ')}
                                    </button>
                                )
                            })}
                        </div>
                        {/* Keypad */}
                        <div className="grid grid-cols-4 gap-2 md:gap-3">
                            {[0, 1, 2, 3].map(run => (
                                <button key={run} onClick={() => handleScore(run)} className="h-14 sm:h-16 lg:h-20 rounded-xl md:rounded-lg bg-slate-900 border border-white/5 hover:border-white/20 text-white font-black text-3xl md:text-4xl active:scale-95 transition-all shadow-inner">{run}</button>
                            ))}
                            <button onClick={() => handleScore(4)} className="h-14 sm:h-16 lg:h-20 rounded-xl md:rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-3xl md:text-4xl active:scale-95 transition-all shadow-xl shadow-blue-600/20 border border-blue-400/30">4</button>
                            <button onClick={() => handleScore(5)} className="h-14 sm:h-16 lg:h-20 rounded-xl md:rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-3xl md:text-4xl active:scale-95 transition-all shadow-xl shadow-emerald-600/20 border border-emerald-400/30">5</button>
                            <button onClick={() => handleScore(6)} className="h-14 sm:h-16 lg:h-20 rounded-xl md:rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-3xl md:text-4xl active:scale-95 transition-all shadow-xl shadow-purple-600/20 border border-purple-400/30">6</button>
                            <button onClick={() => setModalView('WICKET_TYPE')} className="h-14 sm:h-16 lg:h-20 rounded-xl md:rounded-lg bg-red-600 hover:bg-red-500 text-white font-black text-3xl md:text-4xl active:scale-95 transition-all shadow-xl shadow-red-600/20 border border-red-400/30">W</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MatchView;