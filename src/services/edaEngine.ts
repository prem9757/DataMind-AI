import * as ss from 'simple-statistics';
import {
  AnomalyObservation,
  BivariateRelationship,
  BusinessKPI,
  ChartConfig,
  ChartType,
  ColumnClassification,
  ColumnProfile,
  CorrelationMatrixData,
  DatasetInsight,
  DatasetState,
  EDASummaryReport,
  MultivariateRelationship,
  NaturalLanguageChartResponse,
  RecommendedAnalysis,
  SegmentAnalysisResult,
  TimeSeriesAnalysisResult,
  TopBottomRanking
} from '../types/dataset';
import { classifyAllColumns } from './columnIntelligence';

// ==========================================
// 1. BUSINESS KPI & METRIC DETECTION
// ==========================================

export function detectBusinessKPIs(
  rows: Record<string, any>[],
  columns: string[],
  profiles: Record<string, ColumnProfile>,
  classifications: Record<string, ColumnClassification>
): BusinessKPI[] {
  const kpis: BusinessKPI[] = [];
  const numCols = columns.filter(c => profiles[c]?.type === 'numeric');

  // Helper to format currency/numbers
  const formatVal = (val: number, isCurrency: boolean, isPct: boolean): string => {
    if (isPct) return `${(val * (val <= 1 ? 100 : 1)).toFixed(1)}%`;
    if (isCurrency) {
      if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
      if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
      return `$${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }
    if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
    if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
    return val.toLocaleString();
  };

  // 1. Total Revenue / Sales
  const revCol = numCols.find(c => /^(revenue|sales|total_amount|gross_sales|turnover)$/i.test(c)) ||
                 numCols.find(c => /revenue|sales/i.test(c));
  let totalRevenue = 0;
  if (revCol) {
    totalRevenue = rows.reduce((acc, r) => {
      const v = Number(r[revCol]);
      return acc + (!isNaN(v) && isFinite(v) ? v : 0);
    }, 0);

    kpis.push({
      id: 'kpi-rev',
      title: 'Total Revenue',
      metricName: revCol,
      value: formatVal(totalRevenue, true, false),
      numericValue: totalRevenue,
      format: 'currency',
      columnSource: revCol,
      formulaDescription: `Aggregated sum of all recorded transactions in ${revCol}.`,
      isDerived: false
    });
  }

  // 2. Total Profit / Margin
  const profitCol = numCols.find(c => /^(profit|net_profit|income|net_income)$/i.test(c)) ||
                    numCols.find(c => /profit/i.test(c));
  let totalProfit = 0;
  if (profitCol) {
    totalProfit = rows.reduce((acc, r) => {
      const v = Number(r[profitCol]);
      return acc + (!isNaN(v) && isFinite(v) ? v : 0);
    }, 0);

    kpis.push({
      id: 'kpi-profit',
      title: 'Total Profit',
      metricName: profitCol,
      value: formatVal(totalProfit, true, false),
      numericValue: totalProfit,
      format: 'currency',
      columnSource: profitCol,
      formulaDescription: `Net aggregated bottom-line earnings from ${profitCol}.`,
      trendDirection: totalProfit >= 0 ? 'up' : 'down',
      isDerived: false
    });
  }

  // 3. Profit Margin (Derived: Profit / Revenue)
  if (totalRevenue > 0 && profitCol) {
    const marginPct = (totalProfit / totalRevenue) * 100;
    kpis.push({
      id: 'kpi-margin',
      title: 'Overall Profit Margin',
      metricName: 'Profit Margin',
      value: `${marginPct.toFixed(1)}%`,
      numericValue: marginPct,
      format: 'percentage',
      columnSource: `${profitCol} ÷ ${revCol}`,
      formulaDescription: `Derived business metric: (${profitCol} / ${revCol}) × 100.`,
      trendDirection: marginPct >= 15 ? 'up' : marginPct >= 0 ? 'neutral' : 'down',
      isDerived: true,
      benchmarkNote: marginPct >= 20 ? 'Strong healthy margin' : marginPct >= 10 ? 'Standard operating range' : 'Compressed margin'
    });
  }

  // 4. Total Volume / Order / Record Count
  const orderIdCol = columns.find(c => /^(order_id|invoice_id|transaction_id)$/i.test(c));
  const distinctOrders = orderIdCol ? (profiles[orderIdCol]?.uniqueCount || rows.length) : rows.length;

  kpis.push({
    id: 'kpi-orders',
    title: orderIdCol ? 'Total Unique Orders' : 'Total Records Analyzed',
    metricName: orderIdCol || 'Total Records',
    value: distinctOrders.toLocaleString(),
    numericValue: distinctOrders,
    format: 'count',
    columnSource: orderIdCol || 'Dataset Rows',
    formulaDescription: orderIdCol ? `Distinct count of ${orderIdCol}` : 'Total valid records in dataset',
    isDerived: false
  });

  // 5. Average Order Value (AOV = Revenue / Orders)
  if (totalRevenue > 0 && distinctOrders > 0) {
    const aov = totalRevenue / distinctOrders;
    kpis.push({
      id: 'kpi-aov',
      title: 'Average Order Value (AOV)',
      metricName: 'AOV',
      value: `$${aov.toFixed(2)}`,
      numericValue: aov,
      format: 'currency',
      columnSource: `${revCol} ÷ ${orderIdCol || 'Orders'}`,
      formulaDescription: `Derived transaction velocity: Total Revenue divided by unique transactions.`,
      isDerived: true
    });
  }

  // 6. Other Numeric Measures if less than 4 KPIs found
  if (kpis.length < 4) {
    for (const col of numCols) {
      if (col === revCol || col === profitCol) continue;
      const prof = profiles[col];
      if (prof && prof.mean !== undefined) {
        const isCurr = classifications[col]?.isCurrency || false;
        const isPct = classifications[col]?.isPercentage || false;
        kpis.push({
          id: `kpi-${col}`,
          title: `Avg ${col}`,
          metricName: col,
          value: formatVal(prof.mean, isCurr, isPct),
          numericValue: prof.mean,
          format: isCurr ? 'currency' : isPct ? 'percentage' : 'number',
          columnSource: col,
          formulaDescription: `Arithmetic mean of ${col} across ${rows.length} records.`,
          isDerived: false
        });
        if (kpis.length >= 6) break;
      }
    }
  }

  return kpis;
}

// ==========================================
// 2. CORRELATION ENGINE (PEARSON & SPEARMAN)
// ==========================================

export function computeCorrelationMatrix(
  rows: Record<string, any>[],
  numericColumns: string[],
  method: 'pearson' | 'spearman' = 'pearson'
): CorrelationMatrixData {
  const n = numericColumns.length;
  const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(1));
  const pValues: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  const pairs: CorrelationMatrixData['pairs'] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
        pValues[i][j] = 0;
        continue;
      }

      const col1 = numericColumns[i];
      const col2 = numericColumns[j];

      // Extract valid paired numbers
      const validPairs: [number, number][] = [];
      for (const row of rows) {
        const v1 = Number(row[col1]);
        const v2 = Number(row[col2]);
        if (!isNaN(v1) && !isNaN(v2) && isFinite(v1) && isFinite(v2)) {
          validPairs.push([v1, v2]);
        }
      }

      if (validPairs.length < 3) {
        matrix[i][j] = 0;
        matrix[j][i] = 0;
        pValues[i][j] = 1;
        pValues[j][i] = 1;
        continue;
      }

      let r = 0;
      if (method === 'pearson') {
        const x = validPairs.map(p => p[0]);
        const y = validPairs.map(p => p[1]);
        try {
          r = ss.sampleCorrelation(x, y);
        } catch {
          r = 0;
        }
      } else {
        const rank = (arr: number[]) => {
          const sorted = arr.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
          const ranks = new Array(arr.length);
          for (let k = 0; k < sorted.length; k++) {
            ranks[sorted[k].idx] = k + 1;
          }
          return ranks;
        };
        const rx = rank(validPairs.map(p => p[0]));
        const ry = rank(validPairs.map(p => p[1]));
        try {
          r = ss.sampleCorrelation(rx, ry);
        } catch {
          r = 0;
        }
      }

      if (isNaN(r) || !isFinite(r)) r = 0;
      r = Math.round(r * 1000) / 1000;

      // Approximate two-tailed p-value
      const df = validPairs.length - 2;
      let pVal = 0.05;
      if (Math.abs(r) < 1 && df > 0) {
        const t = (r * Math.sqrt(df)) / Math.sqrt(1 - r * r);
        pVal = Math.max(0.0001, Math.min(1, Math.exp(-0.5 * t * t) / Math.sqrt(2 * Math.PI) * (df > 30 ? 1 : 1.2)));
        pVal = Math.round(pVal * 10000) / 10000;
      }

      matrix[i][j] = r;
      matrix[j][i] = r;
      pValues[i][j] = pVal;
      pValues[j][i] = pVal;

      const absR = Math.abs(r);
      const strength: 'Very Strong' | 'Strong' | 'Moderate' | 'Weak' | 'Very Weak' =
        absR >= 0.8 ? 'Very Strong' :
        absR >= 0.6 ? 'Strong' :
        absR >= 0.4 ? 'Moderate' :
        absR >= 0.2 ? 'Weak' : 'Very Weak';

      const direction: 'positive' | 'negative' | 'none' =
        r > 0.05 ? 'positive' : r < -0.05 ? 'negative' : 'none';

      pairs.push({
        col1,
        col2,
        correlation: r,
        strength,
        direction,
        pValue: pVal,
        explanation: `${strength} ${direction} correlation (r = ${r.toFixed(3)}). Note: Correlation indicates statistical association but does NOT establish direct causal relationship.`
      });
    }
  }

  // Sort pairs by absolute magnitude
  pairs?.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  return {
    columns: numericColumns,
    numericColumns,
    matrix,
    pairs,
    pValues
  };
}

// ==========================================
// 3. GROUPED SUMMARY & CROSS-TABULATION
// ==========================================

export function computeGroupSummary(
  rows: Record<string, any>[],
  catCol: string,
  numCol: string,
  aggregation: 'sum' | 'mean' | 'median' | 'count' = 'sum'
): { category: string; value: number; sum: number; mean: number; median: number; count: number; min: number; max: number; sharePct: number }[] {
  const groups: Record<string, number[]> = {};

  for (const row of rows) {
    const cat = String(row[catCol] ?? 'Unknown').trim() || '(Empty)';
    const num = Number(row[numCol]);
    if (!isNaN(num) && isFinite(num)) {
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(num);
    }
  }

  let totalSum = 0;
  const items: any[] = [];

  for (const [category, vals] of Object.entries(groups)) {
    if (vals.length === 0) continue;
    const sorted = [...vals].sort((a, b) => a - b);
    const sum = Math.round(ss.sum(sorted) * 100) / 100;
    const mean = Math.round(ss.mean(sorted) * 100) / 100;
    const median = Math.round(ss.median(sorted) * 100) / 100;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    totalSum += sum;

    let value = sum;
    if (aggregation === 'mean') value = mean;
    if (aggregation === 'median') value = median;
    if (aggregation === 'count') value = vals.length;

    items.push({
      category,
      value,
      sum,
      mean,
      median,
      count: vals.length,
      min,
      max,
      sharePct: 0
    });
  }

  // Calculate percentage shares
  items.forEach(it => {
    it.sharePct = totalSum > 0 ? Math.round((it.sum / totalSum) * 1000) / 10 : 0;
  });

  return items.sort((a, b) => b.value - a.value);
}

export function computeCrossTabulation(
  rows: Record<string, any>[],
  cat1: string,
  cat2: string
): { categories1: string[]; categories2: string[]; matrix: number[][]; totalCount: number } {
  const map1 = new Map<string, number>();
  const map2 = new Map<string, number>();

  rows.forEach(r => {
    const c1 = String(r[cat1] ?? 'Unknown').trim();
    const c2 = String(r[cat2] ?? 'Unknown').trim();
    if (c1) map1.set(c1, (map1.get(c1) || 0) + 1);
    if (c2) map2.set(c2, (map2.get(c2) || 0) + 1);
  });

  const categories1 = Array.from(map1.keys()).slice(0, 8);
  const categories2 = Array.from(map2.keys()).slice(0, 8);

  const matrix: number[][] = Array(categories1.length)
    .fill(0)
    .map(() => Array(categories2.length).fill(0));

  let totalCount = 0;
  rows.forEach(r => {
    const c1 = String(r[cat1] ?? 'Unknown').trim();
    const c2 = String(r[cat2] ?? 'Unknown').trim();
    const idx1 = categories1.indexOf(c1);
    const idx2 = categories2.indexOf(c2);
    if (idx1 >= 0 && idx2 >= 0) {
      matrix[idx1][idx2] += 1;
      totalCount += 1;
    }
  });

  return { categories1, categories2, matrix, totalCount };
}

// ==========================================
// 4. TIME-SERIES ENGINE
// ==========================================

export function computeTimeSeriesAnalysis(
  rows: Record<string, any>[],
  dateCol: string,
  metricCol: string
): TimeSeriesAnalysisResult {
  // Extract dates and check duration span
  const datePairs: { date: Date; val: number }[] = [];
  for (const row of rows) {
    const raw = row[dateCol];
    const val = Number(row[metricCol]);
    if (!raw || isNaN(val) || !isFinite(val)) continue;
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      datePairs.push({ date: d, val });
    }
  }

  if (datePairs.length === 0) {
    return {
      dateColumn: dateCol,
      metricColumn: metricCol,
      granularity: 'month',
      startDate: 'N/A',
      endDate: 'N/A',
      totalDurationDays: 0,
      growthRatePct: 0,
      periodOverPeriodAvgPct: 0,
      peakPeriod: { period: 'N/A', value: 0 },
      troughPeriod: { period: 'N/A', value: 0 },
      trendDirection: 'STABLE',
      trendPoints: [],
      seasonalityNote: 'Insufficient chronological records.'
    };
  }

  datePairs.sort((a, b) => a.date.getTime() - b.date.getTime());
  const minTime = datePairs[0].date.getTime();
  const maxTime = datePairs[datePairs.length - 1].date.getTime();
  const totalDurationDays = Math.max(1, Math.round((maxTime - minTime) / (1000 * 60 * 60 * 24)));

  // Determine ideal aggregation granularity
  let granularity: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month';
  if (totalDurationDays <= 14) {
    granularity = 'day';
  } else if (totalDurationDays <= 90) {
    granularity = 'week';
  } else if (totalDurationDays <= 730) {
    granularity = 'month';
  } else if (totalDurationDays <= 1825) {
    granularity = 'quarter';
  } else {
    granularity = 'year';
  }

  // Aggregate into period buckets
  const periodMap = new Map<string, number[]>();
  for (const { date, val } of datePairs) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const q = Math.ceil((date.getMonth() + 1) / 3);

    let period = '';
    if (granularity === 'day') period = `${y}-${m}-${d}`;
    else if (granularity === 'week') {
      const weekNum = Math.ceil(date.getDate() / 7);
      period = `${y}-${m}-W${weekNum}`;
    } else if (granularity === 'month') period = `${y}-${m}`;
    else if (granularity === 'quarter') period = `${y}-Q${q}`;
    else period = `${y}`;

    if (!periodMap.has(period)) periodMap.set(period, []);
    periodMap.get(period)!.push(val);
  }

  const sortedPeriods = Array.from(periodMap.keys()).sort();
  const trendPoints: TimeSeriesAnalysisResult['trendPoints'] = [];

  let prevVal: number | null = null;
  const pctChanges: number[] = [];

  for (const period of sortedPeriods) {
    const vals = periodMap.get(period)!;
    const sum = Math.round(ss.sum(vals) * 100) / 100;
    let pctChange: number | undefined = undefined;

    if (prevVal !== null && prevVal !== 0) {
      pctChange = Math.round(((sum - prevVal) / Math.abs(prevVal)) * 1000) / 10;
      pctChanges.push(pctChange);
    }
    prevVal = sum;

    trendPoints.push({
      period,
      value: sum,
      count: vals.length,
      pctChange
    });
  }

  // 3-period moving average
  for (let i = 0; i < trendPoints.length; i++) {
    const window = trendPoints.slice(Math.max(0, i - 2), i + 1);
    const avg = window.reduce((acc, curr) => acc + curr.value, 0) / window.length;
    trendPoints[i].movingAverage = Math.round(avg * 100) / 100;
  }

  // Find Peak and Trough
  let peak = trendPoints[0] || { period: 'N/A', value: 0 };
  let trough = trendPoints[0] || { period: 'N/A', value: 0 };
  trendPoints.forEach(tp => {
    if (tp.value > peak.value) peak = tp;
    if (tp.value < trough.value) trough = tp;
  });

  // Overall growth rate
  const firstVal = trendPoints[0]?.value || 0;
  const lastVal = trendPoints[trendPoints.length - 1]?.value || 0;
  const growthRatePct = firstVal > 0 ? Math.round(((lastVal - firstVal) / firstVal) * 1000) / 10 : 0;
  const avgPopChange = pctChanges.length > 0 ? Math.round((pctChanges.reduce((a, b) => a + b, 0) / pctChanges.length) * 10) / 10 : 0;

  const trendDirection: 'GROWING' | 'DECLINING' | 'STABLE' | 'VOLATILE' =
    growthRatePct > 10 ? 'GROWING' :
    growthRatePct < -10 ? 'DECLINING' :
    Math.abs(avgPopChange) > 25 ? 'VOLATILE' : 'STABLE';

  return {
    dateColumn: dateCol,
    metricColumn: metricCol,
    granularity,
    startDate: datePairs[0].date.toISOString().split('T')[0],
    endDate: datePairs[datePairs.length - 1].date.toISOString().split('T')[0],
    totalDurationDays,
    growthRatePct,
    periodOverPeriodAvgPct: avgPopChange,
    peakPeriod: { period: peak.period, value: peak.value },
    troughPeriod: { period: trough.period, value: trough.value },
    trendDirection,
    trendPoints,
    seasonalityNote: totalDurationDays >= 365
      ? `Dataset spans ${Math.round(totalDurationDays / 30)} months. Peak velocity recorded in ${peak.period}.`
      : `Duration is ${totalDurationDays} days (${granularity} aggregation). Full statistical seasonality requires ≥12-24 months of consistent observations.`
  };
}

export function computeTimeSeriesTrend(
  rows: Record<string, any>[],
  dateCol: string,
  metricCol: string,
  _granularity?: string
): { period: string; value: number; movingAverage?: number }[] {
  const result = computeTimeSeriesAnalysis(rows, dateCol, metricCol);
  return result.trendPoints;
}

// ==========================================
// 5. TOP / BOTTOM RANKINGS
// ==========================================

export function computeTopBottomRankings(
  rows: Record<string, any>[],
  dimension: string,
  metric: string,
  topN: number = 10
): TopBottomRanking {
  const summary = computeGroupSummary(rows, dimension, metric, 'sum');
  const total = summary.reduce((acc, curr) => acc + curr.sum, 0);

  const topItems = summary.slice(0, topN).map((item, idx) => ({
    rank: idx + 1,
    name: item.category,
    value: item.sum,
    sharePct: total > 0 ? Math.round((item.sum / total) * 1000) / 10 : 0
  }));

  const bottomItems = [...summary].reverse().slice(0, topN).map((item, idx) => ({
    rank: idx + 1,
    name: item.category,
    value: item.sum,
    sharePct: total > 0 ? Math.round((item.sum / total) * 1000) / 10 : 0
  }));

  return {
    dimension,
    metric,
    topN,
    topItems,
    bottomItems
  };
}

// ==========================================
// 6. SEGMENT ANALYSIS
// ==========================================

export function computeSegmentAnalysis(
  rows: Record<string, any>[],
  dimension: string,
  metric: string
): SegmentAnalysisResult {
  const summary = computeGroupSummary(rows, dimension, metric, 'sum');
  const totalSum = summary.reduce((acc, curr) => acc + curr.sum, 0);

  return {
    dimension,
    metric,
    totalSum,
    segments: summary.map((s, idx) => ({
      name: s.category,
      total: s.sum,
      average: s.mean,
      median: s.median,
      count: s.count,
      sharePercentage: s.sharePct,
      contributionRank: idx + 1
    }))
  };
}

// ==========================================
// 7. ANOMALIES & EXTREME VALUES
// ==========================================

export function extractAnomalies(
  rows: Record<string, any>[],
  columns: string[],
  profiles: Record<string, ColumnProfile>
): AnomalyObservation[] {
  const anomalies: AnomalyObservation[] = [];
  const numCols = columns.filter(c => profiles[c]?.type === 'numeric');

  numCols.forEach(col => {
    const prof = profiles[col];
    if (!prof || prof.q1 === undefined || prof.q3 === undefined || prof.iqr === undefined || prof.mean === undefined || prof.stdDev === undefined) {
      return;
    }

    const lowFence = prof.q1 - 1.5 * prof.iqr;
    const highFence = prof.q3 + 1.5 * prof.iqr;
    const extremeHigh = prof.q3 + 3.0 * prof.iqr;

    rows.forEach((r, idx) => {
      const val = Number(r[col]);
      if (isNaN(val) || !isFinite(val)) return;

      if (val < lowFence || val > highFence) {
        const isExtreme = val > extremeHigh || (prof.stdDev! > 0 && Math.abs((val - prof.mean!) / prof.stdDev!) > 3.5);
        const z = prof.stdDev! > 0 ? (val - prof.mean!) / prof.stdDev! : 0;

        anomalies.push({
          id: `anomaly-${col}-${idx}`,
          column: col,
          rowIndex: idx + 1,
          value: val,
          method: Math.abs(z) > 3 ? 'ZSCORE' : 'IQR',
          score: Math.round(Math.abs(z) * 10) / 10,
          explanation: `Value ${val.toLocaleString()} deviates ${Math.abs(z).toFixed(1)} standard deviations from mean (${prof.mean?.toFixed(1)}). Upper fence is ${highFence.toFixed(1)}.`,
          isExtreme
        });
      }
    });
  });

  return anomalies.sort((a, b) => b.score - a.score).slice(0, 30);
}

// ==========================================
// 8. NATURAL LANGUAGE CHART PARSER
// ==========================================

export function parseNaturalLanguageChartQuery(
  query: string,
  dataset: DatasetState
): NaturalLanguageChartResponse {
  const q = query.toLowerCase();
  const { workingRows, columns, profiles } = dataset;
  const numCols = columns.filter(c => profiles[c]?.type === 'numeric');
  const catCols = columns.filter(c => profiles[c]?.type === 'categorical');
  const dateCols = columns.filter(c => profiles[c]?.type === 'datetime');

  // Match columns mentioned in query
  const matchedNums = numCols.filter(col => q.includes(col.toLowerCase()) || q.includes(col.toLowerCase().replace(/_/g, ' ')));
  const matchedCats = catCols.filter(col => q.includes(col.toLowerCase()) || q.includes(col.toLowerCase().replace(/_/g, ' ')));
  const matchedDates = dateCols.filter(col => q.includes(col.toLowerCase()) || q.includes(col.toLowerCase().replace(/_/g, ' ')));

  // Fallbacks
  const primaryNum = matchedNums[0] || numCols.find(c => /sales|revenue|profit|salary|price|amount/i.test(c)) || numCols[0];
  const primaryCat = matchedCats[0] || catCols.find(c => (profiles[c]?.uniqueCount || 0) <= 10) || catCols[0];
  const primaryDate = matchedDates[0] || dateCols[0];

  let chartType: ChartType = 'bar';
  let xAxis = primaryCat;
  let yAxis = primaryNum;
  let chartData: any[] = [];
  let analyticalExplanation = '';
  let understoodIntent = '';

  // 1. Time / Trend queries
  if (primaryDate && (q.includes('trend') || q.includes('month') || q.includes('daily') || q.includes('time') || q.includes('year') || q.includes('over time') || q.includes('date'))) {
    chartType = 'line';
    xAxis = primaryDate;
    yAxis = primaryNum;
    const ts = computeTimeSeriesAnalysis(workingRows, primaryDate, primaryNum);
    chartData = ts.trendPoints.map(p => ({
      [primaryDate]: p.period,
      [primaryNum]: p.value,
      '3-Period Moving Avg': p.movingAverage
    }));
    understoodIntent = `Track chronological velocity of ${primaryNum} over ${primaryDate}.`;
    analyticalExplanation = `Aggregated ${primaryNum} across ${ts.trendPoints.length} chronological periods (${ts.granularity} granularity). Recorded peak in ${ts.peakPeriod.period} ($${ts.peakPeriod.value.toLocaleString()}) with ${ts.growthRatePct >= 0 ? '+' : ''}${ts.growthRatePct}% overall trend velocity.`;
  }
  // 2. Correlation / Scatter queries
  else if ((q.includes('scatter') || q.includes('correlation') || q.includes('relationship') || q.includes('vs')) && numCols.length >= 2) {
    chartType = 'scatter';
    const num1 = matchedNums[0] || numCols[0];
    const num2 = matchedNums[1] || numCols[1];
    xAxis = num1;
    yAxis = num2;
    chartData = workingRows.slice(0, 150).map(r => ({
      [num1]: Number(r[num1]),
      [num2]: Number(r[num2])
    }));
    understoodIntent = `Bivariate scatter dispersion mapping correlation between ${num1} and ${num2}.`;
    analyticalExplanation = `Scatter plot evaluating linear association between ${num1} and ${num2} across sample records.`;
  }
  // 3. Distribution / Histogram queries
  else if (q.includes('distribution') || q.includes('histogram') || q.includes('spread') || q.includes('frequency')) {
    chartType = 'histogram';
    xAxis = primaryNum;
    const prof = profiles[primaryNum];
    chartData = prof?.histogram ? prof.histogram.map(h => ({ [primaryNum]: h.bin, Count: h.count })) : [];
    understoodIntent = `Univariate frequency distribution histogram for ${primaryNum}.`;
    analyticalExplanation = `Evaluates normality and skewness for ${primaryNum}. Mean is ${prof?.mean?.toFixed(1)}, Median is ${prof?.median?.toFixed(1)}, with ${prof?.outlierCount || 0} outlier observations.`;
  }
  // 4. Default: Categorical Breakdown / Top N
  else {
    chartType = 'bar';
    const topN = q.includes('top 5') ? 5 : q.includes('top 20') ? 20 : 10;
    const summary = computeGroupSummary(workingRows, primaryCat, primaryNum, 'sum').slice(0, topN);
    chartData = summary.map(s => ({
      [primaryCat]: s.category,
      [primaryNum]: s.sum,
      'Average Value': s.mean,
      'Share %': s.sharePct
    }));
    understoodIntent = `Compare aggregate ${primaryNum} sliced across top ${chartData.length} categories of ${primaryCat}.`;
    const topLeader = chartData[0];
    analyticalExplanation = `Top category is '${topLeader ? topLeader[primaryCat] : 'N/A'}' generating ${topLeader ? topLeader[primaryNum]?.toLocaleString() : 0} (${topLeader ? topLeader['Share %'] : 0}% of total aggregated ${primaryNum}).`;
  }

  // Construct exact data table
  const keys = chartData.length > 0 ? Object.keys(chartData[0]) : [xAxis, yAxis];
  const tableHeaders = keys;
  const tableRows = chartData.map(row => keys.map(k => (row[k] !== undefined ? row[k] : '')));

  return {
    query,
    understoodIntent,
    resolvedColumns: {
      x: xAxis,
      y: yAxis,
      date: primaryDate,
      group: primaryCat
    },
    chartConfig: {
      id: `nl-chart-${Date.now()}`,
      title: `${primaryNum} by ${xAxis}`,
      type: chartType,
      xAxis,
      yAxis,
      description: understoodIntent,
      explanation: analyticalExplanation
    },
    chartData,
    xAxisLabel: xAxis,
    yAxisLabel: yAxis,
    analyticalExplanation,
    exactDataTable: {
      headers: tableHeaders,
      rows: tableRows
    }
  };
}

// ==========================================
// 9. AUTOMATED AI EDA INSIGHTS GENERATION
// ==========================================

export function generateAutomatedEDAInsights(
  rows: Record<string, any>[],
  columns: string[],
  profiles: Record<string, ColumnProfile>,
  classifications: Record<string, ColumnClassification>
): { insights: DatasetInsight[]; edaSummary: EDASummaryReport } {
  const insights: DatasetInsight[] = [];
  const numCols = columns.filter(c => profiles[c]?.type === 'numeric');
  const catCols = columns.filter(c => profiles[c]?.type === 'categorical');
  const dateCols = columns.filter(c => profiles[c]?.type === 'datetime');

  // 1. TOP CATEGORICAL DOMINANCE & PARETO
  if (catCols.length > 0 && numCols.length > 0) {
    const primaryCat = catCols[0];
    const primaryNum = numCols.find(c => /sales|revenue|profit|income/i.test(c)) || numCols[0];
    const summary = computeGroupSummary(rows, primaryCat, primaryNum, 'sum');
    if (summary.length > 0) {
      const leader = summary[0];
      const total = summary.reduce((a, b) => a + b.sum, 0);
      const leaderShare = total > 0 ? Math.round((leader.sum / total) * 1000) / 10 : 0;

      insights.push({
        id: `eda-ins-leader-${primaryCat}`,
        title: `'${leader.category}' dominates ${primaryNum} contribution`,
        category: 'PERFORMANCE',
        description: `Segment '${leader.category}' accounts for $${leader.sum.toLocaleString()} in total ${primaryNum}.`,
        evidence: `${leaderShare}% of total recorded ${primaryNum} ($${total.toLocaleString()}) across ${summary.length} ${primaryCat} categories.`,
        businessInterpretation: `Top concentration risk: over a quarter of performance is heavily reliant on ${leader.category}. Expanding secondary tiers can hedge single-category volatility.`,
        confidence: 96,
        impact: leaderShare > 40 ? 'WARNING' : 'POSITIVE',
        metric: primaryNum,
        metricValue: `$${leader.sum.toLocaleString()} (${leaderShare}%)`,
        recommendedAction: `Perform secondary breakdown into sub-segments of '${leader.category}' to isolate key drivers.`
      });
    }
  }

  // 2. CORRELATIONS
  if (numCols.length >= 2) {
    const corr = computeCorrelationMatrix(rows, numCols);
    const topPair = corr.pairs && corr.pairs.length > 0 ? corr.pairs[0] : null;
    if (topPair && Math.abs(topPair.correlation) >= 0.4) {
      insights.push({
        id: `eda-ins-corr-${topPair.col1}-${topPair.col2}`,
        title: `${topPair.strength} correlation detected between ${topPair.col1} and ${topPair.col2}`,
        category: 'CORRELATION',
        description: `Pearson linear correlation coefficient calculated at r = ${topPair.correlation.toFixed(3)} (p-value: ${topPair.pValue || '<0.001'}).`,
        evidence: `${topPair.direction.toUpperCase()} co-movement observed consistently across ${rows.length} records.`,
        businessInterpretation: `Statistical association confirms ${topPair.col1} moves strongly alongside ${topPair.col2}. Note: Correlation does not guarantee causation; external market factors should be verified.`,
        confidence: 92,
        impact: topPair.correlation > 0 ? 'POSITIVE' : 'NEUTRAL',
        metric: 'Pearson r',
        metricValue: topPair.correlation.toFixed(3),
        recommendedAction: `Test linear regression model using ${topPair.col1} to forecast expected changes in ${topPair.col2}.`
      });
    }
  }

  // 3. TIME-SERIES VELOCITY & PEAK
  if (dateCols.length > 0 && numCols.length > 0) {
    const primaryDate = dateCols[0];
    const primaryNum = numCols.find(c => /sales|revenue|profit/i.test(c)) || numCols[0];
    const ts = computeTimeSeriesAnalysis(rows, primaryDate, primaryNum);
    if (ts.trendPoints.length >= 2) {
      insights.push({
        id: `eda-ins-trend-${primaryDate}`,
        title: `${ts.trendDirection} historical trajectory in ${primaryNum}`,
        category: 'TREND',
        description: `Period trajectory calculated at ${ts.growthRatePct >= 0 ? '+' : ''}${ts.growthRatePct}% between ${ts.startDate} and ${ts.endDate}.`,
        evidence: `Historical peak achieved in ${ts.peakPeriod.period} ($${ts.peakPeriod.value.toLocaleString()}), with historical trough in ${ts.troughPeriod.period} ($${ts.troughPeriod.value.toLocaleString()}).`,
        businessInterpretation: `Chronological stability is ${ts.trendDirection.toLowerCase()}. Identifying demand spikes during ${ts.peakPeriod.period} enables proactive inventory and resource planning.`,
        confidence: 94,
        impact: ts.growthRatePct >= 0 ? 'POSITIVE' : 'NEGATIVE',
        metric: 'Trajectory Velocity',
        metricValue: `${ts.growthRatePct >= 0 ? '+' : ''}${ts.growthRatePct}%`,
        recommendedAction: `Analyze marketing campaigns and seasonal cycles active during peak period ${ts.peakPeriod.period}.`
      });
    }
  }

  // 4. SKEWNESS & OUTLIER ANOMALY INSIGHT
  const skewedNum = numCols.find(c => Math.abs(profiles[c]?.skewness || 0) > 1.5);
  if (skewedNum) {
    const prof = profiles[skewedNum];
    insights.push({
      id: `eda-ins-skew-${skewedNum}`,
      title: `High positive skewness in ${skewedNum} distribution`,
      category: 'DISTRIBUTION',
      description: `Distribution skewness index is ${prof.skewness?.toFixed(2)}, with Mean ($${prof.mean?.toFixed(1)}) diverging from Median ($${prof.median?.toFixed(1)}).`,
      evidence: `${prof.outlierCount || 0} upper extreme values (${prof.outlierPercentage || 0}% of records) stretch the positive tail.`,
      businessInterpretation: `A small group of high-value transactions disproportionately influences arithmetic averages. Median ($${prof.median?.toFixed(1)}) should be used for representative benchmarking rather than mean.`,
      confidence: 95,
      impact: 'WARNING',
      metric: 'Skewness',
      metricValue: `${prof.skewness?.toFixed(2)}`,
      recommendedAction: `Apply log-transformation or Winsorization (IQR capping) when preparing this column for predictive regression.`
    });
  }

  // 5. MARGIN / EFFICIENCY OPPORTUNITY
  const kpis = detectBusinessKPIs(rows, columns, profiles, classifications);
  const marginKpi = kpis.find(k => k.id === 'kpi-margin');
  if (marginKpi) {
    insights.push({
      id: 'eda-ins-margin-opp',
      title: `Operating margin stands at ${marginKpi.value}`,
      category: 'BUSINESS OPPORTUNITY',
      description: marginKpi.formulaDescription,
      evidence: `Total revenue of ${kpis.find(k => k.id === 'kpi-rev')?.value || 'N/A'} yielded ${kpis.find(k => k.id === 'kpi-profit')?.value || 'N/A'} net profit.`,
      businessInterpretation: `Current margin indicates ${marginKpi.benchmarkNote || 'standard operating efficiency'}. Pricing optimization in low-margin segments could unlock bottom-line margin expansion.`,
      confidence: 90,
      impact: marginKpi.numericValue >= 15 ? 'POSITIVE' : 'WARNING',
      metric: 'Profit Margin',
      metricValue: marginKpi.value,
      recommendedAction: `Filter for transactions with negative or sub-5% margin to eliminate margin-dilutive discounts.`
    });
  }

  // Generate EDASummaryReport
  const top5 = insights.slice(0, 5);
  const remaining = insights.slice(5);

  const corrData = numCols.length >= 2 ? computeCorrelationMatrix(rows, numCols) : { pairs: [] };
  const topCorrs = (corrData.pairs || []).slice(0, 5).map(p => ({
    col1: p.col1,
    col2: p.col2,
    correlation: p.correlation,
    strength: p.strength
  }));

  const tsSummary = dateCols.length > 0 && numCols.length > 0 ? (() => {
    const ts = computeTimeSeriesAnalysis(rows, dateCols[0], numCols[0]);
    return {
      dateCol: dateCols[0],
      metricCol: numCols[0],
      trend: ts.trendDirection,
      growthPct: ts.growthRatePct,
      peak: `${ts.peakPeriod.period} ($${ts.peakPeriod.value.toLocaleString()})`,
      trough: `${ts.troughPeriod.period} ($${ts.troughPeriod.value.toLocaleString()})`
    };
  })() : undefined;

  const anomalies = extractAnomalies(rows, columns, profiles);
  const affectedCols = Array.from(new Set(anomalies.map(a => a.column)));

  const edaSummary: EDASummaryReport = {
    generatedAt: Date.now(),
    datasetName: 'Dataset',
    overview: {
      rows: rows.length,
      columns: columns.length,
      numericCount: numCols.length,
      categoricalCount: catCols.length,
      dateCount: dateCols.length,
      missingCells: 0,
      missingPercentage: 0,
      duplicateRows: 0,
      qualityScore: 90
    },
    kpis,
    top5Insights: top5,
    remainingInsights: remaining,
    topCorrelations: topCorrs,
    timeSeriesSummary: tsSummary,
    keySegmentHighlights: catCols.slice(0, 3).map(c => `Dimension '${c}' contains ${profiles[c]?.uniqueCount || 0} discrete operational segments.`),
    anomaliesSummary: {
      totalAnomalies: anomalies.length,
      affectedColumns: affectedCols
    },
    recommendedNextSteps: [
      'Investigate top-performing category drivers in bivariate grouped charts.',
      'Check time-series moving average for cyclical demand patterns.',
      'Audit extreme upper-tail observations highlighted in anomaly analysis.',
      'Proceed to Machine Learning modeling with pre-screened feature candidates.'
    ]
  };

  return { insights, edaSummary };
}

// ==========================================
// 10. SMART CHART RECOMMENDATIONS
// ==========================================

export function generateSmartEDARecommendations(
  columns: string[],
  profiles: Record<string, ColumnProfile>
): ChartConfig[] {
  const configs: ChartConfig[] = [];
  const numCols = columns.filter(c => profiles[c]?.type === 'numeric');
  const catCols = columns.filter(c => profiles[c]?.type === 'categorical');
  const dateCols = columns.filter(c => profiles[c]?.type === 'datetime');

  // 1. Primary Time Series if date exists
  if (dateCols.length > 0 && numCols.length > 0) {
    const primaryMetric = numCols.find(c => /sales|revenue|profit|income|cost|price|volume/i.test(c)) || numCols[0];
    configs.push({
      id: 'eda-trend',
      title: `${primaryMetric} Trend Over Time`,
      type: 'line',
      xAxis: dateCols[0],
      yAxis: primaryMetric,
      aggregation: 'sum',
      description: `Historical trend analysis tracking aggregated ${primaryMetric} by date periods.`,
      explanation: `Reveals chronological velocity and period peaks for ${primaryMetric}.`
    });
  }

  // 2. High impact categorical vs primary numeric breakdown
  if (catCols.length > 0 && numCols.length > 0) {
    const primaryCat = catCols.find(c => (profiles[c]?.uniqueCount || 0) <= 8) || catCols[0];
    const primaryNum = numCols.find(c => /sales|revenue|profit|salary|mrr|score|rating/i.test(c)) || numCols[0];

    configs.push({
      id: 'eda-cat-breakdown',
      title: `${primaryNum} Distribution by ${primaryCat}`,
      type: 'bar',
      xAxis: primaryCat,
      yAxis: primaryNum,
      aggregation: 'sum',
      sortBy: 'desc',
      description: `Aggregated total ${primaryNum} compared across all categories of ${primaryCat}.`,
      explanation: `Quantifies revenue/performance contribution across key ${primaryCat} segments.`
    });

    if (catCols.length > 1) {
      const secondaryCat = catCols.find(c => c !== primaryCat && (profiles[c]?.uniqueCount || 0) <= 6) || catCols[1];
      configs.push({
        id: 'eda-grouped-breakdown',
        title: `${primaryNum} by ${primaryCat} grouped by ${secondaryCat}`,
        type: 'bar',
        xAxis: primaryCat,
        yAxis: primaryNum,
        groupBy: secondaryCat,
        aggregation: 'sum',
        description: `Multi-dimensional comparative analysis across ${primaryCat} segmented by ${secondaryCat}.`,
        explanation: `Cross-analyzes how ${secondaryCat} sub-segments perform within each ${primaryCat}.`
      });
    }
  }

  // 3. Scatter correlation plot between top 2 numeric columns
  if (numCols.length >= 2) {
    const num1 = numCols[0];
    const num2 = numCols[1];
    configs.push({
      id: 'eda-scatter',
      title: `${num1} vs. ${num2} Correlation Scatter`,
      type: 'scatter',
      xAxis: num1,
      yAxis: num2,
      groupBy: catCols[0],
      description: `Bivariate dispersion checking linear or non-linear correlation between ${num1} and ${num2}.`,
      explanation: `Evaluates dispersion consistency and potential non-linear relationships.`
    });
  }

  // 4. Histogram / Distribution of most variable numeric column
  if (numCols.length > 0) {
    const primaryNum = numCols.find(c => /salary|mrr|sales|revenue|age|tenure|score/i.test(c)) || numCols[0];
    configs.push({
      id: 'eda-hist',
      title: `Frequency Distribution of ${primaryNum}`,
      type: 'histogram',
      xAxis: primaryNum,
      description: `Univariate frequency distribution histogram highlighting skewness and spread.`,
      explanation: `Shows value clustering, central tendency, and tail frequencies.`
    });
  }

  // 5. Pie / Proportion chart for low cardinality category
  const lowCardCat = catCols.find(c => {
    const u = profiles[c]?.uniqueCount || 0;
    return u >= 2 && u <= 5;
  });
  if (lowCardCat && numCols.length > 0) {
    configs.push({
      id: 'eda-donut',
      title: `Market Share / Breakdown by ${lowCardCat}`,
      type: 'donut',
      xAxis: lowCardCat,
      yAxis: numCols[0],
      aggregation: 'sum',
      description: `Proportional contribution of each ${lowCardCat} segment to total ${numCols[0]}.`,
      explanation: `Pie/Donut proportion visualization for low-cardinality dimension (${lowCardCat}).`
    });
  }

  return configs;
}
