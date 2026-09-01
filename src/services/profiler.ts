import * as ss from 'simple-statistics';
import { ColumnProfile, ColumnType } from '../types/dataset';
import { inferColumnType } from './dataParser';

export function profileDataset(rows: Record<string, any>[], columns: string[]): Record<string, ColumnProfile> {
  const profiles: Record<string, ColumnProfile> = {};
  const totalCount = rows.length;

  for (const col of columns) {
    const rawValues = rows.map(r => r[col]);

    // Enhanced Null & Missing pattern detection
    const isMissingValue = (v: any): boolean => {
      if (v === null || v === undefined) return true;
      if (typeof v === 'number' && isNaN(v)) return true;
      if (typeof v === 'string') {
        const trimmed = v.trim().toLowerCase();
        if (trimmed === '') return true;
        if (['na', 'n/a', 'null', 'none', '-', '--', 'undefined', 'missing', '#n/a', 'nil'].includes(trimmed)) return true;
      }
      return false;
    };

    const nullValues = rawValues.filter(isMissingValue);
    const nullCount = nullValues.length;
    const nullPercentage = totalCount > 0 ? Math.round((nullCount / totalCount) * 10000) / 100 : 0;
    const validValues = rawValues.filter(v => !isMissingValue(v));

    const colType: ColumnType = inferColumnType(validValues);

    // Unique values
    const stringified = validValues.map(v => String(v).trim());
    const uniqueSet = new Set(stringified);
    const uniqueCount = uniqueSet.size;
    const cardinalityRatio = totalCount > 0 ? Math.round((uniqueCount / totalCount) * 10000) / 100 : 0;
    const sampleValues = validValues.slice(0, 5);

    // Deep Type Recommendation and Confidence Analysis
    let recommendedType: ColumnType | undefined = undefined;
    let detectedTypeConfidence = 100;

    if (colType === 'text' || colType === 'categorical') {
      let numericConvertibleCount = 0;
      let dateConvertibleCount = 0;

      for (const val of validValues) {
        const s = String(val).trim();
        // Check clean number, currency, or percentage
        const cleanNum = s.replace(/[\$,€,£,₹,¥,%,,\s]/g, '');
        if (cleanNum !== '' && !isNaN(Number(cleanNum)) && isFinite(Number(cleanNum))) {
          numericConvertibleCount++;
        }
        // Check date
        if (s.length >= 6 && !isNaN(Date.parse(s)) && !/^\d+$/.test(s)) {
          dateConvertibleCount++;
        }
      }

      if (validValues.length > 0) {
        const numRate = numericConvertibleCount / validValues.length;
        const dateRate = dateConvertibleCount / validValues.length;

        if (numRate >= 0.90) {
          recommendedType = 'numeric';
          detectedTypeConfidence = Math.round(numRate * 100);
        } else if (dateRate >= 0.85) {
          recommendedType = 'datetime';
          detectedTypeConfidence = Math.round(dateRate * 100);
        }
      }
    }

    const profile: ColumnProfile = {
      name: col,
      type: colType,
      inferredType: colType,
      recommendedType,
      detectedTypeConfidence,
      totalCount,
      nullCount,
      nullPercentage,
      uniqueCount,
      cardinalityRatio,
      sampleValues
    };

    // ID detection
    const isIdName = /id|uuid|key|code|guid|ssn|identifier|token/i.test(col);
    if ((isIdName && uniqueCount > totalCount * 0.7) || (uniqueCount === totalCount && totalCount > 5)) {
      profile.isPotentialId = true;
    }

    // High cardinality
    if (uniqueCount > 20 && cardinalityRatio > 80 && !profile.isPotentialId) {
      profile.isHighCardinality = true;
    }

    // Numerical stats
    if (colType === 'numeric' && validValues.length > 0) {
      const numbers = validValues
        .map(v => (typeof v === 'number' ? v : Number(String(v).replace(/[\$,€,£,₹,¥,%,,\s]/g, '').trim())))
        .filter(n => !isNaN(n) && isFinite(n));

      if (numbers.length > 0) {
        const sorted = [...numbers].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const mean = Math.round(ss.mean(sorted) * 1000) / 1000;
        const median = Math.round(ss.median(sorted) * 1000) / 1000;
        const variance = sorted.length > 1 ? Math.round(ss.variance(sorted) * 1000) / 1000 : 0;
        const stdDev = sorted.length > 1 ? Math.round(ss.standardDeviation(sorted) * 1000) / 1000 : 0;

        const q1 = Math.round(ss.quantile(sorted, 0.25) * 1000) / 1000;
        const q2 = median;
        const q3 = Math.round(ss.quantile(sorted, 0.75) * 1000) / 1000;
        const iqr = Math.round((q3 - q1) * 1000) / 1000;

        // Skewness
        let skewness = 0;
        if (sorted.length > 2 && stdDev > 0) {
          try {
            skewness = Math.round(ss.sampleSkewness(sorted) * 1000) / 1000;
          } catch (e) {
            skewness = 0;
          }
        }

        // Outliers via 1.5 IQR
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        const outliers = sorted.filter(v => v < lowerBound || v > upperBound);
        const outlierCount = outliers.length;
        const outlierPercentage = Math.round((outlierCount / sorted.length) * 10000) / 100;

        // Outliers via Z-score (|z| > 3)
        let zScoreOutlierCount = 0;
        if (stdDev > 0) {
          zScoreOutlierCount = sorted.filter(v => Math.abs((v - mean) / stdDev) > 3).length;
        }

        // Histogram
        const binCount = Math.min(8, Math.max(4, Math.floor(Math.sqrt(sorted.length))));
        const binWidth = (max - min) / binCount || 1;
        const histogram: { bin: string; count: number; min: number; max: number }[] = [];

        for (let i = 0; i < binCount; i++) {
          const bMin = min + i * binWidth;
          const bMax = i === binCount - 1 ? max : min + (i + 1) * binWidth;
          const count = sorted.filter(v =>
            i === binCount - 1 ? v >= bMin && v <= bMax : v >= bMin && v < bMax
          ).length;
          histogram.push({
            bin: `${Math.round(bMin * 10) / 10} - ${Math.round(bMax * 10) / 10}`,
            count,
            min: Math.round(bMin * 100) / 100,
            max: Math.round(bMax * 100) / 100
          });
        }

        profile.min = min;
        profile.max = max;
        profile.mean = mean;
        profile.median = median;
        profile.variance = variance;
        profile.stdDev = stdDev;
        profile.q1 = q1;
        profile.q2 = q2;
        profile.q3 = q3;
        profile.iqr = iqr;
        profile.skewness = skewness;
        profile.outlierCount = outlierCount;
        profile.outlierPercentage = outlierPercentage;
        profile.zScoreOutlierCount = zScoreOutlierCount;
        profile.histogram = histogram;
      }
    }

    // Categorical & Text Analysis (Dominance & Case Variants)
    if (validValues.length > 0) {
      const counts: Record<string, number> = {};
      const caseGroups = new Map<string, Map<string, number>>();

      for (const val of validValues) {
        const rawStr = String(val);
        const trimmed = rawStr.trim();
        counts[trimmed] = (counts[trimmed] || 0) + 1;

        const lower = trimmed.toLowerCase();
        if (!caseGroups.has(lower)) {
          caseGroups.set(lower, new Map());
        }
        const inner = caseGroups.get(lower)!;
        inner.set(trimmed, (inner.get(trimmed) || 0) + 1);
      }

      const sortedEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const topCount = sortedEntries[0]?.[1] || 0;
      const dominantValuePercentage =
        validValues.length > 0 ? Math.round((topCount / validValues.length) * 10000) / 100 : 0;

      profile.dominantValuePercentage = dominantValuePercentage;
      profile.isConstant = uniqueCount === 1;
      profile.isNearConstant = dominantValuePercentage >= 95 && uniqueCount > 1;

      profile.topValues = sortedEntries.slice(0, 10).map(([value, count]) => ({
        value,
        count,
        percentage: Math.round((count / validValues.length) * 10000) / 100
      }));

      // Detect case variants
      const caseVariants: { standard: string; variants: string[]; count: number }[] = [];
      for (const [_, innerMap] of caseGroups.entries()) {
        if (innerMap.size > 1) {
          const variants = Array.from(innerMap.keys());
          // Pick most frequent as standard
          const standard = variants.sort((a, b) => (innerMap.get(b) || 0) - (innerMap.get(a) || 0))[0];
          const totalVariantCount = variants.reduce((acc, v) => acc + (innerMap.get(v) || 0), 0);
          caseVariants.push({
            standard,
            variants,
            count: totalVariantCount
          });
        }
      }
      if (caseVariants.length > 0) {
        profile.caseVariants = caseVariants;
      }
    }

    // Datetime stats & validation
    if (colType === 'datetime' && validValues.length > 0) {
      let invalidDateCount = 0;
      const timestamps: number[] = [];

      for (const val of validValues) {
        const parsed = val instanceof Date ? val.getTime() : Date.parse(String(val));
        if (isNaN(parsed)) {
          invalidDateCount++;
        } else {
          timestamps.push(parsed);
        }
      }

      timestamps.sort((a, b) => a - b);
      if (timestamps.length > 0) {
        const minT = new Date(timestamps[0]);
        const maxT = new Date(timestamps[timestamps.length - 1]);
        const diffDays = Math.round(
          (timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60 * 60 * 24)
        );

        profile.minDate = minT.toISOString().split('T')[0];
        profile.maxDate = maxT.toISOString().split('T')[0];
        profile.dateRangeDays = diffDays;
      }
      profile.invalidDateCount = invalidDateCount;
    }

    profiles[col] = profile;
  }

  return profiles;
}
