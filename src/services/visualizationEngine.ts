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
  CUSTOM_DASHBOARDS: 'datamind_custom_dashboards_v9'
};

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

    // 4. Scatter Plot Execution Path (X numeric, Y numeric)
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

    // 5. Categorical / Dimension Aggregation Path (Bar, Line, Area, Pie, Donut, Stacked Bar)
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
    } catch (e) {
      console.warn('Failed to save visualization:', e);
    }
  }

  public static deleteVisualization(id: string): void {
    try {
      const current = this.getSavedVisualizations().filter(v => v.id !== id);
      localStorage.setItem(STORAGE_KEYS.SAVED_VIZ, JSON.stringify(current));
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
    return true;
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
