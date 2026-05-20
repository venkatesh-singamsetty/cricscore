import React from 'react';
import { WicketType, ExtraType } from '../../types';

interface WicketTypeModalProps {
  pendingExtra: ExtraType;
  onSelect: (type: WicketType) => void;
  onClose: () => void;
}

export const WicketTypeModal: React.FC<WicketTypeModalProps> = ({
  pendingExtra,
  onSelect,
  onClose
}) => (
  <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[200] p-4 backdrop-blur-md animate-in fade-in duration-300">
    <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
      <div className="p-6 bg-slate-950 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
          <h3 className="text-lg font-black uppercase tracking-tighter italic text-white">Dismissal Type</h3>
        </div>
      </div>
      <div className="p-6 grid grid-cols-2 gap-3">
        {/* Filter valid dismissals by delivery type per Laws of Cricket:
            Wide  → only Run Out (Law 25.6)
            No-Ball → only Caught & Run Out (Laws 23, 37, 39)
            Normal  → all modes */}
        {(pendingExtra === ExtraType.WIDE
          ? [WicketType.RUN_OUT]
          : pendingExtra === ExtraType.NO_BALL
            ? [WicketType.CAUGHT, WicketType.RUN_OUT]
            : [WicketType.BOWLED, WicketType.CAUGHT, WicketType.LBW, WicketType.RUN_OUT, WicketType.STUMPED, WicketType.HIT_WICKET]
        ).map((type) => (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className="py-5 px-4 bg-white/5 text-slate-200 border border-white/5 rounded-2xl font-black hover:bg-red-600 hover:text-white hover:border-red-400 transition-all active:scale-95 uppercase text-xs italic"
          >
            {type.replace('_', ' ')}
          </button>
        ))}
        <button
          onClick={onClose}
          className="col-span-2 mt-4 py-4 px-4 bg-slate-800 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all"
        >
          Abort
        </button>
      </div>
    </div>
  </div>
);
