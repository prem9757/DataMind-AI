import React from 'react';
import { Hypothesis } from '../types/agent';
import { BrainCircuit, CheckCircle2, HelpCircle, XCircle, AlertTriangle } from 'lucide-react';

interface HypothesisBoardProps {
  hypotheses: Hypothesis[];
}

export const HypothesisBoard: React.FC<HypothesisBoardProps> = ({ hypotheses }) => {
  return (
    <div className="rounded-2xl bg-[#12161F] border border-[#252A36] p-5">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#252A36]">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-amber-500/10 text-amber-400">
            <BrainCircuit className="w-4 h-4" />
          </span>
          <h3 className="text-sm font-semibold text-slate-100">Hypothesis Evaluation Matrix</h3>
        </div>
        <span className="text-xs text-slate-400">
          {hypotheses.filter(h => h.status === 'SUPPORTED').length} Supported / {hypotheses.length} Total
        </span>
      </div>

      {hypotheses.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-xs">
          No hypotheses generated yet.
        </div>
      ) : (
        <div className="space-y-3">
          {hypotheses.map((hyp, idx) => {
            const isSupported = hyp.status === 'SUPPORTED';
            const isPartial = hyp.status === 'PARTIALLY_SUPPORTED';
            const isRefuted = hyp.status === 'NOT_SUPPORTED';

            return (
              <div
                key={hyp.id}
                className="p-4 rounded-xl bg-[#0E121A] border border-[#1E232E] space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-400">H{idx + 1}</span>
                    <h4 className="text-xs font-semibold text-slate-200">{hyp.statement}</h4>
                  </div>

                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                    isSupported ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                    isPartial ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                    isRefuted ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
                    'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                  }`}>
                    {isSupported && <CheckCircle2 className="w-3 h-3" />}
                    {isPartial && <AlertTriangle className="w-3 h-3" />}
                    {isRefuted && <XCircle className="w-3 h-3" />}
                    {!isSupported && !isPartial && !isRefuted && <HelpCircle className="w-3 h-3" />}
                    {hyp.status.replace('_', ' ')}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">{hyp.rationale}</p>

                <div className="flex items-center justify-between pt-2 border-t border-[#1A1F2B] text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Strength:</span>
                    <div className="w-20 h-1.5 bg-[#1A1F2B] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isSupported ? 'bg-emerald-400' : isPartial ? 'bg-amber-400' : 'bg-slate-500'
                        }`}
                        style={{ width: `${Math.round(hyp.strengthScore * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-300">
                      {Math.round(hyp.strengthScore * 100)}%
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    <span className="text-emerald-400 font-mono font-medium">{hyp.supportingObservationIds.length}</span> support / <span className="text-rose-400 font-mono font-medium">{hyp.refutingObservationIds.length}</span> refute
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
