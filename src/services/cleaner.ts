import {
  BeforeAfterPreview,
  CleaningPlanStep,
  CleaningTransformation,
  ColumnProfile,
  ColumnType,
  DatasetState,
  DatasetStatsSnapshot,
  TransformationAction
} from '../types/dataset';
import { profileDataset } from './profiler';
import { auditDataQuality } from './qualityEngine';
import { generateDatasetInsights } from './insightEngine';
import { generateCleaningPlan } from './cleaningPlanEngine';
import * as ss from 'simple-statistics';

export interface CleanResult {
  workingRows: Record<string, any>[];
  columns: string[];
  transformation: CleaningTransformation;
}

// Snapshot helper
export function computeDatasetStats(dataset: {
  workingRows: Record<string, any>[];
  columns: string[];
  quality?: { score: number; duplicateRows: number; missingCellsTotal: number; invalidValuesTotal: number };
}): DatasetStatsSnapshot {
  const totalRows = dataset.workingRows.length;
  const totalColumns = dataset.columns.length;

  if (dataset.quality) {
    return {
      totalRows,
      totalColumns,
      missingCells: dataset.quality.missingCellsTotal,
      duplicateRows: dataset.quality.duplicateRows,
      invalidValues: dataset.quality.invalidValuesTotal,
      qualityScore: dataset.quality.score
    };
  }

  // Quick fallback calculation
  let missing = 0;
  for (const row of dataset.workingRows) {
    for (const col of dataset.columns) {
      const v = row[col];
      if (v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v))) {
        missing++;
      }
    }
  }

  return {
    totalRows,
    totalColumns,
    missingCells: missing,
    duplicateRows: 0,
    invalidValues: 0,
    qualityScore: 80
  };
}

export function removeDuplicates(rows: Record<string, any>[], columns: string[]): CleanResult {
  const seen = new Set<string>();
  const cleaned: Record<string, any>[] = [];

  for (const row of rows) {
    const key = JSON.stringify(row);
    if (!seen.has(key)) {
      seen.add(key);
      cleaned.push({ ...row });
    }
  }

  const removed = rows.length - cleaned.length;

  return {
    workingRows: cleaned,
    columns,
    transformation: {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'remove_duplicates',
      description: `Removed ${removed} exact duplicate ${removed === 1 ? 'row' : 'rows'}.`,
      affectedRowsCount: removed
    }
  };
}

export function removeDuplicateIds(
  rows: Record<string, any>[],
  columns: string[],
  column: string,
  keep: 'first' | 'last' = 'first'
): CleanResult {
  const seen = new Set<string>();
  const targetRows = keep === 'last' ? [...rows].reverse() : rows;
  const cleaned: Record<string, any>[] = [];

  for (const row of targetRows) {
    const key = String(row[column] ?? '');
    if (!seen.has(key)) {
      seen.add(key);
      cleaned.push({ ...row });
    }
  }

  if (keep === 'last') {
    cleaned.reverse();
  }

  const removed = rows.length - cleaned.length;

  return {
    workingRows: cleaned,
    columns,
    transformation: {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'remove_duplicate_ids',
      description: `Deduplicated identifier "${column}" keeping ${keep} occurrences (removed ${removed} rows).`,
      column,
      params: { column, keep },
      affectedRowsCount: removed
    }
  };
}

export function dropMissingRows(
  rows: Record<string, any>[],
  columns: string[],
  targetColumn?: string
): CleanResult {
  let cleaned: Record<string, any>[] = [];

  if (targetColumn) {
    cleaned = rows.filter(row => {
      const v = row[targetColumn];
      return v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && isNaN(v));
    });
  } else {
    cleaned = rows.filter(row => {
      return Object.values(row).every(
        v => v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && isNaN(v))
      );
    });
  }

  const removed = rows.length - cleaned.length;

  return {
    workingRows: cleaned,
    columns,
    transformation: {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'drop_missing_rows',
      description: targetColumn
        ? `Dropped ${removed} rows with missing values in "${targetColumn}".`
        : `Dropped ${removed} rows containing any missing values.`,
      column: targetColumn,
      affectedRowsCount: removed
    }
  };
}

