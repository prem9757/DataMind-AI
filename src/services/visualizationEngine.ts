// ============================================================================
// PHASE 9: POWER BI-STYLE VISUALIZATION ENGINE & CALCULATION SERVICE
// ============================================================================

import { DatasetState } from '../types/dataset';
import {
  ExtendedChartType,
  VisualizationFieldConfig,
  SavedVisualization,
  CustomDashboard,
  CustomDashboardItem,
  VisualizationTemplate,
  DashboardKPICard,
  DashboardActiveFilter,
  StructuredDashboardInsight
} from '../types/visualization';
import { ChartTitleEngine } from './chartTitleEngine';
import { TemporalEngine } from './temporalEngine';
import { TimeGranularity, AggregationFunction, ComparisonMode } from '../types/temporal';
import * as ss from 'simple-statistics';

const STORAGE_KEYS = {
  SAVED_VIZ: 'datamind_saved_visualizations_v9',
  CUSTOM_DASHBOARDS: 'datamind_custom_dashboards_v9',
  EXECUTIVE_CHARTS: 'datamind_executive_dashboard_charts_v9',
  EXECUTIVE_REMOVED: 'datamind_executive_removed_charts_v9'
};

export interface ChartExecutiveSummary {
  headline: string;
  narrative: string;
  keyInsights: string[];
  metrics: { label: string; value: string; helper?: string }[];
}

export interface VisualizationComputationResult {
  isValid: boolean;
  errorMessage?: string;
  chartType: ExtendedChartType;
  title: string;
  xAxisTitle: string;
  yAxisTitle: string;
  description: string;
  data: any[];
  seriesKeys: string[];
  xAxisKey: string;
  yAxisKey: string;
  groupByKey?: string;
  tableData?: {
    headers: string[];
    rows: (string | number)[][];
  };
  summaryMetrics?: {
    totalRecords: number;
    aggregateValue: number;
    averageValue: number;
    distinctGroups: number;
  };
}

export class VisualizationEngine {
  /**
   * Main computation pipeline for any chart configuration.
   */
  public static compute(
    dataset: DatasetState,
    config: VisualizationFieldConfig,
    chartType: ExtendedChartType,
    customTitleOverride?: string
  ): VisualizationComputationResult {
    const { workingRows, columns, profiles } = dataset;
    const {
      xAxisColumn,
      yAxisColumn,
      secondaryColumn,
      aggregation = 'sum',
      timeGranularity = 'auto',
      dateRange = { preset: 'all_time' },
      groupByDimension,
      topN = 0,
      sortBy = 'desc',
      comparisonMode = 'none',
      movingAverageWindow = 3,
      referenceLine = 'none',
      referenceConstantValue,
      filters = []
    } = config;

    // 1. Basic validation
    if (!xAxisColumn && chartType !== 'histogram' && chartType !== 'box') {
      return this.errorResult(chartType, 'Please select an X-Axis / Category column to generate the visualization.');
    }

    if (chartType === 'histogram') {
      const histCol = yAxisColumn || xAxisColumn;
      if (!histCol || !columns.includes(histCol)) {
        return this.errorResult(chartType, 'Please select a numeric column for the Histogram distribution.');
      }
      const p = profiles[histCol];
      if (p && p.type !== 'numeric') {
        return this.errorResult(chartType, `"${this.formatName(histCol)}" must be a numeric column for Histogram distribution.`);
      }
      return this.computeHistogram(workingRows, histCol, customTitleOverride);
    }

    if (chartType === 'box') {
      const boxCol = yAxisColumn || xAxisColumn;
      if (!boxCol || !columns.includes(boxCol)) {
        return this.errorResult(chartType, 'Please select a numeric column for the Box Plot distribution.');
      }
      const p = profiles[boxCol];
      if (p && p.type !== 'numeric') {
        return this.errorResult(chartType, `"${this.formatName(boxCol)}" must be a numeric column for Box Plot.`);
      }
      return this.computeBoxPlot(
        workingRows,
        boxCol,
        secondaryColumn || (xAxisColumn !== boxCol ? xAxisColumn : groupByDimension),
        customTitleOverride
      );
    }

    if (!columns.includes(xAxisColumn)) {
      return this.errorResult(chartType, `Selected column "${xAxisColumn}" was not found in the current dataset.`);
    }

    if (yAxisColumn && !columns.includes(yAxisColumn)) {
      return this.errorResult(chartType, `Selected column "${yAxisColumn}" was not found in the current dataset.`);
    }

    if (chartType === 'scatter') {
      if (!yAxisColumn) {
        return this.errorResult(chartType, 'Scatter plot requires both X-Axis and Y-Axis numeric metrics.');
      }
      const pX = profiles[xAxisColumn];
      const pY = profiles[yAxisColumn];
      if (pX && pX.type !== 'numeric') {
        return this.errorResult(chartType, `X-Axis "${this.formatName(xAxisColumn)}" must be a numeric field for Scatter Plot.`);
      }
      if (pY && pY.type !== 'numeric') {
        return this.errorResult(chartType, `Y-Axis "${this.formatName(yAxisColumn)}" must be a numeric field for Scatter Plot.`);
      }
    }

    // 2. Apply visualization-level filters
    let filteredRows = [...workingRows];
    if (filters && filters.length > 0) {
      filteredRows = filteredRows.filter(row => {
        return filters.every(f => {
          if (!f.column || f.value === undefined || f.value === '') return true;
          const cellVal = row[f.column];
          if (cellVal === undefined || cellVal === null) return false;
          
          if (f.operator === 'equals') return String(cellVal).toLowerCase() === String(f.value).toLowerCase();
          if (f.operator === 'not_equals') return String(cellVal).toLowerCase() !== String(f.value).toLowerCase();
          if (f.operator === 'contains') return String(cellVal).toLowerCase().includes(String(f.value).toLowerCase());
          if (f.operator === 'greater_than') return Number(cellVal) > Number(f.value);
          if (f.operator === 'less_than') return Number(cellVal) < Number(f.value);
          return true;
        });
      });
    }

    if (filteredRows.length === 0) {
      return this.errorResult(chartType, 'No data points match the applied filters.');
    }

    const xProfile = profiles[xAxisColumn];
    const isDateX = xProfile && (xProfile.type === 'datetime' || /date|time|timestamp|day|month|year|created/i.test(xAxisColumn));

    // 3. Temporal Execution Path (When X is Date and metric is provided)
    if (isDateX && yAxisColumn) {
      return this.computeTemporalChart(
        filteredRows,
        xAxisColumn,
        yAxisColumn,
        aggregation as AggregationFunction,
        timeGranularity,
        dateRange,
        groupByDimension || secondaryColumn,
        topN,
        chartType,
        comparisonMode,
        movingAverageWindow,
        customTitleOverride
      );
    }

    // 4. Scatter & Bubble Plot Execution Path
    if (chartType === 'scatter') {
      if (!yAxisColumn) {
        return this.errorResult(chartType, 'Scatter plot requires both X-Axis and Y-Axis numeric metrics.');
      }
      return this.computeScatterPlot(
        filteredRows,
        xAxisColumn,
        yAxisColumn,
        secondaryColumn || groupByDimension,
        customTitleOverride
      );
    }

    if (chartType === 'bubble') {
      if (!yAxisColumn) {
        return this.errorResult(chartType, 'Bubble chart requires both X-Axis and Y-Axis numeric metrics.');
      }
      return this.computeBubblePlot(
        filteredRows,
        xAxisColumn,
        yAxisColumn,
        secondaryColumn || groupByDimension,
        customTitleOverride
      );
    }

    // 5. Specialized Chart Types
    if (chartType === 'waterfall') {
      return this.computeWaterfall(
        filteredRows,
        xAxisColumn,
        yAxisColumn,
        aggregation,
        topN,
        customTitleOverride
      );
    }

    if (chartType === 'funnel') {
      return this.computeFunnel(
        filteredRows,
        xAxisColumn,
        yAxisColumn,
        aggregation,
        topN,
        customTitleOverride
      );
    }

    if (chartType === 'gauge') {
      return this.computeGauge(
        filteredRows,
        yAxisColumn || xAxisColumn,
        aggregation,
        customTitleOverride
      );
    }

    if (chartType === 'heatmap') {
      return this.computeHeatmap(
        filteredRows,
        xAxisColumn,
        secondaryColumn || (columns.find(c => c !== xAxisColumn) || xAxisColumn),
        yAxisColumn && yAxisColumn !== xAxisColumn && profiles[yAxisColumn]?.type === 'numeric' ? yAxisColumn : undefined,
        aggregation,
        topN,
        customTitleOverride
      );
    }

    if (chartType === 'composed') {
      return this.computeComposed(
        filteredRows,
        xAxisColumn,
        yAxisColumn,
        secondaryColumn || groupByDimension,
        aggregation,
        topN,
        sortBy,
        customTitleOverride
      );
    }

    // 6. Categorical / Dimension Aggregation Path (Bar, Horizontal Bar, Line, Area, Step Line, Pie, Donut, Radar, Polar Area, Radial Bar, Treemap)
    return this.computeCategoricalChart(
      filteredRows,
      xAxisColumn,
      yAxisColumn,
      secondaryColumn || groupByDimension,
      aggregation,
      topN,
      sortBy,
      chartType,
      referenceLine,
      referenceConstantValue,
      customTitleOverride
    );
  }

  /**
   * Computes Date/Time Series with calendar intervals
   */
  private static computeTemporalChart(
    rows: Record<string, any>[],
    dateColumn: string,
    metricColumn: string,
    aggregation: AggregationFunction,
    granularity: TimeGranularity,
    dateRange: any,
    groupByDimension?: string,
    topN?: number,
    chartType: ExtendedChartType = 'line',
    comparisonMode?: ComparisonMode,
    movingAverageWindow?: number,
    customTitleOverride?: string
  ): VisualizationComputationResult {
    const tempResult = TemporalEngine.aggregate(rows, {
      dateColumn,
      metricColumn,
      aggregation,
      granularity,
      dateRange,
      groupByDimension,
      topN,
      chartType: (chartType === 'donut' || chartType === 'pie') ? 'donut' : chartType === 'area' ? 'area' : chartType === 'bar' ? 'bar' : 'line',
      comparisonMode,
      movingAverageWindow
    });

    const title = customTitleOverride || tempResult.title;
    const xAxisTitle = tempResult.xAxisTitle || 'Timeline';
    const yAxisTitle = tempResult.yAxisTitle || this.formatName(metricColumn);

    return {
      isValid: true,
      chartType,
      title,
      xAxisTitle,
      yAxisTitle,
      description: tempResult.description,
      data: tempResult.dataPoints,
      seriesKeys: tempResult.seriesKeys.length > 0 ? tempResult.seriesKeys : [metricColumn || 'value'],
      xAxisKey: 'periodLabel',
      yAxisKey: tempResult.seriesKeys[0] || 'value',
      groupByKey: groupByDimension,
      tableData: {
        headers: tempResult.tableHeaders,
        rows: tempResult.tableRows
      },
      summaryMetrics: {
        totalRecords: tempResult.summaryStats.totalRecords,
        aggregateValue: tempResult.summaryStats.totalValue,
        averageValue: tempResult.summaryStats.avgPerPeriod,
        distinctGroups: tempResult.summaryStats.periodCount
      }
    };
  }

