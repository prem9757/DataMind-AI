import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ColumnType } from '../types/dataset';

export interface ParseResult {
  fileName: string;
  fileSize: number;
  fileType: string;
  sheetNames?: string[];
  selectedSheet?: string;
  columns: string[];
  rows: Record<string, any>[];
  totalRows: number;
  totalColumns: number;
  encoding?: string;
}

export function inferColumnType(values: any[]): ColumnType {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '' && String(v).trim() !== '');
  if (nonNullValues.length === 0) return 'text';

  // Check boolean
  const booleanMatches = nonNullValues.filter(v => {
    const s = String(v).toLowerCase().trim();
    return s === 'true' || s === 'false' || s === 'yes' || s === 'no' || s === '1' || s === '0' || v === true || v === false;
  });
  if (booleanMatches.length / nonNullValues.length > 0.95 && nonNullValues.length > 3) {
    const isExplicitBool = nonNullValues.some(v => typeof v === 'boolean' || ['true', 'false', 'yes', 'no'].includes(String(v).toLowerCase().trim()));
    if (isExplicitBool) return 'boolean';
  }

  // Check numeric (including currency / formatted numbers)
  let numericCount = 0;
  for (const val of nonNullValues) {
    if (typeof val === 'number' && !isNaN(val)) {
      numericCount++;
    } else if (typeof val === 'string') {
      const clean = val.replace(/[\$,€,£,¥,%]/g, '').trim();
      if (clean !== '' && !isNaN(Number(clean))) {
        numericCount++;
      }
    }
  }
  if (numericCount / nonNullValues.length > 0.85) {
    return 'numeric';
  }

  // Check datetime
  let dateCount = 0;
  const dateRegex = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}/;
  for (const val of nonNullValues) {
    if (val instanceof Date) {
      dateCount++;
    } else if (typeof val === 'string') {
      if (dateRegex.test(val.trim())) {
        const parsed = Date.parse(val);
        if (!isNaN(parsed) && parsed > 0) dateCount++;
      }
    }
  }
  if (dateCount / nonNullValues.length > 0.8) {
    return 'datetime';
  }

  // Check ID / UUID / High cardinality code
  const uniqueCount = new Set(nonNullValues.map(v => String(v).trim())).size;
  const uniqueRatio = uniqueCount / nonNullValues.length;
  if (uniqueRatio > 0.95 && nonNullValues.length > 10) {
    const sample = String(nonNullValues[0]).toLowerCase();
    if (sample.includes('id') || sample.includes('uuid') || /^[a-z0-9_-]{6,}$/i.test(sample)) {
      return 'id';
    }
  }

  // Check categorical vs text (cardinality check)
  if (uniqueRatio < 0.4 || uniqueCount <= 25) {
    return 'categorical';
  }

  return 'text';
}

export async function parseFile(file: File, targetSheet?: string): Promise<ParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv' || extension === 'txt') {
    return parseCsvFile(file);
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseExcelFile(file, targetSheet);
  } else {
    throw new Error(`Unsupported file format .${extension}. Please upload a CSV, XLSX, or XLS file.`);
  }
}

async function parseCsvFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header: string) => header.trim(),
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          reject(new Error('The uploaded CSV file is empty or could not be parsed.'));
          return;
        }

        const rawRows = results.data as Record<string, any>[];
        // Filter out empty rows
        const rows = rawRows.filter(row => {
          return Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '');
        });

        if (rows.length === 0) {
          reject(new Error('No valid data rows found in the CSV file.'));
          return;
        }

        const columns = Object.keys(rows[0]).filter(col => col.trim() !== '');

        resolve({
          fileName: file.name,
          fileSize: file.size,
          fileType: 'CSV',
          columns,
          rows,
          totalRows: rows.length,
          totalColumns: columns.length,
          encoding: 'UTF-8'
        });
      },
      error: (error) => {
        reject(new Error(`Failed to parse CSV file: ${error.message}`));
      }
    });
  });
}

async function parseExcelFile(file: File, targetSheet?: string): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheetNames = workbook.SheetNames;
  if (!sheetNames || sheetNames.length === 0) {
    throw new Error('The uploaded Excel workbook contains no sheets.');
  }

  const selectedSheet = (targetSheet && sheetNames.includes(targetSheet)) ? targetSheet : sheetNames[0];
  const worksheet = workbook.Sheets[selectedSheet];
  
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
    raw: false,
    dateNF: 'yyyy-mm-dd'
  });

  if (!rawRows || rawRows.length === 0) {
    throw new Error(`Sheet "${selectedSheet}" is empty or has no recognizable table data.`);
  }

  // Type coerce numbers and dates
  const rows = rawRows.map(row => {
    const formatted: Record<string, any> = {};
    for (const [key, val] of Object.entries(row)) {
      const cleanKey = key.trim();
      if (!cleanKey) continue;
      
      if (typeof val === 'string') {
        const trimmed = val.trim();
        // Check if pure number
        if (trimmed !== '' && !isNaN(Number(trimmed)) && !trimmed.startsWith('0') && trimmed.length < 15) {
          formatted[cleanKey] = Number(trimmed);
        } else {
          formatted[cleanKey] = trimmed;
        }
      } else {
        formatted[cleanKey] = val;
      }
    }
    return formatted;
  });

  const columns = Object.keys(rows[0] || {}).filter(c => c.trim() !== '');

  return {
    fileName: file.name,
    fileSize: file.size,
    fileType: 'Excel',
    sheetNames,
    selectedSheet,
    columns,
    rows,
    totalRows: rows.length,
    totalColumns: columns.length
  };
}