export function dropMostlyMissingColumns(
  rows: Record<string, any>[],
  columns: string[],
  threshold = 70,
  profiles?: Record<string, ColumnProfile>
): CleanResult {
  const colsToDrop = columns.filter(c => {
    const p = profiles?.[c];
    return p ? p.nullPercentage >= threshold : false;
  });

  const newColumns = columns.filter(c => !colsToDrop.includes(c));
  const cleaned = rows.map(row => {
    const copy = { ...row };
    for (const c of colsToDrop) {
      delete copy[c];
    }
    return copy;
  });

  return {
    workingRows: cleaned,
    columns: newColumns,
    transformation: {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'drop_mostly_missing_columns',
      description: `Dropped ${colsToDrop.length} columns with >${threshold}% missing cells (${colsToDrop.join(', ')}).`,
      params: { droppedColumns: colsToDrop, threshold },
      affectedRowsCount: rows.length
    }
  };
}

export function fillMissingValues(
  rows: Record<string, any>[],
  columns: string[],
  column: string,
  strategy: 'mean' | 'median' | 'mode' | 'constant' | 'forward_fill' | 'backward_fill',
  customValue?: any,
  profiles?: Record<string, ColumnProfile>
): CleanResult {
  let fillVal: any = customValue;
  const colProfile = profiles?.[column];

  const validNumbers = rows
    .map(r => r[column])
    .filter(v => typeof v === 'number' && !isNaN(v));

  if (strategy === 'mean') {
    fillVal = validNumbers.length > 0 ? Math.round(ss.mean(validNumbers) * 100) / 100 : 0;
  } else if (strategy === 'median') {
    fillVal = validNumbers.length > 0 ? Math.round(ss.median(validNumbers) * 100) / 100 : 0;
  } else if (strategy === 'mode') {
    if (colProfile?.topValues?.[0]) {
      fillVal = colProfile.topValues[0].value;
    } else {
      const counts: Record<string, number> = {};
      rows.forEach(r => {
        const v = r[column];
        if (v !== null && v !== undefined && v !== '') {
          counts[String(v)] = (counts[String(v)] || 0) + 1;
        }
      });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      fillVal = top ? top[0] : 'Unknown';
    }
  }

  let affectedCount = 0;
  const isMissingValue = (v: any) => {
    if (v === null || v === undefined) return true;
    if (typeof v === 'number' && isNaN(v)) return true;
    if (typeof v === 'string') {
      const trimmed = v.trim().toLowerCase();
      if (trimmed === '' || ['na', 'n/a', 'null', 'none', '-', '--', 'nil'].includes(trimmed)) return true;
    }
    return false;
  };

  const cleaned = rows.map((row, idx) => {
    const val = row[column];
    if (isMissingValue(val)) {
      affectedCount++;
      let imputed = fillVal;
      if (strategy === 'forward_fill') {
        for (let j = idx - 1; j >= 0; j--) {
          const prev = rows[j][column];
          if (!isMissingValue(prev)) {
            imputed = prev;
            break;
          }
        }
      } else if (strategy === 'backward_fill') {
        for (let j = idx + 1; j < rows.length; j++) {
          const next = rows[j][column];
          if (!isMissingValue(next)) {
            imputed = next;
            break;
          }
        }
      }
      return { ...row, [column]: imputed };
    }
    return { ...row };
  });

  return {
    workingRows: cleaned,
    columns,
    transformation: {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'fill_missing',
      description: `Imputed ${affectedCount} missing values in "${column}" using ${strategy} (${fillVal ?? 'direction'}).`,
      column,
      params: { strategy, fillVal },
      affectedRowsCount: affectedCount
    }
  };
}

