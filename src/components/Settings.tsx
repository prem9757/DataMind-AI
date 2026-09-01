import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Database,
  Trash2,
  Download,
  ShieldCheck,
  Zap,
  HardDrive,
  Keyboard,
  Moon,
  Sun,
  Lock,
  Cpu,
  Bot,
  CheckCircle2,
  Layers,
  AlertTriangle
} from 'lucide-react';
import { DatasetState } from '../types/dataset';
import { SessionManager, AppSettings } from '../services/sessionManager';

interface SettingsProps {
  dataset: DatasetState | null;
  onResetWorkspace: () => void;
  onNavigateToSection?: (section: string) => void;
}

export function Settings({ dataset, onResetWorkspace, onNavigateToSection }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>(() => SessionManager.loadSettings());
  const [activeTab, setActiveTab] = useState<'general' | 'performance' | 'ai' | 'security' | 'shortcuts'>('general');
  const [saveToast, setSaveToast] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    SessionManager.saveSettings(settings);
  }, [settings]);

  const updateSetting = <K extends keyof AppSettings>(key: K, val: AppSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: val };
      SessionManager.saveSettings(next);
      return next;
    });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const exportSessionJson = () => {
    if (!dataset) return;
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dataset.name.toLowerCase().replace(/\s+/g, '_')}_workspace_state.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#252A36] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Preferences
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage application appearance, analysis defaults, memory allocations, and shortcuts
              </p>
            </div>
          </div>
        </div>

        {saveToast && (
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" /> Preferences Saved
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#131720] border border-[#252A36] rounded-xl text-xs font-semibold overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'general' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <SettingsIcon className="w-3.5 h-3.5" /> General &amp; Theme
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'performance' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" /> Performance &amp; Sampling
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'ai' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bot className="w-3.5 h-3.5" /> AI &amp; Intelligence
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'security' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="w-3.5 h-3.5" /> Security &amp; Isolation
        </button>
        <button
          onClick={() => setActiveTab('shortcuts')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'shortcuts' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" /> Shortcuts
        </button>
      </div>

      {/* Tab 1: General & Theme */}
      {activeTab === 'general' && (
        <div className="space-y-4">
          <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
              Appearance &amp; Workspace Persistence
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0B0D11] border border-[#202530] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-200">Color Theme</p>
                    <p className="text-[11px] text-slate-400">Amber / Slate high-contrast dark aesthetic</p>
                  </div>
                  <div className="flex items-center gap-1 bg-[#181D26] border border-[#252A36] p-1 rounded-lg">
                    <button
                      onClick={() => updateSetting('theme', 'dark')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 ${
                        settings.theme === 'dark' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                      }`}
                    >
                      <Moon className="w-3 h-3" /> Dark
                    </button>
                    <button
                      onClick={() => updateSetting('theme', 'light')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 ${
                        settings.theme === 'light' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                      }`}
                    >
                      <Sun className="w-3 h-3" /> Light
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-[#0B0D11] border border-[#202530] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-200">Auto-Save Session State</p>
                    <p className="text-[11px] text-slate-400">Restore open datasets and filters on reload</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoSaveSession}
                    onChange={e => updateSetting('autoSaveSession', e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dataset Memory Footprint */}
          <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#252A36] pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Active Dataset In-Memory Footprint
                </h3>
              </div>
              {dataset && (
                <button
                  onClick={exportSessionJson}
                  className="px-3 py-1 bg-[#181D26] hover:bg-[#202734] border border-[#2B3242] text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  Export Session State (JSON)
                </button>
              )}
            </div>

            {dataset ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#202530]">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Active Name</span>
                  <p className="font-semibold text-slate-200 truncate mt-0.5">{dataset.name}</p>
                </div>
                <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#202530]">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Ingested Records</span>
                  <p className="font-semibold text-slate-200 mt-0.5 font-mono">{dataset.workingRows.length.toLocaleString()}</p>
                </div>
                <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#202530]">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Total Variables</span>
                  <p className="font-semibold text-slate-200 mt-0.5 font-mono">{dataset.columns.length}</p>
                </div>
                <div className="bg-[#0B0D11] p-3 rounded-xl border border-[#202530]">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Transformations</span>
                  <p className="font-semibold text-amber-400 mt-0.5 font-mono">{dataset.transformations.length}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No active dataset in memory.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Performance */}
      {activeTab === 'performance' && (
        <div className="space-y-4">
          <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
              High-Volume Dataset Performance Limits
            </h3>

            <div className="space-y-4">
              <div className="bg-[#0B0D11] border border-[#202530] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-200">Intelligent Chart Downsampling</p>
                    <p className="text-[11px] text-slate-400">
                      Downsamples scatter and density charts when dataset exceeds 50,000 points to ensure smooth 60fps rendering
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableIntelligentSampling}
                    onChange={e => updateSetting('enableIntelligentSampling', e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500"
                  />
                </div>
              </div>

              <div className="bg-[#0B0D11] border border-[#202530] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-200">Multi-Tier Result Caching</p>
                    <p className="text-[11px] text-slate-400">
                      Caches statistical regressions, correlation matrices, and EDA outputs; auto-invalidates on version change
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableDeterministicCache}
                    onChange={e => updateSetting('enableDeterministicCache', e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500"
                  />
                </div>
              </div>

              <div className="bg-[#0B0D11] border border-[#202530] rounded-xl p-4 space-y-2">
                <label className="text-xs font-bold text-slate-200 block">
                  Large Dataset Threshold (Rows)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={10000}
                    max={200000}
                    step={10000}
                    value={settings.largeDatasetSamplingThreshold}
                    onChange={e => updateSetting('largeDatasetSamplingThreshold', Number(e.target.value))}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="text-xs font-mono font-bold text-amber-400 w-24 text-right">
                    {settings.largeDatasetSamplingThreshold.toLocaleString()} rows
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: AI */}
      {activeTab === 'ai' && (
        <div className="space-y-4">
          <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
              AI Analyst Configuration &amp; Cost Control
            </h3>

            <div className="space-y-3">
              <div className="bg-[#0B0D11] border border-[#202530] rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-slate-200">Model Routing</p>
                <p className="text-[11px] text-slate-400">
                  Analytical calculations (t-tests, rankings, groupby sums, ML fits) are computed deterministically with Python first, with Gemini synthesizing business strategy and narratives.
                </p>
                <div className="pt-2">
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold">
                    Primary Engine: Gemini Flash + Deterministic Math Engine
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Security */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Security Architecture &amp; Prompt Injection Protection
            </h3>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="bg-[#0B0D11] border border-[#202530] rounded-xl p-3.5 space-y-1">
                <span className="font-bold text-emerald-400">1. Prompt Injection Shielding</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Dataset cell values are strictly isolated inside <code>&lt;UNTRUSTED_DATASET_OBSERVATION_DATA&gt;</code> blocks. Instructions like "Ignore previous instructions" within dataset cells are stripped and treated strictly as inert data text.
                </p>
              </div>

              <div className="bg-[#0B0D11] border border-[#202530] rounded-xl p-3.5 space-y-1">
                <span className="font-bold text-emerald-400">2. Zero Raw Data Exposure</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Only column metadata, aggregated statistics, and small representative samples are communicated. Full multi-megabyte raw records are never transmitted externally.
                </p>
              </div>

              <div className="bg-[#0B0D11] border border-[#202530] rounded-xl p-3.5 space-y-1">
                <span className="font-bold text-emerald-400">3. Immutable Original Files</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Original uploaded files are preserved in read-only snapshots. All cleaning and imputation steps operate on explicit version-tracked working copies.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Keyboard Shortcuts */}
      {activeTab === 'shortcuts' && (
        <div className="bg-[#0F1218] border border-[#252A36] rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-2">
            <Keyboard className="w-4 h-4" />
            Global Keyboard Shortcuts
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: 'Ctrl + K / ⌘ + K', desc: 'Open Command Palette from any screen' },
              { key: 'Ctrl + /', desc: 'Jump directly to Conversational AI Analyst' },
              { key: 'Ctrl + Enter', desc: 'Execute analytical natural language question' },
              { key: 'Esc', desc: 'Close open modals and command palettes' },
              { key: 'G + D', desc: 'Navigate to Executive Dashboard' },
              { key: 'G + M', desc: 'Navigate to Dataset Version Manager' },
              { key: 'G + Q', desc: 'Navigate to Data Quality Audit' },
              { key: 'G + R', desc: 'Navigate to Professional Reports' }
            ].map(sc => (
              <div key={sc.key} className="bg-[#0B0D11] border border-[#202530] rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-slate-300">{sc.desc}</span>
                <kbd className="px-2 py-1 bg-[#181D26] border border-[#2B3242] text-amber-400 font-mono text-[11px] rounded font-bold">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danger Zone: Workspace Reset */}
      <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-rose-400">
          <Trash2 className="w-4 h-4" />
          <h3 className="text-xs font-bold uppercase tracking-wider font-mono">Workspace Reset</h3>
        </div>
        <p className="text-xs text-slate-400">
          Clear all working datasets, transformation histories, and memory caches back to an initial empty state.
        </p>

        <button
          onClick={() => setShowResetConfirm(true)}
          className="px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 text-xs font-bold transition flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Reset Workspace &amp; Clear Ingested Datasets
        </button>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0F1218] border border-rose-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-100">Reset Workspace Confirmation</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Are you sure you want to clear all active datasets and analytics?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  onResetWorkspace();
                }}
                className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs rounded-xl transition-colors"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
