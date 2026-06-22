import React from "react";
import { InningsState } from "../../types";

interface BowlerSelectModalProps {
  innings: InningsState;
  totalOvers: number;
  onSelect: (bowlerId: string) => void;
  onRename: (bowlerId: string) => void;
  onQuickAdd: (isBatsman: boolean) => void;
  onClose: () => void;
}

export const BowlerSelectModal: React.FC<BowlerSelectModalProps> = ({
  innings,
  totalOvers,
  onSelect,
  onRename,
  onQuickAdd,
  onClose,
}) => {
  const currentBowler = innings.bowlers[innings.currentBowlerId];
  const maxBowlerOvers = Math.ceil(totalOvers / 5);

  return (
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
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                  Previous Bowler
                </span>
                <span className="text-xs font-black text-indigo-400 uppercase italic">
                  {currentBowler?.name || "---"}
                </span>
              </div>
              <div className="h-px bg-white/5 mx-2 my-4"></div>
            </>
          )}
          {innings.bowlingOrder.map((id) => {
            const bowler = innings.bowlers[id];
            const isCurrent = id === innings.currentBowlerId;
            const hasReachedQuota = bowler.overs >= maxBowlerOvers;
            const isDisabled = isCurrent || hasReachedQuota;
            return (
              <button
                key={id}
                onClick={() => onSelect(id)}
                disabled={isDisabled}
                className={`w-full text-left px-5 py-4 rounded-2xl flex justify-between items-center transition-all ${isDisabled ? "bg-slate-800/30 opacity-20 cursor-not-allowed grayscale" : "bg-white/5 hover:bg-purple-600 group active:scale-95 border border-white/5"}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg opacity-40 group-hover:opacity-100 transition-opacity">
                    🎾
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`font-black uppercase tracking-tight text-sm italic truncate ${isDisabled ? "text-slate-500" : "text-slate-200 group-hover:text-white"}`}
                    >
                      {bowler.name}
                    </span>
                    <div className="text-[10px] font-bold text-slate-500 group-hover:text-purple-200">
                      {bowler.overs}.{bowler.balls} OVS • {bowler.wickets} WKT
                      {hasReachedQuota ? (
                        <span className="ml-1 text-red-400 font-black">
                          {" "}
                          • QUOTA FULL
                        </span>
                      ) : (
                        <span className="ml-1 opacity-40">
                          / {maxBowlerOvers} max
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs p-2 hover:bg-white/20 rounded-lg transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRename(id);
                    }}
                  >
                    ✏️
                  </span>
                  {!isDisabled && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                      Select
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="p-4 border-t border-white/10 bg-slate-950/50 flex flex-col gap-2 shrink-0">
          <button
            onClick={() => onQuickAdd(false)}
            className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl shadow-purple-600/20"
          >
            + ADD NEW BOWLER TO SQUAD
          </button>
          {!(
            innings.currentBowlerId === "" ||
            (innings.balls === 0 && innings.allBalls.length > 0)
          ) && (
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
