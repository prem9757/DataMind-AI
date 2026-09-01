// ============================================================================
// PHASE 9: JOIN RECOMMENDATION & SAFE EXECUTION ENGINE
// ============================================================================

import {
  WorkspaceDataset,
  JoinConfig,
  JoinPreviewResult,
  UnifiedDataset,
  WorkspaceRelationship
} from '../types/workspace';
import { profileDataset } from './profiler';

export class JoinEngine {
  /**
   * Generates a safe preview of a join operation with hazard analysis,
   * Cartesian explosion detection, and output row estimation.
   */
  public static previewJoin(
    leftDataset: WorkspaceDataset,
    rightDataset: WorkspaceDataset,
    config: JoinConfig
  ): JoinPreviewResult {
    const start = performance.now();
    const { leftKey, rightKey, joinType } = config;

    const leftRows = leftDataset.state.workingRows;
    const rightRows = rightDataset.state.workingRows;

    // Index right rows by rightKey
    const rightMap = new Map<string, Record<string, any>[]>();
    for (const r of rightRows) {
      const k = String(r[rightKey] ?? '').trim().toLowerCase();
      if (k === '') continue;
      if (!rightMap.has(k)) rightMap.set(k, []);
      rightMap.get(k)!.push(r);
    }

    // Index left rows by leftKey
    const leftMap = new Map<string, Record<string, any>[]>();
    for (const l of leftRows) {
      const k = String(l[leftKey] ?? '').trim().toLowerCase();
      if (k === '') continue;
      if (!leftMap.has(k)) leftMap.set(k, []);
      leftMap.get(k)!.push(l);
    }

    let matchedLeftCount = 0;
    let unmatchedLeftCount = 0;
    let totalOutputEstimated = 0;

    const previewRows: Record<string, any>[] = [];
    const maxPreview = 50;

    const leftPrefix = config.columnPrefixes?.left || (leftDataset.displayName.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    const rightPrefix = config.columnPrefixes?.right || (rightDataset.displayName.toLowerCase().replace(/[^a-z0-9]/g, '_'));

    const leftCols = leftDataset.state.columns;
    const rightCols = rightDataset.state.columns;

    // Build merged column names
    const previewColumns: string[] = [];
    for (const col of leftCols) {
      const colName = rightCols.includes(col) ? `${leftPrefix}_${col}` : col;
      previewColumns.push(colName);
    }
    for (const col of rightCols) {
      if (col === rightKey && leftCols.includes(leftKey) && leftKey === rightKey) continue;
      const colName = leftCols.includes(col) ? `${rightPrefix}_${col}` : col;
      if (!previewColumns.includes(colName)) {
        previewColumns.push(colName);
      }
    }

    // Simulate Left / Inner / Right / Full join iterations
    const rightMatchedKeys = new Set<string>();

    for (const lRow of leftRows) {
      const k = String(lRow[leftKey] ?? '').trim().toLowerCase();
      const rMatches = rightMap.get(k) || [];

      if (rMatches.length > 0) {
        matchedLeftCount++;
        rightMatchedKeys.add(k);
        totalOutputEstimated += rMatches.length;

        if (previewRows.length < maxPreview) {
          for (const rRow of rMatches) {
            if (previewRows.length >= maxPreview) break;
            const merged = this.mergeRow(lRow, rRow, leftCols, rightCols, leftPrefix, rightPrefix, leftKey, rightKey);
            previewRows.push(merged);
          }
        }
      } else {
        unmatchedLeftCount++;
        if (joinType === 'LEFT' || joinType === 'FULL') {
          totalOutputEstimated += 1;
          if (previewRows.length < maxPreview) {
            const merged = this.mergeRow(lRow, null, leftCols, rightCols, leftPrefix, rightPrefix, leftKey, rightKey);
            previewRows.push(merged);
          }
        }
      }
    }

    // Count unmatched right rows for RIGHT / FULL
    let unmatchedRightCount = 0;
    for (const [rKey, rRowList] of rightMap.entries()) {
      if (!rightMatchedKeys.has(rKey)) {
        unmatchedRightCount += rRowList.length;
        if (joinType === 'RIGHT' || joinType === 'FULL') {
          totalOutputEstimated += rRowList.length;
          if (previewRows.length < maxPreview) {
            for (const rRow of rRowList) {
              if (previewRows.length >= maxPreview) break;
              const merged = this.mergeRow(null, rRow, leftCols, rightCols, leftPrefix, rightPrefix, leftKey, rightKey);
              previewRows.push(merged);
            }
          }
        }
      }
    }

    if (joinType === 'RIGHT') {
      // For right join, output rows are matches + unmatched right
      totalOutputEstimated = (totalOutputEstimated - unmatchedLeftCount) + unmatchedRightCount;
    }

    const multiplicationFactor = leftRows.length > 0 ? totalOutputEstimated / leftRows.length : 1;
    const isDangerous = multiplicationFactor > 2.5 && totalOutputEstimated > 5000;

    const warnings: string[] = [];
    if (multiplicationFactor > 2.0) {
      warnings.push(`Cartesian explosion hazard: Join will multiply row count by ${multiplicationFactor.toFixed(2)}x (from ${leftRows.length.toLocaleString()} to ${totalOutputEstimated.toLocaleString()} rows).`);
    }
    if (joinType === 'INNER' && unmatchedLeftCount > 0) {
      warnings.push(`INNER JOIN will drop ${unmatchedLeftCount.toLocaleString()} rows (${((unmatchedLeftCount / leftRows.length) * 100).toFixed(1)}%) from ${leftDataset.displayName} due to missing matching keys.`);
    }
    if (unmatchedRightCount > 0 && (joinType === 'INNER' || joinType === 'LEFT')) {
      warnings.push(`${unmatchedRightCount.toLocaleString()} rows in ${rightDataset.displayName} have no corresponding records in ${leftDataset.displayName}.`);
    }

    return {
      leftRowCount: leftRows.length,
      rightRowCount: rightRows.length,
      expectedOutputRows: totalOutputEstimated,
      matchedRows: matchedLeftCount,
      unmatchedLeftRows: unmatchedLeftCount,
      unmatchedRightRows: unmatchedRightCount,
      multiplicationFactor: Math.round(multiplicationFactor * 100) / 100,
      isDangerous,
      warnings,
      previewRows,
      previewColumns,
      executionTimeMs: Math.round(performance.now() - start)
    };
  }

  /**
   * Helper to merge single row pairs with column collision prevention.
   */
  private static mergeRow(
    leftRow: Record<string, any> | null,
    rightRow: Record<string, any> | null,
    leftCols: string[],
    rightCols: string[],
    leftPrefix: string,
    rightPrefix: string,
    leftKey: string,
    rightKey: string
  ): Record<string, any> {
    const out: Record<string, any> = {};

    if (leftRow) {
      for (const col of leftCols) {
        const colName = rightCols.includes(col) ? `${leftPrefix}_${col}` : col;
        out[colName] = leftRow[col] ?? null;
      }
    } else {
      for (const col of leftCols) {
        const colName = rightCols.includes(col) ? `${leftPrefix}_${col}` : col;
        out[colName] = null;
      }
    }

    if (rightRow) {
      for (const col of rightCols) {
        if (col === rightKey && leftCols.includes(leftKey) && leftKey === rightKey) continue;
        const colName = leftCols.includes(col) ? `${rightPrefix}_${col}` : col;
        out[colName] = rightRow[col] ?? null;
      }
    } else {
      for (const col of rightCols) {
        if (col === rightKey && leftCols.includes(leftKey) && leftKey === rightKey) continue;
        const colName = leftCols.includes(col) ? `${rightPrefix}_${col}` : col;
        out[colName] = null;
      }
    }

    return out;
  }

  /**
   * Fully executes the join between two datasets and compiles a unified analytical dataset.
   */
  public static executeJoin(
    leftDataset: WorkspaceDataset,
    rightDataset: WorkspaceDataset,
    config: JoinConfig,
    unifiedName?: string
  ): UnifiedDataset {
    const { leftKey, rightKey, joinType } = config;
    const leftRows = leftDataset.state.workingRows;
    const rightRows = rightDataset.state.workingRows;

    const leftPrefix = config.columnPrefixes?.left || (leftDataset.displayName.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    const rightPrefix = config.columnPrefixes?.right || (rightDataset.displayName.toLowerCase().replace(/[^a-z0-9]/g, '_'));

    const leftCols = leftDataset.state.columns;
    const rightCols = rightDataset.state.columns;

    // Index right rows
    const rightMap = new Map<string, Record<string, any>[]>();
    for (const r of rightRows) {
      const k = String(r[rightKey] ?? '').trim().toLowerCase();
      if (k === '') continue;
      if (!rightMap.has(k)) rightMap.set(k, []);
      rightMap.get(k)!.push(r);
    }

    const outputRows: Record<string, any>[] = [];
    const rightMatchedKeys = new Set<string>();

    for (const lRow of leftRows) {
      const k = String(lRow[leftKey] ?? '').trim().toLowerCase();
      const rMatches = rightMap.get(k) || [];

      if (rMatches.length > 0) {
        rightMatchedKeys.add(k);
        for (const rRow of rMatches) {
          outputRows.push(this.mergeRow(lRow, rRow, leftCols, rightCols, leftPrefix, rightPrefix, leftKey, rightKey));
        }
      } else if (joinType === 'LEFT' || joinType === 'FULL') {
        outputRows.push(this.mergeRow(lRow, null, leftCols, rightCols, leftPrefix, rightPrefix, leftKey, rightKey));
      }
    }

    if (joinType === 'RIGHT' || joinType === 'FULL') {
      for (const [rKey, rRowList] of rightMap.entries()) {
        if (!rightMatchedKeys.has(rKey)) {
          for (const rRow of rRowList) {
            outputRows.push(this.mergeRow(null, rRow, leftCols, rightCols, leftPrefix, rightPrefix, leftKey, rightKey));
          }
        }
      }
    }

    const columns = Object.keys(outputRows[0] || {});
    const profiles = profileDataset(outputRows, columns);

    const uId = `unified_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const name = unifiedName || `${leftDataset.displayName} ⋈ ${rightDataset.displayName}`;

    return {
      id: uId,
      name,
      sourceDatasetIds: [leftDataset.id, rightDataset.id],
      sourceDatasetNames: [leftDataset.displayName, rightDataset.displayName],
      joinConfig: config,
      rowCount: outputRows.length,
      columnCount: columns.length,
      columns,
      profiles,
      workingRows: outputRows,
      createdAt: Date.now(),
      version: 1
    };
  }

  /**
   * Automatically recommends join path and join type based on analytical query target
   */
  public static recommendJoinPath(
    targetDatasets: WorkspaceDataset[],
    relationships: WorkspaceRelationship[]
  ): {
    recommendedJoins: JoinConfig[];
    explanation: string;
  } {
    if (targetDatasets.length < 2) {
      return { recommendedJoins: [], explanation: 'At least two datasets are required to construct a join path.' };
    }

    const configs: JoinConfig[] = [];
    const explanations: string[] = [];

    // Find linking relationships
    const d1 = targetDatasets[0];
    const d2 = targetDatasets[1];

    const rel = relationships.find(
      r => (r.sourceDatasetId === d1.id && r.targetDatasetId === d2.id) ||
           (r.sourceDatasetId === d2.id && r.targetDatasetId === d1.id)
    );

    if (rel) {
      const isD1Source = rel.sourceDatasetId === d1.id;
      const leftKey = isD1Source ? rel.sourceColumn : rel.targetColumn;
      const rightKey = isD1Source ? rel.targetColumn : rel.sourceColumn;

      // Select Join Type: Default to LEFT if d1 is transaction/orders table, or INNER if high match rate
      const joinType = rel.validation.matchPercentage >= 95 ? 'INNER' : 'LEFT';

      configs.push({
        id: `cfg_${Date.now()}`,
        leftDatasetId: d1.id,
        rightDatasetId: d2.id,
        leftKey,
        rightKey,
        joinType
      });

      explanations.push(`Connected ${d1.displayName} to ${d2.displayName} via ${leftKey} = ${rightKey} with ${joinType} JOIN (${rel.validation.matchPercentage}% match rate).`);
    } else {
      // Fallback to name heuristic matching if explicit relationship not found
      const commonCol = d1.state.columns.find(c1 => d2.state.columns.includes(c1));
      if (commonCol) {
        configs.push({
          id: `cfg_${Date.now()}`,
          leftDatasetId: d1.id,
          rightDatasetId: d2.id,
          leftKey: commonCol,
          rightKey: commonCol,
          joinType: 'LEFT'
        });
        explanations.push(`Inferred join on shared column '${commonCol}' with LEFT JOIN.`);
      }
    }

    return {
      recommendedJoins: configs,
      explanation: explanations.join(' ') || 'Constructed recommended multi-table join topology.'
    };
  }
}