export function trimWhitespace(
  rows: Record<string, any>[],
  columns: string[],
  targetColumn?: string
): CleanResult {
  let affectedCount = 0;
  const targetCols = targetColumn ? [targetColumn] : columns;

  const cleaned = rows.map(row => {
    const updated = { ...row };
    let rowChanged = false;
    for (const col of targetCols) {
      if (typeof updated[col] === 'string') {
        const trimmed = updated[col].trim();
        if (trimmed !== updated[col]) {
          updated[col] = trimmed;
          rowChanged = true;
        }
      }
    }
    if (rowChanged) affectedCount++;
    return updated;
  });

  return {
    workingRows: cleaned,
    columns,
    transformation: {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'trim_whitespace',
      description: targetColumn
        ? `Trimmed whitespace in "${targetColumn}" (${affectedCount} rows updated).`
        : `Trimmed leading/trailing whitespace across text columns (${affectedCount} rows updated).`,
      column: targetColumn,
      affectedRowsCount: affectedCount
    }
  };
}

export function normalizeCasing(
  rows: Record<string, any>[],
  columns: string[],
  column: string,
  mode: 'title' | 'lower' | 'upper'
): CleanResult {
  let affectedCount = 0;
  const toTitleCase = (str: string) =>
    str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());

  const cleaned = rows.map(row => {
    const val = row[column];
    if (typeof val === 'string') {
      let normalized = val;
      if (mode === 'title') normalized = toTitleCase(val.trim());
      else if (mode === 'lower') normalized = val.trim().toLowerCase();
      else if (mode === 'upper') normalized = val.trim().toUpperCase();

      if (normalized !== val) {
        affectedCount++;
        return { ...row, [column]: normalized };
      }
    }
    return { ...row };
  });

  return {
    workingRows: cleaned,
    columns,
    transformation: {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'normalize_casing',
      description: `Normalized casing of "${column}" to ${mode} case (${affectedCount} rows formatted).`,
      column,
      params: { mode },
      affectedRowsCount: affectedCount
    }
  };
}

export function standardizeAliases(
  rows: Record<string, any>[],
  columns: string[],
  column: string,
  mappings: Record<string, string>
): CleanResult {
  let affectedCount = 0;
  const cleaned = rows.map(row => {
    const val = String(row[column] ?? '').trim();
    if (mappings[val] !== undefined && mappings[val] !== val) {
      affectedCount++;
      return { ...row, [column]: mappings[val] };
    }
    return { ...row };
  });

  return {
    workingRows: cleaned,
    columns,
    transformation: {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'standardize_aliases',
      description: `Standardized category aliases in "${column}" (${affectedCount} rows unified).`,
      column,
      params: { mappings },
      affectedRowsCount: affectedCount
    }
  };
}

export function replaceValues(
  rows: Record<string, any>[],
  columns: string[],
  column: string,
  fromValue: string,
  toValue: string
): CleanResult {
  let affectedCount = 0;
  const cleaned = rows.map(row => {
    const val = String(row[column] ?? '');
    if (val === fromValue) {
      affectedCount++;
      return { ...row, [column]: toValue };
    }
    return { ...row };
  });

  return {
    workingRows: cleaned,
    columns,
    transformation: {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'replace_values',
      description: `Replaced "${fromValue}" with "${toValue}" in "${column}" (${affectedCount} rows updated).`,
      column,
      params: { fromValue, toValue },
      affectedRowsCount: affectedCount
    }
  };
}

