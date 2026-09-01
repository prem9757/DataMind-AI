import React, { useState } from 'react';
import {
  Sparkles,
  RotateCcw,
  Undo2,
  Trash2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Filter,
  Eye,
  Check,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Clock,
  Wrench,
  FileText
} from 'lucide-react';
import {
  BeforeAfterPreview,
  CleaningPlanStep,
  DatasetState,
  TransformationAction
} from '../types/dataset';
import {
  applyTransformation,
  generateBeforeAfterPreview,
  revertToOriginal,
  undoLastTransformation
} from '../services/cleaner';
import { exportDatasetToCSV, exportDatasetToExcel } from '../services/reportEngine';

interface DataCleaningProps {
  dataset: DatasetState;
  onUpdateDataset: (updated: DatasetState) => void;
  onNavigateToEDA?: () => void;
  onNavigate?: (section: any) => void;
}

export const DataCleaning: React.FC<DataCleaningProps> = ({
  dataset,
  onUpdateDataset,
  onNavigateToEDA,
  onNavigate
}) => {
  const { workingRows, originalRows, columns, profiles, transformations, cleaningPlan, quality } = dataset;

  const [datasetViewMode, setDatasetViewMode] = useState<'working' | 'original'>('working');
  const [operationCategory, setOperationCategory] = useState<'missing' | 'duplicates' | 'outliers' | 'text_types'>('missing');
  const [selectedOperation, setSelectedOperation] = useState<
    | 'remove_duplicates'
    | 'remove_duplicate_ids'
    | 'impute_missing'
    | 'drop_missing'
    | 'drop_mostly_missing'
    | 'trim_whitespace'
    | 'standardize_case'
    | 'standardize_aliases'
    | 'convert_type'
    | 'cap_outliers'
    | 'remove_outliers'
    | 'replace_outliers_median'
    | 'drop_column'
    | 'drop_constant_columns'
    | 'rename_column'
  >('impute_missing');

  const [selectedColumn, setSelectedColumn] = useState<string>(columns[0] || '');
  const [imputeStrategy, setImputeStrategy] = useState<'mean' | 'median' | 'mode' | 'constant' | 'forward_fill' | 'backward_fill'>('median');
  const [constantValue, setConstantValue] = useState<string>('0');
  const [caseFormat, setCaseFormat] = useState<'title' | 'lower' | 'upper'>('title');
  const [targetType, setTargetType] = useState<'numeric' | 'datetime' | 'boolean' | 'categorical'>('numeric');
  const [aliasFrom, setAliasFrom] = useState<string>('');
  const [aliasTo, setAliasTo] = useState<string>('');
  const [newColumnName, setNewColumnName] = useState<string>('');
  const [activePlanStepExplanation, setActivePlanStepExplanation] = useState<string | null>(null);

  // Before / After Preview Modal State
  const [activePreview, setActivePreview] = useState<BeforeAfterPreview | null>(null);
  const [isApplyingPlan, setIsApplyingPlan] = useState(false);

  const numCols = columns.filter(c => profiles[c]?.type === 'numeric');
  const textCols = columns.filter(c => profiles[c]?.type === 'categorical' || profiles[c]?.type === 'text');

  const handleApplyActionDirectly = (action: TransformationAction) => {
    const updated = applyTransformation(dataset, action);
    onUpdateDataset(updated);
    setActivePreview(null);
  };

  const handleRequestPreview = (action: TransformationAction) => {
    try {
      const preview = generateBeforeAfterPreview(dataset, action);
      setActivePreview(preview);
    } catch (e) {
      handleApplyActionDirectly(action);
    }
  };

  const handleUndo = () => {
    const updated = undoLastTransformation(dataset);
    onUpdateDataset(updated);
  };

  const handleRevert = () => {
    if (window.confirm('Reset working dataset to original raw state? All cleaning transformations will be removed.')) {
      const updated = revertToOriginal(dataset);
      onUpdateDataset(updated);
    }
  };

  // Apply complete recommended cleaning plan step-by-step
  const handleApplyCompletePlan = () => {
    if (!cleaningPlan || cleaningPlan.steps.length === 0) return;
    setIsApplyingPlan(true);

    let current = dataset;
    for (const step of cleaningPlan.steps) {
      if (step.status === 'PENDING' && step.action) {
        current = applyTransformation(current, step.action);
      }
    }
    onUpdateDataset(current);
    setIsApplyingPlan(false);
  };

  const getActionFromCurrentForm = (): TransformationAction => {
    switch (selectedOperation) {
      case 'remove_duplicates':
        return { type: 'remove_duplicates' };
      case 'remove_duplicate_ids':
        return { type: 'remove_duplicate_ids', column: selectedColumn, keep: 'first' };
      case 'impute_missing':
        return {
          type: 'impute_missing',
          column: selectedColumn,
          strategy: imputeStrategy,
          constantValue
        };
      case 'drop_missing':
        return {
          type: 'drop_missing',
          column: selectedColumn === '__all__' ? undefined : selectedColumn
        };
      case 'drop_mostly_missing':
        return { type: 'drop_mostly_missing_columns', threshold: 70 };
      case 'trim_whitespace':
        return {
          type: 'trim_whitespace',
          column: selectedColumn === '__all__' ? undefined : selectedColumn
        };
      case 'standardize_case':
        return {
          type: 'standardize_case',
          column: selectedColumn,
          caseFormat
        };
      case 'standardize_aliases':
        return {
          type: 'standardize_aliases',
          column: selectedColumn,
          mappings: { [aliasFrom.trim()]: aliasTo.trim() }
        };
      case 'convert_type':
        return {
          type: 'convert_type',
          column: selectedColumn,
          targetType
        };
      case 'cap_outliers':
        return {
          type: 'cap_outliers',
          column: selectedColumn
        };
      case 'remove_outliers':
        return {
          type: 'remove_outliers',
          column: selectedColumn
        };
      case 'replace_outliers_median':
        return {
          type: 'replace_outliers_with_median',
          column: selectedColumn
        };
      case 'drop_column':
        return {
          type: 'drop_column',
          column: selectedColumn
        };
      case 'drop_constant_columns':
        return {
          type: 'drop_constant_columns'
        };
      case 'rename_column':
        return {
          type: 'rename_column',
          column: selectedColumn,
          newName: newColumnName.trim()
        };
      default:
        return { type: 'remove_duplicates' };
    }
  };

  const handleExecuteSelected = () => {
    const action = getActionFromCurrentForm();
    handleRequestPreview(action);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header & Working Dataset State Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#252A36] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">Data Preparation</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Non-Destructive
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Fix data problems safely. Original data remains immutable, and you can undo or reset anytime.
          </p>
        </div>

        {/* Dataset Version Selector & Controls */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center bg-[#12151C] border border-[#252A36] rounded-xl p-1 shadow-inner">
            <button
              onClick={() => setDatasetViewMode('working')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                datasetViewMode === 'working'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Working Data ({workingRows.length} rows)
            </button>
            <button
              onClick={() => setDatasetViewMode('original')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                datasetViewMode === 'original'
                  ? 'bg-[#252A36] text-slate-100 shadow font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Original Source ({originalRows.length} rows)
            </button>
          </div>

          <button
            onClick={handleUndo}
            disabled={transformations.length === 0}
            className="px-3 py-2 rounded-xl bg-[#12151C] border border-[#252A36] text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#181D26] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Undo latest transformation"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </button>

          <button
            onClick={handleRevert}
            disabled={transformations.length === 0}
            className="px-3 py-2 rounded-xl bg-[#12151C] border border-[#252A36] text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#181D26] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Reset to uploaded original"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>

          {(onNavigateToEDA || onNavigate) && (
            <button
              onClick={() => {
                if (onNavigateToEDA) onNavigateToEDA();
                else if (onNavigate) onNavigate('eda');
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Automated Exploratory Data Analysis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* RECOMMENDED CLEANING PLAN SECTION */}
      {cleaningPlan && cleaningPlan.steps.length > 0 && (
        <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#252A36] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Recommended Cleaning Plan ({cleaningPlan.steps.length} Prioritized Steps)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated pipeline ordered by statistical dependency to optimize data quality and prevent schema distortion.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Score Projection</span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {cleaningPlan.estimatedScoreImprovement.currentScore} &rarr; {cleaningPlan.estimatedScoreImprovement.projectedScore} / 100
                </span>
              </div>

              <button
                onClick={handleApplyCompletePlan}
                disabled={isApplyingPlan}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Apply Complete Plan
              </button>
            </div>
          </div>

          {/* Steps List */}
          <div className="space-y-2.5">
            {cleaningPlan.steps.map(step => (
              <div
                key={step.id}
                className="bg-[#0B0D11] border border-[#252A36] rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-amber-500/30 transition"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-mono font-bold flex items-center justify-center">
                      {step.stepNumber}
                    </span>
                    <span className="text-xs font-bold text-slate-200">{step.title}</span>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded border uppercase text-slate-400 border-[#2D3342]">
                      {step.column}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 pl-7">{step.description}</p>
                </div>

                <div className="flex items-center gap-2 pl-7 md:pl-0 shrink-0">
                  <button
                    onClick={() =>
                      setActivePlanStepExplanation(
                        activePlanStepExplanation === step.id ? null : step.id
                      )
                    }
                    className="px-2.5 py-1.5 rounded-xl bg-[#181D26] hover:bg-[#202733] text-slate-300 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5 text-amber-400" />
                    Rationale
                    {activePlanStepExplanation === step.id ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => handleRequestPreview(step.action)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Apply Step
                  </button>
                </div>

                {/* Expanded Rationale */}
                {activePlanStepExplanation === step.id && (
                  <div className="w-full mt-2 pt-2 border-t border-[#252A36] grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-300 pl-7">
                    <div className="bg-[#12151C] p-2.5 rounded-xl border border-[#252A36]">
                      <strong className="text-amber-400 block mb-0.5 font-mono">Why Apply?</strong>
                      {step.whyExplanation}
                    </div>
                    <div className="bg-[#12151C] p-2.5 rounded-xl border border-[#252A36]">
                      <strong className="text-amber-400 block mb-0.5 font-mono">What Changes?</strong>
                      {step.whatWillChange}
                    </div>
                    <div className="bg-[#12151C] p-2.5 rounded-xl border border-[#252A36]">
                      <strong className="text-amber-400 block mb-0.5 font-mono">Expected Impact &amp; Risks</strong>
                      {step.expectedImpact} • {step.risks}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN WORKBENCH GRID: Tools Configurator vs Audit Timeline & Exports */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Interactive Transformation Toolbox */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Transformation Recipes Toolbox
              </h3>
              <span className="text-xs font-mono text-amber-400 font-bold">
                Active Columns: {columns.length}
              </span>
            </div>

            {/* Operation Category Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-[#0B0D11] border border-[#252A36] rounded-xl text-xs">
              {[
                { id: 'missing', label: 'Missing Data', defaultOp: 'impute_missing' },
                { id: 'duplicates', label: 'Duplicates', defaultOp: 'remove_duplicates' },
                { id: 'outliers', label: 'Outliers', defaultOp: 'cap_outliers' },
                { id: 'text_types', label: 'Text & Types', defaultOp: 'standardize_case' }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setOperationCategory(cat.id as any);
                    setSelectedOperation(cat.defaultOp as any);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-semibold text-center transition cursor-pointer ${
                    operationCategory === cat.id
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Recipes for active category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {operationCategory === 'missing' && (
                <>
                  <button
                    onClick={() => setSelectedOperation('impute_missing')}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition border cursor-pointer ${
                      selectedOperation === 'impute_missing'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow'
                        : 'bg-[#0B0D11] border-[#252A36] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-bold block text-slate-200">Fill Missing Values</span>
                    <span className="text-[11px] text-slate-400">Replace with median, mean, mode, or constant</span>
                  </button>

                  <button
                    onClick={() => setSelectedOperation('drop_missing')}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition border cursor-pointer ${
                      selectedOperation === 'drop_missing'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow'
                        : 'bg-[#0B0D11] border-[#252A36] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-bold block text-slate-200">Drop Missing Rows</span>
                    <span className="text-[11px] text-slate-400">Remove records with empty fields</span>
                  </button>

                  <button
                    onClick={() => setSelectedOperation('drop_mostly_missing')}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition border cursor-pointer sm:col-span-2 ${
                      selectedOperation === 'drop_mostly_missing'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow'
                        : 'bg-[#0B0D11] border-[#252A36] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-bold block text-slate-200">Prune Sparse Columns</span>
                    <span className="text-[11px] text-slate-400">Drop features with &gt;70% null values</span>
                  </button>
                </>
              )}

              {operationCategory === 'duplicates' && (
                <>
                  <button
                    onClick={() => setSelectedOperation('remove_duplicates')}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition border cursor-pointer ${
                      selectedOperation === 'remove_duplicates'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow'
                        : 'bg-[#0B0D11] border-[#252A36] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-bold block text-slate-200">Remove Duplicate Rows</span>
                    <span className="text-[11px] text-slate-400">Deduplicate identical records across all columns</span>
                  </button>

                  <button
                    onClick={() => setSelectedOperation('remove_duplicate_ids')}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition border cursor-pointer ${
                      selectedOperation === 'remove_duplicate_ids'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow'
                        : 'bg-[#0B0D11] border-[#252A36] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-bold block text-slate-200">Deduplicate by ID</span>
                    <span className="text-[11px] text-slate-400">Retain unique keys for specific identifier column</span>
                  </button>
                </>
              )}

              {operationCategory === 'outliers' && (
                <>
                  <button
                    onClick={() => setSelectedOperation('cap_outliers')}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition border cursor-pointer ${
                      selectedOperation === 'cap_outliers'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow'
                        : 'bg-[#0B0D11] border-[#252A36] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-bold block text-slate-200">Cap Outliers (IQR)</span>
                    <span className="text-[11px] text-slate-400">Winsorize extreme values to IQR fences</span>
                  </button>

                  <button
                    onClick={() => setSelectedOperation('remove_outliers')}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition border cursor-pointer ${
                      selectedOperation === 'remove_outliers'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow'
                        : 'bg-[#0B0D11] border-[#252A36] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-bold block text-slate-200">Remove Outlier Rows</span>
                    <span className="text-[11px] text-slate-400">Delete records exceeding boundary thresholds</span>
                  </button>
                </>
              )}

              {operationCategory === 'text_types' && (
                <>
                  <button
                    onClick={() => setSelectedOperation('standardize_case')}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition border cursor-pointer ${
                      selectedOperation === 'standardize_case'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow'
                        : 'bg-[#0B0D11] border-[#252A36] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-bold block text-slate-200">Standardize Casing</span>
                    <span className="text-[11px] text-slate-400">Convert to Title, lower, or UPPER case</span>
                  </button>

                  <button
                    onClick={() => setSelectedOperation('trim_whitespace')}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition border cursor-pointer ${
                      selectedOperation === 'trim_whitespace'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow'
                        : 'bg-[#0B0D11] border-[#252A36] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-bold block text-slate-200">Trim Whitespace</span>
                    <span className="text-[11px] text-slate-400">Strip leading and trailing spaces</span>
                  </button>

                  <button
                    onClick={() => setSelectedOperation('convert_type')}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition border cursor-pointer ${
                      selectedOperation === 'convert_type'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow'
                        : 'bg-[#0B0D11] border-[#252A36] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-bold block text-slate-200">Convert Data Type</span>
                    <span className="text-[11px] text-slate-400">Cast to Numeric, Datetime, Boolean, or Text</span>
                  </button>

                  <button
                    onClick={() => setSelectedOperation('rename_column')}
                    className={`p-2.5 rounded-xl text-xs font-semibold text-left transition border cursor-pointer ${
                      selectedOperation === 'rename_column'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow'
                        : 'bg-[#0B0D11] border-[#252A36] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-bold block text-slate-200">Rename Column</span>
                    <span className="text-[11px] text-slate-400">Update column header label</span>
                  </button>
                </>
              )}
            </div>

            {/* Config Form based on selected operation */}
            <div className="pt-3 border-t border-[#252A36] space-y-4">
              {/* EXACT DUPLICATES */}
              {selectedOperation === 'remove_duplicates' && (
                <div className="space-y-2 text-xs text-slate-300">
                  <p>Scan the entire dataset for duplicate records across all columns and retain the first occurrence.</p>
                  <div className="p-3 bg-[#0B0D11] rounded-xl border border-[#252A36] font-mono text-amber-400">
                    Detected duplicate rows: {dataset.quality.duplicateRows} ({dataset.quality.duplicateRowPercentage}%)
                  </div>
                </div>
              )}

              {/* DUPLICATE IDS */}
              {selectedOperation === 'remove_duplicate_ids' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Target Identifier Column</label>
                    <select
                      value={selectedColumn}
                      onChange={e => setSelectedColumn(e.target.value)}
                      className="mt-1 w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      {columns.map(col => (
                        <option key={col} value={col}>
                          {col} ({profiles[col]?.uniqueCount || 0} unique of {profiles[col]?.totalCount || 0})
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-slate-400">Retains first record for each unique ID key and drops subsequent collisions.</p>
                </div>
              )}

              {/* IMPUTE MISSING */}
              {selectedOperation === 'impute_missing' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 uppercase">Column</label>
                      <select
                        value={selectedColumn}
                        onChange={e => setSelectedColumn(e.target.value)}
                        className="mt-1 w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      >
                        {columns.map(col => (
                          <option key={col} value={col}>
                            {col} ({profiles[col]?.nullCount || 0} missing)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 uppercase">Imputation Method</label>
                      <select
                        value={imputeStrategy}
                        onChange={e => setImputeStrategy(e.target.value as any)}
                        className="mt-1 w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      >
                        <option value="median">Median (Resistant to Outliers)</option>
                        <option value="mean">Mean (Arithmetic Average)</option>
                        <option value="mode">Mode (Most Frequent Category)</option>
                        <option value="constant">Custom Constant</option>
                        <option value="forward_fill">Forward Fill (ffill)</option>
                        <option value="backward_fill">Backward Fill (bfill)</option>
                      </select>
                    </div>
                  </div>

                  {imputeStrategy === 'constant' && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 uppercase">Constant Value</label>
                      <input
                        type="text"
                        value={constantValue}
                        onChange={e => setConstantValue(e.target.value)}
                        placeholder="e.g. 0 or 'Unknown'"
                        className="mt-1 w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* CONVERT TYPE */}
              {selectedOperation === 'convert_type' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Column</label>
                    <select
                      value={selectedColumn}
                      onChange={e => setSelectedColumn(e.target.value)}
                      className="mt-1 w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      {columns.map(col => (
                        <option key={col} value={col}>
                          {col} (current: {profiles[col]?.type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Target Type</label>
                    <select
                      value={targetType}
                      onChange={e => setTargetType(e.target.value as any)}
                      className="mt-1 w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="numeric">Numeric (Integer / Float / Currency Strip)</option>
                      <option value="datetime">Datetime (ISO 8601)</option>
                      <option value="boolean">Boolean (True / False)</option>
                      <option value="categorical">Categorical / Text</option>
                    </select>
                  </div>
                </div>
              )}

              {/* STANDARDIZE CASING */}
              {selectedOperation === 'standardize_case' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Column</label>
                    <select
                      value={selectedColumn}
                      onChange={e => setSelectedColumn(e.target.value)}
                      className="mt-1 w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      {textCols.map(col => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Format</label>
                    <select
                      value={caseFormat}
                      onChange={e => setCaseFormat(e.target.value as any)}
                      className="mt-1 w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="title">Title Case (e.g. "North America")</option>
                      <option value="lower">lowercase (e.g. "north america")</option>
                      <option value="upper">UPPERCASE (e.g. "NORTH AMERICA")</option>
                    </select>
                  </div>
                </div>
              )}

              {/* CAP OUTLIERS */}
              {selectedOperation === 'cap_outliers' && (
                <div className="space-y-2 text-xs">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Numeric Column</label>
                  <select
                    value={selectedColumn}
                    onChange={e => setSelectedColumn(e.target.value)}
                    className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    {numCols.map(col => (
                      <option key={col} value={col}>
                        {col} ({profiles[col]?.outlierCount || 0} outliers detected)
                      </option>
                    ))}
                  </select>
                  <p className="text-slate-400">
                    Clamps values beyond [Q1 - 1.5×IQR, Q3 + 1.5×IQR] boundaries without removing rows.
                  </p>
                </div>
              )}

              {/* DROP CONSTANT COLUMNS */}
              {selectedOperation === 'drop_constant_columns' && (
                <p className="text-xs text-slate-300">
                  Automatically drops all columns that contain only 1 unique value across all rows (0 variance).
                </p>
              )}

              {/* RENAME COLUMN */}
              {selectedOperation === 'rename_column' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Original Column</label>
                    <select
                      value={selectedColumn}
                      onChange={e => setSelectedColumn(e.target.value)}
                      className="mt-1 w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      {columns.map(col => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">New Column Name</label>
                    <input
                      type="text"
                      value={newColumnName}
                      onChange={e => setNewColumnName(e.target.value)}
                      placeholder="e.g. Customer_ID"
                      className="mt-1 w-full bg-[#0B0D11] border border-[#2D3342] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* Action Trigger */}
              <div className="pt-2">
                <button
                  onClick={handleExecuteSelected}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  Preview Transformation Before Applying
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Transformation Audit Log & Separate Exports */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Transformation History ({transformations.length})
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Score: {quality.score}/100
              </span>
            </div>

            {transformations.length === 0 ? (
              <div className="p-8 text-center bg-[#0B0D11] rounded-xl border border-[#252A36] text-slate-500 text-xs">
                No transformations applied yet. Working dataset is identical to raw original.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto custom-scrollbar">
                {transformations.map((t, idx) => (
                  <div
                    key={t.id}
                    className="p-3 bg-[#0B0D11] border border-[#252A36] rounded-xl text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] flex items-center justify-center font-mono font-bold">
                          {idx + 1}
                        </span>
                        {t.type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(t.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-slate-400 text-[11px] pl-5">{t.description}</p>

                    {t.beforeStats && t.afterStats && (
                      <div className="pl-5 flex items-center gap-3 text-[10px] font-mono text-slate-500 pt-0.5">
                        <span>Rows: {t.beforeStats.totalRows} &rarr; {t.afterStats.totalRows}</span>
                        <span>Score: {t.beforeStats.qualityScore} &rarr; {t.afterStats.qualityScore}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Separate Export Buttons */}
            <div className="pt-3 border-t border-[#252A36] space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Separate Dataset Exports
              </span>

              {/* Clean Working Dataset */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Cleaned Working Dataset ({workingRows.length} rows)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => exportDatasetToCSV(workingRows, `${dataset.name}_cleaned`)}
                    className="py-1.5 px-3 rounded-xl bg-[#0B0D11] border border-[#252A36] hover:bg-[#181D26] text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    Clean CSV
                  </button>
                  <button
                    onClick={() => exportDatasetToExcel(workingRows, `${dataset.name}_cleaned`)}
                    className="py-1.5 px-3 rounded-xl bg-[#0B0D11] border border-[#252A36] hover:bg-[#181D26] text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    Clean Excel
                  </button>
                </div>
              </div>

              {/* Original Raw Dataset */}
              <div className="space-y-1.5 pt-2 border-t border-[#252A36]">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                  Original Raw Dataset ({originalRows.length} rows)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => exportDatasetToCSV(originalRows, `${dataset.name}_original`)}
                    className="py-1.5 px-3 rounded-xl bg-[#0B0D11] border border-[#252A36] hover:bg-[#181D26] text-xs font-medium text-slate-400 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    Original CSV
                  </button>
                  <button
                    onClick={() => exportDatasetToExcel(originalRows, `${dataset.name}_original`)}
                    className="py-1.5 px-3 rounded-xl bg-[#0B0D11] border border-[#252A36] hover:bg-[#181D26] text-xs font-medium text-slate-400 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                    Original Excel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BEFORE / AFTER PREVIEW MODAL */}
      {activePreview && (
        <div className="fixed inset-0 bg-[#0B0D11]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-[#2D3342] rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" />
                  Transformation Preview: {activePreview.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{activePreview.description}</p>
              </div>
              <button
                onClick={() => setActivePreview(null)}
                className="text-xs text-slate-400 hover:text-slate-100 px-2 py-1 rounded-lg bg-[#181D26] cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {/* Before vs. After Metrics Comparison */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36]">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Rows</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-sm text-slate-400">{activePreview.beforeStats.totalRows}</span>
                  <span className="text-xs text-slate-600">&rarr;</span>
                  <span className="text-sm font-bold text-slate-100">{activePreview.afterStats.totalRows}</span>
                </div>
              </div>

              <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36]">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Missing Cells</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-sm text-slate-400">{activePreview.beforeStats.missingCells}</span>
                  <span className="text-xs text-slate-600">&rarr;</span>
                  <span className="text-sm font-bold text-emerald-400">{activePreview.afterStats.missingCells}</span>
                </div>
              </div>

              <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36]">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Duplicates</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-sm text-slate-400">{activePreview.beforeStats.duplicateRows}</span>
                  <span className="text-xs text-slate-600">&rarr;</span>
                  <span className="text-sm font-bold text-emerald-400">{activePreview.afterStats.duplicateRows}</span>
                </div>
              </div>

              <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36]">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Quality Score</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-sm text-slate-400">{activePreview.beforeStats.qualityScore}</span>
                  <span className="text-xs text-slate-600">&rarr;</span>
                  <span className="text-sm font-bold text-amber-400">{activePreview.afterStats.qualityScore} / 100</span>
                </div>
              </div>
            </div>

            {/* Sample Modified Rows Diff */}
            {activePreview.sampleDiffRows.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Sample Modified Records Diff
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {activePreview.sampleDiffRows.map(diff => (
                    <div key={diff.rowIndex} className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36] text-xs space-y-1">
                      <span className="text-[10px] font-mono text-amber-400 block font-bold">
                        Row #{diff.rowIndex} • Modified: {diff.changedFields.join(', ')}
                      </span>
                      <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                        <div className="p-1.5 bg-rose-950/20 border border-rose-900/30 rounded-lg text-rose-300 truncate">
                          <strong className="text-rose-400">Before: </strong>
                          {diff.changedFields.map(f => `${f}=${JSON.stringify(diff.before[f])}`).join(', ')}
                        </div>
                        <div className="p-1.5 bg-emerald-950/20 border border-emerald-900/30 rounded-lg text-emerald-300 truncate">
                          <strong className="text-emerald-400">After: </strong>
                          {diff.changedFields.map(f => `${f}=${JSON.stringify(diff.after[f])}`).join(', ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#252A36]">
              <button
                onClick={() => setActivePreview(null)}
                className="px-4 py-2 rounded-xl bg-[#181D26] text-slate-300 text-xs font-semibold hover:bg-[#202733] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApplyActionDirectly(activePreview.action)}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition cursor-pointer"
              >
                Confirm &amp; Apply Transformation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