  /**
   * Computes Scatter Plot for bivariate correlation
   */
  private static computeScatterPlot(
    rows: Record<string, any>[],
    xCol: string,
    yCol: string,
    groupCol?: string,
    customTitleOverride?: string
  ): VisualizationComputationResult {
    const data: any[] = [];
    const maxPoints = 500;
    const step = Math.max(1, Math.floor(rows.length / maxPoints));

    for (let i = 0; i < rows.length; i += step) {
      const r = rows[i];
      const xVal = Number(r[xCol]);
      const yVal = Number(r[yCol]);
      if (!isNaN(xVal) && isFinite(xVal) && !isNaN(yVal) && isFinite(yVal)) {
        data.push({
          x: xVal,
          y: yVal,
          [xCol]: xVal,
          [yCol]: yVal,
          group: groupCol ? String(r[groupCol] ?? 'General') : undefined,
          tooltip: `${this.formatName(xCol)}: ${xVal.toLocaleString()}, ${this.formatName(yCol)}: ${yVal.toLocaleString()}`
        });
      }
    }

    const title = customTitleOverride || `${this.formatName(xCol)} vs ${this.formatName(yCol)}`;
    return {
      isValid: true,
      chartType: 'scatter',
      title,
      xAxisTitle: this.formatName(xCol),
      yAxisTitle: this.formatName(yCol),
      description: `Scatter distribution analyzing correlation across ${data.length} sample points.`,
      data,
      seriesKeys: [yCol],
      xAxisKey: 'x',
      yAxisKey: 'y',
      groupByKey: groupCol,
      tableData: {
        headers: [xCol, yCol, ...(groupCol ? [groupCol] : [])],
        rows: data.map(d => [d[xCol], d[yCol], ...(groupCol ? [d.group] : [])])
      },
      summaryMetrics: {
        totalRecords: rows.length,
        aggregateValue: data.length,
        averageValue: data.length > 0 ? ss.mean(data.map(d => d.y)) : 0,
        distinctGroups: data.length
      }
    };
  }

  /**
   * Computes Bubble Chart (X, Y, and Z size)
   */
  private static computeBubblePlot(
    rows: Record<string, any>[],
    xCol: string,
    yCol: string,
    zColOrGroup?: string,
    customTitleOverride?: string
  ): VisualizationComputationResult {
    const data: any[] = [];
    const maxPoints = 500;
    const step = Math.max(1, Math.floor(rows.length / maxPoints));

    for (let i = 0; i < rows.length; i += step) {
      const r = rows[i];
      const xVal = Number(r[xCol]);
      const yVal = Number(r[yCol]);
      let zVal = 100;
      if (zColOrGroup && !isNaN(Number(r[zColOrGroup]))) {
        zVal = Math.max(20, Math.min(600, Number(r[zColOrGroup])));
      } else {
        zVal = Math.round(50 + Math.abs(xVal * yVal) % 300);
      }

      if (!isNaN(xVal) && isFinite(xVal) && !isNaN(yVal) && isFinite(yVal)) {
        data.push({
          x: xVal,
          y: yVal,
          z: zVal,
          [xCol]: xVal,
          [yCol]: yVal,
          zMetric: zColOrGroup || 'Magnitude',
          name: `${this.formatName(xCol)}: ${xVal.toLocaleString()}, ${this.formatName(yCol)}: ${yVal.toLocaleString()}`,
          tooltip: `${this.formatName(xCol)}: ${xVal.toLocaleString()} | ${this.formatName(yCol)}: ${yVal.toLocaleString()} | Size: ${zVal}`
        });
      }
    }

    const title = customTitleOverride || `Bubble Analysis: ${this.formatName(xCol)} vs ${this.formatName(yCol)}`;
    return {
      isValid: true,
      chartType: 'bubble',
      title,
      xAxisTitle: this.formatName(xCol),
      yAxisTitle: this.formatName(yCol),
      description: `3-dimensional bubble distribution analyzing bivariate relationship weighted by magnitude across ${data.length} sample points.`,
      data,
      seriesKeys: [yCol],
      xAxisKey: 'x',
      yAxisKey: 'y',
      groupByKey: zColOrGroup,
      tableData: {
        headers: [xCol, yCol, zColOrGroup || 'Size'],
        rows: data.map(d => [d.x, d.y, d.z])
      },
      summaryMetrics: {
        totalRecords: rows.length,
        aggregateValue: data.length,
        averageValue: data.length > 0 ? ss.mean(data.map(d => d.y)) : 0,
        distinctGroups: data.length
      }
    };
  }

  /**
   * Computes Waterfall variance / cumulative walk
   */
  private static computeWaterfall(
    rows: Record<string, any>[],
    xCol: string,
    yCol?: string,
    aggregation: string = 'sum',
    topN: number = 8,
    customTitleOverride?: string
  ): VisualizationComputationResult {
    const effectiveMetric = yCol || 'Records';
    const groups: Record<string, number> = {};

    rows.forEach(r => {
      const cat = String(r[xCol] ?? 'Other').trim();
      const val = yCol ? Number(r[yCol]) || 0 : 1;
      groups[cat] = (groups[cat] || 0) + val;
    });

    let items = Object.entries(groups).map(([name, rawVal]) => ({
      name,
      val: Math.round(rawVal * 100) / 100
    }));

    if (topN > 0 && items.length > topN) {
      items = items.slice(0, topN);
    }

    let runningTotal = 0;
    const dataPoints = items.map((it) => {
      const priorTotal = runningTotal;
      runningTotal += it.val;
      const isPositive = it.val >= 0;
      return {
        category: it.name,
        name: it.name,
        delta: it.val,
        value: it.val,
        base: isPositive ? priorTotal : priorTotal + it.val,
        magnitude: Math.abs(it.val),
        cumulative: runningTotal,
        isPositive,
        isTotal: false
      };
    });

    // Append Final Net Total
    dataPoints.push({
      category: 'Net Total',
      name: 'Net Total',
      delta: runningTotal,
      value: runningTotal,
      base: 0,
      magnitude: Math.abs(runningTotal),
      cumulative: runningTotal,
      isPositive: runningTotal >= 0,
      isTotal: true
    });

    const title = customTitleOverride || `Waterfall Variance: ${this.formatName(effectiveMetric)} by ${this.formatName(xCol)}`;
    return {
      isValid: true,
      chartType: 'waterfall',
      title,
      xAxisTitle: this.formatName(xCol),
      yAxisTitle: this.formatName(effectiveMetric),
      description: `Cumulative variance bridge tracking step incremental impacts on net ${this.formatName(effectiveMetric)}.`,
      data: dataPoints,
      seriesKeys: ['value', 'cumulative'],
      xAxisKey: 'name',
      yAxisKey: 'value',
      tableData: {
        headers: [xCol, 'Variance Step', 'Cumulative'],
        rows: dataPoints.map(d => [d.name, d.value, d.cumulative])
      },
      summaryMetrics: {
        totalRecords: rows.length,
        aggregateValue: runningTotal,
        averageValue: items.length > 0 ? ss.mean(items.map(i => i.val)) : 0,
        distinctGroups: items.length
      }
    };
  }

  /**
   * Computes Funnel conversion steps
   */
  private static computeFunnel(
    rows: Record<string, any>[],
    xCol: string,
    yCol?: string,
    aggregation: string = 'sum',
    topN: number = 7,
    customTitleOverride?: string
  ): VisualizationComputationResult {
    const effectiveMetric = yCol || 'Records';
    const groups: Record<string, number> = {};

    rows.forEach(r => {
      const cat = String(r[xCol] ?? 'Stage').trim();
      const val = yCol ? Number(r[yCol]) || 0 : 1;
      groups[cat] = (groups[cat] || 0) + val;
    });

    let items = Object.entries(groups)
      .map(([name, val]) => ({ name, value: Math.round(val * 100) / 100 }))
      .sort((a, b) => b.value - a.value);

    if (topN > 0 && items.length > topN) {
      items = items.slice(0, topN);
    }

    const topValue = items[0]?.value || 1;
    const dataPoints = items.map((it, idx) => {
      const pctOfTop = Math.round((it.value / topValue) * 1000) / 10;
      const prevVal = idx > 0 ? items[idx - 1].value : it.value;
      const stepConversion = prevVal > 0 ? Math.round((it.value / prevVal) * 1000) / 10 : 100;
      return {
        ...it,
        stage: it.name,
        pctOfTop,
        stepConversion,
        dropOffPct: Math.round((100 - stepConversion) * 10) / 10
      };
    });

    const title = customTitleOverride || `Funnel Progression: ${this.formatName(effectiveMetric)} across ${this.formatName(xCol)}`;
    return {
      isValid: true,
      chartType: 'funnel',
      title,
      xAxisTitle: this.formatName(xCol),
      yAxisTitle: this.formatName(effectiveMetric),
      description: `Sequential conversion analysis showing volumetric attrition and retention rates from initial to final stage.`,
      data: dataPoints,
      seriesKeys: ['value'],
      xAxisKey: 'name',
      yAxisKey: 'value',
      tableData: {
        headers: ['Stage', effectiveMetric, '% of Initial', 'Step Conversion'],
        rows: dataPoints.map(d => [d.name, d.value, `${d.pctOfTop}%`, `${d.stepConversion}%`])
      },
      summaryMetrics: {
        totalRecords: rows.length,
        aggregateValue: topValue,
        averageValue: items.length > 0 ? ss.mean(items.map(i => i.value)) : 0,
        distinctGroups: items.length
      }
    };
  }

  /**
   * Computes Executive KPI Gauge Dial
   */
  private static computeGauge(
    rows: Record<string, any>[],
    metricCol: string,
    aggregation: string = 'sum',
    customTitleOverride?: string
  ): VisualizationComputationResult {
    const vals = rows.map(r => Number(r[metricCol])).filter(v => !isNaN(v) && isFinite(v));
    let rawVal = 0;
    if (vals.length > 0) {
      if (aggregation === 'mean' || aggregation === 'avg') rawVal = ss.mean(vals);
      else if (aggregation === 'median') rawVal = ss.median(vals);
      else if (aggregation === 'max') rawVal = Math.max(...vals);
      else if (aggregation === 'min') rawVal = Math.min(...vals);
      else rawVal = ss.sum(vals);
    } else {
      rawVal = rows.length;
    }

    rawVal = Math.round(rawVal * 100) / 100;
    const target = rawVal >= 100 ? Math.round(rawVal * 1.25) : 100;
    const pctOfTarget = target > 0 ? Math.min(100, Math.round((rawVal / target) * 1000) / 10) : 0;
    const status = pctOfTarget >= 85 ? 'On Target' : pctOfTarget >= 60 ? 'At Risk' : 'Critical';

    const dataPoints = [
      {
        name: this.formatName(metricCol),
        value: rawVal,
        target,
        pctOfTarget,
        status,
        min: 0,
        max: target
      }
    ];

    const title = customTitleOverride || `Performance Gauge: ${this.formatName(metricCol)}`;
    return {
      isValid: true,
      chartType: 'gauge',
      title,
      xAxisTitle: 'Target Benchmark',
      yAxisTitle: this.formatName(metricCol),
      description: `Executive performance dial measuring current velocity (${rawVal.toLocaleString()}) against strategic threshold capacity (${target.toLocaleString()}).`,
      data: dataPoints,
      seriesKeys: ['value'],
      xAxisKey: 'name',
      yAxisKey: 'value',
      tableData: {
        headers: ['Metric', 'Actual Value', 'Target', 'Completion %', 'Status'],
        rows: [[this.formatName(metricCol), rawVal, target, `${pctOfTarget}%`, status]]
      },
      summaryMetrics: {
        totalRecords: rows.length,
        aggregateValue: rawVal,
        averageValue: rawVal,
        distinctGroups: 1
      }
    };
  }

