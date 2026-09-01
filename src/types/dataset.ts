export type ColumnType = 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'id' | 'text';

export type SemanticClassification =
  | 'numeric_continuous'
  | 'numeric_discrete'
  | 'currency'
  | 'percentage'
  | 'categorical_nominal'
  | 'categorical_ordinal'
  | 'boolean'
  | 'datetime'
  | 'identifier'
  | 'geographic'
  | 'text_free'
  | 'target_candidate';

export interface ColumnClassification {
  column: string;
  primaryType: ColumnType;
  semanticType: SemanticClassification;
  confidence: number; // 0 - 100
  isTargetCandidate: boolean;
  isIdentifier: boolean;
  isCurrency: boolean;
  isPercentage: boolean;
  isGeographic: boolean;
  isOrdinal: boolean;
  suggestedRole: 'feature' | 'target' | 'identifier' | 'dimension' | 'time' | 'measure';
  reasoning: string;
}

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  inferredType: string;
  detectedTypeConfidence?: number; // 0 - 100%
  recommendedType?: ColumnType;
  classification?: ColumnClassification;
  totalCount: number;
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  cardinalityRatio: number;
  sampleValues: (string | number | boolean | null)[];
  
  // Numerical stats
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  stdDev?: number;
  variance?: number;
  q1?: number;
  q2?: number;
  q3?: number;
  iqr?: number;
  skewness?: number;
  kurtosis?: number;
  outlierCount?: number;
  outlierPercentage?: number;
  zScoreOutlierCount?: number;
  histogram?: { bin: string; count: number; min: number; max: number; percentage?: number }[];
  boxPlotSummary?: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    lowerFence: number;
    upperFence: number;
    outlierValues: number[];
  };

  // Categorical stats
  topValues?: { value: string; count: number; percentage: number }[];
  caseVariants?: { standard: string; variants: string[]; count: number }[];
  dominantValuePercentage?: number;
  rareCategoriesCount?: number;
  diversityIndex?: number;
  isConstant?: boolean;
  isNearConstant?: boolean;
  isHighCardinality?: boolean;
  isPotentialId?: boolean;

  // Datetime stats
  minDate?: string;
  maxDate?: string;
  dateRangeDays?: number;
  invalidDateCount?: number;
}

export type QualityDimension =
  | 'missing_values'
  | 'duplicate_rows'
  | 'duplicate_ids'
  | 'incorrect_types'
  | 'inconsistent_categories'
  | 'whitespace_padding'
  | 'casing_inconsistency'
  | 'empty_strings'
  | 'invalid_dates'
  | 'suspicious_numeric'
  | 'negative_values'
  | 'outliers_iqr'
  | 'outliers_zscore'
  | 'constant_columns'
  | 'near_constant_columns'
  | 'high_cardinality'
  | 'potential_ids'
  | 'mostly_missing_columns'
  | 'mixed_types'
  | 'impossible_values'
  | 'redundant_columns';

export type QualitySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type TransformationAction =
  | { type: 'remove_duplicates' }
  | { type: 'remove_duplicate_ids'; column: string; keep: 'first' | 'last' }
  | { type: 'impute_missing'; column: string; strategy: 'mean' | 'median' | 'mode' | 'constant' | 'forward_fill' | 'backward_fill'; constantValue?: any }
  | { type: 'drop_missing'; column?: string }
  | { type: 'drop_mostly_missing_columns'; threshold?: number }
  | { type: 'trim_whitespace'; column?: string }
  | { type: 'standardize_case'; column: string; caseFormat: 'title' | 'lower' | 'upper' }
  | { type: 'replace_values'; column: string; fromValue: string; toValue: string }
  | { type: 'standardize_aliases'; column: string; mappings: Record<string, string> }
  | { type: 'convert_type'; column: string; targetType: ColumnType; format?: string }
  | { type: 'cap_outliers'; column: string; bounds?: { lower: number; upper: number } }
  | { type: 'remove_outliers'; column: string; method?: 'iqr' | 'zscore' }
  | { type: 'replace_outliers_with_median'; column: string }
  | { type: 'drop_column'; column: string }
  | { type: 'drop_constant_columns' }
  | { type: 'rename_column'; column: string; newName: string };

