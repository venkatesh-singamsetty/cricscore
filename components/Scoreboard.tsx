import React, { useState } from 'react';
import { InningsState, Player, Bowler, ExtraType } from '../types';

interface ScoreboardProps {
  currentInnings: InningsState;
  previousInnings?: InningsState;
  onClose: () => void;
  onResetMatch?: () => void;
  isSpectator?: boolean;
  totalOvers?: number;
}

const Scoreboard: React.FC<ScoreboardProps> = ({ currentInnings, previousInnings, onClose, onResetMatch, isSpectator = false, totalOvers }) => {
  const [activeTab, setActiveTab] = useState<'current' | 'previous'>(
    'current'
  );

  const displayInnings = activeTab === 'current' ? currentInnings : previousInnings;

  if (!displayInnings && activeTab === 'previous') {
    setActiveTab('current');
  }

  const BattingTable = ({ players, order }: { players: Record<string, Player>, order: string[] }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-separate border-spacing-y-1">
        <thead>
          <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            <th className="px-4 py-2">Batter</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2 text-right">R</th>
            <th className="px-4 py-2 text-right">B</th>
            <th className="px-4 py-2 text-right">4s</th>
            <th className="px-4 py-2 text-right">6s</th>
            <th className="px-4 py-2 text-right text-indigo-400">SR</th>
          </tr>
        </thead>
        <tbody className="space-y-2">
          {(order || []).map((id) => {
            const player = players?.[id];
            if (!player) return null;
            if (player.ballsFaced === 0 && !player.isOut && id !== displayInnings?.strikerId && id !== displayInnings?.nonStrikerId) {
              return null;
            }
            const isStriker = id === displayInnings?.strikerId;
            const isNonStriker = id === displayInnings?.nonStrikerId;
            const highlight = (activeTab === 'current' && (isStriker || isNonStriker));
            const sr = player.ballsFaced > 0 ? ((player.runs / player.ballsFaced) * 100).toFixed(1) : '0.0';

            return (
              <tr key={id} className={`group transition-all duration-300 ${highlight ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-white/5 hover:bg-white/10'}`}>
                <td className={`px-4 py-3 first:rounded-l-xl font-black uppercase tracking-tight italic text-sm ${highlight ? 'text-white' : 'text-slate-200'}`}>
                  {player.name} {isStriker && <span className="text-indigo-300 animate-pulse ml-1 text-base">🏏</span>}
                </td>
                <td className={`px-4 py-3 text-[10px] font-black uppercase tracking-tight ${highlight ? 'text-indigo-100' : 'text-slate-500'}`}>
                  {player.isOut ? (
                    <span className="text-red-400 opacity-90">
                      {(() => {
                        const type = player.wicketType;
                        const bowler = player.wicketBy;
                        const fielder = player.fielderName;

                        if (type === 'CAUGHT') {
                          if (fielder === bowler) return `c & b ${bowler}`;
                          return `c ${fielder || '---'} b ${bowler}`;
                        }
                        if (type === 'STUMPED') return `st ${fielder || '---'} b ${bowler}`;
                        if (type === 'RUN_OUT') return `run out (${fielder || '---'})`;
                        if (type === 'LBW') return `lbw b ${bowler}`;
                        if (type === 'BOWLED') return `b ${bowler}`;
                        if (type === 'HIT_WICKET') return `hit wicket b ${bowler}`;
                        if (type === 'RETIRED_HURT') return 'retired hurt';
                        if (type === 'RETIRED_OUT') return 'retired out';
                        return `${type?.toLowerCase().replace(/_/g, ' ')}`;
                      })()}
                    </span>
                  ) : (
                    <span className="text-green-300 opacity-90">{highlight ? 'batting' : 'not out'}</span>
                  )}
                </td>
                <td className={`px-4 py-3 text-right font-black text-base tabular-nums ${highlight ? 'text-white' : 'text-slate-100'}`}>{player.runs}</td>
                <td className={`px-4 py-3 text-right font-black text-xs tabular-nums ${highlight ? 'text-indigo-200' : 'text-slate-400'}`}>{player.ballsFaced}</td>
                <td className={`px-4 py-3 text-right font-black text-xs tabular-nums ${highlight ? 'text-indigo-200' : 'text-slate-400'}`}>{player.fours}</td>
                <td className={`px-4 py-3 text-right font-black text-xs tabular-nums ${highlight ? 'text-indigo-200' : 'text-slate-400'}`}>{player.sixes}</td>
                <td className={`px-4 py-3 last:rounded-r-xl text-right font-black text-xs tabular-nums ${highlight ? 'text-white' : 'text-indigo-400'}`}>{sr}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const BowlingTable = ({ bowlers, order }: { bowlers: Record<string, Bowler>, order: string[] }) => (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-left border-separate border-spacing-y-1">
        <thead>
          <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            <th className="px-4 py-2">Bowler</th>
            <th className="px-4 py-2 text-right">O</th>
            <th className="px-4 py-2 text-right">M</th>
            <th className="px-4 py-2 text-right">R</th>
            <th className="px-4 py-2 text-right text-indigo-400">W</th>
            <th className="px-4 py-2 text-right">Econ</th>
          </tr>
        </thead>
        <tbody className="space-y-2">
          {(order || []).map((id) => {
            const bowler = bowlers?.[id];
            if (!bowler) return null;
            if (bowler.overs === 0 && bowler.balls === 0 && activeTab === 'previous') return null;
            if (bowler.overs === 0 && bowler.balls === 0 && id !== displayInnings?.currentBowlerId) return null;

            const totalOvers = bowler.overs + (bowler.balls / 6);
            const econ = totalOvers > 0 ? (bowler.runsConceded / totalOvers).toFixed(1) : '-';
            const isCurrent = activeTab === 'current' && id === displayInnings?.currentBowlerId;

            return (
              <tr key={id} className={`group transition-all duration-300 ${isCurrent ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-white/5 hover:bg-white/10'}`}>
                <td className={`px-4 py-3 first:rounded-l-xl font-black uppercase tracking-tight italic text-sm ${isCurrent ? 'text-white' : 'text-slate-200'}`}>{bowler.name}</td>
                <td className={`px-4 py-3 text-right font-black text-xs tabular-nums ${isCurrent ? 'text-indigo-200' : 'text-slate-400'}`}>{bowler.overs}.{bowler.balls}</td>
                <td className={`px-4 py-3 text-right font-black text-xs tabular-nums ${isCurrent ? 'text-indigo-200' : 'text-slate-400'}`}>{bowler.maidens}</td>
                <td className={`px-4 py-3 text-right font-black text-base tabular-nums ${isCurrent ? 'text-white' : 'text-slate-100'}`}>{bowler.runsConceded}</td>
                <td className={`px-4 py-3 text-right font-black text-base tabular-nums ${isCurrent ? 'text-white' : 'text-indigo-400'}`}>{bowler.wickets}</td>
                <td className={`px-4 py-3 last:rounded-r-xl text-right font-black text-xs tabular-nums opacity-60 ${isCurrent ? 'text-white' : 'text-slate-400'}`}>{econ}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-500">
        {/* Header */}
        <div className="bg-slate-950 px-8 py-6 flex justify-between items-center shrink-0 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
            <h2 className="text-2xl font-black uppercase tracking-tighter italic text-white flex items-center gap-2">
              Match <span className="text-indigo-500">Scorecard</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-all active:scale-95 text-white font-bold text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-950/50 p-2 shrink-0 border-b border-white/5">
          {previousInnings && (
            <button
              onClick={() => setActiveTab('previous')}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] italic transition-all ${activeTab === 'previous' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
            >
              {previousInnings.battingTeamName} (Inns 1)
            </button>
          )}
          <button
            onClick={() => setActiveTab('current')}
            className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] italic transition-all ${activeTab === 'current' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
          >
            {currentInnings.battingTeamName} (Inns {currentInnings.inningNumber})
          </button>
        </div>

        {/* Result Highlight */}
        {previousInnings && (() => {
          const result = (() => {
            const i1 = previousInnings;
            const i2 = currentInnings;
            if (i2.totalRuns > i1.totalRuns) {
              return { text: `${i2.battingTeamName} WON BY ${10 - i2.totalWickets} WICKETS`, team: i2.battingTeamName };
            } else if (i1.totalRuns > i2.totalRuns && (i2.overs >= (totalOvers || 0) || i2.totalWickets >= 10)) {
              return { text: `${i1.battingTeamName} WON BY ${i1.totalRuns - i2.totalRuns} RUNS`, team: i1.battingTeamName };
            } else if (i1.totalRuns === i2.totalRuns && (i2.overs >= (totalOvers || 0) || i2.totalWickets >= 10)) {
              return { text: "MATCH TIED", team: "TIED" };
            }
            return null;
          })();

          if (!result) return null;

          return (
            <div className="bg-indigo-600 py-8 text-center overflow-hidden relative shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
              <div className="relative z-10 flex flex-col items-center justify-center px-4">
                <span className="text-[10px] font-black text-indigo-100 uppercase tracking-[0.4em] opacity-80 mb-2 leading-none">🏆 MATCH RESULT</span>
                <span className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter italic drop-shadow-lg leading-tight">
                  {result.text}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Content */}
        {displayInnings ? (
          <div className="p-8 overflow-y-auto pb-20 scrollbar-hide space-y-12">
            {/* Batting Section */}
            <div>
              <div className="flex justify-between items-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 italic">Batting Performance</span>
                </div>
                <div className="text-right">
                  <span className="text-4xl font-black text-white tabular-nums tracking-tighter italic">
                    {displayInnings.totalRuns}<span className="text-slate-700 mx-1">/</span>{displayInnings.totalWickets}
                  </span>
                  <span className="ml-3 text-xs font-black text-slate-500 bg-white/5 px-2 py-1 rounded uppercase tracking-tighter tabular-nums flex items-baseline gap-1">
                    <span>{displayInnings.overs}.{displayInnings.balls}</span>
                    {totalOvers && (
                      <>
                        <span className="text-[10px] opacity-40">/</span>
                        <span>{totalOvers}</span>
                      </>
                    )}
                    <span className="ml-0.5 text-[10px] opacity-50">OVS</span>
                  </span>
                </div>
              </div>
              <BattingTable players={displayInnings.players} order={displayInnings.battingOrder} />
            </div>

            {/* Bowling Section */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6">
                <div className="flex flex-col">
                  <span className="text-[7px] text-slate-500 mb-0.5 tracking-[0.2em]">{displayInnings.bowlingTeamName}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 italic">Bowling Strategy</span>
                </div>
              </div>
              <BowlingTable bowlers={displayInnings.bowlers} order={displayInnings.bowlingOrder} />
            </div>

            {/* Ball by Ball Timeline */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 italic">Innings Timeline (Ball by Ball)</span>
              </div>
              <div className="space-y-3">
                {(() => {
                  const overs: Record<number, any[]> = {};
                  displayInnings.allBalls.forEach(ball => {
                    if (!overs[ball.overNumber]) overs[ball.overNumber] = [];
                    overs[ball.overNumber].push(ball);
                  });

                  return Object.entries(overs).sort(([a], [b]) => Number(b) - Number(a)).map(([overNum, balls]) => {
                    const bowler = balls[0]?.bowlerName || '---';
                    return (
                      <div key={overNum} className="bg-white/5 border border-white/5 rounded-2xl p-4 hover:bg-white/10 transition-colors">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-indigo-400 uppercase italic">Over {Number(overNum) + 1}</span>
                            <span className="w-1 h-3 bg-slate-700 rounded-full"></span>
                            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">{bowler}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {balls.map((ball: any, idx: number) => {
                            const isWicket = ball.isWicket;
                            const isExtra = ball.isExtra;
                            let label = ball.runs;
                            if (ball.extraType === 'WIDE') label = `${ball.extraRuns + ball.runs}wd`;
                            if (ball.extraType === 'NO_BALL') label = `${ball.extraRuns + ball.runs}nb`;
                            if (isWicket) label = 'W';

                            return (
                              <div key={idx} className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${isWicket ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : isExtra ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'bg-slate-800 text-slate-300'}`}>
                                {label}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Extras & Reset Footer */}
            <div className="bg-white/5 rounded-[2rem] p-8 border border-white/5 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -z-10 group-hover:bg-indigo-500/20 transition-all"></div>

              <div className="flex flex-wrap items-center justify-between gap-8">
                <div className="flex gap-12">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Innings Total</span>
                    <span className="text-2xl font-black text-white italic uppercase tracking-tighter">{displayInnings.totalRuns} Runs</span>
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      let w = 0, nb = 0, b = 0, lb = 0;
                      displayInnings.allBalls.forEach(ball => {
                        if (ball.extraType === ExtraType.WIDE) w += (ball.extraRuns + ball.runs);
                        if (ball.extraType === ExtraType.NO_BALL) nb += ball.extraRuns;
                        if (ball.extraType === ExtraType.BYE) b += ball.runs;
                        if (ball.extraType === ExtraType.LEG_BYE) lb += ball.runs;
                      });
                      return (
                        <>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Extras Total: {w + nb + b + lb}</span>
                          <div className="flex gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                            <span className="bg-white/5 px-2 py-0.5 rounded">W: {w}</span>
                            <span className="bg-white/5 px-2 py-0.5 rounded">NB: {nb}</span>
                            <span className="bg-white/5 px-2 py-0.5 rounded">B: {b}</span>
                            <span className="bg-white/5 px-2 py-0.5 rounded">LB: {lb}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                {!isSpectator && onResetMatch && activeTab === 'current' && (
                  <div className="mt-8 pt-6 border-t border-white/10 flex flex-col items-center">
                    <button
                      onClick={() => {
                        onClose();
                        onResetMatch();
                      }}
                      className="py-3 px-8 rounded-full bg-red-900/40 text-red-500 font-black text-xs uppercase tracking-widest border border-red-500/20 active:scale-95 transition-transform hover:bg-red-900/60"
                    >
                      START NEW MATCH
                    </button>
                  </div>)}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-32 text-center text-slate-600 font-black uppercase italic tracking-[0.5em] opacity-20">Secure Data Lost</div>
        )}
      </div>
    </div>
  );
};

export default Scoreboard;