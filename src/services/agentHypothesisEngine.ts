// ============================================================================
// PHASE 8: AUTONOMOUS AGENT HYPOTHESIS ENGINE
// ============================================================================

import { Hypothesis, InvestigationObservation, HypothesisStatus, ConfidenceLevel } from '../types/agent';

export class AgentHypothesisEngine {
  /**
   * Generates candidate hypotheses tailored to the dataset context and user goal.
   */
  public generateCandidateHypotheses(
    goal: string,
    targetMetric: string,
    categoricalCols: string[],
    temporalCol?: string
  ): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    const lowerGoal = goal.toLowerCase();

    // 1. Regional / Segment Disparity Hypothesis
    if (categoricalCols.length > 0) {
      const primaryDim = categoricalCols[0];
      hypotheses.push({
        id: `hyp-${hypotheses.length + 1}`,
        statement: `The variance in ${targetMetric} is disproportionately concentrated in specific segments of '${primaryDim}'.`,
        rationale: `Sub-segment concentration often accounts for macro fluctuations in aggregate business metrics.`,
        status: 'INSUFFICIENT_DATA',
        strengthScore: 0.5,
        confidence: 'MEDIUM',
        supportingObservationIds: [],
        refutingObservationIds: [],
        evaluationSummary: 'Awaiting segment decomposition and aggregation results.'
      });
    }

    // 2. Secondary Category Driver
    if (categoricalCols.length > 1) {
      const secDim = categoricalCols[1];
      hypotheses.push({
        id: `hyp-${hypotheses.length + 1}`,
        statement: `Product/Category line variance in '${secDim}' significantly impacted ${targetMetric} outcomes.`,
        rationale: `Product catalog mix shifts frequently alter unit economics and aggregate yield.`,
        status: 'INSUFFICIENT_DATA',
        strengthScore: 0.5,
        confidence: 'MEDIUM',
        supportingObservationIds: [],
        refutingObservationIds: [],
        evaluationSummary: 'Awaiting categorical variance testing.'
      });
    }

    // 3. Temporal Trajectory Shift
    if (temporalCol || lowerGoal.includes('trend') || lowerGoal.includes('decline') || lowerGoal.includes('growth')) {
      hypotheses.push({
        id: `hyp-${hypotheses.length + 1}`,
        statement: `A distinct inflection point or period-over-period structural shift occurred over time.`,
        rationale: `Temporal degradation indicates systemic operational or market changes rather than random noise.`,
        status: 'INSUFFICIENT_DATA',
        strengthScore: 0.5,
        confidence: 'MEDIUM',
        supportingObservationIds: [],
        refutingObservationIds: [],
        evaluationSummary: 'Awaiting time-series chronological regression.'
      });
    }

    // 4. Data Quality / Outlier Distortion Hypothesis
    hypotheses.push({
      id: `hyp-${hypotheses.length + 1}`,
      statement: `Extreme outlier values or high data missingness skewed observed aggregate ${targetMetric} patterns.`,
      rationale: `Heavy tail distributions or data recording anomalies can produce deceptive summary statistics.`,
      status: 'INSUFFICIENT_DATA',
      strengthScore: 0.5,
      confidence: 'HIGH',
      supportingObservationIds: [],
      refutingObservationIds: [],
      evaluationSummary: 'Awaiting quality profiling check.'
    });

    return hypotheses;
  }

  /**
   * Evaluates and updates hypotheses based on collected observations.
   */
  public evaluateHypotheses(
    hypotheses: Hypothesis[],
    observations: InvestigationObservation[]
  ): Hypothesis[] {
    return hypotheses.map(hyp => {
      const supporting: string[] = [];
      const refuting: string[] = [];

      for (const obs of observations) {
        const obsText = `${obs.metric} ${obs.summary}`.toLowerCase();
        const hypText = `${hyp.statement} ${hyp.rationale}`.toLowerCase();

        // Check if observation matches hypothesis dimension or concepts
        const hasDimOverlap = hyp.statement.split("'")[1]
          ? obsText.includes(hyp.statement.split("'")[1].toLowerCase())
          : false;

        if (hasDimOverlap || (hypText.includes('time') && obs.sourceTool === 'trend_analysis')) {
          if (obs.comparison && Math.abs(obs.comparison.percentDelta || 0) > 10) {
            supporting.push(obs.id);
          } else if (obs.sourceTool === 'hypothesis_test' && obsText.includes('significant')) {
            supporting.push(obs.id);
          } else {
            supporting.push(obs.id);
          }
        } else if (hypText.includes('outlier') && obs.sourceTool === 'get_quality_report') {
          if (typeof obs.value === 'number' && obs.value >= 85) {
            refuting.push(obs.id); // Good quality refutes quality distortion hypothesis
          } else if (typeof obs.value === 'number' && obs.value < 70) {
            supporting.push(obs.id);
          }
        }
      }

      let status: HypothesisStatus = 'INSUFFICIENT_DATA';
      let strength = 0.5;
      let summary = 'Insufficient evidence collected to evaluate.';

      if (supporting.length > 0 && refuting.length === 0) {
        status = 'SUPPORTED';
        strength = Math.min(0.95, 0.6 + supporting.length * 0.15);
        summary = `Evidence suggests support: ${supporting.length} corroborating observation(s) recorded.`;
      } else if (supporting.length > 0 && refuting.length > 0) {
        status = 'PARTIALLY_SUPPORTED';
        strength = 0.55;
        summary = `Mixed evidence: ${supporting.length} supporting observation(s) vs ${refuting.length} refuting.`;
      } else if (refuting.length > 0 && supporting.length === 0) {
        status = 'NOT_SUPPORTED';
        strength = 0.15;
        summary = `Evidence does not support this hypothesis based on empirical results.`;
      }

      const conf: ConfidenceLevel = supporting.length >= 2 ? 'HIGH' : supporting.length === 1 ? 'MEDIUM' : 'LOW';

      return {
        ...hyp,
        status,
        strengthScore: Math.round(strength * 100) / 100,
        confidence: conf,
        supportingObservationIds: supporting,
        refutingObservationIds: refuting,
        evaluationSummary: summary
      };
    });
  }
}

export const globalHypothesisEngine = new AgentHypothesisEngine();
