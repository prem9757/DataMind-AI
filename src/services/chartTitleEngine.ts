// ============================================================================
// PHASE 10: DYNAMIC CHART TITLING & METADATA ENGINE
// ============================================================================

import {
  TimeGranularity,
  AggregationFunction,
  ComparisonMode
} from '../types/temporal';
import { ChartType } from '../types/dataset';

export interface ChartNamingContext {
  isTemporal: boolean;
  dateColumn?: string;
  metricColumn: string;
  dimensionColumn?: string;
  aggregation?: AggregationFunction;
  granularity?: TimeGranularity | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  chartType?: ChartType;
  comparisonMode?: ComparisonMode;
  movingAverageWindow?: number;
  dateRangeLabel?: string;
  topN?: number;
  filterContext?: string;
  unitSymbol?: string;
  unitType?: 'currency' | 'percentage' | 'count' | 'number';
}

export class ChartTitleEngine {
  /**
   * Generates a precise, executive-grade chart title adhering to Phase 10 rules.
   */
  public static generateTitle(ctx: ChartNamingContext): string {
    const metricName = this.formatColumnName(ctx.metricColumn);
    const dimName = ctx.dimensionColumn ? this.formatColumnName(ctx.dimensionColumn) : undefined;
    const aggPrefix = this.getAggregationPrefix(ctx.aggregation);
    const granPrefix = this.getGranularityPrefix(ctx.granularity);

    // 1. Specialized Comparison Modes
    if (ctx.comparisonMode === 'growth_rate') {
      if (ctx.granularity && ctx.granularity !== 'auto') {
        const granWord = this.capitalize(ctx.granularity.replace('ly', ''));
        return `${granWord}-over-${granWord} ${metricName} Growth Rate (%)`;
      }
      return `${granPrefix ? granPrefix + ' ' : ''}${metricName} Growth Rate (%)`;
    }

    if (ctx.comparisonMode === 'cumulative') {
      return `Cumulative ${granPrefix ? granPrefix + ' ' : ''}${metricName}`;
    }

    if (ctx.comparisonMode === 'moving_average') {
      const window = ctx.movingAverageWindow || 3;
      const unit = ctx.granularity === 'daily' ? 'Day' : ctx.granularity === 'monthly' ? 'Month' : 'Period';
      return `${window}-${unit} Moving Average of ${metricName}`;
    }

    // 2. Temporal Charts
    if (ctx.isTemporal) {
      if (dimName) {
        return `${granPrefix} ${aggPrefix ? aggPrefix + ' ' : ''}${metricName} by ${dimName}`;
      }
      return `${granPrefix} ${aggPrefix ? aggPrefix + ' ' : ''}${metricName} Trend`;
    }

    // 3. Non-Temporal Visualizations
    if (ctx.chartType === 'scatter') {
      return `${metricName} vs ${dimName || 'Metric'}`;
    }

    if (ctx.chartType === 'histogram') {
      return `Distribution of ${metricName}`;
    }

    if (ctx.chartType === 'pie' || ctx.chartType === 'donut') {
      return `${metricName} Share by ${dimName || 'Category'}`;
    }

    if (ctx.topN && ctx.topN > 0 && dimName) {
      return `Top ${ctx.topN} ${dimName}s by ${metricName}`;
    }

    if (dimName) {
      return `${aggPrefix ? aggPrefix + ' ' : ''}${metricName} by ${dimName}`;
    }

    return `${metricName} Analysis`;
  }

