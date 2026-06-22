import React from "react";
import { WicketType, InningsState } from "../../types";

interface FielderSelectModalProps {
  innings: InningsState;
  pendingWicketInfo: {
    runs: number;
    wicketType: WicketType;
    outBatterId: string;
  } | null;
  onSelect: (fielderName: string) => void;
  onClose: () => void;
}

export const FielderSelectModal: React.FC<FielderSelectModalProps> = ({
  innings,
  pendingWicketInfo,
  onSelect,
  onClose,
}) => {
  let title = "Who took the fielder action?";
  if (pendingWicketInfo?.wicketType === WicketType.CAUGHT)
    title = "Who took the catch?";
  else if (pendingWicketInfo?.wicketType === WicketType.STUMPED)
    title = "Who performed the stumping?";
  else if (pendingWicketInfo?.wicketType === WicketType.RUN_OUT)
    title = "Who performed the run out?";

  return (
    <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[200] p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[70vh] animate-in zoom-in-95 duration-500">
        <div className="p-6 bg-slate-950 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            <h3 className="text-lg font-black uppercase tracking-tighter italic text-white">
              {title}
            </h3>
          </div>
          <span className="text-2xl animate-bounce">🛡️</span>
        </div>
        <div className="overflow-y-auto p-4 space-y-3 pb-8 scrollbar-hide flex-1">
          {innings.bowlingOrder.map((id) => {
            const fielder = innings.bowlers[id];
            return (
              <button
                key={id}
                onClick={() => onSelect(fielder.name)}
                className="w-full text-left px-5 py-4 bg-white/5 hover:bg-indigo-600 rounded-2xl flex justify-between items-center group transition-all active:scale-95 border border-white/5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg opacity-40 group-hover:opacity-100 transition-opacity">
                    🛡️
                  </span>
                  <span className="font-black text-slate-200 group-hover:text-white uppercase tracking-tight text-sm italic truncate">
                    {fielder.name}
                  </span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                  Select
                </span>
              </button>
            );
          })}
        </div>
        <div className="p-4 border-t border-white/10 bg-slate-950/50 flex flex-col gap-2 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-transparent text-slate-500 rounded-full font-black uppercase tracking-widest text-[9px] hover:bg-white/5 hover:text-white transition-all border border-transparent hover:border-white/10"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
