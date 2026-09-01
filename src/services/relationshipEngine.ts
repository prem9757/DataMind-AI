// ============================================================================
// PHASE 9: RELATIONSHIP DISCOVERY & VALIDATION ENGINE
// ============================================================================

import {
  WorkspaceDataset,
  WorkspaceRelationship,
  RelationshipValidation,
  RelationshipCardinality
} from '../types/workspace';
import { SchemaEngine } from './schemaEngine';

export class RelationshipEngine {
  /**
   * Discovers all candidate relationships across a list of active datasets.
   */
  public static discoverAllRelationships(datasets: WorkspaceDataset[]): WorkspaceRelationship[] {
    const relationships: WorkspaceRelationship[] = [];
    const active = datasets.filter(d => d.isActive && d.status === 'READY');

    for (let i = 0; i < active.length; i++) {
      for (let j = 0; j < active.length; j++) {
        if (i === j) continue;

        const source = active[i];
        const target = active[j];

        const fkCandidates = SchemaEngine.discoverForeignKeys(
          source.id,
          source.displayName,
          source.state,
          target.id,
          target.displayName,
          target.state
        );

        for (const cand of fkCandidates) {
          // Validate relationship thoroughly
          const validation = this.validateRelationship(
            source,
            cand.sourceColumn,
            target,
            cand.targetColumn,
            cand.cardinality
          );

          const relId = `rel_${source.id}_${cand.sourceColumn}_to_${target.id}_${cand.targetColumn}`.replace(/[^a-zA-Z0-9_]/g, '_');

          // Prevent inverted duplicates if one already exists with higher confidence
          const existingIdx = relationships.findIndex(
            r => (r.sourceDatasetId === source.id && r.targetDatasetId === target.id && r.sourceColumn === cand.sourceColumn && r.targetColumn === cand.targetColumn) ||
                 (r.sourceDatasetId === target.id && r.targetDatasetId === source.id && r.sourceColumn === cand.targetColumn && r.targetColumn === cand.sourceColumn)
          );

          if (existingIdx !== -1) {
            if (relationships[existingIdx].confidence < cand.confidence) {
              relationships[existingIdx] = {
                id: relId,
                sourceDatasetId: source.id,
                sourceDatasetName: source.displayName,
                sourceColumn: cand.sourceColumn,
                targetDatasetId: target.id,
                targetDatasetName: target.displayName,
                targetColumn: cand.targetColumn,
                cardinality: cand.cardinality,
                confidence: cand.confidence,
                status: 'RECOMMENDED',
                validation,
                explanation: cand.reasoning,
                createdAt: Date.now()
              };
            }
          } else {
            relationships.push({
              id: relId,
              sourceDatasetId: source.id,
              sourceDatasetName: source.displayName,
              sourceColumn: cand.sourceColumn,
              targetDatasetId: target.id,
              targetDatasetName: target.displayName,
              targetColumn: cand.targetColumn,
              cardinality: cand.cardinality,
              confidence: cand.confidence,
              status: 'RECOMMENDED',
              validation,
              explanation: cand.reasoning,
              createdAt: Date.now()
            });
          }
        }
      }
    }

    return relationships.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Rigorous statistical relationship validation calculation.
   */
  public static validateRelationship(
    sourceDataset: WorkspaceDataset,
    sourceColumn: string,
    targetDataset: WorkspaceDataset,
    targetColumn: string,
    expectedCardinality: RelationshipCardinality
  ): RelationshipValidation {
    const sRows = sourceDataset.state.workingRows;
    const tRows = targetDataset.state.workingRows;

    const sValues = sRows.map(r => r[sourceColumn]);
    const tValues = tRows.map(r => r[targetColumn]);

    const sNullCount = sValues.filter(v => v === null || v === undefined || v === '').length;
    const tNullCount = tValues.filter(v => v === null || v === undefined || v === '').length;

    const sNonNull = sValues.filter(v => v !== null && v !== undefined && v !== '');
    const tNonNull = tValues.filter(v => v !== null && v !== undefined && v !== '');

    const sKeyCounts = new Map<string, number>();
    for (const v of sNonNull) {
      const k = String(v).trim().toLowerCase();
      sKeyCounts.set(k, (sKeyCounts.get(k) || 0) + 1);
    }

    const tKeyCounts = new Map<string, number>();
    for (const v of tNonNull) {
      const k = String(v).trim().toLowerCase();
      tKeyCounts.set(k, (tKeyCounts.get(k) || 0) + 1);
    }

    let sourceDuplicates = 0;
    for (const [, count] of sKeyCounts.entries()) {
      if (count > 1) sourceDuplicates += (count - 1);
    }

    let targetDuplicates = 0;
    for (const [, count] of tKeyCounts.entries()) {
      if (count > 1) targetDuplicates += (count - 1);
    }

    // Set matching
    let matchedKeysCount = 0;
    let unmatchedSourceKeysCount = 0;
    for (const [sKey] of sKeyCounts.entries()) {
      if (tKeyCounts.has(sKey)) {
        matchedKeysCount++;
      } else {
        unmatchedSourceKeysCount++;
      }
    }

    let unmatchedTargetKeysCount = 0;
    for (const [tKey] of tKeyCounts.entries()) {
      if (!sKeyCounts.has(tKey)) {
        unmatchedTargetKeysCount++;
      }
    }

    const totalDistinctSource = sKeyCounts.size;
    const matchPercentage = totalDistinctSource > 0 ? (matchedKeysCount / totalDistinctSource) * 100 : 0;

    // Type Compatibility Check
    const sType = sourceDataset.state.profiles[sourceColumn]?.type || 'string';
    const tType = targetDataset.state.profiles[targetColumn]?.type || 'string';

    let typeCompatibility: 'EXACT' | 'COMPATIBLE_COERCIBLE' | 'INCOMPATIBLE' = 'EXACT';
    if (sType !== tType) {
      if ((sType === 'numeric' && tType === 'string') || (sType === 'string' && tType === 'numeric')) {
        typeCompatibility = 'COMPATIBLE_COERCIBLE';
      } else {
        typeCompatibility = 'INCOMPATIBLE';
      }
    }

    // Generate Actionable Quality Warnings
    const warnings: string[] = [];

    if (matchPercentage < 50) {
      warnings.push(`Low key match rate (${matchPercentage.toFixed(1)}%). ${unmatchedSourceKeysCount} source keys have no match in target table.`);
    } else if (matchPercentage < 80) {
      warnings.push(`Moderate match rate (${matchPercentage.toFixed(1)}%). Some records will be unmatched in INNER JOIN.`);
    }

    if (sourceDuplicates > 0 && targetDuplicates > 0) {
      warnings.push(`Hazardous Many-to-Many key duplication: ${sourceDuplicates} duplicate keys in ${sourceDataset.displayName} and ${targetDuplicates} in ${targetDataset.displayName}. Joining directly will cause a Cartesian row explosion!`);
    }

    if (sNullCount > 0) {
      warnings.push(`${sNullCount} null values detected in ${sourceDataset.displayName}.${sourceColumn}.`);
    }
    if (tNullCount > 0) {
      warnings.push(`${tNullCount} null values detected in ${targetDataset.displayName}.${targetColumn}.`);
    }

    if (typeCompatibility === 'COMPATIBLE_COERCIBLE') {
      warnings.push(`Data types differ (${sType} vs ${tType}) but can be automatically coerced during join.`);
    } else if (typeCompatibility === 'INCOMPATIBLE') {
      warnings.push(`Severe type incompatibility (${sType} vs ${tType}). Join cannot be executed safely.`);
    }

    const isValid = typeCompatibility !== 'INCOMPATIBLE' && matchPercentage > 15;

    return {
      sourceCount: sRows.length,
      targetCount: tRows.length,
      matchedKeysCount,
      unmatchedSourceKeysCount,
      unmatchedTargetKeysCount,
      matchPercentage: Math.round(matchPercentage * 10) / 10,
      sourceDuplicateKeysCount: sourceDuplicates,
      targetDuplicateKeysCount: targetDuplicates,
      sourceNullCount: sNullCount,
      targetNullCount: tNullCount,
      typeCompatibility,
      warnings,
      isValid
    };
  }
}
