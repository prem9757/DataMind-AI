// ============================================================================
// PHASE 9: SCHEMA INTELLIGENCE & KEY DETECTION ENGINE
// ============================================================================

import {
  WorkspaceColumnSchema,
  PrimaryKeyCandidate,
  ForeignKeyCandidate,
  RelationshipCardinality,
  SemanticRole,
  DetectedUnit,
  SchemaConflict,
  DuplicateEntityCandidate
} from '../types/workspace';
import { DatasetState } from '../types/dataset';

export class SchemaEngine {
  /**
   * Generates a comprehensive column schema for a dataset with semantic detection,
   * primary key scoring, and unit identification.
   */
  public static analyzeDatasetSchema(
    datasetId: string,
    datasetName: string,
    state: DatasetState
  ): {
    schemas: WorkspaceColumnSchema[];
    primaryKeys: PrimaryKeyCandidate[];
  } {
    const { workingRows, columns, profiles } = state;
    const totalRows = workingRows.length;

    const schemas: WorkspaceColumnSchema[] = [];
    const primaryKeys: PrimaryKeyCandidate[] = [];

    for (const col of columns) {
      const prof = profiles[col];
      const values = workingRows.map(r => r[col]);
      const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
      const nullCount = totalRows - nonNullValues.length;
      const nullPercentage = totalRows > 0 ? (nullCount / totalRows) * 100 : 0;
      const nonNullPercentage = 100 - nullPercentage;

      const distinctVals = new Set(nonNullValues.map(v => String(v).trim()));
      const distinctCount = distinctVals.size;
      const uniqueness = nonNullValues.length > 0 ? (distinctCount / nonNullValues.length) * 100 : 0;

      // Determine Cardinality Tier
      let cardinality: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNIQUE' = 'LOW';
      if (uniqueness >= 99.5 && nonNullPercentage >= 99) {
        cardinality = 'UNIQUE';
      } else if (distinctCount > 50 || (totalRows > 0 && distinctCount / totalRows > 0.4)) {
        cardinality = 'HIGH';
      } else if (distinctCount > 10) {
        cardinality = 'MEDIUM';
      }

      // Infer Data Type
      const profType = prof?.type || 'string';
      let dataType: 'string' | 'number' | 'boolean' | 'datetime' | 'categorical' = 'string';
      if (profType === 'numeric') dataType = 'number';
      else if (profType === 'datetime') dataType = 'datetime';
      else if (profType === 'boolean') dataType = 'boolean';
      else if (profType === 'categorical') dataType = 'categorical';

      // Detect Semantic Role
      const semanticRole = this.detectSemanticRole(col, dataType, uniqueness, distinctCount, totalRows);

      // Detect Units and Currencies
      const detectedUnit = this.detectUnit(col, nonNullValues);

      // Calculate Primary Key Confidence
      const { isPotentialPK, confidence, reasoning } = this.calculatePrimaryKeyConfidence(
        col,
        dataType,
        uniqueness,
        nonNullPercentage,
        distinctCount,
        totalRows,
        nonNullValues
      );

      if (isPotentialPK) {
        primaryKeys.push({
          column: col,
          uniqueness: Math.round(uniqueness * 10) / 10,
          nonNullPercentage: Math.round(nonNullPercentage * 10) / 10,
          confidence,
          reasoning
        });
      }

      schemas.push({
        column: col,
        dataType,
        nullable: nullCount > 0,
        nullCount,
        nullPercentage: Math.round(nullPercentage * 10) / 10,
        distinctCount,
        cardinality,
        sampleValues: nonNullValues.slice(0, 5),
        semanticRole,
        detectedUnit,
        isPotentialPrimaryKey: isPotentialPK,
        primaryKeyConfidence: confidence
      });
    }

    // Sort PK candidates by confidence descending
    primaryKeys.sort((a, b) => b.confidence - a.confidence);

    return { schemas, primaryKeys };
  }

