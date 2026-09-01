// ============================================================================
// PHASE 8: CONTROLLED AGENT TOOL REGISTRY
// ============================================================================

import { AgentToolDefinition, AgentExecutionContext, AgentToolResult, ConfidenceLevel } from '../types/agent';
import { runTwoSampleTTest, runOneWayANOVA, runChiSquareTest, computeDetailedDescriptiveStats } from './statsEngine';
import { trainMachineLearningModel, assessMLReadiness } from './mlEngine';
import { computeCorrelationMatrix } from './edaEngine';
import { generateDatasetInsights } from './insightEngine';
import { SecurityHardener } from './securityHardener';

class AgentToolRegistry {
  private tools: Map<string, AgentToolDefinition> = new Map();

  constructor() {
    this.registerCoreTools();
  }

  public registerTool(tool: AgentToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): AgentToolDefinition | undefined {
    return this.tools.get(name);
  }

  public listTools(): AgentToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getToolSchemas(): any[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      category: t.category,
      description: t.description,
      parameters: t.parameters,
      permissionLevel: t.permissionLevel
    }));
  }

  private registerCoreTools() {
    // ------------------------------------------------------------------------
    // 1. DATA TOOLS
    // ------------------------------------------------------------------------

    // get_dataset_schema
    this.registerTool({
      name: 'get_dataset_schema',
      category: 'DATA',
      description: 'Returns column names, detected data types, null counts, and row counts of the dataset.',
      permissionLevel: 'SAFE_READ',
      parameters: [],
      outputDescription: 'List of column schemas with inferred data types and cardinalities.',
      execute: async (_, ctx): Promise<AgentToolResult> => {
        const start = performance.now();
        const schema = ctx.columns.map(col => {
          const prof = ctx.profiles[col] || {};
          return {
            column: col,
            type: prof.type || typeof (ctx.rows[0]?.[col]),
            distinctValues: prof.distinctCount ?? 0,
            missingCount: prof.nullCount ?? 0,
            missingPercentage: prof.nullPercentage ? `${prof.nullPercentage.toFixed(1)}%` : '0%'
          };
        });

        return {
          success: true,
          data: { totalRows: ctx.rows.length, columns: schema },
          summary: `Dataset contains ${ctx.rows.length} rows and ${ctx.columns.length} columns.`,
          executionTimeMs: Math.round(performance.now() - start)
        };
      }
    });

    // get_dataset_profile
    this.registerTool({
      name: 'get_dataset_profile',
      category: 'DATA',
      description: 'Returns in-depth statistical profiles for all or specific columns.',
      permissionLevel: 'SAFE_READ',
      parameters: [
        { name: 'columns', type: 'array', required: false, description: 'Optional list of columns to filter profile for.' }
      ],
      outputDescription: 'Detailed profile of numerical moments, quantiles, and category distributions.',
      execute: async (params, ctx): Promise<AgentToolResult> => {
        const start = performance.now();
        const targetCols = params.columns && Array.isArray(params.columns) && params.columns.length > 0
          ? params.columns.filter((c: string) => ctx.columns.includes(c))
          : ctx.columns;

        const profilesResult: Record<string, any> = {};
        for (const col of targetCols) {
          profilesResult[col] = ctx.profiles[col] || {};
        }

        return {
          success: true,
          data: profilesResult,
          summary: `Profiled ${targetCols.length} target columns.`,
          executionTimeMs: Math.round(performance.now() - start)
        };
      }
    });

    // get_quality_report
    this.registerTool({
      name: 'get_quality_report',
      category: 'DATA',
      description: 'Returns overall dataset data quality score, dimension breakdown, and detected issues.',
      permissionLevel: 'SAFE_READ',
      parameters: [],
      outputDescription: 'Quality score (0-100), issue audit list, and health breakdown.',
      execute: async (_, ctx): Promise<AgentToolResult> => {
        const start = performance.now();
        const q = ctx.quality || { score: 100, issues: [] };
        return {
          success: true,
          data: q,
          summary: `Data Quality Score: ${q.score}/100 with ${q.issues?.length || 0} issues detected.`,
          observationCandidate: {
            metric: 'Data Quality Score',
            value: q.score,
            summary: `Overall dataset health score is ${q.score}/100 with ${q.issues?.length || 0} identified data anomalies.`,
            sourceTool: 'get_quality_report',
            confidence: 'HIGH'
          },
          executionTimeMs: Math.round(performance.now() - start)
        };
      }
    });

    // get_column_statistics
    this.registerTool({
      name: 'get_column_statistics',
      category: 'DATA',
      description: 'Computes descriptive statistics (mean, std, min, q1, median, q3, max, skewness) for a numeric column.',
      permissionLevel: 'SAFE_READ',
      parameters: [
        { name: 'column', type: 'string', required: true, description: 'The numeric column name.' }
      ],
      outputDescription: 'Comprehensive descriptive statistical metrics.',
      execute: async (params, ctx): Promise<AgentToolResult> => {
        const start = performance.now();
        const col = params.column;
        if (!col || !ctx.columns.includes(col)) {
          return { success: false, data: null, summary: `Column ${col} not found`, error: `Column ${col} does not exist`, executionTimeMs: 0 };
        }

        const values = ctx.rows.map(r => Number(r[col])).filter(v => !isNaN(v) && v !== null && isFinite(v));
        if (values.length === 0) {
          return { success: false, data: null, summary: `Column ${col} has no valid numeric values`, error: 'No numeric values', executionTimeMs: 0 };
        }

        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const sorted = [...values].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const min = sorted[0];
        const max = sorted[sorted.length - 1];

        return {
          success: true,
          data: { column: col, count: values.length, mean, median, min, max },
          summary: `${col}: Mean = ${mean.toFixed(2)}, Median = ${median.toFixed(2)}, Min = ${min}, Max = ${max}`,
          observationCandidate: {
            metric: `${col} Average`,
            dimension: col,
            value: mean,
            summary: `${col} has a mean of ${mean.toFixed(2)} (median ${median.toFixed(2)}).`,
            sourceTool: 'get_column_statistics',
            confidence: 'HIGH'
          },
          executionTimeMs: Math.round(performance.now() - start)
        };
      }
    });

    // filter_dataset
    this.registerTool({
      name: 'filter_dataset',
      category: 'DATA',
      description: 'Filters rows based on column conditions (equals, greater_than, less_than, in, between).',
      permissionLevel: 'SAFE_READ',
      parameters: [
        { name: 'column', type: 'string', required: true, description: 'Column to filter on' },
        { name: 'operator', type: 'string', required: true, description: 'eq | gt | gte | lt | lte | in | contains' },
        { name: 'value', type: 'string', required: true, description: 'Target value or comma-separated values' }
      ],
      outputDescription: 'Subset of rows meeting filter criteria.',
      execute: async (params, ctx): Promise<AgentToolResult> => {
        const start = performance.now();
        const { column, operator, value } = params;
        if (!ctx.columns.includes(column)) {
          return { success: false, data: null, summary: `Column ${column} not found`, error: 'Invalid column', executionTimeMs: 0 };
        }

        const filtered = ctx.rows.filter(row => {
          const val = row[column];
          if (val === null || val === undefined) return false;

          switch (operator) {
            case 'eq': return String(val).toLowerCase() === String(value).toLowerCase();
            case 'gt': return Number(val) > Number(value);
            case 'gte': return Number(val) >= Number(value);
            case 'lt': return Number(val) < Number(value);
            case 'lte': return Number(val) <= Number(value);
            case 'contains': return String(val).toLowerCase().includes(String(value).toLowerCase());
            case 'in': {
              const items = String(value).split(',').map(s => s.trim().toLowerCase());
              return items.includes(String(val).toLowerCase());
            }
            default: return true;
          }
        });

        return {
          success: true,
          data: { matchedCount: filtered.length, sample: filtered.slice(0, 10) },
          summary: `Filter on ${column} (${operator} '${value}') yielded ${filtered.length} rows (${((filtered.length / ctx.rows.length) * 100).toFixed(1)}% of dataset).`,
          executionTimeMs: Math.round(performance.now() - start)
        };
      }
    });

    // aggregate_dataset
    this.registerTool({
      name: 'aggregate_dataset',
      category: 'DATA',
      description: 'Groups dataset by one or more dimension columns and computes aggregations (sum, mean, count, min, max) on metric columns.',
      permissionLevel: 'SAFE_READ',
      parameters: [
        { name: 'groupBy', type: 'string', required: true, description: 'Categorical column to group by' },
        { name: 'metric', type: 'string', required: true, description: 'Numeric column to aggregate' },
        { name: 'aggregation', type: 'string', required: false, description: 'sum | mean | count | min | max', default: 'sum' }
      ],
      outputDescription: 'Grouped aggregation table sorted in descending order.',
      execute: async (params, ctx): Promise<AgentToolResult> => {
        const start = performance.now();
        const { groupBy, metric, aggregation = 'sum' } = params;

        if (!ctx.columns.includes(groupBy)) {
          return { success: false, data: null, summary: `Group column ${groupBy} not found`, error: 'Invalid groupBy column', executionTimeMs: 0 };
        }
        if (!ctx.columns.includes(metric)) {
          return { success: false, data: null, summary: `Metric column ${metric} not found`, error: 'Invalid metric column', executionTimeMs: 0 };
        }

        const groups: Record<string, number[]> = {};
        for (const r of ctx.rows) {
          const key = String(r[groupBy] ?? 'Unknown');
          const num = Number(r[metric]);
          if (!groups[key]) groups[key] = [];
          if (!isNaN(num) && isFinite(num)) {
            groups[key].push(num);
          }
        }

        const results = Object.entries(groups).map(([dim, nums]) => {
          let aggVal = 0;
          if (nums.length > 0) {
            if (aggregation === 'sum') aggVal = nums.reduce((a, b) => a + b, 0);
            else if (aggregation === 'mean') aggVal = nums.reduce((a, b) => a + b, 0) / nums.length;
            else if (aggregation === 'count') aggVal = nums.length;
            else if (aggregation === 'min') aggVal = Math.min(...nums);
            else if (aggregation === 'max') aggVal = Math.max(...nums);
          }
          return { [groupBy]: dim, [metric]: aggVal, count: nums.length };
        }).sort((a, b) => (b[metric] as number) - (a[metric] as number));

        const topItem = results[0];
        const bottomItem = results[results.length - 1];

        return {
          success: true,
          data: results,
          summary: `Aggregated ${metric} (${aggregation}) by ${groupBy}: ${results.length} categories. Top: ${topItem?.[groupBy]} (${topItem?.[metric]?.toLocaleString()}), Bottom: ${bottomItem?.[groupBy]} (${bottomItem?.[metric]?.toLocaleString()}).`,
          observationCandidate: {
            metric: `${metric} by ${groupBy}`,
            dimension: groupBy,
            segment: String(topItem?.[groupBy] || ''),
            value: Number(topItem?.[metric] || 0),
            summary: `In ${groupBy}, ${topItem?.[groupBy]} led ${metric} (${aggregation}) at ${Number(topItem?.[metric]).toLocaleString()}, compared to ${bottomItem?.[groupBy]} at ${Number(bottomItem?.[metric]).toLocaleString()}.`,
            sourceTool: 'aggregate_dataset',
            confidence: 'HIGH'
          },
          visualCandidate: {
            title: `${metric} by ${groupBy}`,
            type: 'bar',
            chartConfig: {
              id: `chart-agg-${Date.now()}`,
              type: 'bar',
              xAxis: groupBy,
              yAxis: metric,
              title: `${aggregation.toUpperCase()} of ${metric} by ${groupBy}`
            },
            caption: `Categorical breakdown showing distribution of ${metric} across ${groupBy}.`
          },
          executionTimeMs: Math.round(performance.now() - start)
        };
      }
    });

    // ------------------------------------------------------------------------
    // 2. EDA TOOLS
    // ------------------------------------------------------------------------

    // run_eda
    this.registerTool({
      name: 'run_eda',
      category: 'EDA',
      description: 'Generates automated exploratory data analysis summary with key insights and heuristics.',
      permissionLevel: 'SAFE_READ',
      parameters: [],
      outputDescription: 'Key statistical insights, primary drivers, and distributions.',
      execute: async (_, ctx): Promise<AgentToolResult> => {
        const start = performance.now();
        const insightsRes = generateDatasetInsights(ctx.rows, ctx.columns, ctx.profiles);
        const count = insightsRes?.insights?.length || 0;
        return {
          success: true,
          data: insightsRes,
          summary: `Identified ${count} primary analytical insights.`,
          executionTimeMs: Math.round(performance.now() - start)
        };
      }
    });

    // correlation_analysis
    this.registerTool({
      name: 'correlation_analysis',
      category: 'EDA',
      description: 'Computes Pearson correlation matrix across all numeric features and identifies strongest linear associations.',
      permissionLevel: 'SAFE_READ',
      parameters: [
        { name: 'threshold', type: 'number', required: false, description: 'Minimum absolute correlation threshold (0.0 to 1.0)', default: 0.4 }
      ],
      outputDescription: 'Pairwise correlation matrix and ranked high-correlation pairs.',
      execute: async (params, ctx): Promise<AgentToolResult> => {
        const start = performance.now();
        const thresh = params.threshold ?? 0.4;
        const matrix = computeCorrelationMatrix(ctx.rows, ctx.columns);

        const strongPairs: { col1: string; col2: string; correlation: number }[] = [];
        for (let i = 0; i < matrix.columns.length; i++) {
          for (let j = i + 1; j < matrix.columns.length; j++) {
            const r = matrix.matrix[i][j];
            if (Math.abs(r) >= thresh && Math.abs(r) < 0.9999) {
              strongPairs.push({ col1: matrix.columns[i], col2: matrix.columns[j], correlation: r });
            }
          }
        }
        strongPairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

        const topPair = strongPairs[0];
        const summary = topPair
          ? `Found ${strongPairs.length} significant correlation pairs (|r| ≥ ${thresh}). Strongest: ${topPair.col1} & ${topPair.col2} (r = ${topPair.correlation.toFixed(2)}).`
          : `No pairs exceeded correlation threshold of ${thresh}.`;

        return {
          success: true,
          data: { matrix, strongPairs },
          summary,
          observationCandidate: topPair ? {
            metric: `Correlation: ${topPair.col1} vs ${topPair.col2}`,
            value: topPair.correlation,
            summary: `Strong linear association detected between ${topPair.col1} and ${topPair.col2} (Pearson r = ${topPair.correlation.toFixed(2)}).`,
            sourceTool: 'correlation_analysis',
            confidence: 'HIGH'
          } : undefined,
          executionTimeMs: Math.round(performance.now() - start)
        };
      }
    });

    // trend_analysis
    this.registerTool({
      name: 'trend_analysis',
      category: 'EDA',
      description: 'Analyzes a metric over a temporal/date column, detecting growth rates, peak periods, and troughs.',
      permissionLevel: 'SAFE_READ',
      parameters: [
        { name: 'dateColumn', type: 'string', required: true, description: 'Temporal date or timestamp column' },
        { name: 'metricColumn', type: 'string', required: true, description: 'Numeric metric to track' }
      ],
      outputDescription: 'Chronological time series points, period-over-period percentage delta, and overall trend direction.',
      execute: async (params, ctx): Promise<AgentToolResult> => {
        const start = performance.now();
        const { dateColumn, metricColumn } = params;

        if (!ctx.columns.includes(dateColumn) || !ctx.columns.includes(metricColumn)) {
          return { success: false, data: null, summary: 'Invalid date or metric column', error: 'Column not found', executionTimeMs: 0 };
        }

        const temporalMap: Record<string, number[]> = {};
        for (const r of ctx.rows) {
          const rawDate = r[dateColumn];
          if (!rawDate) continue;
          const dateStr = String(rawDate).substring(0, 10);
          const num = Number(r[metricColumn]);
          if (!temporalMap[dateStr]) temporalMap[dateStr] = [];
          if (!isNaN(num) && isFinite(num)) temporalMap[dateStr].push(num);
        }

        const sortedDates = Object.keys(temporalMap).sort();
        const timeSeries = sortedDates.map(d => {
          const vals = temporalMap[d];
          const sum = vals.reduce((a, b) => a + b, 0);
          const avg = vals.length > 0 ? sum / vals.length : 0;
          return { date: d, sum, avg, count: vals.length };
        });

        if (timeSeries.length < 2) {
          return { success: false, data: null, summary: 'Insufficient temporal data points', error: 'Too few time steps', executionTimeMs: 0 };
        }

        const firstPt = timeSeries[0];
        const lastPt = timeSeries[timeSeries.length - 1];
        const totalDelta = lastPt.sum - firstPt.sum;
        const pctDelta = firstPt.sum !== 0 ? (totalDelta / firstPt.sum) * 100 : 0;

        return {
          success: true,
          data: { timeSeries, start: firstPt, end: lastPt, pctDelta },
          summary: `Time series across ${timeSeries.length} points: ${metricColumn} moved from ${firstPt.sum.toLocaleString()} (${firstPt.date}) to ${lastPt.sum.toLocaleString()} (${lastPt.date}), a change of ${pctDelta.toFixed(1)}%.`,
          observationCandidate: {
            metric: `${metricColumn} Trend`,
            value: lastPt.sum,
            comparison: {
              baselineValue: firstPt.sum,
              delta: totalDelta,
              percentDelta: pctDelta,
              baselinePeriod: firstPt.date,
              currentPeriod: lastPt.date
            },
            summary: `${metricColumn} changed by ${pctDelta.toFixed(1)}% between ${firstPt.date} and ${lastPt.date} (Baseline: ${firstPt.sum.toLocaleString()} → Current: ${lastPt.sum.toLocaleString()}).`,
            sourceTool: 'trend_analysis',
            confidence: 'HIGH'
          },
          visualCandidate: {
            title: `${metricColumn} Over Time`,
            type: 'time_series',
            chartConfig: {
              id: `chart-trend-${Date.now()}`,
              type: 'line',
              xAxis: dateColumn,
              yAxis: metricColumn,
              title: `${metricColumn} Chronological Trend`
            },
            caption: `Chronological progression of ${metricColumn} showing temporal trajectory.`
          },
          executionTimeMs: Math.round(performance.now() - start)
        };
      }
    });

    // driver_decomposition
    this.registerTool({
      name: 'driver_decomposition',
      category: 'EDA',
      description: 'Performs multi-dimensional driver analysis to identify which categories, products, or segments drove a metric change.',
      permissionLevel: 'SAFE_READ',
      parameters: [
        { name: 'dimension', type: 'string', required: true, description: 'Categorical dimension (e.g. Region, Category, Segment)' },
        { name: 'metric', type: 'string', required: true, description: 'Numeric metric (e.g. Revenue, Sales, Profit)' }
      ],
      outputDescription: 'Ranked driver table with absolute impact and percentage contribution to overall metric variation.',
      execute: async (params, ctx): Promise<AgentToolResult> => {
        const start = performance.now();
        const { dimension, metric } = params;

        if (!ctx.columns.includes(dimension) || !ctx.columns.includes(metric)) {
          return { success: false, data: null, summary: 'Invalid dimension or metric column', error: 'Column not found', executionTimeMs: 0 };
        }

        const dimMap: Record<string, number> = {};
        let totalMetric = 0;

        for (const r of ctx.rows) {
          const key = String(r[dimension] ?? 'Unknown');
          const val = Number(r[metric]);
          if (!isNaN(val) && isFinite(val)) {
            dimMap[key] = (dimMap[key] || 0) + val;
            totalMetric += val;
          }
        }

        const avgPerDim = totalMetric / (Object.keys(dimMap).length || 1);
        const drivers = Object.entries(dimMap).map(([factor, sumVal]) => {
          const delta = sumVal - avgPerDim;
          const share = totalMetric !== 0 ? (sumVal / totalMetric) * 100 : 0;
          return {
            dimension,
            factor,
            value: sumVal,
            share,
            deltaFromMean: delta,
            significance: Math.abs(share) > 25 ? 'MAJOR' : Math.abs(share) > 10 ? 'MODERATE' : 'MINOR'
          };
        }).sort((a, b) => b.value - a.value);

        const primaryDriver = drivers[0];

        return {
          success: true,
          data: { dimension, metric, totalMetric, drivers },
          summary: `Driver analysis across ${dimension}: ${primaryDriver?.factor} is the dominant contributor representing ${primaryDriver?.share.toFixed(1)}% of total ${metric}.`,
          observationCandidate: {
            metric: `${metric} Driver (${dimension})`,
            dimension,
            segment: primaryDriver?.factor,
            value: primaryDriver?.value || 0,
            summary: `Within ${dimension}, ${primaryDriver?.factor} accounts for ${primaryDriver?.share.toFixed(1)}% of aggregate ${metric} (${primaryDriver?.value.toLocaleString()}).`,
            sourceTool: 'driver_decomposition',
            confidence: 'HIGH'
          },
          executionTimeMs: Math.round(performance.now() - start)
        };
      }
    });

    // ------------------------------------------------------------------------
    // 3. STATISTICAL TOOLS
    // ------------------------------------------------------------------------

    // hypothesis_test
    this.registerTool({
      name: 'hypothesis_test',
      category: 'STATS',
      description: 'Performs statistical hypothesis testing (two-sample t-test or ANOVA).',
      permissionLevel: 'SAFE_READ',
      parameters: [
        { name: 'testType', type: 'string', required: true, description: 't_test | anova' },
        { name: 'groupColumn', type: 'string', required: true, description: 'Categorical grouping column' },
        { name: 'targetColumn', type: 'string', required: true, description: 'Numeric target variable' }
      ],
      outputDescription: 'Test statistic, p-value, effect size, and formal null hypothesis conclusion.',
      execute: async (params, ctx): Promise<AgentToolResult> => {
        const start = performance.now();
        const { groupColumn, targetColumn } = params;

        try {
          // Group numeric values by categorical groups
          const groupMap: Record<string, number[]> = {};
          for (const r of ctx.rows) {
            const g = String(r[groupColumn] ?? 'Unknown');
            const v = Number(r[targetColumn]);
            if (!isNaN(v) && isFinite(v)) {
              if (!groupMap[g]) groupMap[g] = [];
              groupMap[g].push(v);
            }
          }

          const groupKeys = Object.keys(groupMap).filter(k => groupMap[k].length >= 3);
          if (groupKeys.length < 2) {
            return {
              success: false,
              data: null,
              summary: 'Insufficient distinct groups with at least 3 samples.',
              error: 'Not enough group observations',
              executionTimeMs: Math.round(performance.now() - start)
            };
          }

          let testResult: any;
          if (groupKeys.length === 2) {
            testResult = runTwoSampleTTest(
              groupMap[groupKeys[0]],
              groupMap[groupKeys[1]],
              groupKeys[0],
              groupKeys[1],
              targetColumn
            );
          } else {
            testResult = runOneWayANOVA(
              groupMap,
              groupColumn,
              targetColumn
            );
          }

          const isSignificant = testResult.pValue < 0.05;
          const conf: ConfidenceLevel = testResult.pValue < 0.01 ? 'HIGH' : isSignificant ? 'MEDIUM' : 'LOW';

          return {
            success: true,
            data: testResult,
            summary: `${testResult.testName}: Stat = ${testResult.statistic.toFixed(3)}, p = ${testResult.pValue < 0.001 ? '<0.001' : testResult.pValue.toFixed(4)}. ${isSignificant ? 'Statistically significant difference detected (reject H0).' : 'No statistically significant difference (fail to reject H0).'}`,
            observationCandidate: {
              metric: `Hypothesis Test: ${targetColumn} across ${groupColumn}`,
              dimension: groupColumn,
              value: testResult.statistic,
              summary: `${testResult.testName} on ${targetColumn} by ${groupColumn}: p = ${testResult.pValue < 0.001 ? '<0.001' : testResult.pValue.toFixed(4)} (${isSignificant ? 'Significant' : 'Non-significant'}). ${testResult.interpretation}`,
              sourceTool: 'hypothesis_test',
              confidence: conf
            },
            executionTimeMs: Math.round(performance.now() - start)
          };
        } catch (err: any) {
          return {
            success: false,
            data: null,
            summary: `Hypothesis test failed: ${err.message}`,
            error: err.message,
            executionTimeMs: Math.round(performance.now() - start)
          };
        }
      }
    });

    // ------------------------------------------------------------------------
    // 4. MACHINE LEARNING TOOLS
    // ------------------------------------------------------------------------

    // assess_ml_readiness
    this.registerTool({
      name: 'assess_ml_readiness',
      category: 'ML',
      description: 'Evaluates if dataset meets ML requirements (sample size, class balance, missingness).',
      permissionLevel: 'SAFE_READ',
      parameters: [],
      outputDescription: 'Readiness status, task type recommendation (classification vs regression), and feature suggestions.',
      execute: async (_, ctx): Promise<AgentToolResult> => {
        const start = performance.now();
        const readiness = assessMLReadiness(ctx.rows, ctx.columns, ctx.profiles);

        return {
          success: true,
          data: readiness,
          summary: `ML Readiness: ${readiness.status} (Score: ${readiness.overallScore}/100) with ${readiness.recommendedTask} recommended.`,
          executionTimeMs: Math.round(performance.now() - start)
        };
      }
    });

    // train_model
    this.registerTool({
      name: 'train_model',
      category: 'ML',
      description: 'Trains a supervised Machine Learning model (Linear/Polynomial Regression, Logistic Classification, or Random Forest) and returns evaluation metrics.',
      permissionLevel: 'SAFE_READ',
      parameters: [
        { name: 'taskType', type: 'string', required: true, description: 'regression | classification' },
        { name: 'targetColumn', type: 'string', required: true, description: 'Target dependent variable' },
        { name: 'featureColumns', type: 'array', required: true, description: 'List of feature variable names' },
        { name: 'modelType', type: 'string', required: false, description: 'Linear Regression | Logistic Regression | Random Forest', default: 'Linear Regression' }
      ],
      outputDescription: 'Trained model metrics (R2 / Accuracy / F1 / RMSE), feature importances, and predictions.',
      execute: async (params, ctx): Promise<AgentToolResult> => {
        const start = performance.now();
        const { taskType, targetColumn, featureColumns, modelType = 'Linear Regression' } = params;

        try {
          const modelRes = trainMachineLearningModel(ctx.rows, ctx.columns, ctx.profiles, {
            taskType,
            targetColumn,
            featureColumns,
            modelType,
            testSplit: 0.2
          });

          const primaryMetric = taskType === 'regression'
            ? `R² = ${(modelRes.r2Score || 0).toFixed(3)}, RMSE = ${(modelRes.rmse || 0).toFixed(3)}`
            : `Accuracy = ${((modelRes.accuracy || 0) * 100).toFixed(1)}%`;

          const topFeature = modelRes.featureImportance?.[0];

          return {
            success: true,
            data: modelRes,
            summary: `Trained ${modelType} on '${targetColumn}': ${primaryMetric}. Top feature driver: ${topFeature?.feature || 'N/A'} (importance: ${((topFeature?.importance || 0) * 100).toFixed(1)}%).`,
            observationCandidate: {
              metric: `ML Model Performance (${targetColumn})`,
              value: taskType === 'regression' ? (modelRes.r2Score || 0) : (modelRes.accuracy || 0),
              summary: `${modelType} achieved ${primaryMetric} predicting ${targetColumn}. Most predictive feature was '${topFeature?.feature || 'none'}'.`,
              sourceTool: 'train_model',
              confidence: 'HIGH'
            },
            executionTimeMs: Math.round(performance.now() - start)
          };
        } catch (err: any) {
          return {
            success: false,
            data: null,
            summary: `Model training failed: ${err.message}`,
            error: err.message,
            executionTimeMs: Math.round(performance.now() - start)
          };
        }
      }
    });

    // ------------------------------------------------------------------------
    // 5. VISUALIZATION TOOLS
    // ------------------------------------------------------------------------

    // create_chart
    this.registerTool({
      name: 'create_chart',
      category: 'VISUALIZATION',
      description: 'Generates a validated chart specification from dataset metrics and dimensions.',
      permissionLevel: 'SAFE_READ',
      parameters: [
        { name: 'chartType', type: 'string', required: true, description: 'bar | line | scatter | pie | area' },
        { name: 'xAxis', type: 'string', required: true, description: 'Dimension for X axis' },
        { name: 'yAxis', type: 'string', required: true, description: 'Metric for Y axis' },
        { name: 'title', type: 'string', required: true, description: 'Chart header title' }
      ],
      outputDescription: 'Renderable chart configuration block.',
      execute: async (params, ctx): Promise<AgentToolResult> => {
        const start = performance.now();
        const { chartType, xAxis, yAxis, title } = params;

        return {
          success: true,
          data: { type: chartType, xAxis, yAxis, title },
          summary: `Created ${chartType} visualization: ${title}`,
          visualCandidate: {
            title,
            type: chartType === 'line' ? 'time_series' : 'bar',
            chartConfig: {
              id: `chart-create-${Date.now()}`,
              type: chartType,
              xAxis,
              yAxis,
              title
            },
            caption: `${title} visual breakdown across ${xAxis} and ${yAxis}.`
          },
          executionTimeMs: Math.round(performance.now() - start)
        };
      }
    });
  }
}

export const globalToolRegistry = new AgentToolRegistry();
