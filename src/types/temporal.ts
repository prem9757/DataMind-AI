// ============================================================================
// PHASE 10: TEMPORAL AGGREGATION & VISUALIZATION TYPES
// ============================================================================

import { ChartType } from './dataset';

export type TimeGranularity = 'auto' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type DateRangePreset =
  | 'all_time'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year'
  | 'custom';

export type AggregationFunction =
  | 'sum'
  | 'avg'
  | 'median'
  | 'count'
  | 'count_distinct'
  | 'min'
  | 'max';

export type ComparisonMode =
  | 'none'
  | 'growth_rate'
  | 'cumulative'
  | 'moving_average'
  | 'previous_period'
  | 'previous_year';

export interface DateRangeConfig {
  preset: DateRangePreset;
  startDate?: string;
  endDate?: string;
}

export interface TemporalAggregationConfig {
  dateColumn: string;
  metricColumn: string;
  aggregation: AggregationFunction;
  granularity: TimeGranularity;
  dateRange: DateRangeConfig;
  groupByDimension?: string;
  topN?: number;
  chartType: ChartType;
  comparisonMode?: ComparisonMode;
  movingAverageWindow?: number;
  showMissingPeriods?: boolean;
}

export interface TemporalDataPoint {
  periodKey: string;     // e.g. "2026-01" or "2026-Q1"
  periodLabel: string;   // e.g. "Jan 2026" or "Q1 2026"
  timestamp: number;     // start timestamp for sorting
  value: number;         // aggregated metric value
  formattedValue: string; // e.g. "$125.4K"
  count: number;         // record count
  growthPct?: number;    // % change from previous period
  cumulativeValue?: number; // running sum
  movingAverage?: number; // rolling mean
  isMissingPeriod?: boolean; // gap notice flag
  [key: string]: any;    // dynamic grouped series values
}

export interface TemporalAggregationResult {
  config: TemporalAggregationConfig;
  resolvedGranularity: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  dataPoints: TemporalDataPoint[];
  seriesKeys: string[];
  title: string;
  subtitle?: string;
  description: string;
  xAxisTitle: string;
  yAxisTitle: string;
  unit: {
    type: 'currency' | 'percentage' | 'count' | 'number';
    symbol?: string;
    prefix?: string;
    suffix?: string;
  };
  summaryStats: {
    totalRecords: number;
    periodCount: number;
    totalValue: number;
    avgPerPeriod: number;
    peakPeriod: { label: string; value: number };
    troughPeriod: { label: string; value: number };
    overallGrowthPct: number;
    missingPeriodCount: number;
  };
  tableHeaders: string[];
  tableRows: (string | number)[][];
}
