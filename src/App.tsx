import React, { useState, useEffect } from 'react';
import { Sidebar, NavSection } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { Dashboard } from './components/Dashboard';
import { DataUpload } from './components/DataUpload';
import { DataOverview } from './components/DataOverview';
import { DataQuality } from './components/DataQuality';
import { DataCleaning } from './components/DataCleaning';
import { ExploratoryAnalysis } from './components/ExploratoryAnalysis';
import { Visualizations } from './components/Visualizations';
import { AIAnalyst } from './components/AIAnalyst';
import { StatisticalAnalysis } from './components/StatisticalAnalysis';
import { MachineLearning } from './components/MachineLearning';
import { Reports } from './components/Reports';
import { CommandPalette } from './components/CommandPalette';
import { NotificationCenter } from './components/NotificationCenter';
import { AgentInvestigationDashboard } from './components/AgentInvestigationDashboard';

import { DatasetState, QualityIssue, TransformationAction } from './types/dataset';
import { AppNotification } from './types/production';
import { SAMPLE_DATASETS } from './services/sampleData';
import { parseRawArray } from './services/dataParser';
import { profileDataset } from './services/profiler';
import { auditDataQuality } from './services/qualityEngine';
import { generateDatasetInsights } from './services/insightEngine';
import { generateCleaningPlan } from './services/cleaningPlanEngine';
import { applyTransformation } from './services/cleaner';
import { globalDatasetEngine } from './services/datasetEngine';
import { globalObservability } from './services/observability';
import { SecurityHardener } from './services/securityHardener';

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('upload');
  const [dataset, setDataset] = useState<DatasetState | null>(null);
  const [pendingAIQuery, setPendingAIQuery] = useState<string | undefined>(undefined);
  const [overviewFilter, setOverviewFilter] = useState<'all' | 'missing' | 'outliers' | 'duplicates'>('all');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp'>) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const full: AppNotification = {
      ...notif,
      id,
      timestamp: Date.now()
    };
    setNotifications(prev => [full, ...prev]);

    if (notif.autoDismiss !== false) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 4500);
    }
  };

  const handleDismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Listen for global keyboard shortcuts (Ctrl+K, Cmd+K, Ctrl+/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setActiveSection('ai_analyst');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize with sample dataset on first load
  useEffect(() => {
    if (!dataset) {
      loadInitialSample();
    }
  }, []);

  const loadInitialSample = () => {
    const defaultSample = SAMPLE_DATASETS[0]; // Customer Orders Benchmark
    const parsed = parseRawArray(defaultSample.data, defaultSample.name);
    const profiles = profileDataset(parsed.rows, parsed.columns);
    const quality = auditDataQuality(parsed.rows, parsed.columns, profiles);
    const { insights, recommendations, suggestedQuestions } = generateDatasetInsights(
      parsed.rows,
      parsed.columns,
      profiles
    );

    const initialDataset: DatasetState = {
      id: `ds-init-${Date.now()}`,
      name: defaultSample.name,
      fileName: 'customer_orders_quality_benchmark.csv',
      fileSize: parsed.fileSize,
      fileType: 'CSV Document',
      uploadedAt: Date.now(),
      originalRows: parsed.rows.map(r => ({ ...r })),
      workingRows: parsed.rows.map(r => ({ ...r })),
      columns: parsed.columns,
      profiles,
      quality,
      transformations: [],
      insights,
      recommendations,
      suggestedQuestions
    };

    initialDataset.cleaningPlan = generateCleaningPlan(initialDataset);

    // Register with centralized dataset engine
    globalDatasetEngine.registerDataset(initialDataset, 'Initial ingestion of Customer Orders Benchmark');
    setDataset(initialDataset);

    globalObservability.logEvent('INFO', 'DatasetEngine', 'Initialized workspace with default benchmark dataset');
  };

  const handleDatasetLoaded = (newDataset: DatasetState) => {
    if (!newDataset.cleaningPlan) {
      newDataset.cleaningPlan = generateCleaningPlan(newDataset);
    }
    globalDatasetEngine.registerDataset(newDataset, 'User uploaded new dataset file');
    setDataset(newDataset);
    setActiveSection('dashboard');

    addNotification({
      type: 'success',
      title: 'Dataset Ingestion Complete',
      message: `Loaded ${newDataset.workingRows.length.toLocaleString()} rows and ${newDataset.columns.length} columns.`,
      linkSection: 'dashboard'
    });
  };

  const handleLoadSampleById = (sampleId: string) => {
    const sample = SAMPLE_DATASETS.find(s => s.id === sampleId);
    if (!sample) return;

    const parsed = parseRawArray(sample.data, sample.name);
    const profiles = profileDataset(parsed.rows, parsed.columns);
    const quality = auditDataQuality(parsed.rows, parsed.columns, profiles);
    const { insights, recommendations, suggestedQuestions } = generateDatasetInsights(
      parsed.rows,
      parsed.columns,
      profiles
    );

    const newDataset: DatasetState = {
      id: `ds-${Date.now()}`,
      name: sample.name,
      fileName: `${sample.id}.csv`,
      fileSize: parsed.fileSize,
      fileType: 'Sample Dataset',
      uploadedAt: Date.now(),
      originalRows: parsed.rows.map(r => ({ ...r })),
      workingRows: parsed.rows.map(r => ({ ...r })),
      columns: parsed.columns,
      profiles,
      quality,
      transformations: [],
      insights,
      recommendations,
      suggestedQuestions
    };

    newDataset.cleaningPlan = generateCleaningPlan(newDataset);
    globalDatasetEngine.registerDataset(newDataset, `Ingested ${sample.name}`);
    setDataset(newDataset);
    setActiveSection('dashboard');

    addNotification({
      type: 'info',
      title: 'Sample Benchmark Loaded',
      message: `Switched active dataset to ${sample.name}.`,
      linkSection: 'dashboard'
    });
  };

  const handleUpdateDataset = (updated: DatasetState, changeDescription?: string) => {
    setDataset(updated);
    globalDatasetEngine.updateWorkingState(
      updated.id,
      updated,
      changeDescription || `Applied ${updated.transformations[updated.transformations.length - 1]?.action.type || 'transformation'}`
    );
  };

  const handleQuickFixQualityIssue = (issue: QualityIssue) => {
    if (!dataset) return;

    try {
      let action: TransformationAction | null = issue.suggestedAction || null;

      if (!action) {
        if (issue.fixType === 'fill_mean' || issue.fixType === 'fill_median' || issue.fixType === 'fill_mode') {
          action = {
            type: 'impute_missing',
            column: issue.column,
            strategy: issue.fixType === 'fill_mean' ? 'mean' : issue.fixType === 'fill_median' ? 'median' : 'mode'
          };
        } else if (issue.fixType === 'drop_duplicates') {
          action = { type: 'remove_duplicates' };
        } else if (issue.fixType === 'drop_duplicate_ids') {
          action = { type: 'remove_duplicate_ids', column: issue.column, keep: 'first' };
        } else if (issue.fixType === 'normalize_case') {
          action = { type: 'standardize_case', column: issue.column, caseFormat: 'title' };
        } else if (issue.fixType === 'trim_whitespace') {
          action = { type: 'trim_whitespace', column: issue.column };
        } else if (issue.fixType === 'cap_outliers') {
          action = { type: 'cap_outliers', column: issue.column };
        } else if (issue.fixType === 'drop_missing') {
          action = { type: 'drop_missing', column: issue.column };
        } else if (issue.fixType === 'drop_column') {
          action = { type: 'drop_column', column: issue.column };
        } else if (issue.fixType === 'convert_type') {
          action = { type: 'convert_type', column: issue.column, targetType: dataset.profiles[issue.column]?.recommendedType || 'numeric' };
        }
      }

      if (action) {
        const updated = applyTransformation(dataset, action);
        handleUpdateDataset(updated, `Quick-fix: ${issue.problem}`);

        addNotification({
          type: 'success',
          title: 'Quality Fix Applied',
          message: `${issue.problem} resolved. Quality score updated to ${updated.quality.score}/100.`,
          linkSection: 'quality'
        });
      }
    } catch (err: any) {
      const classified = SecurityHardener.classifyError(err, 'DATA_ERROR');
      addNotification({
        type: 'error',
        title: 'Transformation Error',
        message: classified.userMessage
      });
    }
  };

  const handleInspectQualityRows = (filterType: 'missing' | 'outliers' | 'duplicates' | 'all') => {
    setOverviewFilter(filterType);
    setActiveSection('overview');
  };

  const handleSelectQueryForAI = (query: string) => {
    setPendingAIQuery(query);
    setActiveSection('ai_analyst');
  };

  const handleResetWorkspace = () => {
    setDataset(null);
    setActiveSection('upload');
    addNotification({
      type: 'warning',
      title: 'Workspace Reset',
      message: 'All memory datasets and cached calculations cleared.'
    });
  };

  return (
    <div className="flex h-screen w-screen bg-[#0B0D11] text-slate-100 font-sans antialiased overflow-hidden selection:bg-amber-500/30 selection:text-amber-200">
      {/* Navigation Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        dataset={dataset}
        onLoadSample={handleLoadSampleById}
      />

      {/* Main App Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0B0D11]">
        <TopNav
          dataset={dataset}
          onOpenReport={() => setActiveSection('reports')}
          onOpenAIAnalyst={() => setActiveSection('ai_analyst')}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenProcessingCenter={() => setActiveSection('jobs')}
        />

        {/* Dynamic Section Router */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#0B0D11]">
          {activeSection === 'dashboard' && (
            <Dashboard
              dataset={dataset}
              onNavigate={setActiveSection}
              onSelectQuery={handleSelectQueryForAI}
              onLoadSample={handleLoadSampleById}
            />
          )}

          {activeSection === 'investigations' && (
            <AgentInvestigationDashboard
              dataset={dataset}
              onNavigateToUpload={() => setActiveSection('upload')}
              onNavigateToReports={() => setActiveSection('reports')}
            />
          )}

          {activeSection === 'upload' && (
            <DataUpload
              onDatasetLoaded={handleDatasetLoaded}
              onNavigate={setActiveSection}
              onLoadSample={handleLoadSampleById}
            />
          )}

          {activeSection === 'overview' && dataset && (
            <DataOverview
              dataset={dataset}
              initialFilter={overviewFilter}
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === 'quality' && dataset && (
            <DataQuality
              dataset={dataset}
              onApplyQuickFix={handleQuickFixQualityIssue}
              onNavigateToCleaning={() => setActiveSection('cleaning')}
              onNavigate={setActiveSection}
              onInspectRows={handleInspectQualityRows}
            />
          )}

          {activeSection === 'cleaning' && dataset && (
            <DataCleaning
              dataset={dataset}
              onUpdateDataset={handleUpdateDataset}
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === 'eda' && dataset && (
            <ExploratoryAnalysis
              dataset={dataset}
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === 'visualizations' && dataset && (
            <Visualizations
              dataset={dataset}
              onNavigate={setActiveSection}
              onSelectQueryForAI={handleSelectQueryForAI}
            />
          )}

          {activeSection === 'ai_analyst' && dataset && (
            <AIAnalyst
              dataset={dataset}
              initialQuery={pendingAIQuery}
              onClearInitialQuery={() => setPendingAIQuery(undefined)}
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === 'statistics' && dataset && (
            <StatisticalAnalysis
              dataset={dataset}
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === 'ml' && dataset && (
            <MachineLearning
              dataset={dataset}
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === 'reports' && dataset && (
            <Reports
              dataset={dataset}
              onNavigate={setActiveSection}
            />
          )}
        </main>
      </div>

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={setActiveSection}
        onSelectQuery={handleSelectQueryForAI}
      />

      {/* Floating Centralized Notification Center */}
      <NotificationCenter
        notifications={notifications}
        onDismiss={handleDismissNotification}
        onNavigateSection={setActiveSection}
      />
    </div>
  );
}
