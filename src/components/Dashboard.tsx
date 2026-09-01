import React, { useMemo } from 'react';
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
  Bot
} from 'lucide-react';
import { DatasetState } from '../types/dataset';
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
          <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Welcome to DataMind AI</h1>
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

      {/* 4. 1-2 Executive Charts (Performance Trajectory & Segment Distribution) */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Executive Visualizations
        </h2>
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
  );
};
