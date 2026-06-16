import React from 'react';
import { InningsState, WicketType } from '../../types';

interface BatterSelectModalProps {
  innings: InningsState;
  onSelect: (batterId: string) => void;
  onRename: (batterId: string) => void;
  onQuickAdd: (isBatsman: boolean) => void;
  onClose: () => void;
}

export const BatterSelectModal: React.FC<BatterSelectModalProps> = ({
  innings,
  onSelect,
  onRename,
  onQuickAdd,
  onClose
}) => {
  const striker = innings.players[innings.strikerId];
  const nonStriker = innings.players[innings.nonStrikerId];
  const isManualChange = innings.strikerId !== "" && 
                         innings.nonStrikerId !== "" && 
                         striker && !striker.isOut && 
                         nonStriker && !nonStriker.isOut;

  const availableBatters = innings.battingOrder.filter(id => {
    const p = innings.players[id];
    if (p.isOut) return false;

    if (isManualChange) {
      // Manual change: show active batsmen (striker/non-striker) and retired hurt batsmen
      const isActive = id === innings.strikerId || id === innings.nonStrikerId;
      const isRetiredHurt = p.wicketType === WicketType.RETIRED_HURT;
      return isActive || isRetiredHurt;
    } else {
      // Wicket replacement: show retired hurt and remaining players
      const isActive = id === innings.strikerId || id === innings.nonStrikerId;
      if (isActive) return false;
      
      const isRetiredHurt = p.wicketType === WicketType.RETIRED_HURT;
      const isRemaining = p.ballsFaced === 0;
      return isRetiredHurt || isRemaining;
    }
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
                onClick={() => onSelect(id)}
                className="w-full text-left px-5 py-4 bg-white/5 hover:bg-indigo-600 rounded-2xl flex justify-between items-center group transition-all active:scale-95 border border-white/5"
              >
                <div className="flex items-center gap-3 min-w-0 flex-wrap">
                  <span className="text-lg opacity-40 group-hover:opacity-100 transition-opacity">🏏</span>
                  <span className="font-black text-slate-200 group-hover:text-white uppercase tracking-tight text-sm italic truncate">{innings.players[id].name}</span>
                  {id === innings.strikerId && (
                    <span className="text-[8px] bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Striker</span>
                  )}
                  {id === innings.nonStrikerId && (
                    <span className="text-[8px] bg-slate-800 text-slate-450 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Non-Striker</span>
                  )}
                  {innings.players[id].wicketType === WicketType.RETIRED_HURT && (
                    <span className="text-[8px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Retired Hurt</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs p-2 hover:bg-white/20 rounded-lg transition-colors" onClick={(e) => { e.stopPropagation(); onRename(id); }}>✏️</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">Select</span>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="p-4 border-t border-white/10 bg-slate-950/50 flex flex-col gap-2 shrink-0">
          <button
            onClick={() => onQuickAdd(true)}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20"
          >
            + ADD NEW PLAYER TO SQUAD
          </button>
          {!(innings.strikerId === "" || innings.nonStrikerId === "" || innings.players[innings.strikerId]?.isOut || innings.players[innings.nonStrikerId]?.isOut) && (
            <button
              onClick={onClose}
              className="w-full py-2 text-slate-500 text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors"
            >
              Close View
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