  /**
   * Computes Matrix Heatmap
   */
  private static computeHeatmap(
    rows: Record<string, any>[],
    xCol: string,
    yCol: string,
    valueCol?: string,
    aggregation: string = 'count',
    topN: number = 8,
    customTitleOverride?: string
  ): VisualizationComputationResult {
    const matrix: Record<string, Record<string, number>> = {};
    const allX = new Set<string>();
    const allY = new Set<string>();

    rows.forEach(r => {
      const x = String(r[xCol] ?? 'Other').trim();
      const y = String(r[yCol] ?? 'General').trim();
      allX.add(x);
      allY.add(y);

      if (!matrix[x]) matrix[x] = {};
      const val = valueCol ? Number(r[valueCol]) || 0 : 1;
      matrix[x][y] = (matrix[x][y] || 0) + val;
    });

    let xCategories = Array.from(allX);
    let yCategories = Array.from(allY);

    if (topN > 0) {
      xCategories = xCategories.slice(0, topN);
      yCategories = yCategories.slice(0, topN);
    }

    let minVal = Infinity;
    let maxVal = -Infinity;
    const cells: any[] = [];

    xCategories.forEach(x => {
      yCategories.forEach(y => {
        const v = Math.round((matrix[x]?.[y] || 0) * 100) / 100;
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
        cells.push({
          x,
          y,
          value: v,
          label: `${x} × ${y}: ${v.toLocaleString()}`
        });
      });
    });

    if (minVal === Infinity) minVal = 0;
    if (maxVal === -Infinity) maxVal = 1;

    // Reshape data points per row for grid
    const dataPoints = xCategories.map(x => {
      const rowObj: Record<string, any> = { [xCol]: x, name: x };
      yCategories.forEach(y => {
        rowObj[y] = Math.round((matrix[x]?.[y] || 0) * 100) / 100;
      });
      return rowObj;
    });

    const title = customTitleOverride || `Correlation Heatmap: ${this.formatName(xCol)} vs ${this.formatName(yCol)}`;
    return {
      isValid: true,
      chartType: 'heatmap',
      title,
      xAxisTitle: this.formatName(xCol),
      yAxisTitle: this.formatName(yCol),
      description: `Cross-tabulation intensity heatmap plotting intersection density across ${xCategories.length} × ${yCategories.length} cells.`,
      data: dataPoints,
      seriesKeys: yCategories,
      xAxisKey: xCol,
      yAxisKey: yCategories[0] || 'value',
      tableData: {
        headers: [xCol, ...yCategories],
        rows: dataPoints.map(d => [d[xCol], ...yCategories.map(y => d[y] ?? 0)])
      },
      summaryMetrics: {
        totalRecords: rows.length,
        aggregateValue: cells.reduce((acc, c) => acc + c.value, 0),
        averageValue: cells.length > 0 ? ss.mean(cells.map(c => c.value)) : 0,
        distinctGroups: cells.length
      }
    };
  }

  /**
   * Computes Composed Combo Chart (Bar + Line overlay)
   */
  private static computeComposed(
    rows: Record<string, any>[],
    xCol: string,
    yCol?: string,
    secondaryCol?: string,
    aggregation: string = 'sum',
    topN: number = 10,
    sortBy: 'asc' | 'desc' | 'none' = 'desc',
    customTitleOverride?: string
  ): VisualizationComputationResult {
    const primaryMetric = yCol || 'Volume';
    const secondaryMetric = secondaryCol && secondaryCol !== xCol ? secondaryCol : undefined;

    const groups: Record<string, { primaryVals: number[]; secondaryVals: number[] }> = {};

    rows.forEach(r => {
      const x = String(r[xCol] ?? 'Unknown').trim();
      if (!groups[x]) groups[x] = { primaryVals: [], secondaryVals: [] };

      const pVal = yCol ? Number(r[yCol]) : 1;
      if (!isNaN(pVal) && isFinite(pVal)) groups[x].primaryVals.push(pVal);

      if (secondaryMetric) {
        const sVal = Number(r[secondaryMetric]);
        if (!isNaN(sVal) && isFinite(sVal)) groups[x].secondaryVals.push(sVal);
      }
    });

    let dataPoints = Object.keys(groups).map(x => {
      const pArr = groups[x].primaryVals;
      const sArr = groups[x].secondaryVals;

      const pAgg = pArr.length > 0 ? (aggregation === 'mean' || aggregation === 'avg' ? ss.mean(pArr) : ss.sum(pArr)) : 0;
      const sAgg = sArr.length > 0 ? ss.mean(sArr) : Math.round(pAgg * 0.15 * 100) / 100;

      return {
        [xCol]: x,
        name: x,
        [primaryMetric]: Math.round(pAgg * 100) / 100,
        [secondaryMetric || 'trend']: Math.round(sAgg * 100) / 100,
        value: Math.round(pAgg * 100) / 100
      };
    });

    if (sortBy === 'desc') dataPoints.sort((a, b) => Number(b[primaryMetric]) - Number(a[primaryMetric]));
    else if (sortBy === 'asc') dataPoints.sort((a, b) => Number(a[primaryMetric]) - Number(b[primaryMetric]));

    if (topN > 0) dataPoints = dataPoints.slice(0, topN);

    const seriesKeys = [primaryMetric, secondaryMetric || 'trend'];
    const title = customTitleOverride || `Combo Dual-Axis: ${this.formatName(primaryMetric)} & ${secondaryMetric ? this.formatName(secondaryMetric) : 'Trend'} by ${this.formatName(xCol)}`;

    return {
      isValid: true,
      chartType: 'composed',
      title,
      xAxisTitle: this.formatName(xCol),
      yAxisTitle: this.formatName(primaryMetric),
      description: `Dual-perspective composed visualization pairing primary volume bars with an overlay trend line.`,
      data: dataPoints,
      seriesKeys,
      xAxisKey: xCol,
      yAxisKey: primaryMetric,
      tableData: {
        headers: [xCol, primaryMetric, secondaryMetric || 'Trend'],
        rows: dataPoints.map(d => [d[xCol], d[primaryMetric], d[secondaryMetric || 'trend']])
      },
      summaryMetrics: {
        totalRecords: rows.length,
        aggregateValue: ss.sum(dataPoints.map(d => Number(d[primaryMetric]) || 0)),
        averageValue: dataPoints.length > 0 ? ss.mean(dataPoints.map(d => Number(d[primaryMetric]) || 0)) : 0,
        distinctGroups: dataPoints.length
      }
    };
  }

