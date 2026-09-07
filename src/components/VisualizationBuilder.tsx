// ============================================================================
// PHASE 9: POWER BI-STYLE VISUALIZATION BUILDER & STUDIO
// ============================================================================

import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Layers,
  Sparkles,
  Save,
  Copy,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Check,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  TrendingUp,
  Filter,
  Info,
  Edit2,
  Trash2,
  Search
} from 'lucide-react';
import { DatasetState } from '../types/dataset';
import {
  ExtendedChartType,
  VisualizationFieldConfig,
  SavedVisualization,
  VisualizationFilter
} from '../types/visualization';
import { TimeGranularity, DateRangePreset, AggregationFunction, ComparisonMode } from '../types/temporal';
import { VisualizationEngine, VisualizationComputationResult } from '../services/visualizationEngine';
import { NaturalLanguageVizParser } from '../services/naturalLanguageVizParser';
import { ChartViewer } from './ChartViewer';

interface VisualizationBuilderProps {
  dataset: DatasetState;
  editingViz?: SavedVisualization | null;
  onSaveComplete?: (saved: SavedVisualization) => void;
  onOpenMyVisualizations?: () => void;
  onOpenDashboard?: () => void;
  initialQuery?: string;
}

export type ChartCategory = 'All' | 'Comparison' | 'Trends' | 'Composition' | 'Correlation' | 'Executive';

export interface ChartTypeOption {
  type: ExtendedChartType;
  label: string;
  category: 'Comparison' | 'Trends' | 'Composition' | 'Correlation' | 'Executive';
  icon: string;
  hint: string;
}

const SUPPORTED_CHART_TYPES: ChartTypeOption[] = [
  // Comparison & Ranking (5)
  { type: 'bar', label: 'Bar', category: 'Comparison', icon: '📊', hint: 'Compare categories or ranked values' },
  { type: 'column', label: 'Column', category: 'Comparison', icon: '🏛️', hint: 'Vertical column comparison bars' },
  { type: 'horizontal_bar', label: 'Horiz Bar', category: 'Comparison', icon: '📶', hint: 'Ideal for long label names & rankings' },
  { type: 'waterfall', label: 'Waterfall', category: 'Comparison', icon: '🪜', hint: 'Variance bridge & incremental cost steps' },
  { type: 'funnel', label: 'Funnel', category: 'Comparison', icon: '⏳', hint: 'Conversion pipeline & drop-off stages' },

  // Trends & Sequences (4)
  { type: 'line', label: 'Line Trend', category: 'Trends', icon: '📈', hint: 'Continuous timeline & performance trends' },
  { type: 'step_line', label: 'Step Line', category: 'Trends', icon: '🪜', hint: 'Discrete rate changes & step milestones' },
  { type: 'area', label: 'Area Chart', category: 'Trends', icon: '📉', hint: 'Cumulative volume and volume fill over time' },
  { type: 'composed', label: 'Combo Dual', category: 'Trends', icon: '📑', hint: 'Bar volume + secondary trend line overlay' },

  // Composition & Proportions (6)
  { type: 'pie', label: 'Pie Chart', category: 'Composition', icon: '🥧', hint: 'Proportional share of total' },
  { type: 'donut', label: 'Donut', category: 'Composition', icon: '🍩', hint: 'Circular distribution ring with hole' },
  { type: 'treemap', label: 'Treemap', category: 'Composition', icon: '🗂️', hint: 'Hierarchical nested rectangular tiles' },
  { type: 'radar', label: 'Radar Spider', category: 'Composition', icon: '🕸️', hint: 'Multi-variable balanced profile evaluation' },
  { type: 'polar_area', label: 'Polar Area', category: 'Composition', icon: '🎯', hint: 'Cyclical radial segments & magnitude' },
  { type: 'radial_bar', label: 'Radial Bar', category: 'Composition', icon: '💫', hint: 'Circular gauge meters for metric targets' },

  // Correlation & Matrix (3)
  { type: 'scatter', label: 'Scatter', category: 'Correlation', icon: '⁖', hint: 'Bivariate statistical correlation & clustering' },
  { type: 'bubble', label: 'Bubble', category: 'Correlation', icon: '🫧', hint: '3-metric correlation: X, Y, and Bubble Size' },
  { type: 'heatmap', label: 'Heatmap', category: 'Correlation', icon: '🗺️', hint: '2D cross-tab matrix intersection density' },

  // Executive & Distribution (5)
  { type: 'histogram', label: 'Histogram', category: 'Executive', icon: '📊', hint: 'Frequency distribution and bin spreads' },
  { type: 'box', label: 'Box Plot', category: 'Executive', icon: '📦', hint: 'Quartiles, median spread & outlier detection' },
  { type: 'gauge', label: 'KPI Gauge', category: 'Executive', icon: '🧭', hint: 'Target benchmark velocity dial & status' },
  { type: 'kpi_card', label: 'KPI Card', category: 'Executive', icon: '🎯', hint: 'Single-value executive KPI metric & progress' },
  { type: 'table', label: 'Table', category: 'Executive', icon: '📋', hint: 'Aggregated summary data table with totals' }
];

