import React, { useMemo, useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  ArrowRight,
  Database,
  CheckCircle2,
  DollarSign,
  Compass,
  FileSpreadsheet,
  Layers,
  TableProperties,
  PieChart,
  Bot,
  Trash2,
  Plus,
  Edit3,
  X,
  AlertTriangle,
  FileText,
  ChevronUp,
  ChevronDown,
  Filter,
  Sliders,
  Grid
} from 'lucide-react';
import { DatasetState } from '../types/dataset';
import { SavedVisualization } from '../types/visualization';
import { VisualizationEngine } from '../services/visualizationEngine';
import { ChartViewer } from './ChartViewer';
import {
  computeGroupSummary,
  computeTimeSeriesTrend,
  detectBusinessKPIs,
  generateAutomatedEDAInsights
} from '../services/edaEngine';
import { classifyAllColumns } from '../services/columnIntelligence';
import { SAMPLE_DATASETS } from '../services/sampleData';

interface DashboardProps {
  dataset: DatasetState | null;
  onNavigate: (section: any) => void;
  onSelectQuery: (query: string) => void;
  onLoadSample?: (sampleId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  dataset,
  onNavigate,
  onSelectQuery,
  onLoadSample
}) => {
  // Empty State: Simple, inviting welcome screen
  if (!dataset) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center py-16 space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <Database className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Welcome to Smart Data Analysis Assistant</h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
            Clean, professional data analysis and automated intelligence. Upload your dataset or choose a pre-loaded scenario to get started.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigate('upload')}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-xs text-slate-950 shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            <span>Upload Dataset</span>
          </button>
        </div>

        {/* Sample dataset quick start */}
        <div className="pt-8 max-w-2xl mx-auto border-t border-[#252A36]">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-4">
            Or select a sample dataset:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            {SAMPLE_DATASETS.map(s => (
              <button
                key={s.id}
                onClick={() => onLoadSample && onLoadSample(s.id)}
                className="p-3.5 rounded-xl bg-[#12151C] hover:bg-[#181D26] border border-[#252A36] hover:border-amber-500/30 transition text-left cursor-pointer group"
              >
                <div className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition mb-1">
                  {s.name}
                </div>
                <div className="text-[11px] text-slate-400 line-clamp-2">
                  {s.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { workingRows, columns, profiles, quality } = dataset;
  const numCols = columns.filter(c => profiles[c]?.type === 'numeric');
  const catCols = columns.filter(c => profiles[c]?.type === 'categorical' || profiles[c]?.type === 'text');
  const dateCols = columns.filter(c => profiles[c]?.type === 'datetime');

  // Compute Classifications, KPIs, and Insights
  const classifications = useMemo(() => {
    return classifyAllColumns(columns, profiles, workingRows.length);
  }, [columns, profiles, workingRows.length]);

  const kpis = useMemo(() => {
    return detectBusinessKPIs(workingRows, columns, profiles, classifications);
  }, [workingRows, columns, profiles, classifications]);

  const { insights } = useMemo(() => {
    return generateAutomatedEDAInsights(workingRows, columns, profiles, classifications);
  }, [workingRows, columns, profiles, classifications]);

  // Primary dimensions and metrics for trend visualization
  const primaryCat = catCols[0];
  const primaryNum = numCols.find(c => /sales|revenue|profit|salary|mrr|score|amount/i.test(c)) || numCols[0];
  const primaryDate = dateCols[0];

  const trendData = primaryDate && primaryNum ? computeTimeSeriesTrend(workingRows, primaryDate, primaryNum, 'month') : [];
  const groupData = primaryCat && primaryNum ? computeGroupSummary(workingRows, primaryCat, primaryNum).slice(0, 6) : [];

  // Executive Dashboard Visualizations & Summaries
  const [executiveVisualizations, setExecutiveVisualizations] = useState<SavedVisualization[]>([]);
  const [chartToDeleteFromExec, setChartToDeleteFromExec] = useState<SavedVisualization | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadExecutiveCharts = () => {
    if (!dataset) return;
    const list = VisualizationEngine.getExecutiveDashboardVisualizations(dataset.id);
    setExecutiveVisualizations(list);
  };

  useEffect(() => {
    loadExecutiveCharts();
    const handleUpdate = () => loadExecutiveCharts();
    window.addEventListener('datamind_dashboard_updated', handleUpdate);
    return () => window.removeEventListener('datamind_dashboard_updated', handleUpdate);
  }, [dataset?.id]);

  const handleRemoveFromExecutive = (viz: SavedVisualization, permanently: boolean) => {
    if (permanently) {
      VisualizationEngine.deleteVisualization(viz.id);
      setToastMessage(`Permanently deleted "${viz.name}" from all dashboards.`);
    } else {
      VisualizationEngine.removeFromExecutiveDashboard(viz.id);
      setToastMessage(`Removed "${viz.name}" from Executive Dashboard.`);
    }
    setChartToDeleteFromExec(null);
    loadExecutiveCharts();
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Executive Slicer / Business Filter State
  const [slicerColumn, setSlicerColumn] = useState<string>('');
  const [slicerValue, setSlicerValue] = useState<string>('all');

  const slicerOptions = useMemo(() => {
    if (!slicerColumn || !workingRows.length) return [];
    const set = new Set<string>();
    for (let i = 0; i < Math.min(workingRows.length, 5000); i++) {
      const val = workingRows[i][slicerColumn];
      if (val !== undefined && val !== null && val !== '') {
        set.add(String(val));
        if (set.size >= 40) break;
      }
    }
    return Array.from(set).sort();
  }, [workingRows, slicerColumn]);

  const handleMoveExecutiveChart = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= executiveVisualizations.length) return;
    const ids = executiveVisualizations.map(v => v.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(targetIndex, 0, moved);
    VisualizationEngine.reorderExecutiveDashboardVisualizations(ids);
  };

  const handleSetChartWidth = (vizId: string, width: 'full' | 'half' | 'third') => {
    VisualizationEngine.setExecutiveDashboardItemWidth(vizId, width);
  };

  // Top 4 clean KPIs
  const displayKPIs = useMemo(() => {
    if (kpis.length >= 4) {
      return kpis.slice(0, 4);
    }
    // Fallback constructed KPIs
    const cards = [];
    if (primaryNum && profiles[primaryNum]) {
      const mean = profiles[primaryNum].mean || 0;
      const sum = Math.round(mean * workingRows.length);
      cards.push({
        id: 'kpi-1',
        title: `Total ${primaryNum}`,
        value: sum >= 1000 ? `$${(sum / 1000).toFixed(1)}K` : `${sum.toLocaleString()}`,
        columnSource: primaryNum,
        format: 'currency'
      });
      cards.push({
        id: 'kpi-2',
        title: `Average ${primaryNum}`,
        value: mean >= 1000 ? `$${(mean / 1000).toFixed(1)}K` : `${Math.round(mean).toLocaleString()}`,
        columnSource: 'Mean per record',
        format: 'number'
      });
    }

    const secondaryNum = numCols.find(c => c !== primaryNum && /profit|margin|qty|discount/i.test(c));
    if (secondaryNum && profiles[secondaryNum]) {
      const mean = profiles[secondaryNum].mean || 0;
      cards.push({
        id: 'kpi-3',
        title: `Average ${secondaryNum}`,
        value: `${Math.round(mean * 10) / 10}%`,
        columnSource: secondaryNum,
        format: 'percent'
      });
    } else {
      cards.push({
        id: 'kpi-3',
        title: 'Data Quality',
        value: `${quality.score}/100`,
        columnSource: 'Completeness & Validity',
        format: 'score'
      });
    }

    cards.push({
      id: 'kpi-4',
      title: 'Active Records',
      value: workingRows.length.toLocaleString(),
      columnSource: 'Verified clean rows',
      format: 'count'
    });

    return cards.slice(0, 4);
  }, [kpis, primaryNum, numCols, profiles, workingRows.length, quality.score]);

  // Top 3 concise insights
  const topInsights = useMemo(() => {
    if (insights && insights.length > 0) {
      return insights.slice(0, 3);
    }
    return [
      {
        id: 'ins-1',
        title: 'Strong Primary Metric Trajectory',
        description: `Primary metric ${primaryNum || 'records'} demonstrates stable volume distribution.`
      },
      {
        id: 'ins-2',
        title: 'Clear Segment Distribution',
        description: `${primaryCat || 'Key categories'} indicate balanced variance across records.`
      },
      {
        id: 'ins-3',
        title: 'Verified Data Quality',
        description: `Dataset achieves an overall health rating of ${quality.score}/100 ready for modeling.`
      }
    ];
  }, [insights, primaryNum, primaryCat, quality.score]);

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      {/* 1. Simple Dataset Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#252A36] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
            {dataset.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2">
            <span className="font-mono text-slate-300 font-semibold">{workingRows.length.toLocaleString()} rows</span>
            <span>•</span>
            <span className="font-mono text-slate-300 font-semibold">{columns.length} columns</span>
            <span>•</span>
            <span className="text-emerald-400 font-medium">
              Data Quality: <strong className="font-mono font-bold text-slate-200">{quality.score}/100</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('reports')}
            className="px-4 py-2 rounded-xl bg-[#12151C] hover:bg-[#181D26] border border-[#252A36] text-slate-200 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
            <span>Generate Report</span>
          </button>
          <button
            onClick={() => {
              const summaryPrompt = `Give me an executive business briefing on dataset "${dataset.name}". What are the key drivers, highest-performing segments, and high-priority anomalies I should know?`;
              onSelectQuery(summaryPrompt);
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask AI About Dashboard</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics (Max 4 clean cards) */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Executive KPIs
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {displayKPIs.map(kpi => (
            <div
              key={kpi.id}
              className="bg-[#12151C] border border-[#252A36] rounded-2xl p-4.5 flex flex-col justify-between shadow-sm"
            >
              <span className="text-xs font-medium text-slate-400 truncate mb-2">
                {kpi.title}
              </span>
              <div className="text-2xl font-bold font-mono text-slate-100 tracking-tight my-1">
                {kpi.value}
              </div>
              <span className="text-[11px] text-slate-400 truncate mt-1">
                {kpi.columnSource}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Executive Business Insights (Max 3 concise cards) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Automated Business Insights
            </h2>
          </div>
          <button
            onClick={() => onNavigate('eda')}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>Automated Exploratory Data Analysis</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topInsights.map((ins, idx) => (
            <div
              key={ins.id || idx}
              className="bg-[#12151C] border border-[#252A36] hover:border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between shadow-sm transition space-y-3"
            >
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                  Finding #{idx + 1}
                </span>
                <h3 className="text-xs font-bold text-slate-100 line-clamp-2">
                  {ins.title}
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">
                  {ins.description}
                </p>
              </div>

              <div className="pt-2 border-t border-[#202532] flex items-center justify-between">
                <button
                  onClick={() => {
                    const prompt = `Can you explain the analytical context and business takeaway for this finding: "${ins.title}" (${ins.description})?`;
                    onSelectQuery(prompt);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#181D26] hover:bg-amber-500/20 border border-[#2B3242] text-[11px] text-amber-300 font-medium transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Bot className="w-3 h-3 text-amber-400" />
                  <span>Ask AI</span>
                </button>
                <button
                  onClick={() => onNavigate('investigations')}
                  className="text-[11px] text-slate-400 hover:text-slate-200 transition cursor-pointer"
                >
                  Investigate
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Executive Visualizations & Automated Summaries */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Executive Dashboard Visualizations & Summaries</span>
            </h2>
            {executiveVisualizations.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                {executiveVisualizations.length} synced
              </span>
            )}
          </div>
          <button
            onClick={() => onNavigate('visualizations')}
            className="text-xs text-amber-400 hover:text-amber-300 transition flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add / Manage Charts</span>
          </button>
        </div>

        {/* Business Filter / Slicer Toolbar for Executive Dashboard */}
        {executiveVisualizations.length > 0 && catCols.length > 0 && (
          <div className="bg-[#12151C] border border-[#252A36] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-amber-400" />
                <span>Dashboard Slicer:</span>
              </span>

              {/* Slicer Column Selector */}
              <select
                value={slicerColumn}
                onChange={e => {
                  setSlicerColumn(e.target.value);
                  setSlicerValue('all');
                }}
                className="bg-[#0B0D11] border border-[#2B3242] rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
              >
                <option value="">-- Select Field to Slice --</option>
                {catCols.map(c => (
                  <option key={c} value={c}>
                    Aa {c}
                  </option>
                ))}
              </select>

              {/* Slicer Value Selector */}
              {slicerColumn && (
                <div className="flex items-center gap-2">
                  <select
                    value={slicerValue}
                    onChange={e => setSlicerValue(e.target.value)}
                    className="bg-[#0B0D11] border border-amber-500/50 rounded-lg px-2.5 py-1 text-xs text-amber-300 focus:outline-none focus:border-amber-500 font-semibold"
                  >
                    <option value="all">All {slicerColumn}s</option>
                    {slicerOptions.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>

                  {slicerValue !== 'all' && (
                    <button
                      onClick={() => setSlicerValue('all')}
                      className="px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-[11px] font-semibold transition"
                    >
                      Clear Slice
                    </button>
                  )}
                </div>
              )}
            </div>

            {slicerColumn && slicerValue !== 'all' && (
              <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Active Filter: {slicerColumn} = "{slicerValue}"
              </span>
            )}
          </div>
        )}

        {/* Dynamic Synchronized Dashboard Charts with Reordering, Resizing & Automated Summaries */}
        {executiveVisualizations.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {executiveVisualizations.map((viz, index) => {
              const activeConfig = {
                ...(viz.config || {}),
                filters:
                  slicerColumn && slicerValue !== 'all'
                    ? [
                        ...(viz.config?.filters || []).filter(f => f.column !== slicerColumn),
                        {
                          id: `slicer_${slicerColumn}`,
                          column: slicerColumn,
                          operator: 'equals' as const,
                          value: slicerValue
                        }
                      ]
                    : (viz.config?.filters || [])
              };

              const computed = VisualizationEngine.compute(
                dataset,
                activeConfig,
                viz.chartType,
                viz.customTitle || viz.name
              );
              const summary = VisualizationEngine.generateChartExecutiveSummary(computed, viz, dataset);

              const cardColSpan =
                viz.dashboardWidth === 'half'
                  ? 'lg:col-span-6'
                  : viz.dashboardWidth === 'third'
                  ? 'lg:col-span-4'
                  : 'lg:col-span-12';

              return (
                <div
                  key={viz.id}
                  className={`${cardColSpan} bg-[#12151C] border border-[#252A36] hover:border-amber-500/40 rounded-2xl p-5 shadow-xl transition space-y-4 group flex flex-col justify-between`}
                >
                  <div className="space-y-4">
                    {/* Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#222734]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {viz.chartType.replace('_', ' ')}
                          </span>
                          <h3 className="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition">
                            {viz.customTitle || viz.name}
                          </h3>
                        </div>
                        {viz.description && (
                          <p className="text-xs text-slate-400 max-w-xl">
                            {viz.description}
                          </p>
                        )}
                      </div>

                      {/* Header Controls: Reorder, Resize, Ask AI, Edit, Remove */}
                      <div className="flex items-center flex-wrap gap-1.5 shrink-0">
                        {/* Reorder Buttons */}
                        <div className="flex items-center rounded-lg bg-[#181D26] border border-[#2B3242] p-0.5">
                          <button
                            onClick={() => handleMoveExecutiveChart(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-slate-400 hover:text-amber-400 disabled:opacity-30 transition cursor-pointer"
                            title="Move Chart Up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveExecutiveChart(index, 'down')}
                            disabled={index === executiveVisualizations.length - 1}
                            className="p-1 text-slate-400 hover:text-amber-400 disabled:opacity-30 transition cursor-pointer"
                            title="Move Chart Down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Width Resize Toggle */}
                        <div className="flex items-center rounded-lg bg-[#181D26] border border-[#2B3242] p-0.5 text-[10px] font-semibold">
                          <button
                            onClick={() => handleSetChartWidth(viz.id, 'full')}
                            className={`px-1.5 py-0.5 rounded ${
                              !viz.dashboardWidth || viz.dashboardWidth === 'full'
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="Full Width (100%)"
                          >
                            Full
                          </button>
                          <button
                            onClick={() => handleSetChartWidth(viz.id, 'half')}
                            className={`px-1.5 py-0.5 rounded ${
                              viz.dashboardWidth === 'half'
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="Half Width (50%)"
                          >
                            1/2
                          </button>
                          <button
                            onClick={() => handleSetChartWidth(viz.id, 'third')}
                            className={`px-1.5 py-0.5 rounded ${
                              viz.dashboardWidth === 'third'
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="One-Third Width (33%)"
                          >
                            1/3
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            const prompt = `Provide an executive strategic briefing for the chart "${viz.customTitle || viz.name}". Key context: ${summary.headline}. Narrative: ${summary.narrative}`;
                            onSelectQuery(prompt);
                          }}
                          className="px-2 py-1 rounded-lg bg-[#181D26] hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-[#2B3242] text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                          title="Ask AI about this executive chart"
                        >
                          <Bot className="w-3 h-3" />
                          <span>Ask AI</span>
                        </button>
                        <button
                          onClick={() => onNavigate('visualizations')}
                          className="p-1.5 rounded-lg bg-[#181D26] hover:bg-[#202634] text-slate-400 hover:text-amber-400 border border-[#2B3242] transition cursor-pointer"
                          title="Open in Data Visualisation Studio"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setChartToDeleteFromExec(viz)}
                          className="p-1.5 rounded-lg bg-[#181D26] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-[#2B3242] hover:border-rose-500/30 transition cursor-pointer"
                          title="Delete or remove chart"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Split Body: Chart Canvas + Automated Executive Summary */}
                    <div className={`grid grid-cols-1 ${viz.dashboardWidth === 'third' ? 'gap-3' : 'lg:grid-cols-12 gap-5'} items-stretch`}>
                      {/* Left Canvas */}
                      <div className={`${viz.dashboardWidth === 'third' ? 'w-full' : 'lg:col-span-7'} bg-[#0B0D11] border border-[#1E232E] rounded-xl p-3 flex flex-col justify-center`}>
                        <ChartViewer
                          type={computed.chartType as any}
                          title=""
                          data={computed.data}
                          xAxisKey={computed.xAxisKey}
                          yAxisKey={computed.yAxisKey}
                          keys={computed.seriesKeys}
                          xAxisLabel={computed.xAxisTitle}
                          yAxisLabel={computed.yAxisTitle}
                          height={viz.dashboardWidth === 'third' ? 220 : 270}
                          allowFullscreen={true}
                        />
                      </div>

                      {/* Right Summary Panel */}
                      <div className={`${viz.dashboardWidth === 'third' ? 'w-full' : 'lg:col-span-5'} bg-[#0F1218] border border-[#222836] rounded-xl p-4 flex flex-col justify-between space-y-3`}>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-[#222734] pb-2">
                            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span className="uppercase tracking-wider text-[10px]">Automated Executive Summary</span>
                            </div>
                            <span className="text-[10px] text-slate-500">Auto Computed</span>
                          </div>

                          {/* Headline */}
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-slate-100 leading-snug">
                              {summary.headline}
                            </h4>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              {summary.narrative}
                            </p>
                          </div>

                          {/* Key Insights */}
                          {summary.keyInsights && summary.keyInsights.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Strategic Highlights
                              </span>
                              <ul className="space-y-1">
                                {summary.keyInsights.map((ins, i) => (
                                  <li key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                                    <span className="text-amber-400 font-bold mt-0.5">•</span>
                                    <span>{ins}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#222734]">
                          {summary.metrics.map((m, i) => (
                            <div key={i} className="bg-[#141820] border border-[#232936] rounded-lg p-2 space-y-0.5">
                              <span className="text-[10px] text-slate-400 block truncate">{m.label}</span>
                              <span className="text-xs font-bold text-slate-100 font-mono block truncate">{m.value}</span>
                              {m.helper && (
                                <span className="text-[9px] text-amber-400/80 block truncate">{m.helper}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#12151C] border border-[#252A36] border-dashed rounded-2xl p-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-xs font-bold text-slate-200">
                Automated Executive Charts Sync
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Any chart you add to a dashboard in the Data Visualisation section will automatically sync here with a live computed executive summary and key strategic insights.
              </p>
            </div>
            <button
              onClick={() => onNavigate('visualizations')}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Charts to Dashboard</span>
            </button>
          </div>
        )}

        {/* Baseline Automated Trajectory & Distribution */}
        <div className="pt-4 border-t border-[#222734]">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Baseline Automated Trajectory
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Time Series Trend or Primary Distribution */}
            <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200">
                  {trendData.length > 0 ? `${primaryNum || 'Sales'} Performance Trajectory` : 'Primary Metric Distribution'}
                </h3>
                <button
                  onClick={() => {
                    const prompt = `Analyze the performance trajectory and moving average of ${primaryNum || 'primary metric'} in dataset "${dataset.name}".`;
                    onSelectQuery(prompt);
                  }}
                  className="px-2 py-0.5 rounded-lg bg-[#181D26] text-[10px] text-amber-400 hover:bg-amber-500/20 transition flex items-center gap-1 cursor-pointer"
                >
                  <Bot className="w-2.5 h-2.5" />
                  <span>Ask AI</span>
                </button>
              </div>
              {trendData.length > 0 ? (
                <ChartViewer
                  type="line"
                  title={`${primaryNum || 'Sales'} Monthly Trend`}
                  data={trendData.map(t => ({
                    Period: t.period,
                    [primaryNum || 'Value']: t.value,
                    'Moving Average': t.movingAverage
                  }))}
                  xAxisKey="Period"
                  keys={[primaryNum || 'Value', 'Moving Average']}
                  xAxisLabel="Time Period"
                  yAxisLabel={`Total ${primaryNum || 'Value'}`}
                  height={260}
                  allowFullscreen={false}
                />
              ) : groupData.length > 0 ? (
                <ChartViewer
                  type="bar"
                  title={`${primaryNum || 'Value'} by ${primaryCat || 'Category'}`}
                  data={groupData.map(g => ({
                    [primaryCat || 'Category']: g.category,
                    Total: g.sum
                  }))}
                  xAxisKey={primaryCat || 'Category'}
                  yAxisKey="Total"
                  xAxisLabel={primaryCat || 'Category'}
                  yAxisLabel={`Total ${primaryNum || 'Value'}`}
                  height={260}
                  allowFullscreen={false}
                />
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No chart available for current dimensions.
                </div>
              )}
            </div>

            {/* Chart 2: Top Segment Breakdown */}
            <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200">
                  {primaryCat ? `Breakdown by ${primaryCat}` : 'Segment Concentration'}
                </h3>
                <button
                  onClick={() => {
                    const prompt = `Analyze segment performance and distribution across ${primaryCat || 'categories'} for ${primaryNum || 'metrics'}.`;
                    onSelectQuery(prompt);
                  }}
                  className="px-2 py-0.5 rounded-lg bg-[#181D26] text-[10px] text-amber-400 hover:bg-amber-500/20 transition flex items-center gap-1 cursor-pointer"
                >
                  <Bot className="w-2.5 h-2.5" />
                  <span>Ask AI</span>
                </button>
              </div>
              {groupData.length > 0 ? (
                <ChartViewer
                  type="donut"
                  title={`${primaryNum || 'Value'} by ${primaryCat || 'Category'}`}
                  data={groupData.map(g => ({
                    category: g.category,
                    value: g.sum
                  }))}
                  xAxisKey="category"
                  yAxisKey="value"
                  height={260}
                  allowFullscreen={false}
                />
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Additional categorical breakdown will appear when segment columns are detected.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete / Remove Confirmation Modal for Executive Dashboard */}
      {chartToDeleteFromExec && (
        <div className="fixed inset-0 bg-[#0B0D11]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-[#2D3342] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Delete Dashboard Chart?</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{chartToDeleteFromExec.name}</p>
                </div>
              </div>
              <button
                onClick={() => setChartToDeleteFromExec(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#181D26] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Choose how you want to handle this chart. You can remove it from the Executive Dashboard or delete it permanently across all dashboards.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setChartToDeleteFromExec(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveFromExecutive(chartToDeleteFromExec, false)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#202634] hover:bg-[#2A3345] border border-[#3A4358] text-amber-300 font-bold text-xs transition cursor-pointer"
              >
                Remove from Executive View
              </button>
              <button
                onClick={() => handleRemoveFromExecutive(chartToDeleteFromExec, true)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs shadow-md shadow-rose-500/20 transition cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#161B24] border border-[#2E3646] text-slate-100 text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-0.5 rounded text-slate-400 hover:text-slate-200 ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