export function parseRawArray(data: Record<string, any>[], name: string): ParseResult {
  if (!data || data.length === 0) {
    throw new Error('Data array is empty');
  }
  const columns = Object.keys(data[0]).filter(c => c.trim() !== '');
  return {
    fileName: name,
    fileSize: JSON.stringify(data).length,
    fileType: 'Dataset',
    columns,
    rows: data,
    totalRows: data.length,
    totalColumns: columns.length
  };
}

/**
 * Parses raw dataset content from local desktop files (UTF-8 string or base64)
 */
export async function parseRawDatasetContent(input: {
  fileName: string;
  fileSize: number;
  fileType: string;
  content: string;
  isBase64?: boolean;
}): Promise<ParseResult> {
  const ext = input.fileName.split('.').pop()?.toLowerCase() || '';

  if (ext === 'csv' || ext === 'tsv' || ext === 'txt' || (!input.isBase64 && ext !== 'xlsx' && ext !== 'xls' && ext !== 'json')) {
    return new Promise((resolve, reject) => {
      Papa.parse(input.content, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: 'greedy',
        transformHeader: (header: string) => header.trim(),
        complete: (results) => {
          if (!results.data || results.data.length === 0) {
            reject(new Error('The CSV dataset is empty or could not be parsed.'));
            return;
          }
          const rawRows = results.data as Record<string, any>[];
          const rows = rawRows.filter(row => Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== ''));
          if (rows.length === 0) {
            reject(new Error('No valid data rows found in the CSV dataset.'));
            return;
          }
          const columns = Object.keys(rows[0]).filter(col => col.trim() !== '');
          resolve({
            fileName: input.fileName,
            fileSize: input.fileSize,
            fileType: 'CSV',
            columns,
            rows,
            totalRows: rows.length,
            totalColumns: columns.length,
            encoding: 'UTF-8'
          });
        },
        error: (err) => reject(new Error(`Failed to parse CSV dataset: ${err.message}`))
      });
    });
  }

  if (ext === 'json') {
    try {
      const parsed = JSON.parse(input.content);
      const arrayData = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.data) ? parsed.data : [parsed]);
      return parseRawArray(arrayData, input.fileName);
    } catch (err: any) {
      throw new Error(`Failed to parse JSON dataset: ${err.message}`);
    }
  }

  if (ext === 'xlsx' || ext === 'xls' || input.isBase64) {
    const workbook = XLSX.read(input.content, { type: 'base64', cellDates: true });
    const sheetNames = workbook.SheetNames;
    if (!sheetNames || sheetNames.length === 0) {
      throw new Error('The Excel workbook contains no sheets.');
    }
    const selectedSheet = sheetNames[0];
    const worksheet = workbook.Sheets[selectedSheet];
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      dateNF: 'yyyy-mm-dd'
    });
    if (!rawRows || rawRows.length === 0) {
      throw new Error(`Sheet "${selectedSheet}" is empty or has no recognizable table data.`);
    }
    const rows = rawRows.map(row => {
      const formatted: Record<string, any> = {};
      for (const [key, val] of Object.entries(row)) {
        const cleanKey = key.trim();
        if (!cleanKey) continue;
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed !== '' && !isNaN(Number(trimmed)) && !trimmed.startsWith('0') && trimmed.length < 15) {
            formatted[cleanKey] = Number(trimmed);
          } else {
            formatted[cleanKey] = trimmed;
          }
        } else {
          formatted[cleanKey] = val;
        }
      }
      return formatted;
    });
    const columns = Object.keys(rows[0] || {}).filter(c => c.trim() !== '');
    return {
      fileName: input.fileName,
      fileSize: input.fileSize,
      fileType: 'Excel',
      sheetNames,
      selectedSheet,
      columns,
      rows,
      totalRows: rows.length,
      totalColumns: columns.length
    };
  }

  throw new Error(`Unsupported dataset format .${ext}. Please open a CSV, XLSX, XLS, or JSON dataset.`);
}