export interface QualityIssue {
  id: string;
  dimension: QualityDimension;
  column: string;
  problem: string;
  evidence: string;
  severity: QualitySeverity;
  affectedRows: number;
  affectedPercentage: number;
  recommendedAction: string;
  whyExplanation: string;
  whatWillChange: string;
  risks: string;
  whenNotToApply: string;
  expectedImpact: string;
  fixType: 
    | 'drop_missing'
    | 'fill_mean'
    | 'fill_median'
    | 'fill_mode'
    | 'fill_constant'
    | 'trim_whitespace'
    | 'drop_duplicates'
    | 'drop_duplicate_ids'
    | 'cap_outliers'
    | 'remove_outliers'
    | 'convert_type'
    | 'drop_column'
    | 'normalize_case'
    | 'standardize_aliases'
    | 'inspect_only';
  suggestedAction?: TransformationAction;
  status?: 'DETECTED' | 'RESOLVED' | 'IGNORED';
}

export interface ScoreExplanationItem {
  dimension: string;
  weight: number;
  score: number;
  penalty: number;
  reason: string;
}

export interface DataQualityReport {
  score: number; // 0 - 100
  rating: 'EXCELLENT' | 'GOOD' | 'NEEDS ATTENTION' | 'CRITICAL ISSUES';
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  infoIssues: number;
  duplicateRows: number;
  duplicateRowPercentage: number;
  missingCellsTotal: number;
  missingCellsPercentage: number;
  invalidValuesTotal: number;
  outliersTotal: number;
  columnsWithIssuesCount: number;
  issues: QualityIssue[];
  metricsBreakdown: {
    completeness: number;      // 0 - 100
    uniqueness: number;        // 0 - 100
    validity: number;          // 0 - 100
    typeConsistency: number;   // 0 - 100
    categoryConsistency: number;// 0 - 100
    outlierHealth: number;     // 0 - 100
  };
  scoreExplanations: ScoreExplanationItem[];
}

export interface DatasetStatsSnapshot {
  totalRows: number;
  totalColumns: number;
  missingCells: number;
  duplicateRows: number;
  invalidValues: number;
  qualityScore: number;
}

export interface CleaningTransformation {
  id: string;
  timestamp: number;
  type: string;
  description: string;
  column?: string;
  params?: Record<string, any>;
  affectedRowsCount: number;
  action?: TransformationAction;
  beforeStats?: DatasetStatsSnapshot;
  afterStats?: DatasetStatsSnapshot;
}

export interface CleaningPlanStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  column: string;
  issueType: QualityDimension;
  severity: QualitySeverity;
  action: TransformationAction;
  whyExplanation: string;
  whatWillChange: string;
  risks: string;
  whenNotToApply: string;
  expectedImpact: string;
  status: 'PENDING' | 'APPLIED' | 'SKIPPED';
}

export interface CleaningPlan {
  id: string;
  generatedAt: number;
  steps: CleaningPlanStep[];
  estimatedScoreImprovement: {
    currentScore: number;
    projectedScore: number;
  };
}

export interface BeforeAfterPreview {
  action: TransformationAction;
  title: string;
  description: string;
  affectedRowsCount: number;
  beforeStats: DatasetStatsSnapshot;
  afterStats: DatasetStatsSnapshot;
  sampleDiffRows: {
    rowIndex: number;
    before: Record<string, any>;
    after: Record<string, any>;
    changedFields: string[];
  }[];
}

export type InsightCategory =
  | 'TREND'
  | 'ANOMALY'
  | 'CORRELATION'
  | 'PERFORMANCE'
  | 'DISTRIBUTION'
  | 'COMPARISON'
  | 'BUSINESS OPPORTUNITY'
  | 'OPPORTUNITY'
  | 'RISK';

