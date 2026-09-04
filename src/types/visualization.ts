// ============================================================================
// PHASE 9: POWER BI-INSPIRED CUSTOM VISUALIZATION & CUSTOM DASHBOARD TYPES
// ============================================================================

import { ChartType } from './dataset';
import {
  TimeGranularity,
  DateRangePreset,
  DateRangeConfig,
  AggregationFunction,
  ComparisonMode
} from './temporal';

export type ExtendedChartType =
  | 'bar'
  | 'horizontal_bar'
  | 'line'
  | 'area'
  | 'step_line'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'bubble'
  | 'histogram'
  | 'box'
  | 'radar'
  | 'polar_area'
  | 'waterfall'
  | 'funnel'
  | 'treemap'
  | 'heatmap'
  | 'composed'
  | 'gauge'
  | 'radial_bar';

export interface VisualizationFilter {
  id: string;
  column: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in';
  value: any;
}

export interface VisualizationFieldConfig {
  xAxisColumn: string;
  yAxisColumn: string;
  secondaryColumn?: string; // Group by / Legend / Color By
  aggregation: AggregationFunction | 'sum' | 'mean' | 'avg' | 'median' | 'count' | 'count_distinct' | 'min' | 'max';
  timeGranularity?: TimeGranularity;
  dateRange?: DateRangeConfig;
  groupByDimension?: string;
  topN?: number; // 0 for all
  sortBy?: 'asc' | 'desc' | 'none';
  comparisonMode?: ComparisonMode;
  movingAverageWindow?: number;
  referenceLine?: 'none' | 'mean' | 'median' | 'constant';
  referenceConstantValue?: number;
  filters?: VisualizationFilter[];
}

export interface SavedVisualization {
  id: string;
  name: string;
  customTitle?: string;
  datasetId: string;
  datasetName: string;
  datasetVersion: string | number;
  chartType: ExtendedChartType;
  config: VisualizationFieldConfig;
  computedTitle: string;
  computedXAxisTitle: string;
  computedYAxisTitle: string;
  description?: string;
  createdAt: number;
  lastModified: number;
  tags?: string[];
}

export type DashboardCardWidth = 'small' | 'medium' | 'large' | 'full' | 'third' | 'half';
export type DashboardCardHeight = 'normal' | 'tall';
export type DashboardTheme = 'default' | 'dark' | 'slate' | 'executive';

export interface DashboardKPICard {
  id: string;
  title: string;
  column: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct';
  format?: 'currency' | 'number' | 'percent';
  comparisonLabel?: string;
}

export interface DashboardActiveFilter {
  id: string;
  column: string;
  type: 'categorical' | 'date';
  value: string; // 'ALL' or specific value
}

export interface CustomDashboardItem {
  id: string;
  visualizationId: string;
  width: DashboardCardWidth;
  height?: DashboardCardHeight;
  order: number;
}

export interface CustomDashboard {
  id: string;
  name: string;
  description?: string;
  datasetId: string;
  datasetName: string;
  datasetVersion?: string | number;
  items: CustomDashboardItem[];
  kpis?: DashboardKPICard[];
  theme?: DashboardTheme;
  activeFilters?: DashboardActiveFilter[];
  createdAt: number;
  lastModified: number;
  globalFilters?: {
    datePreset?: DateRangePreset;
    categoryColumn?: string;
    categoryValue?: string;
  };
}

export interface StructuredDashboardInsight {
  id: string;
  type: 'trend' | 'comparison' | 'outlier' | 'contribution' | 'change' | 'correlation';
  title: string;
  evidence: string;
  confidence?: number;
  details?: {
    metric: string;
    calculation: string;
    comparisonPeriod?: string;
    filtersApplied?: string[];
    sourceVizTitle?: string;
  };
  actionableRecommendation?: {
    type: 'agent' | 'statistics' | 'ml' | 'eda';
    label: string;
    targetSection: 'investigations' | 'statistics' | 'ml' | 'eda' | 'ai_analyst';
    promptOrGoal: string;
  };
}

export interface VisualizationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  chartType: ExtendedChartType;
  fieldMatcher: (columns: string[], profiles: Record<string, any>) => Partial<VisualizationFieldConfig> | null;
}

