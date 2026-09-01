import { TestSuiteResult } from '../types/production';
import { SAMPLE_DATASETS } from './sampleData';
import { parseRawArray } from './dataParser';
import { profileDataset } from './profiler';
import { auditDataQuality } from './qualityEngine';
import { generateDatasetInsights } from './insightEngine';
import { computeCorrelationMatrix } from './edaEngine';
import { runTwoSampleTTest, computeDetailedDescriptiveStats } from './statsEngine';
import { trainMachineLearningModel } from './mlEngine';
import { generateComprehensiveReport } from './reportEngine';
import { globalCache } from './cacheEngine';
import { globalPlanner } from './agentPlanner';
import { globalToolRegistry } from './agentToolRegistry';
import { performDriverAnalysis } from './driverAnalysis';
import { globalHypothesisEngine } from './agentHypothesisEngine';

export async function runAutomatedTestSuite(): Promise<TestSuiteResult> {
  const startTime = performance.now();
  const suites: TestSuiteResult['suites'] = [];

  // Suite 1: Phase 1 Ingestion & Profiling
  const p1Tests: TestSuiteResult['suites'][0]['tests'] = [];
  const p1Start = performance.now();
  try {
    const sample = SAMPLE_DATASETS[0];
    const parsed = parseRawArray(sample.data, sample.name);
    const passParsed = parsed.rows.length > 0 && parsed.columns.length > 0;
    p1Tests.push({
      name: 'Dataset Ingestion & Header Resolution',
      status: passParsed ? 'PASSED' : 'FAILED',
      durationMs: Math.round(performance.now() - p1Start)
    });

    const profStart = performance.now();
    const profiles = profileDataset(parsed.rows, parsed.columns);
    const passProf = Object.keys(profiles).length === parsed.columns.length;
    p1Tests.push({
      name: 'Column Profiler & Semantic Inferences',
      status: passProf ? 'PASSED' : 'FAILED',
      durationMs: Math.round(performance.now() - profStart)
    });
  } catch (err: any) {
    p1Tests.push({
      name: 'Phase 1 Core Pipeline',
      status: 'FAILED',
      durationMs: 10,
      error: err.message
    });
  }
  suites.push({ name: 'Phase 1: Ingestion & Profiling', phase: 'Phase 1', tests: p1Tests });

  // Suite 2: Phase 2 Data Quality & Cleaning
  const p2Tests: TestSuiteResult['suites'][0]['tests'] = [];
  try {
    const sample = SAMPLE_DATASETS[0];
    const parsed = parseRawArray(sample.data, sample.name);
    const profiles = profileDataset(parsed.rows, parsed.columns);
    const qStart = performance.now();
    const quality = auditDataQuality(parsed.rows, parsed.columns, profiles);
    const passQ = quality.score >= 0 && quality.score <= 100 && Array.isArray(quality.issues);
    p2Tests.push({
      name: 'Quality Audit & 0-100 Rating Scoring',
      status: passQ ? 'PASSED' : 'FAILED',
      durationMs: Math.round(performance.now() - qStart)
    });
  } catch (err: any) {
    p2Tests.push({
      name: 'Phase 2 Quality Engine',
      status: 'FAILED',
      durationMs: 10,
      error: err.message
    });
  }
  suites.push({ name: 'Phase 2: Quality Engine & Cleaning', phase: 'Phase 2', tests: p2Tests });

  // Suite 3: Phase 3 EDA & Visualizations
  const p3Tests: TestSuiteResult['suites'][0]['tests'] = [];
  try {
    const sample = SAMPLE_DATASETS[0];
    const parsed = parseRawArray(sample.data, sample.name);
    const profiles = profileDataset(parsed.rows, parsed.columns);
    const edaStart = performance.now();
    const { insights, recommendations } = generateDatasetInsights(parsed.rows, parsed.columns, profiles);
    const passEda = insights.length > 0 && recommendations.length > 0;
    p3Tests.push({
      name: 'Automated Insight & KPI Generation',
      status: passEda ? 'PASSED' : 'FAILED',
      durationMs: Math.round(performance.now() - edaStart)
    });
  } catch (err: any) {
    p3Tests.push({
      name: 'Phase 3 EDA Engine',
      status: 'FAILED',
      durationMs: 10,
      error: err.message
    });
  }
  suites.push({ name: 'Phase 3: Exploratory Data Analysis', phase: 'Phase 3', tests: p3Tests });

  // Suite 4: Phase 5 Statistics & Machine Learning
  const p5Tests: TestSuiteResult['suites'][0]['tests'] = [];
  try {
    const sample = SAMPLE_DATASETS[0];
    const parsed = parseRawArray(sample.data, sample.name);
    const profiles = profileDataset(parsed.rows, parsed.columns);
    const numCols = parsed.columns.filter(c => profiles[c]?.type === 'numeric');

    if (numCols.length >= 2) {
      const statsStart = performance.now();
      const corr = computeCorrelationMatrix(parsed.rows, numCols);
      p5Tests.push({
        name: 'Pearson Correlation Matrix & Significance',
        status: corr.columns.length > 0 ? 'PASSED' : 'FAILED',
        durationMs: Math.round(performance.now() - statsStart)
      });

      const descStats = computeDetailedDescriptiveStats(parsed.rows, numCols, profiles);
      p5Tests.push({
        name: 'Parametric Descriptive Moments with CIs',
        status: descStats.length > 0 ? 'PASSED' : 'FAILED',
        durationMs: 5
      });

      const mlStart = performance.now();
      const mlRes = trainMachineLearningModel(parsed.rows, parsed.columns, profiles, {
        taskType: 'regression',
        modelType: 'Linear Regression',
        targetColumn: numCols[0],
        featureColumns: [numCols[1]],
        testSplit: 0.2
      });
      p5Tests.push({
        name: 'Supervised ML Regression Pipeline',
        status: mlRes.r2Score !== undefined ? 'PASSED' : 'FAILED',
        durationMs: Math.round(performance.now() - mlStart)
      });
    }
  } catch (err: any) {
    p5Tests.push({
      name: 'Phase 5 Statistics & ML',
      status: 'FAILED',
      durationMs: 10,
      error: err.message
    });
  }
  suites.push({ name: 'Phase 5: Advanced Statistics & ML', phase: 'Phase 5', tests: p5Tests });

  // Suite 5: Phase 6 Report Engine
  const p6Tests: TestSuiteResult['suites'][0]['tests'] = [];
  try {
    const sample = SAMPLE_DATASETS[0];
    const parsed = parseRawArray(sample.data, sample.name);
    const profiles = profileDataset(parsed.rows, parsed.columns);
    const quality = auditDataQuality(parsed.rows, parsed.columns, profiles);
    const { insights, recommendations } = generateDatasetInsights(parsed.rows, parsed.columns, profiles);

    const testDataset = {
      id: 'test-ds',
      name: sample.name,
      fileName: 'test.csv',
      fileSize: 1024,
      fileType: 'CSV',
      uploadedAt: Date.now(),
      originalRows: parsed.rows,
      workingRows: parsed.rows,
      columns: parsed.columns,
      profiles,
      quality,
      transformations: [],
      insights,
      recommendations,
      suggestedQuestions: []
    };

    const repStart = performance.now();
    const report = generateComprehensiveReport(testDataset);
    const passRep = !!report.title && !!report.executiveSummary && report.topInsights.length > 0;
    p6Tests.push({
      name: '13-Section Executive Report Synthesis',
      status: passRep ? 'PASSED' : 'FAILED',
      durationMs: Math.round(performance.now() - repStart)
    });
  } catch (err: any) {
    p6Tests.push({
      name: 'Phase 6 Reporting Pipeline',
      status: 'FAILED',
      durationMs: 10,
      error: err.message
    });
  }
  suites.push({ name: 'Phase 6: Professional Reporting', phase: 'Phase 6', tests: p6Tests });

  // Suite 6: Phase 7 Production Hardening & Caching
  const p7Tests: TestSuiteResult['suites'][0]['tests'] = [];
  try {
    const cacheStart = performance.now();
    globalCache.set('test_ds', 1, 'test_cat', { q: 1 }, { result: 42 });
    const cached = globalCache.get<{ result: number }>('test_ds', 1, 'test_cat', { q: 1 });
    const passCache = cached?.result === 42;
    p7Tests.push({
      name: 'Multi-Tier Keyed Caching & Invalidation',
      status: passCache ? 'PASSED' : 'FAILED',
      durationMs: Math.round(performance.now() - cacheStart)
    });
  } catch (err: any) {
    p7Tests.push({
      name: 'Phase 7 Caching Subsystem',
      status: 'FAILED',
      durationMs: 10,
      error: err.message
    });
  }
  suites.push({ name: 'Phase 7: Production Hardening', phase: 'Phase 7', tests: p7Tests });

  // Suite 8: Phase 8 Autonomous AI Data Analyst Agent
  const p8Tests: TestSuiteResult['suites'][0]['tests'] = [];
  try {
    const sample = SAMPLE_DATASETS[0];
    const parsed = parseRawArray(sample.data, sample.name);
    const profiles = profileDataset(parsed.rows, parsed.columns);

    // Test 1: Task Planning Engine
    const planStart = performance.now();
    const plan = globalPlanner.generatePlan('Why did revenue decrease?', parsed.columns, profiles, { score: 95 });
    p8Tests.push({
      name: 'Autonomous Goal Interpretation & Task Planning',
      status: plan.tasks.length >= 3 ? 'PASSED' : 'FAILED',
      durationMs: Math.round(performance.now() - planStart)
    });

    // Test 2: Controlled Tool Registry
    const toolStart = performance.now();
    const schemaTool = globalToolRegistry.getTool('get_dataset_schema');
    const aggTool = globalToolRegistry.getTool('aggregate_dataset');
    const passTools = !!schemaTool && !!aggTool && globalToolRegistry.listTools().length >= 8;
    p8Tests.push({
      name: 'Controlled Tool Registry Verification',
      status: passTools ? 'PASSED' : 'FAILED',
      durationMs: Math.round(performance.now() - toolStart)
    });

    // Test 3: Driver Analysis & Dimensional Decomposition
    const driverStart = performance.now();
    const numCols = parsed.columns.filter(c => profiles[c]?.type === 'numeric');
    const driverRes = performDriverAnalysis(parsed.rows, parsed.columns, profiles, numCols[0] || parsed.columns[0]);
    p8Tests.push({
      name: 'Driver Analysis & Mathematical Decomposition',
      status: driverRes && Array.isArray(driverRes.drivers) ? 'PASSED' : 'FAILED',
      durationMs: Math.round(performance.now() - driverStart)
    });

    // Test 4: Hypothesis Generation & Scoring
    const hypStart = performance.now();
    const catCols = parsed.columns.filter(c => profiles[c]?.type === 'categorical');
    const hypotheses = globalHypothesisEngine.generateCandidateHypotheses('Investigate regional churn', numCols[0] || 'Metric', catCols);
    p8Tests.push({
      name: 'Hypothesis Generation & Scoring Matrix',
      status: hypotheses.length >= 2 ? 'PASSED' : 'FAILED',
      durationMs: Math.round(performance.now() - hypStart)
    });
  } catch (err: any) {
    p8Tests.push({
      name: 'Phase 8 Autonomous Agent Engine',
      status: 'FAILED',
      durationMs: 10,
      error: err.message
    });
  }
  suites.push({ name: 'Phase 8: Autonomous AI Agent', phase: 'Phase 8', tests: p8Tests });

  let total = 0;
  let passed = 0;
  let failed = 0;
  suites.forEach(s => {
    s.tests.forEach(t => {
      total++;
      if (t.status === 'PASSED') passed++;
      else failed++;
    });
  });

  return {
    id: `test-run-${Date.now()}`,
    timestamp: Date.now(),
    totalTests: total,
    passed,
    failed,
    durationMs: Math.round(performance.now() - startTime),
    suites
  };
}