export interface DatasetInsight {
  id: string;
  title: string;
  category: InsightCategory;
  description: string;
  evidence: string;
  businessInterpretation: string;
  confidence: number; // 0 - 100%
  impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'WARNING';
  score?: number;
  metric?: string;
  metricValue?: string | number;
  supportingData?: Record<string, any>;
  recommendedAction?: string;
}

export interface RecommendedAnalysis {
  id: string;
  title: string;
  description: string;
  category: 'Descriptive' | 'Diagnostic' | 'Predictive' | 'Prescriptive';
  suggestedChartType: ChartType;
  columnsInvolved: string[];
  sampleQuery: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export type ChartType = 
  | 'bar' 
  | 'horizontal_bar' 
  | 'line' 
  | 'area' 
  | 'scatter' 
  | 'histogram' 
  | 'box' 
  | 'pie' 
  | 'donut' 
  | 'heatmap' 
  | 'radar'
  | 'kpi';

export interface BusinessKPI {
  id: string;
  title: string;
  metricName: string;
  value: string;
  numericValue: number;
  format: 'currency' | 'number' | 'percentage' | 'count';
  columnSource: string;
  formulaDescription: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  changePercentage?: number;
  isDerived: boolean;
  benchmarkNote?: string;
}

export interface CorrelationMatrixData {
  columns: string[];
  numericColumns: string[];
  matrix: number[][];
  pairs?: {
    col1: string;
    col2: string;
    correlation: number;
    strength: 'Very Strong' | 'Strong' | 'Moderate' | 'Weak' | 'Very Weak';
    direction: 'positive' | 'negative' | 'none';
    pValue?: number;
    explanation: string;
  }[];
  pValues?: number[][];
}

export interface BivariateRelationship {
  id: string;
  title: string;
  type: 'numeric_numeric' | 'categorical_numeric' | 'categorical_categorical' | 'datetime_numeric';
  col1: string;
  col2: string;
  recommendedChart: ChartType;
  description: string;
  analyticalSummary: string;
  strengthMetric?: string;
  data: any[];
}

export interface MultivariateRelationship {
  id: string;
  title: string;
  dimensions: string[];
  metrics: string[];
  recommendedChart: ChartType;
  description: string;
  analyticalSummary: string;
  data: any[];
}

export interface TimeSeriesAnalysisResult {
  dateColumn: string;
  metricColumn: string;
  granularity: 'day' | 'week' | 'month' | 'quarter' | 'year';
  startDate: string;
  endDate: string;
  totalDurationDays: number;
  growthRatePct: number;
  periodOverPeriodAvgPct: number;
  peakPeriod: { period: string; value: number };
  troughPeriod: { period: string; value: number };
  trendDirection: 'GROWING' | 'DECLINING' | 'STABLE' | 'VOLATILE';
  trendPoints: {
    period: string;
    value: number;
    count: number;
    movingAverage?: number;
    pctChange?: number;
  }[];
  seasonalityNote: string;
}

export interface SegmentAnalysisResult {
  dimension: string;
  metric: string;
  totalSum: number;
  segments: {
    name: string;
    total: number;
    average: number;
    median: number;
    count: number;
    sharePercentage: number;
    contributionRank: number;
  }[];
}

export interface TopBottomRanking {
  dimension: string;
  metric: string;
  topN: number;
  topItems: { rank: number; name: string; value: number; sharePct: number }[];
  bottomItems: { rank: number; name: string; value: number; sharePct: number }[];
}

export interface AnomalyObservation {
  id: string;
  column: string;
  rowIndex: number;
  value: number | string;
  method: 'IQR' | 'ZSCORE' | 'DOMAIN_RULE';
  score: number;
  explanation: string;
  isExtreme: boolean;
}

export interface EDASummaryReport {
  generatedAt: number;
  datasetName: string;
  overview: {
    rows: number;
    columns: number;
    numericCount: number;
    categoricalCount: number;
    dateCount: number;
    missingCells: number;
    missingPercentage: number;
    duplicateRows: number;
    qualityScore: number;
  };
  kpis: BusinessKPI[];
  top5Insights: DatasetInsight[];
  remainingInsights: DatasetInsight[];
  topCorrelations: { col1: string; col2: string; correlation: number; strength: string }[];
  timeSeriesSummary?: {
    dateCol: string;
    metricCol: string;
    trend: string;
    growthPct: number;
    peak: string;
    trough: string;
  };
  keySegmentHighlights: string[];
  anomaliesSummary: {
    totalAnomalies: number;
    affectedColumns: string[];
  };
  recommendedNextSteps: string[];
}

export interface NaturalLanguageChartResponse {
  query: string;
  understoodIntent: string;
  resolvedColumns: {
    x?: string;
    y?: string;
    group?: string;
    date?: string;
  };
  chartConfig: ChartConfig;
  chartData: any[];
  xAxisLabel: string;
  yAxisLabel: string;
  analyticalExplanation: string;
  exactDataTable: {
    headers: string[];
    rows: (string | number)[][];
  };
}

export interface ChartConfig {
  id: string;
  title: string;
  type: ChartType;
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
  aggregation?: 'sum' | 'mean' | 'count' | 'min' | 'max' | 'median';
  topN?: number;
  sortBy?: 'asc' | 'desc' | 'none';
  colorScheme?: string;
  description?: string;
  explanation?: string;
}

export interface DatasetState {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: number;
  originalRows: Record<string, any>[];
  workingRows: Record<string, any>[];
  columns: string[];
  profiles: Record<string, ColumnProfile>;
  classifications?: Record<string, ColumnClassification>;
  quality: DataQualityReport;
  cleaningPlan?: CleaningPlan;
  transformations: CleaningTransformation[];
  insights: DatasetInsight[];
  recommendations: RecommendedAnalysis[];
  suggestedQuestions: string[];
  kpis?: BusinessKPI[];
  edaSummary?: EDASummaryReport;
}

export type QueryIntentType =
  | 'DESCRIPTIVE'
  | 'AGGREGATION'
  | 'COMPARISON'
  | 'RANKING'
  | 'TREND'
  | 'DISTRIBUTION'
  | 'CORRELATION'
  | 'ANOMALY'
  | 'SEGMENTATION'
  | 'STATISTICAL'
  | 'FILTER'
  | 'CALCULATION'
  | 'PREDICTION'
  | 'REPORT'
  | 'GENERAL_DATASET';

export interface StructuredAnalysisPlan {
  intent: QueryIntentType;
  primaryDimension?: string;
  secondaryDimension?: string;
  metricColumn?: string;
  aggregation: 'SUM' | 'MEAN' | 'MEDIAN' | 'COUNT' | 'MIN' | 'MAX' | 'IQR' | 'CORRELATION' | 'PERCENTAGE' | 'DISTRIBUTION' | 'DIFFERENCE';
  filterCondition?: { column: string; operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains'; value: any };
  sortBy?: 'ASCENDING' | 'DESCENDING';
  limit?: number;
  visualizationType?: ChartType | 'none';
  reasoning: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  timestamp: number;
  text: string;
  directAnswer?: string;
  supportingMetrics?: { label: string; value: string | number; change?: string }[];
  chartData?: {
    type: ChartType;
    title: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    data: any[];
    keys?: string[];
  };
  explanation?: string;
  businessImplication?: string;
  pythonCode?: string;
  plan?: StructuredAnalysisPlan;
  tableData?: { headers: string[]; rows: (string | number)[][] };
  suggestedFollowUps?: string[];
  isThinking?: boolean;
  intent?: QueryIntentType;
  executionTimeMs?: number;
}

export interface DetailedDescriptiveStats {
  column: string;
  count: number;
  nullCount: number;
  mean: number;
  median: number;
  mode: number | string;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  q1: number;
  q2: number;
  q3: number;
  iqr: number;
  skewness: number;
  kurtosis: number;
  standardError: number;
  ci90: [number, number];
  ci95: [number, number];
  ci99: [number, number];
}

export interface AssumptionCheck {
  assumption: string;
  status: 'PASSED' | 'VIOLATED' | 'WARNING';
  evidence: string;
  recommendation: string;
}

export interface StatisticalTestResult {
  testName: string;
  testedVariables: string[];
  hypothesis: {
    nullHypothesis: string;
    alternativeHypothesis: string;
  };
  statisticName: string;
  statisticValue: number;
  pValue: number;
  degreesOfFreedom?: number;
  isSignificant: boolean;
  significanceLevel: number;
  confidenceInterval?: [number, number];
  effectSize?: { name: string; value: number; interpretation: string };
  assumptions?: AssumptionCheck[];
  nonParametricAlternative?: string;
  multipleTestingWarning?: string;
  postHocAnalysis?: string;
  interpretation: string;
  businessMeaning: string;
  tableData?: any;
  chartData?: any;
}

export interface MLReadinessReport {
  overallScore: number; // 0 - 100
  status: 'READY' | 'NEEDS_CLEANING' | 'INSUFFICIENT_DATA';
  checks: { check: string; status: 'PASS' | 'WARN' | 'FAIL'; message: string }[];
  recommendedTask: 'regression' | 'classification' | 'clustering';
  targetCandidates: { column: string; type: 'classification' | 'regression'; reason: string }[];
  dataLeakageWarnings: string[];
  classImbalanceWarning?: string;
}

export interface ModelComparisonItem {
  id: string;
  modelName: string;
  taskType: 'regression' | 'classification';
  r2?: number;
  rmse?: number;
  mae?: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  rocAuc?: number;
  trainingTimeMs: number;
  isRecommended?: boolean;
  recommendationReason?: string;
}

export interface MLModelResult {
  id?: string;
  taskType: 'regression' | 'classification' | 'clustering';
  modelName: string;
  targetColumn?: string;
  featureColumns: string[];
  parameters: Record<string, any>;
  trainSize: number;
  testSize: number;
  trainedAt?: number;
  
