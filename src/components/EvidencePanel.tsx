import React, { useState } from 'react';
import { InvestigationObservation } from '../types/agent';
import { ShieldCheck, ArrowUpRight, ArrowDownRight, Database, Eye, CheckCircle2 } from 'lucide-react';

interface EvidencePanelProps {
  observations: InvestigationObservation[];
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({ observations }) => {
  const [selectedObs, setSelectedObs] = useState<InvestigationObservation | null>(null);

  return (
    <div className="rounded-2xl bg-[#12161F] border border-[#252A36] p-5">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#252A36]">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-amber-500/10 text-amber-400">
            <ShieldCheck className="w-4 h-4" />
          </span>
          <h3 className="text-sm font-semibold text-slate-100">Empirical Evidence Store</h3>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-medium">
          {observations.length} Facts Recorded
        </span>
      </div>

      {observations.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-xs">
          No empirical observations logged yet. Run an investigation to gather evidence.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {observations.map((obs) => {
            const hasDelta = obs.comparison?.percentDelta !== undefined;
            const isPositive = (obs.comparison?.percentDelta || 0) > 0;

            return (
              <div
                key={obs.id}
                className="p-3.5 rounded-xl bg-[#0E121A] border border-[#1E232E] hover:border-[#2F3746] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-200 truncate">{obs.metric}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1B212D] text-slate-300 border border-[#252A36]">
                        v{obs.datasetVersion}.0
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        obs.confidence === 'HIGH' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                        obs.confidence === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                        'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                      }`}>
                        {obs.confidence}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-3">{obs.summary}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#1A1F2B] text-[11px]">
                  <div className="flex items-center gap-2">
                    {hasDelta && (
                      <span className={`flex items-center font-mono font-medium ${
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {isPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                        {Math.abs(obs.comparison?.percentDelta || 0).toFixed(1)}%
                      </span>
                    )}
                    <span className="text-slate-400 font-mono text-[10px]">{obs.sourceTool}</span>
                  </div>

                  {obs.rawEvidenceRef && (
                    <button
                      onClick={() => setSelectedObs(obs)}
                      className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Trace</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Raw Provenance Modal */}
      {selectedObs && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#12161F] border border-[#252A36] rounded-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Observation Provenance Details</h4>
                <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {selectedObs.id}</p>
              </div>
              <button
                onClick={() => setSelectedObs(null)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded-lg bg-[#1B212D]"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p><strong className="text-slate-400">Metric:</strong> {selectedObs.metric}</p>
              <p><strong className="text-slate-400">Source Tool:</strong> {selectedObs.sourceTool}</p>
              <p><strong className="text-slate-400">Dataset Version:</strong> v{selectedObs.datasetVersion}.0</p>
              <p><strong className="text-slate-400">Recorded At:</strong> {new Date(selectedObs.timestamp).toLocaleString()}</p>
              <div className="pt-2">
                <span className="text-slate-400 font-medium block mb-1">Calculated Payload Output:</span>
                <pre className="p-3 bg-[#090B0E] rounded-xl text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48">
                  {JSON.stringify(selectedObs.rawEvidenceRef, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
