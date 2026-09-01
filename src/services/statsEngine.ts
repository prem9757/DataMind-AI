import * as ss from 'simple-statistics';
import {
  StatisticalTestResult,
  DetailedDescriptiveStats,
  AssumptionCheck,
  ColumnProfile
} from '../types/dataset';

// Approximation of Student's t distribution cumulative probability
function studentTCDF(t: number, df: number): number {
  if (df <= 0) return 0.5;
  const normalApprox = 0.5 * (1 + Math.sign(t) * Math.sqrt(1 - Math.exp(-2 * t * t / Math.PI)));
  return Math.min(1, Math.max(0, normalApprox));
}

// Approximation of F-distribution p-value
function fTestPValue(f: number, df1: number, df2: number): number {
  if (f <= 0 || df1 <= 0 || df2 <= 0) return 1;
  const s1 = 2 / (9 * df1);
  const s2 = 2 / (9 * df2);
  const z = (Math.pow(f, 1 / 3) * (1 - s2) - (1 - s1)) / Math.sqrt(s1 + Math.pow(f, 2 / 3) * s2);
  const p = 0.5 * (1 - Math.sign(z) * Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI)));
  return Math.min(1, Math.max(0.0001, p));
}

// Approximation of Chi-Square distribution p-value
function chiSquarePValue(chi2: number, df: number): number {
  if (chi2 <= 0 || df <= 0) return 1;
  const s = 2 / (9 * df);
  const z = (Math.pow(chi2 / df, 1 / 3) - (1 - s)) / Math.sqrt(s);
  const p = 0.5 * (1 - Math.sign(z) * Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI)));
  return Math.min(1, Math.max(0.0001, p));
}

/**
 * 1. Calculate Comprehensive Descriptive Statistics with Confidence Intervals
 */
export function computeDetailedDescriptiveStats(
  rows: Record<string, any>[],
  columns: string[],
  profiles: Record<string, ColumnProfile>
): DetailedDescriptiveStats[] {
  const numCols = columns.filter(c => profiles[c]?.type === 'numeric');
  const results: DetailedDescriptiveStats[] = [];

  for (const col of numCols) {
    const rawVals = rows
      .map(r => Number(r[col]))
      .filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));

    if (rawVals.length === 0) continue;

    const count = rawVals.length;
    const nullCount = rows.length - count;
    const sorted = [...rawVals].sort((a, b) => a - b);

    const mean = ss.mean(sorted);
    const median = ss.median(sorted);
    const mode = ss.mode(sorted);
    const variance = ss.sampleVariance(sorted) || 0;
    const stdDev = Math.sqrt(variance);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const range = max - min;

    const q1 = ss.quantile(sorted, 0.25);
    const q2 = ss.quantile(sorted, 0.50);
    const q3 = ss.quantile(sorted, 0.75);
    const iqr = q3 - q1;

    const skewness = ss.sampleSkewness(sorted);
    const kurtosis = ss.sampleKurtosis(sorted);
    const standardError = stdDev / Math.sqrt(count);

    // Confidence intervals
    const ci90Margin = 1.645 * standardError;
    const ci95Margin = 1.960 * standardError;
    const ci99Margin = 2.576 * standardError;

    results.push({
      column: col,
      count,
      nullCount,
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      mode: typeof mode === 'number' ? Math.round(mode * 100) / 100 : mode,
      stdDev: Math.round(stdDev * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      range: Math.round(range * 100) / 100,
      q1: Math.round(q1 * 100) / 100,
      q2: Math.round(q2 * 100) / 100,
      q3: Math.round(q3 * 100) / 100,
      iqr: Math.round(iqr * 100) / 100,
      skewness: Math.round(skewness * 100) / 100,
      kurtosis: Math.round(kurtosis * 100) / 100,
      standardError: Math.round(standardError * 1000) / 1000,
      ci90: [Math.round((mean - ci90Margin) * 100) / 100, Math.round((mean + ci90Margin) * 100) / 100],
      ci95: [Math.round((mean - ci95Margin) * 100) / 100, Math.round((mean + ci95Margin) * 100) / 100],
      ci99: [Math.round((mean - ci99Margin) * 100) / 100, Math.round((mean + ci99Margin) * 100) / 100]
    });
  }

  return results;
}

