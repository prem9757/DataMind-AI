// ============================================================================
// PHASE 8: AUTONOMOUS AGENT GOAL INTERPRETER & TASK PLANNER
// ============================================================================

import { InvestigationPlan, AgentTask, TaskType } from '../types/agent';
import { SecurityHardener } from './securityHardener';

export class AgentPlanner {
  /**
   * Translates a high-level natural language goal and dataset metadata into an adaptive, structured task plan.
   */
  public generatePlan(
    goal: string,
    columns: string[],
    profiles: Record<string, any>,
    quality: any
  ): InvestigationPlan {
    const sanitizedGoal = SecurityHardener.sanitizeForAIContext(goal);
    const lowerGoal = sanitizedGoal.toLowerCase();

    // 1. Detect target metrics (Numeric columns)
    const numericCols = columns.filter(c => {
      const p = profiles[c];
      return p && (p.type === 'numeric' || p.type === 'integer');
    });

    // Detect categorical dimensions
    const categoricalCols = columns.filter(c => {
      const p = profiles[c];
      return p && p.type === 'categorical';
    });

    // Detect temporal dimensions
    const timeCols = columns.filter(c => {
      const p = profiles[c];
      const name = c.toLowerCase();
      return (p && (p.type === 'date' || p.type === 'datetime')) || name.includes('date') || name.includes('time') || name.includes('year') || name.includes('month');
    });

    // Target metric heuristics
    let targetMetric = numericCols[0] || 'Metric';
    for (const numCol of numericCols) {
      const lower = numCol.toLowerCase();
      if (lowerGoal.includes(lower)) {
        targetMetric = numCol;
        break;
      }
      if (lower.includes('revenue') || lower.includes('sales') || lower.includes('profit') || lower.includes('churn') || lower.includes('income')) {
        targetMetric = numCol;
      }
    }

    const timeCol = timeCols[0];
    const primaryDim = categoricalCols[0];
    const secondaryDim = categoricalCols[1];

    // Determine analysis archetype
    let analysisType: 'diagnostic' | 'comparative' | 'exploratory' | 'predictive' | 'optimization' = 'exploratory';
    if (lowerGoal.includes('why') || lowerGoal.includes('cause') || lowerGoal.includes('reason') || lowerGoal.includes('decline') || lowerGoal.includes('drop')) {
      analysisType = 'diagnostic';
    } else if (lowerGoal.includes('compare') || lowerGoal.includes('vs') || lowerGoal.includes('difference')) {
      analysisType = 'comparative';
    } else if (lowerGoal.includes('predict') || lowerGoal.includes('forecast') || lowerGoal.includes('driver') || lowerGoal.includes('model')) {
      analysisType = 'predictive';
    }

    const tasks: AgentTask[] = [];

    // Step 1: Profile Dataset Schema & Health
    tasks.push({
      id: `task_${tasks.length + 1}`,
      title: 'Inspect Dataset Schema & Cardinality',
      type: 'PROFILE_DATA',
      toolName: 'get_dataset_schema',
      params: {},
      status: 'pending'
    });

    tasks.push({
      id: `task_${tasks.length + 1}`,
      title: 'Verify Data Quality & Anomaly Integrity',
      type: 'CHECK_QUALITY',
      toolName: 'get_quality_report',
      params: {},
      status: 'pending',
      dependencies: [`task_1`]
    });

    // Step 2: Target Metric Baseline
    if (targetMetric) {
      tasks.push({
        id: `task_${tasks.length + 1}`,
        title: `Compute Descriptive Statistics for ${targetMetric}`,
        type: 'AGGREGATE',
        toolName: 'get_column_statistics',
        params: { column: targetMetric },
        status: 'pending',
        dependencies: [`task_2`]
      });
    }

    // Step 3: Chronological Trend Analysis (if temporal data exists)
    if (timeCol && targetMetric) {
      tasks.push({
        id: `task_${tasks.length + 1}`,
        title: `Analyze Chronological Trend for ${targetMetric} over ${timeCol}`,
        type: 'TREND_ANALYSIS',
        toolName: 'trend_analysis',
        params: { dateColumn: timeCol, metricColumn: targetMetric },
        status: 'pending',
        dependencies: [`task_3`]
      });
    }

    // Step 4: Primary Segment Breakdown & Driver Decomposition
    if (primaryDim && targetMetric) {
      tasks.push({
        id: `task_${tasks.length + 1}`,
        title: `Decompose ${targetMetric} by Primary Dimension (${primaryDim})`,
        type: 'DRIVER_DECOMPOSITION',
        toolName: 'driver_decomposition',
        params: { dimension: primaryDim, metric: targetMetric },
        status: 'pending',
        dependencies: tasks.length > 3 ? [`task_4`] : [`task_3`]
      });
    }

    // Step 5: Secondary Dimension Breakdown
    if (secondaryDim && targetMetric) {
      tasks.push({
        id: `task_${tasks.length + 1}`,
        title: `Aggregate ${targetMetric} by ${secondaryDim}`,
        type: 'AGGREGATE',
        toolName: 'aggregate_dataset',
        params: { groupBy: secondaryDim, metric: targetMetric, aggregation: 'sum' },
        status: 'pending',
        dependencies: [`task_5`]
      });
    }

    // Step 6: Correlation Analysis
    if (numericCols.length >= 2) {
      tasks.push({
        id: `task_${tasks.length + 1}`,
        title: 'Compute Pearson Correlation Matrix for Cross-Feature Drivers',
        type: 'CORRELATION',
        toolName: 'correlation_analysis',
        params: { threshold: 0.35 },
        status: 'pending'
      });
    }

    // Step 7: Hypothesis Significance Testing
    if (primaryDim && targetMetric && categoricalCols.length > 0) {
      tasks.push({
        id: `task_${tasks.length + 1}`,
        title: `Statistical Significance Test (${primaryDim} vs ${targetMetric})`,
        type: 'STATISTICAL_TEST',
        toolName: 'hypothesis_test',
        params: { testType: 'anova', groupColumn: primaryDim, targetColumn: targetMetric },
        status: 'pending'
      });
    }

    // Step 8: Supervised ML Modeling (if sufficient rows & predictive/diagnostic inquiry)
    if (numericCols.length >= 2 && targetMetric) {
      const featureCols = numericCols.filter(c => c !== targetMetric).slice(0, 5);
      if (featureCols.length > 0) {
        tasks.push({
          id: `task_${tasks.length + 1}`,
          title: `Train Predictive Model for Feature Importance Ranking (${targetMetric})`,
          type: 'REGRESSION',
          toolName: 'train_model',
          params: {
            taskType: 'regression',
            targetColumn: targetMetric,
            featureColumns: featureCols,
            modelType: 'Linear Regression'
          },
          status: 'pending'
        });
      }
    }

    // Step 9: Automatic Visualizations
    if (primaryDim && targetMetric) {
      tasks.push({
        id: `task_${tasks.length + 1}`,
        title: `Synthesize Strategic Chart for ${targetMetric} by ${primaryDim}`,
        type: 'VISUALIZATION',
        toolName: 'create_chart',
        params: {
          chartType: 'bar',
          xAxis: primaryDim,
          yAxis: targetMetric,
          title: `${targetMetric} Distribution across ${primaryDim}`
        },
        status: 'pending'
      });
    }

    return {
      goal: sanitizedGoal,
      rationale: `Adaptive ${analysisType} analytical plan designed to investigate '${targetMetric}' with dimensional decomposition across ${categoricalCols.join(', ') || 'available features'}.`,
      detectedContext: {
        targetMetric,
        timeDimension: timeCol,
        primaryCategories: categoricalCols,
        analysisType
      },
      tasks,
      createdAt: Date.now()
    };
  }
}

export const globalPlanner = new AgentPlanner();
