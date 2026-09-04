// ============================================================================
// PHASE 12: PROFESSIONAL CUSTOM BI DASHBOARD & DASHBOARD INTELLIGENCE
// ============================================================================

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Plus,
  Edit3,
  Check,
  Trash2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Download,
  Filter,
  Layers,
  MoveLeft,
  MoveRight,
  Sparkles,
  ArrowRight,
  Copy,
  Info,
  X,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Calendar,
  Grid,
  MoreVertical,
  Sliders,
  Palette,
  FileText,
  Share2,
  Bot,
  HelpCircle
} from 'lucide-react';
import { DatasetState } from '../types/dataset';
import {
  CustomDashboard,
  CustomDashboardItem,
  SavedVisualization,
  DashboardCardWidth,
  DashboardKPICard,
  DashboardActiveFilter,
  DashboardTheme,
  StructuredDashboardInsight
} from '../types/visualization';
import { VisualizationEngine } from '../services/visualizationEngine';
import { ChartViewer } from './ChartViewer';
import { DateRangePreset } from '../types/temporal';

interface CustomDashboardViewProps {
  dataset: DatasetState;
  onEditVisualization: (viz: SavedVisualization) => void;
  onCreateNewVisualization: () => void;
  onNavigate?: (section: any) => void;
  onSelectQueryForAI?: (query: string) => void;
}