/**
 * 2. Assumption Check Engine
 */
export function checkStatisticalAssumptions(
  group1: number[],
  group2?: number[],
  alpha = 0.05
): AssumptionCheck[] {
  const checks: AssumptionCheck[] = [];

  // 1. Sample Size Check
  const n1 = group1.length;
  const n2 = group2 ? group2.length : 0;
  if (n1 >= 30 && (!group2 || n2 >= 30)) {
    checks.push({
      assumption: 'Sample Size Sufficiency',
      status: 'PASSED',
      evidence: `Group sizes (N1=${n1}${group2 ? `, N2=${n2}` : ''}) satisfy the Central Limit Theorem threshold (N ≥ 30).`,
      recommendation: 'Parametric asymptotic properties are well-supported.'
    });
  } else if (n1 >= 10 && (!group2 || n2 >= 10)) {
    checks.push({
      assumption: 'Sample Size Sufficiency',
      status: 'WARNING',
      evidence: `Moderate sample size (N1=${n1}${group2 ? `, N2=${n2}` : ''}). Test power may be moderately constrained.`,
      recommendation: 'Check normality assumption closely; consider non-parametric fallback if skewed.'
    });
  } else {
    checks.push({
      assumption: 'Sample Size Sufficiency',
      status: 'VIOLATED',
      evidence: `Small sample size (N1=${n1}${group2 ? `, N2=${n2}` : ''} < 10). High risk of Type II error.`,
      recommendation: 'Use exact non-parametric tests (e.g. Mann-Whitney U / Wilcoxon).'
    });
  }

  // 2. Normality Assessment via Skewness & Kurtosis
  const skew1 = Math.abs(ss.sampleSkewness(group1));
  const kurt1 = Math.abs(ss.sampleKurtosis(group1));
  const isNormal1 = skew1 < 1.0 && kurt1 < 2.0;

  let isNormal2 = true;
  if (group2 && group2.length > 2) {
    const skew2 = Math.abs(ss.sampleSkewness(group2));
    const kurt2 = Math.abs(ss.sampleKurtosis(group2));
    isNormal2 = skew2 < 1.0 && kurt2 < 2.0;
  }

  if (isNormal1 && isNormal2) {
    checks.push({
      assumption: 'Normality of Distribution',
      status: 'PASSED',
      evidence: `Skewness (${skew1.toFixed(2)}) and kurtosis (${kurt1.toFixed(2)}) fall within acceptable Gaussian limits (|skew| < 1, |kurt| < 2).`,
      recommendation: 'Standard parametric t-test / ANOVA assumptions are satisfied.'
    });
  } else {
    checks.push({
      assumption: 'Normality of Distribution',
      status: 'WARNING',
      evidence: `Distribution exhibits noticeable skewness (${skew1.toFixed(2)}) or tail kurtosis (${kurt1.toFixed(2)}).`,
      recommendation: 'Welch’s robust formulation or non-parametric Mann-Whitney U recommended.'
    });
  }

  // 3. Homogeneity of Variance (if 2 groups)
  if (group2 && group2.length > 2) {
    const v1 = ss.sampleVariance(group1) || 1;
    const v2 = ss.sampleVariance(group2) || 1;
    const varianceRatio = Math.max(v1, v2) / Math.min(v1, v2);

    if (varianceRatio < 2.0) {
      checks.push({
        assumption: 'Homogeneity of Variance (Homoscedasticity)',
        status: 'PASSED',
        evidence: `Variance ratio (F_max = ${varianceRatio.toFixed(2)}) is < 2.0, indicating comparable group dispersions.`,
        recommendation: 'Equal variance assumption holds.'
      });
    } else {
      checks.push({
        assumption: 'Homogeneity of Variance (Homoscedasticity)',
        status: 'WARNING',
        evidence: `Variance ratio (F_max = ${varianceRatio.toFixed(2)}) exceeds 2.0. Group spreads are unequal.`,
        recommendation: "Use Welch's t-test which does not assume equal variances."
      });
    }
  }

  return checks;
}

