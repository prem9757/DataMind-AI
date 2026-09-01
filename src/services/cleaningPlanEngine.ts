import { CleaningPlan, CleaningPlanStep, DatasetState, QualityIssue } from '../types/dataset';

export function generateCleaningPlan(dataset: DatasetState): CleaningPlan {
  const issues = dataset.quality.issues;
  const steps: CleaningPlanStep[] = [];

  // Define priority order for cleaning operations:
  // 1. Whitespace trimming & text standardization
  // 2. Data type conversion (parsing dates, numbers, currency)
  // 3. Exact Duplicate rows removal
  // 4. Duplicate ID handling
  // 5. Imputing missing values / dropping high missing columns
  // 6. Outlier capping / handling
  // 7. Pruning constant / zero-variance columns

  const dimensionPriority: Record<string, number> = {
    whitespace_padding: 1,
    casing_inconsistency: 2,
    incorrect_types: 3,
    invalid_dates: 4,
    duplicate_rows: 5,
    duplicate_ids: 6,
    mostly_missing_columns: 7,
    missing_values: 8,
    impossible_values: 9,
    negative_values: 10,
    outliers_iqr: 11,
    outliers_zscore: 12,
    constant_columns: 13,
    redundant_columns: 14
  };

  const actionableIssues = issues.filter(
    i => i.suggestedAction && i.fixType !== 'inspect_only'
  );

  // Sort by defined pipeline logic
  const sortedIssues = [...actionableIssues].sort((a, b) => {
    const pA = dimensionPriority[a.dimension] || 50;
    const pB = dimensionPriority[b.dimension] || 50;
    return pA - pB;
  });

  let stepNum = 1;
  for (const issue of sortedIssues) {
    if (!issue.suggestedAction) continue;

    let title = '';
    switch (issue.suggestedAction.type) {
      case 'trim_whitespace':
        title = `Standardize whitespace in "${issue.column}"`;
        break;
      case 'standardize_case':
        title = `Normalize capitalization in "${issue.column}" to Title Case`;
        break;
      case 'convert_type':
        title = `Convert "${issue.column}" to ${issue.suggestedAction.targetType}`;
        break;
      case 'remove_duplicates':
        title = `Remove exact duplicate records (${issue.affectedRows} rows)`;
        break;
      case 'remove_duplicate_ids':
        title = `Deduplicate identifier keys in "${issue.column}"`;
        break;
      case 'impute_missing':
        title = `Impute missing values in "${issue.column}" (${(issue.suggestedAction as any).strategy})`;
        break;
      case 'drop_missing':
        title = `Drop rows with missing values in "${issue.column}"`;
        break;
      case 'cap_outliers':
        title = `Cap extreme outliers in "${issue.column}" at 1.5x IQR`;
        break;
      case 'drop_column':
        title = `Drop redundant / low-variance column "${issue.column}"`;
        break;
      default:
        title = `Clean ${issue.column}`;
    }

    steps.push({
      id: `plan-step-${stepNum}`,
      stepNumber: stepNum,
      title,
      description: issue.recommendedAction,
      column: issue.column,
      issueType: issue.dimension,
      severity: issue.severity,
      action: issue.suggestedAction,
      whyExplanation: issue.whyExplanation,
      whatWillChange: issue.whatWillChange,
      risks: issue.risks,
      whenNotToApply: issue.whenNotToApply,
      expectedImpact: issue.expectedImpact,
      status: 'PENDING'
    });

    stepNum++;
  }

  // Calculate projected score improvement
  const currentScore = dataset.quality.score;
  const projectedScore = Math.min(100, Math.round(currentScore + (100 - currentScore) * 0.85));

  return {
    id: `plan-${Date.now()}`,
    generatedAt: Date.now(),
    steps,
    estimatedScoreImprovement: {
      currentScore,
      projectedScore
    }
  };
}
