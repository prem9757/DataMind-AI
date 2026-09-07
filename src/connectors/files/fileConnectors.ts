import { Connector } from '../types';
import { parseFile } from '../../services/dataParser';

export const csvConnector: Connector = {
  id: 'file-csv',
  name: 'CSV File',
  category: 'files',
  description: 'Import data from a Comma-Separated Values file.',
  icon: 'FileText',
  configFields: [
    { id: 'file', label: 'Select File', type: 'file', required: true }
  ],
  testConnection: async (config) => {
    if (!config.file) throw new Error("No file selected.");
    return { status: 'success', message: 'File is ready.' };
  },
  preview: async (config) => {
    if (!config.file) throw new Error("No file selected.");
    const parsed = await parseFile(config.file);
    return {
      columns: parsed.columns,
      rows: parsed.rows.slice(0, 100),
      rowCount: parsed.rows.length,
      columnCount: parsed.columns.length
    };
  },
  import: async (config) => {
    if (!config.file) throw new Error("No file selected.");
    const parsed = await parseFile(config.file);
    return {
      columns: parsed.columns,
      rows: parsed.rows
    };
  }
};

export const excelConnector: Connector = {
  id: 'file-excel',
  name: 'Excel Workbook',
  category: 'files',
  description: 'Import data from .xlsx or .xls files.',
  icon: 'FileSpreadsheet',
  configFields: [
    { id: 'file', label: 'Select File', type: 'file', required: true }
  ],
  testConnection: async (config) => {
    if (!config.file) throw new Error("No file selected.");
    return { status: 'success', message: 'File is ready.' };
  },
  preview: async (config) => {
    if (!config.file) throw new Error("No file selected.");
    const parsed = await parseFile(config.file);
    return {
      columns: parsed.columns,
      rows: parsed.rows.slice(0, 100),
      rowCount: parsed.rows.length,
      columnCount: parsed.columns.length
    };
  },
  import: async (config) => {
    if (!config.file) throw new Error("No file selected.");
    const parsed = await parseFile(config.file);
    return {
      columns: parsed.columns,
      rows: parsed.rows
    };
  }
};

export const jsonConnector: Connector = {
  id: 'file-json',
  name: 'JSON File',
  category: 'files',
  description: 'Import structured data from JSON files.',
  icon: 'FileText',
  configFields: [
    { id: 'file', label: 'Select File', type: 'file', required: true }
  ],
  testConnection: async (config) => {
    if (!config.file) throw new Error("No file selected.");
    return { status: 'success', message: 'File is ready.' };
  },
  preview: async (config) => {
    if (!config.file) throw new Error("No file selected.");
    const parsed = await parseFile(config.file);
    return {
      columns: parsed.columns,
      rows: parsed.rows.slice(0, 100),
      rowCount: parsed.rows.length,
      columnCount: parsed.columns.length
    };
  },
  import: async (config) => {
    if (!config.file) throw new Error("No file selected.");
    const parsed = await parseFile(config.file);
    return {
      columns: parsed.columns,
      rows: parsed.rows
    };
  }
};
