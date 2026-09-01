import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
  Hash,
  Type,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { ColumnProfile } from '../types/dataset';

interface AdvancedDataTableProps {
  rows: Record<string, any>[];
  columns: string[];
  profiles?: Record<string, ColumnProfile>;
  initialPageSize?: number;
  highlightOutliers?: boolean;
  highlightMissing?: boolean;
  title?: string;
  onExportCsv?: () => void;
}

export function AdvancedDataTable({
  rows,
  columns,
  profiles = {},
  initialPageSize = 25,
  highlightOutliers = true,
  highlightMissing = true,
  title,
  onExportCsv
}: AdvancedDataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    columns.forEach(c => (init[c] = true));
    return init;
  });
  const [columnFilter, setColumnFilter] = useState<Record<string, string>>({});
  const [showColPicker, setShowColPicker] = useState(false);
  const [frozenCol, setFrozenCol] = useState<string | null>(columns[0] || null);

  // Large dataset sampling badge detection
  const isLargeDataset = rows.length > 50000;

  // Filter & Search
  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      // Global Search
      if (searchTerm) {
        const rowStr = Object.values(row).map(v => String(v ?? '')).join(' ').toLowerCase();
        if (!rowStr.includes(searchTerm.toLowerCase())) return false;
      }

      // Column Filters
      for (const [col, filterVal] of Object.entries(columnFilter)) {
        if (!filterVal) continue;
        const cellVal = String(row[col] ?? '').toLowerCase();
        if (!cellVal.includes(String(filterVal).toLowerCase())) return false;
      }

      return true;
    });
  }, [rows, searchTerm, columnFilter]);

  // Sorting
  const sortedRows = useMemo(() => {
    if (!sortCol) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const valA = a[sortCol];
      const valB = b[sortCol];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredRows, sortCol, sortDir]);

  // Pagination
  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortCol(null);
        setSortDir('asc');
      }
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const activeColumns = columns.filter(c => visibleColumns[c] !== false);

  return (
    <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl overflow-hidden flex flex-col">
      {/* Table Control Header */}
      <div className="p-4 border-b border-[#252A36] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#131720]">
        <div className="flex items-center gap-3">
          {title && <h3 className="text-xs font-bold text-slate-100">{title}</h3>}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
              {sortedRows.length.toLocaleString()} rows
            </span>
            {isLargeDataset && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Virtual Paging Active
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Global Search */}
          <div className="flex items-center gap-2 bg-[#0B0D11] border border-[#252A36] rounded-xl px-2.5 py-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search table..."
              className="bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none w-32 sm:w-44"
            />
          </div>

          {/* Column Visibility Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowColPicker(!showColPicker)}
              className="px-2.5 py-1.5 bg-[#181D26] hover:bg-[#202734] border border-[#2B3242] text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              Columns ({activeColumns.length}/{columns.length})
            </button>

            {showColPicker && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#0F1218] border border-[#252A36] rounded-xl shadow-2xl p-3 z-30 space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-[#252A36] text-[11px] font-mono font-bold text-slate-400">
                  <span>Toggle Column</span>
                  <button
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      columns.forEach(c => (all[c] = true));
                      setVisibleColumns(all);
                    }}
                    className="text-amber-400 hover:underline text-[10px]"
                  >
                    Show All
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                  {columns.map(col => (
                    <label key={col} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer py-0.5">
                      <input
                        type="checkbox"
                        checked={visibleColumns[col] !== false}
                        onChange={e => {
                          setVisibleColumns(prev => ({ ...prev, [col]: e.target.checked }));
                        }}
                        className="rounded border-[#252A36] text-amber-500 focus:ring-0"
                      />
                      <span className="truncate">{col}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {onExportCsv && (
            <button
              onClick={onExportCsv}
              className="p-1.5 bg-[#181D26] hover:bg-[#202734] border border-[#2B3242] text-slate-300 hover:text-white rounded-xl transition-colors"
              title="Export Current View to CSV"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table Surface */}
      <div className="overflow-x-auto custom-scrollbar max-h-[60vh]">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead className="bg-[#0B0D11] sticky top-0 z-10">
            <tr className="border-b border-[#252A36] text-slate-400 text-[10px] uppercase">
              <th className="p-2.5 w-12 text-center text-slate-600">#</th>
              {activeColumns.map(col => {
                const prof = profiles[col];
                const type = prof?.type || 'text';
                const isSorted = sortCol === col;
                const isFrozen = frozenCol === col;

                return (
                  <th
                    key={col}
                    className={`p-2.5 select-none transition-colors ${
                      isFrozen ? 'sticky left-0 bg-[#0B0D11] z-20 shadow-md' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleSort(col)}
                        className="flex items-center gap-1.5 hover:text-amber-400 font-bold tracking-wider"
                      >
                        {type === 'numeric' && <Hash className="w-3 h-3 text-emerald-400 shrink-0" />}
                        {type === 'categorical' && <Type className="w-3 h-3 text-blue-400 shrink-0" />}
                        {type === 'datetime' && <Calendar className="w-3 h-3 text-purple-400 shrink-0" />}
                        <span className="truncate max-w-[120px]">{col}</span>
                        {isSorted ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-400" /> : <ArrowDown className="w-3 h-3 text-amber-400" />
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-30 hover:opacity-100" />
                        )}
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#202530] text-[11px]">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length + 1} className="p-8 text-center text-slate-500 font-mono">
                  No records match your filter criteria
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, rIdx) => {
                const globalRowIdx = (currentPage - 1) * pageSize + rIdx + 1;

                return (
                  <tr key={rIdx} className="hover:bg-[#151922] transition-colors">
                    <td className="p-2.5 text-center text-slate-600 font-mono text-[10px]">
                      {globalRowIdx}
                    </td>

                    {activeColumns.map(col => {
                      const val = row[col];
                      const isNull = val === null || val === undefined || val === '';
                      const prof = profiles[col];
                      const isNum = prof?.type === 'numeric';
                      const isOutlier = isNum && highlightOutliers && prof?.boxPlotSummary && (
                        val < prof.boxPlotSummary.lowerFence || val > prof.boxPlotSummary.upperFence
                      );

                      return (
                        <td
                          key={col}
                          className={`p-2.5 truncate max-w-[200px] ${
                            isNull && highlightMissing
                              ? 'bg-rose-500/10 text-rose-400 font-semibold'
                              : isOutlier
                              ? 'bg-amber-500/10 text-amber-300 font-bold'
                              : 'text-slate-300'
                          }`}
                        >
                          {isNull ? (
                            <span className="text-[10px] text-rose-400/80 italic font-mono">null</span>
                          ) : typeof val === 'number' ? (
                            val.toLocaleString()
                          ) : (
                            String(val)
                          )}
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

      {/* Pagination Footer */}
      <div className="p-3 border-t border-[#252A36] bg-[#131720] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-400">
          <span>Showing page {currentPage} of {totalPages}</span>
          <span>•</span>
          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-[#0B0D11] border border-[#252A36] rounded-lg px-2 py-1 text-slate-300 focus:outline-none"
          >
            <option value={10}>10 rows / page</option>
            <option value={25}>25 rows / page</option>
            <option value={50}>50 rows / page</option>
            <option value={100}>100 rows / page</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="p-1.5 bg-[#181D26] hover:bg-[#202734] border border-[#2B3242] text-slate-300 rounded-lg disabled:opacity-40 disabled:hover:bg-[#181D26]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 bg-[#0B0D11] border border-[#252A36] rounded-lg text-amber-400 font-bold">
            {currentPage}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 bg-[#181D26] hover:bg-[#202734] border border-[#2B3242] text-slate-300 rounded-lg disabled:opacity-40 disabled:hover:bg-[#181D26]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