  // Regression metrics
  r2Score?: number;
  adjustedR2Score?: number;
  rmse?: number;
  mae?: number;
  mse?: number;
  
  // Classification metrics
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  rocAuc?: number;
  confusionMatrix?: { matrix: number[][]; labels: string[] };
  classificationReport?: { label: string; precision: number; recall: number; f1: number; support: number }[];
  rocCurveData?: { fpr: number; tpr: number }[];
  prCurveData?: { recall: number; precision: number }[];
  
  // Cross validation
  cvScore?: { mean: number; std: number; metric: string };
  
  // Clustering metrics
  k?: number;
  inertia?: number;
  silhouetteScore?: number;
  clusterCenters?: Record<string, number>[];
  clusterCounts?: { cluster: string; count: number; percentage: number }[];
  
  // Visual & explainability data
  featureImportance?: { feature: string; importance: number }[];
  scatterPlotData?: { x: number; y: number; predicted?: number; cluster?: string; label?: string }[];
  predictionsPreview?: { actual?: any; predicted: any; features: Record<string, any> }[];
  
  // Diagnostics
  leakageWarnings?: string[];
  businessInterpretation?: string;
  limitations?: string[];
}

export interface ReportConfig {
  id: string;
  mode: 'quick' | 'standard' | 'detailed' | 'executive';
  title: string;
  subtitle: string;
  author: string;
  organization: string;
  date: string;
  datasetVersion: string;
  logoUrl?: string;
  theme: 'corporate' | 'modern' | 'minimal' | 'executive' | 'dark' | 'light';
  pageSize: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  focusDomain: 'general' | 'sales' | 'finance' | 'marketing' | 'operations' | 'customer' | 'hr';
  includedSections: {
    executiveSummary: boolean;
    datasetOverview: boolean;
    dataQuality: boolean;
    cleaningSummary: boolean;
    kpis: boolean;
    edaVisualizations: boolean;
    statisticalFindings: boolean;
    mlResults: boolean;
    keyInsights: boolean;
    businessRecommendations: boolean;
    risksAndLimitations: boolean;
    methodology: boolean;
    appendix: boolean;
  };
}

export interface ReportValidationResult {
  score: number; // 0 - 100
  rating: 'PERFECT' | 'EXCELLENT' | 'GOOD' | 'WARNINGS_DETECTED';
  checks: {
    check: string;
    passed: boolean;
    category: 'Numerical' | 'Consistency' | 'Visuals' | 'Completeness' | 'Integrity';
    details: string;
  }[];
  warnings: string[];
  inconsistencies: string[];
}

export interface ReportHistoryEntry {
  id: string;
  datasetId: string;
  datasetName: string;
  datasetVersion: string;
  createdAt: number;
  reportType: 'quick' | 'standard' | 'detailed' | 'executive';
  title: string;
  author: string;
  qualityScore: number;
  reportData: ExecutiveReport;
  config: ReportConfig;
}

export interface ExecutiveReport {
  id?: string;
  title: string;
  subtitle?: string;
  author?: string;
  organization?: string;
  datasetVersion?: string;
  generatedAt: string;
  datasetName: string;
  mode?: 'quick' | 'standard' | 'detailed' | 'executive';
  theme?: string;
  
