// ============================================================================
// PHASE 9: POWER BI-STYLE MY VISUALIZATIONS GALLERY & MANAGEMENT
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Edit3,
  Copy,
  Trash2,
  Download,
  LayoutDashboard,
  Search,
  ArrowRight,
  Filter,
  CheckCircle2,
  Sparkles,
  Calendar,
  BarChart3,
  Sliders,
  Maximize2,
  X,
  AlertTriangle
} from 'lucide-react';
import { DatasetState } from '../types/dataset';
import { SavedVisualization, CustomDashboard } from '../types/visualization';
import { VisualizationEngine } from '../services/visualizationEngine';
import { ChartViewer } from './ChartViewer';

interface MyVisualizationsProps {
  dataset: DatasetState;
  onEditVisualization: (viz: SavedVisualization) => void;
  onCreateNewVisualization: () => void;
  onNavigateToDashboard: () => void;
  onNavigateToExecutiveDashboard?: () => void;
}

export const MyVisualizations: React.FC<MyVisualizationsProps> = ({
  dataset,
  onEditVisualization,
  onCreateNewVisualization,
  onNavigateToDashboard,
  onNavigateToExecutiveDashboard
}) => {
  const [visualizations, setVisualizations] = useState<SavedVisualization[]>(() => {
    return VisualizationEngine.getSavedVisualizations();
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [targetVizForDashboard, setTargetVizForDashboard] = useState<SavedVisualization | null>(null);
  const [inspectingViz, setInspectingViz] = useState<SavedVisualization | null>(null);
  const [deletingVizId, setDeletingVizId] = useState<string | null>(null);
  const [dashboards, setDashboards] = useState<CustomDashboard[]>(() => {
    return VisualizationEngine.getCustomDashboards();
  });
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>('');
  const [isCreatingNewDashboard, setIsCreatingNewDashboard] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [dashboardAddedSuccess, setDashboardAddedSuccess] = useState<string | null>(null);

  // Track which visualizations are currently in Executive Dashboard
  const [execVizIds, setExecVizIds] = useState<Set<string>>(() => {
    const list = VisualizationEngine.getExecutiveDashboardVisualizations(dataset?.id);
    return new Set(list.map(v => v.id));
  });
  const [execToast, setExecToast] = useState<{ text: string; vizName: string } | null>(null);

  const reloadVisualizations = () => {
    const fresh = VisualizationEngine.getSavedVisualizations();
    setVisualizations(fresh);
    setDashboards(VisualizationEngine.getCustomDashboards());
    const execList = VisualizationEngine.getExecutiveDashboardVisualizations(dataset?.id);
    setExecVizIds(new Set(execList.map(v => v.id)));
  };

  // Sync reactively when dashboards change
  React.useEffect(() => {
    const handleUpdate = () => {
      reloadVisualizations();
    };
    window.addEventListener('datamind_dashboard_updated', handleUpdate);
    return () => window.removeEventListener('datamind_dashboard_updated', handleUpdate);
  }, [dataset?.id]);

  const handleAddToExecutiveDashboard = (viz: SavedVisualization) => {
    VisualizationEngine.addToExecutiveDashboard(viz.id);
    setExecVizIds(prev => new Set([...prev, viz.id]));
    setExecToast({
      text: `Added "${viz.name}" to Executive Dashboard with automated summary & strategic insights!`,
      vizName: viz.name
    });
    setTimeout(() => {
      setExecToast(null);
    }, 5000);
  };

  const filteredVisualizations = useMemo(() => {
    return visualizations.filter(v => {
      const matchesQuery =
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.config.xAxisColumn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.config.yAxisColumn && v.config.yAxisColumn.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = filterType === 'ALL' || v.chartType === filterType;
      return matchesQuery && matchesType;
    });
  }, [visualizations, searchQuery, filterType]);

  const handleDeleteConfirm = () => {
    if (!deletingVizId) return;
    VisualizationEngine.deleteVisualization(deletingVizId);
    setDeletingVizId(null);
    reloadVisualizations();
  };

  const handleDuplicate = (id: string) => {
    const copy = VisualizationEngine.duplicateVisualization(id);
    if (copy) reloadVisualizations();
  };

  const handleOpenAddToDashboard = (viz: SavedVisualization) => {
    const currentDashboards = VisualizationEngine.getCustomDashboards();
    setDashboards(currentDashboards);
    setSelectedDashboardId(currentDashboards[0]?.id || '');
    setIsCreatingNewDashboard(currentDashboards.length === 0);
    setNewDashboardName('');
    setTargetVizForDashboard(viz);
    setDashboardAddedSuccess(null);
  };

  const handleConfirmAddToDashboard = () => {
    if (!targetVizForDashboard) return;

    let targetId = selectedDashboardId;
    if (isCreatingNewDashboard) {
      const name = newDashboardName.trim() || 'New Dashboard';
      const created = VisualizationEngine.createDashboard(name, `Custom dashboard created for ${dataset.name}`);
      targetId = created.id;
    }

    if (!targetId) return;

    VisualizationEngine.addVisualizationToDashboard(targetId, targetVizForDashboard.id, 'half');
    setDashboardAddedSuccess('Added to Dashboard & Executive Dashboard with automated summary!');
    setTimeout(() => {
      setTargetVizForDashboard(null);
      setDashboardAddedSuccess(null);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search Controls */}
      <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100 tracking-tight">
                  My Saved Visualizations
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {visualizations.length} saved
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage, duplicate, edit, or pin your charts to custom dashboards.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onCreateNewVisualization}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Visualization</span>
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="pt-3 border-t border-[#252A36] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search saved charts by title or field..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#0B0D11] border border-[#2D3342] rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Chart Type:</span>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-[#0B0D11] border border-[#2D3342] text-slate-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500 font-medium"
            >
              <option value="ALL">All Types</option>
              <option value="bar">Bar Charts</option>
              <option value="line">Line Trends</option>
              <option value="area">Area Charts</option>
              <option value="donut">Pie & Donut</option>
              <option value="scatter">Scatter Plots</option>
              <option value="histogram">Histograms</option>
            </select>
          </div>
        </div>
      </div>

      {/* Visualizations Grid */}
      {filteredVisualizations.length === 0 ? (
        <div className="bg-[#12151C] border border-[#252A36] rounded-2xl p-12 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <BarChart3 className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-100">
              {visualizations.length === 0 ? 'No Saved Visualizations Yet' : 'No Visualizations Match Filter'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {visualizations.length === 0
                ? 'Create and save interactive charts in the builder, then pin them directly to your custom dashboards.'
                : 'Try adjusting your search query or chart type filter.'}
            </p>
          </div>
          {visualizations.length === 0 && (
            <button
              onClick={onCreateNewVisualization}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Visualization</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredVisualizations.map(viz => {
            const computed = VisualizationEngine.compute(
              dataset,
              viz.config,
              viz.chartType,
              viz.customTitle || viz.name
            );

            return (
              <div
                key={viz.id}
                className="bg-[#12151C] border border-[#252A36] hover:border-amber-500/40 rounded-2xl p-5 shadow-xl transition flex flex-col justify-between group"
              >
                <div>
                  {/* Top Card Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-[#252A36] pb-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {viz.chartType.replace('_', ' ')}
                        </span>
                        <h3 className="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition">
                          {viz.name}
                        </h3>
                        {execVizIds.has(viz.id) && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <Sparkles className="w-3 h-3 text-emerald-400" />
                            <span>Executive Dashboard</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {viz.config.xAxisColumn}
                        {viz.config.yAxisColumn ? ` • ${viz.config.aggregation || 'sum'}(${viz.config.yAxisColumn})` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setInspectingViz(viz)}
                        className="p-1.5 rounded-lg bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-slate-400 hover:text-amber-400 transition cursor-pointer"
                        title="Open & Inspect Chart"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(viz.id)}
                        className="p-1.5 rounded-lg bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-slate-400 hover:text-slate-200 transition cursor-pointer"
                        title="Duplicate Chart"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingVizId(viz.id)}
                        className="p-1.5 rounded-lg bg-[#181D26] hover:bg-rose-500/20 border border-[#2D3342] text-slate-400 hover:text-rose-400 transition cursor-pointer"
                        title="Delete Chart"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Chart Rendering */}
                  <div className="min-w-0">
                    <ChartViewer
                      type={computed.chartType as any}
                      title={computed.title}
                      data={computed.data}
                      xAxisKey={computed.xAxisKey}
                      yAxisKey={computed.yAxisKey}
                      keys={computed.seriesKeys}
                      xAxisLabel={computed.xAxisTitle}
                      yAxisLabel={computed.yAxisTitle}
                      height={260}
                      description={computed.description}
                    />
                  </div>
                </div>

                {/* Bottom Action Strip */}
                <div className="mt-4 pt-3 border-t border-[#252A36] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Explicit Add to Executive Dashboard Action */}
                    <button
                      onClick={() => handleAddToExecutiveDashboard(viz)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        execVizIds.has(viz.id)
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                      }`}
                      title={
                        execVizIds.has(viz.id)
                          ? 'Active in Executive Dashboard with automated summary & insights. Click to re-sync or prioritize.'
                          : 'Add to Executive Dashboard with automated summary and strategic insights'
                      }
                    >
                      {execVizIds.has(viz.id) ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>In Executive Dashboard</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Add to Executive Dashboard</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => onEditVisualization(viz)}
                      className="px-3 py-1.5 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-xs font-semibold text-slate-200 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => handleOpenAddToDashboard(viz)}
                      className="px-3 py-1.5 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-xs font-semibold text-slate-300 transition flex items-center gap-1.5 cursor-pointer"
                      title="Add to Custom Dashboard"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-amber-400" />
                      <span>Custom Dashboard</span>
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-500 font-mono">
                    {new Date(viz.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Fullscreen Inspect Chart */}
      {inspectingViz && (
        <div className="fixed inset-0 bg-[#0B0D11]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-[#2D3342] rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {inspectingViz.chartType.replace('_', ' ')}
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-1">{inspectingViz.name}</h3>
              </div>
              <button
                onClick={() => setInspectingViz(null)}
                className="p-1.5 rounded-lg bg-[#181D26] text-slate-400 hover:text-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#0B0D11] p-4 rounded-xl border border-[#252A36]">
              {(() => {
                const computed = VisualizationEngine.compute(
                  dataset,
                  inspectingViz.config,
                  inspectingViz.chartType,
                  inspectingViz.customTitle || inspectingViz.name
                );
                return (
                  <ChartViewer
                    type={computed.chartType as any}
                    title={computed.title}
                    data={computed.data}
                    xAxisKey={computed.xAxisKey}
                    yAxisKey={computed.yAxisKey}
                    keys={computed.seriesKeys}
                    xAxisLabel={computed.xAxisTitle}
                    yAxisLabel={computed.yAxisTitle}
                    height={380}
                    description={computed.description}
                  />
                );
              })()}
            </div>

            <div className="flex flex-wrap items-center justify-between pt-3 border-t border-[#252A36] gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    handleAddToExecutiveDashboard(inspectingViz);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
                    execVizIds.has(inspectingViz.id)
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                  }`}
                >
                  {execVizIds.has(inspectingViz.id) ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>In Executive Dashboard</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Add to Executive Dashboard</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    const target = inspectingViz;
                    setInspectingViz(null);
                    onEditVisualization(target);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Edit in Studio
                </button>
                <button
                  onClick={() => {
                    const target = inspectingViz;
                    setInspectingViz(null);
                    handleOpenAddToDashboard(target);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Custom Dashboards
                </button>
              </div>

              <button
                onClick={() => setInspectingViz(null)}
                className="px-3.5 py-1.5 rounded-xl bg-[#181D26] text-slate-400 text-xs font-semibold hover:text-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Confirmation */}
      {deletingVizId && (
        <div className="fixed inset-0 bg-[#0B0D11]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-rose-500/30 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-100">Delete Visualization?</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete this visualization? Dashboards referencing it will safely update.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingVizId(null)}
                className="px-3.5 py-1.5 rounded-xl bg-[#181D26] text-slate-300 text-xs font-semibold hover:bg-[#202733]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs shadow-md shadow-rose-500/20"
              >
                Delete Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Visualization To Dashboard Picker */}
      {targetVizForDashboard && (
        <div className="fixed inset-0 bg-[#0B0D11]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-[#2D3342] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">Add Chart to Dashboard</h3>
              </div>
              <button
                onClick={() => setTargetVizForDashboard(null)}
                className="text-xs text-slate-400 hover:text-slate-100 p-1.5 rounded-lg bg-[#181D26]"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#252A36]">
                <span className="text-[10px] text-amber-400 uppercase font-mono font-bold block">Selected Chart</span>
                <p className="font-bold text-slate-200 mt-0.5">{targetVizForDashboard.name}</p>
              </div>

              {dashboards.length > 0 && (
                <div className="flex items-center gap-2 pb-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewDashboard(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      !isCreatingNewDashboard
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-[#181D26] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Existing Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewDashboard(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      isCreatingNewDashboard
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-[#181D26] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    + New Dashboard
                  </button>
                </div>
              )}

              {isCreatingNewDashboard ? (
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    New Dashboard Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Executive Summary Dashboard"
                    value={newDashboardName}
                    onChange={e => setNewDashboardName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-[#2D3342] rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Target Custom Dashboard
                  </label>
                  <select
                    value={selectedDashboardId}
                    onChange={e => setSelectedDashboardId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-[#2D3342] rounded-xl text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  >
                    {dashboards.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.items.length} charts)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {dashboardAddedSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{dashboardAddedSuccess}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#252A36]">
              <button
                onClick={() => {
                  setTargetVizForDashboard(null);
                  onNavigateToDashboard();
                }}
                className="text-xs text-amber-400 hover:underline flex items-center gap-1"
              >
                <span>Go to Dashboards</span>
                <ArrowRight className="w-3 h-3" />
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTargetVizForDashboard(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#181D26] text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAddToDashboard}
                  className="px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 shadow-md shadow-amber-500/20"
                >
                  {isCreatingNewDashboard ? 'Create & Add' : 'Add Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Notification Toast for Executive Dashboard */}
      {execToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#12151C] border border-amber-500/40 rounded-2xl p-4 shadow-2xl flex items-center gap-3 text-xs animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-md">
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-slate-100">Executive Dashboard Updated</div>
            <div className="text-slate-300 text-[11px] mt-0.5">{execToast.text}</div>
          </div>
          {onNavigateToExecutiveDashboard && (
            <button
              onClick={() => {
                setExecToast(null);
                onNavigateToExecutiveDashboard();
              }}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shrink-0 transition cursor-pointer"
            >
              <span>View</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => setExecToast(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
