import { DatasetState, ColumnProfile, DataQualityReport, ChartConfig, ChartType, ExecutiveReport } from './dataset';

export type DatasetStatus =
  | 'UPLOADING'
  | 'PROCESSING'
  | 'READY'
  | 'ANALYZING'
  | 'CLEANING'
  | 'REPORTING'
  | 'ERROR'
  | 'ARCHIVED';

export interface DatasetVersionEntry {
  version: number;
  versionTag: string; // 'v1.0', 'v2.0'
  name: string; // 'Original Ingestion', 'Duplicates Removed'
  timestamp: number;
  rowCount: number;
  columnCount: number;
  qualityScore: number;
  changeDescription: string;
  transformationCount: number;
  stateSnapshot: DatasetState;
}

export interface ManagedDataset {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  createdTime: number;
  lastModified: number;
  status: DatasetStatus;
  currentVersion: number;
  versions: DatasetVersionEntry[];
  activeState: DatasetState;
  isArchived: boolean;
  tags: string[];
  notes?: string;
}

export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type JobTaskType =
  | 'PROFILING'
  | 'DATA_QUALITY_SCAN'
  | 'EDA_COMPUTATION'
  | 'STATISTICAL_TESTS'
  | 'ML_TRAINING'
  | 'REPORT_GENERATION'
  | 'LARGE_EXPORT'
  | 'CLEANING_PIPELINE'
  | 'BENCHMARK_RUN'
  | 'INVESTIGATION';

export interface BackgroundJob {
  id: string;
  title: string;
  taskType: JobTaskType;
  datasetId: string;
  datasetName: string;
  datasetVersion: number | string;
  status: JobStatus;
  progress: number; // 0 to 100
  currentStep: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  errorInfo?: string;
  retryCount: number;
  maxRetries: number;
  resultPayload?: any;
  cancelRequested?: boolean;
}

export interface AppNotification {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read?: boolean;
  autoDismiss?: boolean;
  linkSection?: string;
}

export interface SavedAnalysis {
  id: string;
  title: string;
  description?: string;
  datasetId: string;
  datasetName: string;
  datasetVersion: number | string;
  type: 'nl_query' | 'chart' | 'statistical_test' | 'ml_model' | 'report';
  query?: string;
  chartConfig?: ChartConfig;
  chartData?: any[];
  resultSummary?: string;
  createdAt: number;
  tags: string[];
}

export interface SavedAIQuestion {
  id: string;
  question: string;
  datasetId: string;
  datasetVersion: number | string;
  category: string;
  lastRunAt: number;
  runCount: number;
  favorite: boolean;
}

export interface SystemHealthStatus {
  frontend: 'READY' | 'WARNING' | 'ERROR';
  aiEngine: 'READY' | 'WARNING' | 'ERROR';
  dataEngine: 'READY' | 'WARNING' | 'ERROR';
  mlEngine: 'READY' | 'WARNING' | 'ERROR';
  reportEngine: 'READY' | 'WARNING' | 'ERROR';
  caching: 'READY' | 'WARNING' | 'ERROR';
  storage: 'READY' | 'WARNING' | 'ERROR';
  overall: 'READY' | 'WARNING' | 'ERROR';
  checks: {
    name: string;
    component: string;
    status: 'READY' | 'WARNING' | 'ERROR';
    latencyMs: number;
    details: string;
  }[];
}

export interface ObservabilityMetrics {
  totalRequests: number;
  averageLatencyMs: number;
  cacheHitCount: number;
  cacheMissCount: number;
  cacheHitRate: number;
  errorCount: number;
  activeJobsCount: number;
  totalJobsProcessed: number;
  mlTrainingTimeMs: number;
  reportGenTimeMs: number;
  approxTokenUsage: number;
  memoryEstimateMB: number;
  recentLogs: {
    timestamp: number;
    level: 'INFO' | 'WARN' | 'ERROR';
    category: string;
    message: string;
    durationMs?: number;
  }[];
}

export type ErrorClassification =
  | 'USER_INPUT_ERROR'
  | 'DATA_ERROR'
  | 'ANALYSIS_ERROR'
  | 'MODEL_ERROR'
  | 'AI_ERROR'
  | 'EXPORT_ERROR'
  | 'SYSTEM_ERROR';

export interface AppErrorRecord {
  id: string;
  code: ErrorClassification;
  userMessage: string;
  technicalDetails?: string;
  recoveryAction?: string;
  timestamp: number;
  recoverable: boolean;
}

export interface BenchmarkResult {
  id: string;
  datasetSize: string; // '100K Rows', '500K Rows', '1M Rows'
  rowCount: number;
  colCount: number;
  uploadTimeMs: number;
  profilingTimeMs: number;
  qualityScanTimeMs: number;
  edaTimeMs: number;
  aggregationTimeMs: number;
  visualizationTimeMs: number;
  aiQueryTimeMs: number;
  reportGenTimeMs: number;
  totalTimeMs: number;
  memoryMB: number;
  status: 'PASSED' | 'WARNING' | 'FAILED';
  bottleneck?: string;
}

export interface TestSuiteResult {
  id: string;
  timestamp: number;
  totalTests: number;
  passed: number;
  failed: number;
  durationMs: number;
  suites: {
    name: string;
    phase: string;
    tests: {
      name: string;
      status: 'PASSED' | 'FAILED';
      durationMs: number;
      error?: string;
    }[];
  }[];
}