  /**
   * Detects semantic analytical role for a column
   */
  private static detectSemanticRole(
    col: string,
    dataType: string,
    uniqueness: number,
    distinctCount: number,
    totalRows: number
  ): SemanticRole {
    const lower = col.toLowerCase().replace(/[^a-z0-9]/g, '_');

    if (/(_id|id$|^id_|guid|uuid|code|sku|key|number|ref|token)/i.test(lower) && uniqueness > 80) {
      return 'IDENTIFIER';
    }
    if (dataType === 'datetime' || /date|time|timestamp|year|month|quarter|created|updated/i.test(lower)) {
      return 'DATE';
    }
    if (dataType === 'number') {
      if (/_id|id$|zip|postal|phone|year/i.test(lower) && uniqueness > 50) {
        return 'IDENTIFIER';
      }
      return 'METRIC';
    }
    if (distinctCount <= 20 || (totalRows > 0 && distinctCount / totalRows <= 0.15)) {
      return 'CATEGORICAL';
    }
    if (distinctCount > 20 && distinctCount / totalRows <= 0.6) {
      return 'DIMENSION';
    }
    return 'TEXT';
  }

  /**
   * Identifies physical units and currency symbols
   */
  private static detectUnit(col: string, samples: any[]): DetectedUnit {
    const lower = col.toLowerCase();

    if (/\b(usd|\$|dollar|price|cost|sales|revenue|amount|salary|wage|fee|spend|budget)\b/i.test(lower)) {
      return 'USD';
    }
    if (/\b(eur|euro|€)\b/i.test(lower)) return 'EUR';
    if (/\b(gbp|pound|£)\b/i.test(lower)) return 'GBP';
    if (/\b(inr|rupee|₹)\b/i.test(lower)) return 'INR';
    if (/\b(pct|percent|percentage|rate|ratio|margin|share|growth)\b/i.test(lower) || samples.some(s => String(s).includes('%'))) {
      return 'PERCENT';
    }
    if (/\b(qty|quantity|count|units|items|volume|clicks|visits)\b/i.test(lower)) {
      return 'COUNT';
    }
    if (/\b(distance|miles|km|meters|feet)\b/i.test(lower)) return 'DISTANCE';
    if (/\b(weight|kg|lbs|pounds|grams|ton)\b/i.test(lower)) return 'WEIGHT';

    return 'UNKNOWN';
  }

  /**
   * Deterministic Primary Key scoring algorithm based on mathematical properties and pattern heuristics.
   */
  private static calculatePrimaryKeyConfidence(
    col: string,
    dataType: string,
    uniqueness: number,
    nonNullPercentage: number,
    distinctCount: number,
    totalRows: number,
    samples: any[]
  ): { isPotentialPK: boolean; confidence: number; reasoning: string } {
    let score = 0;
    const reasons: string[] = [];

    // Condition 1: High Uniqueness (Crucial)
    if (uniqueness === 100) {
      score += 45;
      reasons.push('100% unique values');
    } else if (uniqueness >= 99) {
      score += 35;
      reasons.push(`${uniqueness.toFixed(1)}% uniqueness`);
    } else if (uniqueness >= 90) {
      score += 15;
    } else {
      // If uniqueness is low, cannot be a primary key
      return { isPotentialPK: false, confidence: 0, reasoning: 'Low uniqueness' };
    }

    // Condition 2: Non-Null Integrity
    if (nonNullPercentage === 100) {
      score += 25;
      reasons.push('No missing/null values');
    } else if (nonNullPercentage >= 99) {
      score += 15;
      reasons.push('Negligible null values');
    } else {
      score -= 20;
    }

    // Condition 3: Column Name Heuristics
    const lower = col.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (lower === 'id' || lower.endsWith('id') || lower.startsWith('id') || lower.endsWith('key') || lower.endsWith('code') || lower.endsWith('sku')) {
      score += 20;
      reasons.push('Matches standard identifier naming pattern');
    }

    // Condition 4: Value Patterns (Alphanumeric IDs, UUIDs, Monotonic integers)
    const stringSamples = samples.slice(0, 10).map(s => String(s).trim());
    const isSequentialInt = stringSamples.every((s, i) => !isNaN(Number(s)) && (i === 0 || Number(s) > Number(stringSamples[i - 1])));
    const isUUID = stringSamples.some(s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s));
    const isFormattedCode = stringSamples.every(s => /^[A-Z]{2,4}[-_]?[0-9]{2,8}$/i.test(s));

