import React from 'react';
import { DriverContribution, DecompositionNode } from '../types/agent';
import { Target, TrendingUp, TrendingDown, GitBranch, ArrowRight } from 'lucide-react';

interface DriverAnalysisViewProps {
  targetMetric: string;
  totalDelta: number;
  totalPercentDelta: number;
  drivers: DriverContribution[];
  decomposition?: DecompositionNode;
}

export const DriverAnalysisView: React.FC<DriverAnalysisViewProps> = ({
  targetMetric,
  totalDelta,
  totalPercentDelta,
  drivers,
  decomposition
}) => {
  return (
    <div className="rounded-2xl bg-[#12161F] border border-[#252A36] p-5 space-y-5">
      {/* Header Summary */}
      <div className="flex items-center justify-between pb-3 border-b border-[#252A36]">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-amber-500/10 text-amber-400">
            <Target className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Variance Driver & Decomposition Analysis</h3>
            <p className="text-xs text-slate-400">Target Metric: <span className="font-mono text-amber-300">{targetMetric}</span></p>
          </div>
        </div>

        <div className="text-right">
          <div className={`text-sm font-bold font-mono flex items-center justify-end gap-1 ${
            totalDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {totalDelta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{totalDelta >= 0 ? '+' : ''}{totalDelta.toLocaleString()}</span>
            <span className="text-xs font-normal">({totalPercentDelta >= 0 ? '+' : ''}{totalPercentDelta.toFixed(1)}%)</span>
          </div>
          <span className="text-[10px] text-slate-400">Aggregate Variance</span>
        </div>
      </div>

      {/* Decomposition Formula Tree if available */}
      {decomposition && (
        <div className="p-4 rounded-xl bg-[#0E121A] border border-[#1E232E] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <GitBranch className="w-3.5 h-3.5 text-amber-400" />
            <span>Mathematical Decomposition Hierarchy</span>
            <span className="text-[10px] font-mono text-slate-400 font-normal">({decomposition.formula})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-[#141822] border border-[#202735]">
              <span className="text-[10px] text-slate-400 block mb-1">Top-Level Metric</span>
              <div className="text-sm font-bold font-mono text-slate-100">{decomposition.value.toLocaleString()}</div>
              <span className="text-[10px] text-amber-400 font-medium">{decomposition.name}</span>
            </div>

            {decomposition.children?.map((child, cIdx) => (
              <div key={cIdx} className="p-3 rounded-lg bg-[#141822] border border-[#202735]">
                <span className="text-[10px] text-slate-400 block mb-1">{child.formula || `Factor ${cIdx + 1}`}</span>
                <div className="text-sm font-bold font-mono text-slate-100">{child.value.toLocaleString()}</div>
                <span className="text-[10px] text-slate-300">{child.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Driver Contribution Table */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-slate-300">Ranked Dimensional Contributors</h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#202634] text-slate-400 font-medium">
                <th className="py-2 px-3">Dimension</th>
                <th className="py-2 px-3">Segment / Factor</th>
                <th className="py-2 px-3 text-right">Baseline</th>
                <th className="py-2 px-3 text-right">Current</th>
                <th className="py-2 px-3 text-right">Impact (Δ)</th>
                <th className="py-2 px-3 text-right">Contribution %</th>
                <th className="py-2 px-3 text-center">Significance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1F2B]">
              {drivers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-400">No dimensional drivers detected.</td>
                </tr>
              ) : (
                drivers.map((d, i) => {
                  const isPositive = d.absoluteDelta >= 0;
                  return (
                    <tr key={i} className="hover:bg-[#161B24] transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-300">{d.dimension}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-100">{d.factor}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">{d.baselineValue.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">{d.currentValue.toLocaleString()}</td>
                      <td className={`py-2.5 px-3 text-right font-mono font-semibold ${
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {isPositive ? '+' : ''}{d.absoluteDelta.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-amber-300">
                        {d.percentageContribution.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          d.significance === 'MAJOR' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                          d.significance === 'MODERATE' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
                          'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                        }`}>
                          {d.significance}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
