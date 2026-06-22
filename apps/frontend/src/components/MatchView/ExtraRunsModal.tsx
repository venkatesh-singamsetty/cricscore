import React from "react";
import { ExtraType } from "../../types";

interface ExtraRunsModalProps {
  pendingExtra: ExtraType;
  onScore: (runs: number) => void;
  onIgnore: () => void;
}

export const ExtraRunsModal: React.FC<ExtraRunsModalProps> = ({
  pendingExtra,
  onScore,
  onIgnore,
}) => (
  <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[200] p-4 backdrop-blur-md animate-in fade-in duration-300">
    <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-500 text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-4">
        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 italic">
          {pendingExtra.replace("_", " ")} Detected
        </span>
      </div>
      <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic mb-2">
        Additional Runs?
      </h3>
      <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-8">
        Select any runs conceded from this delivery
      </p>
      <div className="grid grid-cols-4 gap-2 md:gap-3">
        {[0, 1, 2, 3].map((r) => (
          <button
            key={r}
            onClick={() => onScore(r)}
            className="py-5 sm:py-6 rounded-2xl font-black text-2xl sm:text-3xl transition-all active:scale-95 shadow-xl border-t border-white/10 bg-slate-900 text-white hover:bg-slate-800"
          >
            {r}
          </button>
        ))}
        {[4, 5, 6].map((r) => (
          <button
            key={r}
            onClick={() => onScore(r)}
            className={`py-5 sm:py-6 rounded-2xl font-black text-2xl sm:text-3xl transition-all active:scale-95 shadow-xl border-t border-white/10 ${
              r === 4
                ? "bg-blue-600 text-white shadow-blue-600/20"
                : r === 5
                  ? "bg-emerald-600 text-white shadow-emerald-600/20"
                  : "bg-purple-600 text-white shadow-purple-600/20"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <button
        onClick={onIgnore}
        className="mt-8 w-full py-4 text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] hover:text-white transition-colors"
      >
        Ignore Extra
      </button>
    </div>
  </div>
);