  // 1. Executive Summary
  executiveSummary: string;
  keyTakeawaySentence?: string;
  
  // 2. Dataset Overview
  datasetOverview: {
    totalRows: number;
    totalColumns: number;
    numericColumns: number;
    categoricalColumns: number;
    dateColumns?: number;
    missingCells: number;
    duplicateRows: number;
    qualityScore: number;
    memoryEstimate?: string;
    dateRange?: string;
  };
  
  // 3. Quality Assessment
  qualityAssessment: string;
  qualityMetricsBreakdown?: {
    completeness: number;
    uniqueness: number;
    validity: number;
    typeConsistency: number;
  };
  beforeAfterComparison?: {
    metric: string;
    before: string | number;
    after: string | number;
    improvement: string;
  }[];
  
  // 4. Cleaning Summary
  cleaningSummary: string[];
  cleaningOperationsCount?: number;
  
  // 5. KPIs
  kpiCards?: {
    title: string;
    value: string | number;
    change?: string;
    changeType?: 'positive' | 'negative' | 'neutral';
    category?: string;
  }[];
  keyStatistics: { metric: string; value: string; note: string }[];
  
  // 6. Selected EDA Visualizations
  selectedCharts?: {
    id: string;
    title: string;
    subtitle?: string;
    chartType: ChartType;
    caption: string;
    analyticalExplanation: string;
    data: any[];
    xAxisKey?: string;
    dataKeys?: string[];
  }[];
  
  // 7. Statistical Findings
  statisticalHighlights: string[];
  descriptiveStatsTable?: {
    headers: string[];
    rows: (string | number)[][];
  };
  statisticalTestResults?: StatisticalTestResult[];
  
  // 8. Machine Learning Results
  mlResults?: MLModelResult;
  modelComparisonLeaderboard?: ModelComparisonItem[];
  
  // 9. Key Insights
  topInsights: DatasetInsight[];
  
  // 10. Strategic Business Recommendations
  businessRecommendations: {
    action: string;
    reason?: string;
    impact: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    supportingEvidence?: string;
  }[];
  
  // 11. Risks & Limitations
  analyticalRisks?: {
    risk: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    evidence: string;
    mitigation: string;
  }[];
  limitations: string[];
  
  // 12. Methodology
  methodologyNarrative?: string;
  
  // 13. Appendix
  appendix?: {
    columnDictionary?: { column: string; type: string; missing: number; unique: number; sample: string }[];
    reproduciblePythonCode?: string;
    cleaningHistoryLog?: string[];
  };
}
