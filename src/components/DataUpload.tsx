import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  FileType,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Database,
  Sliders,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { parseFile } from '../services/dataParser';
import { profileDataset } from '../services/profiler';
import { auditDataQuality } from '../services/qualityEngine';
import { generateDatasetInsights } from '../services/insightEngine';
import { DatasetState } from '../types/dataset';
import { SAMPLE_DATASETS } from '../services/sampleData';

interface DataUploadProps {
  onDatasetLoaded: (dataset: DatasetState) => void;
  onNavigate?: (section: any) => void;
  onLoadSample?: (sampleId: string) => void;
}

type UploadStep = 'idle' | 'uploading' | 'validating' | 'creating' | 'ready';

interface UploadSuccessData {
  name: string;
  fileName: string;
  rows: number;
  columns: number;
  status: string;
  qualityScore: number;
}

export const DataUpload: React.FC<DataUploadProps> = ({ onDatasetLoaded, onNavigate, onLoadSample }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<UploadSuccessData | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customDelimiter, setCustomDelimiter] = useState<string>('auto');
  const [skipHeaderRows, setSkipHeaderRows] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processAndSetDataset = async (
    name: string,
    fileName: string,
    fileSize: number,
    fileType: string,
    columns: string[],
    rows: Record<string, any>[]
  ) => {
    try {
      setUploadStep('uploading');
      await new Promise(r => setTimeout(r, 150));

      setUploadStep('validating');
      if (!rows || rows.length === 0 || !columns || columns.length === 0) {
        throw new Error('Dataset is empty or contains no readable columns/rows.');
      }
      await new Promise(r => setTimeout(r, 150));

      setUploadStep('creating');
      const profiles = profileDataset(rows, columns);
      const quality = auditDataQuality(rows, columns, profiles);
      const { insights, recommendations, suggestedQuestions } = generateDatasetInsights(rows, columns, profiles);

      const datasetState: DatasetState = {
        id: `ds-${Date.now()}`,
        name,
        fileName,
        fileSize,
        fileType,
        uploadedAt: Date.now(),
        originalRows: JSON.parse(JSON.stringify(rows)),
        workingRows: JSON.parse(JSON.stringify(rows)),
        columns,
        profiles,
        quality,
        transformations: [],
        insights,
        recommendations,
        suggestedQuestions
      };

      setUploadStep('ready');
      setSuccessData({
        name,
        fileName,
        rows: rows.length,
        columns: columns.length,
        status: 'Ready for Analysis',
        qualityScore: quality.score
      });

      onDatasetLoaded(datasetState);

      setTimeout(() => {
        if (onNavigate) {
          onNavigate('overview');
        }
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Upload failed. Please check the file format and try again.');
      setUploadStep('idle');
    }
  };

  const handleFileChange = async (file: File) => {
    setErrorMessage(null);
    setSuccessData(null);
    setUploadStep('uploading');

    try {
      const parsed = await parseFile(file);
      await processAndSetDataset(
        file.name.replace(/\.[^/.]+$/, ''),
        file.name,
        file.size,
        parsed.fileType,
        parsed.columns,
        parsed.rows
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Upload failed. Please check the file and try again.');
      setUploadStep('idle');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileChange(file);
    }
  };

  const isLoading = uploadStep !== 'idle' && uploadStep !== 'ready';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-[#252A36] pb-4">
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">Data Ingestion</h1>
        <p className="text-xs text-slate-400 mt-1">
          Bring your tabular data into DataMind AI. Upload a CSV or Excel spreadsheet, or pick a sample dataset.
        </p>
      </div>

      {/* Primary Upload Card */}
      <div
        onDragOver={e => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer relative overflow-hidden ${
          isDragging
            ? 'border-amber-400 bg-amber-500/10'
            : 'border-[#252A36] bg-[#12151C] hover:border-amber-500/40 hover:bg-[#181D26]'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={e => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileChange(e.target.files[0]);
            }
          }}
          accept=".csv,.xlsx,.xls,.json,.txt"
          className="hidden"
        />

        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3.5 shadow-lg shadow-amber-500/10">
          <UploadCloud className="w-7 h-7" />
        </div>

        <h3 className="text-sm font-semibold text-slate-100">
          Drag and drop your dataset here, or <span className="text-amber-400 underline decoration-amber-500/50">browse files</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          Supports CSV (.csv), Excel (.xlsx, .xls), and JSON files with automatic schema detection.
        </p>

        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            type="button"
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition cursor-pointer flex items-center gap-2 mx-auto"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Data</span>
          </button>
        </div>

        {isLoading && (
          <div className="absolute inset-0 bg-[#0B0D11]/90 backdrop-blur-sm flex flex-col items-center justify-center z-20 space-y-3">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-amber-400">
                {uploadStep === 'uploading' && 'Uploading file...'}
                {uploadStep === 'validating' && 'Checking columns and rows...'}
                {uploadStep === 'creating' && 'Generating data profile & quality score...'}
              </p>
              <p className="text-xs text-slate-400 font-mono">Almost ready...</p>
            </div>
          </div>
        )}
      </div>

      {/* Success Notification */}
      {successData && (
        <div className="bg-[#12151C] border border-emerald-500/30 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#252A36] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-300">Dataset Loaded Successfully</h3>
                <p className="text-xs text-slate-400">{successData.name} is ready for exploration and analysis.</p>
              </div>
            </div>

            {onNavigate && (
              <button
                onClick={() => onNavigate('overview')}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20"
              >
                <span>Explore Data</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0B0D11] border border-[#252A36] rounded-xl p-3 text-center">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400">Dataset Name</span>
              <p className="text-xs font-bold text-slate-200 truncate mt-0.5" title={successData.name}>{successData.name}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400">Rows</span>
              <p className="text-xs font-bold text-slate-200 font-mono mt-0.5">{successData.rows.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400">Columns</span>
              <p className="text-xs font-bold text-slate-200 font-mono mt-0.5">{successData.columns}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400">Status</span>
              <p className="text-xs font-bold text-emerald-400 font-mono mt-0.5">{successData.status}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3 text-rose-300 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Sample Datasets Selector */}
      <div className="border-t border-[#252A36] pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">Or Select a Sample Dataset</span>
          <span className="text-[11px] text-slate-400">Instant load for demonstration</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SAMPLE_DATASETS.map(sample => (
            <button
              key={sample.id}
              onClick={() => onLoadSample && onLoadSample(sample.id)}
              className="p-3.5 rounded-xl bg-[#12151C] hover:bg-[#181D26] border border-[#252A36] hover:border-amber-500/30 text-left transition flex items-start justify-between gap-3 group cursor-pointer"
            >
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition">
                  {sample.name}
                </p>
                <p className="text-[11px] text-slate-400 line-clamp-2">
                  {sample.description}
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#181D26] text-slate-400 group-hover:text-amber-400 shrink-0">
                Load
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Import Options (Hidden by default) */}
      <div className="border-t border-[#252A36] pt-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-slate-400 hover:text-slate-200 font-medium flex items-center gap-1.5 transition cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span>Advanced Import Options</span>
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showAdvanced && (
          <div className="mt-3 p-4 rounded-xl bg-[#12151C] border border-[#252A36] grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in text-xs">
            <div>
              <label className="block text-slate-400 mb-1">CSV Delimiter</label>
              <select
                value={customDelimiter}
                onChange={e => setCustomDelimiter(e.target.value)}
                className="w-full bg-[#0B0D11] border border-[#252A36] rounded-lg px-3 py-1.5 text-slate-200"
              >
                <option value="auto">Auto-detect (Comma, Tab, Semicolon)</option>
                <option value=",">Comma (,)</option>
                <option value=";">Semicolon (;)</option>
                <option value="\t">Tab (\t)</option>
                <option value="|">Pipe (|)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Skip Header Rows</label>
              <input
                type="number"
                min="0"
                max="10"
                value={skipHeaderRows}
                onChange={e => setSkipHeaderRows(parseInt(e.target.value) || 0)}
                className="w-full bg-[#0B0D11] border border-[#252A36] rounded-lg px-3 py-1.5 text-slate-200"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

