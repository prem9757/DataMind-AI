import React, { useRef, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  RadialBarChart,
  RadialBar,
  Treemap,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';
import {
  Download,
  Maximize2,
  Minimize2,
  TableProperties,
  Sparkles,
  SlidersHorizontal,
  ArrowUpDown,
  Filter,
  Info,
  LayoutDashboard,
  Check
} from 'lucide-react';
import { ChartType } from '../types/dataset';
import { VisualizationEngine } from '../services/visualizationEngine';
import { desktopBridge } from '../services/desktopBridge';

export interface ChartViewerProps {
  type: ChartType;
  title: string;
  data: any[];
  xAxisKey?: string;
  yAxisKey?: string;
  groupByKey?: string;
  keys?: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  height?: number;
  description?: string;
  explanation?: string;
  allowFullscreen?: boolean;
  onTypeChange?: (newType: ChartType) => void;
  onAddToDashboard?: () => void;
  showAddToDashboard?: boolean;
}

// Luxurious Executive Palette (Amber / Gold / Warm Emerald / Coral / Violet / Warm Bronze)
const PREMIUM_COLORS = [
  '#F59E0B', // Warm Amber/Gold
  '#10B981', // Emerald Mint
  '#8B5CF6', // Royal Amethyst
  '#F43F5E', // Rose Coral
  '#D97706', // Deep Bronze
  '#34D399', // Light Emerald
  '#A78BFA', // Light Violet
  '#FB7185', // Coral Blush
  '#EAB308', // Radiant Gold
  '#64748B'  // Titanium Slate
];

export const ChartViewer: React.FC<ChartViewerProps> = ({
  type: initialType,
  title,
  data: rawData = [],
  xAxisKey = 'name',
  yAxisKey = 'value',
  groupByKey,
  keys,
  xAxisLabel,
  yAxisLabel,
  height = 320,
  description,
  explanation,
  allowFullscreen = true,
  onTypeChange,
  onAddToDashboard,
  showAddToDashboard = true
}) => {
  const [currentType, setCurrentType] = useState<ChartType>(initialType);

  useEffect(() => {
    setCurrentType(initialType);
  }, [initialType]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDataTable, setShowDataTable] = useState(false);
  const [sortOrder, setSortOrder] = useState<'none' | 'desc' | 'asc'>('none');
  const [topN, setTopN] = useState<number>(10);
  const [savedToDashboard, setSavedToDashboard] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Process data with sorting and topN
  const safeData = Array.isArray(rawData) ? rawData : [];
  let processedData = [...safeData];
  const primaryKey = (keys && keys[0]) || yAxisKey || 'value';

  if (sortOrder !== 'none' && primaryKey) {
    processedData.sort((a, b) => {
      const vA = Number(a[primaryKey]) || 0;
      const vB = Number(b[primaryKey]) || 0;
      return sortOrder === 'asc' ? vA - vB : vB - vA;
    });
  }

  if (topN && processedData.length > topN && currentType !== 'line' && currentType !== 'area' && currentType !== 'scatter') {
    processedData = processedData.slice(0, topN);
  }

  // Adaptive data transformation when switching chart types dynamically
  if (currentType === 'scatter') {
    processedData = processedData.map((item, idx) => {
      const xVal = item.x !== undefined ? item.x : (item[xAxisKey] !== undefined ? item[xAxisKey] : Object.values(item)[0]);
      const yVal = item.y !== undefined ? item.y : (item[primaryKey] !== undefined ? item[primaryKey] : (item[yAxisKey || 'value'] !== undefined ? item[yAxisKey || 'value'] : Object.values(item)[1]));
      return {
        ...item,
        x: typeof xVal === 'number' ? xVal : (isNaN(Number(xVal)) ? idx : Number(xVal)),
        y: typeof yVal === 'number' ? yVal : (isNaN(Number(yVal)) ? 0 : Number(yVal)),
        name: item.name || item.label || String(item[xAxisKey] || `Obs #${idx + 1}`)
      };
    });
  } else if (currentType === 'bubble') {
    processedData = processedData.map((item, idx) => {
      const xVal = item.x !== undefined ? item.x : (item[xAxisKey] !== undefined ? item[xAxisKey] : Object.values(item)[0]);
      const yVal = item.y !== undefined ? item.y : (item[primaryKey] !== undefined ? item[primaryKey] : (item[yAxisKey || 'value'] !== undefined ? item[yAxisKey || 'value'] : Object.values(item)[1]));
      const zVal = item.z !== undefined ? item.z : (Number(item[chartKeys[1]]) || (Math.abs(Number(xVal) * Number(yVal)) % 300 + 40));
      return {
        ...item,
        x: typeof xVal === 'number' ? xVal : (isNaN(Number(xVal)) ? idx : Number(xVal)),
        y: typeof yVal === 'number' ? yVal : (isNaN(Number(yVal)) ? 0 : Number(yVal)),
        z: Math.max(30, Math.min(500, Number(zVal) || 100)),
        name: item.name || item.label || String(item[xAxisKey] || `Bubble #${idx + 1}`)
      };
    });
  } else if (
    currentType === 'donut' ||
    currentType === 'pie' ||
    currentType === 'radar' ||
    currentType === 'polar_area' ||
    currentType === 'radial_bar' ||
    currentType === 'treemap' ||
    currentType === 'funnel'
  ) {
    processedData = processedData.map((item, idx) => ({
      ...item,
      name: String(item.name || item.stage || item.category || item[xAxisKey] || `Item ${idx + 1}`),
      value: typeof item.value === 'number' ? item.value : (Number(item[primaryKey]) || Number(item[yAxisKey || 'value']) || 0)
    }));
  } else if (currentType === 'waterfall') {
    let running = 0;
    processedData = processedData.map((item, idx) => {
      const name = String(item.name || item.category || item[xAxisKey] || `Step ${idx + 1}`);
      const val = typeof item.delta === 'number' ? item.delta : (typeof item.value === 'number' ? item.value : (Number(item[primaryKey]) || 0));
      const isTotal = item.isTotal || idx === processedData.length - 1;
      const isPositive = val >= 0;
      const base = item.base !== undefined ? item.base : (isTotal ? 0 : (isPositive ? running : running + val));
      if (!isTotal) running += val;
      return {
        ...item,
        name,
        category: name,
        delta: val,
        value: val,
        base: Math.max(0, base),
        magnitude: Math.abs(val),
        cumulative: running,
        isPositive,
        isTotal: Boolean(item.isTotal)
      };
    });
  } else if (currentType === 'gauge') {
    const rawVal = processedData.length > 0 ? (Number(processedData[0].value) || Number(processedData[0][primaryKey]) || 0) : 0;
    const target = processedData[0]?.target || (rawVal > 0 ? Math.round(rawVal * 1.25) : 100);
    const pct = target > 0 ? Math.min(100, Math.round((rawVal / target) * 1000) / 10) : 0;
    processedData = [
      {
        name: title || 'Executive KPI',
        value: rawVal,
        target,
        pctOfTarget: pct,
        status: pct >= 80 ? 'On Target' : pct >= 50 ? 'At Risk' : 'Critical'
      }
    ];
  }

  const exportChartSVG = () => {
    const svgElem = containerRef.current?.querySelector('svg');
    if (!svgElem) return;
    const svgData = new XMLSerializer().serializeToString(svgElem);
    const cleanFilename = `${title.toLowerCase().replace(/[\s/\\-]+/g, '_')}_chart.svg`;
    desktopBridge.exportFile({
      defaultPath: cleanFilename,
      title: 'Export Vector SVG Chart',
      filters: [{ name: 'SVG Vector Graphic (*.svg)', extensions: ['svg'] }],
      content: svgData,
      mimeType: 'image/svg+xml;charset=utf-8'
    });
  };

  const handleSaveToDashboard = () => {
    try {
      const vizId = `viz-ai-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const savedViz: any = {
        id: vizId,
        title: title || 'Analytical Chart',
        description: generatedExplanation || description || 'Saved from AI-Powered Analytics',
        chartType: currentType,
        fieldConfig: {
          xAxisColumn: xAxisKey || 'Category',
          yAxisColumn: yAxisKey || primaryKey || 'Value',
          aggregation: 'sum',
          topN: topN || 10
        },
        result: {
          isValid: true,
          chartType: currentType,
          title: title || 'Analytical Chart',
          xAxisTitle: xAxisLabel || xAxisKey || 'Category',
          yAxisTitle: yAxisLabel || yAxisKey || 'Value',
          description: generatedExplanation || description || '',
          data: processedData,
          seriesKeys: chartKeys,
          xAxisKey: xAxisKey || 'name',
          yAxisKey: yAxisKey || primaryKey || 'value'
        },
        tags: ['AI-Generated', currentType.toUpperCase()],
        createdAt: Date.now(),
        lastModified: Date.now(),
        syncToExecutive: true
      };

      VisualizationEngine.saveVisualization(savedViz);
      VisualizationEngine.addToExecutiveDashboard(vizId);

      setSavedToDashboard(true);
      setTimeout(() => setSavedToDashboard(false), 3000);
      if (onAddToDashboard) onAddToDashboard();
    } catch (e) {
      console.warn('Failed to save viz from ChartViewer:', e);
    }
  };

  const chartKeys = keys || (yAxisKey ? [yAxisKey] : ['value']);

  const formatTooltipValue = (value: any) => {
    if (typeof value === 'number') {
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return value;
  };

  const handleTypeSwitch = (newType: ChartType) => {
    setCurrentType(newType);
    if (onTypeChange) onTypeChange(newType);
  };

  // Generate analytical interpretation if not provided
  const generatedExplanation =
    explanation ||
    (processedData.length > 0 && primaryKey
      ? `Visualizes '${primaryKey}' across ${processedData.length} records. Top observation recorded at ${Number(processedData[0]?.[primaryKey] || 0).toLocaleString()}.`
      : 'Evaluates distribution and relationship across selected variables.');

  const tableHeaders = processedData.length > 0 ? Object.keys(processedData[0]) : [];

  return (
    <div
      ref={containerRef}
      className={`bg-[#12151C] border border-[#252A36] rounded-2xl p-5 shadow-xl transition-all ${
        isFullscreen
          ? 'fixed inset-4 z-50 bg-[#0B0D11]/98 flex flex-col justify-between p-6 shadow-2xl overflow-y-auto'
          : 'relative'
      }`}
    >
      {/* Top Header & Chart Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#252A36] pb-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-100 tracking-tight">{title}</h4>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {currentType.replace('_', ' ')}
            </span>
          </div>
          {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
        </div>

        {/* Interactive Chart Controls */}
        <div className="flex items-center flex-wrap gap-1.5 self-start sm:self-auto">
          {/* Chart Type Selector with all 20 supported chart types */}
          <select
            value={currentType}
            onChange={e => handleTypeSwitch(e.target.value as ChartType)}
            className="bg-[#181D26] border border-[#2D3342] text-slate-300 text-[11px] rounded-lg px-2 py-1 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <optgroup label="Comparison & Ranking">
              <option value="bar">📊 Bar Chart</option>
              <option value="horizontal_bar">📶 Horizontal Bar</option>
              <option value="waterfall">🪜 Waterfall Bridge</option>
              <option value="funnel">⏳ Conversion Funnel</option>
            </optgroup>
            <optgroup label="Trends & Sequences">
              <option value="line">📈 Line Trend</option>
              <option value="step_line">🪜 Step Line</option>
              <option value="area">📉 Area Chart</option>
              <option value="composed">📑 Combo Dual-Axis</option>
            </optgroup>
            <optgroup label="Composition & Radial">
              <option value="pie">🥧 Pie Chart</option>
              <option value="donut">🍩 Donut Chart</option>
              <option value="radar">🕸️ Radar / Spider</option>
              <option value="polar_area">🎯 Polar Area</option>
              <option value="radial_bar">💫 Radial Bar</option>
              <option value="treemap">🗂️ Treemap</option>
            </optgroup>
            <optgroup label="Relationships & Matrix">
              <option value="scatter">⁖ Scatter Plot</option>
              <option value="bubble">🫧 Bubble Chart</option>
              <option value="heatmap">🗺️ Matrix Heatmap</option>
            </optgroup>
            <optgroup label="Statistical & Executive">
              <option value="histogram">🏛️ Histogram</option>
              <option value="box">📦 Box Plot</option>
              <option value="gauge">🧭 KPI Performance Gauge</option>
            </optgroup>
          </select>

          {/* Pin to Dashboard & Executive View */}
          <button
            onClick={handleSaveToDashboard}
            title={savedToDashboard ? "Pinned to Dashboard & Executive View" : "Pin to Executive & Custom Dashboards"}
            className={`p-1.5 rounded-lg border flex items-center gap-1.5 transition cursor-pointer ${
              savedToDashboard
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                : 'bg-[#181D26] text-slate-400 border-[#2D3342] hover:text-amber-400 hover:border-amber-500/40'
            }`}
          >
            {savedToDashboard ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-semibold">Pinned!</span>
              </>
            ) : (
              <>
                <LayoutDashboard className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] hidden sm:inline text-slate-300">Add to Dashboard</span>
              </>
            )}
          </button>

          {/* Sort Order */}
          <button
            onClick={() => setSortOrder(prev => (prev === 'none' ? 'desc' : prev === 'desc' ? 'asc' : 'none'))}
            title={`Sort: ${sortOrder}`}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition ${
              sortOrder !== 'none'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-[#181D26] text-slate-400 border-[#2D3342] hover:text-slate-200'
            }`}
          >
            <ArrowUpDown className="w-3 h-3" />
            <span className="uppercase text-[10px]">{sortOrder}</span>
          </button>

          {/* View Exact Data Table */}
          <button
            onClick={() => setShowDataTable(!showDataTable)}
            title="Inspect exact aggregated table data"
            className={`p-1.5 rounded-lg border transition ${
              showDataTable
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-[#181D26] text-slate-400 border-[#2D3342] hover:text-slate-200'
            }`}
          >
            <TableProperties className="w-3.5 h-3.5" />
          </button>

          {/* Download SVG */}
          <button
            onClick={exportChartSVG}
            title="Download Vector Graphic"
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-[#181D26] border border-[#2D3342] rounded-lg transition"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          {allowFullscreen && (
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-[#181D26] border border-[#2D3342] rounded-lg transition"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
      <div style={{ height: isFullscreen ? 'calc(100vh - 220px)' : height }} className="w-full min-w-0">
        {processedData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
            No chart observations available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {currentType === 'bar' ? (
              <BarChart data={processedData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252A36" vertical={false} />
                <XAxis
                  dataKey={xAxisKey}
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  label={xAxisLabel ? { value: xAxisLabel, position: 'bottom', offset: 10, fill: '#94A3B8', fontSize: 11 } : undefined}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={val => (typeof val === 'number' && Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                  label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 } : undefined}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0D11', borderColor: '#2D3342', borderRadius: '10px', fontSize: '12px' }}
                  itemStyle={{ color: '#F8FAFC' }}
                  formatter={formatTooltipValue}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                {chartKeys.map((k, idx) => (
                  <Bar key={k} dataKey={k} fill={PREMIUM_COLORS[idx % PREMIUM_COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            ) : currentType === 'horizontal_bar' ? (
              <BarChart data={processedData} layout="vertical" margin={{ top: 10, right: 20, left: 35, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252A36" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={val => (typeof val === 'number' && Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <YAxis dataKey={xAxisKey} type="category" stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0D11', borderColor: '#2D3342', borderRadius: '10px', fontSize: '12px' }}
                  itemStyle={{ color: '#F8FAFC' }}
                  formatter={formatTooltipValue}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {chartKeys.map((k, idx) => (
                  <Bar key={k} dataKey={k} fill={PREMIUM_COLORS[idx % PREMIUM_COLORS.length]} radius={[0, 4, 4, 0]} />
                ))}
              </BarChart>
            ) : currentType === 'line' ? (
              <LineChart data={processedData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252A36" vertical={false} />
                <XAxis dataKey={xAxisKey} stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={val => (typeof val === 'number' && Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0D11', borderColor: '#2D3342', borderRadius: '10px', fontSize: '12px' }}
                  itemStyle={{ color: '#F8FAFC' }}
                  formatter={formatTooltipValue}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                {chartKeys.map((k, idx) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stroke={PREMIUM_COLORS[idx % PREMIUM_COLORS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: PREMIUM_COLORS[idx % PREMIUM_COLORS.length] }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            ) : currentType === 'area' ? (
              <AreaChart data={processedData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252A36" vertical={false} />
                <XAxis dataKey={xAxisKey} stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={val => (typeof val === 'number' && Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0D11', borderColor: '#2D3342', borderRadius: '10px', fontSize: '12px' }}
                  itemStyle={{ color: '#F8FAFC' }}
                  formatter={formatTooltipValue}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                {chartKeys.map((k, idx) => (
                  <Area
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stroke={PREMIUM_COLORS[idx % PREMIUM_COLORS.length]}
                    fill={PREMIUM_COLORS[idx % PREMIUM_COLORS.length]}
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            ) : currentType === 'scatter' ? (
              <ScatterChart margin={{ top: 15, right: 25, left: 15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252A36" />
                <XAxis
                  type={processedData.length > 0 && typeof processedData[0]?.x === 'string' ? 'category' : 'number'}
                  dataKey="x"
                  name={xAxisLabel || 'X Value'}
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  domain={processedData.length > 0 && typeof processedData[0]?.x === 'number' ? ['auto', 'auto'] : undefined}
                  allowDuplicatedCategory={false}
                  label={xAxisLabel ? { value: xAxisLabel, position: 'bottom', offset: 12, fill: '#94A3B8', fontSize: 11 } : undefined}
                  tickFormatter={val => (typeof val === 'number' && Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={yAxisLabel || 'Y Value'}
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  domain={['auto', 'auto']}
                  label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 } : undefined}
                  tickFormatter={val => (typeof val === 'number' && Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3', stroke: '#F59E0B', strokeOpacity: 0.5 }}
                  contentStyle={{ backgroundColor: '#0B0D11', borderColor: '#2D3342', borderRadius: '10px', fontSize: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                  formatter={formatTooltipValue}
                />
                <Scatter name={title} data={processedData} fill="#F59E0B" fillOpacity={0.65} stroke="#D97706" strokeWidth={1} />
              </ScatterChart>
            ) : currentType === 'box' ? (
              <div className="w-full h-full relative flex items-center justify-center">
                {(() => {
                  const validBoxes = processedData.filter(d => d.min !== undefined && d.max !== undefined);
                  if (validBoxes.length === 0) {
                    return <div className="text-xs text-slate-500 font-mono">No valid box plot metrics available</div>;
                  }

                  const allMins = validBoxes.map(d => Number(d.min) || 0);
                  const allMaxs = validBoxes.map(d => Number(d.max) || 0);
                  const globalMin = Math.min(...allMins);
                  const globalMax = Math.max(...allMaxs);
                  const span = (globalMax - globalMin) || 1;
                  const padding = span * 0.1;
                  const yMin = globalMin - padding;
                  const yMax = globalMax + padding;
                  const totalSpan = yMax - yMin;

                  const width = 600;
                  const chartHeight = 280;
                  const marginLeft = 60;
                  const marginRight = 30;
                  const marginTop = 20;
                  const marginBottom = 40;
                  const plotWidth = width - marginLeft - marginRight;
                  const plotHeight = chartHeight - marginTop - marginBottom;

                  const getY = (val: number) => {
                    const normalized = (val - yMin) / totalSpan;
                    return marginTop + plotHeight - normalized * plotHeight;
                  };

                  const numBoxes = validBoxes.length;
                  const boxWidth = Math.min(60, Math.max(24, plotWidth / (numBoxes * 2)));
                  const step = plotWidth / numBoxes;

                  // 5 Y ticks
                  const ticks = [0, 0.25, 0.5, 0.75, 1].map(pct => yMin + pct * totalSpan);

                  return (
                    <svg viewBox={`0 0 ${width} ${chartHeight}`} className="w-full h-full max-h-full">
                      {/* Grid Lines and Y-Axis Ticks */}
                      {ticks.map((t, i) => {
                        const y = getY(t);
                        return (
                          <g key={i}>
                            <line x1={marginLeft} y1={y} x2={width - marginRight} y2={y} stroke="#252A36" strokeDasharray="3 3" />
                            <text x={marginLeft - 8} y={y + 3} fill="#64748B" fontSize={10} textAnchor="end" fontFamily="monospace">
                              {t >= 1000 ? `${(t / 1000).toFixed(1)}k` : t.toFixed(0)}
                            </text>
                          </g>
                        );
                      })}

                      {/* Boxes */}
                      {validBoxes.map((box, idx) => {
                        const centerX = marginLeft + idx * step + step / 2;
                        const min = Number(box.min) || 0;
                        const q1 = Number(box.q1) || 0;
                        const median = Number(box.median) || 0;
                        const q3 = Number(box.q3) || 0;
                        const max = Number(box.max) || 0;
                        const mean = Number(box.mean) || 0;

                        const yMinVal = getY(min);
                        const yMaxVal = getY(max);
                        const yQ1 = getY(q1);
                        const yQ3 = getY(q3);
                        const yMedian = getY(median);
                        const yMean = getY(mean);

                        const color = PREMIUM_COLORS[idx % PREMIUM_COLORS.length];

                        return (
                          <g key={box.category || idx} className="cursor-pointer group">
                            <title>
                              {`${box.category || 'Group'}\n• Min: ${min.toLocaleString()}\n• Q1 (25%): ${q1.toLocaleString()}\n• Median: ${median.toLocaleString()}\n• Q3 (75%): ${q3.toLocaleString()}\n• Max: ${max.toLocaleString()}\n• Mean: ${mean.toLocaleString()}\n• Count: ${(box.count || 0).toLocaleString()}`}
                            </title>

                            {/* Whisker vertical line */}
                            <line x1={centerX} y1={yMinVal} x2={centerX} y2={yMaxVal} stroke={color} strokeWidth={1.5} />

                            {/* Whisker min/max caps */}
                            <line x1={centerX - boxWidth / 4} y1={yMinVal} x2={centerX + boxWidth / 4} y2={yMinVal} stroke={color} strokeWidth={2} />
                            <line x1={centerX - boxWidth / 4} y1={yMaxVal} x2={centerX + boxWidth / 4} y2={yMaxVal} stroke={color} strokeWidth={2} />

                            {/* Box (Q1 to Q3) */}
                            <rect
                              x={centerX - boxWidth / 2}
                              y={Math.min(yQ1, yQ3)}
                              width={boxWidth}
                              height={Math.max(2, Math.abs(yQ1 - yQ3))}
                              fill={color}
                              fillOpacity={0.25}
                              stroke={color}
                              strokeWidth={2}
                              rx={4}
                            />

                            {/* Median Line */}
                            <line
                              x1={centerX - boxWidth / 2}
                              y1={yMedian}
                              x2={centerX + boxWidth / 2}
                              y2={yMedian}
                              stroke="#FFFFFF"
                              strokeWidth={2.5}
                            />

                            {/* Mean Point Indicator (Diamond) */}
                            <polygon
                              points={`${centerX},${yMean - 4} ${centerX + 4},${yMean} ${centerX},${yMean + 4} ${centerX - 4},${yMean}`}
                              fill="#10B981"
                              stroke="#0B0D11"
                              strokeWidth={1}
                            />

                            {/* X-Axis Category Label */}
                            <text
                              x={centerX}
                              y={chartHeight - marginBottom + 18}
                              fill="#94A3B8"
                              fontSize={11}
                              textAnchor="middle"
                              fontWeight="600"
                            >
                              {(box.category || `G${idx + 1}`).length > 12
                                ? (box.category || `G${idx + 1}`).slice(0, 10) + '…'
                                : box.category || `G${idx + 1}`}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
            ) : currentType === 'donut' || currentType === 'pie' ? (
              <PieChart>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0D11', borderColor: '#2D3342', borderRadius: '10px', fontSize: '12px' }}
                  itemStyle={{ color: '#F8FAFC' }}
                  formatter={formatTooltipValue}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Pie
                  data={processedData}
                  dataKey={yAxisKey || 'value'}
                  nameKey={xAxisKey || 'name'}
                  cx="50%"
                  cy="50%"
                  innerRadius={currentType === 'donut' ? 50 : 0}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {processedData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PREMIUM_COLORS[index % PREMIUM_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            ) : currentType === 'step_line' ? (
              <LineChart data={processedData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252A36" vertical={false} />
                <XAxis dataKey={xAxisKey} stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={val => (typeof val === 'number' && Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0D11', borderColor: '#2D3342', borderRadius: '10px', fontSize: '12px' }}
                  itemStyle={{ color: '#F8FAFC' }}
                  formatter={formatTooltipValue}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                {chartKeys.map((k, idx) => (
                  <Line
                    key={k}
                    type="stepAfter"
                    dataKey={k}
                    stroke={PREMIUM_COLORS[idx % PREMIUM_COLORS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: PREMIUM_COLORS[idx % PREMIUM_COLORS.length] }}
                  />
                ))}
              </LineChart>
            ) : currentType === 'composed' ? (
              <ComposedChart data={processedData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252A36" vertical={false} />
                <XAxis dataKey={xAxisKey} stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis
                  yAxisId="left"
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={val => (typeof val === 'number' && Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={val => (typeof val === 'number' && Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0D11', borderColor: '#2D3342', borderRadius: '10px', fontSize: '12px' }}
                  itemStyle={{ color: '#F8FAFC' }}
                  formatter={formatTooltipValue}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar yAxisId="left" dataKey={chartKeys[0] || primaryKey} fill="#F59E0B" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey={chartKeys[1] || 'trend'}
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#10B981' }}
                />
              </ComposedChart>
            ) : currentType === 'bubble' ? (
              <ScatterChart margin={{ top: 15, right: 25, left: 15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252A36" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={xAxisLabel || 'X Value'}
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={val => (typeof val === 'number' && Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={yAxisLabel || 'Y Value'}
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={val => (typeof val === 'number' && Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <ZAxis type="number" dataKey="z" range={[60, 450]} name="Magnitude" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3', stroke: '#F59E0B', strokeOpacity: 0.5 }}
                  contentStyle={{ backgroundColor: '#0B0D11', borderColor: '#2D3342', borderRadius: '10px', fontSize: '12px' }}
                  formatter={formatTooltipValue}
                />
                <Scatter name={title} data={processedData} fill="#F59E0B" fillOpacity={0.65} stroke="#D97706" strokeWidth={1} />
              </ScatterChart>
            ) : currentType === 'radar' || currentType === 'polar_area' ? (
              <RadarChart data={processedData} cx="50%" cy="50%" outerRadius="75%">
                <PolarGrid stroke="#252A36" />
                <PolarAngleAxis dataKey={xAxisKey || 'name'} stroke="#94A3B8" fontSize={11} />
                <PolarRadiusAxis stroke="#64748B" fontSize={10} />
                <Radar
                  name={title}
                  dataKey={yAxisKey || 'value'}
                  stroke={currentType === 'polar_area' ? '#10B981' : '#F59E0B'}
                  fill={currentType === 'polar_area' ? '#10B981' : '#F59E0B'}
                  fillOpacity={currentType === 'polar_area' ? 0.55 : 0.4}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0D11', borderColor: '#2D3342', borderRadius: '10px', fontSize: '12px' }}
                  formatter={formatTooltipValue}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </RadarChart>
            ) : currentType === 'radial_bar' ? (
              <RadialBarChart innerRadius="25%" outerRadius="90%" data={processedData} startAngle={180} endAngle={0}>
                <RadialBar background={{ fill: '#181D26' }} dataKey={yAxisKey || 'value'}>
                  {processedData.map((_, i) => (
                    <Cell key={i} fill={PREMIUM_COLORS[i % PREMIUM_COLORS.length]} />
                  ))}
                </RadialBar>
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0D11', borderColor: '#2D3342', borderRadius: '10px', fontSize: '12px' }}
                  formatter={formatTooltipValue}
                />
              </RadialBarChart>
            ) : currentType === 'treemap' ? (
              <Treemap
                data={processedData}
                dataKey={yAxisKey || 'value'}
                aspectRatio={4 / 3}
                stroke="#12151C"
                fill="#F59E0B"
              >
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0D11', borderColor: '#2D3342', borderRadius: '10px', fontSize: '12px' }}
                  formatter={formatTooltipValue}
                />
              </Treemap>
            ) : currentType === 'funnel' ? (
              <FunnelChart>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0D11', borderColor: '#2D3342', borderRadius: '10px', fontSize: '12px' }}
                  formatter={formatTooltipValue}
                />
                <Funnel dataKey={yAxisKey || 'value'} data={processedData} isAnimationActive>
                  {processedData.map((_, i) => (
                    <Cell key={i} fill={PREMIUM_COLORS[i % PREMIUM_COLORS.length]} />
                  ))}
                  <LabelList position="right" fill="#F8FAFC" stroke="none" dataKey={xAxisKey || 'name'} fontSize={11} />
                </Funnel>
              </FunnelChart>
            ) : currentType === 'waterfall' ? (
              <div className="w-full h-full relative flex items-center justify-center p-2">
                {(() => {
                  const items = processedData;
                  if (items.length === 0) return <div className="text-xs text-slate-500 font-mono">No waterfall data</div>;

                  const maxVal = Math.max(...items.map(it => Math.max(it.base + it.magnitude, it.cumulative || 0, it.value || 0)));
                  const minVal = Math.min(0, ...items.map(it => Math.min(it.base, it.cumulative || 0, it.value || 0)));
                  const span = (maxVal - minVal) || 1;
                  const w = 600;
                  const h = 280;
                  const padX = 45;
                  const padY = 30;
                  const colW = Math.min(50, Math.max(20, (w - padX * 2) / (items.length * 1.6)));
                  const stepX = (w - padX * 2) / items.length;

                  const getY = (val: number) => {
                    const norm = (val - minVal) / span;
                    return h - padY - norm * (h - padY * 2);
                  };

                  const zeroY = getY(0);

                  return (
                    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
                      {/* Zero baseline */}
                      <line x1={padX} y1={zeroY} x2={w - padX} y2={zeroY} stroke="#334155" strokeDasharray="3 3" />

                      {items.map((it, idx) => {
                        const cx = padX + idx * stepX + stepX / 2;
                        const isTotal = it.isTotal || idx === items.length - 1;
                        const isPositive = it.delta >= 0;
                        const yTop = getY(it.base + it.magnitude);
                        const yBot = getY(it.base);
                        const barHeight = Math.max(4, Math.abs(yBot - yTop));
                        const barY = Math.min(yTop, yBot);
                        const fill = isTotal ? '#F59E0B' : isPositive ? '#10B981' : '#F43F5E';

                        return (
                          <g key={idx} className="cursor-pointer group">
                            <title>{`${it.name}: ${it.delta >= 0 ? '+' : ''}${it.delta?.toLocaleString()} (Cum: ${it.cumulative?.toLocaleString()})`}</title>
                            <rect
                              x={cx - colW / 2}
                              y={barY}
                              width={colW}
                              height={barHeight}
                              fill={fill}
                              rx={3}
                              className="transition hover:opacity-80"
                            />
                            <text
                              x={cx}
                              y={barY - 6}
                              fill="#E2E8F0"
                              fontSize={9}
                              textAnchor="middle"
                              fontWeight="600"
                            >
                              {it.delta >= 0 ? `+${it.delta}` : it.delta}
                            </text>
                            <text
                              x={cx}
                              y={h - 10}
                              fill="#94A3B8"
                              fontSize={10}
                              textAnchor="middle"
                            >
                              {it.name.length > 8 ? it.name.slice(0, 7) + '…' : it.name}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
            ) : currentType === 'heatmap' ? (
              <div className="w-full h-full relative flex items-center justify-center p-2 overflow-auto">
                {(() => {
                  const rows = processedData;
                  if (rows.length === 0) return <div className="text-xs text-slate-500 font-mono">No matrix data</div>;
                  const rowKeys = rows.map(r => String(r[xAxisKey] || r.name || 'Row'));
                  const colKeys = chartKeys.length > 0 ? chartKeys : Object.keys(rows[0]).filter(k => k !== xAxisKey && k !== 'name');

                  let maxVal = -Infinity;
                  let minVal = Infinity;
                  rows.forEach(r => {
                    colKeys.forEach(k => {
                      const v = Number(r[k]) || 0;
                      if (v > maxVal) maxVal = v;
                      if (v < minVal) minVal = v;
                    });
                  });
                  if (maxVal === -Infinity) maxVal = 1;
                  if (minVal === Infinity) minVal = 0;
                  const span = (maxVal - minVal) || 1;

                  return (
                    <div className="w-full max-w-xl">
                      <div
                        className="grid gap-1.5"
                        style={{ gridTemplateColumns: `auto repeat(${colKeys.length}, minmax(0, 1fr))` }}
                      >
                        {/* Header corner */}
                        <div className="text-[10px] text-slate-500 font-mono px-2 py-1">Row \ Col</div>
                        {colKeys.map(c => (
                          <div key={c} className="text-[10px] text-slate-400 font-semibold text-center truncate px-1 py-1" title={c}>
                            {c}
                          </div>
                        ))}

                        {/* Rows and cells */}
                        {rows.map((r, rIdx) => (
                          <React.Fragment key={rIdx}>
                            <div className="text-[10px] text-slate-300 font-medium truncate px-2 py-1.5 flex items-center" title={rowKeys[rIdx]}>
                              {rowKeys[rIdx]}
                            </div>
                            {colKeys.map(c => {
                              const val = Number(r[c]) || 0;
                              const intensity = Math.max(0.1, (val - minVal) / span);
                              return (
                                <div
                                  key={c}
                                  className="h-9 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-100 transition hover:scale-105 cursor-pointer border border-[#232936]"
                                  style={{
                                    backgroundColor: `rgba(245, 158, 11, ${intensity.toFixed(2)})`
                                  }}
                                  title={`${rowKeys[rIdx]} × ${c}: ${val.toLocaleString()}`}
                                >
                                  {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                                </div>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : currentType === 'gauge' ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-4">
                {(() => {
                  const g = processedData[0] || { value: 0, target: 100, pctOfTarget: 0, status: 'Critical' };
                  const val = Number(g.value) || 0;
                  const target = Number(g.target) || 100;
                  const pct = Math.min(100, Math.max(0, Number(g.pctOfTarget) || Math.round((val / target) * 100)));
                  const status = g.status || (pct >= 80 ? 'On Target' : pct >= 50 ? 'At Risk' : 'Critical');
                  const statusColor = status === 'On Target' ? '#10B981' : status === 'At Risk' ? '#F59E0B' : '#F43F5E';

                  // Semi-circle gauge angle: 180 to 0 degrees
                  const angle = 180 - (pct / 100) * 180;
                  const rad = (angle * Math.PI) / 180;
                  const needleLength = 70;
                  const needleX = 100 + needleLength * Math.cos(rad);
                  const needleY = 100 - needleLength * Math.sin(rad);

                  return (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <svg viewBox="0 0 200 120" className="w-56 h-36">
                        {/* Gauge Arc Background */}
                        <path
                          d="M 20 100 A 80 80 0 0 1 180 100"
                          fill="none"
                          stroke="#1E2430"
                          strokeWidth="16"
                          strokeLinecap="round"
                        />
                        {/* Zone 1: Critical (Red) */}
                        <path
                          d="M 20 100 A 80 80 0 0 1 60 43"
                          fill="none"
                          stroke="#F43F5E"
                          strokeWidth="16"
                          strokeOpacity={0.3}
                        />
                        {/* Zone 2: At Risk (Amber) */}
                        <path
                          d="M 60 43 A 80 80 0 0 1 140 43"
                          fill="none"
                          stroke="#F59E0B"
                          strokeWidth="16"
                          strokeOpacity={0.3}
                        />
                        {/* Zone 3: On Target (Emerald) */}
                        <path
                          d="M 140 43 A 80 80 0 0 1 180 100"
                          fill="none"
                          stroke="#10B981"
                          strokeWidth="16"
                          strokeOpacity={0.3}
                        />

                        {/* Needle */}
                        <line
                          x1="100"
                          y1="100"
                          x2={needleX}
                          y2={needleY}
                          stroke="#F8FAFC"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                        <circle cx="100" cy="100" r="7" fill={statusColor} stroke="#0B0D11" strokeWidth="2" />
                      </svg>

                      <div className="text-center space-y-1">
                        <div className="text-2xl font-bold text-slate-100">
                          {val.toLocaleString()}
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                            style={{
                              backgroundColor: `${statusColor}20`,
                              color: statusColor,
                              border: `1px solid ${statusColor}40`
                            }}
                          >
                            {status}
                          </span>
                          <span className="text-xs text-slate-400">
                            {pct}% of {target.toLocaleString()} benchmark
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : null}
          </ResponsiveContainer>
        )}
      </div>

      {/* "What This Shows" Analytical Interpretation Paragraph */}
      <div className="mt-3 pt-2.5 border-t border-[#252A36] text-[11px] text-slate-400 flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-amber-400 mr-1">Analytical Meaning:</strong>
          <span>{generatedExplanation}</span>
        </div>
      </div>

      {/* View Exact Data Table Drawer */}
      {showDataTable && (
        <div className="mt-3 p-3 bg-[#0B0D11] border border-[#252A36] rounded-xl text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Aggregated Chart Records ({processedData.length} rows)
            </span>
            <button
              onClick={() => setShowDataTable(false)}
              className="text-[10px] text-slate-400 hover:text-slate-200"
            >
              Hide Table
            </button>
          </div>
          <div className="overflow-x-auto max-h-48 custom-scrollbar">
            <table className="w-full text-left border-collapse text-[11px] font-mono">
              <thead>
                <tr className="border-b border-[#252A36] text-slate-400 bg-[#12151C]">
                  {tableHeaders.map(h => (
                    <th key={h} className="px-2.5 py-1.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E232E] text-slate-300">
                {processedData.map((r, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#181D26]">
                    {tableHeaders.map(h => (
                      <td key={h} className="px-2.5 py-1 truncate max-w-xs">
                        {typeof r[h] === 'number' ? r[h].toLocaleString() : String(r[h] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
