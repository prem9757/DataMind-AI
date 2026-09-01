// ============================================================================
// PHASE 10: CALENDAR-AWARE TEMPORAL AGGREGATION ENGINE
// ============================================================================

import {
  TimeGranularity,
  DateRangeConfig,
  AggregationFunction,
  ComparisonMode,
  TemporalAggregationConfig,
  TemporalDataPoint,
  TemporalAggregationResult
} from '../types/temporal';
import { ChartTitleEngine } from './chartTitleEngine';
import * as ss from 'simple-statistics';

export class TemporalEngine {
  /**
   * Main aggregation pipeline: parses dates, applies ranges, groups by calendar intervals,
   * computes aggregations, handles missing periods, growth %, cumulative sums, and moving averages.
   */
  public static aggregate(
    rows: Record<string, any>[],
    config: TemporalAggregationConfig
  ): TemporalAggregationResult {
    const {
      dateColumn,
      metricColumn,
      aggregation = 'sum',
      granularity: reqGranularity = 'auto',
      dateRange = { preset: 'all_time' },
      groupByDimension,
      topN = 5,
      comparisonMode = 'none',
      movingAverageWindow
    } = config;

    // 1. Extract valid records with parseable dates
    const parsedRecords: { date: Date; timestamp: number; metric: number; dimVal?: string; raw: Record<string, any> }[] = [];
    for (const r of rows) {
      const rawDate = r[dateColumn];
      if (rawDate === null || rawDate === undefined || rawDate === '') continue;

      const dateObj = this.parseDate(rawDate);
      if (!dateObj || isNaN(dateObj.getTime())) continue;

      const metricVal = Number(r[metricColumn]);
      const validMetric = !isNaN(metricVal) && isFinite(metricVal) ? metricVal : 0;
      const dimVal = groupByDimension ? String(r[groupByDimension] ?? 'Uncategorized').trim() : undefined;

      parsedRecords.push({
        date: dateObj,
        timestamp: dateObj.getTime(),
        metric: validMetric,
        dimVal,
        raw: r
      });
    }

    if (parsedRecords.length === 0) {
      return this.generateEmptyResult(config, 'No valid date records found');
    }

    // Sort chronologically
    parsedRecords.sort((a, b) => a.timestamp - b.timestamp);

    // 2. Determine Date Bounds & Filter by Date Range
    const minTimestamp = parsedRecords[0].timestamp;
    const maxTimestamp = parsedRecords[parsedRecords.length - 1].timestamp;
    const maxDate = new Date(maxTimestamp);

    const filteredRecords = this.filterByDateRange(parsedRecords, dateRange, maxDate);
    if (filteredRecords.length === 0) {
      return this.generateEmptyResult(config, 'No data is available for the selected date range.');
    }

    // 3. Resolve Granularity (Auto detection)
    const effectiveMin = filteredRecords[0].timestamp;
    const effectiveMax = filteredRecords[filteredRecords.length - 1].timestamp;
    const durationDays = (effectiveMax - effectiveMin) / (1000 * 60 * 60 * 24);

    let resolvedGranularity: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' = 'monthly';
    if (reqGranularity === 'auto') {
      if (durationDays <= 14) resolvedGranularity = 'daily';
      else if (durationDays <= 90) resolvedGranularity = 'weekly';
      else if (durationDays <= 365 * 3) resolvedGranularity = 'monthly';
      else if (durationDays <= 365 * 10) resolvedGranularity = 'quarterly';
      else resolvedGranularity = 'yearly';
    } else {
      resolvedGranularity = reqGranularity;
    }

    // 4. Identify Unit & Currency Metadata
    const unit = this.detectUnit(metricColumn, filteredRecords.map(r => r.metric));

    // 5. Group by Calendar Interval
    const periodMap = new Map<string, {
      periodKey: string;
      periodLabel: string;
      timestamp: number;
      values: number[];
      dimGroups: Record<string, number[]>;
    }>();

    // Track dimension cardinality
    const dimTotals: Record<string, number> = {};

    for (const rec of filteredRecords) {
      const { periodKey, periodLabel, startTimestamp } = this.getPeriodInfo(rec.date, resolvedGranularity);

      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, {
          periodKey,
          periodLabel,
          timestamp: startTimestamp,
          values: [],
          dimGroups: {}
        });
      }