export function convertColumnType(
  rows: Record<string, any>[],
  columns: string[],
  column: string,
  targetType: ColumnType
): CleanResult {
  let affectedCount = 0;

  const cleaned = rows.map(row => {
    const val = row[column];
    if (val === null || val === undefined || val === '') return { ...row };

    let converted: any = val;
    if (targetType === 'numeric') {
      const cleanStr = String(val).replace(/[\$,€,£,₹,¥,%,,\s]/g, '');
      const num = Number(cleanStr);
      if (!isNaN(num)) {
        converted = num;
        affectedCount++;
      }
    } else if (targetType === 'datetime') {
      const timestamp = Date.parse(String(val));
      if (!isNaN(timestamp)) {
        converted = new Date(timestamp).toISOString().split('T')[0];
        affectedCount++;
      }
    } else if (targetType === 'boolean') {
      const str = String(val).trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 't'].includes(str)) {
        converted = true;
        affectedCount++;
      } else if (['false', '0', 'no', 'n', 'f'].includes(str)) {
        converted = false;
        affectedCount++;
      }
    } else if (targetType === 'categorical' || targetType === 'text') {
      converted = String(val).trim();
      affectedCount++;
    }

    return { ...row, [column]: converted };
  });

  return {
    workingRows: cleaned,
    columns,
    transformation: {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'convert_type',
      description: `Converted data type of "${column}" to ${targetType} (${affectedCount} records parsed).`,
      column,
      params: { targetType },
      affectedRowsCount: affectedCount
    }
  };
}

export function capOutliers(
  rows: Record<string, any>[],
  columns: string[],
  column: string,
  bounds?: { lower: number; upper: number },
  profiles?: Record<string, ColumnProfile>
): CleanResult {
  let lowerBound = bounds?.lower;
  let upperBound = bounds?.upper;

  if (lowerBound === undefined || upperBound === undefined) {
    const profile = profiles?.[column];
    if (!profile || profile.type !== 'numeric' || profile.q1 === undefined || profile.q3 === undefined || profile.iqr === undefined) {
      throw new Error(`Cannot cap outliers for non-numeric column "${column}".`);
    }
    lowerBound = profile.q1 - 1.5 * profile.iqr;
    upperBound = profile.q3 + 1.5 * profile.iqr;
  }

  let affectedCount = 0;
  const cleaned = rows.map(row => {
    const val = row[column];
    if (typeof val === 'number' && !isNaN(val)) {
      if (val < lowerBound!) {
        affectedCount++;
        return { ...row, [column]: Math.round(lowerBound! * 100) / 100 };
      } else if (val > upperBound!) {
        affectedCount++;
        return { ...row, [column]: Math.round(upperBound! * 100) / 100 };
      }
    }
    return { ...row };
  });

  return {
    workingRows: cleaned,
    columns,
    transformation: {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'cap_outliers',
      description: `Capped ${affectedCount} outliers in "${column}" at bounds [${Math.round(lowerBound! * 10) / 10}, ${Math.round(upperBound! * 10) / 10}].`,
      column,
      params: { lowerBound, upperBound },
      affectedRowsCount: affectedCount
    }
  };
}

export function removeOutliers(
  rows: Record<string, any>[],
  columns: string[],
  column: string,
  profiles?: Record<string, ColumnProfile>
): CleanResult {
  const profile = profiles?.[column];
  if (!profile || profile.type !== 'numeric' || profile.q1 === undefined || profile.q3 === undefined || profile.iqr === undefined) {
    throw new Error(`Cannot remove outliers for non-numeric column "${column}".`);
  }

  const lowerBound = profile.q1 - 1.5 * profile.iqr;
  const upperBound = profile.q3 + 1.5 * profile.iqr;

  const cleaned = rows.filter(row => {
    const val = row[column];
    if (typeof val === 'number' && !isNaN(val)) {
      return val >= lowerBound && val <= upperBound;
    }
    return true;
  });

  const removed = rows.length - cleaned.length;

  return {
    workingRows: cleaned,
    columns,
    transformation: {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'remove_outliers',
      description: `Removed ${removed} rows containing extreme outliers in "${column}".`,
      column,
      params: { lowerBound, upperBound },
      affectedRowsCount: removed
    }
  };
}