/**
 * 3. Two-Sample Independent Welch's / Student's t-Test
 */
export function runTwoSampleTTest(
  group1Values: number[],
  group2Values: number[],
  group1Name: string,
  group2Name: string,
  metricName: string,
  alpha = 0.05
): StatisticalTestResult {
  const clean1 = group1Values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
  const clean2 = group2Values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));

  if (clean1.length < 3 || clean2.length < 3) {
    throw new Error('Both groups must contain at least 3 valid observations to perform a t-test.');
  }

  const n1 = clean1.length;
  const n2 = clean2.length;
  const mean1 = ss.mean(clean1);
  const mean2 = ss.mean(clean2);
  const var1 = ss.sampleVariance(clean1);
  const var2 = ss.sampleVariance(clean2);

  // Welch's t-test calculation
  const seDiff = Math.sqrt(var1 / n1 + var2 / n2);
  const tStat = seDiff > 0 ? (mean1 - mean2) / seDiff : 0;
  
  const numDf = Math.pow(var1 / n1 + var2 / n2, 2);
  const denomDf = (Math.pow(var1 / n1, 2) / (n1 - 1)) + (Math.pow(var2 / n2, 2) / (n2 - 1));
  const df = Math.max(1, Math.round(denomDf > 0 ? numDf / denomDf : n1 + n2 - 2));

  const pValApprox = 2 * (1 - studentTCDF(Math.abs(tStat), df));
  const pValue = Math.min(1, Math.max(0.0001, Math.round(pValApprox * 10000) / 10000));
  const isSignificant = pValue < alpha;

  // Cohen's d effect size
  const pooledSd = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));
  const cohensD = pooledSd > 0 ? Math.abs(mean1 - mean2) / pooledSd : 0;
  let dEffect = 'Negligible';
  if (cohensD >= 0.8) dEffect = 'Large';
  else if (cohensD >= 0.5) dEffect = 'Medium';
  else if (cohensD >= 0.2) dEffect = 'Small';

  // 95% Confidence Interval for mean difference
  const marginError = 1.96 * seDiff;
  const diff = mean1 - mean2;
  const ci: [number, number] = [
    Math.round((diff - marginError) * 100) / 100,
    Math.round((diff + marginError) * 100) / 100
  ];

  const assumptions = checkStatisticalAssumptions(clean1, clean2, alpha);

  const interpretation = isSignificant
    ? `The difference in ${metricName} between "${group1Name}" (mean: ${Math.round(mean1 * 100) / 100}) and "${group2Name}" (mean: ${Math.round(mean2 * 100) / 100}) is statistically significant at the α = ${alpha} level (t = ${Math.round(tStat * 100) / 100}, p = ${pValue < 0.001 ? '<0.001' : pValue}).`
    : `No statistically significant difference in ${metricName} was detected between "${group1Name}" (mean: ${Math.round(mean1 * 100) / 100}) and "${group2Name}" (mean: ${Math.round(mean2 * 100) / 100}) (t = ${Math.round(tStat * 100) / 100}, p = ${pValue}). The observed delta is consistent with random sampling variability.`;

  const businessMeaning = isSignificant
    ? `Strategic Takeaway: The performance spread between "${group1Name}" and "${group2Name}" represents a genuine commercial difference (Cohen's d = ${Math.round(cohensD * 100) / 100}, ${dEffect} effect size). Consider allocating resources or investigating regional best practices.`
    : `Strategic Takeaway: Do not implement disparate policies or pricing exclusively based on "${group1Name}" vs "${group2Name}", as their ${metricName} distributions are statistically indistinguishable.`;

  return {
    testName: "Welch's Two-Sample Independent t-Test",
    testedVariables: [group1Name, group2Name, metricName],
    hypothesis: {
      nullHypothesis: `Mean ${metricName} is equal across ${group1Name} and ${group2Name} (μ1 = μ2).`,
      alternativeHypothesis: `Mean ${metricName} is significantly different between ${group1Name} and ${group2Name} (μ1 ≠ μ2).`
    },
    statisticName: 't-Statistic',
    statisticValue: Math.round(tStat * 1000) / 1000,
    pValue,
    degreesOfFreedom: df,
    isSignificant,
    significanceLevel: alpha,
    confidenceInterval: ci,
    effectSize: {
      name: "Cohen's d",
      value: Math.round(cohensD * 1000) / 1000,
      interpretation: `${dEffect} effect size`
    },
    assumptions,
    nonParametricAlternative: 'Mann-Whitney U Test (Wilcoxon Rank-Sum)',
    interpretation,
    businessMeaning,
    tableData: {
      headers: ['Group Name', 'Sample Size (N)', 'Mean', 'Standard Deviation', 'Median'],
      rows: [
        [group1Name, n1, Math.round(mean1 * 100) / 100, Math.round(Math.sqrt(var1) * 100) / 100, Math.round(ss.median(clean1) * 100) / 100],
        [group2Name, n2, Math.round(mean2 * 100) / 100, Math.round(Math.sqrt(var2) * 100) / 100, Math.round(ss.median(clean2) * 100) / 100]
      ]
    }
  };
}

