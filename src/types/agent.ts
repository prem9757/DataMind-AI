// ============================================================================
// PHASE 8: AUTONOMOUS AI DATA ANALYST AGENT TYPE DEFINITIONS
// ============================================================================

import { ChartConfig } from './dataset';

export type TaskType =
  | 'PROFILE_DATA'
  | 'CHECK_QUALITY'
  | 'FILTER_DATA'
  | 'AGGREGATE'
  | 'COMPARE'
  | 'RANK'
  | 'TREND_ANALYSIS'
  | 'SEGMENT_ANALYSIS'
  | 'CORRELATION'
  | 'STATISTICAL_TEST'
  | 'ANOMALY_DETECTION'
  | 'KPI_ANALYSIS'
  | 'TIME_SERIES_ANALYSIS'
  | 'REGRESSION'
  | 'CLASSIFICATION'
  | 'CLUSTERING'
  | 'VISUALIZATION'
  | 'VALIDATION'
  | 'INSIGHT_GENERATION'
  | 'RECOMMENDATION'
  | 'DRIVER_DECOMPOSITION';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type AgentMode = 'AUTONOMOUS' | 'ASSISTED';

export type HypothesisStatus =
  | 'SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'NOT_SUPPORTED'
  | 'INSUFFICIENT_DATA';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export interface AgentTask {
  id: string;
  title: string;
  type: TaskType;
  toolName: string;
  params: Record<string, any>;
  status: TaskStatus;
  dependencies?: string[]; // IDs of tasks that must finish before this
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  resultSummary?: string;
  resultPayload?: any;
  error?: string;
  retryCount?: number;
}

export interface InvestigationObservation {
  id: string;
  taskId: string;
  metric: string;
  dimension?: string;
  segment?: string;
  value: number | string;
  comparison?: {
    baselineValue?: number | string;
    delta?: number;
    percentDelta?: number;
    baselinePeriod?: string;
    currentPeriod?: string;
  };
  summary: string;
  datasetVersion: number;
  sourceTool: string;
  confidence: ConfidenceLevel;
  timestamp: number;
  rawEvidenceRef?: any;
}

export interface Hypothesis {
  id: string;
  statement: string;
  rationale: string;
  status: HypothesisStatus;
  strengthScore: number; // 0.0 to 1.0
  confidence: ConfidenceLevel;
  supportingObservationIds: string[];
  refutingObservationIds: string[];
  evaluationSummary: string;
  suggestedAction?: string;
}

export interface DriverContribution {
  dimension: string;
  factor: string;
  metric: string;
  absoluteDelta: number;
  percentageContribution: number; // percentage of total change
  baselineValue: number;
  currentValue: number;
  direction: 'favorable' | 'unfavorable' | 'neutral';
  significance: 'MAJOR' | 'MODERATE' | 'MINOR';
}

export interface DecompositionNode {
  name: string;
  value: number;
  delta?: number;
  percentDelta?: number;
  formula?: string;
  children?: DecompositionNode[];
}

export interface ValidationCheckResult {
  checkName: string;
  passed: boolean;
  details: string;
  datasetVersionChecked: number;
  timestamp: number;
}

export interface AgentVisualAsset {
  id: string;
  title: string;
  type: 'time_series' | 'driver_waterfall' | 'segment_comparison' | 'correlation' | 'distribution' | 'bar';
  chartConfig: ChartConfig;
  caption: string;
  relatedTaskId: string;
}

export interface AgentFinalAnswer {
  executiveAnswer: string;
  keyFindings: string[];
  evidenceBulletPoints: {
    metric: string;
    finding: string;
    impact: string;
    observationId: string;
  }[];
  visuals: AgentVisualAsset[];
  businessImplications: string[];
  recommendations: {
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    action: string;
    rationale: string;
    expectedImpact: string;
  }[];
  limitations: string[];
  overallConfidence: ConfidenceLevel;
  confidenceJustification: string;
}

export interface InvestigationPlan {
  goal: string;
  rationale: string;
  detectedContext: {
    targetMetric?: string;
    timeDimension?: string;
    primaryCategories: string[];
    analysisType: 'diagnostic' | 'comparative' | 'exploratory' | 'predictive' | 'optimization';
    suspectedTimeframes?: string[];
  };
  tasks: AgentTask[];
  createdAt: number;
}

export interface AgentActionLog {
  id: string;
  timestamp: number;
  tool: string;
  description: string;
  status: 'STARTED' | 'COMPLETED' | 'FAILED';
  durationMs?: number;
  datasetVersion: number;
}

export interface AgentInvestigation {
  id: string;
  goal: string;
  datasetId: string;
  datasetName: string;
  datasetVersion: number;
  mode: AgentMode;
  status: 'INITIALIZING' | 'PLANNING' | 'EXECUTING' | 'EVALUATING' | 'VALIDATING' | 'COMPLETED' | 'FAILED' | 'PAUSED';
  currentPlan?: InvestigationPlan;
  currentTaskId?: string;
  completedTaskIds: string[];
  observations: InvestigationObservation[];
  hypotheses: Hypothesis[];
  driverAnalysis?: {
    targetMetric: string;
    totalDelta: number;
    totalPercentDelta: number;
    drivers: DriverContribution[];
    decomposition?: DecompositionNode;
  };
  validations: ValidationCheckResult[];
  actionLogs: AgentActionLog[];
  finalAnswer?: AgentFinalAnswer;
  startedAt: number;
  finishedAt?: number;
  iterationCount: number;
  maxIterations: number;
  maxTasks: number;
  error?: string;
}

// Tool Registration Contracts
export type ToolPermissionLevel = 'SAFE_READ' | 'COMPUTE_TRANSFORM' | 'EXPORT';

export interface AgentToolDefinition {
  name: string;
  category: 'DATA' | 'EDA' | 'STATS' | 'ML' | 'VISUALIZATION' | 'REPORTING';
  description: string;
  permissionLevel: ToolPermissionLevel;
  parameters: {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    description: string;
    default?: any;
    enum?: string[];
  }[];
  outputDescription: string;
  execute: (params: Record<string, any>, context: AgentExecutionContext) => Promise<AgentToolResult>;
}

export interface AgentExecutionContext {
  datasetId: string;
  datasetVersion: number;
  rows: Record<string, any>[];
  columns: string[];
  profiles: Record<string, any>;
  quality: any;
  taskId: string;
  investigationId: string;
}

export interface AgentToolResult {
  success: boolean;
  data: any;
  summary: string;
  observationCandidate?: Omit<InvestigationObservation, 'id' | 'taskId' | 'datasetVersion' | 'timestamp'>;
  visualCandidate?: Omit<AgentVisualAsset, 'id' | 'relatedTaskId'>;
  error?: string;
  executionTimeMs: number;
}

export interface SavedInvestigationSummary {
  id: string;
  goal: string;
  datasetId: string;
  datasetName: string;
  datasetVersion: number;
  status: string;
  taskCount: number;
  hypothesisCount: number;
  confidence: ConfidenceLevel;
  startedAt: number;
  finishedAt?: number;
  executiveSummaryExcerpt?: string;
}