  /**
   * Generates a descriptive subtitle/caption detailing time range and grouping.
   */
  public static generateDescription(ctx: ChartNamingContext): string {
    const metricName = this.formatColumnName(ctx.metricColumn);
    const dimName = ctx.dimensionColumn ? this.formatColumnName(ctx.dimensionColumn) : undefined;
    const aggWord = this.getAggregationWord(ctx.aggregation);
    const granWord = ctx.granularity && ctx.granularity !== 'auto'
      ? ctx.granularity.replace('ly', '')
      : 'calendar period';

    let desc = '';

    if (ctx.isTemporal) {
      if (ctx.comparisonMode === 'growth_rate') {
        desc = `Percentage growth rate of ${metricName} calculated period-over-period across ${granWord} intervals.`;
      } else if (ctx.comparisonMode === 'cumulative') {
        desc = `Running cumulative total of ${metricName} aggregated by ${granWord}.`;
      } else if (ctx.comparisonMode === 'moving_average') {
        const window = ctx.movingAverageWindow || 3;
        desc = `Rolling ${window}-period smoothed moving average for ${metricName} to identify underlying structural momentum.`;
      } else {
        desc = `${aggWord} ${metricName} aggregated chronologically by ${granWord}.`;
      }

      if (dimName) {
        desc += ` Segmented across primary dimensions of ${dimName}${ctx.topN ? ` (Top ${ctx.topN})` : ''}.`;
      }

      if (ctx.dateRangeLabel) {
        desc += ` Filtered for ${ctx.dateRangeLabel}.`;
      }
    } else {
      if (dimName) {
        desc = `${aggWord} ${metricName} categorized across distinct ${dimName} segments.`;
      } else {
        desc = `Empirical summary and distribution analysis of ${metricName}.`;
      }
    }

    if (ctx.filterContext) {
      desc += ` Context: ${ctx.filterContext}.`;
    }

    return desc;
  }

  /**
   * Generates precise X-Axis header title.
   */
  public static generateXAxisTitle(ctx: ChartNamingContext): string {
    if (ctx.isTemporal) {
      switch (ctx.granularity) {
        case 'daily': return 'Date';
        case 'weekly': return 'Calendar Week';
        case 'monthly': return 'Month';
        case 'quarterly': return 'Quarter';
        case 'yearly': return 'Year';
        default: return 'Timeline';
      }
    }
    return ctx.dimensionColumn ? this.formatColumnName(ctx.dimensionColumn) : 'Category';
  }

  /**
   * Generates accurate Y-Axis header title.
   */
  public static generateYAxisTitle(ctx: ChartNamingContext): string {
    const metricName = this.formatColumnName(ctx.metricColumn);
    const unitSuffix = ctx.unitSymbol ? ` (${ctx.unitSymbol})` : '';

    if (ctx.comparisonMode === 'growth_rate') {
      return 'Growth Rate (%)';
    }

    if (ctx.comparisonMode === 'cumulative') {
      return `Cumulative ${metricName}${unitSuffix}`;
    }

    switch (ctx.aggregation) {
      case 'avg': return `Average ${metricName}${unitSuffix}`;
      case 'count': return `Count of ${metricName}`;
      case 'count_distinct': return `Unique ${metricName} Count`;
      case 'median': return `Median ${metricName}${unitSuffix}`;
      case 'min': return `Minimum ${metricName}${unitSuffix}`;
      case 'max': return `Maximum ${metricName}${unitSuffix}`;
      case 'sum':
      default:
        return `${metricName}${unitSuffix}`;
    }
  }

  /**
   * Validates title against banned generic names.
   */
  public static validateTitle(title: string, ctx: ChartNamingContext): string {
    const banned = [
      /^chart$/i,
      /^visualization$/i,
      /^data analysis$/i,
      /^sales chart$/i,
      /^time series$/i,
      /^graph$/i,
      /^plot$/i
    ];

    if (!title || banned.some(b => b.test(title.trim()))) {
      return this.generateTitle(ctx);
    }
    return title;
  }

  // --- Helper Methods ---
  private static formatColumnName(col: string): string {
    if (!col) return 'Metric';
    return col
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
      .trim();
  }

  private static getAggregationPrefix(agg?: AggregationFunction): string {
    switch (agg) {
      case 'avg': return 'Average';
      case 'median': return 'Median';
      case 'count': return 'Count of';
      case 'count_distinct': return 'Unique Count of';
      case 'min': return 'Minimum';
      case 'max': return 'Peak';
      case 'sum':
      default:
        return '';
    }
  }

  private static getAggregationWord(agg?: AggregationFunction): string {
    switch (agg) {
      case 'avg': return 'Average';
      case 'median': return 'Median';
      case 'count': return 'Total count of';
      case 'count_distinct': return 'Count of distinct';
      case 'min': return 'Minimum recorded';
      case 'max': return 'Maximum recorded';
      case 'sum':
      default:
        return 'Total';
    }
  }

  private static getGranularityPrefix(gran?: TimeGranularity | string): string {
    switch (gran) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      case 'yearly': return 'Yearly';
      case 'auto':
      default:
        return 'Temporal';
    }
  }

  private static capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
