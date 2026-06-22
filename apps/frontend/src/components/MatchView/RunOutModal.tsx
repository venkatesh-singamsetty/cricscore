import React from "react";
import { InningsState } from "../../types";

interface RunOutModalProps {
  innings: InningsState;
  runOutRuns: number | null;
  setRunOutRuns: (r: number | null) => void;
  onSelect: (runs: number, outBatterId: string) => void;
  onClose: () => void;
}

export const RunOutModal: React.FC<RunOutModalProps> = ({
  innings,
  runOutRuns,
  setRunOutRuns,
  onSelect,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[200] p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-500 flex flex-col gap-4">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
          <h3 className="text-lg font-black uppercase tracking-tighter italic text-white flex-1">
            Run Out Details
          </h3>
        </div>

        {runOutRuns === null ? (
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
              Runs Completed Before Run Out?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2, 3, 4, 5].map((r) => (
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
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
              Who was Run Out?
            </label>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onSelect(runOutRuns, innings.strikerId)}
                className="py-4 px-4 bg-slate-800 text-slate-200 border border-white/5 rounded-2xl font-black hover:bg-red-600 hover:text-white transition-all active:scale-95 text-sm uppercase italic flex justify-between items-center"
              >
                <span>
                  {innings.players[innings.strikerId]?.name || "Striker"}
                </span>
                <span className="text-[9px] opacity-50 tracking-widest">
                  STRIKER
                </span>
              </button>
              <button
                onClick={() => onSelect(runOutRuns, innings.nonStrikerId)}
                className="py-4 px-4 bg-slate-800 text-slate-200 border border-white/5 rounded-2xl font-black hover:bg-red-600 hover:text-white transition-all active:scale-95 text-sm uppercase italic flex justify-between items-center"
              >
                <span>
                  {innings.players[innings.nonStrikerId]?.name || "Non-Striker"}
                </span>
                <span className="text-[9px] opacity-50 tracking-widest">
                  NON-STRIKER
                </span>
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
          onClick={onClose}
          className="mt-2 py-3 px-4 bg-transparent text-slate-500 rounded-full font-black uppercase tracking-widest text-[9px] hover:bg-white/5 hover:text-white transition-all border border-transparent hover:border-white/10"
        >
          Abort Wicket
        </button>
      </div>
    </div>
  );
};