export function replaceOutliersWithMedian(
  rows: Record<string, any>[],
  columns: string[],
  column: string,
  profiles?: Record<string, ColumnProfile>
): CleanResult {
  const profile = profiles?.[column];
  if (!profile || profile.type !== 'numeric' || profile.q1 === undefined || profile.q3 === undefined || profile.iqr === undefined || profile.median === undefined) {
    throw new Error(`Cannot replace outliers for column "${column}".`);
  }

  const lowerBound = profile.q1 - 1.5 * profile.iqr;
  const upperBound = profile.q3 + 1.5 * profile.iqr;
  const median = profile.median;

  let affectedCount = 0;
  const cleaned = rows.map(row => {
    const val = row[column];
    if (typeof val === 'number' && !isNaN(val)) {
      if (val < lowerBound || val > upperBound) {
        affectedCount++;
        return { ...row, [column]: median };
      }
    }
    return { ...row };
  });

  return {
    workingRows: cleaned,
    columns,
    transformation: {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'replace_outliers_with_median',
      description: `Replaced ${affectedCount} extreme outliers in "${column}" with median (${median}).`,
      column,
      params: { median },
      affectedRowsCount: affectedCount
    }
  };
}

export function dropColumn(
  rows: Record<string, any>[],
  columns: string[],
  columnToDrop: string
): CleanResult {
  const newColumns = columns.filter(c => c !== columnToDrop);
  const cleaned = rows.map(row => {
    const copy = { ...row };
    delete copy[columnToDrop];
    return copy;
  });

  return {
    workingRows: cleaned,
    columns: newColumns,
    transformation: {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'drop_column',
      description: `Dropped column "${columnToDrop}".`,
      column: columnToDrop,
      affectedRowsCount: rows.length
    }
  };
}

export function dropConstantColumns(
  rows: Record<string, any>[],
  columns: string[],
  profiles?: Record<string, ColumnProfile>
): CleanResult {
  const constCols = columns.filter(c => profiles?.[c]?.isConstant);
  const newColumns = columns.filter(c => !constCols.includes(c));

  const cleaned = rows.map(row => {
    const copy = { ...row };
    for (const c of constCols) {
      delete copy[c];
    }
    return copy;
  });

  return {
    workingRows: cleaned,
    columns: newColumns,
    transformation: {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'drop_constant_columns',
      description: `Dropped ${constCols.length} constant columns (${constCols.join(', ')}).`,
      params: { droppedColumns: constCols },
      affectedRowsCount: rows.length
    }
  };
}

export function renameColumn(
  rows: Record<string, any>[],
  columns: string[],
  oldName: string,
  newName: string
): CleanResult {
  const cleanNewName = newName.trim();
  if (!cleanNewName || cleanNewName === oldName) {
    throw new Error('New column name must be non-empty and distinct from old name.');
  }

  const newColumns = columns.map(c => (c === oldName ? cleanNewName : c));
  const cleaned = rows.map(row => {
    const copy: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (k === oldName) {
        copy[cleanNewName] = v;
      } else {
        copy[k] = v;
      }
    }
    return copy;
  });

  return {
    workingRows: cleaned,
    columns: newColumns,
    transformation: {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'rename_column',
      description: `Renamed column "${oldName}" to "${cleanNewName}".`,
      column: cleanNewName,
      params: { oldName, newName: cleanNewName },
      affectedRowsCount: rows.length
    }
  };
}

