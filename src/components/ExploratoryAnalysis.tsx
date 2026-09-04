import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  BarChart3,
  TrendingUp,
  Activity,
  Layers,
  Search,
  Grid,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  FileText,
  Clock,
  Compass,
  DollarSign,
  PieChart as PieIcon,
  ScatterChart as ScatterIcon,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  CheckCircle2,
  Table as TableIcon,
  ArrowRight
} from 'lucide-react';
import {
  DatasetState,
  ChartType,
  ColumnProfile,
  BusinessKPI,
  DatasetInsight
} from '../types/dataset';
import { ChartViewer } from './ChartViewer';
import {
  detectBusinessKPIs,
  computeCorrelationMatrix,
  computeGroupSummary,
  computeCrossTabulation,
  computeTimeSeriesAnalysis,
  computeTopBottomRankings,
  computeSegmentAnalysis,
  extractAnomalies,
  parseNaturalLanguageChartQuery,
  generateAutomatedEDAInsights,
  generateSmartEDARecommendations
} from '../services/edaEngine';
import { classifyAllColumns } from '../services/columnIntelligence';

interface ExploratoryAnalysisProps {
  dataset: DatasetState;
  onNavigateToVisualizations?: () => void;
  onNavigate?: (section: any) => void;
}

type EDATab =
  | 'overview'
  | 'univariate'
  | 'bivariate'
  | 'correlation'
  | 'timeseries'
  | 'segments'
  | 'anomalies'
  | 'nl_chart';