/**
 * 4. One-Way ANOVA (Analysis of Variance)
 */
export function runOneWayANOVA(
  groups: Record<string, number[]>,
  groupVariable: string,
  metricName: string,
  alpha = 0.05
): StatisticalTestResult {
  const groupNames = Object.keys(groups).filter(g => groups[g]?.length >= 2);
  const k = groupNames.length;

  if (k < 2) {
    throw new Error('ANOVA requires at least 2 distinct groups with at least 2 samples each.');
  }

  let totalN = 0;
  let allValues: number[] = [];
  const groupStats: { name: string; n: number; mean: number; variance: number }[] = [];

  for (const name of groupNames) {
    const vals = groups[name].filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    totalN += vals.length;
    allValues = allValues.concat(vals);
    groupStats.push({
      name,
      n: vals.length,
      mean: ss.mean(vals),
      variance: ss.sampleVariance(vals)
    });
  }

  const grandMean = ss.mean(allValues);

  // Sum of squares between (SSB)
  let ssb = 0;
  for (const g of groupStats) {
    ssb += g.n * Math.pow(g.mean - grandMean, 2);
  }
  const dfBetween = k - 1;
  const msBetween = dfBetween > 0 ? ssb / dfBetween : 0;

  // Sum of squares within (SSW)
  let ssw = 0;
  for (const name of groupNames) {
    const vals = groups[name];
    const m = ss.mean(vals);
    for (const v of vals) {
      ssw += Math.pow(v - m, 2);
    }
  }
  const dfWithin = totalN - k;
  const msWithin = dfWithin > 0 ? ssw / dfWithin : 1;

  const fStat = msWithin > 0 ? msBetween / msWithin : 0;
  const pValApprox = fTestPValue(fStat, dfBetween, dfWithin);
  const pValue = Math.min(1, Math.max(0.0001, Math.round(pValApprox * 10000) / 10000));
  const isSignificant = pValue < alpha;

  // Eta-squared effect size
  const totalSS = ssb + ssw;
  const etaSquared = totalSS > 0 ? ssb / totalSS : 0;
  let etaEffect = 'Small';
  if (etaSquared >= 0.14) etaEffect = 'Large';
  else if (etaSquared >= 0.06) etaEffect = 'Medium';

  const interpretation = isSignificant
    ? `Statistically significant differences in ${metricName} exist across categories of "${groupVariable}" (F(${dfBetween}, ${dfWithin}) = ${Math.round(fStat * 100) / 100}, p = ${pValue < 0.001 ? '<0.001' : pValue}). At least one category has a significantly different mean.`
    : `No statistically significant difference in ${metricName} was detected across "${groupVariable}" categories (F(${dfBetween}, ${dfWithin}) = ${Math.round(fStat * 100) / 100}, p = ${pValue}). Mean values are homogeneous across groups.`;

  const businessMeaning = isSignificant
    ? `Variance in ${metricName} is meaningfully driven by ${groupVariable} (explaining ${Math.round(etaSquared * 1000) / 10}% of total variance). Tailor operational strategies to individual high-performing segments rather than using a uniform approach.`
    : `Different ${groupVariable} segments exhibit statistically comparable ${metricName} behaviors. Centralized standardization is analytically sound.`;

  return {
    testName: 'One-Way Analysis of Variance (ANOVA)',
    testedVariables: [groupVariable, metricName],
    hypothesis: {
      nullHypothesis: `All ${groupVariable} groups have identical population mean ${metricName} (μ1 = μ2 = ... = μk).`,
      alternativeHypothesis: `At least one ${groupVariable} group mean is statistically different from the others.`
    },
    statisticName: 'F-Statistic',
    statisticValue: Math.round(fStat * 1000) / 1000,
    pValue,
    degreesOfFreedom: dfBetween,
    isSignificant,
    significanceLevel: alpha,
    effectSize: {
      name: 'Eta-Squared (η²)',
      value: Math.round(etaSquared * 1000) / 1000,
      interpretation: `${etaEffect} effect (${Math.round(etaSquared * 100)}% variance explained)`
    },
    nonParametricAlternative: 'Kruskal-Wallis H Test',
    postHocAnalysis: isSignificant ? 'Post-hoc Tukey HSD recommended to isolate pairwise category differences.' : undefined,
    interpretation,
    businessMeaning,
    tableData: {
      headers: ['Category', 'N', 'Mean', 'Variance', 'Std Dev'],
      rows: groupStats.map(g => [
        g.name,
        g.n,
        Math.round(g.mean * 100) / 100,
        Math.round(g.variance * 100) / 100,
        Math.round(Math.sqrt(g.variance) * 100) / 100
      ])
    }
  };
}

