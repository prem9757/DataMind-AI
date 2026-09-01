// ============================================================================
// PHASE 10: NATURAL LANGUAGE VISUALIZATION & GRANULARITY PARSER
// ============================================================================

import {
  TimeGranularity,
  DateRangePreset,
  AggregationFunction,
  ComparisonMode,
  TemporalAggregationConfig
} from '../types/temporal';
import { ChartType } from '../types/dataset';

export interface ParsedVizIntent {
  dateColumn?: string;
  metricColumn?: string;
  dimensionColumn?: string;
  aggregation?: AggregationFunction;
  granularity?: TimeGranularity;
  dateRangePreset?: DateRangePreset;
  comparisonMode?: ComparisonMode;
  movingAverageWindow?: number;
  chartType?: ChartType;
  topN?: number;
  isFollowUpTransformation?: boolean;
}

export class NaturalLanguageVizParser {
  /**
   * Parses natural language questions into structured visualization parameters.
   */
  public static parseQuery(
    query: string,
    columns: string[],
    profiles: Record<string, any>,
    currentConfig?: TemporalAggregationConfig
  ): ParsedVizIntent {
    const q = query.toLowerCase().trim();
    const result: ParsedVizIntent = {};

    // 1. Detect Follow-up Transformations (e.g. "now show it monthly", "switch to weekly", "compare quarterly")
    const isFollowUp = !!currentConfig && (
      q.startsWith('now ') ||
      q.startsWith('switch to ') ||
      q.startsWith('change to ') ||
      q.startsWith('make it ') ||
      q.startsWith('show it ') ||
      q.includes('instead') ||
      q.includes('also show') ||
      q.includes('add moving average') ||
      q.includes('growth rate')
    );

    if (isFollowUp) {
      result.isFollowUpTransformation = true;
      result.dateColumn = currentConfig.dateColumn;
      result.metricColumn = currentConfig.metricColumn;
      result.dimensionColumn = currentConfig.groupByDimension;
      result.aggregation = currentConfig.aggregation;
      result.granularity = currentConfig.granularity;
      result.dateRangePreset = currentConfig.dateRange?.preset;
      result.comparisonMode = currentConfig.comparisonMode;
      result.chartType = currentConfig.chartType;
    }

    // 2. Parse Time Granularity
    if (/\b(daily|by day|day by day|per day)\b/i.test(q)) {
      result.granularity = 'daily';
    } else if (/\b(weekly|by week|week by week|per week)\b/i.test(q)) {
      result.granularity = 'weekly';
    } else if (/\b(monthly|by month|month by month|per month|month-by-month)\b/i.test(q)) {
      result.granularity = 'monthly';
    } else if (/\b(quarterly|by quarter|quarter by quarter|per quarter|quarter-by-quarter)\b/i.test(q)) {
      result.granularity = 'quarterly';
    } else if (/\b(yearly|annually|by year|year by year|per year|annual)\b/i.test(q)) {
      result.granularity = 'yearly';
    }

    // 3. Parse Aggregations
    if (/\b(average|avg|mean)\b/i.test(q)) {
      result.aggregation = 'avg';
    } else if (/\b(median)\b/i.test(q)) {
      result.aggregation = 'median';
    } else if (/\b(count|number of|how many|volume of orders)\b/i.test(q)) {
      result.aggregation = 'count';
    } else if (/\b(unique count|distinct count|distinct)\b/i.test(q)) {
      result.aggregation = 'count_distinct';
    } else if (/\b(min|minimum|lowest)\b/i.test(q)) {
      result.aggregation = 'min';
    } else if (/\b(max|maximum|peak|highest)\b/i.test(q)) {
      result.aggregation = 'max';
    } else if (/\b(sum|total|aggregate|revenue|sales)\b/i.test(q) && !result.aggregation) {
      result.aggregation = 'sum';
    }

    // 4. Parse Comparison Modes & Special Analytics
    if (/\b(growth|growth rate|percent change|pct change|mom|yoy|qoq|change)\b/i.test(q)) {
      result.comparisonMode = 'growth_rate';
      result.chartType = 'bar';
    } else if (/\b(cumulative|running total|cumulative sum|accumulated)\b/i.test(q)) {
      result.comparisonMode = 'cumulative';
      result.chartType = 'area';
    } else if (/\b(moving average|rolling average|rolling mean|smoothed)\b/i.test(q)) {
      result.comparisonMode = 'moving_average';
      result.chartType = 'line';

      const matchWin = q.match(/(\d+)[- ]?(day|month|period|week)? moving average/i);
      if (matchWin && matchWin[1]) {
        result.movingAverageWindow = parseInt(matchWin[1], 10);
      }
    }

    // 5. Parse Date Range Presets
    if (/\b(last 7 days|past 7 days|past week)\b/i.test(q)) {
      result.dateRangePreset = 'last_7_days';
    } else if (/\b(last 30 days|past 30 days|past month)\b/i.test(q)) {
      result.dateRangePreset = 'last_30_days';
    } else if (/\b(last 90 days|past 90 days|past quarter)\b/i.test(q)) {
      result.dateRangePreset = 'last_90_days';
    } else if (/\b(this year|ytd|year to date)\b/i.test(q)) {
      result.dateRangePreset = 'this_year';
    } else if (/\b(last year|previous year)\b/i.test(q)) {
      result.dateRangePreset = 'last_year';
    }

    // 6. Match Metric Column
    const numCols = columns.filter(c => {
      const p = profiles[c];
      return p && (p.type === 'numeric' || p.type === 'integer' || p.type === 'float');
    });

    for (const col of numCols) {
      const cleanCol = col.toLowerCase().replace(/_/g, ' ');
      if (q.includes(cleanCol) || q.includes(col.toLowerCase())) {
        result.metricColumn = col;
        break;
      }
    }

    // Fallback metric matching if not explicit
    if (!result.metricColumn && !isFollowUp) {
      if (/\b(sales|revenue|income|mrr)\b/i.test(q)) {
        result.metricColumn = numCols.find(c => /sales|revenue|income|mrr/i.test(c)) || numCols[0];
      } else if (/\b(profit|margin|earnings)\b/i.test(q)) {
        result.metricColumn = numCols.find(c => /profit|margin/i.test(c)) || numCols[0];
      } else if (/\b(order|orders|quantity|units|count)\b/i.test(q)) {
        result.metricColumn = numCols.find(c => /quantity|units|count|order/i.test(c)) || numCols[0];
      } else {
        result.metricColumn = numCols[0];
      }
    }

    // 7. Match Date Column
    const dateCols = columns.filter(c => {
      const p = profiles[c];
      return p && (p.type === 'datetime' || p.type === 'date' || /date|time|timestamp|day|month|year|created/i.test(c));
    });

    for (const col of dateCols) {
      const cleanCol = col.toLowerCase().replace(/_/g, ' ');
      if (q.includes(cleanCol) || q.includes(col.toLowerCase())) {
        result.dateColumn = col;
        break;
      }
    }

    if (!result.dateColumn && dateCols.length > 0 && !isFollowUp) {
      result.dateColumn = dateCols[0];
    }

    // 8. Match Dimension (by Category, by Region, by Segment)
    const catCols = columns.filter(c => {
      const p = profiles[c];
      return p && (p.type === 'categorical' || p.type === 'text' || p.type === 'boolean');
    });

    for (const col of catCols) {
      const cleanCol = col.toLowerCase().replace(/_/g, ' ');
      const matchPattern = new RegExp(`\\b(by|across|per|for each)\\s+${cleanCol}\\b`, 'i');
      if (matchPattern.test(q) || q.includes(`by ${cleanCol}`) || q.includes(`by ${col.toLowerCase()}`)) {
        result.dimensionColumn = col;
        break;
      }
    }

    // 9. Top N Matching
    const topNMatch = q.match(/\btop\s+(\d+)\b/i);
    if (topNMatch && topNMatch[1]) {
      result.topN = parseInt(topNMatch[1], 10);
    }

    return result;
  }
}