export const ExploratoryAnalysis: React.FC<ExploratoryAnalysisProps> = ({
  dataset,
  onNavigateToVisualizations,
  onNavigate
}) => {
  const { workingRows, columns, profiles } = dataset;
  const [activeTab, setActiveTab] = useState<EDATab>('overview');

  // Intelligent Classifications
  const classifications = useMemo(() => {
    return classifyAllColumns(columns, profiles, workingRows.length);
  }, [columns, profiles, workingRows.length]);

  // Derived KPIs
  const kpis: BusinessKPI[] = useMemo(() => {
    return detectBusinessKPIs(workingRows, columns, profiles, classifications);
  }, [workingRows, columns, profiles, classifications]);

  // AI EDA Insights & Summary
  const { insights, edaSummary } = useMemo(() => {
    return generateAutomatedEDAInsights(workingRows, columns, profiles, classifications);
  }, [workingRows, columns, profiles, classifications]);

  // Recommended Visual Analyses
  const recommendedCharts = useMemo(() => {
    return generateSmartEDARecommendations(columns, profiles);
  }, [columns, profiles]);

  const numCols = columns.filter(c => profiles[c]?.type === 'numeric');
  const catCols = columns.filter(c => profiles[c]?.type === 'categorical' || profiles[c]?.type === 'text');
  const dateCols = columns.filter(c => profiles[c]?.type === 'datetime');

  // Univariate State
  const [selectedUniCol, setSelectedUniCol] = useState<string>(numCols[0] || columns[0]);

  // Bivariate State
  const initialBiCol1 = numCols.length >= 2 ? numCols[0] : (catCols[0] || columns[0]);
  const initialBiCol2 = numCols.length >= 2 ? numCols[1] : (numCols[0] || columns[1]);
  const [biCol1, setBiCol1] = useState<string>(initialBiCol1);
  const [biCol2, setBiCol2] = useState<string>(initialBiCol2);
  const [biAggregation, setBiAggregation] = useState<'none' | 'sum' | 'mean' | 'median' | 'count'>('none');

  // Bivariate Scatter & Correlation
  const scatterCorrelation = useMemo(() => {
    if (profiles[biCol1]?.type !== 'numeric' || profiles[biCol2]?.type !== 'numeric') return null;
    const xVals: number[] = [];
    const yVals: number[] = [];
    for (const r of workingRows) {
      const x = Number(r[biCol1]);
      const y = Number(r[biCol2]);
      if (!isNaN(x) && isFinite(x) && !isNaN(y) && isFinite(y)) {
        xVals.push(x);
        yVals.push(y);
      }
    }
    if (xVals.length < 3) return null;
    try {
      const n = xVals.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
      for (let i = 0; i < n; i++) {
        sumX += xVals[i];
        sumY += yVals[i];
        sumXY += xVals[i] * yVals[i];
        sumX2 += xVals[i] * xVals[i];
        sumY2 += yVals[i] * yVals[i];
      }
      const num = n * sumXY - sumX * sumY;
      const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      if (den === 0) return 0;
      return num / den;
    } catch {
      return null;
    }
  }, [workingRows, biCol1, biCol2, profiles]);

  const scatterData = useMemo(() => {
    if (!biCol1 || !biCol2) return [];
    const isXNum = profiles[biCol1]?.type === 'numeric';
    const pts: any[] = [];
    for (let i = 0; i < workingRows.length && pts.length < 1000; i++) {
      const r = workingRows[i];
      const val1 = r[biCol1];
      const val2 = r[biCol2];
      if (val1 === null || val1 === undefined || val1 === '' || val2 === null || val2 === undefined || val2 === '') continue;
      const num2 = Number(val2);
      if (isNaN(num2) || !isFinite(num2)) continue;
      if (isXNum) {
        const num1 = Number(val1);
        if (isNaN(num1) || !isFinite(num1)) continue;
        pts.push({
          x: num1,
          y: num2,
          label: `Obs #${i + 1}`,
          [biCol1]: num1,
          [biCol2]: num2
        });
      } else {
        pts.push({
          x: String(val1),
          y: num2,
          label: `Obs #${i + 1}`,
          [biCol1]: String(val1),
          [biCol2]: num2
        });
      }
    }
    return pts;
  }, [workingRows, biCol1, biCol2, profiles]);

  // Correlation Matrix State
  const [corrMethod, setCorrMethod] = useState<'pearson' | 'spearman'>('pearson');

  // Time-Series State
  const [tsDateCol, setTsDateCol] = useState<string>(dateCols[0] || columns[0]);
  const [tsMetricCol, setTsMetricCol] = useState<string>(numCols[0] || columns[1]);

  // Top/Bottom State
  const [rankingDim, setRankingDim] = useState<string>(catCols[0] || columns[0]);
  const [rankingMetric, setRankingMetric] = useState<string>(numCols[0] || columns[1]);
  const [rankingTopN, setRankingTopN] = useState<number>(10);

  // Natural Language Chart State
  const [nlQuery, setNlQuery] = useState<string>('');
  const [nlResponse, setNlResponse] = useState<any>(null);
  const [isNlSearching, setIsNlSearching] = useState<boolean>(false);

  // Collapsible insights
  const [showAllInsights, setShowAllInsights] = useState<boolean>(false);

  // Handlers
  const handleNlGenerate = (queryText: string) => {
    if (!queryText.trim()) return;
    setIsNlSearching(true);
    setTimeout(() => {
      const resp = parseNaturalLanguageChartQuery(queryText, dataset);
      setNlResponse(resp);
      setIsNlSearching(false);
    }, 150);
  };

  // Correlation Matrix Data
  const correlationData = useMemo(() => {
    if (numCols.length < 2) return null;
    return computeCorrelationMatrix(workingRows, numCols, corrMethod);
  }, [workingRows, numCols, corrMethod]);

  // Time-Series Data
  const timeSeriesData = useMemo(() => {
    if (!tsDateCol || !tsMetricCol || dateCols.length === 0) return null;
    return computeTimeSeriesAnalysis(workingRows, tsDateCol, tsMetricCol);
  }, [workingRows, tsDateCol, tsMetricCol, dateCols]);

  // Top/Bottom Data
  const rankingData = useMemo(() => {
    if (!rankingDim || !rankingMetric) return null;
    return computeTopBottomRankings(workingRows, rankingDim, rankingMetric, rankingTopN);
  }, [workingRows, rankingDim, rankingMetric, rankingTopN]);

  // Segment Data
  const segmentData = useMemo(() => {
    if (!rankingDim || !rankingMetric) return null;
    return computeSegmentAnalysis(workingRows, rankingDim, rankingMetric);
  }, [workingRows, rankingDim, rankingMetric]);

  // Anomalies
  const anomalies = useMemo(() => {
    return extractAnomalies(workingRows, columns, profiles);
  }, [workingRows, columns, profiles]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#252A36] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              Automated Exploratory Data Analysis
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {workingRows.length.toLocaleString()} records
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Understand key distributions, correlations, time trends, and segment breakdowns automatically.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#12151C] hover:bg-[#181D26] text-slate-300 border border-[#2D3342] flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" /> Export Summary
          </button>

          {(onNavigateToVisualizations || onNavigate) && (
            <button
              onClick={() => {
                if (onNavigateToVisualizations) onNavigateToVisualizations();
                else if (onNavigate) onNavigate('visualizations');
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Data Visualization</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
            </button>
          )}
        </div>
      </div>

      {/* 1. BUSINESS KPI DASHBOARD */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {kpis.map(kpi => (
            <div
              key={kpi.id}
              className="bg-[#12151C] border border-[#252A36] rounded-2xl p-4 flex flex-col justify-between hover:border-amber-500/30 transition shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 truncate max-w-[120px]">
                  {kpi.title}
                </span>
                {kpi.format === 'currency' ? (
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                ) : kpi.format === 'percentage' ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                )}
              </div>
              <div className="my-2">
                <span className="text-xl font-bold font-mono text-slate-100 tracking-tight">
                  {kpi.value}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 truncate" title={kpi.formulaDescription}>
                {kpi.columnSource}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EDA Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-[#252A36] overflow-x-auto custom-scrollbar pb-1">
        {[
          { id: 'overview', label: 'Executive Summary', icon: Sparkles },
          { id: 'nl_chart', label: 'Ask in Plain English', icon: Compass },
          { id: 'univariate', label: 'Distributions', icon: BarChart3 },
          { id: 'bivariate', label: 'Relationships', icon: Layers },
          { id: 'correlation', label: 'Correlations', icon: Grid },
          { id: 'timeseries', label: 'Time Trends', icon: Clock },
          { id: 'segments', label: 'Rankings & Segments', icon: ArrowUpDown },
          { id: 'anomalies', label: 'Anomalies & Outliers', icon: AlertTriangle },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as EDATab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-2 transition cursor-pointer ${
                isActive
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#12151C]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: AI EXECUTIVE SUMMARY & RECOMMENDED VISUAL ANALYSES */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Executive Insights Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Top Priority Automated EDA Insights
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {insights.length} mathematical findings generated
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(showAllInsights ? insights : insights.slice(0, 4)).map(ins => {
                const isWarning = ins.impact === 'WARNING' || ins.impact === 'NEGATIVE';
                return (
                  <div
                    key={ins.id}
                    className="bg-[#12151C] border border-[#252A36] hover:border-amber-500/30 rounded-2xl p-4 space-y-2.5 transition shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            isWarning
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {ins.category}
                        </span>
                        <span className="text-[10px] font-mono text-amber-400 font-semibold">
                          Confidence: {ins.confidence}%
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-100">{ins.title}</h4>
                      <p className="text-xs text-slate-300 mt-1">{ins.description}</p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-[#252A36]">
                      <div className="text-[11px] text-slate-400">
                        <strong className="text-slate-300 font-medium">Mathematical Evidence: </strong>
                        <span className="font-mono text-amber-300/90">{ins.evidence}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        <strong className="text-slate-300 font-medium">Business Impact: </strong>
                        <span>{ins.businessInterpretation}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {insights.length > 4 && (
              <div className="text-center pt-1">
                <button
                  onClick={() => setShowAllInsights(!showAllInsights)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#12151C] hover:bg-[#181D26] text-amber-400 border border-[#2D3342] inline-flex items-center gap-1.5 transition"
                >
                  {showAllInsights ? (
                    <>
                      Show Top Insights Only <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      View All {insights.length} Analytical Insights <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Recommended Visual Analyses Grid */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Automated Visual Explorations
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Multi-dimensional perspectives synthesized automatically
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {recommendedCharts.map(rec => {
                let chartData: any[] = [];
                if (rec.type === 'line' && rec.xAxis && rec.yAxis) {
                  const ts = computeTimeSeriesAnalysis(workingRows, rec.xAxis, rec.yAxis);
                  chartData = ts.trendPoints.map(p => ({
                    [rec.xAxis!]: p.period,
                    [rec.yAxis!]: p.value,
                    'Moving Avg': p.movingAverage
                  }));
                } else if (rec.type === 'scatter' && rec.xAxis && rec.yAxis) {
                  chartData = workingRows.slice(0, 150).map(r => ({
                    x: Number(r[rec.xAxis!]) || 0,
                    y: Number(r[rec.yAxis!]) || 0
                  }));
                } else if (rec.type === 'histogram' && rec.xAxis) {
                  const prof = profiles[rec.xAxis];
                  chartData = prof?.histogram ? prof.histogram.map(h => ({ [rec.xAxis!]: h.bin, Count: h.count })) : [];
                } else if (rec.xAxis && rec.yAxis) {
                  const sumData = computeGroupSummary(workingRows, rec.xAxis, rec.yAxis, rec.aggregation || 'sum');
                  chartData = sumData.slice(0, 10).map(s => ({
                    [rec.xAxis!]: s.category,
                    [rec.yAxis!]: s.sum,
                    'Average': s.mean
                  }));
                }

                return (
                  <ChartViewer
                    key={rec.id}
                    type={rec.type}
                    title={rec.title}
                    data={chartData}
                    xAxisKey={rec.xAxis}
                    yAxisKey={rec.type === 'scatter' ? undefined : (rec.yAxis || 'Value')}
                    xAxisLabel={rec.xAxis}
                    yAxisLabel={rec.yAxis}
                    height={300}
                    description={rec.description}
                    explanation={rec.explanation}
                  />
                );
              })}
            </div>
          </div>

          {/* Next Best Actions */}
          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Next Best Actions
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Proceed to deeper analysis, statistical validation, or executive dashboard creation.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => {
                  if (onNavigateToVisualizations) onNavigateToVisualizations();
                  else if (onNavigate) onNavigate('visualizations');
                }}
                className="p-3 bg-[#0B0D11] border border-[#252A36] hover:border-amber-500/40 rounded-xl text-left transition group cursor-pointer"
              >
                <div className="flex items-center justify-between text-slate-200 font-bold text-xs group-hover:text-amber-400">
                  <span>Data Visualization</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Design custom multi-series charts, scatter plots, and distributions.
                </p>
              </button>

              <button
                onClick={() => onNavigate && onNavigate('dashboard')}
                className="p-3 bg-[#0B0D11] border border-[#252A36] hover:border-amber-500/40 rounded-xl text-left transition group cursor-pointer"
              >
                <div className="flex items-center justify-between text-slate-200 font-bold text-xs group-hover:text-amber-400">
                  <span>Executive Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Assemble high-level KPIs and synthesized business takeaways.
                </p>
              </button>

              <button
                onClick={() => onNavigate && onNavigate('ml')}
                className="p-3 bg-[#0B0D11] border border-[#252A36] hover:border-amber-500/40 rounded-xl text-left transition group cursor-pointer"
              >
                <div className="flex items-center justify-between text-slate-200 font-bold text-xs group-hover:text-amber-400">
                  <span>Machine Learning</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Run predictive regressions, classification, or clustering models.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: NATURAL LANGUAGE VISUALIZER */}
      {/* ========================================================================= */}
      {activeTab === 'nl_chart' && (
        <div className="space-y-6">
          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-6 space-y-4 shadow-xl">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400" />
                Natural Language Chart Generator
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Ask in plain English for any aggregation, correlation, or visualization. The engine calculates the exact
                underlying values without guessing.
              </p>
            </div>

            {/* Search Input Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={nlQuery}
                  onChange={e => setNlQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleNlGenerate(nlQuery);
                  }}
                  placeholder="e.g., 'Compare sales by region', 'Show monthly profit trend', 'Histogram of salaries', 'Top 5 products by revenue'..."
                  className="w-full bg-[#0B0D11] border border-[#252A36] focus:border-amber-500/60 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition"
                />
              </div>
              <button
                onClick={() => handleNlGenerate(nlQuery)}
                disabled={isNlSearching || !nlQuery.trim()}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 flex items-center gap-1.5 transition shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isNlSearching ? 'Calculating...' : 'Generate Chart'}
              </button>
            </div>

            {/* Quick Prompt Suggestions */}
            <div className="flex items-center flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mr-1">
                Try prompts:
              </span>
              {[
                catCols[0] && numCols[0] ? `Compare ${numCols[0]} across ${catCols[0]}` : null,
                dateCols[0] && numCols[0] ? `Show monthly trend of ${numCols[0]}` : null,
                numCols.length >= 2 ? `Scatter plot ${numCols[0]} vs ${numCols[1]}` : null,
                numCols[0] ? `Frequency distribution of ${numCols[0]}` : null,
                catCols[0] && numCols[0] ? `Top 5 ${catCols[0]} by ${numCols[0]}` : null,
              ]
                .filter(Boolean)
                .map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setNlQuery(prompt as string);
                      handleNlGenerate(prompt as string);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] bg-[#181D26] hover:bg-[#202733] text-slate-300 border border-[#2D3342] transition truncate max-w-xs"
                  >
                    "{prompt}"
                  </button>
                ))}
            </div>
          </div>

          {/* Generated Result */}
          {nlResponse && (
            <div className="space-y-4">
              <div className="bg-[#12151C] border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase text-amber-400">
                    Query Interpretation
                  </span>
                  <p className="text-xs text-slate-200 mt-0.5 font-medium">
                    {nlResponse.understoodIntent}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  {nlResponse.chartConfig.type.toUpperCase()}
                </span>
              </div>

              <ChartViewer
                type={nlResponse.chartConfig.type}
                title={nlResponse.chartConfig.title}
                data={nlResponse.chartData}
                xAxisKey={nlResponse.chartConfig.xAxis}
                yAxisKey={nlResponse.chartConfig.type === 'scatter' ? undefined : nlResponse.chartConfig.yAxis}
                xAxisLabel={nlResponse.xAxisLabel}
                yAxisLabel={nlResponse.yAxisLabel}
                height={380}
                description={nlResponse.chartConfig.description}
                explanation={nlResponse.analyticalExplanation}
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: UNIVARIATE DEEP DIVE */}
      {/* ========================================================================= */}
      {activeTab === 'univariate' && (
        <div className="space-y-6">
          {/* Column Selector */}
          <div className="flex items-center gap-3 bg-[#12151C] border border-[#252A36] rounded-2xl p-4">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Select Target Column:
            </span>
            <select
              value={selectedUniCol}
              onChange={e => setSelectedUniCol(e.target.value)}
              className="bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-amber-500"
            >
              {columns.map(col => (
                <option key={col} value={col}>
                  {col} — ({profiles[col]?.type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {profiles[selectedUniCol] && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 4 Cols: Statistical Five-Number & Summary Card */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">
                        {profiles[selectedUniCol].type} Variable
                      </span>
                      <h3 className="text-base font-bold text-slate-100">{selectedUniCol}</h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#181D26] text-slate-300 border border-[#2D3342]">
                      {profiles[selectedUniCol].totalCount} rows
                    </span>
                  </div>

                  {profiles[selectedUniCol].type === 'numeric' ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36]">
                          <span className="text-[10px] text-slate-400 font-mono uppercase">Mean</span>
                          <p className="text-sm font-bold font-mono text-slate-100 mt-0.5">
                            {profiles[selectedUniCol].mean?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36]">
                          <span className="text-[10px] text-slate-400 font-mono uppercase">Median (Q2)</span>
                          <p className="text-sm font-bold font-mono text-slate-100 mt-0.5">
                            {profiles[selectedUniCol].median?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36]">
                          <span className="text-[10px] text-slate-400 font-mono uppercase">Std Dev (σ)</span>
                          <p className="text-sm font-bold font-mono text-slate-100 mt-0.5">
                            {profiles[selectedUniCol].stdDev?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36]">
                          <span className="text-[10px] text-slate-400 font-mono uppercase">Variance (σ²)</span>
                          <p className="text-sm font-bold font-mono text-slate-100 mt-0.5">
                            {profiles[selectedUniCol].variance?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      {/* Boxplot Five Number Summary */}
                      <div className="bg-[#0B0D11] p-3.5 rounded-xl border border-[#252A36] space-y-2">
                        <span className="text-[10px] text-amber-400 font-mono uppercase font-bold tracking-wider">
                          Five-Number Summary (Tukey)
                        </span>
                        <div className="grid grid-cols-5 gap-1.5 text-center font-mono">
                          <div className="bg-[#12151C] p-2 rounded-lg border border-[#252A36]">
                            <span className="text-[9px] text-slate-400 block">MIN</span>
                            <span className="text-xs font-bold text-slate-200">
                              {profiles[selectedUniCol].min}
                            </span>
                          </div>
                          <div className="bg-[#12151C] p-2 rounded-lg border border-[#252A36]">
                            <span className="text-[9px] text-slate-400 block">Q1 (25%)</span>
                            <span className="text-xs font-bold text-slate-200">
                              {profiles[selectedUniCol].q1}
                            </span>
                          </div>
                          <div className="bg-[#12151C] p-2 rounded-lg border border-[#252A36]">
                            <span className="text-[9px] text-slate-400 block">MEDIAN</span>
                            <span className="text-xs font-bold text-amber-300">
                              {profiles[selectedUniCol].median}
                            </span>
                          </div>
                          <div className="bg-[#12151C] p-2 rounded-lg border border-[#252A36]">
                            <span className="text-[9px] text-slate-400 block">Q3 (75%)</span>
                            <span className="text-xs font-bold text-slate-200">
                              {profiles[selectedUniCol].q3}
                            </span>
                          </div>
                          <div className="bg-[#12151C] p-2 rounded-lg border border-[#252A36]">
                            <span className="text-[9px] text-slate-400 block">MAX</span>
                            <span className="text-xs font-bold text-slate-200">
                              {profiles[selectedUniCol].max}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 font-mono">
                          <span>IQR: {profiles[selectedUniCol].iqr}</span>
                          <span>Skewness: {profiles[selectedUniCol].skewness?.toFixed(2)}</span>
                          <span>Outliers: {profiles[selectedUniCol].outlierCount || 0}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Categorical Frequency Distribution Table */
                    <div className="space-y-2">
                      <span className="text-[10px] text-amber-400 font-mono uppercase font-bold">
                        Top Categories & Pareto Contribution
                      </span>
                      <div className="divide-y divide-[#252A36] max-h-60 overflow-y-auto custom-scrollbar font-mono text-xs">
                        {(profiles[selectedUniCol].topValues || []).map((tv, idx) => (
                          <div key={idx} className="py-1.5 flex items-center justify-between">
                            <span className="text-slate-300 truncate max-w-[150px]">{tv.value}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">{tv.count.toLocaleString()}</span>
                              <span className="text-amber-400 font-bold">{tv.percentage}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right 7 Cols: Distribution Chart */}
              <div className="lg:col-span-7">
                {profiles[selectedUniCol].type === 'numeric' && profiles[selectedUniCol].histogram ? (
                  <ChartViewer
                    type="histogram"
                    title={`Histogram Distribution: ${selectedUniCol}`}
                    data={profiles[selectedUniCol].histogram!.map(h => ({
                      [selectedUniCol]: h.bin,
                      Count: h.count
                    }))}
                    xAxisKey={selectedUniCol}
                    yAxisKey="Count"
                    xAxisLabel={`Interval Bins (${selectedUniCol})`}
                    yAxisLabel="Frequency Count"
                    height={380}
                    description={`Histogram showing density shape, clustering, and outlier tails across ${profiles[selectedUniCol].totalCount} records.`}
                    explanation={`Skewness index is ${profiles[selectedUniCol].skewness?.toFixed(2)}. ${
                      profiles[selectedUniCol].outlierCount || 0
                    } extreme observations fall outside 1.5× IQR.`}
                  />
                ) : (
                  <ChartViewer
                    type="bar"
                    title={`Category Distribution: ${selectedUniCol}`}
                    data={(profiles[selectedUniCol].topValues || []).map(tv => ({
                      [selectedUniCol]: tv.value,
                      Count: tv.count,
                      'Share %': tv.percentage
                    }))}
                    xAxisKey={selectedUniCol}
                    yAxisKey="Count"
                    xAxisLabel={selectedUniCol}
                    yAxisLabel="Frequency Count"
                    height={380}
                    description={`Frequency breakdown across ${profiles[selectedUniCol].uniqueCount} unique categories.`}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: BIVARIATE & GROUPED STUDIO */}
      {/* ========================================================================= */}
      {activeTab === 'bivariate' && (
        <div className="space-y-6">
          {/* Column Selectors */}
          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Variable 1 (Dimension / X)</label>
              <select
                value={biCol1}
                onChange={e => setBiCol1(e.target.value)}
                className="w-full mt-1 bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-amber-500"
              >
                {columns.map(col => (
                  <option key={col} value={col}>
                    {col} ({profiles[col]?.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Variable 2 (Metric / Y)</label>
              <select
                value={biCol2}
                onChange={e => setBiCol2(e.target.value)}
                className="w-full mt-1 bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-amber-500"
              >
                {numCols.map(col => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Aggregation</label>
                {biAggregation === 'none' && (
                  <span className="text-[9px] font-mono text-emerald-400 font-semibold uppercase">Scatter / Raw</span>
                )}
              </div>
              <select
                value={biAggregation}
                onChange={e => setBiAggregation(e.target.value as any)}
                className="w-full mt-1 bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-amber-500"
              >
                <option value="none">Don't Summarize</option>
                <option value="sum">Sum (Total)</option>
                <option value="mean">Mean (Average)</option>
                <option value="median">Median</option>
                <option value="count">Count</option>
              </select>
            </div>
          </div>

          {/* Bivariate Render */}
          {biAggregation === 'none' ? (
            <div className="space-y-3">
              <ChartViewer
                type="scatter"
                title={`${biCol1} vs ${biCol2} Scatter Dispersion`}
                data={scatterData}
                xAxisLabel={biCol1}
                yAxisLabel={biCol2}
                height={420}
                description={
                  profiles[biCol1]?.type === 'numeric' && profiles[biCol2]?.type === 'numeric'
                    ? `Unsummarized raw observation scatter plot across ${biCol1} and ${biCol2} (${scatterData.length.toLocaleString()} observations plotted without aggregation${scatterCorrelation !== null ? ` • Pearson r = ${scatterCorrelation > 0 ? '+' : ''}${scatterCorrelation.toFixed(3)}` : ''}).`
                    : `Unsummarized raw point dispersion across categories of ${biCol1} (${scatterData.length.toLocaleString()} records).`
                }
              />
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[#12151C] border border-[#252A36] text-xs">
                <div className="flex flex-wrap items-center gap-4 text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Plotted Observations:</span>
                    <span className="font-mono font-semibold text-slate-200">{scatterData.length.toLocaleString()} points</span>
                  </div>
                  {scatterCorrelation !== null && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Pearson r:</span>
                      <span className={`font-mono font-bold ${scatterCorrelation > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {scatterCorrelation > 0 ? '+' : ''}{scatterCorrelation.toFixed(3)} ({Math.abs(scatterCorrelation) > 0.7 ? 'Strong' : Math.abs(scatterCorrelation) > 0.3 ? 'Moderate' : 'Weak'})
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Mode:</span>
                    <span className="font-semibold text-amber-400">Don't Summarize (Raw Points)</span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Granular row-level data • No aggregation applied
                </span>
              </div>
            </div>
          ) : (
            <ChartViewer
              type="bar"
              title={`${biAggregation.toUpperCase()} of ${biCol2} by ${biCol1}`}
              data={computeGroupSummary(workingRows, biCol1, biCol2, biAggregation as 'sum' | 'mean' | 'median' | 'count').slice(0, 16).map(s => ({
                [biCol1]: s.category,
                [biCol2]: s.value,
                'Average': s.mean,
                'Share %': s.sharePct
              }))}
              xAxisKey={biCol1}
              yAxisKey={biCol2}
              xAxisLabel={biCol1}
              yAxisLabel={`${biAggregation.toUpperCase()} of ${biCol2}`}
              height={400}
              description={`Grouped bivariate slice comparing ${biAggregation} of ${biCol2} across ${biCol1} categories.`}
            />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CORRELATION MATRIX & RANKINGS */}
      {/* ========================================================================= */}
      {activeTab === 'correlation' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-[#12151C] border border-[#252A36] rounded-2xl p-4">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Pairwise Correlation Matrix
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluates linear and non-linear relationships across all {numCols.length} numeric variables.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCorrMethod('pearson')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
                  corrMethod === 'pearson'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-[#0B0D11] text-slate-400 border border-[#252A36]'
                }`}
              >
                Pearson (Linear)
              </button>
              <button
                onClick={() => setCorrMethod('spearman')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
                  corrMethod === 'spearman'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-[#0B0D11] text-slate-400 border border-[#252A36]'
                }`}
              >
                Spearman (Rank)
              </button>
            </div>
          </div>

          {/* Explicit Analytical Caveat */}
          <div className="bg-[#12151C] border-l-4 border-amber-500 rounded-r-2xl p-4 text-xs text-slate-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-400">Statistical Caveat: </strong>
              Correlation indicates co-directional statistical association; it does <em>not</em> prove direct causation.
              External confounders, latent variables, or simultaneous market forces may drive shared variance.
            </div>
          </div>

          {correlationData && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Cols: Matrix Grid */}
              <div className="lg:col-span-7 bg-[#12151C] border border-[#252A36] rounded-2xl p-5 overflow-x-auto custom-scrollbar">
                <span className="text-[10px] font-mono font-bold uppercase text-amber-400 block mb-3">
                  Correlation Heatmap Table ({corrMethod.toUpperCase()})
                </span>
                <table className="w-full text-center border-collapse font-mono text-xs">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-slate-400 font-semibold">Variable</th>
                      {correlationData.columns.map(c => (
                        <th key={c} className="p-2 text-slate-300 font-semibold truncate max-w-[80px]" title={c}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#252A36]">
                    {correlationData.columns.map((rowCol, rIdx) => (
                      <tr key={rowCol} className="hover:bg-[#181D26]">
                        <td className="p-2 text-left font-semibold text-slate-200 truncate max-w-[100px]" title={rowCol}>
                          {rowCol}
                        </td>
                        {correlationData.matrix[rIdx].map((val, cIdx) => {
                          const absVal = Math.abs(val);
                          const isDiag = rIdx === cIdx;
                          const bg = isDiag
                            ? 'bg-[#181D26] text-slate-500'
                            : val > 0.6
                            ? 'bg-amber-500/25 text-amber-300 font-bold'
                            : val > 0.3
                            ? 'bg-amber-500/15 text-amber-400'
                            : val < -0.6
                            ? 'bg-rose-500/25 text-rose-300 font-bold'
                            : val < -0.3
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'text-slate-400';
                          return (
                            <td key={cIdx} className={`p-2 rounded-lg font-mono ${bg}`}>
                              {val.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Right 5 Cols: Top Pairwise Rankings */}
              <div className="lg:col-span-5 bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-3">
                <span className="text-[10px] font-mono font-bold uppercase text-amber-400 block">
                  Ranked Correlation Strengths
                </span>
                <div className="divide-y divide-[#252A36] max-h-96 overflow-y-auto custom-scrollbar space-y-2">
                  {(correlationData.pairs || []).slice(0, 8).map((pair, idx) => (
                    <div key={idx} className="pt-2 pb-1 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">
                          {pair.col1} ↔ {pair.col2}
                        </span>
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                            pair.correlation > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-rose-500/15 text-rose-400'
                          }`}
                        >
                          r = {pair.correlation.toFixed(3)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{pair.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: TIME-SERIES VELOCITY */}
      {/* ========================================================================= */}
      {activeTab === 'timeseries' && (
        <div className="space-y-6">
          {dateCols.length === 0 ? (
            <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-8 text-center text-xs text-slate-400 font-mono">
              No datetime columns identified in dataset for chronological velocity modeling.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Selectors */}
              <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Chronological Date Column</label>
                  <select
                    value={tsDateCol}
                    onChange={e => setTsDateCol(e.target.value)}
                    className="w-full mt-1 bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-1.5 text-xs text-slate-200 font-medium"
                  >
                    {dateCols.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Target Time-Series Metric</label>
                  <select
                    value={tsMetricCol}
                    onChange={e => setTsMetricCol(e.target.value)}
                    className="w-full mt-1 bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-1.5 text-xs text-slate-200 font-medium"
                  >
                    {numCols.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {timeSeriesData && (
                <div className="space-y-6">
                  {/* KPI Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#12151C] p-4 rounded-2xl border border-[#252A36]">
                      <span className="text-[10px] text-slate-400 font-mono uppercase">Trend Velocity</span>
                      <p className="text-lg font-bold font-mono text-amber-400 mt-1">
                        {timeSeriesData.growthRatePct >= 0 ? '+' : ''}{timeSeriesData.growthRatePct}%
                      </p>
                    </div>
                    <div className="bg-[#12151C] p-4 rounded-2xl border border-[#252A36]">
                      <span className="text-[10px] text-slate-400 font-mono uppercase">Historical Peak</span>
                      <p className="text-sm font-bold font-mono text-emerald-400 mt-1">
                        {timeSeriesData.peakPeriod.period} (${timeSeriesData.peakPeriod.value.toLocaleString()})
                      </p>
                    </div>
                    <div className="bg-[#12151C] p-4 rounded-2xl border border-[#252A36]">
                      <span className="text-[10px] text-slate-400 font-mono uppercase">Historical Trough</span>
                      <p className="text-sm font-bold font-mono text-rose-400 mt-1">
                        {timeSeriesData.troughPeriod.period} (${timeSeriesData.troughPeriod.value.toLocaleString()})
                      </p>
                    </div>
                    <div className="bg-[#12151C] p-4 rounded-2xl border border-[#252A36]">
                      <span className="text-[10px] text-slate-400 font-mono uppercase">Granularity & Span</span>
                      <p className="text-sm font-bold font-mono text-slate-200 mt-1">
                        {timeSeriesData.granularity.toUpperCase()} ({timeSeriesData.totalDurationDays} Days)
                      </p>
                    </div>
                  </div>

                  {/* Chart */}
                  <ChartViewer
                    type="line"
                    title={`${tsMetricCol} Historical Trajectory with Moving Average`}
                    data={timeSeriesData.trendPoints.map(p => ({
                      [tsDateCol]: p.period,
                      [tsMetricCol]: p.value,
                      '3-Period Moving Avg': p.movingAverage
                    }))}
                    xAxisKey={tsDateCol}
                    yAxisKey={tsMetricCol}
                    xAxisLabel="Time Period"
                    yAxisLabel={`Aggregated ${tsMetricCol}`}
                    height={380}
                    description={timeSeriesData.seasonalityNote}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: TOP/BOTTOM RANKINGS & SEGMENTS */}
      {/* ========================================================================= */}
      {activeTab === 'segments' && (
        <div className="space-y-6">
          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Segment Dimension</label>
              <select
                value={rankingDim}
                onChange={e => setRankingDim(e.target.value)}
                className="w-full mt-1 bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-1.5 text-xs text-slate-200 font-medium"
              >
                {catCols.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Target Metric</label>
              <select
                value={rankingMetric}
                onChange={e => setRankingMetric(e.target.value)}
                className="w-full mt-1 bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-1.5 text-xs text-slate-200 font-medium"
              >
                {numCols.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Top N Limit</label>
              <select
                value={rankingTopN}
                onChange={e => setRankingTopN(Number(e.target.value))}
                className="w-full mt-1 bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-1.5 text-xs text-slate-200 font-medium"
              >
                <option value={5}>Top / Bottom 5</option>
                <option value={10}>Top / Bottom 10</option>
                <option value={20}>Top / Bottom 20</option>
              </select>
            </div>
          </div>

          {rankingData && segmentData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top N Leaders */}
              <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-3">
                <span className="text-[10px] font-mono font-bold uppercase text-emerald-400 block">
                  Top {rankingTopN} Performing {rankingDim} Segments
                </span>
                <div className="divide-y divide-[#252A36] max-h-80 overflow-y-auto custom-scrollbar font-mono text-xs">
                  {rankingData.topItems.map(item => (
                    <div key={item.rank} className="py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold flex items-center justify-center">
                          {item.rank}
                        </span>
                        <span className="text-slate-200 font-semibold truncate max-w-[160px]">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-100 font-bold">${item.value.toLocaleString()}</span>
                        <span className="text-emerald-400 font-semibold">{item.sharePct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom N Laggards */}
              <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-3">
                <span className="text-[10px] font-mono font-bold uppercase text-rose-400 block">
                  Bottom {rankingTopN} Lowest {rankingDim} Segments
                </span>
                <div className="divide-y divide-[#252A36] max-h-80 overflow-y-auto custom-scrollbar font-mono text-xs">
                  {rankingData.bottomItems.map(item => (
                    <div key={item.rank} className="py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-rose-500/15 text-rose-400 text-[10px] font-bold flex items-center justify-center">
                          {item.rank}
                        </span>
                        <span className="text-slate-200 font-semibold truncate max-w-[160px]">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-100 font-bold">${item.value.toLocaleString()}</span>
                        <span className="text-rose-400 font-semibold">{item.sharePct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: ANOMALIES & EXTREME VALUES */}
      {/* ========================================================================= */}
      {activeTab === 'anomalies' && (
        <div className="space-y-6">
          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Statistical Outlier & Anomaly Audit
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Identifies observations exceeding 1.5× Interquartile Range (IQR) and |Z-Score| &gt; 3.0.
              </p>
            </div>
            <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {anomalies.length} Outliers Detected
            </span>
          </div>

          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#252A36] bg-[#0B0D11] text-slate-400 font-semibold">
                    <th className="p-3">Row #</th>
                    <th className="p-3">Column</th>
                    <th className="p-3">Recorded Value</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Z-Score Deviation</th>
                    <th className="p-3">Analytical Explanation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252A36] text-slate-300">
                  {anomalies.map(anom => (
                    <tr key={anom.id} className="hover:bg-[#181D26]">
                      <td className="p-3 text-slate-400 font-bold">#{anom.rowIndex}</td>
                      <td className="p-3 font-semibold text-slate-100">{anom.column}</td>
                      <td className="p-3 font-bold text-amber-400">
                        {typeof anom.value === 'number' ? anom.value.toLocaleString() : anom.value}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#181D26] text-slate-300 border border-[#2D3342]">
                          {anom.method}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-rose-400">{anom.score}σ</td>
                      <td className="p-3 text-slate-400 text-[11px]">{anom.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
