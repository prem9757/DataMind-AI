// ============================================================================
// SIDEBAR NAVIGATION — FINAL PRODUCTION ORDER
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  Database,
  TableProperties,
  ShieldCheck,
  Sparkles,
  BarChart3,
  PieChart,
  Bot,
  Sigma,
  BrainCircuit,
  Compass,
  FileSpreadsheet,
  ChevronRight
} from 'lucide-react';
import { DatasetState } from '../types/dataset';
import { globalJobEngine } from '../services/jobEngine';
import { globalDatasetEngine } from '../services/datasetEngine';

export type NavSection =
  | 'upload'
  | 'overview'
  | 'quality'
  | 'cleaning'
  | 'eda'
  | 'visualizations'
  | 'dashboard'
  | 'ai_analyst'
  | 'statistics'
  | 'ml'
  | 'investigations'
  | 'reports';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  dataset: DatasetState | null;
  onLoadSample?: (sampleId: string) => void;
  completedStages?: string[];
}

interface NavItemConfig {
  id: NavSection;
  label: string;
  icon: React.ReactNode;
  isPipelineStep?: boolean;
  getBadge?: (dataset: DatasetState | null, activeJobCount: number, datasetCount: number) => string | undefined;
  badgeType?: 'primary' | 'success' | 'warning' | 'neutral' | 'ai';
}

interface NavSectionConfig {
  title?: string;
  items: NavItemConfig[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  dataset,
  onLoadSample,
  completedStages = []
}) => {
  const [activeJobCount, setActiveJobCount] = useState(0);
  const [datasetCount, setDatasetCount] = useState(1);

  useEffect(() => {
    const unsubJobs = globalJobEngine.subscribe(jobs => {
      const running = jobs.filter(j => j.status === 'RUNNING' || j.status === 'QUEUED');
      setActiveJobCount(running.length);
    });

    const unsubDS = globalDatasetEngine.subscribe(list => {
      setDatasetCount(list.length);
    });

    return () => {
      unsubJobs();
      unsubDS();
    };
  }, []);

  const navigationSections: NavSectionConfig[] = [
    {
      title: 'MAIN WORKFLOW',
      items: [
        {
          id: 'upload',
          label: 'Data Ingestion',
          icon: <UploadCloud className="w-4 h-4" />,
          isPipelineStep: true
        },
        {
          id: 'overview',
          label: 'Data Exploration',
          icon: <TableProperties className="w-4 h-4" />,
          isPipelineStep: true
        },
        {
          id: 'quality',
          label: 'Data Quality Assessment',
          icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
          isPipelineStep: true,
          getBadge: ds => (ds ? `${ds.quality.score}/100` : undefined),
          badgeType: 'success'
        },
        {
          id: 'cleaning',
          label: 'Data Preparation',
          icon: <Sparkles className="w-4 h-4 text-amber-400" />,
          isPipelineStep: true,
          getBadge: ds => {
            const pending = ds?.cleaningPlan?.steps?.filter(s => s.status === 'PENDING').length || 0;
            return pending > 0 ? `${pending} fixes` : undefined;
          }
        },
        {
          id: 'eda',
          label: 'Automated Exploratory Data Analysis',
          icon: <BarChart3 className="w-4 h-4 text-amber-400" />,
          isPipelineStep: true
        },
        {
          id: 'visualizations',
          label: 'Data Visualization',
          icon: <PieChart className="w-4 h-4" />,
          isPipelineStep: true
        },
        {
          id: 'dashboard',
          label: 'Executive Dashboard',
          icon: <LayoutDashboard className="w-4 h-4 text-amber-400" />,
          isPipelineStep: true
        }
      ]
    },
    {
      title: 'INTELLIGENCE & MODELING',
      items: [
        {
          id: 'ai_analyst',
          label: 'AI-Powered Analytics',
          icon: <Bot className="w-4 h-4 text-amber-400" />,
          isPipelineStep: true
        },
        {
          id: 'statistics',
          label: 'Statistical Analysis',
          icon: <Sigma className="w-4 h-4" />,
          isPipelineStep: true
        },
        {
          id: 'ml',
          label: 'Machine Learning',
          icon: <BrainCircuit className="w-4 h-4 text-amber-400" />,
          isPipelineStep: true
        },
        {
          id: 'investigations',
          label: 'Autonomous Analytics Agent',
          icon: <Compass className="w-4 h-4 text-amber-400" />,
          isPipelineStep: true
        }
      ]
    },
    {
      title: 'OUTPUT & ASSETS',
      items: [
        {
          id: 'reports',
          label: 'Reports & Export',
          icon: <FileSpreadsheet className="w-4 h-4" />,
          isPipelineStep: true
        }
      ]
    }
  ];

  return (
    <aside className="w-68 bg-[#0B0D11] border-r border-[#252A36] flex flex-col h-screen select-none shrink-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-[#252A36]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <BrainCircuit className="w-5 h-5 text-slate-950" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-xs text-slate-100 tracking-tight leading-snug">Smart Data Analysis Assistant</span>
          <span className="text-[9px] text-amber-400 uppercase tracking-widest font-semibold mt-0.5">Autonomous Analytics</span>
        </div>
      </div>

      {/* Dataset Status Banner */}
      <div className="p-3 border-b border-[#252A36]">
        {dataset ? (
          <div className="bg-[#12151C] border border-[#252A36] rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-200 font-semibold truncate max-w-[120px]" title={dataset.name}>
                {dataset.name}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Score: {dataset.quality.score}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>{dataset.workingRows.length.toLocaleString()} rows</span>
              <span>{dataset.columns.length} cols</span>
            </div>
          </div>
        ) : (
          <div className="bg-[#12151C]/60 border border-dashed border-[#2D3342] rounded-xl p-3 text-center">
            <p className="text-xs text-slate-400 font-medium">No Dataset Ingested</p>
            <button
              onClick={() => onSelectSection('upload')}
              className="mt-1.5 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
            >
              Upload or Select <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">
        {/* Dynamic Navigation Sections */}
        {navigationSections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {section.title && (
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
                {section.title}
              </div>
            )}

            {section.items.map(item => {
              const isActive = activeSection === item.id;
              const badge = item.getBadge ? item.getBadge(dataset, activeJobCount, datasetCount) : undefined;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectSection(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#12151C]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    {/* Pipeline Status Indicator */}
                    {item.isPipelineStep && (
                      <span className="w-3 text-center shrink-0">
                        {completedStages.includes(item.id) && !isActive ? (
                          <span className="text-emerald-400 font-bold text-[10px]">✓</span>
                        ) : isActive ? (
                          <span className="text-slate-950 font-black text-[10px]">●</span>
                        ) : (
                          <span className="text-slate-600 text-[9px]">○</span>
                        )}
                      </span>
                    )}

                    <span className={isActive ? 'text-slate-950' : 'text-slate-400'}>{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </div>

                  {badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold shrink-0 ml-1.5 ${
                        isActive
                          ? 'bg-slate-950 text-amber-400'
                          : item.badgeType === 'ai' || badge.includes('active') || badge.includes('steps')
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : item.badgeType === 'success'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[#181D26] text-slate-400'
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
};
