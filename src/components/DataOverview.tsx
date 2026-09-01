import React, { useState } from 'react';
import {
  Search,
  TableProperties,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  Key,
  Info,
  Eye,
  AlertTriangle,
  Layers,
  Sparkles,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { DatasetState, ColumnProfile, ColumnType } from '../types/dataset';

interface DataOverviewProps {
  dataset: DatasetState;
  initialFilter?: 'all' | 'missing' | 'outliers' | 'duplicates';
  onNavigateToQuality?: () => void;
  onNavigate?: (section: any) => void;
}

export const DataOverview: React.FC<DataOverviewProps> = ({
  dataset,
  initialFilter = 'all',
  onNavigateToQuality,
  onNavigate
}) => {
  const { workingRows, originalRows, columns, profiles, quality } = dataset;
  const [activeTab, setActiveTab] = useState<'view_data' | 'explore_columns'>('view_data');
  const [dataMode, setDataMode] = useState<'working' | 'original'>('working');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColumn, setSelectedColumn] = useState<string>(columns[0] || '');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterType, setFilterType] = useState<'all' | ColumnType>('all');
  const [recordFilter, setRecordFilter] = useState<'all' | 'missing' | 'outliers' | 'duplicates'>(initialFilter);

  const activeRows = dataMode === 'working' ? workingRows : originalRows;

  // Count missing cells across all active rows
  const totalMissingCells = columns.reduce((acc, col) => acc + (profiles[col]?.nullCount || 0), 0);
  const numColumnsCount = columns.filter(c => profiles[c]?.type === 'numeric').length;
  const catColumnsCount = columns.filter(c => profiles[c]?.type === 'categorical' || profiles[c]?.type === 'text').length;

  // Compute duplicate rows indices for quick filter
  const duplicateRowIndices = new Set<number>();
  const seenMap = new Map<string, number>();
  activeRows.forEach((row, idx) => {
    const key = JSON.stringify(row);
    if (seenMap.has(key)) {
      duplicateRowIndices.add(idx);
      duplicateRowIndices.add(seenMap.get(key)!);
    } else {
      seenMap.set(key, idx);
    }
  });

  // Filter rows based on search & record filter mode
  const filteredRows = activeRows.filter((row, idx) => {
    // 1. Search Query
    if (searchQuery) {
      const matchesSearch = Object.values(row).some(val =>
        String(val ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (!matchesSearch) return false;
    }

    // 2. Special Quality Records Filter
    if (recordFilter === 'missing') {
      return Object.values(row).some(v => v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v)));
    }
    if (recordFilter === 'duplicates') {
      return duplicateRowIndices.has(idx);
    }
    if (recordFilter === 'outliers') {
      for (const col of columns) {
        const prof = profiles[col];
        if (prof && prof.type === 'numeric' && prof.q1 !== undefined && prof.iqr !== undefined) {
          const v = row[col];
          if (typeof v === 'number' && !isNaN(v)) {
            const low = prof.q1 - 1.5 * prof.iqr;
            const high = prof.q3! + 1.5 * prof.iqr;
            if (v < low || v > high) return true;
          }
        }
      }
      return false;
    }

    return true;
  });

  // Sort rows
  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortColumn) return 0;
    const vA = a[sortColumn];
    const vB = b[sortColumn];
    if (vA === vB) return 0;
    if (vA === null || vA === undefined) return 1;
    if (vB === null || vB === undefined) return -1;
    if (typeof vA === 'number' && typeof vB === 'number') {
      return sortDirection === 'asc' ? vA - vB : vB - vA;
    }
    return sortDirection === 'asc'
      ? String(vA).localeCompare(String(vB))
      : String(vB).localeCompare(String(vA));
  });

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage) || 1;
  const paginatedRows = sortedRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const getTypeIcon = (type: ColumnType) => {
    switch (type) {
      case 'numeric':
        return <Hash className="w-3.5 h-3.5 text-amber-400" />;
      case 'categorical':
        return <Type className="w-3.5 h-3.5 text-purple-400" />;
      case 'datetime':
        return <Calendar className="w-3.5 h-3.5 text-emerald-400" />;
      case 'boolean':
        return <ToggleLeft className="w-3.5 h-3.5 text-amber-400" />;
      case 'id':
        return <Key className="w-3.5 h-3.5 text-amber-300" />;
      default:
        return <Type className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const activeProfile = profiles[selectedColumn];

  const visibleColumns = filterType === 'all'
    ? columns
    : columns.filter(c => profiles[c]?.type === filterType);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#252A36] pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Data Exploration</h1>
          <p className="text-xs text-slate-400 mt-1">
            Review your dataset records, inspect values, filter issues, and understand column distributions.
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2.5">
          {(onNavigateToQuality || onNavigate) && (
            <button
              onClick={() => {
                if (onNavigateToQuality) onNavigateToQuality();
                else if (onNavigate) onNavigate('quality');
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Check Data Quality</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Dataset Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-[#12151C] border border-[#252A36] rounded-2xl p-3 text-center text-xs">
        <div>
          <span className="text-[10px] uppercase font-mono text-slate-400">Total Rows</span>
          <p className="font-bold text-slate-200 font-mono mt-0.5">{activeRows.length.toLocaleString()}</p>
        </div>
        <div>
          <span className="text-[10px] uppercase font-mono text-slate-400">Total Columns</span>
          <p className="font-bold text-slate-200 font-mono mt-0.5">{columns.length}</p>
        </div>
        <div>
          <span className="text-[10px] uppercase font-mono text-slate-400">Numeric Fields</span>
          <p className="font-bold text-amber-400 font-mono mt-0.5">{numColumnsCount}</p>
        </div>
        <div>
          <span className="text-[10px] uppercase font-mono text-slate-400">Categorical Fields</span>
          <p className="font-bold text-purple-400 font-mono mt-0.5">{catColumnsCount}</p>
        </div>
        <div>
          <span className="text-[10px] uppercase font-mono text-slate-400">Missing Values</span>
          <p className={`font-bold font-mono mt-0.5 ${totalMissingCells > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {totalMissingCells.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Primary Tabs: [View Data] and [Explore Columns] */}
      <div className="flex items-center justify-between border-b border-[#252A36] pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('view_data')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'view_data'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#181D26]'
            }`}
          >
            <TableProperties className="w-4 h-4" />
            <span>View Data</span>
          </button>

          <button
            onClick={() => setActiveTab('explore_columns')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'explore_columns'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#181D26]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Explore Columns</span>
          </button>
        </div>

        {/* Working Data vs Original Source Toggle */}
        <div className="flex items-center bg-[#12151C] border border-[#252A36] rounded-xl p-1 text-xs">
          <button
            onClick={() => {
              setDataMode('working');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-lg transition cursor-pointer font-medium ${
              dataMode === 'working'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Working Data ({workingRows.length})
          </button>
          <button
            onClick={() => {
              setDataMode('original');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-lg transition cursor-pointer font-medium ${
              dataMode === 'original'
                ? 'bg-[#252A36] text-slate-100 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Original Data ({originalRows.length})
          </button>
        </div>
      </div>

      {/* TAB 1: VIEW DATA (Full width clean table with search & basic filter) */}
      {activeTab === 'view_data' && (
        <div className="space-y-4">
          {/* Search & Basic Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#12151C] border border-[#252A36] rounded-2xl p-3 shadow-lg">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Filter:</span>
              <button
                onClick={() => {
                  setRecordFilter('all');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  recordFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-[#0B0D11] text-slate-400 hover:text-slate-200 border border-[#252A36]'
                }`}
              >
                All Rows ({activeRows.length})
              </button>

              <button
                onClick={() => {
                  setRecordFilter('missing');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  recordFilter === 'missing'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-[#0B0D11] text-amber-400 hover:text-amber-300 border border-[#252A36]'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Rows with Missing Values</span>
              </button>

              <button
                onClick={() => {
                  setRecordFilter('duplicates');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  recordFilter === 'duplicates'
                    ? 'bg-purple-500 text-white font-bold shadow'
                    : 'bg-[#0B0D11] text-purple-400 hover:text-purple-300 border border-[#252A36]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Duplicates ({quality.duplicateRows})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search records..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#0B0D11] border border-[#252A36] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 w-56"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-[#12151C] border border-[#252A36] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto max-h-[580px] custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-[#0B0D11] border-b border-[#252A36] text-slate-400 sticky top-0 z-10">
                    <th className="px-3.5 py-2.5 font-mono text-[10px] text-slate-500 w-12">#</th>
                    {visibleColumns.map(col => {
                      const prof = profiles[col];
                      const isSorted = sortColumn === col;
                      return (
                        <th
                          key={col}
                          onClick={() => handleSort(col)}
                          className="px-3.5 py-2.5 font-semibold text-slate-300 hover:text-white cursor-pointer select-none whitespace-nowrap"
                        >
                          <div className="flex items-center gap-1.5">
                            {prof && getTypeIcon(prof.type)}
                            <span>{col}</span>
                            <ArrowUpDown
                              className={`w-3 h-3 transition ${
                                isSorted ? 'text-amber-400 opacity-100' : 'text-slate-600 opacity-50'
                              }`}
                            />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252A36] font-mono text-[11px]">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumns.length + 1} className="py-12 text-center text-slate-500">
                        No matching records found.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, rIdx) => {
                      const globalIdx = (currentPage - 1) * rowsPerPage + rIdx + 1;
                      return (
                        <tr key={rIdx} className="hover:bg-[#181D26] transition">
                          <td className="px-3.5 py-2 text-slate-600 font-mono">{globalIdx}</td>
                          {visibleColumns.map(col => {
                            const val = row[col];
                            const isNull = val === null || val === undefined || val === '';
                            return (
                              <td
                                key={col}
                                className={`px-3.5 py-2 whitespace-nowrap truncate max-w-xs ${
                                  isNull ? 'text-rose-400/60 italic' : 'text-slate-300'
                                }`}
                              >
                                {isNull ? 'null' : typeof val === 'number' ? val.toLocaleString() : String(val)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="bg-[#0B0D11] px-4 py-3 border-t border-[#252A36] flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Showing <strong className="text-slate-200">{(currentPage - 1) * rowsPerPage + 1}</strong> to{' '}
                <strong className="text-slate-200">
                  {Math.min(currentPage * rowsPerPage, sortedRows.length)}
                </strong>{' '}
                of <strong className="text-slate-200">{sortedRows.length.toLocaleString()}</strong> rows
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg bg-[#12151C] border border-[#252A36] text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#181D26] transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-slate-400 font-mono text-xs">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg bg-[#12151C] border border-[#252A36] text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#181D26] transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXPLORE COLUMNS (Grid & Column Profiler) */}
      {activeTab === 'explore_columns' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Columns List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Columns ({columns.length})</span>
              <span className="text-[11px] text-slate-400">Select to inspect profile</span>
            </div>

            <div className="space-y-2 max-h-[580px] overflow-y-auto custom-scrollbar pr-1">
              {columns.map(col => {
                const prof = profiles[col];
                const isSelected = selectedColumn === col;
                return (
                  <button
                    key={col}
                    onClick={() => setSelectedColumn(col)}
                    className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/40 shadow-md'
                        : 'bg-[#12151C] border-[#252A36] hover:bg-[#181D26] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="p-1.5 rounded-lg bg-[#0B0D11] border border-[#252A36] shrink-0">
                        {prof && getTypeIcon(prof.type)}
                      </div>
                      <div className="truncate">
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-amber-300' : 'text-slate-200'}`}>
                          {col}
                        </p>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">
                          {prof?.type || 'unknown'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-semibold text-slate-300 block">
                        {prof?.uniqueCount} distinct
                      </span>
                      <span className={`text-[10px] font-mono ${prof?.nullCount ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {prof?.nullCount ? `${prof.nullCount} missing` : '100% complete'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column Deep Profile Inspector */}
          <div className="lg:col-span-7">
            {activeProfile ? (
              <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 space-y-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-[#252A36] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#0B0D11] border border-[#252A36]">
                      {getTypeIcon(activeProfile.type)}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100">{activeProfile.name}</h3>
                      <span className="text-xs font-mono text-amber-400 uppercase">
                        {activeProfile.inferredType} column
                      </span>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#0B0D11] text-slate-300 border border-[#252A36]">
                    {activeProfile.uniqueCount} distinct values
                  </span>
                </div>

                {/* Health & Completeness */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36]">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Missing Records</span>
                    <p className="text-slate-200 font-bold mt-1 font-mono text-sm">
                      {activeProfile.nullCount} <span className="text-slate-400 text-xs font-normal">({activeProfile.nullPercentage}%)</span>
                    </p>
                  </div>
                  <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36]">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Cardinality Ratio</span>
                    <p className="text-slate-200 font-bold mt-1 font-mono text-sm">{activeProfile.cardinalityRatio}%</p>
                  </div>
                </div>

                {/* Numeric Stats */}
                {activeProfile.type === 'numeric' && activeProfile.mean !== undefined && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Descriptive Statistics</span>
                    <div className="grid grid-cols-3 gap-2.5 text-xs">
                      <div className="bg-[#0B0D11] p-2.5 rounded-xl border border-[#252A36]">
                        <span className="text-slate-400 text-[11px]">Minimum</span>
                        <p className="font-mono font-bold text-slate-200 text-sm mt-0.5">{activeProfile.min?.toLocaleString()}</p>
                      </div>
                      <div className="bg-[#0B0D11] p-2.5 rounded-xl border border-[#252A36]">
                        <span className="text-slate-400 text-[11px]">Average (Mean)</span>
                        <p className="font-mono font-bold text-amber-400 text-sm mt-0.5">{activeProfile.mean?.toLocaleString()}</p>
                      </div>
                      <div className="bg-[#0B0D11] p-2.5 rounded-xl border border-[#252A36]">
                        <span className="text-slate-400 text-[11px]">Maximum</span>
                        <p className="font-mono font-bold text-slate-200 text-sm mt-0.5">{activeProfile.max?.toLocaleString()}</p>
                      </div>
                      <div className="bg-[#0B0D11] p-2.5 rounded-xl border border-[#252A36]">
                        <span className="text-slate-400 text-[11px]">Median</span>
                        <p className="font-mono font-bold text-slate-200 text-sm mt-0.5">{activeProfile.median?.toLocaleString()}</p>
                      </div>
                      <div className="bg-[#0B0D11] p-2.5 rounded-xl border border-[#252A36]">
                        <span className="text-slate-400 text-[11px]">Std Deviation</span>
                        <p className="font-mono font-bold text-slate-200 text-sm mt-0.5">±{activeProfile.stdDev?.toLocaleString()}</p>
                      </div>
                      <div className="bg-[#0B0D11] p-2.5 rounded-xl border border-[#252A36]">
                        <span className="text-slate-400 text-[11px]">Outliers Detected</span>
                        <p className={`font-mono font-bold text-sm mt-0.5 ${activeProfile.outlierCount ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {activeProfile.outlierCount || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Categorical Top Values */}
                {activeProfile.topValues && activeProfile.topValues.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Top Value Frequencies</span>
                    <div className="space-y-2">
                      {activeProfile.topValues.slice(0, 5).map((tv, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-medium truncate max-w-xs">{tv.value || '(Empty)'}</span>
                            <span className="text-slate-400 font-mono">
                              {tv.count} <span className="text-slate-400">({tv.percentage}%)</span>
                            </span>
                          </div>
                          <div className="w-full h-2 bg-[#252A36] rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${tv.percentage}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sample Observations */}
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Sample Values</span>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {activeProfile.sampleValues.map((sv, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-[#0B0D11] text-slate-300 text-xs font-mono rounded-lg border border-[#252A36]"
                      >
                        {String(sv)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-8 bg-[#12151C] border border-[#252A36] rounded-2xl text-slate-400 text-xs">
                Select a column to inspect its profile.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
