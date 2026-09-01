// ============================================================================
// PHASE 9: ADVANCED DATA ENGINEERING & MULTI-FILE INTELLIGENCE TYPES
// ============================================================================

import { DatasetState } from './dataset';

export type WorkspaceDatasetStatus = 'UPLOADING' | 'PROCESSING' | 'READY' | 'ERROR' | 'ARCHIVED';

export type SemanticRole = 'IDENTIFIER' | 'DATE' | 'METRIC' | 'DIMENSION' | 'CATEGORICAL' | 'TEXT';

export type DetectedUnit = 'USD' | 'EUR' | 'GBP' | 'INR' | 'PERCENT' | 'COUNT' | 'DISTANCE' | 'WEIGHT' | 'UNKNOWN';

export interface WorkspaceColumnSchema {
  column: string;
  dataType: 'string' | 'number' | 'boolean' | 'datetime' | 'categorical';
  nullable: boolean;
  nullCount: number;
  nullPercentage: number;
  distinctCount: number;
  cardinality: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNIQUE';
  sampleValues: any[];
  semanticRole: SemanticRole;
  detectedUnit?: DetectedUnit;
  isPotentialPrimaryKey: boolean;
  primaryKeyConfidence: number; // 0 - 100
  potentialForeignKeyTargets?: {
    targetDatasetId: string;
    targetDatasetName: string;
    targetColumn: string;
    overlapPercentage: number;
    confidence: number;
  }[];
}

export interface PrimaryKeyCandidate {
  column: string;
  uniqueness: number; // 0 - 100%
  nonNullPercentage: number; // 0 - 100%
  confidence: number; // 0 - 100
  reasoning: string;
}

export interface ForeignKeyCandidate {
  sourceColumn: string;
  targetDatasetId: string;
  targetDatasetName: string;
  targetColumn: string;
  overlapPercentage: number;
  confidence: number;
  cardinality: RelationshipCardinality;
  reasoning: string;
}

export type RelationshipCardinality = 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY';

export type RelationshipStatus = 'RECOMMENDED' | 'ACCEPTED' | 'REJECTED' | 'MANUAL';

export interface RelationshipValidation {
  sourceCount: number;
  targetCount: number;
  matchedKeysCount: number;
  unmatchedSourceKeysCount: number;
  unmatchedTargetKeysCount: number;
  matchPercentage: number; // 0 - 100
  sourceDuplicateKeysCount: number;
  targetDuplicateKeysCount: number;
  sourceNullCount: number;
  targetNullCount: number;
  typeCompatibility: 'EXACT' | 'COMPATIBLE_COERCIBLE' | 'INCOMPATIBLE';
  warnings: string[];
  isValid: boolean;
}

export interface WorkspaceRelationship {
  id: string;
  sourceDatasetId: string;
  sourceDatasetName: string;
  sourceColumn: string;
  targetDatasetId: string;
  targetDatasetName: string;
  targetColumn: string;
  cardinality: RelationshipCardinality;
  confidence: number; // 0 - 100
  status: RelationshipStatus;
  validation: RelationshipValidation;
  explanation: string;
  createdAt: number;
}

export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

export interface JoinConfig {
  id: string;
  leftDatasetId: string;
  rightDatasetId: string;
  leftKey: string;
  rightKey: string;
  joinType: JoinType;
  selectedColumns?: { [datasetId: string]: string[] };
  columnPrefixes?: { left?: string; right?: string };
}

export interface JoinPreviewResult {
  leftRowCount: number;
  rightRowCount: number;
  expectedOutputRows: number;
  matchedRows: number;
  unmatchedLeftRows: number;
  unmatchedRightRows: number;
  multiplicationFactor: number;
  isDangerous: boolean;
  warnings: string[];
  previewRows: Record<string, any>[];
  previewColumns: string[];
  executionTimeMs: number;
}

export interface UnifiedDataset {
  id: string;
  name: string;
  sourceDatasetIds: string[];
  sourceDatasetNames: string[];
  joinConfig: JoinConfig;
  rowCount: number;
  columnCount: number;
  columns: string[];
  profiles: Record<string, any>;
  workingRows: Record<string, any>[];
  createdAt: number;
  version: number;
}

export type LineageNodeType = 'SOURCE' | 'CLEAN' | 'JOIN' | 'FILTER' | 'TRANSFORM' | 'AGGREGATE' | 'OUTPUT';

export interface DataLineageNode {
  id: string;
  name: string;
  type: LineageNodeType;
  datasetId?: string;
  details: string;
  rowCount: number;
  columnCount: number;
  timestamp: number;
  parents: string[];
  metadata?: Record<string, any>;
}

export interface TransformationPipelineStep {
  id: string;
  stepNumber: number;
  type: 'LOAD' | 'CLEAN' | 'JOIN' | 'FILTER' | 'AGGREGATE' | 'COLUMN_TRANSFORM';
  name: string;
  description: string;
  datasetId: string;
  datasetName: string;
  inputShape: { rows: number; columns: number };
  outputShape: { rows: number; columns: number };
  status: 'APPLIED' | 'PENDING' | 'ERROR';
  appliedAt: number;
}

export interface SchemaConflict {
  datasetA: string;
  colA: string;
  typeA: string;
  datasetB: string;
  colB: string;
  typeB: string;
  issue: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedFix: string;
}

export interface UnitConflict {
  datasetA: string;
  colA: string;
  unitA: string;
  datasetB: string;
  colB: string;
  unitB: string;
  message: string;
}

export interface DuplicateEntityCandidate {
  entityType: string;
  primaryValue: string;
  similarValues: { dataset: string; column: string; value: string; similarity: number }[];
}

export interface ReconciliationCheck {
  id: string;
  metricName: string;
  sourceA: { datasetId: string; datasetName: string; column: string; value: number };
  sourceB: { datasetId: string; datasetName: string; column: string; value: number };
  difference: number;
  differencePercentage: number;
  status: 'MATCH' | 'DISCREPANCY';
  toleranceThresholdPercentage: number;
}

export interface WorkspaceQualityReport {
  overallScore: number; // 0 - 100
  rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  datasetScores: {
    datasetId: string;
    name: string;
    score: number;
    issuesCount: number;
  }[];
  relationshipHealthScore: number;
  schemaConflicts: SchemaConflict[];
  unitConflicts: UnitConflict[];
  duplicateEntities: DuplicateEntityCandidate[];
  reconciliationChecks: ReconciliationCheck[];
  recommendations: string[];
}

export interface WorkspaceDataset {
  id: string;
  fileName: string;
  displayName: string;
  fileType: 'csv' | 'xlsx' | 'xls' | 'json';
  fileSize: number;
  uploadedAt: number;
  rowCount: number;
  columnCount: number;
  qualityScore: number;
  status: WorkspaceDatasetStatus;
  isActive: boolean;
  state: DatasetState;
  schema: WorkspaceColumnSchema[];
  primaryKeyCandidates: PrimaryKeyCandidate[];
  foreignKeyCandidates: ForeignKeyCandidate[];
  tags: string[];
  notes?: string;
  version: number;
}

export interface DataWorkspaceState {
  id: string;
  name: string;
  version: number;
  createdAt: number;
  lastModified: number;
  datasets: WorkspaceDataset[];
  activeDatasetIds: string[];
  relationships: WorkspaceRelationship[];
  unifiedDatasets: UnifiedDataset[];
  activeUnifiedDatasetId?: string;
  pipelineSteps: TransformationPipelineStep[];
  lineage: DataLineageNode[];
}