    if (isSequentialInt) {
      score += 10;
      reasons.push('Sequential numeric series');
    } else if (isUUID) {
      score += 10;
      reasons.push('Standard UUID format');
    } else if (isFormattedCode) {
      score += 10;
      reasons.push('Structured alphanumeric entity code');
    }

    const confidence = Math.min(100, Math.max(0, score));
    const isPotentialPK = confidence >= 60;

    return {
      isPotentialPK,
      confidence,
      reasoning: reasons.join(', ') || 'High distinctness'
    };
  }

  /**
   * Compares two datasets to discover candidate foreign key relationships based on
   * bidirectional set overlap and uniqueness analysis.
   */
  public static discoverForeignKeys(
    sourceDatasetId: string,
    sourceDatasetName: string,
    sourceState: DatasetState,
    targetDatasetId: string,
    targetDatasetName: string,
    targetState: DatasetState
  ): ForeignKeyCandidate[] {
    const candidates: ForeignKeyCandidate[] = [];

    const sourceRows = sourceState.workingRows;
    const targetRows = targetState.workingRows;

    if (sourceRows.length === 0 || targetRows.length === 0) return [];

    for (const sCol of sourceState.columns) {
      const sValues = sourceRows.map(r => r[sCol]).filter(v => v !== null && v !== undefined && v !== '');
      if (sValues.length === 0) continue;

      const sSet = new Set(sValues.map(v => String(v).trim().toLowerCase()));
      const sUniqueCount = sSet.size;
      const sIsUnique = sUniqueCount === sValues.length;

      for (const tCol of targetState.columns) {
        const tValues = targetRows.map(r => r[tCol]).filter(v => v !== null && v !== undefined && v !== '');
        if (tValues.length === 0) continue;

        const tSet = new Set(tValues.map(v => String(v).trim().toLowerCase()));
        const tUniqueCount = tSet.size;
        const tIsUnique = tUniqueCount === tValues.length;

        // Calculate Set Overlap (Intersection)
        let matchCount = 0;
        for (const sVal of sSet) {
          if (tSet.has(sVal)) {
            matchCount++;
          }
        }

        if (matchCount === 0) continue;

        const overlapSourcePct = (matchCount / sSet.size) * 100;
        const overlapTargetPct = (matchCount / tSet.size) * 100;

        // Only evaluate if there is significant value overlap (> 30%)
        if (overlapSourcePct < 30 && overlapTargetPct < 30) continue;

        // Determine Cardinality
        let cardinality: RelationshipCardinality = 'MANY_TO_ONE';
        if (sIsUnique && tIsUnique) {
          cardinality = 'ONE_TO_ONE';
        } else if (sIsUnique && !tIsUnique) {
          cardinality = 'ONE_TO_MANY';
        } else if (!sIsUnique && tIsUnique) {
          cardinality = 'MANY_TO_ONE';
        } else {
          cardinality = 'MANY_TO_MANY';
        }

        // Confidence Calculation
        let confidence = 0;
        const nameSimilarity = this.computeNameSimilarity(sCol, tCol, sourceDatasetName, targetDatasetName);

        // Value overlap is primary evidence
        const maxOverlap = Math.max(overlapSourcePct, overlapTargetPct);
        confidence += maxOverlap * 0.6; // Up to 60 points

        // Name similarity evidence
        confidence += nameSimilarity * 0.25; // Up to 25 points

        // Key structure bonus
        if (sIsUnique || tIsUnique) {
          confidence += 15;
        }

        confidence = Math.min(99, Math.round(confidence));

        if (confidence >= 55) {
          candidates.push({
            sourceColumn: sCol,
            targetDatasetId,
            targetDatasetName,
            targetColumn: tCol,
            overlapPercentage: Math.round(overlapSourcePct * 10) / 10,
            confidence,
            cardinality,
            reasoning: `${matchCount} distinct keys match (${overlapSourcePct.toFixed(1)}% source / ${overlapTargetPct.toFixed(1)}% target). Name similarity: ${Math.round(nameSimilarity)}%.`
          });
        }
      }
    }

    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Helper to compute name similarity between columns, accounting for table prefixes
   * (e.g. `customers.id` vs `orders.customer_id`)
   */
  private static computeNameSimilarity(
    colA: string,
    colB: string,
    tableA: string,
    tableB: string
  ): number {
    const a = colA.toLowerCase().replace(/[^a-z0-9]/g, '');
    const b = colB.toLowerCase().replace(/[^a-z0-9]/g, '');
    const tA = tableA.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/csv|xlsx|xls|table/g, '');
    const tB = tableB.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/csv|xlsx|xls|table/g, '');

    if (a === b) return 100;
    if (a === `${tB}id` || b === `${tA}id` || a === `${tB}key` || b === `${tA}key`) return 95;
    if (a.includes(b) || b.includes(a)) return 80;

    return 20;
  }

  /**
   * Detects cross-dataset schema and data conflicts (type mismatches, casing differences)
   */
  public static detectSchemaConflicts(
    datasets: { id: string; name: string; state: DatasetState }[]
  ): SchemaConflict[] {
    const conflicts: SchemaConflict[] = [];

    for (let i = 0; i < datasets.length; i++) {
      for (let j = i + 1; j < datasets.length; j++) {
        const d1 = datasets[i];
        const d2 = datasets[j];

        for (const col1 of d1.state.columns) {
          for (const col2 of d2.state.columns) {
            const isRelatedName = col1.toLowerCase().replace(/[^a-z0-9]/g, '') === col2.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!isRelatedName) continue;

            const t1 = d1.state.profiles[col1]?.type || 'string';
            const t2 = d2.state.profiles[col2]?.type || 'string';

            if (t1 !== t2) {
              conflicts.push({
                datasetA: d1.name,
                colA: col1,
                typeA: t1,
                datasetB: d2.name,
                colB: col2,
                typeB: t2,
                issue: `Data type mismatch: '${col1}' in ${d1.name} is ${t1}, but in ${d2.name} is ${t2}.`,
                severity: (t1 === 'numeric' && t2 === 'string') || (t1 === 'string' && t2 === 'numeric') ? 'HIGH' : 'MEDIUM',
                recommendedFix: `Harmonize to ${t1 === 'numeric' || t2 === 'numeric' ? 'numeric' : 'string'} before performing joins.`
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Detects duplicate entities across datasets (e.g. fuzzy matching of customer names)
   */
  public static detectDuplicateEntities(
    datasets: { id: string; name: string; state: DatasetState }[]
  ): DuplicateEntityCandidate[] {
    const candidates: DuplicateEntityCandidate[] = [];

    for (const d of datasets) {
      // Find text name columns
      const nameCols = d.state.columns.filter(c => /name|customer|client|company|title|product/i.test(c));
      for (const col of nameCols) {
        const vals = d.state.workingRows.map(r => String(r[col] || '')).filter(v => v.length > 2);
        const seen = new Map<string, string>(); // normalized -> original

        for (const val of vals) {
          const norm = val.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
          if (!norm) continue;

          if (seen.has(norm) && seen.get(norm) !== val) {
            const original = seen.get(norm)!;
            candidates.push({
              entityType: col,
              primaryValue: original,
              similarValues: [
                {
                  dataset: d.name,
                  column: col,
                  value: val,
                  similarity: 0.95
                }
              ]
            });
            if (candidates.length >= 5) break;
          } else {
            seen.set(norm, val);
          }
        }
      }
    }

    return candidates;
  }
}
