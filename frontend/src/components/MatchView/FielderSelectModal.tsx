import React from 'react';
import { WicketType, InningsState } from '../../types';

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
  onClose
}) => {
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
                onClick={() => onSelect(fielder.name)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 rounded-lg flex justify-between items-center group transition-colors border-b border-slate-50 last:border-0"
              >
                <span className="font-medium text-slate-700 group-hover:text-blue-700">{fielder.name}</span>
                <span className="text-blue-500 opacity-0 group-hover:opacity-100">Select →</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          className="p-4 text-sm text-slate-400 hover:text-slate-600 border-t"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