export const CustomDashboardView: React.FC<CustomDashboardViewProps> = ({
  dataset,
  onEditVisualization,
  onCreateNewVisualization,
  onNavigate,
  onSelectQueryForAI
}) => {
  // State: Dashboards
  const [dashboards, setDashboards] = useState<CustomDashboard[]>(() => {
    const loaded = VisualizationEngine.getCustomDashboards();
    if (loaded.length > 0) return loaded;

    // Seed default starter dashboard
    const starter: CustomDashboard = {
      id: `dash_${Date.now()}`,
      name: `${dataset.name} Performance Dashboard`,
      description: 'Executive overview combining key performance indicators and custom visual analytics.',
      datasetId: dataset.id,
      datasetName: dataset.name,
      items: [],
      kpis: [],
      theme: 'default',
      createdAt: Date.now(),
      lastModified: Date.now()
    };
    VisualizationEngine.saveCustomDashboard(starter);
    return [starter];
  });

  const [selectedDashboardId, setSelectedDashboardId] = useState<string>(
    dashboards[0]?.id || ''
  );

  // Mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modals & Drawers
  const [showAddVizModal, setShowAddVizModal] = useState(false);
  const [showCreateDashModal, setShowCreateDashModal] = useState(false);
  const [showAddFilterModal, setShowAddFilterModal] = useState(false);
  const [showAddKPIModal, setShowAddKPIModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showInsightsDrawer, setShowInsightsDrawer] = useState(false);
  const [inspectingViz, setInspectingViz] = useState<SavedVisualization | null>(null);
  const [detailsViz, setDetailsViz] = useState<SavedVisualization | null>(null);
  const [deletingDashId, setDeletingDashId] = useState<string | null>(null);
  const [activeMenuCardId, setActiveMenuCardId] = useState<string | null>(null);
  const [selectedVizIdsToAdd, setSelectedVizIdsToAdd] = useState<string[]>([]);

  // Editing dashboard metadata
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDesc, setEditedDesc] = useState('');
  const [isEditingHeader, setIsEditingHeader] = useState(false);

  // Create Dashboard modal inputs
  const [newDashName, setNewDashName] = useState('');
  const [newDashDesc, setNewDashDesc] = useState('');
  const [dashTemplate, setDashTemplate] = useState<'blank' | 'sales'>('blank');

  // KPI Modal inputs
  const [kpiTitle, setKpiTitle] = useState('');
  const [kpiCol, setKpiCol] = useState('');
  const [kpiAggr, setKpiAggr] = useState<'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct'>('sum');
  const [kpiFormat, setKpiFormat] = useState<'currency' | 'number' | 'percent'>('currency');

  // Generated insights
  const [generatedInsights, setGeneratedInsights] = useState<string[]>([]);
  const [generatedStructuredInsights, setGeneratedStructuredInsights] = useState<StructuredDashboardInsight[]>([]);
  const [expandedInsightDetailsId, setExpandedInsightDetailsId] = useState<string | null>(null);
  const [showAskAIModal, setShowAskAIModal] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  // Dashboard Filters (persisted in session per dashboard)
  const [globalDateFilter, setGlobalDateFilter] = useState<DateRangePreset>('all_time');
  const [activeFilters, setActiveFilters] = useState<DashboardActiveFilter[]>([]);

  // Delete Chart State & Notification
  const [chartToDelete, setChartToDelete] = useState<{
    item: CustomDashboardItem;
    viz: SavedVisualization;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Current Dashboard
  const currentDashboard = useMemo(() => {
    return dashboards.find(d => d.id === selectedDashboardId) || dashboards[0];
  }, [dashboards, selectedDashboardId]);

  // Saved Visualizations
  const savedVisualizations = useMemo(() => {
    return VisualizationEngine.getSavedVisualizations();
  }, [showAddVizModal, dashboards, refreshKey]);

  // Available Filterable Columns
  const filterableColumns = useMemo(() => {
    return dataset.columns.filter(col => {
      const p = dataset.profiles[col];
      return p && (p.type === 'categorical' || p.type === 'text' || p.type === 'boolean' || p.type === 'datetime');
    });
  }, [dataset]);

  // Numeric Columns for KPIs
  const numericColumns = useMemo(() => {
    return dataset.columns.filter(col => dataset.profiles[col]?.type === 'numeric');
  }, [dataset]);

  // Reload helper
  const reloadDashboards = () => {
    setIsRefreshing(true);
    const fresh = VisualizationEngine.getCustomDashboards();
    setDashboards(fresh);
    setRefreshKey(prev => prev + 1);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 350);
  };

  // Keyboard shortcut for Presentation Mode (Escape to exit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPresentationMode) {
        setIsPresentationMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPresentationMode]);

  // Sync edited metadata when dashboard changes
  useEffect(() => {
    if (currentDashboard) {
      setEditedTitle(currentDashboard.name);
      setEditedDesc(currentDashboard.description || '');
      if (currentDashboard.theme) {
        // Theme sync
      }
      if (currentDashboard.activeFilters) {
        setActiveFilters(currentDashboard.activeFilters);
      }
    }
  }, [currentDashboard?.id]);

  // Save changes to current dashboard
  const saveCurrentDashboardChanges = (partial: Partial<CustomDashboard>) => {
    if (!currentDashboard) return;
    const updated: CustomDashboard = {
      ...currentDashboard,
      ...partial,
      lastModified: Date.now()
    };
    VisualizationEngine.saveCustomDashboard(updated);
    reloadDashboards();
  };

  // Create Dashboard
  const handleCreateDashboard = () => {
    const name = newDashName.trim() || 'Custom BI Dashboard';
    const newDash = VisualizationEngine.createDashboard(name, newDashDesc.trim() || `Analytics dashboard for ${dataset.name}`);
    
    // If template selected, seed top saved or recommended visualizations
    if (dashTemplate === 'sales') {
      const templates = VisualizationEngine.getTemplates();
      let order = 0;
      templates.slice(0, 3).forEach((tmpl, idx) => {
        const matched = tmpl.fieldMatcher(dataset.columns, dataset.profiles);
        if (matched && matched.xAxisColumn) {
          const vizId = `viz_tmpl_${Date.now()}_${idx}`;
          const newViz: SavedVisualization = {
            id: vizId,
            name: tmpl.name,
            datasetId: dataset.id,
            datasetName: dataset.name,
            datasetVersion: 'v1.0',
            chartType: tmpl.chartType,
            config: {
              xAxisColumn: matched.xAxisColumn,
              yAxisColumn: matched.yAxisColumn || '',
              aggregation: matched.aggregation || 'sum',
              timeGranularity: matched.timeGranularity || 'monthly',
              topN: matched.topN || 0,
              sortBy: matched.sortBy || 'desc'
            },
            computedTitle: tmpl.name,
            computedXAxisTitle: matched.xAxisColumn,
            computedYAxisTitle: matched.yAxisColumn || 'Value',
            createdAt: Date.now(),
            lastModified: Date.now()
          };
          VisualizationEngine.saveVisualization(newViz);
          newDash.items.push({
            id: `item_${Date.now()}_${idx}`,
            visualizationId: vizId,
            width: idx === 0 ? 'full' : 'half',
            order: order++
          });
        }
      });
      VisualizationEngine.saveCustomDashboard(newDash);
    }

    reloadDashboards();
    setSelectedDashboardId(newDash.id);
    setShowCreateDashModal(false);
    setNewDashName('');
    setNewDashDesc('');
    setIsEditMode(true);
  };

  // Duplicate Dashboard
  const handleDuplicateDashboard = () => {
    if (!currentDashboard) return;
    const duplicated = VisualizationEngine.duplicateCustomDashboard(currentDashboard.id);
    if (duplicated) {
      reloadDashboards();
      setSelectedDashboardId(duplicated.id);
      setIsEditMode(true);
    }
  };

  // Delete Dashboard Confirm
  const handleDeleteDashboardConfirm = () => {
    if (!deletingDashId) return;
    if (dashboards.length <= 1) {
      alert('You must keep at least one dashboard.');
      setDeletingDashId(null);
      return;
    }
    VisualizationEngine.deleteCustomDashboard(deletingDashId);
    setDeletingDashId(null);
    const updated = VisualizationEngine.getCustomDashboards();
    setDashboards(updated);
    setSelectedDashboardId(updated[0]?.id || '');
  };

  // Add multiple visualizations to current dashboard
  const handleAddSelectedVisualizations = () => {
    if (!currentDashboard || selectedVizIdsToAdd.length === 0) return;
    
    const existingIds = new Set(currentDashboard.items.map(i => i.visualizationId));
    let nextOrder = currentDashboard.items.length;

    const newItems: CustomDashboardItem[] = [...currentDashboard.items];
    selectedVizIdsToAdd.forEach(vizId => {
      // Automatically add to Executive Dashboard
      VisualizationEngine.addToExecutiveDashboard(vizId);

      if (!existingIds.has(vizId)) {
        newItems.push({
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          visualizationId: vizId,
          width: 'half',
          order: nextOrder++
        });
      }
    });

    saveCurrentDashboardChanges({ items: newItems });
    setSelectedVizIdsToAdd([]);
    setShowAddVizModal(false);
    setToastMessage(`Added ${selectedVizIdsToAdd.length} chart(s) to Dashboard & Executive Dashboard with automated summaries!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Remove Item from Dashboard
  const handleRemoveItem = (itemId: string) => {
    if (!currentDashboard) return;
    const updatedItems = currentDashboard.items.filter(i => i.id !== itemId);
    saveCurrentDashboardChanges({ items: updatedItems });
  };

  // Confirm Delete Chart (Remove from this dashboard OR delete permanently)
  const handleConfirmDeleteChart = (permanently: boolean) => {
    if (!chartToDelete || !currentDashboard) return;
    const { item, viz } = chartToDelete;

    if (permanently) {
      VisualizationEngine.deleteVisualization(viz.id);
      setToastMessage(`Permanently deleted "${viz.name}" from all dashboards and Executive Dashboard.`);
    } else {
      handleRemoveItem(item.id);
      // Check if visualization is still part of any other custom dashboard
      const allDashboards = VisualizationEngine.getCustomDashboards();
      const inOtherDashboards = allDashboards.some(d =>
        d.id !== currentDashboard.id && d.items.some(it => it.visualizationId === viz.id)
      );
      if (!inOtherDashboards) {
        VisualizationEngine.removeFromExecutiveDashboard(viz.id);
      }
      setToastMessage(`Removed "${viz.name}" from ${currentDashboard.name}.`);
    }

    setChartToDelete(null);
    reloadDashboards();
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Change Item Width
  const handleItemWidthChange = (itemId: string, newWidth: DashboardCardWidth) => {
    if (!currentDashboard) return;
    const updatedItems = currentDashboard.items.map(it =>
      it.id === itemId ? { ...it, width: newWidth } : it
    );
    saveCurrentDashboardChanges({ items: updatedItems });
  };

  // Move Item Left / Right (or Up / Down)
  const handleMoveItem = (index: number, direction: 'prev' | 'next') => {
    if (!currentDashboard) return;
    const newItems = [...currentDashboard.items];
    const targetIdx = direction === 'prev' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newItems.length) return;

    const temp = newItems[index];
    newItems[index] = newItems[targetIdx];
    newItems[targetIdx] = temp;

    const reordered = newItems.map((it, idx) => ({ ...it, order: idx }));
    saveCurrentDashboardChanges({ items: reordered });
  };

  // Add KPI Card
  const handleAddKPI = () => {
    if (!kpiCol || !currentDashboard) return;
    const title = kpiTitle.trim() || `${kpiAggr.toUpperCase()} of ${kpiCol}`;
    const newKpi: DashboardKPICard = {
      id: `kpi_${Date.now()}`,
      title,
      column: kpiCol,
      aggregation: kpiAggr,
      format: kpiFormat,
      comparisonLabel: 'vs Prior Period'
    };
    const currentKpis = currentDashboard.kpis || [];
    saveCurrentDashboardChanges({ kpis: [...currentKpis, newKpi] });
    setShowAddKPIModal(false);
    setKpiTitle('');
    setKpiCol('');
  };

  // Remove KPI Card
  const handleRemoveKPI = (kpiId: string) => {
    if (!currentDashboard) return;
    const updatedKpis = (currentDashboard.kpis || []).filter(k => k.id !== kpiId);
    saveCurrentDashboardChanges({ kpis: updatedKpis });
  };

  // Add Dashboard Filter
  const handleAddFilter = (column: string) => {
    if (!column) return;
    const existing = activeFilters.find(f => f.column === column);
    if (!existing) {
      const p = dataset.profiles[column];
      const newFilter: DashboardActiveFilter = {
        id: `f_${Date.now()}`,
        column,
        type: p?.type === 'datetime' ? 'date' : 'categorical',
        value: 'ALL'
      };
      const updated = [...activeFilters, newFilter];
      setActiveFilters(updated);
      saveCurrentDashboardChanges({ activeFilters: updated });
    }
    setShowAddFilterModal(false);
  };

  // Update Filter Value
  const handleFilterValueChange = (column: string, value: string) => {
    const updated = activeFilters.map(f =>
      f.column === column ? { ...f, value } : f
    );
    setActiveFilters(updated);
    saveCurrentDashboardChanges({ activeFilters: updated });
  };

  // Remove Filter
  const handleRemoveFilter = (column: string) => {
    const updated = activeFilters.filter(f => f.column !== column);
    setActiveFilters(updated);
    saveCurrentDashboardChanges({ activeFilters: updated });
  };

  // Clear All Filters
  const handleClearAllFilters = () => {
    setGlobalDateFilter('all_time');
    const reset = activeFilters.map(f => ({ ...f, value: 'ALL' }));
    setActiveFilters(reset);
    saveCurrentDashboardChanges({ activeFilters: reset });
  };

  // Has active non-default filters
  const hasActiveFilters = globalDateFilter !== 'all_time' || activeFilters.some(f => f.value !== 'ALL');

  // Compute Active Filtered Visualizations
  const computedVisualizations = useMemo(() => {
    if (!currentDashboard) return [];

    return currentDashboard.items.map((item, index) => {
      const viz = savedVisualizations.find(v => v.id === item.visualizationId);
      if (!viz) {
        return { item, viz: null, computed: null, error: 'Visualization not found' };
      }

      try {
        // Build dynamic filters compatible with this chart
        const effectiveFilters = [...(viz.config.filters || [])];

        activeFilters.forEach(f => {
          if (f.value && f.value !== 'ALL' && dataset.columns.includes(f.column)) {
            effectiveFilters.push({
              id: f.id,
              column: f.column,
              operator: 'equals',
              value: f.value
            });
          }
        });

        const effectiveConfig = {
          ...viz.config,
          dateRange: globalDateFilter !== 'all_time' ? { preset: globalDateFilter } : viz.config.dateRange,
          filters: effectiveFilters
        };

        const computed = VisualizationEngine.compute(dataset, effectiveConfig, viz.chartType, viz.customTitle);
        return { item, viz, computed, error: null };
      } catch (err) {
        return { item, viz, computed: null, error: 'Unable to calculate visualization' };
      }
    });
  }, [currentDashboard, savedVisualizations, activeFilters, globalDateFilter, dataset, refreshKey]);

  // Generate Evidence-Based Dashboard Insights
  const handleTriggerInsights = () => {
    setIsGeneratingInsights(true);
    setShowInsightsDrawer(true);
    setTimeout(() => {
      const structured = VisualizationEngine.generateStructuredDashboardInsights(
        dataset,
        currentDashboard,
        activeFilters,
        globalDateFilter,
        computedVisualizations
      );
      setGeneratedStructuredInsights(structured);
      setGeneratedInsights(structured.map(s => `${s.title} (${s.evidence})`));
      setIsGeneratingInsights(false);
    }, 250);
  };

  // Ask AI about Dashboard
  const handleAskAI = () => {
    setShowAskAIModal(true);
  };

  // Execute AI query with structured dashboard context
  const handleExecuteAIQuery = (queryText: string) => {
    setShowAskAIModal(false);
    if (onSelectQueryForAI) {
      onSelectQueryForAI(queryText);
    } else if (onNavigate) {
      onNavigate('ai_analyst');
    }
  };

  // Ask AI about a specific chart
  const handleAskAIForChart = (viz: SavedVisualization, computed: any) => {
    const filterSummary = activeFilters
      .filter(f => f.value !== 'ALL')
      .map(f => `${f.column} = "${f.value}"`)
      .join(', ');

    const prompt = `Analyze this specific chart from my dashboard: "${computed?.title || viz.name}" (Type: ${viz.chartType}, Dimension: ${viz.config.xAxisColumn}, Metric: ${viz.config.yAxisColumn || 'Count'}, Aggregation: ${viz.config.aggregation || 'sum'}${filterSummary ? `, Active Filters: ${filterSummary}` : ''}). What key patterns, top contributors, anomalies, and business implications are evident?`;

    if (onSelectQueryForAI) {
      onSelectQueryForAI(prompt);
    } else if (onNavigate) {
      onNavigate('ai_analyst');
    }
  };

  // Ask AI about a specific insight
  const handleAskAIForInsight = (insight: StructuredDashboardInsight) => {
    const filterSummary = activeFilters
      .filter(f => f.value !== 'ALL')
      .map(f => `${f.column} = "${f.value}"`)
      .join(', ');

    const prompt = `Can you provide a deep analytical breakdown and strategic business implications for this dashboard insight: "${insight.title}" (Evidence: ${insight.evidence}${filterSummary ? `, Filter Context: ${filterSummary}` : ''})?`;

    if (onSelectQueryForAI) {
      onSelectQueryForAI(prompt);
    } else if (onNavigate) {
      onNavigate('ai_analyst');
    }
  };

  // Dynamic context questions for dashboard AI modal
  const dashboardContextQuestions = useMemo(() => {
    const numCols = dataset.columns.filter(c => dataset.profiles[c]?.type === 'numeric');
    const catCols = dataset.columns.filter(c => dataset.profiles[c]?.type === 'categorical');
    const primaryNum = numCols.find(c => /sales|revenue|profit|mrr|amount/i.test(c)) || numCols[0] || 'metrics';
    const primaryCat = catCols[0] || 'segments';

    return [
      `Why did ${primaryNum} change across the observed period, and what are the main drivers?`,
      `Which ${primaryCat} category is outperforming the benchmark and why?`,
      `What statistical anomalies, risks, or high-priority opportunities are visible in this dashboard?`
    ];
  }, [dataset]);

  // Export Dashboard JSON / HTML / Print
  const handleExport = (format: 'json' | 'html' | 'print') => {
    if (!currentDashboard) return;

    if (format === 'print') {
      window.print();
      setShowExportModal(false);
      return;
    }

    if (format === 'json') {
      const payload = {
        dashboard: currentDashboard.name,
        description: currentDashboard.description,
        dataset: dataset.name,
        exportedAt: new Date().toISOString(),
        kpis: currentDashboard.kpis || [],
        visualizations: computedVisualizations.map(c => ({
          title: c.computed?.title || c.viz?.name,
          chartType: c.viz?.chartType,
          dataSummary: c.computed?.data?.slice(0, 20)
        }))
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentDashboard.name.toLowerCase().replace(/\s+/g, '_')}_data.json`;
      a.click();
      setShowExportModal(false);
      return;
    }

    if (format === 'html') {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>${currentDashboard.name} — Smart Data Analysis Assistant Export</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; background: #0b0d11; color: #e2e8f0; padding: 32px; }
            h1 { color: #f59e0b; margin-bottom: 4px; }
            .meta { color: #94a3b8; font-size: 13px; margin-bottom: 24px; }
            .card { background: #12151c; border: 1px solid #252a36; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
            th, td { text-align: left; padding: 8px; border-bottom: 1px solid #252a36; }
            th { color: #f59e0b; }
          </style>
        </head>
        <body>
          <h1>${currentDashboard.name}</h1>
          <div class="meta">${currentDashboard.description || ''} • Dataset: ${dataset.name} • Generated: ${new Date().toLocaleDateString()}</div>
          ${computedVisualizations.map(c => `
            <div class="card">
              <h3>${c.computed?.title || c.viz?.name || 'Chart'}</h3>
              <p style="color:#94a3b8;font-size:12px;">Type: ${c.viz?.chartType}</p>
              <table>
                <thead>
                  <tr>
                    <th>Dimension</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${(c.computed?.data || []).slice(0, 15).map((row: any) => `
                    <tr>
                      <td>${row.category || row.date || row.name || Object.values(row)[0]}</td>
                      <td>${row.value !== undefined ? row.value : Object.values(row)[1]}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}
        </body>
        </html>
      `;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentDashboard.name.toLowerCase().replace(/\s+/g, '_')}_report.html`;
      a.click();
      setShowExportModal(false);
    }
  };

  // Theme styles lookup
  const currentTheme: DashboardTheme = currentDashboard?.theme || 'default';
  const themeContainerBg =
    currentTheme === 'dark'
      ? 'bg-[#0F1117]'
      : currentTheme === 'slate'
      ? 'bg-[#0F172A]'
      : currentTheme === 'executive'
      ? 'bg-[#18181B]'
      : 'bg-[#12151C]';

  const themeCardBg =
    currentTheme === 'dark'
      ? 'bg-[#161B26] border-[#222B3D]'
      : currentTheme === 'slate'
      ? 'bg-[#1E293B] border-[#334155]'
      : currentTheme === 'executive'
      ? 'bg-[#27272A] border-[#3F3F46]'
      : 'bg-[#12151C] border-[#252A36]';

  // Responsive Grid Col-Span
  const getColSpanClass = (width: DashboardCardWidth) => {
    switch (width) {
      case 'small':
        return 'col-span-12 md:col-span-4 lg:col-span-3';
      case 'third':
        return 'col-span-12 md:col-span-4';
      case 'medium':
      case 'half':
        return 'col-span-12 md:col-span-6';
      case 'large':
        return 'col-span-12 md:col-span-8';
      case 'full':
      default:
        return 'col-span-12';
    }
  };

  // Dataset mismatch check
  const isDatasetMismatched = currentDashboard?.datasetId && currentDashboard.datasetId !== dataset.id && currentDashboard.datasetName !== dataset.name;

  return (
    <div className={`space-y-6 ${isPresentationMode ? 'fixed inset-0 z-50 bg-[#0B0D11] p-8 overflow-y-auto' : ''}`}>
      {/* PRESENTATION MODE FLOATING HEADER */}
      {isPresentationMode && (
        <div className="flex items-center justify-between bg-[#12151C]/90 backdrop-blur-md border border-[#252A36] rounded-2xl px-6 py-3.5 mb-6 shadow-2xl sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">{currentDashboard.name}</h2>
              <span className="text-[11px] text-slate-400 font-mono">
                {dataset.name} • {dataset.workingRows.length.toLocaleString()} rows
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 mr-2 hidden sm:inline">Press Esc to exit</span>
            <button
              onClick={() => setIsPresentationMode(false)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Exit Presentation</span>
            </button>
          </div>
        </div>
      )}

      {/* DATASET COMPATIBILITY WARNING */}
      {isDatasetMismatched && !isPresentationMode && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              This dashboard was originally created for <strong>{currentDashboard.datasetName || 'another dataset'}</strong>. Visualizations are adapting dynamically to matching columns in <strong>{dataset.name}</strong>.
            </span>
          </div>
          <button
            onClick={() => saveCurrentDashboardChanges({ datasetId: dataset.id, datasetName: dataset.name })}
            className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition"
          >
            Update Dataset Binding
          </button>
        </div>
      )}

      {/* 3. CLEAN PROFESSIONAL DASHBOARD HEADER */}
      {!isPresentationMode && (
        <div className={`${themeContainerBg} border border-[#252A36] rounded-2xl p-5 shadow-xl space-y-4`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Dashboard Title & Meta Zone */}
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Dashboard Selector */}
                  <select
                    value={selectedDashboardId}
                    onChange={e => setSelectedDashboardId(e.target.value)}
                    className="bg-[#181D26] border border-[#2D3342] text-slate-100 font-bold text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {dashboards.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.items.length} charts)
                      </option>
                    ))}
                  </select>

                  {/* Header Edit button in Edit Mode */}
                  {isEditMode && (
                    <button
                      onClick={() => setIsEditingHeader(!isEditingHeader)}
                      className="px-2.5 py-1 rounded-lg bg-[#181D26] text-slate-300 hover:text-amber-400 border border-[#2D3342] text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{isEditingHeader ? 'Done' : 'Rename'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowCreateDashModal(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="Create New Custom Dashboard"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Dashboard</span>
                  </button>
                </div>

                {/* Inline Editing for Title and Description in Edit Mode */}
                {isEditingHeader && isEditMode ? (
                  <div className="space-y-2 pt-2">
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={e => setEditedTitle(e.target.value)}
                      placeholder="Dashboard Title"
                      className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-lg px-3 py-1 text-xs text-slate-200 focus:border-amber-500"
                    />
                    <input
                      type="text"
                      value={editedDesc}
                      onChange={e => setEditedDesc(e.target.value)}
                      placeholder="Short Description"
                      className="w-full bg-[#0B0D11] border border-[#2D3342] rounded-lg px-3 py-1 text-xs text-slate-400 focus:border-amber-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          saveCurrentDashboardChanges({ name: editedTitle.trim() || 'Custom Dashboard', description: editedDesc.trim() });
                          setIsEditingHeader(false);
                        }}
                        className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs"
                      >
                        Save Header
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    {currentDashboard?.description || 'Custom interactive analytical workspace.'}
                  </p>
                )}

                {/* Metadata tags (clean presentation) */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-slate-400">
                  <span className="font-medium text-slate-300">Dataset: {dataset.name}</span>
                  <span>•</span>
                  <span>
                    Last updated: {new Date(currentDashboard?.lastModified || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {currentDashboard?.items.length !== undefined && (
                    <>
                      <span>•</span>
                      <span>{currentDashboard.items.length} {currentDashboard.items.length === 1 ? 'visual' : 'visuals'}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center flex-wrap gap-2">
              {/* Toggle Edit Mode */}
              <button
                onClick={() => {
                  setIsEditMode(!isEditMode);
                  setIsEditingHeader(false);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  isEditMode
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-[#181D26] text-slate-300 border border-[#2D3342] hover:text-white'
                }`}
              >
                {isEditMode ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                <span>{isEditMode ? 'Done Editing' : 'Edit Dashboard'}</span>
              </button>

              {/* Add Visualization Button */}
              <button
                onClick={() => {
                  setSelectedVizIdsToAdd([]);
                  setShowAddVizModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Visualization</span>
              </button>

              {/* Presentation Mode Button */}
              <button
                onClick={() => setIsPresentationMode(true)}
                className="px-3 py-2 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-slate-300 hover:text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Open Presentation Mode"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Present</span>
              </button>

              {/* Refresh Button */}
              <button
                onClick={reloadDashboards}
                className={`p-2 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-slate-400 hover:text-slate-200 transition cursor-pointer ${
                  isRefreshing ? 'animate-spin text-amber-400' : ''
                }`}
                title="Refresh Dashboard"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Intelligence Insights Button */}
              <button
                onClick={handleTriggerInsights}
                className="px-3 py-2 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-slate-300 hover:text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Generate Evidence-Based Insights"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Insights</span>
              </button>

              {/* Ask AI Button */}
              <button
                onClick={handleAskAI}
                className="px-3 py-2 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-slate-300 hover:text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Ask AI Analyst About Dashboard"
              >
                <Bot className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Ask AI</span>
              </button>

              {/* Export Dropdown Button */}
              <button
                onClick={() => setShowExportModal(true)}
                className="p-2 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-slate-400 hover:text-slate-200 transition cursor-pointer"
                title="Export Dashboard"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Theme Dropdown */}
              <button
                onClick={() => setShowThemeModal(true)}
                className="p-2 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-slate-400 hover:text-slate-200 transition cursor-pointer"
                title="Dashboard Theme"
              >
                <Palette className="w-4 h-4" />
              </button>

              {/* More Actions Menu */}
              <div className="relative">
                <button
                  onClick={() => setActiveMenuCardId(activeMenuCardId === 'dash_menu' ? null : 'dash_menu')}
                  className="p-2 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-slate-400 hover:text-slate-200 transition cursor-pointer"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {activeMenuCardId === 'dash_menu' && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#12151C] border border-[#2D3342] rounded-xl shadow-2xl z-30 py-1.5 text-xs">
                    <button
                      onClick={() => {
                        setActiveMenuCardId(null);
                        handleDuplicateDashboard();
                      }}
                      className="w-full text-left px-3.5 py-2 text-slate-300 hover:bg-[#181D26] hover:text-amber-400 flex items-center gap-2"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Duplicate Dashboard</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveMenuCardId(null);
                        setShowAddKPIModal(true);
                      }}
                      className="w-full text-left px-3.5 py-2 text-slate-300 hover:bg-[#181D26] hover:text-amber-400 flex items-center gap-2"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Add KPI Card</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveMenuCardId(null);
                        setShowAddFilterModal(true);
                      }}
                      className="w-full text-left px-3.5 py-2 text-slate-300 hover:bg-[#181D26] hover:text-amber-400 flex items-center gap-2"
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span>Add Filter Dimension</span>
                    </button>

                    {dashboards.length > 1 && (
                      <div className="border-t border-[#252A36] mt-1 pt-1">
                        <button
                          onClick={() => {
                            setActiveMenuCardId(null);
                            setDeletingDashId(currentDashboard.id);
                          }}
                          className="w-full text-left px-3.5 py-2 text-rose-400 hover:bg-rose-500/15 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Dashboard</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 9. DISCOVERABLE DASHBOARD FILTER BAR */}
          <div className="pt-3 border-t border-[#252A36] flex flex-wrap items-center gap-2.5 text-xs">
            <span className="flex items-center gap-1.5 text-slate-400 font-semibold mr-1">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <span>Filters:</span>
            </span>

            {/* Timeline Filter */}
            <div className="flex items-center bg-[#0B0D11] border border-[#2D3342] rounded-xl px-2.5 py-1 gap-1.5">
              <Calendar className="w-3 h-3 text-slate-400" />
              <select
                value={globalDateFilter}
                onChange={e => setGlobalDateFilter(e.target.value as DateRangePreset)}
                className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
              >
                <option value="all_time">Timeline: All Time</option>
                <option value="last_7_days">Last 7 Days</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="last_90_days">Last 90 Days</option>
                <option value="this_year">This Year</option>
                <option value="last_year">Last Year</option>
              </select>
            </div>

            {/* Dynamic Active Filters */}
            {activeFilters.map(filter => {
              // Gather distinct values for this filter column
              const vals = new Set<string>();
              dataset.workingRows.forEach(r => {
                const v = r[filter.column];
                if (v !== null && v !== undefined && v !== '') vals.add(String(v));
              });
              const distinctVals = Array.from(vals).slice(0, 30);

              return (
                <div
                  key={filter.id}
                  className="flex items-center bg-[#0B0D11] border border-amber-500/30 rounded-xl px-2.5 py-1 gap-1.5"
                >
                  <span className="text-amber-400 font-semibold">{filter.column}:</span>
                  <select
                    value={filter.value}
                    onChange={e => handleFilterValueChange(filter.column, e.target.value)}
                    className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer font-medium max-w-[140px] truncate"
                  >
                    <option value="ALL">All</option>
                    {distinctVals.map(v => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRemoveFilter(filter.column)}
                    className="text-slate-400 hover:text-rose-400 ml-1 p-0.5"
                    title="Remove Filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {/* Add Filter Button */}
            <button
              onClick={() => setShowAddFilterModal(true)}
              className="px-2.5 py-1 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] text-slate-300 hover:text-amber-400 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Filter</span>
            </button>

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={handleClearAllFilters}
                className="text-xs text-rose-400 hover:text-rose-300 underline underline-offset-2 ml-2 transition cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* 13 & 14. KPI SUMMARY CARDS */}
      {((currentDashboard?.kpis && currentDashboard.kpis.length > 0) || (isEditMode && currentDashboard)) && (
        <div className="space-y-2">
          {isEditMode && (
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Dashboard KPI Metrics</span>
              <button
                onClick={() => setShowAddKPIModal(true)}
                className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add KPI Card</span>
              </button>
            </div>
          )}

          {currentDashboard.kpis && currentDashboard.kpis.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {currentDashboard.kpis.map(kpi => {
                const computed = VisualizationEngine.computeKPICard(dataset, kpi, activeFilters);

                return (
                  <div
                    key={kpi.id}
                    className={`${themeCardBg} border rounded-2xl p-4 shadow-lg flex flex-col justify-between relative group`}
                  >
                    {isEditMode && (
                      <button
                        onClick={() => handleRemoveKPI(kpi.id)}
                        className="absolute top-2.5 right-2.5 p-1 rounded-lg bg-[#0B0D11] text-slate-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition"
                        title="Remove KPI"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}

                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                      {kpi.title}
                    </span>

                    <div className="my-1">
                      <span className="text-2xl font-bold text-slate-100 tracking-tight">
                        {computed.value}
                      </span>
                    </div>

                    {computed.changePct !== undefined ? (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span
                          className={`font-bold flex items-center gap-0.5 ${
                            computed.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {computed.changePct >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {computed.changePct >= 0 ? `+${computed.changePct}%` : `${computed.changePct}%`}
                        </span>
                        <span className="text-slate-400 truncate">{computed.changeLabel}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 font-mono">
                        {kpi.aggregation.toUpperCase()} of {kpi.column}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* EVIDENCE-BASED INSIGHTS DRAWER */}
      {showInsightsDrawer && (
        <div className="bg-[#12151C] border border-amber-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-slate-100">Dashboard Intelligence Insights</h3>
              {activeFilters.length > 0 && (
                <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
                  {activeFilters.filter(f => f.value !== 'ALL').length} Active Filter(s) Applied
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTriggerInsights}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer mr-2"
                title="Regenerate insights with current filters"
              >
                <RefreshCw className={`w-3 h-3 ${isGeneratingInsights ? 'animate-spin' : ''}`} />
                <span>Recalculate</span>
              </button>
              <button
                onClick={() => setShowInsightsDrawer(false)}
                className="p-1 rounded-lg bg-[#181D26] text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {isGeneratingInsights ? (
            <div className="py-8 text-center text-xs text-slate-400 animate-pulse space-y-2">
              <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Synthesizing mathematical metrics and segment trends from dashboard...</p>
            </div>
          ) : generatedStructuredInsights.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {generatedStructuredInsights.map(insight => {
                const isExpanded = expandedInsightDetailsId === insight.id;
                const typeLabel = insight.type.toUpperCase();

                return (
                  <div
                    key={insight.id}
                    className="bg-[#0B0D11] p-4 rounded-xl border border-[#252A36] hover:border-amber-500/30 flex flex-col justify-between transition space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                          {typeLabel}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {insight.confidence}% Confidence
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-100 leading-snug">
                        {insight.title}
                      </h4>

                      <div className="bg-[#12151C] p-2.5 rounded-lg border border-[#202532] text-[11px] text-slate-300">
                        <span className="text-amber-400 font-semibold">Evidence: </span>
                        {insight.evidence}
                      </div>

                      {/* Expandable Mathematical Details */}
                      {isExpanded && insight.details && (
                        <div className="bg-[#141923] p-2.5 rounded-lg border border-[#2B3345] space-y-1.5 text-[10px] font-mono text-slate-300 animate-fadeIn">
                          <div className="text-slate-400 font-semibold uppercase text-[9px]">Calculation Trace</div>
                          <div>Metric: <span className="text-amber-300">{insight.details.metric}</span></div>
                          <div>Formula: <span className="text-slate-200">{insight.details.calculation}</span></div>
                          {insight.details.sourceVizTitle && (
                            <div>Source Chart: <span className="text-slate-200">{insight.details.sourceVizTitle}</span></div>
                          )}
                          {insight.details.filtersApplied && insight.details.filtersApplied.length > 0 && (
                            <div>Filters: <span className="text-amber-300">{insight.details.filtersApplied.join(', ')}</span></div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#202532] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleAskAIForInsight(insight)}
                          className="px-2.5 py-1 rounded-lg bg-[#181D26] hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-[#2B3242] text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition"
                        >
                          <Bot className="w-3 h-3 text-amber-400" />
                          <span>Ask AI</span>
                        </button>
                        {insight.details && (
                          <button
                            onClick={() => setExpandedInsightDetailsId(isExpanded ? null : insight.id)}
                            className="px-2 py-1 rounded-lg text-slate-400 hover:text-slate-200 text-[11px] font-medium transition cursor-pointer"
                          >
                            {isExpanded ? 'Hide Details' : 'Details'}
                          </button>
                        )}
                      </div>

                      {/* Workflow Step Jump */}
                      {insight.actionableRecommendation && (
                        <button
                          onClick={() => {
                            if (insight.actionableRecommendation?.promptOrGoal && onSelectQueryForAI) {
                              onSelectQueryForAI(insight.actionableRecommendation.promptOrGoal);
                            }
                            if (onNavigate) {
                              onNavigate(insight.actionableRecommendation?.targetSection);
                            }
                          }}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <span>{insight.actionableRecommendation.label}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2.5 text-xs text-slate-300">
              {generatedInsights.map((insight, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 bg-[#0B0D11] p-3 rounded-xl border border-[#252A36]"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <p className="leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 19. DASHBOARD EMPTY STATE */}
      {!currentDashboard || currentDashboard.items.length === 0 ? (
        <div className={`${themeContainerBg} border border-[#252A36] rounded-2xl p-12 text-center space-y-4 shadow-xl`}>
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <LayoutDashboard className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-100">Your dashboard is empty.</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Add visualizations to start building your professional analytical dashboard.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setSelectedVizIdsToAdd([]);
                setShowAddVizModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-xs text-slate-950 shadow-md shadow-amber-500/20 transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Visualization</span>
            </button>
            <button
              onClick={onCreateNewVisualization}
              className="px-4 py-2.5 rounded-xl bg-[#181D26] hover:bg-[#202733] border border-[#2D3342] font-semibold text-xs text-slate-200 transition flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Create New Chart</span>
            </button>
          </div>
        </div>
      ) : (
        /* 5 & 6. RESPONSIVE GRID LAYOUT */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {computedVisualizations.map((entry, index) => {
            const { item, viz, computed, error } = entry;
            const colSpan = getColSpanClass(item.width);

            if (!viz || error || !computed) {
              return (
                <div
                  key={item.id}
                  className={`${colSpan} ${themeCardBg} border border-rose-500/30 rounded-2xl p-6 shadow-xl flex flex-col justify-between`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Unable to load this visualization</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {error || 'The underlying field configuration or dataset column is unavailable.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-[#252A36] mt-4 text-xs">
                    <button
                      onClick={reloadDashboards}
                      className="text-amber-400 hover:text-amber-300 font-semibold"
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      Remove from Dashboard
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className={`${colSpan} ${themeCardBg} border hover:border-amber-500/30 rounded-2xl p-5 shadow-xl transition flex flex-col justify-between group relative`}
              >
                {/* 4. EDIT MODE CONTROLS */}
                {isEditMode && !isPresentationMode && (
                  <div className="mb-3 pb-2.5 border-b border-[#252A36] flex flex-wrap items-center justify-between text-xs bg-[#0B0D11] -mx-5 -mt-5 p-3 rounded-t-2xl gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-amber-400 font-mono">
                        #{index + 1}
                      </span>
                      <span className="text-slate-300 font-semibold text-xs truncate max-w-[160px]">
                        {viz.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Width Sizer: Small / 1/2 / 2/3 / Full */}
                      <div className="flex items-center bg-[#181D26] rounded-lg p-0.5 border border-[#2D3342]">
                        <button
                          onClick={() => handleItemWidthChange(item.id, 'small')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                            item.width === 'small' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                          }`}
                          title="Small (1/4 Width)"
                        >
                          1/4
                        </button>
                        <button
                          onClick={() => handleItemWidthChange(item.id, 'third')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                            item.width === 'third' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                          }`}
                          title="Third (1/3 Width)"
                        >
                          1/3
                        </button>
                        <button
                          onClick={() => handleItemWidthChange(item.id, 'half')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                            item.width === 'half' || item.width === 'medium' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                          }`}
                          title="Medium (1/2 Width)"
                        >
                          1/2
                        </button>
                        <button
                          onClick={() => handleItemWidthChange(item.id, 'large')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                            item.width === 'large' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                          }`}
                          title="Large (2/3 Width)"
                        >
                          2/3
                        </button>
                        <button
                          onClick={() => handleItemWidthChange(item.id, 'full')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                            item.width === 'full' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                          }`}
                          title="Full Width"
                        >
                          Full
                        </button>
                      </div>

                      {/* Reorder Left / Right */}
                      <button
                        onClick={() => handleMoveItem(index, 'prev')}
                        disabled={index === 0}
                        className="p-1 rounded bg-[#181D26] border border-[#2D3342] text-slate-400 hover:text-slate-200 disabled:opacity-30"
                        title="Move Left / Up"
                      >
                        <MoveLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveItem(index, 'next')}
                        disabled={index === currentDashboard.items.length - 1}
                        className="p-1 rounded bg-[#181D26] border border-[#2D3342] text-slate-400 hover:text-slate-200 disabled:opacity-30"
                        title="Move Right / Down"
                      >
                        <MoveRight className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit in Studio */}
                      <button
                        onClick={() => onEditVisualization(viz)}
                        className="p-1 rounded bg-[#181D26] hover:bg-amber-500/20 border border-[#2D3342] text-amber-400 hover:text-amber-300"
                        title="Edit in Visualization Builder"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete / Remove from Dashboard */}
                      <button
                        onClick={() => setChartToDelete({ item, viz })}
                        className="p-1 rounded bg-[#181D26] hover:bg-rose-500/20 border border-[#2D3342] text-rose-400 hover:text-rose-300 transition cursor-pointer"
                        title="Delete chart from dashboard"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 7. VISUALIZATION CARD (CLEAN VIEW MODE) */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-bold text-slate-100 tracking-tight">
                        {computed.title || viz.name}
                      </h4>
                      {viz.description && (
                        <p className="text-[11px] text-slate-400 truncate max-w-sm">
                          {viz.description}
                        </p>
                      )}
                    </div>

                    {!isEditMode && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleAskAIForChart(viz, computed)}
                          className="px-2 py-1 rounded-lg bg-[#181D26] hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-[#2B3242] text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                          title="Ask AI about this visualization"
                        >
                          <Bot className="w-3 h-3" />
                          <span>Ask AI</span>
                        </button>
                        <button
                          onClick={() => setInspectingViz(viz)}
                          className="p-1.5 rounded-lg bg-[#181D26] text-slate-400 hover:text-amber-400"
                          title="View Fullscreen"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDetailsViz(viz)}
                          className="p-1.5 rounded-lg bg-[#181D26] text-slate-400 hover:text-amber-400"
                          title="Chart Details"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onEditVisualization(viz)}
                          className="p-1.5 rounded-lg bg-[#181D26] text-slate-400 hover:text-amber-400"
                          title="Edit in Studio"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setChartToDelete({ item, viz })}
                          className="p-1.5 rounded-lg bg-[#181D26] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-[#2B3242] hover:border-rose-500/30 transition cursor-pointer"
                          title="Delete Chart from Dashboard"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Render Visual Canvas */}
                  <ChartViewer
                    type={computed.chartType as any}
                    title=""
                    data={computed.data}
                    xAxisKey={computed.xAxisKey}
                    yAxisKey={computed.yAxisKey}
                    keys={computed.seriesKeys}
                    xAxisLabel={computed.xAxisTitle}
                    yAxisLabel={computed.yAxisTitle}
                    height={item.width === 'full' ? 340 : item.width === 'small' ? 240 : 280}
                  />
                </div>

                {/* Subtle source indicator (view mode) */}
                {!isEditMode && !isPresentationMode && (
                  <div className="mt-2.5 pt-2 border-t border-[#252A36] flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-mono truncate">
                      {viz.config.xAxisColumn} {viz.config.yAxisColumn ? `• ${viz.config.yAxisColumn}` : ''}
                    </span>
                    <button
                      onClick={() => setDetailsViz(viz)}
                      className="text-slate-400 hover:text-amber-400 transition"
                    >
                      Details
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 20 & 21. MODAL: ADD VISUALIZATION / VISUALIZATION LIBRARY */}
      {showAddVizModal && (
        <div className="fixed inset-0 bg-[#0B0D11]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-[#2D3342] rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">Add Visualizations to Dashboard</h3>
              </div>
              <button
                onClick={() => setShowAddVizModal(false)}
                className="text-xs text-slate-400 hover:text-slate-100 p-1.5 rounded-lg bg-[#181D26]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {savedVisualizations.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-xs text-slate-400">You don't have any saved visualizations yet.</p>
                <button
                  onClick={() => {
                    setShowAddVizModal(false);
                    onCreateNewVisualization();
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition"
                >
                  Create Your First Visualization
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Select one or more saved charts to add to <strong>{currentDashboard?.name}</strong>:
                </p>

                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                  {savedVisualizations.map(viz => {
                    const isAlreadyIn = currentDashboard?.items.some(it => it.visualizationId === viz.id);
                    const isSelected = selectedVizIdsToAdd.includes(viz.id);

                    return (
                      <div
                        key={viz.id}
                        onClick={() => {
                          if (isAlreadyIn) return;
                          if (isSelected) {
                            setSelectedVizIdsToAdd(selectedVizIdsToAdd.filter(id => id !== viz.id));
                          } else {
                            setSelectedVizIdsToAdd([...selectedVizIdsToAdd, viz.id]);
                          }
                        }}
                        className={`border rounded-xl p-3 flex items-center justify-between gap-3 transition cursor-pointer ${
                          isAlreadyIn
                            ? 'bg-[#0B0D11]/50 border-[#252A36] opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-amber-500/15 border-amber-500/60 text-amber-200'
                            : 'bg-[#0B0D11] border-[#252A36] hover:border-amber-500/40 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected || isAlreadyIn}
                            disabled={isAlreadyIn}
                            readOnly
                            className="rounded text-amber-500 focus:ring-0"
                          />
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                {viz.chartType}
                              </span>
                              <h4 className="text-xs font-bold text-slate-200">{viz.name}</h4>
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono">
                              {viz.config.xAxisColumn} {viz.config.yAxisColumn ? `• ${viz.config.yAxisColumn}` : ''}
                            </p>
                          </div>
                        </div>

                        {isAlreadyIn && (
                          <span className="text-[10px] text-slate-500 font-semibold uppercase">Already Added</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#252A36]">
                  <button
                    onClick={() => {
                      setShowAddVizModal(false);
                      onCreateNewVisualization();
                    }}
                    className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create new chart instead</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAddVizModal(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#181D26] text-slate-300 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddSelectedVisualizations}
                      disabled={selectedVizIdsToAdd.length === 0}
                      className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 disabled:opacity-50"
                    >
                      Add Selected ({selectedVizIdsToAdd.length})
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE CUSTOM DASHBOARD */}
      {showCreateDashModal && (
        <div className="fixed inset-0 bg-[#0B0D11]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-[#2D3342] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">Create Custom Dashboard</h3>
              </div>
              <button
                onClick={() => setShowCreateDashModal(false)}
                className="text-xs text-slate-400 hover:text-slate-100 p-1.5 rounded-lg bg-[#181D26]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Dashboard Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sales Performance Dashboard"
                  value={newDashName}
                  onChange={e => setNewDashName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0D11] border border-[#2D3342] rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Overview of monthly sales, regional performance and profitability."
                  value={newDashDesc}
                  onChange={e => setNewDashDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0D11] border border-[#2D3342] rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                  Starting Template
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDashTemplate('blank')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      dashTemplate === 'blank'
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                        : 'bg-[#0B0D11] border-[#252A36] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-xs">Blank Canvas</div>
                    <div className="text-[10px] text-slate-400">Empty dashboard ready for your charts</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDashTemplate('sales')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      dashTemplate === 'sales'
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                        : 'bg-[#0B0D11] border-[#252A36] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-xs">Auto-Populate</div>
                    <div className="text-[10px] text-slate-400">Seed with initial charts from dataset</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#252A36]">
              <button
                onClick={() => setShowCreateDashModal(false)}
                className="px-3.5 py-1.5 rounded-xl bg-[#181D26] hover:bg-[#202733] text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDashboard}
                className="px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 shadow-md shadow-amber-500/20"
              >
                Create Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. MODAL: ADD FILTER DIMENSION */}
      {showAddFilterModal && (
        <div className="fixed inset-0 bg-[#0B0D11]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-[#2D3342] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">Add Dashboard Filter Dimension</h3>
              </div>
              <button
                onClick={() => setShowAddFilterModal(false)}
                className="text-xs text-slate-400 hover:text-slate-100 p-1.5 rounded-lg bg-[#181D26]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Select a column to add as a dynamic filter on this dashboard:
            </p>

            <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
              {filterableColumns.map(col => {
                const isAlready = activeFilters.some(f => f.column === col);
                const p = dataset.profiles[col];

                return (
                  <button
                    key={col}
                    onClick={() => handleAddFilter(col)}
                    disabled={isAlready}
                    className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                      isAlready
                        ? 'bg-[#0B0D11]/40 border-[#252A36] text-slate-600 cursor-not-allowed'
                        : 'bg-[#0B0D11] border-[#252A36] hover:border-amber-500/40 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-amber-400">
                        {p?.type === 'datetime' ? '📅' : 'Aa'}
                      </span>
                      <span className="font-semibold">{col}</span>
                    </div>
                    {isAlready ? (
                      <span className="text-[10px] text-slate-500">Added</span>
                    ) : (
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 13 & 14. MODAL: ADD KPI CARD */}
      {showAddKPIModal && (
        <div className="fixed inset-0 bg-[#0B0D11]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-[#2D3342] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">Add KPI Summary Card</h3>
              </div>
              <button
                onClick={() => setShowAddKPIModal(false)}
                className="text-xs text-slate-400 hover:text-slate-100 p-1.5 rounded-lg bg-[#181D26]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Card Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Total Revenue"
                  value={kpiTitle}
                  onChange={e => setKpiTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0D11] border border-[#2D3342] rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Metric Column
                </label>
                <select
                  value={kpiCol}
                  onChange={e => {
                    setKpiCol(e.target.value);
                    if (!kpiTitle) setKpiTitle(`Total ${e.target.value}`);
                  }}
                  className="w-full px-3 py-2 bg-[#0B0D11] border border-[#2D3342] rounded-xl text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="">-- Select Column --</option>
                  {numericColumns.map(col => (
                    <option key={col} value={col}>
                      # {col}
                    </option>
                  ))}
                  {dataset.columns.map(col => (
                    <option key={`distinct_${col}`} value={col}>
                      Distinct ({col})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Aggregation
                  </label>
                  <select
                    value={kpiAggr}
                    onChange={e => setKpiAggr(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-[#2D3342] rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="sum">Sum</option>
                    <option value="avg">Average (Mean)</option>
                    <option value="count">Count Records</option>
                    <option value="distinct">Distinct Count</option>
                    <option value="min">Minimum</option>
                    <option value="max">Maximum</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Format
                  </label>
                  <select
                    value={kpiFormat}
                    onChange={e => setKpiFormat(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-[#2D3342] rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="currency">Currency ($)</option>
                    <option value="number">Number</option>
                    <option value="percent">Percentage (%)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#252A36]">
              <button
                onClick={() => setShowAddKPIModal(false)}
                className="px-3.5 py-1.5 rounded-xl bg-[#181D26] text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddKPI}
                disabled={!kpiCol}
                className="px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 shadow-md shadow-amber-500/20 disabled:opacity-50"
              >
                Add KPI Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 28. MODAL: FULLSCREEN SINGLE CHART */}
      {inspectingViz && (
        <div className="fixed inset-0 bg-[#0B0D11]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-[#2D3342] rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {inspectingViz.chartType}
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
                    height={400}
                    description={computed.description}
                  />
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#252A36]">
              <button
                onClick={() => {
                  const target = inspectingViz;
                  setInspectingViz(null);
                  onEditVisualization(target);
                }}
                className="px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400"
              >
                Edit in Builder
              </button>
              <button
                onClick={() => setInspectingViz(null)}
                className="px-4 py-1.5 rounded-xl bg-[#181D26] text-slate-300 text-xs font-semibold hover:bg-[#202733]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 29. MODAL: CHART DETAILS */}
      {detailsViz && (
        <div className="fixed inset-0 bg-[#0B0D11]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-[#2D3342] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">Visualization Details</h3>
              </div>
              <button
                onClick={() => setDetailsViz(null)}
                className="p-1 rounded-lg bg-[#181D26] text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-[#252A36]">
                <span className="text-slate-400">Name</span>
                <span className="font-semibold">{detailsViz.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#252A36]">
                <span className="text-slate-400">Chart Type</span>
                <span className="font-mono text-amber-400 uppercase">{detailsViz.chartType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#252A36]">
                <span className="text-slate-400">X-Axis / Category</span>
                <span className="font-mono">{detailsViz.config.xAxisColumn}</span>
              </div>
              {detailsViz.config.yAxisColumn && (
                <div className="flex justify-between py-1 border-b border-[#252A36]">
                  <span className="text-slate-400">Y-Axis / Metric</span>
                  <span className="font-mono">{detailsViz.config.yAxisColumn}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-[#252A36]">
                <span className="text-slate-400">Aggregation</span>
                <span className="font-mono uppercase">{detailsViz.config.aggregation || 'Sum'}</span>
              </div>
              {detailsViz.config.timeGranularity && (
                <div className="flex justify-between py-1 border-b border-[#252A36]">
                  <span className="text-slate-400">Time Granularity</span>
                  <span className="font-mono capitalize">{detailsViz.config.timeGranularity}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Target Dataset</span>
                <span>{dataset.name}</span>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-[#252A36]">
              <button
                onClick={() => setDetailsViz(null)}
                className="px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 26. MODAL: EXPORT DASHBOARD */}
      {showExportModal && (
        <div className="fixed inset-0 bg-[#0B0D11]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-[#2D3342] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">Export Dashboard</h3>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1 rounded-lg bg-[#181D26] text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleExport('html')}
                className="w-full p-3 rounded-xl bg-[#0B0D11] hover:bg-[#181D26] border border-[#252A36] flex items-center gap-3 text-left transition text-xs text-slate-200"
              >
                <FileText className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="font-bold">Interactive HTML Document</div>
                  <div className="text-[10px] text-slate-400">Self-contained presentation report</div>
                </div>
              </button>

              <button
                onClick={() => handleExport('json')}
                className="w-full p-3 rounded-xl bg-[#0B0D11] hover:bg-[#181D26] border border-[#252A36] flex items-center gap-3 text-left transition text-xs text-slate-200"
              >
                <Layers className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="font-bold">JSON Data & Schema</div>
                  <div className="text-[10px] text-slate-400">Export structured visualization data</div>
                </div>
              </button>

              <button
                onClick={() => handleExport('print')}
                className="w-full p-3 rounded-xl bg-[#0B0D11] hover:bg-[#181D26] border border-[#252A36] flex items-center gap-3 text-left transition text-xs text-slate-200"
              >
                <Share2 className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="font-bold">Print / Save as PDF</div>
                  <div className="text-[10px] text-slate-400">Clean print-ready view</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 16. MODAL: THEMES */}
      {showThemeModal && (
        <div className="fixed inset-0 bg-[#0B0D11]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-[#2D3342] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">Dashboard Theme</h3>
              </div>
              <button
                onClick={() => setShowThemeModal(false)}
                className="p-1 rounded-lg bg-[#181D26] text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {(['default', 'dark', 'slate', 'executive'] as const).map(themeKey => (
                <button
                  key={themeKey}
                  onClick={() => {
                    saveCurrentDashboardChanges({ theme: themeKey });
                    setShowThemeModal(false);
                  }}
                  className={`p-3 rounded-xl border text-left transition capitalize text-xs ${
                    currentTheme === themeKey
                      ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 font-bold'
                      : 'bg-[#0B0D11] border-[#252A36] text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="font-bold">{themeKey}</div>
                  <div className="text-[10px] text-slate-400 capitalize">
                    {themeKey === 'default' ? 'Amber Modern' : `${themeKey} Surface`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASK AI ABOUT DASHBOARD */}
      {showAskAIModal && (
        <div className="fixed inset-0 bg-[#0B0D11]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-[#2D3342] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">Ask AI About Dashboard</h3>
              </div>
              <button
                onClick={() => setShowAskAIModal(false)}
                className="p-1 rounded-lg bg-[#181D26] text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Context Summary */}
              <div className="bg-[#0B0D11] border border-[#252A36] rounded-xl p-3 space-y-1 text-xs">
                <div className="font-semibold text-slate-200">{currentDashboard?.name}</div>
                <div className="text-[11px] text-slate-400 flex flex-wrap gap-2">
                  <span>Dataset: <strong className="text-slate-300">{dataset.name}</strong></span>
                  <span>•</span>
                  <span>Charts: <strong className="text-slate-300">{computedVisualizations.length}</strong></span>
                  <span>•</span>
                  <span>Filters: <strong className="text-amber-400">{activeFilters.filter(f => f.value !== 'ALL').length > 0 ? activeFilters.filter(f => f.value !== 'ALL').map(f => `${f.column}: ${f.value}`).join(', ') : 'All Time / Unfiltered'}</strong></span>
                </div>
              </div>

              {/* Suggested Context Questions */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Suggested Contextual Inquiries
                </span>
                <div className="space-y-2">
                  {dashboardContextQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleExecuteAIQuery(q)}
                      className="w-full text-left p-3 rounded-xl bg-[#0B0D11] hover:bg-amber-500/10 border border-[#252A36] hover:border-amber-500/40 text-xs text-slate-200 hover:text-amber-200 transition flex items-center justify-between group cursor-pointer"
                    >
                      <span className="leading-snug pr-2">{q}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Query Action */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    const fullSummary = `I am analyzing the "${currentDashboard?.name}" custom dashboard on dataset "${dataset.name}" with ${computedVisualizations.length} charts. Please give me an executive strategic briefing highlighting key variance, segment leaders, and recommended next steps.`;
                    handleExecuteAIQuery(fullSummary);
                  }}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Full AI Executive Briefing</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 36. MODAL: DELETE DASHBOARD CHART CONFIRM */}
      {chartToDelete && (
        <div className="fixed inset-0 bg-[#0B0D11]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-[#2D3342] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Delete Dashboard Chart</h3>
                  <p className="text-[11px] text-slate-400">
                    {chartToDelete.viz.customTitle || chartToDelete.viz.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setChartToDelete(null)}
                className="p-1 rounded-lg bg-[#181D26] text-slate-400 hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#0B0D11] border border-[#232834] rounded-xl space-y-2 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Choose how you would like to delete this chart:
              </p>
              <div className="space-y-2 pt-1">
                <div className="p-2.5 rounded-lg bg-[#141820] border border-[#252B38] space-y-1">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    <span>Remove from Current Dashboard</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Removes the card from <strong>{currentDashboard?.name}</strong>. The saved visualization remains available in your library.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-[#141820] border border-[#252B38] space-y-1">
                  <div className="font-semibold text-rose-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    <span>Delete Visualization Permanently</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Completely deletes this chart from all dashboards, the Executive Dashboard, and your saved gallery.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setChartToDelete(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#181D26] hover:bg-[#202632] text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmDeleteChart(false)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition cursor-pointer"
              >
                Remove from Dashboard
              </button>
              <button
                onClick={() => handleConfirmDeleteChart(true)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs shadow-md shadow-rose-500/20 transition cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 36.5 MODAL: DELETE DASHBOARD CONFIRM */}
      {deletingDashId && (
        <div className="fixed inset-0 bg-[#0B0D11]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151C] border border-rose-500/30 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-100">Delete Dashboard?</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This removes the dashboard configuration. It will not delete your saved visualizations or dataset.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingDashId(null)}
                className="px-3.5 py-1.5 rounded-xl bg-[#181D26] text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDashboardConfirm}
                className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs"
              >
                Delete Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 37. TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#161B24] border border-[#2E3646] text-slate-100 text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-0.5 rounded text-slate-400 hover:text-slate-200 ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