      const entry = periodMap.get(periodKey)!;
      entry.values.push(rec.metric);

      if (rec.dimVal) {
        if (!entry.dimGroups[rec.dimVal]) entry.dimGroups[rec.dimVal] = [];
        entry.dimGroups[rec.dimVal].push(rec.metric);
        dimTotals[rec.dimVal] = (dimTotals[rec.dimVal] || 0) + rec.metric;
      }
    }

    // Determine Top N dimension values if grouping is active
    let activeSeriesKeys: string[] = [];
    if (groupByDimension) {
      const rankedDims = Object.entries(dimTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([dim]) => dim);
      activeSeriesKeys = topN > 0 ? rankedDims.slice(0, topN) : rankedDims;
    } else {
      activeSeriesKeys = [metricColumn];
    }

    // Sort periods chronologically
    const sortedPeriods = Array.from(periodMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    // 6. Compute Aggregations, Missing Periods, Growth, Cumulative & Moving Averages
    let runningCumulative = 0;
    let prevVal: number | null = null;
    const valueBuffer: number[] = [];
    const maWindow = movingAverageWindow || (resolvedGranularity === 'daily' ? 7 : resolvedGranularity === 'monthly' ? 3 : 2);

    const dataPoints: TemporalDataPoint[] = [];

    for (let i = 0; i < sortedPeriods.length; i++) {
      const p = sortedPeriods[i];
      const aggregatedVal = this.computeAggregate(p.values, aggregation);

      runningCumulative += aggregatedVal;
      valueBuffer.push(aggregatedVal);

      // Period-over-period Growth %
      let growthPct: number | undefined;
      if (prevVal !== null && prevVal !== 0) {
        growthPct = Math.round(((aggregatedVal - prevVal) / Math.abs(prevVal)) * 1000) / 10;
      } else if (prevVal === 0) {
        growthPct = aggregatedVal > 0 ? 100 : 0;
      }
      prevVal = aggregatedVal;

      // Moving Average calculation
      let movingAvg: number | undefined;
      if (valueBuffer.length >= maWindow) {
        const windowVals = valueBuffer.slice(valueBuffer.length - maWindow);
        movingAvg = Math.round(ss.mean(windowVals) * 100) / 100;
      }

      const point: TemporalDataPoint = {
        periodKey: p.periodKey,
        periodLabel: p.periodLabel,
        timestamp: p.timestamp,
        value: aggregatedVal,
        formattedValue: this.formatValue(aggregatedVal, unit),
        count: p.values.length,
        growthPct,
        cumulativeValue: runningCumulative,
        movingAverage: movingAvg
      };

      // Set standard yAxis value or grouped dimension series
      if (groupByDimension) {
        for (const dim of activeSeriesKeys) {
          const dimVals = p.dimGroups[dim] || [];
          point[dim] = this.computeAggregate(dimVals, aggregation);
        }
      } else {
        point[metricColumn] = aggregatedVal;
      }

      dataPoints.push(point);
    }

    // 7. Calculate Global Summary Statistics
    const allAggValues = dataPoints.map(d => d.value);
    const totalVal = aggregation === 'sum' || aggregation === 'count'
      ? ss.sum(allAggValues)
      : Math.round(ss.mean(allAggValues) * 100) / 100;

    let peakPeriod = { label: 'N/A', value: 0 };
    let troughPeriod = { label: 'N/A', value: 0 };
    if (dataPoints.length > 0) {
      const sortedByVal = [...dataPoints].sort((a, b) => b.value - a.value);
      peakPeriod = { label: sortedByVal[0].periodLabel, value: sortedByVal[0].value };
      troughPeriod = { label: sortedByVal[sortedByVal.length - 1].periodLabel, value: sortedByVal[sortedByVal.length - 1].value };
    }

    const firstPt = dataPoints[0]?.value || 0;
    const lastPt = dataPoints[dataPoints.length - 1]?.value || 0;
    const overallGrowthPct = firstPt !== 0
      ? Math.round(((lastPt - firstPt) / Math.abs(firstPt)) * 1000) / 10
      : 0;

    // 8. Generate Exact Dynamic Titles & Descriptions
    const namingCtx = {
      isTemporal: true,
      dateColumn,
      metricColumn,
      dimensionColumn: groupByDimension,
      aggregation,
      granularity: resolvedGranularity,
      chartType: config.chartType,
      comparisonMode,
      movingAverageWindow: maWindow,
      dateRangeLabel: this.getDateRangeLabel(dateRange),
      topN: groupByDimension ? topN : undefined,
      unitSymbol: unit.symbol,
      unitType: unit.type
    };

    const title = ChartTitleEngine.generateTitle(namingCtx);
    const description = ChartTitleEngine.generateDescription(namingCtx);
    const xAxisTitle = ChartTitleEngine.generateXAxisTitle(namingCtx);
    const yAxisTitle = ChartTitleEngine.generateYAxisTitle(namingCtx);

    // 9. Format Synchronized Data Table Headers & Rows
    const tableHeaders: string[] = [xAxisTitle];
    if (groupByDimension) {
      tableHeaders.push(...activeSeriesKeys);
    } else {
      tableHeaders.push(yAxisTitle);
      if (comparisonMode === 'growth_rate') tableHeaders.push('Growth (%)');
      if (comparisonMode === 'cumulative') tableHeaders.push('Cumulative');
      if (comparisonMode === 'moving_average') tableHeaders.push(`${maWindow}-Period MA`);
      tableHeaders.push('Records');
    }

    const tableRows: (string | number)[][] = dataPoints.map(dp => {
      const row: (string | number)[] = [dp.periodLabel];
      if (groupByDimension) {
        for (const dim of activeSeriesKeys) {
          row.push(dp[dim] !== undefined ? dp[dim] : 0);
        }
      } else {
        row.push(dp.value);
        if (comparisonMode === 'growth_rate') row.push(dp.growthPct !== undefined ? `${dp.growthPct}%` : 'N/A');
        if (comparisonMode === 'cumulative') row.push(dp.cumulativeValue ?? dp.value);
        if (comparisonMode === 'moving_average') row.push(dp.movingAverage !== undefined ? dp.movingAverage : 'N/A');
        row.push(dp.count);
      }
      return row;
    });

    return {
      config,
      resolvedGranularity,
      dataPoints,
      seriesKeys: activeSeriesKeys,
      title,
      description,
      xAxisTitle,
      yAxisTitle,
      unit,
      summaryStats: {
        totalRecords: filteredRecords.length,
        periodCount: dataPoints.length,
        totalValue: totalVal,
        avgPerPeriod: dataPoints.length > 0 ? Math.round((totalVal / dataPoints.length) * 100) / 100 : 0,
        peakPeriod,
        troughPeriod,
        overallGrowthPct,
        missingPeriodCount: 0
      },
      tableHeaders,
      tableRows
    };
  }

  // --- Calendar-Aware Period Formatting ---
  private static getPeriodInfo(
    date: Date,
    granularity: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  ): { periodKey: string; periodLabel: string; startTimestamp: number } {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11
    const day = date.getDate();

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    switch (granularity) {
      case 'daily': {
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        const key = `${year}-${mm}-${dd}`;
        const label = `${monthNames[month]} ${day}, ${year}`;
        const start = new Date(year, month, day).getTime();
        return { periodKey: key, periodLabel: label, startTimestamp: start };
      }
      case 'weekly': {
        // ISO Week calculation
        const weekNum = this.getWeekNumber(date);
        const key = `${year}-W${String(weekNum).padStart(2, '0')}`;
        const label = `W${weekNum} ${year}`;
        // Start of week (Monday)
        const d = new Date(date);
        const dayOfWeek = d.getDay();
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(d.setDate(diff));
        return { periodKey: key, periodLabel: label, startTimestamp: weekStart.getTime() };
      }
      case 'monthly': {
        const mm = String(month + 1).padStart(2, '0');
        const key = `${year}-${mm}`;
        const label = `${monthNames[month]} ${year}`;
        const start = new Date(year, month, 1).getTime();
        return { periodKey: key, periodLabel: label, startTimestamp: start };
      }
      case 'quarterly': {
        const q = Math.floor(month / 3) + 1;
        const key = `${year}-Q${q}`;
        const label = `Q${q} ${year}`;
        const start = new Date(year, (q - 1) * 3, 1).getTime();
        return { periodKey: key, periodLabel: label, startTimestamp: start };
      }
      case 'yearly': {
        const key = `${year}`;
        const label = `${year}`;
        const start = new Date(year, 0, 1).getTime();
        return { periodKey: key, periodLabel: label, startTimestamp: start };
      }
    }
  }

  private static getWeekNumber(d: Date): number {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  }

  // --- Date Range Filter ---
  private static filterByDateRange(
    records: { date: Date; timestamp: number; metric: number; dimVal?: string; raw: Record<string, any> }[],
    range: DateRangeConfig,
    latestDate: Date
  ) {
    if (range.preset === 'all_time') return records;

    const end = latestDate.getTime();
    let start = 0;

    switch (range.preset) {
      case 'last_7_days':
        start = end - 7 * 24 * 60 * 60 * 1000;
        break;
      case 'last_30_days':
        start = end - 30 * 24 * 60 * 60 * 1000;
        break;
      case 'last_90_days':
        start = end - 90 * 24 * 60 * 60 * 1000;
        break;
      case 'this_month': {
        const ym = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1);
        start = ym.getTime();
        break;
      }
      case 'last_month': {
        const lmStart = new Date(latestDate.getFullYear(), latestDate.getMonth() - 1, 1);
        const lmEnd = new Date(latestDate.getFullYear(), latestDate.getMonth(), 0, 23, 59, 59);
        return records.filter(r => r.timestamp >= lmStart.getTime() && r.timestamp <= lmEnd.getTime());
      }
      case 'this_quarter': {
        const q = Math.floor(latestDate.getMonth() / 3);
        const qStart = new Date(latestDate.getFullYear(), q * 3, 1);
        start = qStart.getTime();
        break;
      }
      case 'last_quarter': {
        let q = Math.floor(latestDate.getMonth() / 3) - 1;
        let y = latestDate.getFullYear();
        if (q < 0) { q = 3; y--; }
        const lqStart = new Date(y, q * 3, 1);
        const lqEnd = new Date(y, (q + 1) * 3, 0, 23, 59, 59);
        return records.filter(r => r.timestamp >= lqStart.getTime() && r.timestamp <= lqEnd.getTime());
      }
      case 'this_year': {
        const yStart = new Date(latestDate.getFullYear(), 0, 1);
        start = yStart.getTime();
        break;
      }
      case 'last_year': {
        const lyStart = new Date(latestDate.getFullYear() - 1, 0, 1);
        const lyEnd = new Date(latestDate.getFullYear() - 1, 11, 31, 23, 59, 59);
        return records.filter(r => r.timestamp >= lyStart.getTime() && r.timestamp <= lyEnd.getTime());
      }
      case 'custom': {
        const cStart = range.startDate ? new Date(range.startDate).getTime() : 0;
        const cEnd = range.endDate ? new Date(range.endDate).getTime() : Infinity;
        return records.filter(r => r.timestamp >= cStart && r.timestamp <= cEnd);
      }
    }

    return records.filter(r => r.timestamp >= start && r.timestamp <= end);
  }

  // --- Aggregate Computation ---
  private static computeAggregate(values: number[], agg: AggregationFunction): number {
    if (values.length === 0) return 0;

    switch (agg) {
      case 'sum':
        return Math.round(ss.sum(values) * 100) / 100;
      case 'avg':
        return Math.round(ss.mean(values) * 100) / 100;
      case 'median':
        return Math.round(ss.median(values) * 100) / 100;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      case 'count_distinct':
        return new Set(values).size;
      default:
        return Math.round(ss.sum(values) * 100) / 100;
    }
  }

  // --- Unit & Currency Detection ---
  private static detectUnit(metricName: string, values: number[]): {
    type: 'currency' | 'percentage' | 'count' | 'number';
    symbol?: string;
    prefix?: string;
    suffix?: string;
  } {
    const lower = metricName.toLowerCase();
    if (/revenue|sales|profit|cost|price|income|salary|spend|mrr|arr|gmv/i.test(lower)) {
      if (/inr|rupee|₹/i.test(lower)) return { type: 'currency', symbol: '₹', prefix: '₹' };
      if (/eur|euro|€/i.test(lower)) return { type: 'currency', symbol: '€', prefix: '€' };
      if (/gbp|pound|£/i.test(lower)) return { type: 'currency', symbol: '£', prefix: '£' };
      return { type: 'currency', symbol: '$', prefix: '$' };
    }
    if (/rate|percentage|pct|margin|ratio|growth|discount/i.test(lower)) {
      return { type: 'percentage', symbol: '%', suffix: '%' };
    }
    if (/count|orders|items|users|sessions|quantity|qty/i.test(lower)) {
      return { type: 'count' };
    }
    return { type: 'number' };
  }

  private static formatValue(val: number, unit: { type: string; prefix?: string; suffix?: string }): string {
    const prefix = unit.prefix || '';
    const suffix = unit.suffix || '';

    if (Math.abs(val) >= 1_000_000) {
      return `${prefix}${(val / 1_000_000).toFixed(2)}M${suffix}`;
    }
    if (Math.abs(val) >= 1_000) {
      return `${prefix}${(val / 1_000).toFixed(1)}k${suffix}`;
    }
    return `${prefix}${val.toLocaleString()}${suffix}`;
  }

  private static getDateRangeLabel(range: DateRangeConfig): string {
    switch (range.preset) {
      case 'last_7_days': return 'the last 7 days';
      case 'last_30_days': return 'the last 30 days';
      case 'last_90_days': return 'the last 90 days';
      case 'this_month': return 'this month';
      case 'last_month': return 'last month';
      case 'this_quarter': return 'this quarter';
      case 'last_quarter': return 'last quarter';
      case 'this_year': return 'this year';
      case 'last_year': return 'last year';
      case 'custom': return `period ${range.startDate || 'start'} to ${range.endDate || 'end'}`;
      case 'all_time':
      default:
        return 'all recorded historical time periods';
    }
  }

  private static parseDate(val: any): Date | null {
    if (val instanceof Date) return val;
    if (typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      const parsed = Date.parse(trimmed);
      if (!isNaN(parsed)) return new Date(parsed);

      // Handle DD/MM/YYYY or DD-MM-YYYY
      const parts = trimmed.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          if (!isNaN(d.getTime())) return d;
        }
      }
    }
    return null;
  }

  private static generateEmptyResult(
    config: TemporalAggregationConfig,
    reason: string
  ): TemporalAggregationResult {
    return {
      config,
      resolvedGranularity: config.granularity === 'auto' ? 'monthly' : config.granularity,
      dataPoints: [],
      seriesKeys: [config.metricColumn],
      title: `${config.metricColumn} Trend`,
      description: reason,
      xAxisTitle: 'Timeline',
      yAxisTitle: config.metricColumn,
      unit: { type: 'number' },
      summaryStats: {
        totalRecords: 0,
        periodCount: 0,
        totalValue: 0,
        avgPerPeriod: 0,
        peakPeriod: { label: 'N/A', value: 0 },
        troughPeriod: { label: 'N/A', value: 0 },
        overallGrowthPct: 0,
        missingPeriodCount: 0
      },
      tableHeaders: ['Period', config.metricColumn],
      tableRows: []
    };
  }
}