export const VisualizationBuilder: React.FC<VisualizationBuilderProps> = ({
  dataset,
  editingViz,
  onSaveComplete,
  onOpenMyVisualizations,
  onOpenDashboard,
  initialQuery
}) => {
  const { workingRows, columns, profiles } = dataset;

  // Classify columns
  const dateCols = useMemo(() => {
    return columns.filter(c => {
      const p = profiles[c];
      return p && (p.type === 'datetime' || p.type === 'date' || /date|time|timestamp|day|month|year|created/i.test(c));
    });
  }, [columns, profiles]);

  const numCols = useMemo(() => {
    return columns.filter(c => {
      const p = profiles[c];
      return p && (p.type === 'numeric' || p.type === 'integer' || p.type === 'float');
    });
  }, [columns, profiles]);

  const catCols = useMemo(() => {
    return columns.filter(c => {
      const p = profiles[c];
      return p && (p.type === 'categorical' || p.type === 'text' || p.type === 'boolean');
    });
  }, [columns, profiles]);

  // Initial State from editingViz or smart defaults
  const [chartType, setChartType] = useState<ExtendedChartType>(() => {
    if (editingViz) return editingViz.chartType;
    if (dateCols.length > 0) return 'line';
    return 'bar';
  });

  const [xAxisColumn, setXAxisColumn] = useState<string>(() => {
    if (editingViz) return editingViz.config.xAxisColumn;
    if (dateCols.length > 0) return dateCols[0];
    if (catCols.length > 0) return catCols[0];
    return columns[0] || '';
  });

  const [yAxisColumn, setYAxisColumn] = useState<string>(() => {
    if (editingViz) return editingViz.config.yAxisColumn;
    if (numCols.length > 0) return numCols[0];
    return columns[1] || '';
  });

  const [secondaryColumn, setSecondaryColumn] = useState<string>(() => {
    if (editingViz) return editingViz.config.secondaryColumn || '';
    return '';
  });

  const [aggregation, setAggregation] = useState<AggregationFunction>(() => {
    if (editingViz) return (editingViz.config.aggregation as AggregationFunction) || 'sum';
    return 'sum';
  });

  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>(() => {
    if (editingViz) return editingViz.config.timeGranularity || 'monthly';
    return 'monthly';
  });

  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>(() => {
    if (editingViz) return editingViz.config.dateRange?.preset || 'all_time';
    return 'all_time';
  });

  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    return editingViz?.config.dateRange?.startDate || '';
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return editingViz?.config.dateRange?.endDate || '';
  });

  const [groupByDimension, setGroupByDimension] = useState<string>(() => {
    if (editingViz) return editingViz.config.groupByDimension || '';
    return '';
  });

  const [topN, setTopN] = useState<number>(() => {
    if (editingViz) return editingViz.config.topN || 0;
    return 10;
  });

  const [sortBy, setSortBy] = useState<'asc' | 'desc' | 'none'>(() => {
    if (editingViz) return editingViz.config.sortBy || 'desc';
    return 'desc';
  });

  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(() => {
    return editingViz?.config.comparisonMode || 'none';
  });

  const [movingAverageWindow, setMovingAverageWindow] = useState<number>(() => {
    return editingViz?.config.movingAverageWindow || 3;
  });

  const [customTitle, setCustomTitle] = useState<string>(() => {
    return editingViz?.customTitle || '';
  });

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [nlQuery, setNlQuery] = useState(initialQuery || '');
  const [savedSuccessToast, setSavedSuccessToast] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ChartCategory>('All');
  const [chartSearchQuery, setChartSearchQuery] = useState('');

  // Filters state
  const [filters, setFilters] = useState<VisualizationFilter[]>(() => {
    return editingViz?.config.filters || [];
  });

  // Check if X-Axis is currently a Date
  const isXAxisDate = useMemo(() => {
    const p = profiles[xAxisColumn];
    return p && (p.type === 'datetime' || p.type === 'date' || /date|time|timestamp|day|month|year|created/i.test(xAxisColumn));
  }, [xAxisColumn, profiles]);

  // Helper to get distinct column values for filtering
  const getDistinctColumnValues = (colName: string): string[] => {
    if (!colName || !dataset.workingRows) return [];
    const vals = new Set<string>();
    for (const r of dataset.workingRows) {
      const v = r[colName];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        vals.add(String(v));
      }
      if (vals.size >= 100) break;
    }
    return Array.from(vals);
  };

  // Recommended Chart Type Indicator
  const recommendedChart = useMemo(() => {
    const xP = profiles[xAxisColumn];
    const yP = profiles[yAxisColumn];
    return VisualizationEngine.recommendChartType(
      xP?.type,
      yP?.type,
      !!groupByDimension,
      xP?.uniqueCount
    );
  }, [xAxisColumn, yAxisColumn, groupByDimension, profiles]);

  // Handle Natural Language Query
  const handleApplyNlQuery = (query: string) => {
    if (!query.trim()) return;
    const parsed = NaturalLanguageVizParser.parseQuery(query, columns, profiles);
    if (parsed.dateColumn) setXAxisColumn(parsed.dateColumn);
    else if (parsed.dimensionColumn) setXAxisColumn(parsed.dimensionColumn);
    
    if (parsed.metricColumn) setYAxisColumn(parsed.metricColumn);
    if (parsed.dimensionColumn && parsed.dateColumn) setGroupByDimension(parsed.dimensionColumn);
    if (parsed.chartType) setChartType(parsed.chartType as ExtendedChartType);
    if (parsed.aggregation) setAggregation(parsed.aggregation as AggregationFunction);
    if (parsed.granularity) setTimeGranularity(parsed.granularity);
    if (parsed.topN) setTopN(parsed.topN);
    if (parsed.comparisonMode) setComparisonMode(parsed.comparisonMode);
  };

  // Handle Template Selection
  const handleSelectTemplate = (templateId: string) => {
    const templates = VisualizationEngine.getTemplates();
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return;

    const matched = tmpl.fieldMatcher(columns, profiles);
    if (!matched) return;

    setChartType(tmpl.chartType);
    if (matched.xAxisColumn) setXAxisColumn(matched.xAxisColumn);
    if (matched.yAxisColumn) setYAxisColumn(matched.yAxisColumn);
    if (matched.aggregation) setAggregation(matched.aggregation as AggregationFunction);
    if (matched.timeGranularity) setTimeGranularity(matched.timeGranularity);
    if (matched.topN !== undefined) setTopN(matched.topN);
    if (matched.sortBy) setSortBy(matched.sortBy);
  };

  // Compute Visualization Result
  const computedResult: VisualizationComputationResult = useMemo(() => {
    const config: VisualizationFieldConfig = {
      xAxisColumn,
      yAxisColumn,
      secondaryColumn: secondaryColumn || groupByDimension,
      aggregation,
      timeGranularity,
      dateRange: {
        preset: dateRangePreset,
        startDate: customStartDate,
        endDate: customEndDate
      },
      groupByDimension: groupByDimension || undefined,
      topN,
      sortBy,
      comparisonMode,
      movingAverageWindow,
      filters
    };

    return VisualizationEngine.compute(dataset, config, chartType, customTitle || undefined);
  }, [
    dataset,
    chartType,
    xAxisColumn,
    yAxisColumn,
    secondaryColumn,
    aggregation,
    timeGranularity,
    dateRangePreset,
    customStartDate,
    customEndDate,
    groupByDimension,
    topN,
    sortBy,
    comparisonMode,
    movingAverageWindow,
    customTitle,
    filters
  ]);

  // Save Visualization
  const handleSaveVisualization = (forceNewCopy = false): SavedVisualization | null => {
    if (!computedResult.isValid) return null;

    const baseName = customTitle.trim() || computedResult.title || 'Custom Visualization';
    const isNew = forceNewCopy || !editingViz;
    const vizName = forceNewCopy ? `${baseName} (Copy)` : baseName;
    const vizId = isNew ? `viz_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` : editingViz.id;

    const newViz: SavedVisualization = {
      id: vizId,
      name: vizName,
      customTitle: customTitle.trim() || undefined,
      datasetId: dataset.id,
      datasetName: dataset.name,
      datasetVersion: 'v1.0',
      chartType,
      config: {
        xAxisColumn,
        yAxisColumn,
        secondaryColumn: secondaryColumn || groupByDimension,
        aggregation,
        timeGranularity,
        dateRange: {
          preset: dateRangePreset,
          startDate: customStartDate,
          endDate: customEndDate
        },
        groupByDimension: groupByDimension || undefined,
        topN,
        sortBy,
        comparisonMode,
        movingAverageWindow,
        filters
      },
      computedTitle: computedResult.title,
      computedXAxisTitle: computedResult.xAxisTitle,
      computedYAxisTitle: computedResult.yAxisTitle,
      description: computedResult.description,
      createdAt: isNew ? Date.now() : editingViz.createdAt,
      lastModified: Date.now()
    };

    VisualizationEngine.saveVisualization(newViz);
    setSavedSuccessToast(
      isNew
        ? `Saved & automatically synced "${vizName}" to Executive Dashboard!`
        : `Updated & re-synced "${vizName}" to Executive Dashboard!`
    );
    if (onSaveComplete) onSaveComplete(newViz);

    setTimeout(() => {
      setSavedSuccessToast(null);
    }, 2500);

    return newViz;
  };

  // Add filter helper
  const handleAddFilter = () => {
    const availableCol = catCols[0] || columns[0];
    if (!availableCol) return;
    setFilters(prev => [
      ...prev,
      {
        id: `f_${Date.now()}`,
        column: availableCol,
        operator: 'equals',
        value: ''
      }
    ]);
  };

  const handleRemoveFilter = (filterId: string) => {
    setFilters(prev => prev.filter(f => f.id !== filterId));
  };

  const handleReset = () => {
    setChartType('bar');
    setXAxisColumn(catCols[0] || columns[0] || '');
    setYAxisColumn(numCols[0] || columns[1] || '');
    setSecondaryColumn('');
    setAggregation('sum');
    setTimeGranularity('monthly');
    setDateRangePreset('all_time');
    setGroupByDimension('');
    setTopN(10);
    setSortBy('desc');
    setComparisonMode('none');
    setCustomTitle('');
    setFilters([]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Templates */}
      <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-100 tracking-tight">
                  {editingViz ? `Edit Visualization: ${editingViz.name}` : 'Create Visualization'}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#181D26] text-amber-400 border border-[#2D3342]">
                  Dataset: {dataset.name}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Power BI-style simplified builder: Pick chart type, map fields, aggregate, and preview in real time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenMyVisualizations && (
              <button
                onClick={onOpenMyVisualizations}
                className="px-3.5 py-1.5 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-xs font-semibold text-slate-200 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>My Visualizations</span>
              </button>
            )}
            {onOpenDashboard && (
              <button
                onClick={onOpenDashboard}
                className="px-3.5 py-1.5 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-xs font-semibold text-slate-200 transition flex items-center gap-1.5 cursor-pointer"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-amber-400" />
                <span>Custom Dashboards</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Templates Strip */}
        <div className="pt-3 border-t border-[#252A36] flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Templates:</span>
          </span>
          {VisualizationEngine.getTemplates().map(t => (
            <button
              key={t.id}
              onClick={() => handleSelectTemplate(t.id)}
              className="px-2.5 py-1 rounded-lg bg-[#0B0D11] hover:bg-[#181D26] border border-[#252A36] hover:border-amber-500/40 text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Step-by-Step Workflow Guide: Dataset → Chart Type → Fields → Aggregation → Granularity → Preview → Save → Add to Dashboard */}
        <div className="pt-3 border-t border-[#252A36]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Power BI Guided Studio Workflow
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Step-by-Step Design</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {/* Step 1: Dataset */}
            <div className="bg-[#0B0D11] border border-amber-500/40 rounded-xl p-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">1. Dataset</span>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              </div>
              <div className="mt-1 truncate">
                <span className="text-xs font-bold text-slate-200 block truncate" title={dataset.name}>{dataset.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">{dataset.rowCount.toLocaleString()} rows</span>
              </div>
            </div>

            {/* Step 2: Chart Type */}
            <div className="bg-[#0B0D11] border border-[#2D3342] rounded-xl p-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">2. Chart Type</span>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              </div>
              <div className="mt-1">
                <span className="text-xs font-bold text-slate-200 capitalize block truncate">
                  {chartType.replace('_', ' ')}
                </span>
                <span className="text-[10px] text-slate-400">Selected visual</span>
              </div>
            </div>

            {/* Step 3: Fields */}
            <div className={`bg-[#0B0D11] border rounded-xl p-2 flex flex-col justify-between ${
              xAxisColumn || yAxisColumn ? 'border-[#2D3342]' : 'border-amber-500/50'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">3. Fields</span>
                {xAxisColumn || yAxisColumn ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </div>
              <div className="mt-1 truncate">
                <span className="text-xs font-bold text-slate-200 block truncate" title={xAxisColumn || 'No axis'}>
                  {xAxisColumn || 'Select X'}
                </span>
                <span className="text-[10px] text-slate-400 block truncate" title={yAxisColumn || 'No measure'}>
                  {yAxisColumn ? `Y: ${yAxisColumn}` : 'Select Y'}
                </span>
              </div>
            </div>

            {/* Step 4: Aggregation */}
            <div className="bg-[#0B0D11] border border-[#2D3342] rounded-xl p-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">4. Aggregation</span>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              </div>
              <div className="mt-1">
                <span className="text-xs font-bold text-slate-200 uppercase font-mono block truncate">
                  {aggregation}
                </span>
                <span className="text-[10px] text-slate-400">Metric function</span>
              </div>
            </div>

            {/* Step 5: Granularity */}
            <div className="bg-[#0B0D11] border border-[#2D3342] rounded-xl p-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">5. Granularity</span>
                {isXAxisDate ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <span className="text-[9px] text-slate-400">N/A</span>
                )}
              </div>
              <div className="mt-1">
                <span className="text-xs font-bold text-slate-200 capitalize block truncate">
                  {isXAxisDate ? timeGranularity : 'Category'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {isXAxisDate ? 'Temporal bin' : 'Discrete'}
                </span>
              </div>
            </div>

            {/* Step 6: Preview */}
            <div className={`bg-[#0B0D11] border rounded-xl p-2 flex flex-col justify-between ${
              computedResult.isValid ? 'border-emerald-500/30' : 'border-rose-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">6. Preview</span>
                {computedResult.isValid ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-rose-400" />
                )}
              </div>
              <div className="mt-1">
                <span className={`text-xs font-bold block truncate ${
                  computedResult.isValid ? 'text-emerald-300' : 'text-rose-300'
                }`}>
                  {computedResult.isValid ? 'Live Ready' : 'Incomplete'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {computedResult.isValid ? `${computedResult.data.length} records` : 'Fix mappings'}
                </span>
              </div>
            </div>

            {/* Step 7: Save */}
            <div className="bg-[#0B0D11] border border-[#2D3342] rounded-xl p-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">7. Save</span>
                <Save className="w-3 h-3 text-amber-400" />
              </div>
              <div className="mt-1">
                <span className="text-xs font-bold text-slate-200 block truncate">
                  {editingViz ? 'Update Viz' : 'New Chart'}
                </span>
                <span className="text-[10px] text-slate-400">Persistent Studio</span>
              </div>
            </div>

            {/* Step 8: Add to Dashboard */}
            <div className="bg-[#0B0D11] border border-amber-500/30 rounded-xl p-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">8. Dashboard</span>
                <Sparkles className="w-3 h-3 text-amber-400" />
              </div>
              <div className="mt-1">
                <span className="text-xs font-bold text-amber-300 block truncate">
                  Executive Sync
                </span>
                <span className="text-[10px] text-slate-400">1-Click Placement</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio Grid: Left Configuration + Right Live Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================================================================= */}
        {/* LEFT PANEL: CONFIGURATION */}
        {/* ================================================================= */}
        <div className="lg:col-span-4 bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-5 shadow-xl">
          {/* 1. CHOOSE CHART TYPE */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <span>Choose Chart Type</span>
                </label>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  20 Available (&gt;15)
                </span>
              </div>
              {recommendedChart && (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Recommended: {recommendedChart}
                </span>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1 mb-2.5">
              {(['All', 'Comparison', 'Trends', 'Composition', 'Correlation', 'Executive'] as ChartCategory[]).map(cat => {
                const count = cat === 'All' ? SUPPORTED_CHART_TYPES.length : SUPPORTED_CHART_TYPES.filter(c => c.category === cat).length;
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-[#0B0D11] text-slate-400 hover:text-slate-200 border border-[#232836]'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className="text-[9px] opacity-75 font-mono">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Search */}
            <div className="relative mb-2.5">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={chartSearchQuery}
                onChange={e => setChartSearchQuery(e.target.value)}
                placeholder="Filter charts (e.g., waterfall, gauge, radar)..."
                className="w-full bg-[#0B0D11] border border-[#232836] rounded-xl pl-8 pr-3 py-1.5 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              {chartSearchQuery && (
                <button
                  type="button"
                  onClick={() => setChartSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Chart Grid */}
            <div className="grid grid-cols-4 gap-1.5 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
              {SUPPORTED_CHART_TYPES
                .filter(ct => selectedCategory === 'All' || ct.category === selectedCategory)
                .filter(ct => !chartSearchQuery || ct.label.toLowerCase().includes(chartSearchQuery.toLowerCase()) || ct.hint.toLowerCase().includes(chartSearchQuery.toLowerCase()))
                .map(ct => (
                  <button
                    key={ct.type}
                    type="button"
                    onClick={() => setChartType(ct.type)}
                    title={`${ct.label} (${ct.category}): ${ct.hint}`}
                    className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer group ${
                      chartType === ct.type
                        ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-[#0B0D11] text-slate-300 border-[#252A36] hover:border-amber-500/40 hover:bg-[#181D26]'
                    }`}
                  >
                    <span className="text-base group-hover:scale-110 transition-transform">{ct.icon}</span>
                    <span className="text-[10px] truncate w-full leading-tight">{ct.label}</span>
                  </button>
                ))}
            </div>
          </div>

          {/* 2. DYNAMIC FIELD SELECTION (Power BI simplified slots) */}
          <div className="space-y-3.5 pt-3 border-t border-[#252A36]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Field Configuration</span>
            </h3>

            {/* BOX PLOT CONFIGURATION */}
            {chartType === 'box' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Numeric Column (Measure)
                  </label>
                  <select
                    value={yAxisColumn || xAxisColumn}
                    onChange={e => {
                      setYAxisColumn(e.target.value);
                      if (!xAxisColumn || numCols.includes(xAxisColumn)) setXAxisColumn(e.target.value);
                    }}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {numCols.length === 0 ? (
                      <option value="">No numeric columns found</option>
                    ) : (
                      numCols.map(c => (
                        <option key={c} value={c}># {c}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Group By / Category (Optional)
                  </label>
                  <select
                    value={groupByDimension}
                    onChange={e => setGroupByDimension(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- None (Overall Distribution) --</option>
                    {catCols.map(c => (
                      <option key={c} value={c}>Aa {c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* HISTOGRAM CONFIGURATION */}
            {chartType === 'histogram' && (
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Numeric Column (Distribution)
                </label>
                <select
                  value={yAxisColumn || xAxisColumn}
                  onChange={e => {
                    setYAxisColumn(e.target.value);
                    setXAxisColumn(e.target.value);
                  }}
                  className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                >
                  {numCols.map(c => (
                    <option key={c} value={c}># {c}</option>
                  ))}
                </select>
              </div>
            )}

            {/* SCATTER PLOT CONFIGURATION */}
            {chartType === 'scatter' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    X-Axis Numeric Metric
                  </label>
                  <select
                    value={xAxisColumn}
                    onChange={e => setXAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {numCols.map(c => (
                      <option key={c} value={c}># {c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Y-Axis Numeric Metric
                  </label>
                  <select
                    value={yAxisColumn}
                    onChange={e => setYAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {numCols.map(c => (
                      <option key={c} value={c}># {c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Color / Group By (Optional)
                  </label>
                  <select
                    value={groupByDimension}
                    onChange={e => setGroupByDimension(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- None (Single Series) --</option>
                    {catCols.map(c => (
                      <option key={c} value={c}>Aa {c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* GAUGE CONFIGURATION */}
            {chartType === 'gauge' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Target KPI Metric (Measure)
                  </label>
                  <select
                    value={yAxisColumn}
                    onChange={e => setYAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {numCols.map(c => (
                      <option key={c} value={c}># {c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Aggregation
                  </label>
                  <select
                    value={aggregation}
                    onChange={e => setAggregation(e.target.value as AggregationFunction)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="sum">Sum</option>
                    <option value="avg">Average (Mean)</option>
                    <option value="median">Median</option>
                    <option value="max">Maximum</option>
                    <option value="min">Minimum</option>
                  </select>
                </div>
              </div>
            )}

            {/* BUBBLE CHART CONFIGURATION */}
            {chartType === 'bubble' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    X-Axis Numeric Metric
                  </label>
                  <select
                    value={xAxisColumn}
                    onChange={e => setXAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {numCols.map(c => (
                      <option key={c} value={c}># {c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Y-Axis Numeric Metric
                  </label>
                  <select
                    value={yAxisColumn}
                    onChange={e => setYAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {numCols.map(c => (
                      <option key={c} value={c}># {c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Bubble Size / Magnitude Metric (Z-Axis)
                  </label>
                  <select
                    value={secondaryColumn || numCols[2] || numCols[0]}
                    onChange={e => setSecondaryColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {numCols.map(c => (
                      <option key={c} value={c}># {c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Category Label / Group By (Optional)
                  </label>
                  <select
                    value={groupByDimension}
                    onChange={e => setGroupByDimension(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- None --</option>
                    {catCols.map(c => (
                      <option key={c} value={c}>Aa {c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* COMPOSED DUAL-AXIS CONFIGURATION */}
            {chartType === 'composed' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    X-Axis (Category or Date)
                  </label>
                  <select
                    value={xAxisColumn}
                    onChange={e => setXAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {columns.map(c => {
                      const p = profiles[c];
                      const typeIcon = p?.type === 'numeric' ? '#' : p?.type === 'datetime' ? '📅' : 'Aa';
                      return (
                        <option key={c} value={c}>{typeIcon} {c}</option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Primary Bar Metric (Y-Axis)
                  </label>
                  <select
                    value={yAxisColumn}
                    onChange={e => setYAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {numCols.map(c => (
                      <option key={c} value={c}># {c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Secondary Line Metric (Trend Overlay)
                  </label>
                  <select
                    value={secondaryColumn || numCols[1] || numCols[0]}
                    onChange={e => setSecondaryColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {numCols.map(c => (
                      <option key={c} value={c}># {c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Aggregation
                  </label>
                  <select
                    value={aggregation}
                    onChange={e => setAggregation(e.target.value as AggregationFunction)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="sum">Sum</option>
                    <option value="avg">Average (Mean)</option>
                    <option value="median">Median</option>
                    <option value="count">Count (Total Records)</option>
                  </select>
                </div>
              </div>
            )}

            {/* MATRIX HEATMAP CONFIGURATION */}
            {chartType === 'heatmap' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Matrix Row Dimension (X-Axis)
                  </label>
                  <select
                    value={xAxisColumn}
                    onChange={e => setXAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {catCols.map(c => (
                      <option key={c} value={c}>Aa {c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Matrix Column Dimension (Secondary)
                  </label>
                  <select
                    value={secondaryColumn || (catCols.filter(c => c !== xAxisColumn)[0] || '')}
                    onChange={e => setSecondaryColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {catCols
                      .filter(c => c !== xAxisColumn)
                      .map(c => (
                        <option key={c} value={c}>Aa {c}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Cell Metric Value
                  </label>
                  <select
                    value={yAxisColumn}
                    onChange={e => setYAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {numCols.map(c => (
                      <option key={c} value={c}># {c}</option>
                    ))}
                    <option value="">-- Count of Records --</option>
                  </select>
                </div>
              </div>
            )}

            {/* WATERFALL CONFIGURATION */}
            {chartType === 'waterfall' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Flow / Stage Dimension
                  </label>
                  <select
                    value={xAxisColumn}
                    onChange={e => setXAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {columns.map(c => {
                      const p = profiles[c];
                      const typeIcon = p?.type === 'numeric' ? '#' : p?.type === 'datetime' ? '📅' : 'Aa';
                      return (
                        <option key={c} value={c}>{typeIcon} {c}</option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Variance Delta / Amount Metric
                  </label>
                  <select
                    value={yAxisColumn}
                    onChange={e => setYAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {numCols.map(c => (
                      <option key={c} value={c}># {c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Aggregation
                  </label>
                  <select
                    value={aggregation}
                    onChange={e => setAggregation(e.target.value as AggregationFunction)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                  </select>
                </div>
              </div>
            )}

            {/* FUNNEL CONFIGURATION */}
            {chartType === 'funnel' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Funnel Pipeline Stage (Dimension)
                  </label>
                  <select
                    value={xAxisColumn}
                    onChange={e => setXAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {columns.map(c => {
                      const p = profiles[c];
                      const typeIcon = p?.type === 'numeric' ? '#' : p?.type === 'datetime' ? '📅' : 'Aa';
                      return (
                        <option key={c} value={c}>{typeIcon} {c}</option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Stage Throughput / Count Metric
                  </label>
                  <select
                    value={yAxisColumn}
                    onChange={e => setYAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {numCols.map(c => (
                      <option key={c} value={c}># {c}</option>
                    ))}
                    <option value="">-- Count of Records --</option>
                  </select>
                </div>
              </div>
            )}

            {/* COMPOSITION CHARTS: PIE, DONUT, RADAR, POLAR_AREA, RADIAL_BAR, TREEMAP */}
            {(chartType === 'pie' ||
              chartType === 'donut' ||
              chartType === 'radar' ||
              chartType === 'polar_area' ||
              chartType === 'radial_bar' ||
              chartType === 'treemap') && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Category (Dimension)
                  </label>
                  <select
                    value={xAxisColumn}
                    onChange={e => setXAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {columns.map(c => {
                      const p = profiles[c];
                      const typeIcon = p?.type === 'numeric' ? '#' : p?.type === 'datetime' ? '📅' : 'Aa';
                      return (
                        <option key={c} value={c}>{typeIcon} {c}</option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Value (Metric)
                  </label>
                  <select
                    value={yAxisColumn}
                    onChange={e => setYAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {numCols.map(c => (
                      <option key={c} value={c}># {c}</option>
                    ))}
                    <option value="">-- Record Count --</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Aggregation
                  </label>
                  <select
                    value={aggregation}
                    onChange={e => setAggregation(e.target.value as AggregationFunction)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="sum">Sum</option>
                    <option value="avg">Average (Mean)</option>
                    <option value="median">Median</option>
                    <option value="count">Count (Total Records)</option>
                    <option value="count_distinct">Distinct Count</option>
                    <option value="min">Minimum</option>
                    <option value="max">Maximum</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Top N Slices
                  </label>
                  <select
                    value={topN}
                    onChange={e => setTopN(Number(e.target.value))}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value={0}>All Slices</option>
                    <option value={5}>Top 5 Slices</option>
                    <option value={8}>Top 8 Slices</option>
                    <option value={10}>Top 10 Slices</option>
                  </select>
                </div>
              </div>
            )}

            {/* BAR / COLUMN / HORIZONTAL_BAR / LINE / STEP_LINE / AREA CONFIGURATION */}
            {(chartType === 'bar' ||
              chartType === 'column' ||
              chartType === 'horizontal_bar' ||
              chartType === 'line' ||
              chartType === 'step_line' ||
              chartType === 'area') && (
              <div className="space-y-3">
                {/* X-Axis Slot */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    X-Axis (Category or Date)
                  </label>
                  <select
                    value={xAxisColumn}
                    onChange={e => setXAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {columns.map(c => {
                      const p = profiles[c];
                      const typeIcon = p?.type === 'numeric' ? '#' : p?.type === 'datetime' ? '📅' : 'Aa';
                      return (
                        <option key={c} value={c}>
                          {typeIcon} {c}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Y-Axis Slot */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Y-Axis (Metric)
                  </label>
                  <select
                    value={yAxisColumn}
                    onChange={e => setYAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {numCols.map(c => (
                      <option key={c} value={c}>
                        # {c}
                      </option>
                    ))}
                    <option value="">-- Record Count --</option>
                  </select>
                </div>

                {/* Aggregation Selector */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Aggregation
                  </label>
                  <select
                    value={aggregation}
                    onChange={e => setAggregation(e.target.value as AggregationFunction)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="sum">Sum</option>
                    <option value="avg">Average (Mean)</option>
                    <option value="median">Median</option>
                    <option value="count">Count (Total Records)</option>
                    <option value="count_distinct">Distinct Count</option>
                    <option value="min">Minimum</option>
                    <option value="max">Maximum</option>
                  </select>
                </div>

                {/* DATE / TIME GRANULARITY (REQUIRED WHEN X IS DATE) */}
                {isXAxisDate && (
                  <div className="bg-[#0B0D11] p-3 rounded-xl border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Time Granularity
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Calendar Aware</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      {(['auto', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const).map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setTimeGranularity(g)}
                          className={`py-1 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                            timeGranularity === g
                              ? 'bg-amber-500 text-slate-950 shadow-sm'
                              : 'bg-[#181D26] text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>

                    {/* Date Range Preset */}
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 block mb-1">Date Range</label>
                      <select
                        value={dateRangePreset}
                        onChange={e => setDateRangePreset(e.target.value as DateRangePreset)}
                        className="w-full bg-[#181D26] border border-[#2D3342] rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      >
                        <option value="all_time">All Time</option>
                        <option value="last_7_days">Last 7 Days</option>
                        <option value="last_30_days">Last 30 Days</option>
                        <option value="last_90_days">Last 90 Days</option>
                        <option value="this_year">This Year</option>
                        <option value="last_year">Last Year</option>
                        <option value="custom">Custom Date Range</option>
                      </select>
                    </div>

                    {dateRangePreset === 'custom' && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="text-[10px] text-slate-500">Start Date</span>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={e => setCustomStartDate(e.target.value)}
                            className="w-full bg-[#181D26] border border-[#2D3342] rounded-lg px-2 py-1 text-xs text-slate-200"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500">End Date</span>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={e => setCustomEndDate(e.target.value)}
                            className="w-full bg-[#181D26] border border-[#2D3342] rounded-lg px-2 py-1 text-xs text-slate-200"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Optional Group By / Legend */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Group By / Legend (Optional)
                  </label>
                  <select
                    value={groupByDimension}
                    onChange={e => setGroupByDimension(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- None (Single Series) --</option>
                    {catCols
                      .filter(c => c !== xAxisColumn)
                      .map(c => (
                        <option key={c} value={c}>
                          Aa {c}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Top N Filter */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Top N Items
                  </label>
                  <select
                    value={topN}
                    onChange={e => setTopN(Number(e.target.value))}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value={0}>All Records</option>
                    <option value={5}>Top 5</option>
                    <option value={10}>Top 10</option>
                    <option value={20}>Top 20</option>
                  </select>
                </div>
              </div>
            )}

            {/* KPI CARD CONFIGURATION */}
            {chartType === 'kpi_card' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    KPI Measure Metric
                  </label>
                  <select
                    value={yAxisColumn || xAxisColumn}
                    onChange={e => {
                      setYAxisColumn(e.target.value);
                      setXAxisColumn(e.target.value);
                    }}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {numCols.length === 0 ? (
                      <option value="">No numeric columns found</option>
                    ) : (
                      numCols.map(c => (
                        <option key={c} value={c}># {c}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Aggregation Function
                  </label>
                  <select
                    value={aggregation}
                    onChange={e => setAggregation(e.target.value as AggregationFunction)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="sum">Sum (Total)</option>
                    <option value="avg">Average (Mean)</option>
                    <option value="median">Median</option>
                    <option value="count">Count (Total Records)</option>
                    <option value="count_distinct">Distinct Count</option>
                    <option value="min">Minimum</option>
                    <option value="max">Maximum</option>
                  </select>
                </div>
              </div>
            )}

            {/* SUMMARY TABLE CONFIGURATION */}
            {chartType === 'table' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Group Dimension (Rows)
                  </label>
                  <select
                    value={xAxisColumn}
                    onChange={e => setXAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {columns.map(c => {
                      const p = profiles[c];
                      const typeIcon = p?.type === 'numeric' ? '#' : p?.type === 'datetime' ? '📅' : 'Aa';
                      return (
                        <option key={c} value={c}>
                          {typeIcon} {c}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Measure Metric (Values)
                  </label>
                  <select
                    value={yAxisColumn}
                    onChange={e => setYAxisColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {numCols.map(c => (
                      <option key={c} value={c}># {c}</option>
                    ))}
                    <option value="">-- Count of Records --</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Aggregation
                  </label>
                  <select
                    value={aggregation}
                    onChange={e => setAggregation(e.target.value as AggregationFunction)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                    <option value="median">Median</option>
                    <option value="count">Count of Records</option>
                    <option value="count_distinct">Distinct Count</option>
                    <option value="min">Minimum</option>
                    <option value="max">Maximum</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Top Rows Limit
                  </label>
                  <select
                    value={topN}
                    onChange={e => setTopN(Number(e.target.value))}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value={10}>Top 10 Rows</option>
                    <option value={20}>Top 20 Rows</option>
                    <option value={50}>Top 50 Rows</option>
                    <option value={100}>Top 100 Rows</option>
                    <option value={0}>All Rows</option>
                  </select>
                </div>
              </div>
            )}

            {/* Collapsible Advanced Options */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full px-3 py-2 rounded-xl bg-[#0B0D11] hover:bg-[#181D26] border border-[#252A36] text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-between transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Advanced Options</span>
                </span>
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showAdvanced && (
                <div className="p-3 bg-[#0B0D11] rounded-xl border border-[#252A36] mt-2 space-y-3 text-xs">
                  {/* Sorting */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 block mb-1">Sort Order</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(['desc', 'asc', 'none'] as const).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSortBy(s)}
                          className={`py-1 rounded-lg text-[10px] font-bold uppercase transition ${
                            sortBy === s ? 'bg-amber-500 text-slate-950' : 'bg-[#181D26] text-slate-400'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comparison & Moving Average (for temporal) */}
                  {isXAxisDate && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-slate-400 block">Analytical Transformation</label>
                      <select
                        value={comparisonMode}
                        onChange={e => setComparisonMode(e.target.value as ComparisonMode)}
                        className="w-full bg-[#181D26] border border-[#2D3342] rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      >
                        <option value="none">Normal Metric</option>
                        <option value="moving_average">Moving Average</option>
                        <option value="growth_rate">Period-over-Period Growth %</option>
                        <option value="cumulative">Cumulative Running Total</option>
                      </select>

                      {comparisonMode === 'moving_average' && (
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="text-slate-400">Window:</span>
                          <div className="flex items-center gap-1">
                            {[2, 3, 5, 7].map(w => (
                              <button
                                key={w}
                                type="button"
                                onClick={() => setMovingAverageWindow(w)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  movingAverageWindow === w ? 'bg-amber-500 text-slate-950' : 'bg-[#181D26] text-slate-400'
                                }`}
                              >
                                {w}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Visualization Filters */}
                  <div className="pt-2 border-t border-[#252A36] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                        <Filter className="w-3 h-3 text-amber-400" />
                        <span>Filter Conditions</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleAddFilter}
                        className="text-[10px] text-amber-400 hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        Add Filter
                      </button>
                    </div>

                    {filters.map(f => {
                      const distinctVals = getDistinctColumnValues(f.column);
                      return (
                        <div key={f.id} className="p-2.5 bg-[#181D26] rounded-xl border border-[#2D3342] space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <select
                              value={f.column}
                              onChange={e => {
                                const val = e.target.value;
                                setFilters(prev => prev.map(item => (item.id === f.id ? { ...item, column: val, value: '' } : item)));
                              }}
                              className="bg-[#0B0D11] border border-[#2D3342] rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500 font-medium flex-1"
                            >
                              {columns.map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRemoveFilter(f.id)}
                              className="text-rose-400 hover:text-rose-300 text-[10px] font-semibold px-2 py-1 rounded hover:bg-rose-500/10 transition"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Operator Dropdown */}
                            <select
                              value={f.operator}
                              onChange={e => {
                                const op = e.target.value as any;
                                setFilters(prev => prev.map(item => (item.id === f.id ? { ...item, operator: op } : item)));
                              }}
                              className="bg-[#0B0D11] border border-[#2D3342] rounded-lg px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-amber-500 font-semibold"
                            >
                              <option value="equals">=</option>
                              <option value="not_equals">≠</option>
                              <option value="contains">contains</option>
                              <option value="greater_than">&gt;</option>
                              <option value="less_than">&lt;</option>
                            </select>

                            {/* Dropdown Value Selector */}
                            <select
                              value={distinctVals.includes(String(f.value)) ? String(f.value) : ''}
                              onChange={e => {
                                const val = e.target.value;
                                setFilters(prev => prev.map(item => (item.id === f.id ? { ...item, value: val } : item)));
                              }}
                              className="w-1/2 bg-[#0B0D11] border border-[#2D3342] rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500"
                              title="Select value from dataset"
                            >
                              <option value="">-- Select Value --</option>
                              {distinctVals.map(v => (
                                <option key={v} value={v}>
                                  {v.length > 20 ? v.slice(0, 20) + '…' : v}
                                </option>
                              ))}
                            </select>

                            {/* Free-text / Custom Value Input with datalist autocomplete */}
                            <input
                              type="text"
                              placeholder="Or type value..."
                              list={`datalist_${f.id}`}
                              value={f.value ?? ''}
                              onChange={e => {
                                const v = e.target.value;
                                setFilters(prev => prev.map(item => (item.id === f.id ? { ...item, value: v } : item)));
                              }}
                              className="w-1/2 bg-[#0B0D11] border border-[#2D3342] rounded-lg px-2 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                            />
                            <datalist id={`datalist_${f.id}`}>
                              {distinctVals.map(v => (
                                <option key={v} value={v} />
                              ))}
                            </datalist>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT PANEL: LIVE PREVIEW & ACTIONS */}
        {/* ================================================================= */}
        <div className="lg:col-span-8 space-y-4">
          {/* Validation Error Banner if configuration is incomplete */}
          {!computedResult.isValid && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>{computedResult.errorMessage || 'Please adjust your field selections to render the chart.'}</span>
            </div>
          )}

          {/* Live Chart Canvas */}
          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 shadow-2xl space-y-4 relative">
            {/* Chart Title & Custom Override */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#252A36] pb-3">
              <div className="flex-1">
                {isEditingTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customTitle}
                      onChange={e => setCustomTitle(e.target.value)}
                      placeholder={computedResult.title}
                      className="bg-[#0B0D11] border border-amber-500/50 rounded-xl px-3 py-1 text-sm font-bold text-slate-100 flex-1 focus:outline-none"
                    />
                    <button
                      onClick={() => setIsEditingTitle(false)}
                      className="px-2.5 py-1 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Save Title
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-100 tracking-tight">
                      {customTitle || computedResult.title}
                    </h3>
                    <button
                      onClick={() => setIsEditingTitle(true)}
                      className="text-slate-400 hover:text-amber-400 transition"
                      title="Edit Chart Title"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-0.5">{computedResult.description}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {chartType.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Rendered Chart */}
            <ChartViewer
              type={computedResult.chartType as any}
              title={customTitle || computedResult.title}
              data={computedResult.data}
              xAxisKey={computedResult.xAxisKey}
              yAxisKey={computedResult.yAxisKey}
              groupByKey={computedResult.groupByKey}
              keys={computedResult.seriesKeys}
              xAxisLabel={computedResult.xAxisTitle}
              yAxisLabel={computedResult.yAxisTitle}
              height={380}
              description={computedResult.description}
            />

            {/* Bottom Primary Actions Strip */}
            <div className="pt-4 border-t border-[#252A36] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveVisualization(false)}
                  disabled={!computedResult.isValid}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingViz ? 'Update Visualization' : 'Save Visualization'}</span>
                </button>

                {editingViz && (
                  <button
                    onClick={() => handleSaveVisualization(true)}
                    disabled={!computedResult.isValid}
                    className="px-3.5 py-2 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-slate-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Save as a new independent chart"
                  >
                    <Copy className="w-4 h-4 text-amber-400" />
                    <span>Save as Copy</span>
                  </button>
                )}

                {editingViz && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete "${editingViz.name}"? This will remove it from all dashboards and the Executive Dashboard.`)) {
                        VisualizationEngine.deleteVisualization(editingViz.id);
                        if (onOpenDashboard) onOpenDashboard();
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                    title="Delete this chart permanently"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Chart</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    const saved = handleSaveVisualization(false);
                    if (saved) {
                      VisualizationEngine.addToExecutiveDashboard(saved.id);
                      setSavedSuccessToast(`Added "${saved.name}" to Executive Dashboard with automated summary & insights!`);
                    }
                  }}
                  disabled={!computedResult.isValid}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-amber-500/20"
                  title="Save and automatically add to Executive Dashboard with automated summary and strategic insights"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Add to Executive Dashboard</span>
                </button>

                {onOpenDashboard && (
                  <button
                    onClick={() => {
                      const saved = handleSaveVisualization(false);
                      if (saved) {
                        const dashboards = VisualizationEngine.getCustomDashboards();
                        let targetDash = dashboards[0];
                        if (!targetDash) {
                          targetDash = VisualizationEngine.createDashboard(
                            'Executive & Analytics Dashboard',
                            `Main dashboard for ${dataset.name}`
                          );
                        }
                        VisualizationEngine.addVisualizationToDashboard(targetDash.id, saved.id, 'half');
                        setSavedSuccessToast(`Added to "${targetDash.name}"!`);
                        setTimeout(() => {
                          if (onOpenDashboard) onOpenDashboard();
                        }, 500);
                      }
                    }}
                    disabled={!computedResult.isValid}
                    className="px-3.5 py-2 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-slate-300 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <LayoutDashboard className="w-4 h-4 text-amber-400" />
                    <span>Custom Dashboards</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-slate-400 hover:text-slate-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Save Success Notification Toast */}
            {savedSuccessToast && (
              <div className="absolute top-4 right-4 bg-emerald-500/90 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2 z-20 animate-fade-in">
                <Check className="w-4 h-4" />
                <span>{savedSuccessToast}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
