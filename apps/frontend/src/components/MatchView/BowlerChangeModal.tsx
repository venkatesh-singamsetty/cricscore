import React, { useState } from "react";
import { InningsState } from "../../types";

interface BowlerChangeModalProps {
  innings: InningsState;
  totalOvers: number;
  onSelect: (bowlerId: string) => void;
  onQuickAdd: (isBatsman: boolean) => void;
  onClose: () => void;
}

export const BowlerChangeModal: React.FC<BowlerChangeModalProps> = ({
  innings,
  totalOvers,
  onSelect,
  onQuickAdd,
  onClose,
}) => {
  const currentBowler = innings.bowlers[innings.currentBowlerId];
  const maxBowlerOvers = Math.ceil(totalOvers / 5);
  const [selectedId, setSelectedId] = useState("");
  const options = innings.bowlingOrder.filter((id) => {
    const b = innings.bowlers[id];
    return id !== innings.currentBowlerId && (b?.overs || 0) < maxBowlerOvers;
  });

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
        <div className="overflow-y-auto p-4 space-y-1.5 pb-8 scrollbar-hide flex-1">
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
          <label
            htmlFor="next-bowler"
            className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-2"
          >
            Bowler
          </label>
          <select
            id="next-bowler"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full bg-slate-950 border-2 border-slate-800 focus:border-purple-500 rounded-2xl px-4 py-3 text-white font-black uppercase text-sm focus:outline-none"
          >
            <option value="">Select bowler...</option>
            {options.map((id) => {
              const b = innings.bowlers[id];
              return (
                <option key={id} value={id}>
                  {b?.name || id} ({b?.overs || 0}.{b?.balls || 0} ov,{" "}
                  {b?.wickets || 0} wkt)
                </option>
              );
            })}
          </select>
          {options.length === 0 && (
            <p className="mt-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              No other bowlers available. Add one below.
            </p>
          )}
          <button
            type="button"
            disabled={!selectedId}
            onClick={() => onSelect(selectedId)}
            className="mt-4 w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl shadow-purple-600/20"
          >
            Save
          </button>
        </div>
        <div className="p-4 border-t border-white/10 bg-slate-950/50 flex flex-col gap-2 shrink-0">
          <button
            onClick={() => onQuickAdd(false)}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl shadow-purple-600/20"
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