/**
 * 5. Pearson's Chi-Square Test of Independence
 */
export function runChiSquareTest(
  rows: Record<string, any>[],
  col1: string,
  col2: string,
  alpha = 0.05
): StatisticalTestResult {
  const observed: Record<string, Record<string, number>> = {};
  const col1Values = new Set<string>();
  const col2Values = new Set<string>();

  for (const row of rows) {
    const v1 = String(row[col1] ?? 'Unknown').trim();
    const v2 = String(row[col2] ?? 'Unknown').trim();
    if (!v1 || !v2) continue;

    col1Values.add(v1);
    col2Values.add(v2);

    if (!observed[v1]) observed[v1] = {};
    observed[v1][v2] = (observed[v1][v2] || 0) + 1;
  }

  const rLabels = Array.from(col1Values);
  const cLabels = Array.from(col2Values);

  if (rLabels.length < 2 || cLabels.length < 2) {
    throw new Error('Chi-Square test requires both categorical columns to have at least 2 distinct categories.');
  }

  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const r of rLabels) {
    rowTotals[r] = 0;
    for (const c of cLabels) {
      const count = observed[r]?.[c] || 0;
      rowTotals[r] += count;
      colTotals[c] = (colTotals[c] || 0) + count;
      grandTotal += count;
    }
  }

  let chi2 = 0;
  let smallExpectedCount = 0;
  const totalCells = rLabels.length * cLabels.length;

  for (const r of rLabels) {
    for (const c of cLabels) {
      const o = observed[r]?.[c] || 0;
      const e = (rowTotals[r] * colTotals[c]) / grandTotal;
      if (e < 5) smallExpectedCount++;
      if (e > 0) {
        chi2 += Math.pow(o - e, 2) / e;
      }
    }
  }

  const df = (rLabels.length - 1) * (cLabels.length - 1);
  const pValApprox = chiSquarePValue(chi2, df);
  const pValue = Math.min(1, Math.max(0.0001, Math.round(pValApprox * 10000) / 10000));
  const isSignificant = pValue < alpha;

  // Cramer's V effect size
  const minDim = Math.min(rLabels.length - 1, cLabels.length - 1);
  const cramersV = minDim > 0 && grandTotal > 0 ? Math.sqrt(chi2 / (grandTotal * minDim)) : 0;
  let vEffect = 'Weak';
  if (cramersV >= 0.35) vEffect = 'Strong';
  else if (cramersV >= 0.15) vEffect = 'Moderate';

  const assumptions: AssumptionCheck[] = [
    {
      assumption: 'Expected Cell Frequencies (E ≥ 5)',
      status: smallExpectedCount === 0 ? 'PASSED' : smallExpectedCount / totalCells < 0.2 ? 'WARNING' : 'VIOLATED',
      evidence: `${smallExpectedCount} of ${totalCells} cells (${Math.round((smallExpectedCount / totalCells) * 100)}%) have expected frequencies < 5.`,
      recommendation: smallExpectedCount === 0 ? 'Chi-square asymptotic distribution is reliable.' : "Consider Fisher's Exact Test or collapsing rare categories."
    }
  ];

  const interpretation = isSignificant
    ? `There is a statistically significant relationship between "${col1}" and "${col2}" (χ² = ${Math.round(chi2 * 100) / 100}, df = ${df}, p = ${pValue < 0.001 ? '<0.001' : pValue}). The categorical distributions are dependent.`
    : `No statistically significant association between "${col1}" and "${col2}" was found (χ² = ${Math.round(chi2 * 100) / 100}, df = ${df}, p = ${pValue}). The two categorical dimensions are independent.`;

  const businessMeaning = isSignificant
    ? `Customer or operational behavior in ${col1} is strongly associated with outcomes in ${col2} (Cramér's V = ${Math.round(cramersV * 100) / 100}, ${vEffect} association). Cross-segment targeting strategies are analytically justified.`
    : `The distribution of ${col2} is consistent across all ${col1} cohorts. Do not segment strategic campaigns along this combination.`;

  return {
    testName: "Pearson's Chi-Square Test of Independence",
    testedVariables: [col1, col2],
    hypothesis: {
      nullHypothesis: `Variables "${col1}" and "${col2}" are statistically independent.`,
      alternativeHypothesis: `Variables "${col1}" and "${col2}" are statistically dependent (associated).`
    },
    statisticName: 'Chi-Square (χ²)',
    statisticValue: Math.round(chi2 * 1000) / 1000,
    pValue,
    degreesOfFreedom: df,
    isSignificant,
    significanceLevel: alpha,
    effectSize: {
      name: "Cramér's V",
      value: Math.round(cramersV * 1000) / 1000,
      interpretation: `${vEffect} association`
    },
    assumptions,
    interpretation,
    businessMeaning,
    tableData: {
      headers: [col1, ...cLabels, 'Total'],
      rows: rLabels.map(r => [
        r,
        ...cLabels.map(c => observed[r]?.[c] || 0),
        rowTotals[r]
      ])
    }
  };
}