  /**
   * Computes Histogram distribution
   */
  private static computeHistogram(
    rows: Record<string, any>[],
    numCol: string,
    customTitleOverride?: string
  ): VisualizationComputationResult {
    const values: number[] = [];
    for (const r of rows) {
      const v = Number(r[numCol]);
      if (!isNaN(v) && isFinite(v)) values.push(v);
    }

    if (values.length === 0) {
      return this.errorResult('histogram', `Column "${numCol}" does not contain valid numerical values.`);
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = Math.min(15, Math.max(5, Math.ceil(Math.sqrt(values.length))));
    const binSize = (max - min) / binCount || 1;

    const bins: { binLabel: string; count: number; min: number; max: number }[] = [];
    for (let i = 0; i < binCount; i++) {
      const bMin = min + i * binSize;
      const bMax = i === binCount - 1 ? max : min + (i + 1) * binSize;
      const count = values.filter(v => (i === binCount - 1 ? v >= bMin && v <= bMax : v >= bMin && v < bMax)).length;
      bins.push({
        binLabel: `${bMin.toFixed(1)} - ${bMax.toFixed(1)}`,
        count,
        min: bMin,
        max: bMax
      });
    }

    const title = customTitleOverride || `Distribution of ${this.formatName(numCol)}`;
    return {
      isValid: true,
      chartType: 'histogram',
      title,
      xAxisTitle: `${this.formatName(numCol)} Range`,
      yAxisTitle: 'Frequency (Count)',
      description: `Frequency distribution across ${values.length} observations split into ${binCount} bins.`,
      data: bins,
      seriesKeys: ['count'],
      xAxisKey: 'binLabel',
      yAxisKey: 'count',
      tableData: {
        headers: ['Bin Range', 'Frequency', 'Min', 'Max'],
        rows: bins.map(b => [b.binLabel, b.count, b.min.toFixed(2), b.max.toFixed(2)])
      },
      summaryMetrics: {
        totalRecords: values.length,
        aggregateValue: values.length,
        averageValue: ss.mean(values),
        distinctGroups: binCount
      }
    };
  }

  /**
   * Computes Box Plot statistical distribution (Min, Q1, Median, Q3, Max, IQR, Outliers)
   */
  private static computeBoxPlot(
    rows: Record<string, any>[],
    numCol: string,
    groupByCol?: string,
    customTitleOverride?: string
  ): VisualizationComputationResult {
    const groups: Record<string, number[]> = {};

    rows.forEach(r => {
      const v = Number(r[numCol]);
      if (!isNaN(v) && isFinite(v)) {
        const groupName = groupByCol && r[groupByCol] !== undefined && r[groupByCol] !== null
          ? String(r[groupByCol]).trim()
          : 'Overall';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(v);
      }
    });

    const groupKeys = Object.keys(groups);
    if (groupKeys.length === 0) {
      return this.errorResult('box', `Column "${numCol}" does not contain valid numerical observations.`);
    }

    const boxPlotData = groupKeys.map(grp => {
      const vals = groups[grp].sort((a, b) => a - b);
      const min = vals[0];
      const max = vals[vals.length - 1];
      const q1 = ss.quantile(vals, 0.25);
      const median = ss.median(vals);
      const q3 = ss.quantile(vals, 0.75);
      const mean = Math.round(ss.mean(vals) * 100) / 100;
      const iqr = q3 - q1;
      const lowerFence = Math.max(min, q1 - 1.5 * iqr);
      const upperFence = Math.min(max, q3 + 1.5 * iqr);
      const outliers = vals.filter(v => v < lowerFence || v > upperFence);

      return {
        category: grp,
        name: grp,
        min,
        q1: Math.round(q1 * 100) / 100,
        median: Math.round(median * 100) / 100,
        q3: Math.round(q3 * 100) / 100,
        max,
        mean,
        lowerFence: Math.round(lowerFence * 100) / 100,
        upperFence: Math.round(upperFence * 100) / 100,
        iqr: Math.round(iqr * 100) / 100,
        outlierCount: outliers.length,
        outliers: outliers.slice(0, 10),
        count: vals.length,
        value: median
      };
    });

    const title = customTitleOverride || (
      groupByCol && groupByCol !== 'none'
        ? `${this.formatName(numCol)} Distribution by ${this.formatName(groupByCol)}`
        : `Box Plot of ${this.formatName(numCol)}`
    );

    const totalObs = ss.sum(boxPlotData.map(b => b.count));
    const allMeans = boxPlotData.map(b => b.mean);

    return {
      isValid: true,
      chartType: 'box',
      title,
      xAxisTitle: groupByCol && groupByCol !== 'none' ? this.formatName(groupByCol) : 'Distribution',
      yAxisTitle: this.formatName(numCol),
      description: `Statistical five-number summary and dispersion analysis across ${boxPlotData.length} group(s) with ${totalObs} total observations.`,
      data: boxPlotData,
      seriesKeys: ['min', 'q1', 'median', 'q3', 'max'],
      xAxisKey: 'category',
      yAxisKey: 'median',
      groupByKey: groupByCol,
      tableData: {
        headers: ['Group / Segment', 'Min', 'Q1 (25%)', 'Median', 'Q3 (75%)', 'Max', 'Mean', 'IQR', 'Count', 'Outliers'],
        rows: boxPlotData.map(b => [
          b.category,
          b.min.toLocaleString(),
          b.q1.toLocaleString(),
          b.median.toLocaleString(),
          b.q3.toLocaleString(),
          b.max.toLocaleString(),
          b.mean.toLocaleString(),
          b.iqr.toLocaleString(),
          b.count.toLocaleString(),
          b.outlierCount
        ])
      },
      summaryMetrics: {
        totalRecords: totalObs,
        aggregateValue: totalObs,
        averageValue: allMeans.length > 0 ? ss.mean(allMeans) : 0,
        distinctGroups: boxPlotData.length
      }
    };
  }

  /**
   * Computes Categorical aggregations (Bar, Horizontal Bar, Line, Area, Pie, Donut)
   */
  private static computeCategoricalChart(
    rows: Record<string, any>[],
    xCol: string,
    yCol?: string,
    groupByCol?: string,
    aggregation: string = 'sum',
    topN: number = 0,
    sortBy: 'asc' | 'desc' | 'none' = 'desc',
    chartType: ExtendedChartType = 'bar',
    referenceLine: string = 'none',
    referenceConstantValue?: number,
    customTitleOverride?: string
  ): VisualizationComputationResult {
    // 1. If no y-axis is provided, default to Count
    const effectiveMetric = yCol || 'Records';
    const effectiveAgg = yCol ? aggregation : 'count';

    // 2. Multi-series grouping if groupByCol exists
    if (groupByCol && groupByCol !== xCol && groupByCol !== 'none') {
      const nestedGroups: Record<string, Record<string, number[]>> = {};
      const allSecondaryKeys = new Set<string>();

      rows.forEach(r => {
        const xKey = String(r[xCol] ?? 'Unknown').trim();
        const gKey = String(r[groupByCol] ?? 'Other').trim();
        allSecondaryKeys.add(gKey);

        if (!nestedGroups[xKey]) nestedGroups[xKey] = {};
        if (!nestedGroups[xKey][gKey]) nestedGroups[xKey][gKey] = [];

        if (yCol) {
          const val = Number(r[yCol]);
          if (!isNaN(val) && isFinite(val)) nestedGroups[xKey][gKey].push(val);
        } else {
          nestedGroups[xKey][gKey].push(1);
        }
      });

      // Compute aggregates per cell
      let dataPoints = Object.keys(nestedGroups).map(xKey => {
        const pt: Record<string, any> = { [xCol]: xKey };
        let rowTotal = 0;

        Array.from(allSecondaryKeys).forEach(gKey => {
          const vals = nestedGroups[xKey][gKey] || [];
          let computed = 0;
          if (vals.length > 0) {
            if (effectiveAgg === 'sum') computed = ss.sum(vals);
            else if (effectiveAgg === 'mean' || effectiveAgg === 'avg') computed = Math.round(ss.mean(vals) * 100) / 100;
            else if (effectiveAgg === 'median') computed = Math.round(ss.median(vals) * 100) / 100;
            else if (effectiveAgg === 'min') computed = Math.min(...vals);
            else if (effectiveAgg === 'max') computed = Math.max(...vals);
            else if (effectiveAgg === 'count') computed = vals.length;
            else if (effectiveAgg === 'count_distinct') computed = new Set(vals).size;
          }
          pt[gKey] = computed;
          rowTotal += computed;
        });

        pt['__total'] = rowTotal;
        return pt;
      });

      // Sort
      if (sortBy === 'desc') {
        dataPoints.sort((a, b) => b.__total - a.__total);
      } else if (sortBy === 'asc') {
        dataPoints.sort((a, b) => a.__total - b.__total);
      }

      // Top N
      if (topN > 0) {
        dataPoints = dataPoints.slice(0, topN);
      }

      const seriesKeys = Array.from(allSecondaryKeys).slice(0, 10);
      const title =
        customTitleOverride ||
        ChartTitleEngine.generateTitle({
          isTemporal: false,
          metricColumn: effectiveMetric,
          dimensionColumn: groupByCol,
          aggregation: effectiveAgg as any,
          chartType: chartType as any,
          topN
        });

      return {
        isValid: true,
        chartType,
        title,
        xAxisTitle: this.formatName(xCol),
        yAxisTitle: `${this.formatAggregation(effectiveAgg)} of ${this.formatName(effectiveMetric)}`,
        description: `Grouped breakdown by ${this.formatName(groupByCol)} across ${dataPoints.length} categories.`,
        data: dataPoints,
        seriesKeys,
        xAxisKey: xCol,
        yAxisKey: seriesKeys[0] || '__total',
        groupByKey: groupByCol,
        tableData: {
          headers: [xCol, ...seriesKeys, 'Total'],
          rows: dataPoints.map(d => [d[xCol], ...seriesKeys.map(k => d[k] ?? 0), d.__total])
        },
        summaryMetrics: {
          totalRecords: rows.length,
          aggregateValue: ss.sum(dataPoints.map(d => d.__total)),
          averageValue: dataPoints.length > 0 ? ss.mean(dataPoints.map(d => d.__total)) : 0,
          distinctGroups: dataPoints.length
        }
      };
    }

    // 3. Single dimension aggregation
    const groups: Record<string, number[]> = {};
    const rawDistinctVals: Record<string, Set<any>> = {};

    rows.forEach(r => {
      const xKey = String(r[xCol] ?? 'Unknown').trim();
      if (!groups[xKey]) {
        groups[xKey] = [];
        rawDistinctVals[xKey] = new Set();
      }

      if (yCol) {
        const val = Number(r[yCol]);
        if (!isNaN(val) && isFinite(val)) {
          groups[xKey].push(val);
          rawDistinctVals[xKey].add(r[yCol]);
        }
      } else {
        groups[xKey].push(1);
      }
    });

    let dataPoints = Object.keys(groups).map(xKey => {
      const vals = groups[xKey];
      let computed = 0;
      if (vals.length > 0) {
        if (effectiveAgg === 'sum') computed = ss.sum(vals);
        else if (effectiveAgg === 'mean' || effectiveAgg === 'avg') computed = Math.round(ss.mean(vals) * 100) / 100;
        else if (effectiveAgg === 'median') computed = Math.round(ss.median(vals) * 100) / 100;
        else if (effectiveAgg === 'min') computed = Math.min(...vals);
        else if (effectiveAgg === 'max') computed = Math.max(...vals);
        else if (effectiveAgg === 'count') computed = vals.length;
        else if (effectiveAgg === 'count_distinct') computed = rawDistinctVals[xKey].size;
      }

      return {
        [xCol]: xKey,
        name: xKey,
        [effectiveMetric]: computed,
        value: computed,
        Count: vals.length
      };
    });

    // Sorting
    if (sortBy === 'desc') {
      dataPoints.sort((a, b) => Number(b[effectiveMetric]) - Number(a[effectiveMetric]));
    } else if (sortBy === 'asc') {
      dataPoints.sort((a, b) => Number(a[effectiveMetric]) - Number(b[effectiveMetric]));
    }

    // Top N
    if (topN > 0) {
      dataPoints = dataPoints.slice(0, topN);
    }

    const title =
      customTitleOverride ||
      ChartTitleEngine.generateTitle({
        isTemporal: false,
        metricColumn: effectiveMetric,
        dimensionColumn: xCol,
        aggregation: effectiveAgg as any,
        chartType: chartType as any,
        topN
      });

    return {
      isValid: true,
      chartType,
      title,
      xAxisTitle: this.formatName(xCol),
      yAxisTitle: `${this.formatAggregation(effectiveAgg)} of ${this.formatName(effectiveMetric)}`,
      description: `Aggregated values for ${this.formatName(xCol)} (${dataPoints.length} segments).`,
      data: dataPoints,
      seriesKeys: [effectiveMetric],
      xAxisKey: xCol,
      yAxisKey: effectiveMetric,
      tableData: {
        headers: [xCol, `${this.formatAggregation(effectiveAgg)} (${effectiveMetric})`, 'Record Count'],
        rows: dataPoints.map(d => [d[xCol], d[effectiveMetric], d.Count])
      },
      summaryMetrics: {
        totalRecords: rows.length,
        aggregateValue: ss.sum(dataPoints.map(d => Number(d[effectiveMetric]) || 0)),
        averageValue: dataPoints.length > 0 ? ss.mean(dataPoints.map(d => Number(d[effectiveMetric]) || 0)) : 0,
        distinctGroups: dataPoints.length
      }
    };
  }

  private static errorResult(chartType: ExtendedChartType, message: string): VisualizationComputationResult {
    return {
      isValid: false,
      errorMessage: message,
      chartType,
      title: 'Configuration Incomplete',
      xAxisTitle: '',
      yAxisTitle: '',
      description: message,
      data: [],
      seriesKeys: [],
      xAxisKey: '',
      yAxisKey: ''
    };
  }

  private static formatName(col: string): string {
    return col
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  private static formatAggregation(agg: string): string {
    switch (agg) {
      case 'sum': return 'Sum';
      case 'mean':
      case 'avg': return 'Average';
      case 'median': return 'Median';
      case 'min': return 'Min';
      case 'max': return 'Max';
      case 'count': return 'Count';
      case 'count_distinct': return 'Distinct Count';
      default: return agg.toUpperCase();
    }
  }

  /**
   * Recommend chart type based on field selections
   */
  public static recommendChartType(
    xType?: string,
    yType?: string,
    hasGroupBy?: boolean,
    distinctCount?: number
  ): ExtendedChartType {
    if (xType === 'datetime' || xType === 'date') {
      return 'line';
    }
    if (xType === 'numeric' && yType === 'numeric') {
      return 'scatter';
    }
    if (xType === 'categorical' && distinctCount && distinctCount <= 6) {
      return 'donut';
    }
    return 'bar';
  }

  // ==========================================================================
  // STORAGE & DASHBOARD MANAGEMENT
  // ==========================================================================

  public static getSavedVisualizations(): SavedVisualization[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SAVED_VIZ);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to load saved visualizations:', e);
    }
    return [];
  }

  public static saveVisualization(viz: SavedVisualization): void {
    try {
      const current = this.getSavedVisualizations();
      const existingIdx = current.findIndex(v => v.id === viz.id);
      if (existingIdx >= 0) {
        current[existingIdx] = { ...viz, lastModified: Date.now() };
      } else {
        current.unshift({ ...viz, createdAt: Date.now(), lastModified: Date.now() });
      }
      localStorage.setItem(STORAGE_KEYS.SAVED_VIZ, JSON.stringify(current));

      // Automatically sync to Executive Dashboard
      this.addToExecutiveDashboard(viz.id);
    } catch (e) {
      console.warn('Failed to save visualization:', e);
    }
  }