// Generates an interactive Before/After preview showing affected sample rows and metrics delta
export function generateBeforeAfterPreview(
  dataset: DatasetState,
  action: TransformationAction
): BeforeAfterPreview {
  const beforeStats = computeDatasetStats(dataset);
  let cleanRes: CleanResult;

  switch (action.type) {
    case 'remove_duplicates':
      cleanRes = removeDuplicates(dataset.workingRows, dataset.columns);
      break;
    case 'remove_duplicate_ids':
      cleanRes = removeDuplicateIds(dataset.workingRows, dataset.columns, action.column, action.keep);
      break;
    case 'impute_missing':
      cleanRes = fillMissingValues(
        dataset.workingRows,
        dataset.columns,
        action.column,
        action.strategy,
        action.constantValue,
        dataset.profiles
      );
      break;
    case 'drop_missing':
      cleanRes = dropMissingRows(dataset.workingRows, dataset.columns, action.column);
      break;
    case 'drop_mostly_missing_columns':
      cleanRes = dropMostlyMissingColumns(dataset.workingRows, dataset.columns, action.threshold, dataset.profiles);
      break;
    case 'trim_whitespace':
      cleanRes = trimWhitespace(dataset.workingRows, dataset.columns, action.column);
      break;
    case 'standardize_case':
      cleanRes = normalizeCasing(dataset.workingRows, dataset.columns, action.column, action.caseFormat);
      break;
    case 'replace_values':
      cleanRes = replaceValues(dataset.workingRows, dataset.columns, action.column, action.fromValue, action.toValue);
      break;
    case 'standardize_aliases':
      cleanRes = standardizeAliases(dataset.workingRows, dataset.columns, action.column, action.mappings);
      break;
    case 'convert_type':
      cleanRes = convertColumnType(dataset.workingRows, dataset.columns, action.column, action.targetType);
      break;
    case 'cap_outliers':
      cleanRes = capOutliers(dataset.workingRows, dataset.columns, action.column, action.bounds, dataset.profiles);
      break;
    case 'remove_outliers':
      cleanRes = removeOutliers(dataset.workingRows, dataset.columns, action.column, dataset.profiles);
      break;
    case 'replace_outliers_with_median':
      cleanRes = replaceOutliersWithMedian(dataset.workingRows, dataset.columns, action.column, dataset.profiles);
      break;
    case 'drop_column':
      cleanRes = dropColumn(dataset.workingRows, dataset.columns, action.column);
      break;
    case 'drop_constant_columns':
      cleanRes = dropConstantColumns(dataset.workingRows, dataset.columns, dataset.profiles);
      break;
    case 'rename_column':
      cleanRes = renameColumn(dataset.workingRows, dataset.columns, action.column, action.newName);
      break;
    default:
      cleanRes = { workingRows: dataset.workingRows, columns: dataset.columns, transformation: { id: '', timestamp: 0, type: '', description: '', affectedRowsCount: 0 } };
  }

  // Calculate after profiles and quality
  const afterProfiles = profileDataset(cleanRes.workingRows, cleanRes.columns);
  const afterQuality = auditDataQuality(cleanRes.workingRows, cleanRes.columns, afterProfiles);
  const afterStats = computeDatasetStats({
    workingRows: cleanRes.workingRows,
    columns: cleanRes.columns,
    quality: afterQuality
  });

  // Extract sample changed rows
  const sampleDiffRows: BeforeAfterPreview['sampleDiffRows'] = [];
  const maxDiffSamples = 5;

  for (let i = 0; i < Math.min(dataset.workingRows.length, cleanRes.workingRows.length); i++) {
    const beforeRow = dataset.workingRows[i];
    const afterRow = cleanRes.workingRows[i];
    const changedFields: string[] = [];

    for (const col of dataset.columns) {
      if (beforeRow[col] !== afterRow[col]) {
        changedFields.push(col);
      }
    }

    if (changedFields.length > 0) {
      sampleDiffRows.push({
        rowIndex: i + 1,
        before: beforeRow,
        after: afterRow,
        changedFields
      });
      if (sampleDiffRows.length >= maxDiffSamples) break;
    }
  }

  return {
    action,
    title: cleanRes.transformation.type.replace(/_/g, ' ').toUpperCase(),
    description: cleanRes.transformation.description,
    affectedRowsCount: cleanRes.transformation.affectedRowsCount,
    beforeStats,
    afterStats,
    sampleDiffRows
  };
}

