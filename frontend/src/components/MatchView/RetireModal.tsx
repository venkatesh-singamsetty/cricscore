import React from 'react';
import { WicketType } from '../../types';

interface RetireModalProps {
  strikerName: string;
  onRetire: (type: WicketType.RETIRED_HURT | WicketType.RETIRED_OUT) => void;
  onClose: () => void;
}

export const RetireModal: React.FC<RetireModalProps> = ({
  strikerName,
  onRetire,
  onClose
}) => (
  <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[200] p-4 backdrop-blur-md animate-in fade-in duration-300">
    <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
      <div className="p-6 bg-slate-950 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
          <h3 className="text-lg font-black uppercase tracking-tighter italic text-white">Retire Batsman</h3>
        </div>
      </div>
      <div className="p-6 flex flex-col gap-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 text-center">
          Select retirement type for {strikerName}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onRetire(WicketType.RETIRED_HURT)}
            className="py-5 px-4 bg-white/5 text-slate-200 border border-white/5 rounded-2xl font-black hover:bg-indigo-600 hover:text-white hover:border-indigo-400 transition-all active:scale-95 uppercase text-xs italic flex flex-col items-center justify-center gap-2"
          >
            <span className="text-2xl">🤕</span>
            <span>Retired Hurt</span>
            <span className="text-[8px] opacity-60 font-medium normal-case">(Not Out)</span>
          </button>
          <button
            onClick={() => onRetire(WicketType.RETIRED_OUT)}
            className="py-5 px-4 bg-white/5 text-slate-200 border border-white/5 rounded-2xl font-black hover:bg-red-600 hover:text-white hover:border-red-400 transition-all active:scale-95 uppercase text-xs italic flex flex-col items-center justify-center gap-2"
          >
            <span className="text-2xl">🚪</span>
            <span>Retired Out</span>
            <span className="text-[8px] opacity-60 font-medium normal-case">(Wicket)</span>
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 py-4 px-4 bg-slate-800 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
);