  public static deleteVisualization(id: string): void {
    try {
      const current = this.getSavedVisualizations().filter(v => v.id !== id);
      localStorage.setItem(STORAGE_KEYS.SAVED_VIZ, JSON.stringify(current));

      // Also clean up any dashboards containing this visualization
      const dashboards = this.getCustomDashboards();
      let modifiedAny = false;
      dashboards.forEach(d => {
        const initialLen = d.items.length;
        d.items = d.items.filter(it => it.visualizationId !== id);
        if (d.items.length !== initialLen) {
          d.lastModified = Date.now();
          modifiedAny = true;
        }
      });
      if (modifiedAny) {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_DASHBOARDS, JSON.stringify(dashboards));
      }

      // Remove from Executive Dashboard
      this.removeFromExecutiveDashboard(id);

      // Notify any listeners
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('datamind_dashboard_updated'));
      }
    } catch (e) {
      console.warn('Failed to delete visualization:', e);
    }
  }

  public static duplicateVisualization(id: string): SavedVisualization | null {
    const current = this.getSavedVisualizations();
    const source = current.find(v => v.id === id);
    if (!source) return null;

    const copy: SavedVisualization = {
      ...source,
      id: `viz_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: `${source.name} (Copy)`,
      customTitle: source.customTitle ? `${source.customTitle} (Copy)` : undefined,
      createdAt: Date.now(),
      lastModified: Date.now()
    };

    this.saveVisualization(copy);
    return copy;
  }

  // Custom Dashboards
  public static getCustomDashboards(): CustomDashboard[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_DASHBOARDS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to load custom dashboards:', e);
    }
    return [];
  }

  public static createDashboard(name: string, description?: string): CustomDashboard {
    const newDashboard: CustomDashboard = {
      id: `dash_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: name.trim() || 'Untitled Dashboard',
      description: description || '',
      datasetId: '',
      datasetName: '',
      items: [],
      createdAt: Date.now(),
      lastModified: Date.now()
    };
    this.saveCustomDashboard(newDashboard);
    return newDashboard;
  }

  public static saveCustomDashboard(dashboard: CustomDashboard): void {
    try {
      const current = this.getCustomDashboards();
      const existingIdx = current.findIndex(d => d.id === dashboard.id);
      if (existingIdx >= 0) {
        current[existingIdx] = { ...dashboard, lastModified: Date.now() };
      } else {
        current.unshift({ ...dashboard, createdAt: Date.now(), lastModified: Date.now() });
      }
      localStorage.setItem(STORAGE_KEYS.CUSTOM_DASHBOARDS, JSON.stringify(current));
    } catch (e) {
      console.warn('Failed to save custom dashboard:', e);
    }
  }

  public static deleteCustomDashboard(id: string): void {
    try {
      const current = this.getCustomDashboards().filter(d => d.id !== id);
      localStorage.setItem(STORAGE_KEYS.CUSTOM_DASHBOARDS, JSON.stringify(current));
    } catch (e) {
      console.warn('Failed to delete custom dashboard:', e);
    }
  }

  public static addVisualizationToDashboard(
    dashboardId: string,
    visualizationId: string,
    width: 'full' | 'half' | 'third' = 'half'
  ): boolean {
    const dashboards = this.getCustomDashboards();
    const target = dashboards.find(d => d.id === dashboardId);
    if (!target) return false;

    // Check if already in dashboard
    const alreadyExists = target.items.some(i => i.visualizationId === visualizationId);
    if (alreadyExists) return true;

    target.items.push({
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      visualizationId,
      width,
      height: 'normal',
      order: target.items.length
    });
    target.lastModified = Date.now();

    this.saveCustomDashboard(target);

    // Automatically sync to Executive Dashboard
    this.addToExecutiveDashboard(visualizationId);

    return true;
  }

  // ==========================================================================
  // EXECUTIVE DASHBOARD SYNCHRONIZATION & SUMMARY ENGINE
  // ==========================================================================

  public static getExecutiveDashboardChartIds(): string[] {
    try {
      const removedRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.EXECUTIVE_REMOVED) : null;
      const removed: string[] = removedRaw ? JSON.parse(removedRaw) : [];

      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.EXECUTIVE_CHARTS) : null;
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        return ids.filter(id => !removed.includes(id));
      }

      // Default fallback: any chart already present in any custom dashboard
      const dashboards = this.getCustomDashboards();
      const allDashboardVizIds = Array.from(
        new Set(dashboards.flatMap(d => d.items.map(it => it.visualizationId)))
      );
      return allDashboardVizIds.filter(id => !removed.includes(id));
    } catch (e) {
      console.warn('Failed to load executive dashboard chart ids:', e);
      return [];
    }
  }

  public static addToExecutiveDashboard(visualizationId: string): void {
    try {
      if (typeof localStorage === 'undefined') return;

      // 1. Remove from removed list if present
      const removedRaw = localStorage.getItem(STORAGE_KEYS.EXECUTIVE_REMOVED);
      if (removedRaw) {
        const removed: string[] = JSON.parse(removedRaw);
        const nextRemoved = removed.filter(id => id !== visualizationId);
        localStorage.setItem(STORAGE_KEYS.EXECUTIVE_REMOVED, JSON.stringify(nextRemoved));
      }

      // 2. Add to executive charts (prioritize at front so it appears prominently)
      const current = this.getExecutiveDashboardChartIds().filter(id => id !== visualizationId);
      current.unshift(visualizationId);
      localStorage.setItem(STORAGE_KEYS.EXECUTIVE_CHARTS, JSON.stringify(current));

      // 3. Dispatch reactive update event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('datamind_dashboard_updated'));
      }
    } catch (e) {
      console.warn('Failed to add to executive dashboard:', e);
    }
  }

  public static isInExecutiveDashboard(visualizationId: string, datasetId?: string): boolean {
    const list = this.getExecutiveDashboardVisualizations(datasetId);
    return list.some(v => v.id === visualizationId);
  }

  public static removeFromExecutiveDashboard(visualizationId: string): void {
    try {
      if (typeof localStorage === 'undefined') return;

      const current = this.getExecutiveDashboardChartIds().filter(id => id !== visualizationId);
      localStorage.setItem(STORAGE_KEYS.EXECUTIVE_CHARTS, JSON.stringify(current));

      const removedRaw = localStorage.getItem(STORAGE_KEYS.EXECUTIVE_REMOVED);
      const removed: string[] = removedRaw ? JSON.parse(removedRaw) : [];
      if (!removed.includes(visualizationId)) {
        removed.push(visualizationId);
        localStorage.setItem(STORAGE_KEYS.EXECUTIVE_REMOVED, JSON.stringify(removed));
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('datamind_dashboard_updated'));
      }
    } catch (e) {
      console.warn('Failed to remove from executive dashboard:', e);
    }
  }

  public static getExecutiveDashboardVisualizations(datasetId?: string): SavedVisualization[] {
    const ids = this.getExecutiveDashboardChartIds();
    const saved = this.getSavedVisualizations();
    const removedRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.EXECUTIVE_REMOVED) : null;
    const removed: string[] = removedRaw ? JSON.parse(removedRaw) : [];

    const map = new Map(saved.map(v => [v.id, v]));
    const list: SavedVisualization[] = [];
    const addedIds = new Set<string>();

    // 1. Prioritize explicit executive chart list
    ids.forEach(id => {
      const v = map.get(id);
      if (v && (!datasetId || !v.datasetId || v.datasetId === datasetId)) {
        list.push(v);
        addedIds.add(v.id);
      }
    });

    // 2. Auto-include all saved visualizations created for this dataset (unless explicitly removed)
    saved.forEach(v => {
      if (!addedIds.has(v.id) && !removed.includes(v.id)) {
        if (!datasetId || !v.datasetId || v.datasetId === datasetId) {
          list.push(v);
          addedIds.add(v.id);
        }
      }
    });

    return list;
  }

  public static generateChartExecutiveSummary(
    computed: VisualizationComputationResult,
    viz?: SavedVisualization,
    dataset?: DatasetState
  ): ChartExecutiveSummary {
    const data = computed.data || [];
    const chartType = computed.chartType;
    const title = computed.title || viz?.name || 'Executive Chart';
    const xCol = computed.xAxisKey || viz?.config.xAxisColumn || 'Category';
    const yCol = computed.yAxisKey || computed.seriesKeys?.[0] || viz?.config.yAxisColumn || 'Value';

    const formatNum = (val: number): string => {
      if (val === null || val === undefined || isNaN(val)) return '0';
      const abs = Math.abs(val);
      if (abs >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
      if (abs >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
      return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(1);
    };

    const formatPureNum = (val: number): string => {
      if (val === null || val === undefined || isNaN(val)) return '0';
      const abs = Math.abs(val);
      if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
      if (abs >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
      return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(1);
    };

    if (data.length === 0) {
      return {
        headline: `${title}: Data series is empty or filtered`,
        narrative: `No active observations match the current filtering parameters.`,
        keyInsights: ['Zero active data points plotted.'],
        metrics: [{ label: 'Total Records', value: '0' }]
      };
    }

    // Categorical & Part-to-Whole (bar, horizontal_bar, pie, donut)
    if (['bar', 'horizontal_bar', 'pie', 'donut'].includes(chartType)) {
      const items = data.map((d: any) => {
        const cat = String(d[xCol] ?? d.category ?? d.label ?? 'Unknown');
        const val = Number(d[yCol] ?? d.value ?? d.sum ?? d.count ?? 0);
        return { cat, val: isNaN(val) ? 0 : val };
      }).sort((a, b) => b.val - a.val);

      const totalVal = items.reduce((acc, it) => acc + it.val, 0);
      const avgVal = totalVal / (items.length || 1);
      const topItem = items[0] || { cat: 'None', val: 0 };
      const bottomItem = items[items.length - 1] || { cat: 'None', val: 0 };
      const topPct = totalVal > 0 ? ((topItem.val / totalVal) * 100).toFixed(1) : '0';
      const isCurrency = /sales|revenue|profit|cost|spend|budget|price|mrr|amount/i.test(yCol);
      const fmt = isCurrency ? formatNum : formatPureNum;

      const top3Share = items.slice(0, 3).reduce((acc, it) => acc + it.val, 0);
      const top3Pct = totalVal > 0 ? ((top3Share / totalVal) * 100).toFixed(1) : '0';

      const headline = `Top Performer: "${topItem.cat}" leads with ${fmt(topItem.val)} (${topPct}% of total ${this.formatName(yCol)})`;
      const narrative = `Across ${items.length} segments analyzed for ${this.formatName(yCol)}, "${topItem.cat}" commands the top position at ${fmt(topItem.val)}, outperforming the lowest segment ("${bottomItem.cat}" at ${fmt(bottomItem.val)}). The aggregate total is ${fmt(totalVal)} with a category average of ${fmt(avgVal)}. Concentration remains ${Number(top3Pct) > 70 ? 'high' : 'balanced'}, with the top ${Math.min(3, items.length)} groups generating ${top3Pct}% of cumulative volume.`;

      const keyInsights = [
        `"${topItem.cat}" represents the highest individual contribution (${topPct}% share).`,
        `Mean contribution per segment is ${fmt(avgVal)}, with ${items.filter(i => i.val >= avgVal).length} of ${items.length} segments performing above average.`,
        `Cumulative volume across all ${items.length} categories sums to ${fmt(totalVal)}.`
      ];

      const metrics = [
        { label: `Total ${this.formatName(yCol)}`, value: fmt(totalVal) },
        { label: 'Top Performer', value: topItem.cat, helper: `${fmt(topItem.val)} (${topPct}%)` },
        { label: 'Category Average', value: fmt(avgVal) },
        { label: 'Segments Analyzed', value: `${items.length}` }
      ];

      return { headline, narrative, keyInsights, metrics };
    }

    // Time-Series & Trends (line, area)
    if (['line', 'area'].includes(chartType)) {
      const isCurrency = /sales|revenue|profit|cost|spend|budget|price|mrr|amount/i.test(yCol);
      const fmt = isCurrency ? formatNum : formatPureNum;

      const points = data.map((d: any) => {
        const period = String(d[xCol] ?? d.period ?? d.date ?? '');
        const val = Number(d[yCol] ?? d.value ?? 0);
        return { period, val: isNaN(val) ? 0 : val };
      });

      const firstPt = points[0] || { period: '', val: 0 };
      const lastPt = points[points.length - 1] || { period: '', val: 0 };
      let maxPt = points[0] || { period: '', val: 0 };
      let minPt = points[0] || { period: '', val: 0 };
      let totalVal = 0;

      points.forEach(p => {
        totalVal += p.val;
        if (p.val > maxPt.val) maxPt = p;
        if (p.val < minPt.val) minPt = p;
      });

      const avgVal = totalVal / (points.length || 1);
      const netChangePct = firstPt.val !== 0
        ? (((lastPt.val - firstPt.val) / Math.abs(firstPt.val)) * 100).toFixed(1)
        : '0';
      const isPositive = Number(netChangePct) >= 0;

      const headline = `Trend Trajectory: ${isPositive ? '+' : ''}${netChangePct}% net variance across ${points.length} intervals (Peak: ${maxPt.period})`;
      const narrative = `Chronological progression across ${points.length} reporting periods shows an overall ${isPositive ? 'expansion' : 'contraction'} from ${fmt(firstPt.val)} (${firstPt.period}) to ${fmt(lastPt.val)} (${lastPt.period}). The historical peak occurred in ${maxPt.period} reaching ${fmt(maxPt.val)}, while the series low was recorded in ${minPt.period} (${fmt(minPt.val)}). Aggregate period volume stands at ${fmt(totalVal)}.`;

      const keyInsights = [
        `Net trajectory shifted by ${isPositive ? '+' : ''}${netChangePct}% from initial period to latest interval.`,
        `Peak performance achieved in ${maxPt.period} with ${fmt(maxPt.val)}.`,
        `Average run-rate per period is ${fmt(avgVal)} across ${points.length} observed cycles.`
      ];

      const metrics = [
        { label: 'Net Change', value: `${isPositive ? '+' : ''}${netChangePct}%`, helper: `${firstPt.period} to ${lastPt.period}` },
        { label: 'Peak Period', value: maxPt.period, helper: fmt(maxPt.val) },
        { label: 'Period Average', value: fmt(avgVal) },
        { label: `Total ${this.formatName(yCol)}`, value: fmt(totalVal) }
      ];

      return { headline, narrative, keyInsights, metrics };
    }

    // Scatter
    if (chartType === 'scatter') {
      const pts = data.map(d => ({ x: Number(d[xCol] ?? d.x ?? 0), y: Number(d[yCol] ?? d.y ?? 0) }))
        .filter(p => !isNaN(p.x) && !isNaN(p.y));

      const count = pts.length;
      const xVals = pts.map(p => p.x);
      const yVals = pts.map(p => p.y);
      const minX = xVals.length ? Math.min(...xVals) : 0;
      const maxX = xVals.length ? Math.max(...xVals) : 0;
      const minY = yVals.length ? Math.min(...yVals) : 0;
      const maxY = yVals.length ? Math.max(...yVals) : 0;

      const headline = `Bivariate Dispersion: ${count.toLocaleString()} observations mapped across ${this.formatName(xCol)} & ${this.formatName(yCol)}`;
      const narrative = `Observation scatter plot illustrates bivariate distribution across ${count.toLocaleString()} plotted records. Horizontal axis (${this.formatName(xCol)}) extends from ${minX.toLocaleString()} to ${maxX.toLocaleString()}, while vertical axis (${this.formatName(yCol)}) ranges from ${minY.toLocaleString()} to ${maxY.toLocaleString()}.`;

      return {
        headline,
        narrative,
        keyInsights: [
          `${count.toLocaleString()} granular row records plotted without aggregation.`,
          `Horizontal axis spread: ${minX.toFixed(1)} to ${maxX.toFixed(1)}.`,
          `Vertical axis spread: ${minY.toFixed(1)} to ${maxY.toFixed(1)}.`
        ],
        metrics: [
          { label: 'Plotted Points', value: count.toLocaleString() },
          { label: `${this.formatName(xCol)} Range`, value: `${minX.toFixed(1)} - ${maxX.toFixed(1)}` },
          { label: `${this.formatName(yCol)} Range`, value: `${minY.toFixed(1)} - ${maxY.toFixed(1)}` }
        ]
      };
    }

    // Bubble
    if (chartType === 'bubble') {
      const pts = data.map(d => ({ x: Number(d.x ?? 0), y: Number(d.y ?? 0), z: Number(d.z ?? 0) }));
      const count = pts.length;
      const topBubble = pts.reduce((max, p) => (p.z > max.z ? p : max), pts[0] || { x: 0, y: 0, z: 0 });

      return {
        headline: `Multi-Dimensional Bubble Matrix: ${count.toLocaleString()} observations weighted by magnitude`,
        narrative: `3-variable distribution mapping ${this.formatName(xCol)} vs ${this.formatName(yCol)} with magnitude scaling. Highest-weight cluster recorded with bubble intensity ${topBubble.z}.`,
        keyInsights: [
          `Analyzes ${count.toLocaleString()} observations across horizontal and vertical coordinates.`,
          `Largest bubble metric index: ${topBubble.z} at (${topBubble.x.toLocaleString()}, ${topBubble.y.toLocaleString()}).`,
          `Reveals cluster density patterns and volumetric correlation.`
        ],
        metrics: [
          { label: 'Sample Volume', value: count.toLocaleString() },
          { label: 'Max Bubble Size', value: `${topBubble.z}` },
          { label: 'Axis Coordinates', value: `${this.formatName(xCol)} × ${this.formatName(yCol)}` }
        ]
      };
    }

    // Waterfall
    if (chartType === 'waterfall') {
      const steps = data.filter(d => !d.isTotal);
      const totalItem = data.find(d => d.isTotal) || steps[steps.length - 1];
      const netVal = totalItem ? totalItem.value : 0;
      const positiveSteps = steps.filter(s => s.delta > 0);
      const negativeSteps = steps.filter(s => s.delta < 0);
      const topPositive = positiveSteps.reduce((max, s) => (s.delta > max.delta ? s : max), positiveSteps[0] || { name: 'None', delta: 0 });
      const topNegative = negativeSteps.reduce((min, s) => (s.delta < min.delta ? s : min), negativeSteps[0] || { name: 'None', delta: 0 });

      return {
        headline: `Variance Bridge: Net Total of ${formatNum(netVal)} across ${steps.length} sequential steps`,
        narrative: `Waterfall variance decomposition highlights ${positiveSteps.length} positive drivers and ${negativeSteps.length} negative deductions leading to a final net outcome of ${formatNum(netVal)}. Leading upward driver is ${topPositive.name} (+${formatNum(topPositive.delta)}), while chief drag is ${topNegative.name} (${formatNum(topNegative.delta)}).`,
        keyInsights: [
          `Net variance concludes at ${formatNum(netVal)} across ${steps.length} operational steps.`,
          `Primary positive impact: ${topPositive.name} contributing +${formatNum(topPositive.delta)}.`,
          negativeSteps.length > 0 ? `Primary offset: ${topNegative.name} detracting ${formatNum(topNegative.delta)}.` : 'No negative variance deductions identified.'
        ],
        metrics: [
          { label: 'Net Balance', value: formatNum(netVal) },
          { label: 'Top Contributor', value: topPositive.name, helper: `+${formatNum(topPositive.delta)}` },
          { label: 'Variance Drag', value: topNegative.name, helper: formatNum(topNegative.delta) },
          { label: 'Step Stages', value: `${steps.length}` }
        ]
      };
    }

    // Funnel
    if (chartType === 'funnel') {
      const topStage = data[0] || { name: 'Start', value: 0 };
      const terminalStage = data[data.length - 1] || { name: 'End', value: 0 };
      const retentionPct = topStage.value > 0 ? Math.round((terminalStage.value / topStage.value) * 1000) / 10 : 0;
      let worstStep = { from: '', to: '', dropPct: 0 };
      for (let i = 1; i < data.length; i++) {
        const drop = 100 - (data[i].stepConversion || 100);
        if (drop > worstStep.dropPct) {
          worstStep = { from: data[i - 1].name, to: data[i].name, dropPct: drop };
        }
      }

      return {
        headline: `Conversion Velocity: ${retentionPct}% end-to-end retention across ${data.length} funnel stages`,
        narrative: `Funnel progression traces volumetric drop-off from initial stage "${topStage.name}" (${formatNum(topStage.value)}) down to terminal retention "${terminalStage.name}" (${formatNum(terminalStage.value)}), representing an overall ${retentionPct}% throughput efficiency. ${worstStep.dropPct > 0 ? `The steepest attrition occurs between "${worstStep.from}" and "${worstStep.to}" with a ${worstStep.dropPct}% stage drop-off.` : 'Conversion maintains steady step momentum.'}`,
        keyInsights: [
          `Overall conversion throughput: ${retentionPct}% from top to bottom stage.`,
          `Initial top-of-funnel intake: ${formatNum(topStage.value)} records.`,
          worstStep.dropPct > 0 ? `Critical friction bottleneck identified between ${worstStep.from} and ${worstStep.to} (${worstStep.dropPct}% loss).` : 'No severe bottleneck drop-offs detected.'
        ],
        metrics: [
          { label: 'Conversion Rate', value: `${retentionPct}%` },
          { label: 'Top Volume', value: formatNum(topStage.value), helper: topStage.name },
          { label: 'Terminal Volume', value: formatNum(terminalStage.value), helper: terminalStage.name },
          { label: 'Pipeline Stages', value: `${data.length}` }
        ]
      };
    }

    // Gauge
    if (chartType === 'gauge') {
      const g = data[0] || { value: 0, target: 100, pctOfTarget: 0, status: 'Critical' };
      return {
        headline: `Executive Target Gauge: ${g.status.toUpperCase()} at ${g.pctOfTarget}% capacity attainment`,
        narrative: `Current operational velocity stands at ${formatNum(g.value)} against the strategic benchmark threshold of ${formatNum(g.target)}, achieving an index score of ${g.pctOfTarget}%. Health status evaluates to "${g.status}".`,
        keyInsights: [
          `Current metric realization: ${formatNum(g.value)} of ${formatNum(g.target)} target.`,
          `Attainment pacing: ${g.pctOfTarget}% of full-scale benchmark capacity.`,
          `Operational status: ${g.status}.`
        ],
        metrics: [
          { label: 'Attainment Index', value: `${g.pctOfTarget}%` },
          { label: 'Actual Score', value: formatNum(g.value) },
          { label: 'Benchmark Target', value: formatNum(g.target) },
          { label: 'Health Status', value: g.status }
        ]
      };
    }

    // Heatmap
    if (chartType === 'heatmap') {
      const rowsCount = data.length;
      const colsCount = (computed.seriesKeys || []).length;
      return {
        headline: `Cross-Tabulation Matrix: ${rowsCount} × ${colsCount} intersection density breakdown`,
        narrative: `Matrix heatmap correlates primary dimension "${this.formatName(xCol)}" across "${this.formatName(yCol)}", mapping density concentration across ${rowsCount * colsCount} active cross-tabulation cells.`,
        keyInsights: [
          `Analyzes multi-dimensional density across a ${rowsCount} × ${colsCount} matrix.`,
          `Identifies intersection hotspots and zero-activity pockets.`,
          `Evaluates structural distribution and correlation strength.`
        ],
        metrics: [
          { label: 'Grid Dimensions', value: `${rowsCount} × ${colsCount}` },
          { label: 'Total Cells', value: `${rowsCount * colsCount}` },
          { label: 'Row Dimension', value: this.formatName(xCol) },
          { label: 'Column Dimension', value: this.formatName(yCol) }
        ]
      };
    }

    // Composed Dual-Axis
    if (chartType === 'composed') {
      const pKey = computed.seriesKeys?.[0] || 'Volume';
      const sKey = computed.seriesKeys?.[1] || 'Trend';
      return {
        headline: `Dual-Axis Synchronization: ${this.formatName(pKey)} volume paired with ${this.formatName(sKey)} trend`,
        narrative: `Composed multi-variable perspective synchronizes primary volume distribution for "${this.formatName(pKey)}" against secondary overlay series "${this.formatName(sKey)}" across ${data.length} categorical segments.`,
        keyInsights: [
          `Synchronizes categorical bar volumes with continuous overlay trendline.`,
          `Tracks alignment and divergent cycles across ${data.length} segments.`,
          `Enables dual-dimensional comparison without visual clutter.`
        ],
        metrics: [
          { label: 'Observed Segments', value: `${data.length}` },
          { label: 'Primary Bar Metric', value: this.formatName(pKey) },
          { label: 'Overlay Trend', value: this.formatName(sKey) }
        ]
      };
    }

    // Default Fallback
    return {
      headline: `${title}: Distribution Analysis`,
      narrative: `Analytical visualization measuring ${this.formatName(yCol)} across ${this.formatName(xCol)} (${data.length} recorded segments).`,
      keyInsights: [
        `Captured ${data.length} observations in the active series.`,
        `Generated from dataset ${dataset?.name || 'active data'}.`
      ],
      metrics: [
        { label: 'Data Points', value: `${data.length}` },
        { label: 'Primary Dimension', value: this.formatName(xCol) },
        { label: 'Primary Metric', value: this.formatName(yCol) }
      ]
    };
  }

  public static removeVisualizationFromDashboard(dashboardId: string, itemId: string): void {
    const dashboards = this.getCustomDashboards();
    const target = dashboards.find(d => d.id === dashboardId);
    if (!target) return;

    target.items = target.items.filter(i => i.id !== itemId);
    target.lastModified = Date.now();
    this.saveCustomDashboard(target);
  }

  public static duplicateCustomDashboard(id: string): CustomDashboard | null {
    const dashboards = this.getCustomDashboards();
    const orig = dashboards.find(d => d.id === id);
    if (!orig) return null;

    const copy: CustomDashboard = {
      ...orig,
      id: `dash_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: `${orig.name} (Copy)`,
      items: orig.items.map(it => ({ ...it, id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` })),
      createdAt: Date.now(),
      lastModified: Date.now()
    };

    this.saveCustomDashboard(copy);
    return copy;
  }

  /**
   * Computes clean KPI card metrics with optional mathematically valid period comparisons
   */
  public static computeKPICard(
    dataset: DatasetState,
    kpi: DashboardKPICard,
    activeFilters?: DashboardActiveFilter[]
  ): { value: string; rawValue: number; changePct?: number; changeLabel?: string } {
    let rows = [...dataset.workingRows];

    // Apply active dashboard filters
    if (activeFilters && activeFilters.length > 0) {
      activeFilters.forEach(f => {
        if (f.value && f.value !== 'ALL' && dataset.columns.includes(f.column)) {
          rows = rows.filter(r => String(r[f.column]) === String(f.value));
        }
      });
    }

    if (rows.length === 0) {
      return { value: '0', rawValue: 0 };
    }

    let rawVal = 0;
    if (kpi.aggregation === 'count') {
      rawVal = rows.length;
    } else if (kpi.aggregation === 'distinct') {
      const unique = new Set(rows.map(r => String(r[kpi.column])));
      rawVal = unique.size;
    } else {
      const vals = rows.map(r => Number(r[kpi.column])).filter(v => !isNaN(v) && isFinite(v));
      if (vals.length === 0) {
        rawVal = 0;
      } else if (kpi.aggregation === 'sum') {
        rawVal = ss.sum(vals);
      } else if (kpi.aggregation === 'avg') {
        rawVal = ss.mean(vals);
      } else if (kpi.aggregation === 'min') {
        rawVal = Math.min(...vals);
      } else if (kpi.aggregation === 'max') {
        rawVal = Math.max(...vals);
      }
    }

    // Format value
    let formattedVal = '';
    if (kpi.format === 'currency') {
      formattedVal = rawVal >= 1_000_000
        ? `$${(rawVal / 1_000_000).toFixed(1)}M`
        : rawVal >= 1_000
        ? `$${(rawVal / 1_000).toFixed(1)}K`
        : `$${rawVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    } else if (kpi.format === 'percent') {
      formattedVal = `${rawVal.toFixed(1)}%`;
    } else {
      formattedVal = rawVal >= 1_000_000
        ? `${(rawVal / 1_000_000).toFixed(1)}M`
        : rawVal >= 1_000
        ? `${(rawVal / 1_000).toFixed(1)}K`
        : rawVal % 1 !== 0
        ? rawVal.toFixed(2)
        : rawVal.toLocaleString();
    }

    // Optional comparison calculation if date column exists
    let changePct: number | undefined;
    let changeLabel = kpi.comparisonLabel || 'vs Prior Period';

    const dateCol = dataset.columns.find(c => dataset.profiles[c]?.type === 'datetime' || /date|time|created/i.test(c));
    if (dateCol && rows.length >= 4 && kpi.aggregation !== 'distinct') {
      try {
        const sorted = [...rows].sort((a, b) => new Date(a[dateCol]).getTime() - new Date(b[dateCol]).getTime());
        const half = Math.floor(sorted.length / 2);
        const priorRows = sorted.slice(0, half);
        const currentRows = sorted.slice(half);

        const getAggr = (rList: Record<string, any>[]) => {
          if (kpi.aggregation === 'count') return rList.length;
          const v = rList.map(r => Number(r[kpi.column])).filter(n => !isNaN(n) && isFinite(n));
          if (v.length === 0) return 0;
          return kpi.aggregation === 'avg' ? ss.mean(v) : ss.sum(v);
        };

        const priorVal = getAggr(priorRows);
        const currVal = getAggr(currentRows);

        if (priorVal > 0) {
          changePct = Math.round(((currVal - priorVal) / priorVal) * 1000) / 10;
        }
      } catch {
        changePct = undefined;
      }
    }

    return {
      value: formattedVal,
      rawValue: rawVal,
      changePct,
      changeLabel: changePct !== undefined ? changeLabel : undefined
    };
  }

  /**
   * Generates 3-5 structured, evidence-based dashboard insights
   * Filter-aware, date-aware, and mathematically grounded.
   */
  public static generateStructuredDashboardInsights(
    dataset: DatasetState,
    dashboard: CustomDashboard,
    activeFilters: DashboardActiveFilter[] = [],
    globalDateFilter: string = 'all_time',
    computedResults: { item?: CustomDashboardItem; viz: SavedVisualization | null; computed: VisualizationComputationResult | null; error?: string | null }[] = []
  ): StructuredDashboardInsight[] {
    // 1. Filter rows by active filters
    let filteredRows = [...dataset.workingRows];
    const appliedFilterLabels: string[] = [];

    activeFilters.forEach(f => {
      if (f.value && f.value !== 'ALL' && dataset.columns.includes(f.column)) {
        filteredRows = filteredRows.filter(r => String(r[f.column]) === String(f.value));
        appliedFilterLabels.push(`${f.column}: ${f.value}`);
      }
    });

    if (globalDateFilter && globalDateFilter !== 'all_time') {
      appliedFilterLabels.push(`Timeline: ${globalDateFilter.replace(/_/g, ' ')}`);
    }

    const filterPrefix = appliedFilterLabels.length > 0 ? `[${appliedFilterLabels.join(', ')}] ` : '';
    const insights: StructuredDashboardInsight[] = [];
    const seenCategories = new Set<string>();

    const formatNum = (v: number) => {
      if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
      if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}K`;
      return v.toLocaleString();
    };

    // 2. Extract evidence-based insights from computed visual results
    for (const res of computedResults) {
      if (insights.length >= 5) break;
      const { viz, computed } = res;
      if (!computed || !computed.isValid || !computed.data || computed.data.length === 0) continue;

      const chartTitle = computed.title || viz?.name || 'Chart';
      const xKey = computed.xAxisTitle || 'Dimension';
      const yKey = computed.yAxisTitle || 'Value';

      // A. Temporal Trend (Line / Area)
      if ((computed.chartType === 'line' || computed.chartType === 'area') && computed.data.length >= 2) {
        const validPoints = computed.data.filter(d => d.value !== undefined && !isNaN(Number(d.value)));
        if (validPoints.length >= 2 && !seenCategories.has('trend')) {
          const first = validPoints[0];
          const last = validPoints[validPoints.length - 1];
          const firstVal = Number(first.value);
          const lastVal = Number(last.value);
          const firstLabel = String(first.date || first.Period || first.name || Object.values(first)[0]);
          const lastLabel = String(last.date || last.Period || last.name || Object.values(last)[0]);

          if (firstVal > 0) {
            const deltaPct = ((lastVal - firstVal) / firstVal) * 100;
            const absPct = Math.abs(deltaPct).toFixed(1);
            const dir = deltaPct >= 0 ? 'increased' : 'declined';
            const sign = deltaPct >= 0 ? '+' : '-';

            insights.push({
              id: `ins_trend_${viz?.id || Math.random().toString(36).substr(2, 6)}`,
              type: 'trend',
              title: `${filterPrefix}${yKey} ${dir} by ${absPct}% over the observed period.`,
              evidence: `${firstLabel}: ${formatNum(firstVal)} → ${lastLabel}: ${formatNum(lastVal)} (${sign}${absPct}%)`,
              confidence: 95,
              details: {
                metric: yKey,
                calculation: `((${lastVal} - ${firstVal}) / ${firstVal}) * 100`,
                comparisonPeriod: `${firstLabel} to ${lastLabel}`,
                filtersApplied: appliedFilterLabels,
                sourceVizTitle: chartTitle
              },
              actionableRecommendation: deltaPct < -5 ? {
                type: 'agent',
                label: `Investigate ${yKey} Decline`,
                targetSection: 'investigations',
                promptOrGoal: `Investigate root cause drivers for recent ${yKey} decline (${sign}${absPct}%) in ${dataset.name}.`
              } : {
                type: 'ml',
                label: `Forecast ${yKey}`,
                targetSection: 'ml',
                promptOrGoal: `Train predictive time-series model on ${yKey}.`
              }
            });
            seenCategories.add('trend');
          }
        }
      }

      // B. Contribution / Share (Bar / Donut / Pie / Horizontal Bar)
      if ((computed.chartType === 'bar' || computed.chartType === 'donut' || computed.chartType === 'pie' || computed.chartType === 'horizontal_bar') && computed.data.length >= 2) {
        const sorted = [...computed.data].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
        const topItem = sorted[0];
        const secondItem = sorted[1];
        const topVal = Number(topItem.value) || 0;
        const secondVal = Number(secondItem.value) || 0;
        const total = ss.sum(sorted.map(d => Number(d.value) || 0));
        const topName = String(topItem.category || topItem.name || Object.values(topItem)[0]);
        const secondName = String(secondItem.category || secondItem.name || Object.values(secondItem)[0]);

        if (total > 0 && topVal > 0) {
          const sharePct = ((topVal / total) * 100).toFixed(1);

          // 1. Top Contribution
          if (!seenCategories.has('contribution')) {
            insights.push({
              id: `ins_contrib_${viz?.id || Math.random().toString(36).substr(2, 6)}`,
              type: 'contribution',
              title: `${filterPrefix}${topName} generates the highest ${yKey} (${sharePct}% of total).`,
              evidence: `${formatNum(topVal)} out of ${formatNum(total)} total across ${sorted.length} ${xKey} segments.`,
              confidence: 96,
              details: {
                metric: yKey,
                calculation: `(${topVal} / ${total}) * 100 across visible segments`,
                filtersApplied: appliedFilterLabels,
                sourceVizTitle: chartTitle
              },
              actionableRecommendation: {
                type: 'statistics',
                label: `Validate Segment Significance`,
                targetSection: 'statistics',
                promptOrGoal: `Run one-way ANOVA test to evaluate ${yKey} variance across ${xKey}.`
              }
            });
            seenCategories.add('contribution');
          }

          // 2. Direct Segment Comparison
          if (!seenCategories.has('comparison') && secondVal > 0 && topName !== secondName) {
            const deltaPct = (((topVal - secondVal) / secondVal) * 100).toFixed(1);
            insights.push({
              id: `ins_comp_${viz?.id || Math.random().toString(36).substr(2, 6)}`,
              type: 'comparison',
              title: `${filterPrefix}${topName} generated ${deltaPct}% more ${yKey} than ${secondName}.`,
              evidence: `${topName}: ${formatNum(topVal)} vs ${secondName}: ${formatNum(secondVal)} (Delta: +${formatNum(topVal - secondVal)})`,
              confidence: 94,
              details: {
                metric: yKey,
                calculation: `((${topVal} - ${secondVal}) / ${secondVal}) * 100`,
                filtersApplied: appliedFilterLabels,
                sourceVizTitle: chartTitle
              },
              actionableRecommendation: {
                type: 'statistics',
                label: `Compare Two-Sample Means`,
                targetSection: 'statistics',
                promptOrGoal: `Run two-sample t-test comparing ${topName} vs ${secondName} on ${yKey}.`
              }
            });
            seenCategories.add('comparison');
          }
        }
      }

      // C. Statistical Correlation in Scatter
      if (computed.chartType === 'scatter' && computed.data.length >= 6 && !seenCategories.has('correlation')) {
        const xVals = computed.data.map(d => Number(d.x)).filter(v => !isNaN(v));
        const yVals = computed.data.map(d => Number(d.y)).filter(v => !isNaN(v));
        if (xVals.length >= 6 && yVals.length === xVals.length) {
          try {
            const r = ss.sampleCorrelation(xVals, yVals);
            if (!isNaN(r) && Math.abs(r) >= 0.40) {
              const isPos = r > 0;
              const strength = Math.abs(r) >= 0.70 ? 'Strong' : 'Moderate';
              insights.push({
                id: `ins_corr_${viz?.id || Math.random().toString(36).substr(2, 6)}`,
                type: 'correlation',
                title: `${filterPrefix}${strength} ${isPos ? 'positive' : 'negative'} correlation between ${xKey} and ${yKey}.`,
                evidence: `Pearson r = ${isPos ? '+' : ''}${r.toFixed(2)} (n = ${xVals.length} observations).`,
                confidence: 92,
                details: {
                  metric: `Correlation (${xKey} vs ${yKey})`,
                  calculation: `Sample Pearson correlation coefficient r = ${r.toFixed(4)}`,
                  filtersApplied: appliedFilterLabels,
                  sourceVizTitle: chartTitle
                },
                actionableRecommendation: {
                  type: 'statistics',
                  label: `Run Full Regression Test`,
                  targetSection: 'statistics',
                  promptOrGoal: `Run linear regression analysis for ${yKey} on ${xKey}.`
                }
              });
              seenCategories.add('correlation');
            }
          } catch {
            // ignore
          }
        }
      }
    }

    // 3. Fallback to underlying dataset profiles if visual items are few
    if (insights.length < 3) {
      const numCols = dataset.columns.filter(c => dataset.profiles[c]?.type === 'numeric');
      const catCols = dataset.columns.filter(c => dataset.profiles[c]?.type === 'categorical');

      if (numCols.length > 0 && catCols.length > 0 && !seenCategories.has('contribution')) {
        const numCol = numCols.find(c => /sales|revenue|profit|amount/i.test(c)) || numCols[0];
        const catCol = catCols[0];
        const groups: Record<string, number> = {};
        let total = 0;
        filteredRows.forEach(r => {
          const cat = String(r[catCol] || 'Other');
          const v = Number(r[numCol]) || 0;
          groups[cat] = (groups[cat] || 0) + v;
          total += v;
        });

        const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0 && total > 0) {
          const top = sorted[0];
          const pct = ((top[1] / total) * 100).toFixed(1);
          insights.push({
            id: `ins_cat_top_${Date.now()}`,
            type: 'contribution',
            title: `${filterPrefix}${top[0]} generated the highest ${numCol}.`,
            evidence: `${formatNum(top[1])} (${pct}% of aggregate volume).`,
            confidence: 95,
            details: {
              metric: numCol,
              calculation: `Sum of ${numCol} grouped by ${catCol}`,
              filtersApplied: appliedFilterLabels
            }
          });
        }
      }
    }

    if (insights.length === 0) {
      insights.push({
        id: `ins_empty_${Date.now()}`,
        type: 'trend',
        title: 'Insufficient data points to generate reliable insights.',
        evidence: 'Active filter slice contains limited observations.',
        details: {
          metric: 'Observation Count',
          calculation: `${filteredRows.length} active rows`,
          filtersApplied: appliedFilterLabels
        }
      });
    }

    return insights.slice(0, 4);
  }

  /**
   * Generates 3-5 concise, mathematically evidence-based dashboard insights (string summary)
   */
  public static generateDashboardInsights(
    dataset: DatasetState,
    dashboard: CustomDashboard,
    computedResults: { title: string; data: any[]; chartType: string }[]
  ): string[] {
    const structured = this.generateStructuredDashboardInsights(dataset, dashboard, dashboard.activeFilters || [], 'all_time', computedResults.map(r => ({
      viz: null,
      computed: {
        isValid: true,
        chartType: r.chartType as any,
        title: r.title,
        description: '',
        xAxisTitle: 'Dimension',
        yAxisTitle: 'Value',
        xAxisKey: 'Dimension',
        yAxisKey: 'Value',
        seriesKeys: [],
        data: r.data
      }
    })));

    return structured.map(s => `${s.title} (${s.evidence})`);
  }

  /**
   * Templates for quick starts
   */
  public static getTemplates(): VisualizationTemplate[] {
    return [
      {
        id: 'template_sales_trend',
        name: 'Sales Trend',
        description: 'Monthly timeline showing metric growth',
        category: 'Temporal Trend',
        chartType: 'line',
        fieldMatcher: (cols, profiles) => {
          const dateCol = cols.find(c => profiles[c]?.type === 'datetime' || /date|time|created/i.test(c));
          const numCol = cols.find(c => /sales|revenue|amount|total|price/i.test(c)) || cols.find(c => profiles[c]?.type === 'numeric');
          if (!dateCol || !numCol) return null;
          return {
            xAxisColumn: dateCol,
            yAxisColumn: numCol,
            aggregation: 'sum',
            timeGranularity: 'monthly'
          };
        }
      },
      {
        id: 'template_sales_category',
        name: 'Sales by Category',
        description: 'Bar breakdown of metric by category',
        category: 'Categorical',
        chartType: 'bar',
        fieldMatcher: (cols, profiles) => {
          const catCol = cols.find(c => /category|region|type|segment|department/i.test(c)) || cols.find(c => profiles[c]?.type === 'categorical');
          const numCol = cols.find(c => /sales|revenue|amount|profit/i.test(c)) || cols.find(c => profiles[c]?.type === 'numeric');
          if (!catCol || !numCol) return null;
          return {
            xAxisColumn: catCol,
            yAxisColumn: numCol,
            aggregation: 'sum',
            topN: 10,
            sortBy: 'desc'
          };
        }
      },
      {
        id: 'template_profit_region',
        name: 'Profit by Region',
        description: 'Horizontal ranking of region profitability',
        category: 'Ranking',
        chartType: 'horizontal_bar',
        fieldMatcher: (cols, profiles) => {
          const catCol = cols.find(c => /region|state|country|city|market/i.test(c)) || cols.find(c => profiles[c]?.type === 'categorical');
          const numCol = cols.find(c => /profit|margin|revenue|income/i.test(c)) || cols.find(c => profiles[c]?.type === 'numeric');
          if (!catCol || !numCol) return null;
          return {
            xAxisColumn: catCol,
            yAxisColumn: numCol,
            aggregation: 'sum',
            topN: 8,
            sortBy: 'desc'
          };
        }
      },
      {
        id: 'template_top_products',
        name: 'Top Products',
        description: 'Top 10 items ranked by revenue',
        category: 'Ranking',
        chartType: 'bar',
        fieldMatcher: (cols, profiles) => {
          const catCol = cols.find(c => /product|item|sku|title|customer/i.test(c)) || cols.find(c => profiles[c]?.type === 'categorical');
          const numCol = cols.find(c => /sales|revenue|amount|quantity/i.test(c)) || cols.find(c => profiles[c]?.type === 'numeric');
          if (!catCol || !numCol) return null;
          return {
            xAxisColumn: catCol,
            yAxisColumn: numCol,
            aggregation: 'sum',
            topN: 10,
            sortBy: 'desc'
          };
        }
      },
      {
        id: 'template_category_share',
        name: 'Category Share',
        description: 'Donut distribution of total contribution',
        category: 'Share / Proportion',
        chartType: 'donut',
        fieldMatcher: (cols, profiles) => {
          const catCol = cols.find(c => /segment|category|channel|plan|tier/i.test(c)) || cols.find(c => profiles[c]?.type === 'categorical');
          const numCol = cols.find(c => /sales|revenue|count|users|subscribers/i.test(c)) || cols.find(c => profiles[c]?.type === 'numeric');
          if (!catCol || !numCol) return null;
          return {
            xAxisColumn: catCol,
            yAxisColumn: numCol,
            aggregation: 'sum',
            topN: 6
          };
        }
      },
      {
        id: 'template_correlation',
        name: 'Correlation',
        description: 'Scatter plot of two numerical variables',
        category: 'Relationship',
        chartType: 'scatter',
        fieldMatcher: (cols, profiles) => {
          const numCols = cols.filter(c => profiles[c]?.type === 'numeric');
          if (numCols.length < 2) return null;
          return {
            xAxisColumn: numCols[0],
            yAxisColumn: numCols[1]
          };
        }
      }
    ];
  }
}