// Master stateful wrapper that applies any transformation and re-profiles the dataset
export function applyTransformation(
  dataset: DatasetState,
  action: TransformationAction
): DatasetState {
  const beforeStats = computeDatasetStats(dataset);
  let result: CleanResult;

  switch (action.type) {
    case 'remove_duplicates':
      result = removeDuplicates(dataset.workingRows, dataset.columns);
      break;
    case 'remove_duplicate_ids':
      result = removeDuplicateIds(dataset.workingRows, dataset.columns, action.column, action.keep);
      break;
    case 'impute_missing':
      result = fillMissingValues(
        dataset.workingRows,
        dataset.columns,
        action.column,
        action.strategy,
        action.constantValue,
        dataset.profiles
      );
      break;
    case 'drop_missing':
      result = dropMissingRows(dataset.workingRows, dataset.columns, action.column);
      break;
    case 'drop_mostly_missing_columns':
      result = dropMostlyMissingColumns(dataset.workingRows, dataset.columns, action.threshold, dataset.profiles);
      break;
    case 'trim_whitespace':
      result = trimWhitespace(dataset.workingRows, dataset.columns, action.column);
      break;
    case 'standardize_case':
      result = normalizeCasing(dataset.workingRows, dataset.columns, action.column, action.caseFormat);
      break;
    case 'replace_values':
      result = replaceValues(dataset.workingRows, dataset.columns, action.column, action.fromValue, action.toValue);
      break;
    case 'standardize_aliases':
      result = standardizeAliases(dataset.workingRows, dataset.columns, action.column, action.mappings);
      break;
    case 'convert_type':
      result = convertColumnType(dataset.workingRows, dataset.columns, action.column, action.targetType);
      break;
    case 'cap_outliers':
      result = capOutliers(dataset.workingRows, dataset.columns, action.column, action.bounds, dataset.profiles);
      break;
    case 'remove_outliers':
      result = removeOutliers(dataset.workingRows, dataset.columns, action.column, dataset.profiles);
      break;
    case 'replace_outliers_with_median':
      result = replaceOutliersWithMedian(dataset.workingRows, dataset.columns, action.column, dataset.profiles);
      break;
    case 'drop_column':
      result = dropColumn(dataset.workingRows, dataset.columns, action.column);
      break;
    case 'drop_constant_columns':
      result = dropConstantColumns(dataset.workingRows, dataset.columns, dataset.profiles);
      break;
    case 'rename_column':
      result = renameColumn(dataset.workingRows, dataset.columns, action.column, action.newName);
      break;
    default:
      throw new Error(`Unsupported transformation: ${(action as any).type}`);
  }

  // Re-profile updated dataset
  const updatedProfiles = profileDataset(result.workingRows, result.columns);
  const updatedQuality = auditDataQuality(result.workingRows, result.columns, updatedProfiles);
  const afterStats = computeDatasetStats({
    workingRows: result.workingRows,
    columns: result.columns,
    quality: updatedQuality
  });

  const updatedDataset: DatasetState = {
    ...dataset,
    workingRows: result.workingRows,
    columns: result.columns,
    profiles: updatedProfiles,
    quality: updatedQuality,
    transformations: [
      ...dataset.transformations,
      {
        ...result.transformation,
        action,
        beforeStats,
        afterStats
      }
    ]
  };

  // Re-generate cleaning plan, insights, recommendations
  const cleaningPlan = generateCleaningPlan(updatedDataset);
  const { insights, recommendations, suggestedQuestions } = generateDatasetInsights(
    result.workingRows,
    result.columns,
    updatedProfiles
  );

  return {
    ...updatedDataset,
    cleaningPlan,
    insights,
    recommendations,
    suggestedQuestions
  };
}

