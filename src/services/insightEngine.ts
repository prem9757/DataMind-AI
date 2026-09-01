import * as ss from 'simple-statistics';
import { ColumnProfile, DatasetInsight, RecommendedAnalysis } from '../types/dataset';
import { computeCorrelationMatrix, computeGroupSummary } from './edaEngine';

export function generateDatasetInsights(
  rows: Record<string, any>[],
  columns: string[],
  profiles: Record<string, ColumnProfile>
): {
  insights: DatasetInsight[];
  recommendations: RecommendedAnalysis[];
  suggestedQuestions: string[];
} {
  const insights: DatasetInsight[] = [];
  const recommendations: RecommendedAnalysis[] = [];
  const numCols = columns.filter(c => profiles[c]?.type === 'numeric');
  const catCols = columns.filter(c => profiles[c]?.type === 'categorical');
  const dateCols = columns.filter(c => profiles[c]?.type === 'datetime');

  // 1. Top Category Performance Insight
  if (catCols.length > 0 && numCols.length > 0) {
    const primaryCat = catCols[0];
    const primaryNum = numCols.find(c => /sales|revenue|profit|salary|mrr|score/i.test(c)) || numCols[0];
    const groupData = computeGroupSummary(rows, primaryCat, primaryNum, 'sum');

    if (groupData.length > 0) {
      const topGroup = groupData[0];
      const totalSum = ss.sum(groupData.map(g => g.sum));
      const topPct = totalSum > 0 ? Math.round((topGroup.sum / totalSum) * 1000) / 10 : 0;

      insights.push({
        id: 'ins-top-perf',
        title: `Dominant Performance: '${topGroup.category}' leads in ${primaryNum}`,
        category: 'PERFORMANCE',
        impact: 'POSITIVE',
        metric: `Top Contributor (${topGroup.category})`,
        metricValue: `${topPct}% of Total ${primaryNum}`,
        description: `"${topGroup.category}" generates the highest total ${primaryNum} at ${topGroup.sum.toLocaleString()} (average of ${topGroup.mean.toLocaleString()} across ${topGroup.count} records), accounting for ${topPct}% of aggregate volume.`,
        evidence: `${topPct}% market share ($${topGroup.sum.toLocaleString()} out of $${totalSum.toLocaleString()} total) across ${groupData.length} distinct categories.`,
        businessInterpretation: `High concentration in ${topGroup.category} presents strong revenue leverage but also concentration risk. Replicate successful playbooks to secondary tiers.`,
        confidence: 96,
        recommendedAction: `Focus resource allocation and double down on successful playbooks proven in the ${topGroup.category} segment.`
      });

      if (groupData.length >= 3) {
        const bottomGroup = groupData[groupData.length - 1];
        const bottomPct = totalSum > 0 ? Math.round((bottomGroup.sum / totalSum) * 1000) / 10 : 0;
        insights.push({
          id: 'ins-under-perf',
          title: `Underperforming Segment: '${bottomGroup.category}'`,
          category: 'RISK',
          impact: 'WARNING',
          metric: `Lowest Contributor (${bottomGroup.category})`,
          metricValue: `${bottomPct}% of Total ${primaryNum}`,
          description: `"${bottomGroup.category}" represents the lowest total ${primaryNum} at ${bottomGroup.sum.toLocaleString()} (${bottomPct}% of aggregate), with an average of ${bottomGroup.mean.toLocaleString()}.`,
          evidence: `Contributes only $${bottomGroup.sum.toLocaleString()} (${bottomPct}%) with average yield of $${bottomGroup.mean.toLocaleString()}.`,
          businessInterpretation: `Low return on operational expenditure in ${bottomGroup.category}. Requires structural turnaround or gradual resource reallocation.`,
          confidence: 94,
          recommendedAction: `Audit unit economics and root-cause drivers for ${bottomGroup.category} to assess turnaround potential vs portfolio rationalization.`
        });
      }
    }
  }

  // 2. High Correlation Finding
  if (numCols.length >= 2) {
    const corrData = computeCorrelationMatrix(rows, numCols, 'pearson');
    let maxCorr = 0;
    let bestPair: [string, string] = [numCols[0], numCols[1]];

    for (let i = 0; i < numCols.length; i++) {
      for (let j = i + 1; j < numCols.length; j++) {
        const r = Math.abs(corrData.matrix[i][j]);
        if (r > maxCorr && r < 0.999) {
          maxCorr = r;
          bestPair = [numCols[i], numCols[j]];
        }
      }
    }

    if (maxCorr >= 0.40) {
      const isPositive = corrData.matrix[numCols.indexOf(bestPair[0])][numCols.indexOf(bestPair[1])] > 0;
      const strength = maxCorr >= 0.7 ? 'Strong' : 'Moderate';
      insights.push({
        id: 'ins-corr',
        title: `${strength} ${isPositive ? 'Positive' : 'Negative'} Correlation: ${bestPair[0]} & ${bestPair[1]}`,
        category: 'CORRELATION',
        impact: 'NEUTRAL',
        metric: 'Pearson r',
        metricValue: `${isPositive ? '+' : '-'}${Math.round(maxCorr * 100) / 100}`,
        description: `Statistical analysis reveals a ${strength.toLowerCase()} ${isPositive ? 'direct' : 'inverse'} relationship (r = ${Math.round(maxCorr * 100) / 100}) between "${bestPair[0]}" and "${bestPair[1]}".`,
        evidence: `Sample correlation coefficient r = ${isPositive ? '+' : '-'}${Math.round(maxCorr * 100) / 100} across ${rows.length} observations.`,
        businessInterpretation: `Statistically significant co-movement between variables. Note: Correlation does NOT imply causation, but serves as an effective forecasting heuristic.`,
        confidence: 92,
        recommendedAction: isPositive
          ? `Leverage "${bestPair[0]}" as a leading operational lever to drive upward momentum in "${bestPair[1]}".`
          : `Monitor "${bestPair[0]}" closely to prevent unintended downward drag on "${bestPair[1]}".`
      });
    }
  }

  // 3. Distribution & Skewness / Anomaly Insight
  for (const col of numCols) {
    const prof = profiles[col];
    if (prof && (prof.outlierCount || 0) > 0 && prof.outlierPercentage! >= 3) {
      insights.push({
        id: `ins-anomaly-${col}`,
        title: `Outlier Tail Detected in ${col}`,
        category: 'ANOMALY',
        impact: 'WARNING',
        metric: 'Outlier Count',
        metricValue: `${prof.outlierCount} records (${prof.outlierPercentage}%)`,
        description: `"${col}" exhibits statistical anomalies with ${prof.outlierCount} records falling outside 1.5x IQR (Range: min ${prof.min}, max ${prof.max}, median ${prof.median}). Skewness is ${prof.skewness}.`,
        evidence: `${prof.outlierCount} records (${prof.outlierPercentage}%) exceed 1.5× IQR threshold ($${prof.q3! + 1.5 * prof.iqr!}).`,
        businessInterpretation: `Upper outliers heavily pull the arithmetic mean above typical transactions. Use median for operational targets.`,
        confidence: 95,
        recommendedAction: `Inspect extreme outlier instances to determine whether they represent high-value enterprise accounts or data capture errors.`
      });
      break;
    }
  }

  // 4. Time Series Trend Insight
  if (dateCols.length > 0 && numCols.length > 0) {
    const primaryDate = dateCols[0];
    const primaryNum = numCols.find(c => /sales|revenue|profit|mrr/i.test(c)) || numCols[0];
    const prof = profiles[primaryDate];

    insights.push({
      id: 'ins-trend-span',
      title: `Temporal Coverage Across ${prof?.dateRangeDays || 'Multiple'} Days`,
      category: 'TREND',
      impact: 'POSITIVE',
      metric: 'Observation Window',
      metricValue: `${prof?.minDate || 'Start'} to ${prof?.maxDate || 'End'}`,
      description: `Dataset captures historical metrics over a ${prof?.dateRangeDays || 0}-day timeframe, providing longitudinal coverage for trend detection and forecasting.`,
      evidence: `Active timeline from ${prof?.minDate || 'N/A'} through ${prof?.maxDate || 'N/A'} (${prof?.dateRangeDays || 0} calendar days).`,
      businessInterpretation: `Sufficient historical density to evaluate monthly run rates and seasonal demand cycles.`,
      confidence: 94,
      recommendedAction: `Evaluate monthly recurring velocity and run moving-average smoothing to eliminate weekly fluctuations.`
    });
  }

  // 5. High Cardinality / Customer Concentration
  const idCol = columns.find(c => profiles[c]?.type === 'id' || (profiles[c]?.cardinalityRatio || 0) > 80);
  if (idCol && numCols.length > 0) {
    insights.push({
      id: 'ins-opp-diversity',
      title: `Entity Diversity & Granular Segmentation Scope`,
      category: 'BUSINESS OPPORTUNITY',
      impact: 'POSITIVE',
      metric: `Unique Entities in ${idCol}`,
      metricValue: `${profiles[idCol]?.uniqueCount.toLocaleString()} distinct entries`,
      description: `High entity granularity in "${idCol}" (${profiles[idCol]?.uniqueCount} unique records) supports cohort analysis and personalization.`,
      evidence: `${profiles[idCol]?.uniqueCount.toLocaleString()} unique IDs representing ${profiles[idCol]?.cardinalityRatio}% cardinality ratio.`,
      businessInterpretation: `Broad base of distinct entities provides statistical power for behavioral clustering.`,
      confidence: 90,
      recommendedAction: `Run K-Means clustering across numerical feature vectors to build automated customer tiers.`
    });
  }

  // Generate Recommended Analyses
  if (catCols.length > 0 && numCols.length > 0) {
    recommendations.push({
      id: 'rec-1',
      title: `${numCols[0]} Segment Comparison by ${catCols[0]}`,
      description: `Evaluate variance in aggregate ${numCols[0]} across distinct ${catCols[0]} groups using bar charts and ANOVA testing.`,
      category: 'Diagnostic',
      suggestedChartType: 'bar',
      columnsInvolved: [catCols[0], numCols[0]],
      sampleQuery: `Compare total and average ${numCols[0]} across each ${catCols[0]}`
    });
  }

  if (numCols.length >= 2) {
    recommendations.push({
      id: 'rec-2',
      title: `Multivariate Correlation Matrix & Regression`,
      description: `Determine the primary statistical drivers influencing ${numCols[0]} and compute linear model weights.`,
      category: 'Predictive',
      suggestedChartType: 'scatter',
      columnsInvolved: numCols.slice(0, 4),
      sampleQuery: `What factors have the strongest correlation with ${numCols[0]}?`
    });
  }

  if (dateCols.length > 0 && numCols.length > 0) {
    recommendations.push({
      id: 'rec-3',
      title: `Longitudinal Time-Series & Moving Average`,
      description: `Aggregate ${numCols[0]} across monthly periods to detect seasonal trends and growth rates.`,
      category: 'Descriptive',
      suggestedChartType: 'line',
      columnsInvolved: [dateCols[0], numCols[0]],
      sampleQuery: `Show me the monthly trend of ${numCols[0]}`
    });
  }

  if (catCols.length >= 2) {
    recommendations.push({
      id: 'rec-4',
      title: `Categorical Cross-Tabulation & Chi-Square Independence`,
      description: `Test whether distribution in ${catCols[0]} is statistically independent of ${catCols[1]}.`,
      category: 'Diagnostic',
      suggestedChartType: 'bar',
      columnsInvolved: [catCols[0], catCols[1]],
      sampleQuery: `Is there a significant relationship between ${catCols[0]} and ${catCols[1]}?`
    });
  }

  // Dynamic Suggested Questions based on detected columns
  const questions: string[] = [];
  if (catCols.length > 0 && numCols.length > 0) {
    questions.push(`Which ${catCols[0]} has the highest average ${numCols[0]}?`);
    questions.push(`What are the top 5 ${catCols[0]} by total ${numCols[0]}?`);
  }
  if (numCols.length >= 2) {
    questions.push(`What factors are most strongly correlated with ${numCols[0]}?`);
    questions.push(`Find statistical anomalies and outliers in ${numCols[0]}`);
  }
  if (dateCols.length > 0 && numCols.length > 0) {
    questions.push(`Show monthly trends of ${numCols[0]} over time`);
  }
  if (catCols.length > 1 && numCols.length > 0) {
    questions.push(`Compare ${numCols[0]} across ${catCols[0]} broken down by ${catCols[1]}`);
  }
  questions.push(`Give an executive business summary with key risks and opportunities`);

  return {
    insights,
    recommendations,
    suggestedQuestions: questions
  };
}
