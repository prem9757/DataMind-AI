import React, { useState, useMemo } from 'react';
import {
  Sigma,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  TableProperties,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info,
  Download,
  Percent,
  Sliders,
  Sparkles,
  Layers,
  Scale
} from 'lucide-react';
import { DatasetState, StatisticalTestResult, DetailedDescriptiveStats } from '../types/dataset';
import {
  computeDetailedDescriptiveStats,
  runTwoSampleTTest,
  runOneWayANOVA,
  runChiSquareTest,
  runMannWhitneyUTest
} from '../services/statsEngine';
import { BrainCircuit } from 'lucide-react';

interface StatisticalAnalysisProps {
  dataset: DatasetState;
  onNavigate?: (section: any) => void;
}

export const StatisticalAnalysis: React.FC<StatisticalAnalysisProps> = ({ dataset, onNavigate }) => {
  const { workingRows, columns, profiles } = dataset;

  const numCols = useMemo(() => columns.filter(c => profiles[c]?.type === 'numeric'), [columns, profiles]);
  const catCols = useMemo(() => columns.filter(c => profiles[c]?.type === 'categorical' || profiles[c]?.type === 'boolean'), [columns, profiles]);

  const [activeTab, setActiveTab] = useState<'descriptive' | 'confidence' | 'ttest' | 'anova' | 'chisquare' | 'nonparametric'>('descriptive');

  // Descriptive stats calculations
  const descriptiveStats = useMemo(() => {
    return computeDetailedDescriptiveStats(workingRows, columns, profiles);
  }, [workingRows, columns, profiles]);

  const [selectedDescCols, setSelectedDescCols] = useState<string[]>(numCols.slice(0, 6));
  const [ciLevel, setCiLevel] = useState<'ci90' | 'ci95' | 'ci99'>('ci95');

  // t-test state
  const [tTestGroupCol, setTTestGroupCol] = useState<string>(catCols[0] || '');
  const [tTestGroup1, setTTestGroup1] = useState<string>('');
  const [tTestGroup2, setTTestGroup2] = useState<string>('');
  const [tTestMetricCol, setTTestMetricCol] = useState<string>(numCols[0] || '');
  const [tTestAlpha, setTTestAlpha] = useState<number>(0.05);
  const [bonferroniTestsCount, setBonferroniTestsCount] = useState<number>(1);
  const [tTestResult, setTTestResult] = useState<StatisticalTestResult | null>(null);
  const [tTestError, setTTestError] = useState<string | null>(null);

  // ANOVA state
  const [anovaGroupCol, setAnovaGroupCol] = useState<string>(catCols[0] || '');
  const [anovaMetricCol, setAnovaMetricCol] = useState<string>(numCols[0] || '');
  const [anovaAlpha, setAnovaAlpha] = useState<number>(0.05);
  const [anovaResult, setAnovaResult] = useState<StatisticalTestResult | null>(null);
  const [anovaError, setAnovaError] = useState<string | null>(null);

  // Chi-Square state
  const [chiCol1, setChiCol1] = useState<string>(catCols[0] || '');
  const [chiCol2, setChiCol2] = useState<string>(catCols[1] || catCols[0] || '');
  const [chiAlpha, setChiAlpha] = useState<number>(0.05);
  const [chiResult, setChiResult] = useState<StatisticalTestResult | null>(null);
  const [chiError, setChiError] = useState<string | null>(null);

  // Non-parametric state
  const [npGroupCol, setNpGroupCol] = useState<string>(catCols[0] || '');
  const [npGroup1, setNpGroup1] = useState<string>('');
  const [npGroup2, setNpGroup2] = useState<string>('');
  const [npMetricCol, setNpMetricCol] = useState<string>(numCols[0] || '');
  const [npAlpha, setNpAlpha] = useState<number>(0.05);
  const [npResult, setNpResult] = useState<StatisticalTestResult | null>(null);
  const [npError, setNpError] = useState<string | null>(null);

  const groupOptionsForTTest = useMemo(() => {
    return tTestGroupCol && profiles[tTestGroupCol]?.topValues
      ? profiles[tTestGroupCol].topValues.map(tv => tv.value)
      : [];
  }, [tTestGroupCol, profiles]);

  const groupOptionsForNP = useMemo(() => {
    return npGroupCol && profiles[npGroupCol]?.topValues
      ? profiles[npGroupCol].topValues.map(tv => tv.value)
      : [];
  }, [npGroupCol, profiles]);

  // Adjusted alpha with Bonferroni correction
  const effectiveAlpha = bonferroniTestsCount > 1 ? tTestAlpha / bonferroniTestsCount : tTestAlpha;

  const handleRunTTest = () => {
    setTTestError(null);
    try {
      const g1Name = tTestGroup1 || groupOptionsForTTest[0];
      const g2Name = tTestGroup2 || groupOptionsForTTest[1];

      if (!g1Name || !g2Name || g1Name === g2Name) {
        throw new Error('Please select two distinct comparison groups.');
      }

      const g1Vals = workingRows
        .filter(r => String(r[tTestGroupCol]) === g1Name)
        .map(r => Number(r[tTestMetricCol]));
      const g2Vals = workingRows
        .filter(r => String(r[tTestGroupCol]) === g2Name)
        .map(r => Number(r[tTestMetricCol]));

      const result = runTwoSampleTTest(g1Vals, g2Vals, g1Name, g2Name, tTestMetricCol, effectiveAlpha);
      if (bonferroniTestsCount > 1) {
        result.multipleTestingWarning = `Bonferroni correction applied for ${bonferroniTestsCount} comparisons (Adjusted significance threshold: α = ${(tTestAlpha / bonferroniTestsCount).toFixed(4)}).`;
      }
      setTTestResult(result);
    } catch (err: any) {
      setTTestError(err.message || 'Error running t-test.');
      setTTestResult(null);
    }
  };

  const handleRunANOVA = () => {
    setAnovaError(null);
    try {
      const groups: Record<string, number[]> = {};
      workingRows.forEach(row => {
        const cat = String(row[anovaGroupCol] ?? 'Unknown').trim();
        const metric = Number(row[anovaMetricCol]);
        if (!isNaN(metric) && isFinite(metric)) {
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(metric);
        }
      });

      const result = runOneWayANOVA(groups, anovaGroupCol, anovaMetricCol, anovaAlpha);
      setAnovaResult(result);
    } catch (err: any) {
      setAnovaError(err.message || 'Error running ANOVA.');
      setAnovaResult(null);
    }
  };

  const handleRunChiSquare = () => {
    setChiError(null);
    try {
      if (chiCol1 === chiCol2) {
        throw new Error('Please select two distinct categorical variables for Chi-Square test.');
      }
      const result = runChiSquareTest(workingRows, chiCol1, chiCol2, chiAlpha);
      setChiResult(result);
    } catch (err: any) {
      setChiError(err.message || 'Error running Chi-Square test.');
      setChiResult(null);
    }
  };

  const handleRunMannWhitney = () => {
    setNpError(null);
    try {
      const g1Name = npGroup1 || groupOptionsForNP[0];
      const g2Name = npGroup2 || groupOptionsForNP[1];

      if (!g1Name || !g2Name || g1Name === g2Name) {
        throw new Error('Please select two distinct comparison groups.');
      }

      const g1Vals = workingRows
        .filter(r => String(r[npGroupCol]) === g1Name)
        .map(r => Number(r[npMetricCol]));
      const g2Vals = workingRows
        .filter(r => String(r[npGroupCol]) === g2Name)
        .map(r => Number(r[npMetricCol]));

      const result = runMannWhitneyUTest(g1Vals, g2Vals, g1Name, g2Name, npMetricCol, npAlpha);
      setNpResult(result);
    } catch (err: any) {
      setNpError(err.message || 'Error running Mann-Whitney U test.');
      setNpResult(null);
    }
  };

  const handleDownloadStatsCSV = () => {
    const headers = ['Column', 'Count', 'Mean', 'Median', 'StdDev', 'Variance', 'Min', 'Max', 'IQR', 'Skewness', 'Kurtosis', 'StdError', 'CI_95_Lower', 'CI_95_Upper'];
    const rows = descriptiveStats.map(s => [
      s.column,
      s.count,
      s.mean,
      s.median,
      s.stdDev,
      s.variance,
      s.min,
      s.max,
      s.iqr,
      s.skewness,
      s.kurtosis,
      s.standardError,
      s.ci95[0],
      s.ci95[1]
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${dataset.name}_descriptive_statistics.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#252A36] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">Statistical Analysis</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono font-bold uppercase">
              Hypothesis Testing
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Check whether differences between groups, relationships, and findings are statistically meaningful.
          </p>
        </div>

        {/* Navigation Tabs and Next Action */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#12151C] border border-[#252A36] p-1 rounded-xl shadow-inner overflow-x-auto custom-scrollbar">
            {[
              { id: 'descriptive', label: 'Descriptive Stats' },
              { id: 'confidence', label: 'Confidence Intervals' },
              { id: 'ttest', label: "Two-Sample t-Test" },
              { id: 'anova', label: 'One-Way ANOVA' },
              { id: 'chisquare', label: 'Chi-Square (χ²)' },
              { id: 'nonparametric', label: 'Mann-Whitney U' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate('ml')}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>Try ML Models</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: DESCRIPTIVE STATISTICS TABLE                                  */}
      {/* ==================================================================== */}
      {activeTab === 'descriptive' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#12151C] p-4 rounded-2xl border border-[#252A36]">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <TableProperties className="w-4 h-4 text-amber-400" />
                Comprehensive Variable Statistics
              </h2>
              <p className="text-xs text-slate-400">
                Full moments, dispersion, quantiles, and standard errors for numeric features.
              </p>
            </div>

            <button
              onClick={handleDownloadStatsCSV}
              className="px-3 py-2 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto custom-scrollbar bg-[#12151C] rounded-2xl border border-[#252A36]">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#252A36] text-slate-400 text-[10px] uppercase bg-[#0B0D11]">
                  <th className="p-3 font-semibold">Column</th>
                  <th className="p-3 font-semibold">Count</th>
                  <th className="p-3 font-semibold">Mean</th>
                  <th className="p-3 font-semibold">Median</th>
                  <th className="p-3 font-semibold">Std Dev</th>
                  <th className="p-3 font-semibold">Min</th>
                  <th className="p-3 font-semibold">Max</th>
                  <th className="p-3 font-semibold">IQR</th>
                  <th className="p-3 font-semibold">Skewness</th>
                  <th className="p-3 font-semibold">Kurtosis</th>
                  <th className="p-3 font-semibold">Std Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252A36] text-[11px]">
                {descriptiveStats.map(stat => (
                  <tr key={stat.column} className="hover:bg-[#181D26] transition">
                    <td className="p-3 font-bold text-amber-400">{stat.column}</td>
                    <td className="p-3 text-slate-300">{stat.count.toLocaleString()}</td>
                    <td className="p-3 text-slate-200 font-semibold">{stat.mean.toLocaleString()}</td>
                    <td className="p-3 text-slate-300">{stat.median.toLocaleString()}</td>
                    <td className="p-3 text-slate-300">{stat.stdDev.toLocaleString()}</td>
                    <td className="p-3 text-slate-400">{stat.min.toLocaleString()}</td>
                    <td className="p-3 text-slate-400">{stat.max.toLocaleString()}</td>
                    <td className="p-3 text-slate-300">{stat.iqr.toLocaleString()}</td>
                    <td className="p-3 text-slate-300">{stat.skewness.toFixed(2)}</td>
                    <td className="p-3 text-slate-300">{stat.kurtosis.toFixed(2)}</td>
                    <td className="p-3 text-slate-300 font-semibold">{stat.standardError.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: CONFIDENCE INTERVALS                                          */}
      {/* ==================================================================== */}
      {activeTab === 'confidence' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#12151C] p-4 rounded-2xl border border-[#252A36]">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-400" />
                Population Mean Confidence Intervals
              </h2>
              <p className="text-xs text-slate-400">
                Parametric bounds for the true population mean based on sample standard errors.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-[#0B0D11] p-1 rounded-xl border border-[#252A36]">
              {(['ci90', 'ci95', 'ci99'] as const).map(level => (
                <button
                  key={level}
                  onClick={() => setCiLevel(level)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    ciLevel === level
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {level === 'ci90' ? '90% CI' : level === 'ci95' ? '95% CI' : '99% CI'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {descriptiveStats.map(stat => {
              const bounds = stat[ciLevel];
              const margin = Math.round((bounds[1] - stat.mean) * 100) / 100;
              return (
                <div key={stat.column} className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100">{stat.column}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-semibold">
                      {ciLevel === 'ci90' ? 'Z = 1.645' : ciLevel === 'ci95' ? 'Z = 1.960' : 'Z = 2.576'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Point Estimate (Sample Mean)</span>
                    <p className="text-base font-bold text-amber-400 font-mono">{stat.mean.toLocaleString()}</p>
                  </div>

                  <div className="p-3 bg-[#0B0D11] rounded-xl border border-[#252A36] space-y-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Lower Bound:</span>
                      <span className="text-slate-200 font-bold">{bounds[0].toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Upper Bound:</span>
                      <span className="text-slate-200 font-bold">{bounds[1].toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono border-t border-[#252A36] pt-1">
                      <span className="text-slate-400">Margin of Error (±):</span>
                      <span className="text-amber-400 font-bold">±{margin.toLocaleString()}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    We are {ciLevel === 'ci90' ? '90%' : ciLevel === 'ci95' ? '95%' : '99%'} confident that the true population mean of <strong>{stat.column}</strong> lies between <strong>{bounds[0].toLocaleString()}</strong> and <strong>{bounds[1].toLocaleString()}</strong>.
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: TWO-SAMPLE WELCH'S T-TEST                                     */}
      {/* ==================================================================== */}
      {activeTab === 'ttest' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              Two-Sample t-Test Setup
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Grouping Dimension</label>
              <select
                value={tTestGroupCol}
                onChange={e => {
                  setTTestGroupCol(e.target.value);
                  setTTestGroup1('');
                  setTTestGroup2('');
                }}
                className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {catCols.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Group 1</label>
                <select
                  value={tTestGroup1 || groupOptionsForTTest[0] || ''}
                  onChange={e => setTTestGroup1(e.target.value)}
                  className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {groupOptionsForTTest.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Group 2</label>
                <select
                  value={tTestGroup2 || groupOptionsForTTest[1] || ''}
                  onChange={e => setTTestGroup2(e.target.value)}
                  className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {groupOptionsForTTest.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Continuous Metric</label>
              <select
                value={tTestMetricCol}
                onChange={e => setTTestMetricCol(e.target.value)}
                className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {numCols.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Alpha (α)</label>
                <select
                  value={tTestAlpha}
                  onChange={e => setTTestAlpha(Number(e.target.value))}
                  className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value={0.01}>0.01 (99% Conf)</option>
                  <option value={0.05}>0.05 (95% Conf)</option>
                  <option value={0.10}>0.10 (90% Conf)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Bonferroni m Tests</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={bonferroniTestsCount}
                  onChange={e => setBonferroniTestsCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {bonferroniTestsCount > 1 && (
              <p className="text-[10px] text-amber-400 font-mono">
                Bonferroni adjusted α threshold: <strong>{(tTestAlpha / bonferroniTestsCount).toFixed(4)}</strong>
              </p>
            )}

            <button
              onClick={handleRunTTest}
              className="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <span>Execute Welch's t-Test</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {tTestError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
                {tTestError}
              </div>
            )}
          </div>

          {/* Test Results Display */}
          <div className="lg:col-span-2 space-y-4">
            {tTestResult ? (
              <RenderTestResult result={tTestResult} />
            ) : (
              <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-12 text-center text-slate-400 space-y-2">
                <Sigma className="w-8 h-8 text-amber-400 mx-auto opacity-60" />
                <h3 className="text-sm font-bold text-slate-200">No Hypothesis Test Executed</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Configure comparison groups on the left and click "Execute Welch's t-Test" to inspect significance, effect size, and assumptions.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: ONE-WAY ANOVA                                                 */}
      {/* ==================================================================== */}
      {activeTab === 'anova' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              One-Way ANOVA Setup
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Multi-Level Factor (Group)</label>
              <select
                value={anovaGroupCol}
                onChange={e => setAnovaGroupCol(e.target.value)}
                className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {catCols.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Dependent Metric</label>
              <select
                value={anovaMetricCol}
                onChange={e => setAnovaMetricCol(e.target.value)}
                className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {numCols.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Significance Level (α)</label>
              <select
                value={anovaAlpha}
                onChange={e => setAnovaAlpha(Number(e.target.value))}
                className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value={0.01}>0.01 (99% Conf)</option>
                <option value={0.05}>0.05 (95% Conf)</option>
                <option value={0.10}>0.10 (90% Conf)</option>
              </select>
            </div>

            <button
              onClick={handleRunANOVA}
              className="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <span>Execute One-Way ANOVA</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {anovaError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
                {anovaError}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {anovaResult ? (
              <RenderTestResult result={anovaResult} />
            ) : (
              <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-12 text-center text-slate-400 space-y-2">
                <Sigma className="w-8 h-8 text-amber-400 mx-auto opacity-60" />
                <h3 className="text-sm font-bold text-slate-200">No ANOVA Executed</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Select a categorical grouping factor and a continuous metric to test whether any group means differ significantly.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: CHI-SQUARE TEST OF INDEPENDENCE                               */}
      {/* ==================================================================== */}
      {activeTab === 'chisquare' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Percent className="w-4 h-4 text-amber-400" />
              Chi-Square Test (χ²) Setup
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Categorical Variable 1</label>
              <select
                value={chiCol1}
                onChange={e => setChiCol1(e.target.value)}
                className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {catCols.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Categorical Variable 2</label>
              <select
                value={chiCol2}
                onChange={e => setChiCol2(e.target.value)}
                className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {catCols.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Significance Level (α)</label>
              <select
                value={chiAlpha}
                onChange={e => setChiAlpha(Number(e.target.value))}
                className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value={0.01}>0.01 (99% Conf)</option>
                <option value={0.05}>0.05 (95% Conf)</option>
                <option value={0.10}>0.10 (90% Conf)</option>
              </select>
            </div>

            <button
              onClick={handleRunChiSquare}
              className="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <span>Execute Chi-Square Test</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {chiError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
                {chiError}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {chiResult ? (
              <RenderTestResult result={chiResult} />
            ) : (
              <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-12 text-center text-slate-400 space-y-2">
                <Percent className="w-8 h-8 text-amber-400 mx-auto opacity-60" />
                <h3 className="text-sm font-bold text-slate-200">No Chi-Square Test Executed</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Select two categorical dimensions to evaluate independence and compute Cramér's V association strength.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 6: NON-PARAMETRIC MANN-WHITNEY U TEST                            */}
      {/* ==================================================================== */}
      {activeTab === 'nonparametric' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Mann-Whitney U Setup
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Grouping Dimension</label>
              <select
                value={npGroupCol}
                onChange={e => {
                  setNpGroupCol(e.target.value);
                  setNpGroup1('');
                  setNpGroup2('');
                }}
                className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {catCols.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Group 1</label>
                <select
                  value={npGroup1 || groupOptionsForNP[0] || ''}
                  onChange={e => setNpGroup1(e.target.value)}
                  className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {groupOptionsForNP.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Group 2</label>
                <select
                  value={npGroup2 || groupOptionsForNP[1] || ''}
                  onChange={e => setNpGroup2(e.target.value)}
                  className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {groupOptionsForNP.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Ordinal / Skewed Metric</label>
              <select
                value={npMetricCol}
                onChange={e => setNpMetricCol(e.target.value)}
                className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {numCols.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Significance Level (α)</label>
              <select
                value={npAlpha}
                onChange={e => setNpAlpha(Number(e.target.value))}
                className="w-full bg-[#0B0D11] border border-[#252A36] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value={0.01}>0.01 (99% Conf)</option>
                <option value={0.05}>0.05 (95% Conf)</option>
                <option value={0.10}>0.10 (90% Conf)</option>
              </select>
            </div>

            <button
              onClick={handleRunMannWhitney}
              className="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <span>Execute Mann-Whitney U Test</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {npError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
                {npError}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {npResult ? (
              <RenderTestResult result={npResult} />
            ) : (
              <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-12 text-center text-slate-400 space-y-2">
                <ShieldCheck className="w-8 h-8 text-amber-400 mx-auto opacity-60" />
                <h3 className="text-sm font-bold text-slate-200">No Non-Parametric Test Executed</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Use the Mann-Whitney U test when distributions violate Gaussian normality or contain severe outlier skew.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for rendering full statistical test results
function RenderTestResult({ result }: { result: StatisticalTestResult }) {
  return (
    <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-6 space-y-6 shadow-xl">
      {/* Header Badge & Decision */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#252A36] pb-4">
        <div>
          <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block">
            {result.testName}
          </span>
          <h3 className="text-base font-bold text-slate-100 mt-0.5">
            {result.isSignificant ? 'Statistically Significant Difference' : 'Null Hypothesis Retained (Fail to Reject)'}
          </h3>
        </div>

        <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold font-mono flex items-center gap-1.5 ${
          result.isSignificant
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            : 'bg-slate-800 text-slate-300 border-slate-700'
        }`}>
          {result.isSignificant ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{result.isSignificant ? `p < ${result.significanceLevel} (Significant)` : `p ≥ ${result.significanceLevel} (Inconclusive)`}</span>
        </div>
      </div>

      {/* Multiple testing warning */}
      {result.multipleTestingWarning && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{result.multipleTestingWarning}</span>
        </div>
      )}

      {/* Key Metric Numbers Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0B0D11] border border-[#252A36] rounded-xl p-3 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">{result.statisticName}</span>
          <p className="text-sm font-bold text-amber-400 font-mono">{result.statisticValue}</p>
        </div>

        <div className="bg-[#0B0D11] border border-[#252A36] rounded-xl p-3 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">p-Value</span>
          <p className="text-sm font-bold text-slate-100 font-mono">
            {result.pValue < 0.0001 ? '< 0.0001' : result.pValue.toFixed(4)}
          </p>
        </div>

        {result.degreesOfFreedom !== undefined && (
          <div className="bg-[#0B0D11] border border-[#252A36] rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Deg. of Freedom (df)</span>
            <p className="text-sm font-bold text-slate-200 font-mono">{result.degreesOfFreedom}</p>
          </div>
        )}

        {result.effectSize && (
          <div className="bg-[#0B0D11] border border-[#252A36] rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">{result.effectSize.name}</span>
            <p className="text-sm font-bold text-emerald-400 font-mono">
              {result.effectSize.value} <span className="text-[10px] text-slate-400">({result.effectSize.interpretation})</span>
            </p>
          </div>
        )}
      </div>

      {/* Formal Hypotheses */}
      <div className="bg-[#0B0D11] rounded-xl p-4 border border-[#252A36] space-y-2 text-xs">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
          Tested Hypotheses:
        </span>
        <p><strong className="text-slate-400 font-mono">H₀ (Null):</strong> <span className="text-slate-300">{result.hypothesis.nullHypothesis}</span></p>
        <p><strong className="text-slate-400 font-mono">H₁ (Alternative):</strong> <span className="text-slate-300">{result.hypothesis.alternativeHypothesis}</span></p>
      </div>

      {/* Assumptions Check Cards */}
      {result.assumptions && result.assumptions.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
            Statistical Assumption Checks:
          </span>
          <div className="space-y-2">
            {result.assumptions.map((check, idx) => (
              <div
                key={idx}
                className="p-3 bg-[#0B0D11] rounded-xl border border-[#252A36] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">{check.assumption}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                      check.status === 'PASSED'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : check.status === 'WARNING'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}>
                      {check.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{check.evidence}</p>
                </div>
                <span className="text-[10px] text-slate-400 italic shrink-0">
                  {check.recommendation}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contingency / Group Summary Table */}
      {result.tableData && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
            Group Breakdown &amp; Cell Statistics:
          </span>
          <div className="overflow-x-auto custom-scrollbar bg-[#0B0D11] rounded-xl border border-[#252A36] p-3">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#252A36] text-slate-400 text-[10px] uppercase">
                  {result.tableData.headers.map((h: string, idx: number) => (
                    <th key={idx} className="p-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252A36] text-[11px]">
                {result.tableData.rows.map((row: any[], rIdx: number) => (
                  <tr key={rIdx} className="hover:bg-[#181D26] transition">
                    {row.map((cell: any, cIdx: number) => (
                      <td key={cIdx} className="p-2 text-slate-300">
                        {typeof cell === 'number' ? cell.toLocaleString() : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scientific & Business Interpretations */}
      <div className="space-y-3 pt-1">
        <div className="p-3.5 bg-[#0B0D11] rounded-xl border border-[#252A36] text-xs space-y-1">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block font-mono">
            Analytical Interpretation:
          </span>
          <p className="text-slate-300 leading-relaxed">{result.interpretation}</p>
        </div>

        <div className="p-3.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs space-y-1">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block font-mono flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Strategic Business Meaning:
          </span>
          <p className="text-slate-200 leading-relaxed">{result.businessMeaning}</p>
        </div>
      </div>
    </div>
  );
}
