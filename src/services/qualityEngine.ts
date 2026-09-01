import { ColumnProfile, DataQualityReport, QualityIssue, ScoreExplanationItem } from '../types/dataset';

export function auditDataQuality(
  rows: Record<string, any>[],
  columns: string[],
  profiles: Record<string, ColumnProfile>
): DataQualityReport {
  const issues: QualityIssue[] = [];
  const totalRows = rows.length;
  const totalCols = columns.length;
  const totalCells = totalRows * totalCols;

  let missingCellsTotal = 0;
  let invalidValuesTotal = 0;
  let outliersTotal = 0;

  // 1. EXACT DUPLICATE ROWS
  const seenRows = new Set<string>();
  let duplicateRowCount = 0;
  for (const row of rows) {
    const serialized = JSON.stringify(row);
    if (seenRows.has(serialized)) {
      duplicateRowCount++;
    } else {
      seenRows.add(serialized);
    }
  }

  const dupRowPercentage = totalRows > 0 ? Math.round((duplicateRowCount / totalRows) * 10000) / 100 : 0;
  if (duplicateRowCount > 0) {
    const severity = dupRowPercentage > 5 ? 'HIGH' : dupRowPercentage > 1 ? 'MEDIUM' : 'LOW';
    issues.push({
      id: 'issue-dup-rows',
      dimension: 'duplicate_rows',
      column: '(All Columns)',
      problem: `Detected ${duplicateRowCount} exact duplicate rows (${dupRowPercentage}% of dataset).`,
      evidence: `Found ${duplicateRowCount} rows sharing 100% identical values across all ${columns.length} columns.`,
      severity,
      affectedRows: duplicateRowCount,
      affectedPercentage: dupRowPercentage,
      recommendedAction: 'Remove duplicate rows to avoid over-weighting repeated observations and skewing aggregations.',
      whyExplanation: 'Duplicate records distort sample distributions, inflate sample sizes, and bias statistical tests.',
      whatWillChange: `${duplicateRowCount} duplicate rows will be removed. The first occurrence of each unique record will be preserved.`,
      risks: 'Low risk. Verify whether repeated rows represent distinct events (e.g. recurring micro-transactions).',
      whenNotToApply: 'Do not remove if the dataset intentionally logs discrete repeated events without unique event IDs.',
      expectedImpact: 'Improves statistical integrity and uniqueness rating.',
      fixType: 'drop_duplicates',
      suggestedAction: { type: 'remove_duplicates' },
      status: 'DETECTED'
    });
  }

  // 2. COLUMN-BY-COLUMN ANALYSIS (20 Dimensions)
  for (const col of columns) {
    const profile = profiles[col];
    if (!profile) continue;

    missingCellsTotal += profile.nullCount;
    const rawValues = rows.map(r => r[col]);
    const validValues = rawValues.filter(v => v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && isNaN(v)));

    // Dimension: MISSING VALUES & MOSTLY MISSING COLUMNS
    if (profile.nullCount > 0) {
      if (profile.nullPercentage >= 70) {
        issues.push({
          id: `issue-mostly-missing-${col}`,
          dimension: 'mostly_missing_columns',
          column: col,
          problem: `Column "${col}" is mostly missing (${profile.nullPercentage}% nulls, ${profile.nullCount} rows).`,
          evidence: `${profile.nullCount} out of ${totalRows} records are null or empty.`,
          severity: 'HIGH',
          affectedRows: profile.nullCount,
          affectedPercentage: profile.nullPercentage,
          recommendedAction: `Consider dropping "${col}" or investigating data ingestion pipeline failure.`,
          whyExplanation: `Columns with over 70% missing data lack sufficient variance to inform reliable predictive modeling or descriptive insights.`,
          whatWillChange: `Column "${col}" will be removed from the working dataset.`,
          risks: 'Ensure this column is not an essential reporting field or regulatory identifier.',
          whenNotToApply: 'Do not drop if missingness itself is an informative indicator (e.g. secondary insurance code).',
          expectedImpact: `Eliminates high-sparsity noise from analysis.`,
          fixType: 'drop_column',
          suggestedAction: { type: 'drop_column', column: col },
          status: 'DETECTED'
        });
      } else {
        const severity = profile.nullPercentage > 20 ? 'HIGH' : profile.nullPercentage > 5 ? 'MEDIUM' : 'LOW';
        let rec = '';
        let fix: QualityIssue['fixType'] = 'drop_missing';
        let suggestedAction: any = { type: 'drop_missing', column: col };
        let whyExp = '';

        if (profile.type === 'numeric') {
          const isSkewed = Math.abs(profile.skewness || 0) > 1;
          if (isSkewed) {
            rec = `Impute missing values using the median (${profile.median?.toLocaleString()}) to resist skewness.`;
            fix = 'fill_median';
            suggestedAction = { type: 'impute_missing', column: col, strategy: 'median' };
            whyExp = `The distribution is skewed (skewness: ${profile.skewness}). Median imputation is more robust than mean.`;
          } else {
            rec = `Impute missing values using the mean (${profile.mean?.toLocaleString()}) or median.`;
            fix = 'fill_mean';
            suggestedAction = { type: 'impute_missing', column: col, strategy: 'mean' };
            whyExp = `The distribution is approximately symmetric. Mean imputation preserves the expected total.`;
          }
        } else if (profile.type === 'categorical') {
          const modeVal = profile.topValues?.[0]?.value || 'Unknown';
          rec = `Impute missing categories with mode "${modeVal}" or placeholder "Unknown".`;
          fix = 'fill_mode';
          suggestedAction = { type: 'impute_missing', column: col, strategy: 'mode' };
          whyExp = `Categorical columns cannot be averaged; mode represents the most probable value.`;
        } else {
          rec = `Drop rows with missing values or fill with standard placeholder.`;
          fix = 'drop_missing';
          suggestedAction = { type: 'drop_missing', column: col };
          whyExp = `Text or ID fields cannot be safely imputed with statistical central tendencies.`;
        }

        issues.push({
          id: `issue-missing-${col}`,
          dimension: 'missing_values',
          column: col,
          problem: `${profile.nullCount} missing cells detected in "${col}" (${profile.nullPercentage}% of records).`,
          evidence: `Found ${profile.nullCount} empty, null, NaN, or placeholder strings ('NA', 'N/A', '-') in "${col}".`,
          severity,
          affectedRows: profile.nullCount,
          affectedPercentage: profile.nullPercentage,
          recommendedAction: rec,
          whyExplanation: whyExp,
          whatWillChange: `${profile.nullCount} missing cells will be replaced with calculated values.`,
          risks: 'Imputation reduces variance slightly. Consider whether data is Missing Completely at Random (MCAR).',
          whenNotToApply: 'Do not impute if missingness represents non-applicable conditions (e.g. no second phone number).',
          expectedImpact: `Brings "${col}" to 100% completeness.`,
          fixType: fix,
          suggestedAction,
          status: 'DETECTED'
        });
      }
    }

    // Dimension: DUPLICATE IDS IN IDENTIFIER COLUMNS
    if (profile.isPotentialId && profile.uniqueCount < totalRows && totalRows > 1) {
      const duplicateIdCount = totalRows - profile.uniqueCount;
      const dupIdPct = Math.round((duplicateIdCount / totalRows) * 10000) / 100;
      issues.push({
        id: `issue-dup-id-${col}`,
        dimension: 'duplicate_ids',
        column: col,
        problem: `Potential identifier column "${col}" contains ${duplicateIdCount} duplicate keys.`,
        evidence: `Column name or pattern suggests unique ID, but ${profile.uniqueCount} unique keys exist across ${totalRows} rows.`,
        severity: 'HIGH',
        affectedRows: duplicateIdCount,
        affectedPercentage: dupIdPct,
        recommendedAction: `Investigate duplicate "${col}" values. Remove duplicate entries or retain the most recent record.`,
        whyExplanation: 'Identifier columns should be primary keys. Duplicate IDs cause join multiplication and entity collision.',
        whatWillChange: `Duplicate instances of "${col}" will be filtered down to unique rows.`,
        risks: 'Verify whether multiple rows per ID represent multi-item child records (e.g. multiple items in one Order_ID).',
        whenNotToApply: 'Do not remove if the dataset is a transactional line-item table where Order_ID is repeated per SKU.',
        expectedImpact: 'Ensures primary key uniqueness.',
        fixType: 'drop_duplicate_ids',
        suggestedAction: { type: 'remove_duplicate_ids', column: col, keep: 'first' },
        status: 'DETECTED'
      });
    }

    // Dimension: INCORRECT DATA TYPES
    if (profile.recommendedType && profile.recommendedType !== profile.type) {
      issues.push({
        id: `issue-type-${col}`,
        dimension: 'incorrect_types',
        column: col,
        problem: `Column "${col}" is stored as "${profile.type}" but appears to be "${profile.recommendedType}" (${profile.detectedTypeConfidence}% confidence).`,
        evidence: `Sample values like "${profile.sampleValues.slice(0, 3).join(', ')}" can be parsed cleanly as ${profile.recommendedType}.`,
        severity: 'MEDIUM',
        affectedRows: totalRows,
        affectedPercentage: 100,
        recommendedAction: `Convert "${col}" from ${profile.type} to ${profile.recommendedType} to unlock quantitative calculations and aggregations.`,
        whyExplanation: `Storing numbers or dates as text prevents mathematical operations, sorting, and time-series aggregations.`,
        whatWillChange: `String values will be parsed into native ${profile.recommendedType} types (removing symbols like $, %, commas).`,
        risks: 'Non-parseable values may become null if unhandled.',
        whenNotToApply: 'Do not convert if leading zeros are semantically meaningful (e.g. US Zip Codes like "01234").',
        expectedImpact: `Enables numeric sums, averages, and statistical modeling.`,
        fixType: 'convert_type',
        suggestedAction: { type: 'convert_type', column: col, targetType: profile.recommendedType },
        status: 'DETECTED'
      });
    }

    // Dimension: TEXT STANDARDIZATION, LEADING/TRAILING WHITESPACE & CASING INCONSISTENCIES
    if (profile.type === 'categorical' || profile.type === 'text') {
      const textValues = validValues.map(v => String(v));
      let whitespaceCount = 0;
      for (const val of textValues) {
        if (val !== val.trim()) {
          whitespaceCount++;
        }
      }

      if (whitespaceCount > 0) {
        const wsPct = Math.round((whitespaceCount / totalRows) * 10000) / 100;
        issues.push({
          id: `issue-ws-${col}`,
          dimension: 'whitespace_padding',
          column: col,
          problem: `Leading or trailing whitespace detected in ${whitespaceCount} entries of "${col}".`,
          evidence: `Values contain invisible prefix/suffix spaces (e.g. ' ${textValues.find(v => v !== v.trim())} ').`,
          severity: 'LOW',
          affectedRows: whitespaceCount,
          affectedPercentage: wsPct,
          recommendedAction: `Trim whitespace across "${col}" to merge accidentally fragmented categories.`,
          whyExplanation: 'Whitespace causes strings like "Apple" and " Apple " to be treated as separate categories.',
          whatWillChange: `All leading and trailing whitespace characters will be trimmed.`,
          risks: 'Very low risk.',
          whenNotToApply: 'Only avoid if fixed-width space indentation is required by a legacy export format.',
          expectedImpact: 'Cleans category cardinality and improves group aggregations.',
          fixType: 'trim_whitespace',
          suggestedAction: { type: 'trim_whitespace', column: col },
          status: 'DETECTED'
        });
      }

      // Case variants
      if (profile.caseVariants && profile.caseVariants.length > 0) {
        const totalVariantRows = profile.caseVariants.reduce((acc, c) => acc + c.count, 0);
        const casePct = Math.round((totalVariantRows / totalRows) * 10000) / 100;
        const sampleCase = profile.caseVariants[0];

        issues.push({
          id: `issue-case-${col}`,
          dimension: 'casing_inconsistency',
          column: col,
          problem: `Inconsistent capitalization detected in "${col}" across ${profile.caseVariants.length} distinct terms.`,
          evidence: `Variants detected such as [${sampleCase.variants.map(v => `'${v}'`).join(', ')}] for standard '${sampleCase.standard}'.`,
          severity: 'LOW',
          affectedRows: totalVariantRows,
          affectedPercentage: casePct,
          recommendedAction: `Normalize casing of "${col}" to Title Case or standard convention.`,
          whyExplanation: 'Capitalization differences (e.g. "North", "north", "NORTH") fragment grouped analytics.',
          whatWillChange: `All values in "${col}" will be normalized to Title Case.`,
          risks: 'Low risk. Verify if specific acronyms (e.g. "USA", "UK") should retain all-caps.',
          whenNotToApply: 'Do not normalize if case distinctions carry specific semantic meaning (e.g. case-sensitive security codes).',
          expectedImpact: 'Harmonizes category definitions and reduces false cardinality.',
          fixType: 'normalize_case',
          suggestedAction: { type: 'standardize_case', column: col, caseFormat: 'title' },
          status: 'DETECTED'
        });
      }
    }

    // Dimension: OUTLIER DETECTION (IQR & Z-SCORE)
    if (profile.type === 'numeric' && (profile.outlierCount || 0) > 0) {
      const outlierCount = profile.outlierCount!;
      const pct = profile.outlierPercentage || 0;
      outliersTotal += outlierCount;

      if (pct > 2) {
        const severity = pct > 15 ? 'HIGH' : 'MEDIUM';
        const q1 = profile.q1 ?? 0;
        const q3 = profile.q3 ?? 0;
        const iqr = profile.iqr ?? 1;
        const lowerBound = Math.round((q1 - 1.5 * iqr) * 100) / 100;
        const upperBound = Math.round((q3 + 1.5 * iqr) * 100) / 100;

        issues.push({
          id: `issue-outliers-${col}`,
          dimension: 'outliers_iqr',
          column: col,
          problem: `${outlierCount} extreme statistical outliers detected in "${col}" (${pct}% outside 1.5x IQR).`,
          evidence: `Data bounds are [${lowerBound} to ${upperBound}], but values range from ${profile.min} to ${profile.max}. Z-Score (|z|>3) flags ${profile.zScoreOutlierCount || 0} observations.`,
          severity,
          affectedRows: outlierCount,
          affectedPercentage: pct,
          recommendedAction: `Inspect extreme observations. Consider Winsorizing / capping at IQR bounds or replacing with median.`,
          whyExplanation: 'Extreme outliers heavily distort Pearson correlations, linear regression coefficients, and mean calculations.',
          whatWillChange: `Outlier values beyond [${lowerBound}, ${upperBound}] will be capped at the threshold boundary.`,
          risks: 'Outliers may represent legitimate high-value transactions (e.g. enterprise enterprise sales).',
          whenNotToApply: 'Do not cap if extreme observations represent genuine business reality that must be modeled.',
          expectedImpact: 'Reduces model sensitivity to extreme spikes while preserving total row count.',
          fixType: 'cap_outliers',
          suggestedAction: { type: 'cap_outliers', column: col, bounds: { lower: lowerBound, upper: upperBound } },
          status: 'DETECTED'
        });
      }
    }

    // Dimension: SUSPICIOUS & INAPPROPRIATE NEGATIVE VALUES
    if (profile.type === 'numeric' && profile.min !== undefined && profile.min < 0) {
      const isNaturallyNegativeAllowed = /profit|return|delta|change|growth|variance|diff|balance|loss|temperature|lat|long/i.test(col);
      const isStrictlyNonNegative = /age|price|cost|salary|revenue|sales|quantity|count|tenure|days|distance|height|weight|speed|volume|discount/i.test(col);

      if (isStrictlyNonNegative && !isNaturallyNegativeAllowed) {
        const negativeRows = validValues.filter(v => typeof v === 'number' && v < 0).length;
        if (negativeRows > 0) {
          invalidValuesTotal += negativeRows;
          const negPct = Math.round((negativeRows / totalRows) * 10000) / 100;
          issues.push({
            id: `issue-neg-${col}`,
            dimension: 'negative_values',
            column: col,
            problem: `Inappropriate negative values detected in "${col}" (${negativeRows} rows, min: ${profile.min}).`,
            evidence: `Domain semantics of "${col}" (e.g. age, sales, quantity) cannot be negative, but minimum value is ${profile.min}.`,
            severity: 'HIGH',
            affectedRows: negativeRows,
            affectedPercentage: negPct,
            recommendedAction: `Convert negative values to absolute values or replace with median (${profile.median}).`,
            whyExplanation: `Negative values in strict positive domains indicate sign errors or corrupted transaction logs.`,
            whatWillChange: `Negative values will be converted to positive magnitudes or imputed.`,
            risks: 'Confirm whether negative numbers were used as special error codes (e.g. -999 for missing).',
            whenNotToApply: 'Do not modify if negative numbers represent cancellations or accounting credits.',
            expectedImpact: 'Restores logical data domain validity.',
            fixType: 'fill_median',
            suggestedAction: { type: 'impute_missing', column: col, strategy: 'median' },
            status: 'DETECTED'
          });
        }
      }
    }

    // Dimension: IMPOSSIBLE VALUES
    if (profile.type === 'numeric') {
      const isAge = /age/i.test(col);
      const isPercentage = /percent|percentage|ratio|rate|pct/i.test(col);

      if (isAge && profile.max !== undefined && profile.max > 130) {
        const impossibleCount = validValues.filter(v => Number(v) > 130).length;
        invalidValuesTotal += impossibleCount;
        issues.push({
          id: `issue-impossible-age-${col}`,
          dimension: 'impossible_values',
          column: col,
          problem: `Physiologically impossible age values detected in "${col}" (max: ${profile.max}).`,
          evidence: `${impossibleCount} records exceed 130 years old, likely placeholder codes (e.g. 999).`,
          severity: 'HIGH',
          affectedRows: impossibleCount,
          affectedPercentage: Math.round((impossibleCount / totalRows) * 10000) / 100,
          recommendedAction: `Impute impossible values with median age (${profile.median}).`,
          whyExplanation: 'Human age exceeding 130 years represents corrupted entry or missing data code.',
          whatWillChange: `Ages > 130 will be replaced with median (${profile.median}).`,
          risks: 'Low risk.',
          whenNotToApply: 'Only avoid if measuring non-human entities (e.g. building age).',
          expectedImpact: 'Corrects demographic validity.',
          fixType: 'fill_median',
          suggestedAction: { type: 'impute_missing', column: col, strategy: 'median' },
          status: 'DETECTED'
        });
      }

      if (isPercentage && profile.max !== undefined && profile.max > 100 && (profile.min ?? 0) >= 0 && profile.mean !== undefined && profile.mean < 200) {
        const overHundred = validValues.filter(v => Number(v) > 100).length;
        if (overHundred > 0 && overHundred < totalRows * 0.1) {
          invalidValuesTotal += overHundred;
          issues.push({
            id: `issue-impossible-pct-${col}`,
            dimension: 'impossible_values',
            column: col,
            problem: `Percentage values exceeding 100% detected in "${col}" (max: ${profile.max}%).`,
            evidence: `${overHundred} records exceed standard 0-100% boundary.`,
            severity: 'MEDIUM',
            affectedRows: overHundred,
            affectedPercentage: Math.round((overHundred / totalRows) * 10000) / 100,
            recommendedAction: `Cap values at 100% or inspect whether decimals vs whole percentages are mixed.`,
            whyExplanation: 'Standard ratios/percentages cannot exceed 100% unless representing relative growth.',
            whatWillChange: `Out-of-range percentage values will be capped at 100%.`,
            risks: 'Check if metric represents growth rate (e.g. 150% YoY growth).',
            whenNotToApply: 'Do not cap if the metric measures growth rates rather than bounded shares.',
            expectedImpact: 'Restores percentage scale integrity.',
            fixType: 'cap_outliers',
            suggestedAction: { type: 'cap_outliers', column: col, bounds: { lower: 0, upper: 100 } },
            status: 'DETECTED'
          });
        }
      }
    }

    // Dimension: CONSTANT & NEAR-CONSTANT COLUMNS
    if (profile.isConstant && totalRows > 5) {
      issues.push({
        id: `issue-const-${col}`,
        dimension: 'constant_columns',
        column: col,
        problem: `Constant column: "${col}" contains only 1 unique value across all ${totalRows} rows.`,
        evidence: `Every record has the exact same value: "${profile.sampleValues[0]}".`,
        severity: 'MEDIUM',
        affectedRows: totalRows,
        affectedPercentage: 100,
        recommendedAction: `Remove "${col}" as zero-variance columns provide no analytical utility.`,
        whyExplanation: 'Constant columns have zero mutual information and cause multicollinearity in linear models.',
        whatWillChange: `Column "${col}" will be dropped.`,
        risks: 'Low risk. Check if required for external table joins.',
        whenNotToApply: 'Do not drop if this file will be concatenated with other datasets where this value varies.',
        expectedImpact: 'Reduces memory footprint and simplifies schema.',
        fixType: 'drop_column',
        suggestedAction: { type: 'drop_column', column: col },
        status: 'DETECTED'
      });
    } else if (profile.isNearConstant && totalRows > 20) {
      issues.push({
        id: `issue-near-const-${col}`,
        dimension: 'near_constant_columns',
        column: col,
        problem: `Near-constant column: "${col}" has ${profile.dominantValuePercentage}% identical dominant values.`,
        evidence: `Top value "${profile.topValues?.[0]?.value}" appears in ${profile.dominantValuePercentage}% of all rows.`,
        severity: 'LOW',
        affectedRows: totalRows,
        affectedPercentage: profile.dominantValuePercentage || 95,
        recommendedAction: `Review whether "${col}" contributes useful signal or should be pruned.`,
        whyExplanation: 'Extremely skewed categorical features can cause severe class imbalance in machine learning.',
        whatWillChange: `Informational warning. Column remains unchanged unless explicitly dropped.`,
        risks: 'The rare class (5% or less) might be the target anomaly.',
        whenNotToApply: 'Do not drop if the rare class represents the target event (e.g. fraud detection).',
        expectedImpact: 'Highlights potential feature selection opportunities.',
        fixType: 'inspect_only',
        status: 'DETECTED'
      });
    }

    // Dimension: INVALID DATES
    if (profile.type === 'datetime' && (profile.invalidDateCount || 0) > 0) {
      invalidValuesTotal += profile.invalidDateCount!;
      const invPct = Math.round((profile.invalidDateCount! / totalRows) * 10000) / 100;
      issues.push({
        id: `issue-invalid-date-${col}`,
        dimension: 'invalid_dates',
        column: col,
        problem: `${profile.invalidDateCount} unparseable or invalid date values detected in "${col}".`,
        evidence: `Values cannot be resolved to ISO standard timestamps.`,
        severity: 'HIGH',
        affectedRows: profile.invalidDateCount!,
        affectedPercentage: invPct,
        recommendedAction: `Standardize date formats (e.g. YYYY-MM-DD) or drop rows with corrupted dates.`,
        whyExplanation: 'Invalid dates break time-series indexing and temporal grouping.',
        whatWillChange: `Invalid date strings will be standardized or coerced to null for imputation.`,
        risks: 'Verify ambiguous formats like MM/DD/YYYY vs DD/MM/YYYY.',
        whenNotToApply: 'Do not auto-convert without checking regional locale convention.',
        expectedImpact: 'Restores time-series integrity.',
        fixType: 'convert_type',
        suggestedAction: { type: 'convert_type', column: col, targetType: 'datetime' },
        status: 'DETECTED'
      });
    }
  }

  // 3. DATA QUALITY SCORE CALCULATION (0 - 100) WITH TRANSPARENT EXPLANATION
  const missingCellsPercentage = totalCells > 0 ? Math.round((missingCellsTotal / totalCells) * 10000) / 100 : 0;
  const completeness = Math.max(0, Math.min(100, Math.round(100 - missingCellsPercentage * 2.5)));

  const uniqueness = Math.max(0, Math.min(100, Math.round(100 - dupRowPercentage * 5)));

  const criticalIssues = issues.filter(i => i.severity === 'CRITICAL').length;
  const highIssues = issues.filter(i => i.severity === 'HIGH').length;
  const mediumIssues = issues.filter(i => i.severity === 'MEDIUM').length;
  const lowIssues = issues.filter(i => i.severity === 'LOW').length;
  const infoIssues = issues.filter(i => i.severity === 'INFO').length;

  const validityPenalty = criticalIssues * 20 + highIssues * 10 + invalidValuesTotal * 0.5;
  const validity = Math.max(0, Math.min(100, Math.round(100 - validityPenalty)));

  const typeConsistencyPenalty = issues.filter(i => i.dimension === 'incorrect_types').length * 15;
  const typeConsistency = Math.max(0, Math.min(100, 100 - typeConsistencyPenalty));

  const categoryPenalty = issues.filter(i => i.dimension === 'casing_inconsistency' || i.dimension === 'whitespace_padding').length * 10;
  const categoryConsistency = Math.max(0, Math.min(100, 100 - categoryPenalty));

  const outlierPenalty = Math.min(30, (outliersTotal / Math.max(1, totalRows)) * 100 * 1.5);
  const outlierHealth = Math.max(0, Math.min(100, Math.round(100 - outlierPenalty)));

  // Weighted score formulation:
  // Completeness: 30%, Uniqueness: 20%, Validity: 20%, Type Consistency: 10%, Category Consistency: 10%, Outlier Health: 10%
  const score = Math.max(5, Math.min(100, Math.round(
    completeness * 0.30 +
    uniqueness * 0.20 +
    validity * 0.20 +
    typeConsistency * 0.10 +
    categoryConsistency * 0.10 +
    outlierHealth * 0.10
  )));

  let rating: DataQualityReport['rating'] = 'EXCELLENT';
  if (score >= 90) rating = 'EXCELLENT';
  else if (score >= 75) rating = 'GOOD';
  else if (score >= 50) rating = 'NEEDS ATTENTION';
  else rating = 'CRITICAL ISSUES';

  // Transparent Score Explanation Items
  const scoreExplanations: ScoreExplanationItem[] = [
    {
      dimension: 'Completeness',
      weight: 30,
      score: completeness,
      penalty: Math.round((100 - completeness) * 0.30),
      reason: missingCellsTotal === 0
        ? 'Zero missing cells detected (100% complete data structure).'
        : `${missingCellsTotal.toLocaleString()} missing cells (${missingCellsPercentage}% null rate).`
    },
    {
      dimension: 'Uniqueness',
      weight: 20,
      score: uniqueness,
      penalty: Math.round((100 - uniqueness) * 0.20),
      reason: duplicateRowCount === 0
        ? 'All rows and identifier keys are unique.'
        : `${duplicateRowCount} duplicate records detected (${dupRowPercentage}% redundancy).`
    },
    {
      dimension: 'Validity',
      weight: 20,
      score: validity,
      penalty: Math.round((100 - validity) * 0.20),
      reason: invalidValuesTotal === 0 && criticalIssues === 0
        ? 'Values conform to expected mathematical and schema constraints.'
        : `${criticalIssues} critical and ${highIssues} high severity anomalies detected.`
    },
    {
      dimension: 'Type Consistency',
      weight: 10,
      score: typeConsistency,
      penalty: Math.round((100 - typeConsistency) * 0.10),
      reason: typeConsistency === 100
        ? 'All columns match appropriate native storage data types.'
        : `${issues.filter(i => i.dimension === 'incorrect_types').length} columns stored as text should be converted to numeric/date.`
    },
    {
      dimension: 'Category Consistency',
      weight: 10,
      score: categoryConsistency,
      penalty: Math.round((100 - categoryConsistency) * 0.10),
      reason: categoryConsistency === 100
        ? 'Clean casing and zero whitespace padding across text features.'
        : 'Inconsistent capitalization or whitespace padding fragments categorical groups.'
    },
    {
      dimension: 'Outlier Health',
      weight: 10,
      score: outlierHealth,
      penalty: Math.round((100 - outlierHealth) * 0.10),
      reason: outliersTotal === 0
        ? 'Distributions show healthy dispersion without excessive tail skew.'
        : `${outliersTotal} statistical outliers detected outside 1.5x IQR boundaries.`
    }
  ];

  const columnsWithIssues = new Set(issues.map(i => i.column).filter(c => c !== '(All Columns)'));

  return {
    score,
    rating,
    totalIssues: issues.length,
    criticalIssues,
    highIssues,
    mediumIssues,
    lowIssues,
    infoIssues,
    duplicateRows: duplicateRowCount,
    duplicateRowPercentage: dupRowPercentage,
    missingCellsTotal,
    missingCellsPercentage,
    invalidValuesTotal,
    outliersTotal,
    columnsWithIssuesCount: columnsWithIssues.size,
    issues,
    metricsBreakdown: {
      completeness,
      uniqueness,
      validity,
      typeConsistency,
      categoryConsistency,
      outlierHealth
    },
    scoreExplanations
  };
}
