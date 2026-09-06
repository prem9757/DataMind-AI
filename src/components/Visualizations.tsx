// ============================================================================
// PHASE 9: POWER BI-STYLE VISUALIZATION STUDIO & DASHBOARD WORKSPACE
// ============================================================================

import React, { useState } from 'react';
import {
  BarChart3,
  Layers,
  LayoutDashboard,
  Sparkles,
  Plus,
  Compass,
  ArrowRight
} from 'lucide-react';
import { DatasetState } from '../types/dataset';
import { SavedVisualization } from '../types/visualization';
import { VisualizationBuilder } from './VisualizationBuilder';
import { MyVisualizations } from './MyVisualizations';
import { CustomDashboardView } from './CustomDashboardView';

interface VisualizationsProps {
  dataset: DatasetState;
  onNavigateToDashboard?: () => void;
  onNavigate?: (section: any) => void;
  onSelectQueryForAI?: (query: string) => void;
}

export type VisualizationTab = 'create' | 'my_visualizations' | 'custom_dashboards';

export const Visualizations: React.FC<VisualizationsProps> = ({
  dataset,
  onNavigateToDashboard,
  onNavigate,
  onSelectQueryForAI
}) => {
  const [activeTab, setActiveTab] = useState<VisualizationTab>('create');
  const [editingViz, setEditingViz] = useState<SavedVisualization | null>(null);

  const handleEditVisualization = (viz: SavedVisualization) => {
    setEditingViz(viz);
    setActiveTab('create');
  };

  const handleCreateNew = () => {
    setEditingViz(null);
    setActiveTab('create');
  };

  const handleSaveComplete = (saved: SavedVisualization) => {
    // Optionally stay or switch
  };

  const handleOpenExecutiveDashboard = () => {
    if (onNavigateToDashboard) onNavigateToDashboard();
    else if (onNavigate) onNavigate('dashboard');
  };

  return (
    <div className="space-y-6">
      {/* Top Workspace Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#12151C] border border-[#252A36] rounded-2xl p-2 shadow-xl">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={handleCreateNew}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'create'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#181D26]'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Create Visualization</span>
          </button>

          <button
            onClick={() => setActiveTab('my_visualizations')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'my_visualizations'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#181D26]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>My Visualizations</span>
          </button>

          <button
            onClick={() => setActiveTab('custom_dashboards')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'custom_dashboards'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#181D26]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Custom Dashboards</span>
          </button>
        </div>

        <div className="flex items-center gap-3 pr-1">
          <span className="hidden sm:inline text-[11px] font-mono text-slate-400">
            {dataset.name} • {dataset.workingRows.length.toLocaleString()} rows
          </span>

          {(onNavigateToDashboard || onNavigate) && (
            <button
              onClick={handleOpenExecutiveDashboard}
              className="px-3.5 py-1.5 rounded-xl bg-[#181D26] hover:bg-[#202634] text-amber-400 hover:text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-amber-400" />
              <span>View Executive Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Create Visualization Builder */}
      {activeTab === 'create' && (
        <VisualizationBuilder
          dataset={dataset}
          editingViz={editingViz}
          onSaveComplete={handleSaveComplete}
          onOpenMyVisualizations={() => setActiveTab('my_visualizations')}
          onOpenDashboard={() => setActiveTab('custom_dashboards')}
        />
      )}

      {/* Tab 2: My Visualizations Gallery */}
      {activeTab === 'my_visualizations' && (
        <MyVisualizations
          dataset={dataset}
          onEditVisualization={handleEditVisualization}
          onCreateNewVisualization={handleCreateNew}
          onNavigateToDashboard={() => setActiveTab('custom_dashboards')}
          onNavigateToExecutiveDashboard={handleOpenExecutiveDashboard}
        />
      )}

      {/* Tab 3: Custom Dashboards View & Builder */}
      {activeTab === 'custom_dashboards' && (
        <CustomDashboardView
          dataset={dataset}
          onEditVisualization={handleEditVisualization}
          onCreateNewVisualization={handleCreateNew}
          onNavigate={onNavigate}
          onSelectQueryForAI={onSelectQueryForAI}
        />
      )}
    </div>
  );
};
