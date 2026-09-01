import React, { useRef, useState } from 'react';
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
  CartesianGrid,
  Tooltip,
  Legend
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
  Info
} from 'lucide-react';
import { ChartType } from '../types/dataset';

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
  onTypeChange
}) => {
  const [currentType, setCurrentType] = useState<ChartType>(initialType);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDataTable, setShowDataTable] = useState(false);
  const [sortOrder, setSortOrder] = useState<'none' | 'desc' | 'asc'>('none');
  const [topN, setTopN] = useState<number>(10);
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

  if (topN && processedData.length > topN && currentType !== 'line' && currentType !== 'area') {
    processedData = processedData.slice(0, topN);
  }

  const exportChartSVG = () => {
    const svgElem = containerRef.current?.querySelector('svg');
    if (!svgElem) return;
    const svgData = new XMLSerializer().serializeToString(svgElem);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `${title.toLowerCase().replace(/[\s/\\-]+/g, '_')}_chart.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
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
          {/* Chart Type Selector */}
          <select
            value={currentType}
            onChange={e => handleTypeSwitch(e.target.value as ChartType)}
            className="bg-[#181D26] border border-[#2D3342] text-slate-300 text-[11px] rounded-lg px-2 py-1 font-medium focus:outline-none focus:border-amber-500"
          >
            <option value="bar">Bar Chart</option>
            <option value="horizontal_bar">Horizontal Bar</option>
            <option value="line">Line Trend</option>
            <option value="area">Area Chart</option>
            <option value="scatter">Scatter Plot</option>
            <option value="histogram">Histogram</option>
            <option value="box">Box Plot</option>
            <option value="donut">Donut / Pie</option>
          </select>

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
              <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252A36" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={xAxisLabel || 'X Value'}
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  label={xAxisLabel ? { value: xAxisLabel, position: 'bottom', offset: 10, fill: '#94A3B8', fontSize: 11 } : undefined}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={yAxisLabel || 'Y Value'}
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 } : undefined}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ backgroundColor: '#0B0D11', borderColor: '#2D3342', borderRadius: '10px', fontSize: '12px' }}
                  formatter={formatTooltipValue}
                />
                <Scatter name={title} data={processedData} fill="#F59E0B" fillOpacity={0.7} />
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
            ) : (
              <BarChart data={processedData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252A36" vertical={false} />
                <XAxis dataKey={xAxisKey} stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0B0D11', borderColor: '#2D3342', borderRadius: '10px' }} />
                <Bar dataKey={yAxisKey} fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
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