export function undoLastTransformation(dataset: DatasetState): DatasetState {
  if (dataset.transformations.length === 0) return dataset;

  const remainingTransformations = dataset.transformations.slice(0, -1);
  let currentRows = dataset.originalRows.map(r => ({ ...r }));
  let currentCols = Object.keys(currentRows[0] || {});

  // Replay remaining transformations from original state
  const replayedTransformations: CleaningTransformation[] = [];
  for (const t of remainingTransformations) {
    if (t.action) {
      let res: CleanResult;
      const profs = profileDataset(currentRows, currentCols);

      switch (t.action.type) {
        case 'remove_duplicates':
          res = removeDuplicates(currentRows, currentCols);
          break;
        case 'remove_duplicate_ids':
          res = removeDuplicateIds(currentRows, currentCols, t.action.column, t.action.keep);
          break;
        case 'impute_missing':
          res = fillMissingValues(currentRows, currentCols, t.action.column, t.action.strategy, t.action.constantValue, profs);
          break;
        case 'drop_missing':
          res = dropMissingRows(currentRows, currentCols, t.action.column);
          break;
        case 'drop_mostly_missing_columns':
          res = dropMostlyMissingColumns(currentRows, currentCols, t.action.threshold, profs);
          break;
        case 'trim_whitespace':
          res = trimWhitespace(currentRows, currentCols, t.action.column);
          break;
        case 'standardize_case':
          res = normalizeCasing(currentRows, currentCols, t.action.column, t.action.caseFormat);
          break;
        case 'replace_values':
          res = replaceValues(currentRows, currentCols, t.action.column, t.action.fromValue, t.action.toValue);
          break;
        case 'standardize_aliases':
          res = standardizeAliases(currentRows, currentCols, t.action.column, t.action.mappings);
          break;
        case 'convert_type':
          res = convertColumnType(currentRows, currentCols, t.action.column, t.action.targetType);
          break;
        case 'cap_outliers':
          res = capOutliers(currentRows, currentCols, t.action.column, t.action.bounds, profs);
          break;
        case 'remove_outliers':
          res = removeOutliers(currentRows, currentCols, t.action.column, profs);
          break;
        case 'replace_outliers_with_median':
          res = replaceOutliersWithMedian(currentRows, currentCols, t.action.column, profs);
          break;
        case 'drop_column':
          res = dropColumn(currentRows, currentCols, t.action.column);
          break;
        case 'drop_constant_columns':
          res = dropConstantColumns(currentRows, currentCols, profs);
          break;
        case 'rename_column':
          res = renameColumn(currentRows, currentCols, t.action.column, t.action.newName);
          break;
        default:
          res = { workingRows: currentRows, columns: currentCols, transformation: t };
      }
      currentRows = res.workingRows;
      currentCols = res.columns;
      replayedTransformations.push({ ...t, ...res.transformation, action: t.action });
    }
  }

  const updatedProfiles = profileDataset(currentRows, currentCols);
  const updatedQuality = auditDataQuality(currentRows, currentCols, updatedProfiles);
  const updatedDataset: DatasetState = {
    ...dataset,
    workingRows: currentRows,
    columns: currentCols,
    profiles: updatedProfiles,
    quality: updatedQuality,
    transformations: replayedTransformations
  };

  const cleaningPlan = generateCleaningPlan(updatedDataset);
  const { insights, recommendations, suggestedQuestions } = generateDatasetInsights(
    currentRows,
    currentCols,
    updatedProfiles
  );

  return {
    ...updatedDataset,
    cleaningPlan,
    insights,
    recommendations,
    suggestedQuestions
  };
}

export function revertToOriginal(dataset: DatasetState): DatasetState {
  const originalCopy = dataset.originalRows.map(r => ({ ...r }));
  const columns = Object.keys(originalCopy[0] || {});
  const profiles = profileDataset(originalCopy, columns);
  const quality = auditDataQuality(originalCopy, columns, profiles);

  const initialDataset: DatasetState = {
    ...dataset,
    workingRows: originalCopy,
    columns,
    profiles,
    quality,
    transformations: []
  };

  const cleaningPlan = generateCleaningPlan(initialDataset);
  const { insights, recommendations, suggestedQuestions } = generateDatasetInsights(
    originalCopy,
    columns,
    profiles
  );

  return {
    ...initialDataset,
    cleaningPlan,
    insights,
    recommendations,
    suggestedQuestions
  };
}
