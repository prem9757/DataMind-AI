// ============================================================================
// PHASE 8: DRIVER ANALYSIS & DIMENSIONAL DECOMPOSITION ENGINE
// ============================================================================

import { DriverContribution, DecompositionNode } from '../types/agent';

export interface DriverAnalysisResult {
  targetMetric: string;
  baselinePeriod?: string;
  currentPeriod?: string;
  baselineTotal: number;
  currentTotal: number;
  totalDelta: number;
  totalPercentDelta: number;
  drivers: DriverContribution[];
  decomposition?: DecompositionNode;
}

export function performDriverAnalysis(
  rows: Record<string, any>[],
  columns: string[],
  profiles: Record<string, any>,
  targetMetric: string,
  timeColumn?: string
): DriverAnalysisResult {
  // Find potential categorical dimensions for breakdown
  const categoricalDims = columns.filter(c => {
    if (c === targetMetric || c === timeColumn) return false;
    const prof = profiles[c];
    if (prof && prof.type === 'categorical') return true;
    const distinct = prof?.distinctCount ?? 0;
    return distinct >= 2 && distinct <= 50;
  });

  // Calculate baseline & current periods if timeColumn is available
  let baselineRows = rows;
  let currentRows = rows;
  let baselinePeriod = 'Historical / Average';
  let currentPeriod = 'Current / Latest';

  if (timeColumn && columns.includes(timeColumn)) {
    const sortedDates = Array.from(new Set(rows.map(r => String(r[timeColumn] ?? '')).filter(Boolean))).sort();
    if (sortedDates.length >= 2) {
      const midpoint = Math.floor(sortedDates.length / 2);
      const baselineDates = new Set(sortedDates.slice(0, midpoint));
      const currentDates = new Set(sortedDates.slice(midpoint));

      baselineRows = rows.filter(r => baselineDates.has(String(r[timeColumn])));
      currentRows = rows.filter(r => currentDates.has(String(r[timeColumn])));
      baselinePeriod = `${sortedDates[0]} - ${sortedDates[midpoint - 1]}`;
      currentPeriod = `${sortedDates[midpoint]} - ${sortedDates[sortedDates.length - 1]}`;
    }
  }

  const baselineTotal = baselineRows.reduce((acc, r) => acc + (Number(r[targetMetric]) || 0), 0);
  const currentTotal = currentRows.reduce((acc, r) => acc + (Number(r[targetMetric]) || 0), 0);
  const totalDelta = currentTotal - baselineTotal;
  const totalPercentDelta = baselineTotal !== 0 ? (totalDelta / baselineTotal) * 100 : 0;

  const drivers: DriverContribution[] = [];

  // Analyze each categorical dimension
  for (const dim of categoricalDims.slice(0, 4)) {
    const dimFactors = Array.from(new Set(rows.map(r => String(r[dim] ?? 'Unknown'))));

    for (const factor of dimFactors) {
      const bSum = baselineRows.filter(r => String(r[dim]) === factor).reduce((acc, r) => acc + (Number(r[targetMetric]) || 0), 0);
      const cSum = currentRows.filter(r => String(r[dim]) === factor).reduce((acc, r) => acc + (Number(r[targetMetric]) || 0), 0);
      const delta = cSum - bSum;

      // Contribution to total absolute change
      const pctContribution = totalDelta !== 0 ? (delta / Math.abs(totalDelta)) * 100 : 0;

      if (Math.abs(delta) > 0.001) {
        drivers.push({
          dimension: dim,
          factor,
          metric: targetMetric,
          baselineValue: Math.round(bSum * 100) / 100,
          currentValue: Math.round(cSum * 100) / 100,
          absoluteDelta: Math.round(delta * 100) / 100,
          percentageContribution: Math.round(pctContribution * 10) / 10,
          direction: delta > 0 ? 'favorable' : delta < 0 ? 'unfavorable' : 'neutral',
          significance: Math.abs(pctContribution) > 20 ? 'MAJOR' : Math.abs(pctContribution) > 8 ? 'MODERATE' : 'MINOR'
        });
      }
    }
  }

  // Sort drivers by absolute delta impact
  drivers.sort((a, b) => Math.abs(b.absoluteDelta) - Math.abs(a.absoluteDelta));

  // Build mathematical decomposition tree if formula components exist
  // e.g. Revenue = Orders * AOV or Profit = Revenue - Cost
  let decomposition: DecompositionNode | undefined;
  const lowerCols = columns.map(c => c.toLowerCase());

  const hasCost = lowerCols.some(c => c.includes('cost') || c.includes('expense'));
  const hasRevenue = lowerCols.some(c => c.includes('revenue') || c.includes('sales'));
  const hasOrders = lowerCols.some(c => c.includes('order') || c.includes('quantity') || c.includes('volume'));

  if (targetMetric.toLowerCase().includes('profit') && hasRevenue && hasCost) {
    const revCol = columns.find(c => c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sales'))!;
    const costCol = columns.find(c => c.toLowerCase().includes('cost') || c.toLowerCase().includes('expense'))!;

    const revTotal = currentRows.reduce((a, r) => a + (Number(r[revCol]) || 0), 0);
    const costTotal = currentRows.reduce((a, r) => a + (Number(r[costCol]) || 0), 0);

    decomposition = {
      name: `${targetMetric} (Net)`,
      value: currentTotal,
      delta: totalDelta,
      percentDelta: totalPercentDelta,
      formula: `${revCol} - ${costCol}`,
      children: [
        { name: revCol, value: revTotal, formula: 'Topline Revenue' },
        { name: costCol, value: costTotal, formula: 'Operating Expenses' }
      ]
    };
  } else if (hasRevenue && hasOrders) {
    const orderCount = currentRows.length;
    const aov = orderCount > 0 ? currentTotal / orderCount : 0;

    decomposition = {
      name: targetMetric,
      value: currentTotal,
      delta: totalDelta,
      percentDelta: totalPercentDelta,
      formula: 'Order Volume × Average Order Value',
      children: [
        { name: 'Order Volume (Transactions)', value: orderCount, formula: 'Count of transactions' },
        { name: 'Average Transaction Value', value: Math.round(aov * 100) / 100, formula: `${targetMetric} / Orders` }
      ]
    };
  }

  return {
    targetMetric,
    baselinePeriod,
    currentPeriod,
    baselineTotal: Math.round(baselineTotal * 100) / 100,
    currentTotal: Math.round(currentTotal * 100) / 100,
    totalDelta: Math.round(totalDelta * 100) / 100,
    totalPercentDelta: Math.round(totalPercentDelta * 10) / 10,
    drivers: drivers.slice(0, 10),
    decomposition
  };
}