/**
 * 6. Non-Parametric Mann-Whitney U Test (Wilcoxon Rank-Sum)
 */
export function runMannWhitneyUTest(
  group1Values: number[],
  group2Values: number[],
  group1Name: string,
  group2Name: string,
  metricName: string,
  alpha = 0.05
): StatisticalTestResult {
  const clean1 = group1Values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
  const clean2 = group2Values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));

  const n1 = clean1.length;
  const n2 = clean2.length;

  if (n1 < 3 || n2 < 3) {
    throw new Error('Both groups must contain at least 3 valid observations for Mann-Whitney U.');
  }

  // Combine and rank
  const combined = [
    ...clean1.map(val => ({ val, group: 1 })),
    ...clean2.map(val => ({ val, group: 2 }))
  ].sort((a, b) => a.val - b.val);

  let rankSum1 = 0;
  combined.forEach((item, idx) => {
    const rank = idx + 1;
    if (item.group === 1) rankSum1 += rank;
  });

  const u1 = rankSum1 - (n1 * (n1 + 1)) / 2;
  const u2 = n1 * n2 - u1;
  const uStat = Math.min(u1, u2);

  // Normal approximation for large samples
  const meanU = (n1 * n2) / 2;
  const stdU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12) || 1;
  const z = (uStat - meanU) / stdU;
  const pValApprox = 2 * (1 - 0.5 * (1 + Math.sign(Math.abs(z)) * Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI))));
  const pValue = Math.min(1, Math.max(0.0001, Math.round(pValApprox * 10000) / 10000));
  const isSignificant = pValue < alpha;

  // Rank-Biserial correlation effect size
  const rankBiserial = 1 - (2 * uStat) / (n1 * n2);

  return {
    testName: 'Mann-Whitney U Test (Wilcoxon Rank-Sum)',
    testedVariables: [group1Name, group2Name, metricName],
    hypothesis: {
      nullHypothesis: `The distributions of ${metricName} are identical across ${group1Name} and ${group2Name}.`,
      alternativeHypothesis: `One group has systematically larger values of ${metricName} than the other.`
    },
    statisticName: 'U-Statistic',
    statisticValue: Math.round(uStat),
    pValue,
    isSignificant,
    significanceLevel: alpha,
    effectSize: {
      name: 'Rank-Biserial Correlation (r_rb)',
      value: Math.round(rankBiserial * 1000) / 1000,
      interpretation: `${Math.abs(rankBiserial) >= 0.5 ? 'Large' : Math.abs(rankBiserial) >= 0.3 ? 'Medium' : 'Small'} effect`
    },
    interpretation: isSignificant
      ? `Non-parametric rank sum test indicates a statistically significant stochastic difference in ${metricName} between "${group1Name}" (median: ${ss.median(clean1)}) and "${group2Name}" (median: ${ss.median(clean2)}) (U = ${uStat}, z = ${z.toFixed(2)}, p = ${pValue < 0.001 ? '<0.001' : pValue}).`
      : `No statistically significant difference in rank distributions was found between "${group1Name}" and "${group2Name}" (U = ${uStat}, p = ${pValue}).`,
    businessMeaning: isSignificant
      ? `Ranked medians confirm a persistent ordinal shift between groups without relying on normal distribution assumptions.`
      : `Median rankings are comparable across both operational segments.`,
    tableData: {
      headers: ['Group Name', 'N', 'Median', 'IQR', 'Rank Sum'],
      rows: [
        [group1Name, n1, ss.median(clean1), Math.round((ss.quantile(clean1, 0.75) - ss.quantile(clean1, 0.25)) * 100) / 100, Math.round(rankSum1)],
        [group2Name, n2, ss.median(clean2), Math.round((ss.quantile(clean2, 0.75) - ss.quantile(clean2, 0.25)) * 100) / 100, Math.round(n1 * n2 + (n1 * (n1 + 1)) / 2 + (n2 * (n2 + 1)) / 2 - rankSum1)]
      ]
    }
  };
}
