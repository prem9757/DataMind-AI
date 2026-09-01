import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  HelpCircle,
  Search,
  Eye,
  Layers,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { DatasetState } from '../types/dataset';

interface DataQualityProps {
  dataset: DatasetState;
  onApplyQuickFix?: (issue: any) => void;
  onNavigateToCleaning: () => void;
  onNavigateToEDA?: () => void;
  onNavigate?: (section: any) => void;
  onInspectRows?: (filterType: 'missing' | 'outliers' | 'duplicates' | 'all', column?: string) => void;
}

export const DataQuality: React.FC<DataQualityProps> = ({
  dataset,
  onNavigateToCleaning,
  onNavigateToEDA,
  onNavigate,
  onInspectRows
}) => {
  const { quality, profiles, columns } = dataset;
  const [showScoreExplanation, setShowScoreExplanation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColumnDetails, setSelectedColumnDetails] = useState<string | null>(null);

  // Derive 2-4 key human-readable issues
  const keyIssues: string[] = [];
  if (quality.missingCellsTotal > 0) {
    const topMissingCol = columns
      .map(c => ({ col: c, count: profiles[c]?.nullCount || 0 }))
      .sort((a, b) => b.count - a.count)[0];
    if (topMissingCol && topMissingCol.count > 0) {
      keyIssues.push(`${quality.missingCellsTotal.toLocaleString()} missing values (${topMissingCol.count} in '${topMissingCol.col}')`);
    } else {
      keyIssues.push(`${quality.missingCellsTotal.toLocaleString()} missing values across fields`);
    }
  }
  if (quality.duplicateRows > 0) {
    keyIssues.push(`${quality.duplicateRows.toLocaleString()} duplicate rows detected`);
  }
  if (quality.outliersTotal > 0) {
    const topOutlierCol = columns
      .map(c => ({ col: c, count: profiles[c]?.outlierCount || 0 }))
      .sort((a, b) => b.count - a.count)[0];
    if (topOutlierCol && topOutlierCol.count > 0) {
      keyIssues.push(`${quality.outliersTotal.toLocaleString()} potential outliers (${topOutlierCol.count} in '${topOutlierCol.col}')`);
    } else {
      keyIssues.push(`${quality.outliersTotal.toLocaleString()} potential numeric outliers`);
    }
  }
  if (quality.invalidValuesTotal > 0) {
    keyIssues.push(`${quality.invalidValuesTotal.toLocaleString()} invalid or inconsistent entries`);
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 70) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getHealthStatusLabel = (score: number) => {
    if (score >= 90) return { label: 'Good — Analysis Ready', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    if (score >= 70) return { label: 'Needs Attention', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
    return { label: 'Poor — Cleaning Recommended', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' };
  };

  const statusInfo = getHealthStatusLabel(quality.score);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#252A36] pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Data Quality Assessment</h1>
          <p className="text-xs text-slate-400 mt-1">
            Review your dataset health, identify flaws, and prepare your records before modeling.
          </p>
        </div>

        {/* Primary Navigation Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onNavigateToCleaning}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Data Preparation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Prominent Health Score & Key Issues Banner */}
      <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-6 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Score & Status */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#252A36] pb-4 lg:pb-0 lg:pr-6 flex flex-col justify-center">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Overall Health</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-4xl font-black font-mono ${getScoreColor(quality.score)}`}>
              {quality.score}
            </span>
            <span className="text-sm font-bold text-slate-500">/ 100</span>
          </div>
          <div className="mt-2">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wide uppercase border ${statusInfo.bg} ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Key Issues List */}
        <div className="lg:col-span-5 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Key Findings</span>
          {keyIssues.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium py-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>No critical data issues detected. Dataset is clean and ready for analysis.</span>
            </div>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-300">
              {keyIssues.slice(0, 4).map((issue, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick Action Button */}
        <div className="lg:col-span-3 flex flex-col gap-2.5 justify-center items-start lg:items-end">
          <button
            onClick={onNavigateToCleaning}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Proceed to Data Preparation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowScoreExplanation(!showScoreExplanation)}
            className="text-xs text-slate-400 hover:text-amber-400 transition flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showScoreExplanation ? 'Hide Score Breakdown' : 'How is this calculated?'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-4 shadow-lg">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Missing Cells</span>
          <div className="text-xl font-black text-slate-100 font-mono mt-1">
            {quality.missingCellsTotal.toLocaleString()}
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {quality.missingCellsPercentage}% of total cells
          </span>
        </div>

        <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-4 shadow-lg">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Duplicate Rows</span>
          <div className="text-xl font-black text-slate-100 font-mono mt-1">
            {quality.duplicateRows.toLocaleString()}
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {quality.duplicateRowPercentage}% duplicate rate
          </span>
        </div>

        <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-4 shadow-lg">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Outliers (1.5x IQR)</span>
          <div className="text-xl font-black text-slate-100 font-mono mt-1">
            {quality.outliersTotal.toLocaleString()}
          </div>
          <span className="text-xs text-slate-400">Extreme values</span>
        </div>

        <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-4 shadow-lg">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Flawed Columns</span>
          <div className="text-xl font-black text-slate-100 font-mono mt-1">
            {quality.columnsWithIssuesCount} <span className="text-xs text-slate-500 font-normal">/ {columns.length}</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {columns.length - quality.columnsWithIssuesCount} clean columns
          </span>
        </div>
      </div>

      {/* Transparent Score Calculation Explanation Drawer */}
      {showScoreExplanation && (
        <div className="bg-[#12151C] border border-amber-500/30 rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-slate-100">
                Data Quality Score Calculation &amp; Weight Breakdown
              </h3>
            </div>
            <button
              onClick={() => setShowScoreExplanation(false)}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-[#181D26] cursor-pointer"
            >
              Close
            </button>
          </div>

          <p className="text-xs text-slate-300">
            The overall score of <strong className={getScoreColor(quality.score)}>{quality.score}/100</strong> is calculated transparently using an analytical weighted model across six data quality dimensions:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {quality.scoreExplanations.map(item => (
              <div key={item.dimension} className="bg-[#0B0D11] border border-[#252A36] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">{item.dimension}</span>
                  <span className="font-mono text-amber-400 font-bold">{item.score}/100 ({item.weight}% Weight)</span>
                </div>
                <div className="w-full h-1.5 bg-[#252A36] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.score >= 80 ? 'bg-emerald-500' : item.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${item.score}%` }}
                  ></div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {item.reason}
                </p>
                {item.penalty > 0 && (
                  <span className="text-[10px] text-rose-400 font-mono block">
                    Penalty: -{item.penalty} pts
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Column Quality Profiles Table */}
      <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-4 shadow-xl overflow-x-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#252A36] pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              Column Quality Profiles ({columns.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Click any column to inspect detailed distribution and value frequencies</p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search columns..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-[#0B0D11] border border-[#252A36] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 w-48 sm:w-60"
            />
          </div>
        </div>

        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-[#252A36] text-slate-400 font-semibold">
              <th className="pb-3 pr-4">Column Name</th>
              <th className="pb-3 px-3">Current Type</th>
              <th className="pb-3 px-3">Detected Type</th>
              <th className="pb-3 px-3 text-right">Non-Null</th>
              <th className="pb-3 px-3 text-right">Missing %</th>
              <th className="pb-3 px-3 text-right">Unique</th>
              <th className="pb-3 px-3 text-right">Outliers</th>
              <th className="pb-3 px-3 text-center">Quality Status</th>
              <th className="pb-3 pl-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#252A36]">
            {columns
              .filter(col => col.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(col => {
                const profile = profiles[col];
                if (!profile) return null;

                const colIssues = quality.issues.filter(i => i.column === col);
                const hasCritical = colIssues.some(i => i.severity === 'CRITICAL');
                const hasHigh = colIssues.some(i => i.severity === 'HIGH');
                const hasMedium = colIssues.some(i => i.severity === 'MEDIUM');

                const statusBadge = hasCritical
                  ? { label: 'CRITICAL', bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30' }
                  : hasHigh
                  ? { label: 'ATTENTION', bg: 'bg-amber-600/15 text-amber-500 border-amber-600/30' }
                  : hasMedium
                  ? { label: 'MEDIUM', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' }
                  : { label: 'CLEAN', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };

                return (
                  <tr
                    key={col}
                    onClick={() => setSelectedColumnDetails(col)}
                    className="hover:bg-[#181D26] cursor-pointer transition group"
                  >
                    <td className="py-3 pr-4 font-bold text-slate-200 group-hover:text-amber-300 flex items-center gap-1.5">
                      {col}
                      {profile.isPotentialId && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          ID
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">{profile.type}</td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {profile.recommendedType && profile.recommendedType !== profile.type ? (
                        <span className="text-amber-400 font-bold">
                          {profile.recommendedType} ({profile.detectedTypeConfidence}%)
                        </span>
                      ) : (
                        <span className="text-emerald-400">{profile.type} (100%)</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      {(profile.totalCount - profile.nullCount).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      <span className={profile.nullPercentage > 10 ? 'text-rose-400 font-bold' : profile.nullPercentage > 0 ? 'text-amber-400' : 'text-slate-400'}>
                        {profile.nullPercentage}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      {profile.uniqueCount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {profile.type === 'numeric' ? (
                        <span className={(profile.outlierCount || 0) > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                          {profile.outlierCount || 0}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${statusBadge.bg}`}>
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedColumnDetails(col);
                        }}
                        className="px-2.5 py-1 rounded bg-[#181D26] hover:bg-[#202733] text-[11px] text-slate-300 font-medium transition cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Column Detail Inspector Modal / Drawer */}
      {selectedColumnDetails && profiles[selectedColumnDetails] && (
        <div className="fixed inset-0 bg-[#0B0D11]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-[#2D3342] rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  Column Quality: {selectedColumnDetails}
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Type: <span className="text-amber-400 font-bold">{profiles[selectedColumnDetails].type}</span> • Total Rows: {profiles[selectedColumnDetails].totalCount.toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedColumnDetails(null)}
                className="text-xs text-slate-400 hover:text-slate-100 p-1.5 rounded-lg bg-[#181D26] cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36]">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Null Count</span>
                <span className="text-base font-mono font-bold text-slate-200">
                  {profiles[selectedColumnDetails].nullCount} ({profiles[selectedColumnDetails].nullPercentage}%)
                </span>
              </div>

              <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36]">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Unique Values</span>
                <span className="text-base font-mono font-bold text-slate-200">
                  {profiles[selectedColumnDetails].uniqueCount}
                </span>
              </div>

              {profiles[selectedColumnDetails].type === 'numeric' && (
                <>
                  <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36]">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Median / Mean</span>
                    <span className="text-base font-mono font-bold text-slate-200">
                      {profiles[selectedColumnDetails].median} / {profiles[selectedColumnDetails].mean}
                    </span>
                  </div>

                  <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36]">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Outliers (1.5x IQR)</span>
                    <span className="text-base font-mono font-bold text-amber-400">
                      {profiles[selectedColumnDetails].outlierCount || 0}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Case Variants / Inconsistencies if present */}
            {profiles[selectedColumnDetails].caseVariants && profiles[selectedColumnDetails].caseVariants!.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-2">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Casing Variants Detected
                </span>
                <div className="space-y-1 text-xs text-slate-300">
                  {profiles[selectedColumnDetails].caseVariants!.map((v, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#0B0D11] p-2 rounded-lg border border-[#252A36]">
                      <span>Standard: <strong className="text-emerald-400 font-mono">"{v.standard}"</strong></span>
                      <span className="text-slate-400 font-mono">Variants: [{v.variants.map(varStr => `"${varStr}"`).join(', ')}] ({v.count} rows)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Values or Histogram */}
            {profiles[selectedColumnDetails].topValues && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Top Frequency Distribution</span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {profiles[selectedColumnDetails].topValues!.map(v => (
                    <div key={v.value} className="flex items-center justify-between text-xs bg-[#0B0D11] p-2 rounded-xl border border-[#252A36]">
                      <span className="font-mono text-slate-200 truncate max-w-xs">{v.value || '(Empty String)'}</span>
                      <span className="text-slate-400 font-mono">{v.count.toLocaleString()} rows ({v.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Issues summary for this column */}
            {quality.issues.filter(i => i.column === selectedColumnDetails).length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Identified Observations</span>
                <div className="space-y-1.5">
                  {quality.issues.filter(i => i.column === selectedColumnDetails).map(issue => (
                    <div key={issue.id} className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36] text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono uppercase">
                          {issue.severity}
                        </span>
                        <span className="text-slate-200 font-semibold">{issue.problem}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 pl-1">{issue.evidence}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
