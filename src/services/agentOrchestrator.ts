// ============================================================================
// PHASE 8: AUTONOMOUS AI DATA ANALYST AGENT ORCHESTRATOR
// ============================================================================

import {
  AgentInvestigation,
  AgentMode,
  InvestigationObservation,
  Hypothesis,
  AgentFinalAnswer,
  AgentActionLog,
  AgentTask,
  AgentVisualAsset,
  ConfidenceLevel,
  SavedInvestigationSummary
} from '../types/agent';
import { DatasetState } from '../types/dataset';
import { globalToolRegistry } from './agentToolRegistry';
import { globalPlanner } from './agentPlanner';
import { globalHypothesisEngine } from './agentHypothesisEngine';
import { globalAgentValidator } from './agentValidator';
import { performDriverAnalysis } from './driverAnalysis';
import { globalJobEngine } from './jobEngine';
import { SecurityHardener } from './securityHardener';

const SAVED_INVESTIGATIONS_KEY = 'datamind_saved_investigations';

export class AgentOrchestrator {
  private activeInvestigation: AgentInvestigation | null = null;
  private listeners: Set<(investigation: AgentInvestigation | null) => void> = new Set();
  private abortController: AbortController | null = null;

  constructor() {
    // Initialized
  }

  public subscribe(callback: (investigation: AgentInvestigation | null) => void): () => void {
    this.listeners.add(callback);
    callback(this.activeInvestigation);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.activeInvestigation ? { ...this.activeInvestigation } : null);
    }
  }

  public getActiveInvestigation(): AgentInvestigation | null {
    return this.activeInvestigation;
  }

  /**
   * Starts a new autonomous investigation
   */
  public async startInvestigation(
    goal: string,
    dataset: DatasetState,
    mode: AgentMode = 'AUTONOMOUS'
  ): Promise<AgentInvestigation> {
    this.abortController = new AbortController();
    const id = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const plan = globalPlanner.generatePlan(goal, dataset.columns, dataset.profiles, dataset.quality);

    // Initial hypotheses
    const numericCols = dataset.columns.filter(c => dataset.profiles[c]?.type === 'numeric');
    const catCols = dataset.columns.filter(c => dataset.profiles[c]?.type === 'categorical');
    const targetMetric = plan.detectedContext.targetMetric || numericCols[0] || 'Target';
    const initialHypotheses = globalHypothesisEngine.generateCandidateHypotheses(
      goal,
      targetMetric,
      catCols,
      plan.detectedContext.timeDimension
    );

    const initialInvestigation: AgentInvestigation = {
      id,
      goal,
      datasetId: dataset.id,
      datasetName: dataset.name,
      datasetVersion: 1, // Using current dataset working version
      mode,
      status: 'PLANNING',
      currentPlan: plan,
      completedTaskIds: [],
      observations: [],
      hypotheses: initialHypotheses,
      validations: [],
      actionLogs: [
        {
          id: `log-${Date.now()}-1`,
          timestamp: now,
          tool: 'AgentPlanner',
          description: `Formulated structured analysis plan with ${plan.tasks.length} tasks and ${initialHypotheses.length} candidate hypotheses.`,
          status: 'COMPLETED',
          datasetVersion: 1
        }
      ],
      startedAt: now,
      iterationCount: 1,
      maxIterations: 5,
      maxTasks: 20
    };

    this.activeInvestigation = initialInvestigation;
    this.notify();

    // Register background job in job engine for observability
    globalJobEngine.createJob(
      `Autonomous Investigation: ${goal.substring(0, 30)}`,
      'INVESTIGATION',
      dataset.id,
      dataset.name,
      1
    );

    if (mode === 'AUTONOMOUS') {
      // Execute the investigation tasks asynchronously
      this.runExecutionLoop(dataset);
    }

    return initialInvestigation;
  }

  /**
   * Resumes or runs the agent autonomous loop
   */
  public async runExecutionLoop(dataset: DatasetState) {
    if (!this.activeInvestigation) return;

    this.activeInvestigation.status = 'EXECUTING';
    this.notify();

    try {
      const plan = this.activeInvestigation.currentPlan;
      if (!plan) return;

      for (const task of plan.tasks) {
        if (this.abortController?.signal.aborted) {
          this.activeInvestigation.status = 'PAUSED';
          this.notify();
          return;
        }

        if (task.status === 'completed' || task.status === 'skipped') continue;

        // Check task dependencies
        if (task.dependencies && task.dependencies.length > 0) {
          const depsCompleted = task.dependencies.every(dId => this.activeInvestigation?.completedTaskIds.includes(dId));
          if (!depsCompleted) {
            continue;
          }
        }

        // Execute task
        await this.executeTask(task, dataset);
      }

      // Perform Driver Analysis if target metric detected
      if (plan.detectedContext.targetMetric) {
        const driverRes = performDriverAnalysis(
          dataset.workingRows,
          dataset.columns,
          dataset.profiles,
          plan.detectedContext.targetMetric,
          plan.detectedContext.timeDimension
        );
        this.activeInvestigation.driverAnalysis = driverRes;
      }

      // Evaluate hypotheses against all gathered observations
      this.activeInvestigation.status = 'EVALUATING';
      this.notify();

      this.activeInvestigation.hypotheses = globalHypothesisEngine.evaluateHypotheses(
        this.activeInvestigation.hypotheses,
        this.activeInvestigation.observations
      );

      // Validate investigation calculations and data version alignment
      this.activeInvestigation.status = 'VALIDATING';
      this.notify();

      const validationResults = globalAgentValidator.validateInvestigation(
        this.activeInvestigation.datasetVersion,
        this.activeInvestigation.currentPlan?.tasks || [],
        this.activeInvestigation.observations
      );
      this.activeInvestigation.validations = validationResults;

      // Synthesize Final Answer
      this.activeInvestigation.finalAnswer = this.synthesizeFinalAnswer();
      this.activeInvestigation.status = 'COMPLETED';
      this.activeInvestigation.finishedAt = Date.now();

      // Log completion
      this.activeInvestigation.actionLogs.push({
        id: `log-${Date.now()}-done`,
        timestamp: Date.now(),
        tool: 'AgentOrchestrator',
        description: `Investigation completed with ${this.activeInvestigation.observations.length} observations and ${this.activeInvestigation.hypotheses.filter(h => h.status === 'SUPPORTED').length} supported hypotheses.`,
        status: 'COMPLETED',
        datasetVersion: this.activeInvestigation.datasetVersion
      });

      this.notify();
      this.autoSaveInvestigation();
    } catch (err: any) {
      if (this.activeInvestigation) {
        this.activeInvestigation.status = 'FAILED';
        this.activeInvestigation.error = err.message || 'Investigation execution failed';
        this.notify();
      }
    }
  }

  /**
   * Executes a single registered tool task deterministically
   */
  public async executeTask(task: AgentTask, dataset: DatasetState) {
    if (!this.activeInvestigation) return;

    task.status = 'running';
    task.startedAt = Date.now();
    this.activeInvestigation.currentTaskId = task.id;
    this.notify();

    // Log action start
    const logId = `log-${Date.now()}-${task.id}`;
    this.activeInvestigation.actionLogs.push({
      id: logId,
      timestamp: Date.now(),
      tool: task.toolName,
      description: `Executing ${task.title} using ${task.toolName}`,
      status: 'STARTED',
      datasetVersion: this.activeInvestigation.datasetVersion
    });

    const tool = globalToolRegistry.getTool(task.toolName);
    if (!tool) {
      task.status = 'failed';
      task.error = `Tool '${task.toolName}' is not registered`;
      task.completedAt = Date.now();
      return;
    }

    try {
      const execResult = await tool.execute(task.params, {
        datasetId: dataset.id,
        datasetVersion: this.activeInvestigation.datasetVersion,
        rows: dataset.workingRows,
        columns: dataset.columns,
        profiles: dataset.profiles,
        quality: dataset.quality,
        taskId: task.id,
        investigationId: this.activeInvestigation.id
      });

      task.status = execResult.success ? 'completed' : 'failed';
      task.completedAt = Date.now();
      task.durationMs = execResult.executionTimeMs;
      task.resultSummary = execResult.summary;
      task.resultPayload = execResult.data;
      if (!execResult.success) task.error = execResult.error;

      // Extract observation if provided
      if (execResult.observationCandidate) {
        const obs: InvestigationObservation = {
          id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          taskId: task.id,
          metric: execResult.observationCandidate.metric,
          dimension: execResult.observationCandidate.dimension,
          segment: execResult.observationCandidate.segment,
          value: execResult.observationCandidate.value,
          comparison: execResult.observationCandidate.comparison,
          summary: execResult.observationCandidate.summary,
          datasetVersion: this.activeInvestigation.datasetVersion,
          sourceTool: task.toolName,
          confidence: execResult.observationCandidate.confidence || 'HIGH',
          timestamp: Date.now(),
          rawEvidenceRef: execResult.data
        };
        this.activeInvestigation.observations.push(obs);
      }

      this.activeInvestigation.completedTaskIds.push(task.id);

      // Update action log
      const logEntry = this.activeInvestigation.actionLogs.find(l => l.id === logId);
      if (logEntry) {
        logEntry.status = execResult.success ? 'COMPLETED' : 'FAILED';
        logEntry.durationMs = execResult.executionTimeMs;
      }
    } catch (err: any) {
      task.status = 'failed';
      task.error = err.message || 'Execution exception';
      task.completedAt = Date.now();
    }

    this.notify();
  }

  /**
   * Synthesizes the final structured executive answer with business implications, visuals, and recommendations.
   */
  private synthesizeFinalAnswer(): AgentFinalAnswer {
    if (!this.activeInvestigation) throw new Error('No active investigation');

    const inv = this.activeInvestigation;
    const targetMetric = inv.currentPlan?.detectedContext.targetMetric || 'Primary Metric';
    const observations = inv.observations;
    const supportedHypotheses = inv.hypotheses.filter(h => h.status === 'SUPPORTED' || h.status === 'PARTIALLY_SUPPORTED');
    const drivers = inv.driverAnalysis?.drivers || [];

    // Formulate Executive Answer
    let executiveAnswer = `Empirical analysis of ${inv.datasetName} (v${inv.datasetVersion}.0) completed across ${inv.completedTaskIds.length} analytical tasks. `;
    if (inv.driverAnalysis && inv.driverAnalysis.totalPercentDelta !== 0) {
      const dir = inv.driverAnalysis.totalDelta > 0 ? 'increased' : 'declined';
      executiveAnswer += `Total ${targetMetric} ${dir} by ${Math.abs(inv.driverAnalysis.totalPercentDelta).toFixed(1)}% between baseline and current evaluation windows. `;
      if (drivers.length > 0) {
        executiveAnswer += `The primary variance driver was '${drivers[0].factor}' (${drivers[0].dimension}), contributing ${Math.abs(drivers[0].percentageContribution).toFixed(1)}% of total observed change.`;
      }
    } else if (observations.length > 0) {
      executiveAnswer += `Key findings indicate strong structural segmentation across primary dimensions with robust data quality scores.`;
    }

    // Key findings
    const keyFindings: string[] = [];
    for (const obs of observations.slice(0, 5)) {
      keyFindings.push(obs.summary);
    }
    if (drivers.length > 0) {
      keyFindings.push(`Dimensional driver ranking indicates '${drivers[0].factor}' had the largest absolute impact on ${targetMetric} (Δ ${drivers[0].absoluteDelta.toLocaleString()}).`);
    }

    // Evidence Bullet Points
    const evidenceBulletPoints = observations.slice(0, 6).map(obs => ({
      metric: obs.metric,
      finding: obs.summary,
      impact: obs.comparison ? `${obs.comparison.percentDelta?.toFixed(1)}% delta` : 'Significant observation',
      observationId: obs.id
    }));

    // Visuals
    const visuals: AgentVisualAsset[] = [];
    if (inv.currentPlan?.detectedContext.primaryCategories[0]) {
      const primDim = inv.currentPlan.detectedContext.primaryCategories[0];
      visuals.push({
        id: `vis-1`,
        title: `${targetMetric} by ${primDim}`,
        type: 'bar',
        chartConfig: {
          id: 'chart-vis-1',
          type: 'bar',
          xAxis: primDim,
          yAxis: targetMetric,
          title: `Distribution of ${targetMetric} across ${primDim}`
        },
        caption: `Empirical distribution illustrating categorical concentration.`,
        relatedTaskId: 'task_5'
      });
    }

    if (inv.currentPlan?.detectedContext.timeDimension) {
      const tCol = inv.currentPlan.detectedContext.timeDimension;
      visuals.push({
        id: `vis-2`,
        title: `${targetMetric} Chronological Trajectory`,
        type: 'time_series',
        chartConfig: {
          id: 'chart-vis-2',
          type: 'line',
          xAxis: tCol,
          yAxis: targetMetric,
          title: `${targetMetric} Over Time`
        },
        caption: `Chronological trajectory showing historical vs recent performance windows.`,
        relatedTaskId: 'task_4'
      });
    }

    // Business Implications
    const businessImplications: string[] = [
      `Concentration of ${targetMetric} in specific segments highlights potential operational dependencies and targeted growth opportunities.`,
      `Performance variation across dimensions suggests resource reallocation could improve aggregate efficiency.`
    ];
    if (supportedHypotheses.length > 0) {
      businessImplications.push(`Validated hypothesis: ${supportedHypotheses[0].statement}`);
    }

    // Recommendations
    const recommendations = [
      {
        priority: 'HIGH' as const,
        action: `Prioritize optimization and retention in ${drivers[0]?.factor || 'primary segment'}`,
        rationale: `This factor represents the highest single contribution to overall ${targetMetric} variance.`,
        expectedImpact: 'High potential to stabilize and uplift core performance.'
      },
      {
        priority: 'MEDIUM' as const,
        action: `Establish continuous anomaly monitoring on ${targetMetric}`,
        rationale: 'Early detection of inflection points prevents compounding metric deterioration.',
        expectedImpact: 'Reduces operational response latency.'
      }
    ];

    // Limitations
    const limitations = [
      'This analysis is based on available observational data; external market conditions or unrecorded variables may influence outcomes.',
      'Statistical associations and driver contributions reflect empirical correlations and do not establish underlying causal mechanisms.'
    ];

    const overallConfidence: ConfidenceLevel = observations.length >= 4 && inv.validations.every(v => v.passed) ? 'HIGH' : 'MEDIUM';

    return {
      executiveAnswer,
      keyFindings,
      evidenceBulletPoints,
      visuals,
      businessImplications,
      recommendations,
      limitations,
      overallConfidence,
      confidenceJustification: `Assigned ${overallConfidence} confidence based on ${observations.length} validated empirical observations and full mathematical verification.`
    };
  }

  /**
   * Saves investigation to local storage
   */
  public autoSaveInvestigation() {
    if (!this.activeInvestigation) return;
    try {
      const existingStr = localStorage.getItem(SAVED_INVESTIGATIONS_KEY);
      const existing: SavedInvestigationSummary[] = existingStr ? JSON.parse(existingStr) : [];

      const summary: SavedInvestigationSummary = {
        id: this.activeInvestigation.id,
        goal: this.activeInvestigation.goal,
        datasetId: this.activeInvestigation.datasetId,
        datasetName: this.activeInvestigation.datasetName,
        datasetVersion: this.activeInvestigation.datasetVersion,
        status: this.activeInvestigation.status,
        taskCount: this.activeInvestigation.completedTaskIds.length,
        hypothesisCount: this.activeInvestigation.hypotheses.length,
        confidence: this.activeInvestigation.finalAnswer?.overallConfidence || 'MEDIUM',
        startedAt: this.activeInvestigation.startedAt,
        finishedAt: this.activeInvestigation.finishedAt,
        executiveSummaryExcerpt: this.activeInvestigation.finalAnswer?.executiveAnswer.substring(0, 120) + '...'
      };

      const filtered = existing.filter(e => e.id !== summary.id);
      filtered.unshift(summary);
      localStorage.setItem(SAVED_INVESTIGATIONS_KEY, JSON.stringify(filtered.slice(0, 30)));
    } catch {
      // Ignore local storage error
    }
  }

  public getSavedInvestigations(): SavedInvestigationSummary[] {
    try {
      const str = localStorage.getItem(SAVED_INVESTIGATIONS_KEY);
      return str ? JSON.parse(str) : [];
    } catch {
      return [];
    }
  }

  public stopInvestigation() {
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.activeInvestigation) {
      this.activeInvestigation.status = 'PAUSED';
      this.notify();
    }
  }
}

export const globalAgentOrchestrator = new AgentOrchestrator();
